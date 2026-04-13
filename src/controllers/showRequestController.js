import ShowRequest from "../models/ShowRequest.js";
import Show        from "../models/Show.js";
import Venue       from "../models/Venue.js";
import Movie       from "../models/Movie.js";
import Notification from "../models/Notification.js";

/* ─────────────────────────────────────────────
   PARTNER → GET MY SHOW REQUESTS
   GET /partner-portal/show-requests
───────────────────────────────────────────── */
export const getMyShowRequests = async (req, res) => {
  try {
    const requestedBy = req.user.id || req.user._id;

    const requests = await ShowRequest.find({ requestedBy })
      .populate("requestedBy", "name email")
      .populate("reviewedBy",  "name email")
      .populate({
        path:   "payload.movieId",
        select: "title posterUrl duration language",
        model:  "Movie",
      })
      .populate({
        path:   "venueId",
        select: "name city area",
        model:  "Venue",
      })
      .sort({ createdAt: -1 });

    const formatted = requests.map((r) => ({
      _id:            r._id,
      id:             r._id,
      requestType:    r.requestType,
      approvalStatus: r.approvalStatus,
      showId:         r.showId  || null,
      venueId:        r.venueId || null,
      payload:        r.payload || {},
      adminNote:      r.adminNote || null,
      reviewedBy: r.reviewedBy
        ? { id: r.reviewedBy._id, name: r.reviewedBy.name, email: r.reviewedBy.email }
        : null,
      reviewedAt: r.reviewedAt || null,
      createdAt:  r.createdAt,
      updatedAt:  r.updatedAt,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────
   PARTNER → CREATE REQUEST
   POST /partner-portal/show-requests/create
───────────────────────────────────────────── */
export const createShowCreateRequest = async (req, res) => {
  try {
    const request = await ShowRequest.create({
      requestType: "CREATE",
      requestedBy: req.user.id,
      venueId:     req.body.venueId,
      payload:     req.body,
    });

    await Notification.create([
  {
    title: "New Show Request 🎟️",
    message: `${req.user.name} submitted a show create request`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "SHOW_CREATE",
      requestId: request._id,
      venueId: req.body.venueId,
      partnerId: req.user.id,
    },
  },
  {
    title: "New Show Request 🎟️",
    message: `${req.user.name} submitted a show create request`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "SHOW_CREATE",
      requestId: request._id,
      venueId: req.body.venueId,
      partnerId: req.user.id,
    },
  },
])

    res.status(201).json({ message: "Show create request sent", request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────
   PARTNER → UPDATE REQUEST
   POST /partner-portal/show-requests/update/:showId
───────────────────────────────────────────── */
export const createShowUpdateRequest = async (req, res) => {
  try {
    // Sanitize payload to only include relevant show fields
    const cleanPayload = {
      movieId:     req.body.movieId,
      venueId:     req.body.venueId,
      screenId:    req.body.screenId,
      screenName:  req.body.screenName,
      showDate:    req.body.showDate,
      showTime:    req.body.showTime,
      showEndTime: req.body.showEndTime,
      price:       req.body.price,
      totalSeats:  req.body.totalSeats,
    };

    console.log("Creating UPDATE request with payload:", cleanPayload);

    const request = await ShowRequest.create({
      requestType: "UPDATE",
      requestedBy: req.user.id,
      showId:      req.params.showId,
      venueId:     req.body.venueId,
      payload:     cleanPayload,
    });

    await Notification.create([
  {
    title: "New Show Request 🎟️",
    message: `${req.user.name} submitted a show create request`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "SHOW_CREATE",
      requestId: request._id,
      venueId: req.body.venueId,
      partnerId: req.user.id,
    },
  },
  {
    title: "New Show Request 🎟️",
    message: `${req.user.name} submitted a show create request`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "SHOW_CREATE",
      requestId: request._id,
      venueId: req.body.venueId,
      partnerId: req.user.id,
    },
  },
])

    res.status(201).json({ message: "Show update request sent", request });
  } catch (err) {
    console.error("createShowUpdateRequest error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────
   PARTNER → DELETE REQUEST
   POST /partner-portal/show-requests/delete/:showId
───────────────────────────────────────────── */
export const createShowDeleteRequest = async (req, res) => {
  try {
    const request = await ShowRequest.create({
      requestType: "DELETE",
      requestedBy: req.user.id,
      showId:      req.params.showId,
      venueId:     req.body.venueId,
    });

    await Notification.create([
  {
    title: "Show Update Request ✏️",
    message: `${req.user.name} submitted a show update request`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "SHOW_UPDATE",
      requestId: request._id,
      showId: req.params.showId,
      venueId: req.body.venueId,
      partnerId: req.user.id,
    },
  },
  {
    title: "Show Update Request ✏️",
    message: `${req.user.name} submitted a show update request`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "SHOW_UPDATE",
      requestId: request._id,
      showId: req.params.showId,
      venueId: req.body.venueId,
      partnerId: req.user.id,
    },
  },
])

    res.status(201).json({ message: "Show delete request sent", request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────
   ADMIN → GET ALL REQUESTS
   GET /admin/show-requests
───────────────────────────────────────────── */
export const getAllShowRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      filter.approvalStatus = status;
    }

    const requests = await ShowRequest.find(filter)
      .populate("requestedBy", "name email role")
      .populate("reviewedBy",  "name email")
      .populate({
        path:   "payload.movieId",
        select: "title posterUrl duration language",
        model:  "Movie",
      })
      .populate({
        path:   "venueId",
        select: "name city area",
        model:  "Venue",
      })
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────
   ADMIN → APPROVE
   PATCH /admin/show-requests/:id/approve
───────────────────────────────────────────── */
export const approveShowRequest = async (req, res) => {
  try {
    const request = await ShowRequest.findById(req.params.id)
      .populate("requestedBy", "name email");

    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: "Only PENDING requests can be approved" });
    }

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (request.requestType === "CREATE") {
      const p = request.payload || {};

      const movieId  = p.movieId;
      const venueId  = p.venueId;
      const screenId = p.screenId || null;
      const showDate = p.showDate;
      const showTime = p.showTime;
      const price    = Number(p.price);

      if (!movieId || !venueId || !showDate || !showTime || !price) {
        return res.status(400).json({
          message: "Payload missing required fields: movieId, venueId, showDate, showTime, price",
        });
      }

      // Look up the venue to get partnerId and screen details
      const venue = await Venue.findById(venueId);
      if (!venue) return res.status(404).json({ message: "Venue not found" });

      // Resolve totalSeats + screenName from the chosen screen
      let totalSeats  = Number(p.totalSeats) || 0;
      let screenName  = p.screenName || "";
      let showEndTime = p.showEndTime || null;

      if (screenId) {
        const screen = (venue.screens || []).find(
          (s) => String(s._id) === String(screenId)
        );
        if (screen) {
          totalSeats = screen.totalSeats;
          screenName = screen.screenName;
        }
      }

      // Fall back to venue-level totalSeats
      if (!totalSeats || totalSeats < 1) totalSeats = venue.totalSeats || 0;

      if (!totalSeats || totalSeats < 1) {
        return res.status(400).json({
          message: "Cannot determine totalSeats — check venue/screen configuration",
        });
      }

      // Auto-compute showEndTime from movie duration when missing
      if (!showEndTime) {
        const movie = await Movie.findById(movieId).select("duration");
        if (movie?.duration && showTime) {
          const [h, m] = showTime.split(":").map(Number);
          const totalMin = h * 60 + m + Number(movie.duration);
          showEndTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
        }
      }

      // partnerId: venue is the source of truth; fall back to the requesting user
      const partnerId =
        venue.partnerId ||
        venue.createdBy ||
        (request.requestedBy?._id || request.requestedBy);

      const show = await Show.create({
        movieId,
        venueId,
        screenId,
        screenName,
        showDate,
        showTime,
        showEndTime:    showEndTime || null,
        price,
        totalSeats,
        availableSeats: totalSeats,
        partnerId,
        createdBy:      request.requestedBy?._id || request.requestedBy,
        isActive:       true,
      });

      // Notify the partner of approval
      try {
        await Notification.create({
          title: "Show Request Approved ✅",
          message: `Your show request for "${screenName || "a movie"}" has been approved.`,
          type: "SHOW",
          receiverId: partnerId,
          meta: {
            requestId: request._id,
            showId: show._id,
            venueId: venue._id
          }
        });
      } catch (notifErr) {
        console.error("Failed to create show approval notification:", notifErr);
      }
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (request.requestType === "UPDATE") {
      const show = await Show.findById(request.showId);
      if (!show) return res.status(404).json({ message: "Show not found for update" });

      const p = request.payload || {};

      console.log("UPDATE payload:", p);

      // Update fields that are present in the payload (use !== undefined to allow 0, empty strings, etc.)
      if (p.movieId !== undefined && p.movieId !== null)     show.movieId     = p.movieId;
      if (p.venueId !== undefined && p.venueId !== null)     show.venueId     = p.venueId;
      if (p.screenId !== undefined && p.screenId !== null)   show.screenId    = p.screenId;
      if (p.showDate !== undefined && p.showDate !== null && p.showDate !== "")    show.showDate    = p.showDate;
      if (p.showTime !== undefined && p.showTime !== null && p.showTime !== "")    show.showTime    = p.showTime;
      if (p.showEndTime !== undefined && p.showEndTime !== null) show.showEndTime = p.showEndTime;
      if (p.price !== undefined && p.price !== null)       show.price       = Number(p.price);
      if (p.screenName !== undefined && p.screenName !== null)  show.screenName  = p.screenName;
      if (p.totalSeats !== undefined && p.totalSeats !== null && p.totalSeats > 0) {
        show.totalSeats = Number(p.totalSeats);
      }

      console.log("Show before save:", show);

      // Refresh seat count if the screen changed
      if (p.screenId) {
        const venueId = p.venueId || show.venueId;
        const venue   = await Venue.findById(venueId);
        const screen  = (venue?.screens || []).find(
          (s) => String(s._id) === String(p.screenId)
        );
        if (screen) {
          show.totalSeats = screen.totalSeats;
          show.screenName = screen.screenName;
        }
      }

      const updateResult = await show.save();
      console.log("Show after save:", updateResult);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (request.requestType === "DELETE") {
      await Show.findByIdAndUpdate(request.showId, { isActive: false });
    }

    request.approvalStatus = "APPROVED";
    request.reviewedBy     = req.user.id;
    request.reviewedAt     = new Date();
    request.adminNote      = req.body.adminNote || "Approved";

    await request.save();

    res.json({ message: "Request approved successfully" });
  } catch (err) {
    console.error("approveShowRequest error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ message: err.message || "Failed to approve show request" });
  }
};

/* ─────────────────────────────────────────────
   ADMIN → REJECT
   PATCH /admin/show-requests/:id/reject
───────────────────────────────────────────── */
export const rejectShowRequest = async (req, res) => {
  try {
    const request = await ShowRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: "Only PENDING requests can be rejected" });
    }

    request.approvalStatus = "REJECTED";
    request.reviewedBy     = req.user.id;
    request.reviewedAt     = new Date();
    request.adminNote      = req.body.adminNote || "Rejected";

    await request.save();

    // Notify the partner of rejection
    try {
      await Notification.create({
        title: "Show Request Rejected ❌",
        message: `Your show request has been rejected. Note: ${request.adminNote}`,
        type: "SHOW",
        receiverId: request.requestedBy?._id || request.requestedBy,
        meta: {
          requestId: request._id,
          adminNote: request.adminNote
        }
      });
    } catch (notifErr) {
      console.error("Failed to create show rejection notification:", notifErr);
    }

    res.json({ message: "Request rejected successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};