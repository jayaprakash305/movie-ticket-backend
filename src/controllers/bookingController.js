  import Show from "../models/Show.js";
  import Venue from "../models/Venue.js";
  import Booking from "../models/Booking.js";
  import Movie from "../models/Movie.js";
  import User from "../models/User.js"
  import {io} from "../server.js"
  import Notification from "../models/Notification.js";
  import { sendEmail } from "../services/emailService.js";
  import { bookingCancellationTemplate } from "../templates/bookingCancellationTemplate.js";

 export const lockSeats = async (req, res) => {
  try {
    const { showId } = req.params;
    const seatIds = req.body;

    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ message: "Seat ids are required" });
    }

    const normalizedSeatIds = seatIds.map((id) => String(id).trim());

    const show = await Show.findOne({
      _id: showId,
      isActive: true,
    });

    if (!show) {
      return res.status(404).json({ message: "Show not found" });
    }

    const venue = await Venue.findOne({
      _id: show.venueId,
      isActive: true,
    });

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    let sourceSeatLayout = [];

    // If your venue has screens with separate seat layouts
    if (show.screenId && Array.isArray(venue.screens) && venue.screens.length > 0) {
      const screen = venue.screens.find(
        (s) => String(s._id) === String(show.screenId)
      );

      if (!screen) {
        return res.status(404).json({ message: "Screen not found for this show" });
      }

      sourceSeatLayout = screen.seatLayout || [];
    } else {
      // fallback for single-screen venue structure
      sourceSeatLayout = venue.seatLayout || [];
    }

    const validSeatIds = new Set(
      sourceSeatLayout.map((seat) => String(seat.seatId).trim())
    );

    const invalidSeat = normalizedSeatIds.find((id) => !validSeatIds.has(id));

    if (invalidSeat) {
      return res.status(400).json({ message: `Invalid seat selected: ${invalidSeat}` });
    }

    const now = new Date();

    await Booking.deleteMany({
      status: "LOCKED",
      lockExpiresAt: { $lte: now },
    });

    const activeBookings = await Booking.find({
      showId: show._id,
      status: { $in: ["LOCKED", "CONFIRMED"] },
      $or: [
        { status: "CONFIRMED" },
        { status: "LOCKED", lockExpiresAt: { $gt: now } },
      ],
    });

    const unavailableSeats = new Set();
    activeBookings.forEach((booking) => {
      (booking.seats || []).forEach((seat) =>
        unavailableSeats.add(String(seat).trim())
      );
    });

    const conflictSeat = normalizedSeatIds.find((seatId) =>
      unavailableSeats.has(seatId)
    );

    if (conflictSeat) {
      return res.status(409).json({
        message: `Seat ${conflictSeat} is already booked or locked`,
      });
    }

    const totalAmount = Number(show.price) * normalizedSeatIds.length;
    const lockExpiresAt = new Date(Date.now() + 3 * 60 * 1000);

  const user = await User.findById(req.user.id).select("name phone");

const booking = await Booking.create({
  userId: req.user.id,
  showId: show._id,
  venueId: venue._id,
  seats: normalizedSeatIds,
  totalAmount,
  status: "LOCKED",
  paymentStatus: "PENDING",
  source: "ONLINE",
  customerName: user?.name || "",
  customerPhone: user?.phone || "",
  lockExpiresAt,
});


  io.to(`show:${show._id}`).emit("seat-locked", {
  showId: String(show._id),
  seats: normalizedSeatIds,
  lockedBy: String(req.user.id),
  lockExpiresAt,
});
    return res.status(201).json({
      id: booking.bookingCode,
      mongoId: String(booking._id),
      seats: booking.seats,
      totalAmount: booking.totalAmount,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      lockExpiresAt: booking.lockExpiresAt,
      
    });
  } catch (error) {
    console.error("lockSeats error:", error);
    return res.status(500).json({ message: error.message });
  }
};
  export const getMyBookings = async (req, res) => {
    try {
      const bookings = await Booking.find({
        userId: req.user.id,
      }).sort({ createdAt: -1 });

      const showIds = [...new Set(bookings.map((b) => String(b.showId)))];
      const venueIds = [...new Set(bookings.map((b) => String(b.venueId)))];

      const shows = await Show.find({ _id: { $in: showIds } });
      const venues = await Venue.find({ _id: { $in: venueIds } });

      const movieIds = [...new Set(shows.map((s) => String(s.movieId)))];
      const movies = await Movie.find({ _id: { $in: movieIds } });

      const showMap = new Map(shows.map((s) => [String(s._id), s]));
      const venueMap = new Map(venues.map((v) => [String(v._id), v]));
      const movieMap = new Map(movies.map((m) => [String(m._id), m]));

      const result = bookings.map((booking) => {
        const show = showMap.get(String(booking.showId));
        const venue = venueMap.get(String(booking.venueId));
        const movie = show ? movieMap.get(String(show.movieId)) : null;

        return {
          id: booking.bookingCode,
          mongoId: String(booking._id),
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          lockedAt: booking.createdAt,
          source : booking.source || "ONLINE",

          movieTitle: movie?.title || "Unknown Movie",
          moviePosterUrl: movie?.posterUrl || "",
          venueName: venue?.name || "Unknown Venue",
          venueCity: venue?.city || "",
          showDate: show?.showDate || "",
          showTime: show?.showTime || "",
          showPrice: show?.price || 0,

          seats: (booking.seats || []).map((seatId) => ({
            id: seatId,
            seatId,
            seatNumber: seatId,
          })),
        };
      });

      res.json(result);
    } catch (error) {
      console.error("getMyBookings error:", error);
      res.status(500).json({ message: error.message });
    }
  };

  export const cancelBooking = async (req, res) => {
    try {
      const { bookingId } = req.params;

      const booking = await Booking.findOne({
        bookingCode: bookingId,
        userId: req.user.id,
      })
      .populate("userId", "name email")
      .populate("venueId", "name")
      .populate({
        path: "showId",
        populate: { path: "movieId", select: "title" }
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.status === "CANCELLED") {
        return res.status(400).json({ message: "Booking already cancelled" });
      }

      // ── 15-minute cancellation window ─────────────────────────────────────────
      const CANCEL_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
      const bookingAge = Date.now() - new Date(booking.createdAt).getTime()

      if (bookingAge > CANCEL_WINDOW_MS) {
        const bookedAt  = new Date(booking.createdAt)
        const expiresAt = new Date(bookedAt.getTime() + CANCEL_WINDOW_MS)

        // Format dates for readable message
        const fmt = (date) =>
          date.toLocaleString("en-IN", {
            day:    "2-digit",
            month:  "short",
            year:   "numeric",
            hour:   "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Kolkata",
          })

        return res.status(400).json({
          message:  `Booking can be done withing 15 minutes of booking ,This booking was placed at ${fmt(bookedAt)}.`,
          canCancel: false,
          bookedAt:  bookedAt,
          expiresAt: expiresAt,
        })
      }

      booking.status        = "CANCELLED"
      booking.paymentStatus = booking.paymentStatus === "PAID" ? "PAID" : "FAILED"
      booking.lockExpiresAt = null

      await booking.save()

      try {
      await sendEmail({
        to: booking.userId.email,
        subject: "Your ticket has been cancelled ❌",
        html: bookingCancellationTemplate({
          customerName: booking.userId.name,
          bookingCode: booking.bookingCode,
          movieTitle: booking.showId?.movieId?.title || "Movie",
          theatreName: booking.venueId?.name || "Theatre",
          showDate: booking.showId?.showDate || "-",
          showTime: booking.showId?.showTime || "-",
          seats: booking.seats || [],
        }),
      });
    } catch (mailError) {
      console.error("Cancellation email failed:", mailError.message);
    }

    try {
      await Notification.create({
        title: "Ticket Cancelled ❌",
        message: `Your booking (Code: ${booking.bookingCode}) for ${booking.showId?.movieId?.title || "Movie"} has been cancelled.`,
        type: "BOOKING",
        receiverId: req.user.id,
      });
    } catch (notifErr) {
      console.error("Cancellation notification failed:", notifErr.message);
    }

      io.to(`show:${booking.showId}`).emit("seat-unlocked", {
  showId: String(booking.showId),
  seats: booking.seats || [],
})

      res.json({
        id:            String(booking._id),
        status:        booking.status,
        paymentStatus: booking.paymentStatus,
        message:       "Booking cancelled successfully",
      })
    } catch (error) {
      console.error("cancelBooking error:", error)
      res.status(500).json({ message: error.message })
    }
  }