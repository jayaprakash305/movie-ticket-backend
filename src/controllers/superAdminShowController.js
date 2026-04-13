import Show from "../models/Show.js";
import Movie from "../models/Movie.js";
import Venue from "../models/Venue.js";
import Notification from "../models/Notification.js";

// ── Helper: check time conflict ──────────────────────────────────────────────
const hasTimeConflict = async ({ screenId, showDate, showTime, showEndTime, excludeShowId }) => {
  if (!screenId || !showDate || !showTime || !showEndTime) return null;

  const toMins = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const newStart = toMins(showTime);
  const newEnd = toMins(showEndTime);

  const query = {
    screenId,
    showDate,
    isActive: true,
    ...(excludeShowId ? { _id: { $ne: excludeShowId } } : {}),
  };

  const existing = await Show.find(query).select("showTime showEndTime movieId");

  for (const show of existing) {
    if (!show.showTime || !show.showEndTime) continue;

    const exStart = toMins(show.showTime);
    const exEnd = toMins(show.showEndTime);

    if (newStart < exEnd && newEnd > exStart) {
      const movie = await Movie.findById(show.movieId).select("title");
      return {
        message: `Time conflict with "${movie?.title || "Another show"}" (${show.showTime}-${show.showEndTime})`,
      };
    }
  }

  return null;
};

// ── GET all shows ────────────────────────────────────────────────────────────
export const getAllShowsForSuperAdmin = async (req, res) => {
  try {
    const shows = await Show.find({ isActive: true })
      .populate("movieId", "title posterUrl duration")
      .populate("venueId", "name city")
      .populate("partnerId", "name email")
      .sort({ showDate: 1, showTime: 1 });

    res.json(
      shows.map((s) => ({
        id: String(s._id),
        movie: s.movieId
          ? {
              id: String(s.movieId._id),
              title: s.movieId.title,
              posterUrl: s.movieId.posterUrl,
              duration: s.movieId.duration,
            }
          : null,
        venue: s.venueId
          ? {
              id: String(s.venueId._id),
              name: s.venueId.name,
              city: s.venueId.city,
            }
          : null,
        partner: s.partnerId
          ? {
              id: String(s.partnerId._id),
              name: s.partnerId.name,
              email: s.partnerId.email,
            }
          : null,
        screenName: s.screenName,
        showDate: s.showDate,
        showTime: s.showTime,
        showEndTime: s.showEndTime,
        price: s.price,
        totalSeats: s.totalSeats,
        availableSeats: s.availableSeats,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── CREATE show ──────────────────────────────────────────────────────────────
export const createShowBySuperAdmin = async (req, res) => {
  try {
    const {
      movieId,
      venueId,
      screenId,
      showDate,
      showTime,
      showEndTime,
      price,
    } = req.body;

    if (!movieId || !venueId || !showDate || !showTime || !price) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const movie = await Movie.findById(movieId);
    if (!movie || !movie.isActive) {
      return res.status(404).json({ message: "Movie not found" });
    }

    const venue = await Venue.findById(venueId);
    if (!venue || !venue.isActive) {
      return res.status(404).json({ message: "Venue not found" });
    }

    let resolvedSeats = venue.totalSeats;
    let resolvedScreenName = venue.screenName || "";

    if (screenId) {
      const screen = venue.screens.find(
        (s) => String(s._id) === String(screenId)
      );

      if (!screen) {
        return res.status(404).json({ message: "Screen not found" });
      }

      resolvedSeats = screen.totalSeats;
      resolvedScreenName = screen.screenName;
    }

    let computedEndTime = showEndTime;

    if (!computedEndTime && movie.duration) {
      const [h, m] = showTime.split(":").map(Number);
      const totalMin = h * 60 + m + Number(movie.duration);
      computedEndTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
    }

    if (screenId && computedEndTime) {
      const conflict = await hasTimeConflict({
        screenId,
        showDate,
        showTime,
        showEndTime: computedEndTime,
      });

      if (conflict) {
        return res.status(409).json({ message: conflict.message });
      }
    }

    const partnerId = venue.partnerId || venue.createdBy || req.user.id;

    const show = await Show.create({
      movieId,
      venueId,
      screenId: screenId || null,
      screenName: resolvedScreenName,
      showDate,
      showTime,
      showEndTime: computedEndTime || null,
      price: Number(price),
      totalSeats: resolvedSeats,
      availableSeats: resolvedSeats,
      createdBy: req.user._id || req.user.id,
      partnerId,
      isActive: true,
    });

    // Notify the partner
    try {
      await Notification.create({
        title: "New Show Scheduled 🎭",
        message: `A new show for "${movie.title}" has been scheduled at ${venue.name} by Super Admin.`,
        type: "SHOW",
        receiverId: partnerId,
        meta: {
          showId: show._id,
          venueId: venue._id,
          movieId: movie._id
        }
      });
    } catch (notifErr) {
      console.error("Failed to create show notification:", notifErr);
    }

    res.status(201).json({
      message: "Show created successfully",
      showId: show._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── UPDATE show ──────────────────────────────────────────────────────────────
export const updateShowBySuperAdmin = async (req, res) => {
  try {
    const { showId } = req.params;

    const show = await Show.findById(showId);
    if (!show || !show.isActive) {
      return res.status(404).json({ message: "Show not found" });
    }

    const venue = await Venue.findById(show.venueId);

    let computedEndTime = req.body.showEndTime;

    if (!computedEndTime && req.body.showTime) {
      const movie = await Movie.findById(req.body.movieId || show.movieId);
      if (movie?.duration) {
        const [h, m] = req.body.showTime.split(":").map(Number);
        const totalMin = h * 60 + m + Number(movie.duration);
        computedEndTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
      }
    }

    const effectiveScreenId = req.body.screenId || show.screenId;

    if (effectiveScreenId && computedEndTime) {
      const conflict = await hasTimeConflict({
        screenId: effectiveScreenId,
        showDate: req.body.showDate || show.showDate,
        showTime: req.body.showTime || show.showTime,
        showEndTime: computedEndTime,
        excludeShowId: show._id,
      });

      if (conflict) {
        return res.status(409).json({ message: conflict.message });
      }
    }

    if (req.body.movieId) show.movieId = req.body.movieId;
    if (req.body.venueId) show.venueId = req.body.venueId;
    if (req.body.screenId) show.screenId = req.body.screenId;
    if (req.body.showDate) show.showDate = req.body.showDate;
    if (req.body.showTime) show.showTime = req.body.showTime;
    if (computedEndTime) show.showEndTime = computedEndTime;
    if (req.body.price) show.price = Number(req.body.price);

    await show.save();

    res.json({ message: "Show updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── DELETE show ──────────────────────────────────────────────────────────────
export const deleteShowBySuperAdmin = async (req, res) => {
  try {
    const { showId } = req.params;

    const show = await Show.findById(showId);

    if (!show || !show.isActive) {
      return res.status(404).json({ message: "Show not found" });
    }

    show.isActive = false;
    await show.save();

    res.json({ message: "Show deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};