import Movie from "../models/Movie.js";
import MovieRequest from "../models/MovieRequest.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

// ── Partner: submit a request ─────────────────────────────────────────────────
export const createPartnerMovieRequest = async (req, res) => {
  try {
    const {
      requestType, movieId, venueId, title, description,
      genre, language, rating, censorRating, duration,
      releaseDate, year, cast,
    } = req.body;

    if (!requestType)
      return res.status(400).json({ message: "Request type is required" });
    if (requestType === "NEW_MOVIE" && !title)
      return res.status(400).json({ message: "Title is required" });

    const posterUrl = req.file ? `/uploads/posters/${req.file.filename}` : "";

    const request = await MovieRequest.create({
      partnerId: req.user.id,
      venueId: venueId || null, 
      movieId: movieId || null,
      requestType,
      title: title || "",
      description: description || "",
      genre: genre || "",
      language: language || "",
      rating: rating ? Number(rating) : 0,
      censorRating: censorRating || "",
      duration: duration ? Number(duration) : 0,
      releaseDate: releaseDate || "",
      year: year ? Number(year) : null,
      cast: cast || "",
      posterUrl,
      status: "PENDING",
    });

    await Notification.create([
  {
    title: "New Movie Request 🎬",
    message: `${req.user.name} submitted a movie request${title ? ` for "${title}"` : ""}`,
    type: "MOVIE",
    receiverRole: "ADMIN",
    meta: {
      requestType,
      requestId: request._id,
      partnerId: req.user.id,
      movieId: request.movieId || null,
      venueId: request.venueId || null,
    },
  },
  {
    title: "New Movie Request 🎬",
    message: `${req.user.name} submitted a movie request${title ? ` for "${title}"` : ""}`,
    type: "MOVIE",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType,
      requestId: request._id,
      partnerId: req.user.id,
      movieId: request.movieId || null,
      venueId: request.venueId || null,
    },
  },
])

    res.status(201).json({ message: "Movie request submitted successfully", request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Partner: get own requests ─────────────────────────────────────────────────
export const getMyMovieRequests = async (req, res) => {
  try {
    const requests = await MovieRequest.find({ partnerId: req.user.id })
      .populate("movieId", "title genre language posterUrl")
      .populate("venueId", "name")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Admin / Super Admin: get all requests ─────────────────────────────────────
export const getAllMovieRequests = async (req, res) => {
  try {
    const requests = await MovieRequest.find()
      .populate("partnerId", "name email role")
      .populate("movieId", "title genre language posterUrl")
      .populate("venueId", "name")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Admin / Super Admin: approve ──────────────────────────────────────────────
export const approveMovieRequest = async (req, res) => {
  try {
    const request = await MovieRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "PENDING")
      return res.status(400).json({ message: "Request already reviewed" });

    let movieId = request.movieId;

    if (request.requestType === "NEW_MOVIE") {
      const movie = await Movie.create({
        title: request.title,
        description: request.description,
        genre: request.genre,
        language: request.language,
        rating: request.rating,
        censorRating: request.censorRating,
        duration: request.duration,
        releaseDate: request.releaseDate,
        year: request.year || new Date().getFullYear(),
        cast: request.cast,
        posterUrl: request.posterUrl,
        createdBy: req.user.id,
        isActive: true,
      });
      movieId = movie._id;
    }

    request.movieId   = movieId;
    request.status    = "APPROVED";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.adminNote  = req.body.adminNote || "Approved";
    await request.save();

    // Notify the partner
    try {
      await Notification.create({
        title: "Movie Request Approved ✅",
        message: `Your movie request for "${request.title || "a new movie"}" has been approved.`,
        type: "MOVIE",
        receiverId: request.partnerId,
        meta: {
          requestId: request._id,
          movieId: movieId
        }
      });
    } catch (notifErr) {
      console.error("Failed to create movie approval notification:", notifErr);
    }

    res.json({ message: "Movie request approved successfully", request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Admin / Super Admin: reject ───────────────────────────────────────────────
export const rejectMovieRequest = async (req, res) => {
  try {
    const request = await MovieRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "PENDING")
      return res.status(400).json({ message: "Request already reviewed" });

    request.status     = "REJECTED";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.adminNote  = req.body.adminNote || "Rejected";
    await request.save();

    // Notify the partner
    try {
      await Notification.create({
        title: "Movie Request Rejected ❌",
        message: `Your movie request for "${request.title || "a movie"}" has been rejected. Note: ${request.adminNote}`,
        type: "MOVIE",
        receiverId: request.partnerId,
        meta: {
          requestId: request._id,
          adminNote: request.adminNote
        }
      });
    } catch (notifErr) {
      console.error("Failed to create movie rejection notification:", notifErr);
    }

    res.json({ message: "Movie request rejected successfully", request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Admin / Super Admin: add movie directly ───────────────────────────────────
export const addMovieDirectly = async (req, res) => {
  try {
    const {
      title, description, genre, language, rating,
      censorRating, duration, releaseDate, year, cast,
    } = req.body;

    if (!title) return res.status(400).json({ message: "Title is required" });

    const posterUrl = req.file ? `/uploads/posters/${req.file.filename}` : "";

    const movie = await Movie.create({
      title,
      description: description || "",
      genre:        genre        || "",
      language:     language     || "",
      rating:       rating       ? Number(rating)   : 0,
      censorRating: censorRating || "",
      duration:     duration     ? Number(duration) : 0,
      releaseDate:  releaseDate  || "",
      year:         year         ? Number(year)     : new Date().getFullYear(),
      cast:         cast         || "",
      posterUrl,
      createdBy: req.user.id,
      isActive:  true,
    });

    const partners = await User.find({
  role: "MANAGER",
  approvalStatus: "APPROVED",
  isActive: true,
  isBanned: false,
}).select("_id")

if (partners.length > 0) {
  await Notification.create(
    partners.map((partner) => ({
      title: "New Movie Added 🍿",
      message: `A new movie "${movie.title}" has been added to the platform`,
      type: "MOVIE",
      receiverId: partner._id,
      meta: {
        movieId: movie._id,
        addedBy: req.user.id,
      },
    }))
  )
}

    res.status(201).json({ message: "Movie added successfully", movie });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};