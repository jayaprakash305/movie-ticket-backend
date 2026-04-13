import Venue from "../models/Venue.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";

export const getSeatStateByShow = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { showId }  = req.query;

    if (!showId) {
      return res.status(400).json({ message: "showId is required" });
    }

    const venue = await Venue.findOne({ _id: venueId, isActive: true });
    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // ── Fetch the show to get its screenId ────────────────────────────────────
    const show = await Show.findById(showId);

    // ── Resolve the correct seatLayout ───────────────────────────────────────
    // Priority 1: screen matching the show's screenId  (partner-edited layout)
    // Priority 2: first screen in venue
    // Priority 3: legacy flat seatLayout (backward compat)
    let rawLayout = []

    if (show?.screenId) {
      const screen = venue.screens.find(s => String(s._id) === String(show.screenId))
      if (screen?.seatLayout?.length > 0) {
        rawLayout = screen.seatLayout
      }
    }

    if (rawLayout.length === 0 && venue.screens?.length > 0) {
      rawLayout = venue.screens[0].seatLayout || []
    }

    if (rawLayout.length === 0) {
      rawLayout = venue.seatLayout || []
    }

    // ── Filter out seats the partner removed (isActive === false) ─────────────
    const activeSeatLayout = rawLayout.filter(seat => seat.isActive !== false)

    // ── Clean up expired locks ────────────────────────────────────────────────
   const now = new Date()

const expiredLocks = await Booking.find({
  showId,
  status: "LOCKED",
  lockExpiresAt: { $lte: now },
}).select("seats showId")

if (expiredLocks.length > 0) {
  await Booking.deleteMany({
    _id: { $in: expiredLocks.map((b) => b._id) },
  })

  const unlockedSeats = expiredLocks.flatMap((b) => b.seats || [])

  io.to(`show:${showId}`).emit("seat-unlocked", {
    showId: String(showId),
    seats: unlockedSeats,
  })
}

    // ── Fetch active bookings for this show ───────────────────────────────────
    const activeBookings = await Booking.find({
      showId,
      status: { $in: ["LOCKED", "CONFIRMED"] },
      $or: [
        { status: "CONFIRMED" },
        { status: "LOCKED", lockExpiresAt: { $gt: now } },
      ],
    })

    const bookedSeats    = new Set()
    const lockedSeatsMap = new Map()

    activeBookings.forEach((booking) => {
      if (booking.status === "CONFIRMED") {
        booking.seats.forEach((seatId) => bookedSeats.add(seatId))
      } else if (booking.status === "LOCKED") {
        booking.seats.forEach((seatId) => {
          lockedSeatsMap.set(seatId, String(booking.userId))
        })
      }
    })

    // ── Build seat state — only active seats reach the user ───────────────────
    const seatState = activeSeatLayout.map((seat) => ({
      seatId:     seat.seatId,
      seatNumber: seat.seatNumber,
      rowLabel:   seat.rowLabel,
      booked:     bookedSeats.has(seat.seatId),
      locked:     !bookedSeats.has(seat.seatId) && lockedSeatsMap.has(seat.seatId),
      lockedBy:   lockedSeatsMap.get(seat.seatId) || null,
    }))

    res.json(seatState)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}