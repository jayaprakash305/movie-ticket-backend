import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import Show from "../models/Show.js";
import Movie from "../models/Movie.js";
import Venue from "../models/Venue.js";
import Notification from "../models/Notification.js";
import { sendEmail } from "../services/emailService.js";
import { bookingConfirmationTemplate } from "../templates/bookingConfirmationTemplate.js";

export const initiatePayment = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOne({
      bookingCode: bookingId,
      userId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "LOCKED") {
      return res.status(400).json({ message: "Only locked bookings can be paid" });
    }

    if (!booking.lockExpiresAt || new Date(booking.lockExpiresAt) <= new Date()) {
      return res.status(400).json({ message: "Seat lock expired. Please select seats again." });
    }

    const show = await Show.findById(booking.showId);
    if (!show) {
      return res.status(404).json({ message: "Show not found" });
    }

    const movie = await Movie.findById(show.movieId);
    const venue = await Venue.findById(show.venueId);

    let payment = await Payment.findOne({
      bookingId: booking._id,
      userId: req.user.id,
      status: "PENDING",
    });

    if (!payment) {
      payment = await Payment.create({
        bookingId: booking._id,
        userId: req.user.id,
        amount: booking.totalAmount,
        status: "PENDING",
        provider: "MANUAL",
      });
    }

    const seatObjects = booking.seats.map((seatId) => ({
      seatId,
      seatNumber: seatId,
    }));

    res.json({
      id: payment._id,
      amount: payment.amount,
      status: payment.status,
      booking: {
        id: booking.bookingCode,
        status: booking.status,
        seats: seatObjects,
        show: {
          id: show._id,
          showDate: show.showDate,
          showTime: show.showTime,
          movie: movie
            ? {
                id: movie._id,
                title: movie.title,
                posterUrl: movie.posterUrl,
              }
            : null,
          venue: venue
            ? {
                id: venue._id,
                name: venue.name,
                city: venue.city,
                area: venue.area,
                address: venue.address,
              }
            : null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({
      _id: paymentId,
      userId: req.user.id,
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status === "PAID") {
      return res.json({ message: "Payment already confirmed" });
    }

    const booking = await Booking.findOne({
      _id: payment.bookingId,
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

    if (booking.status !== "LOCKED") {
      return res.status(400).json({ message: "Booking is not in locked state" });
    }

    if (!booking.lockExpiresAt || new Date(booking.lockExpiresAt) <= new Date()) {
      return res.status(400).json({ message: "Seat lock expired. Please select seats again." });
    }

    const show = await Show.findById(booking.showId);
    if (!show) {
      return res.status(404).json({ message: "Show not found" });
    }

    if (show.availableSeats < booking.seats.length) {
      return res.status(409).json({ message: "Not enough seats available" });
    }

    payment.status = "PAID";
    payment.transactionId = `TXN-${Date.now()}`;
    await payment.save();

    booking.status = "CONFIRMED";
    booking.paymentStatus = "PAID";
    booking.lockExpiresAt = null;
    await booking.save();

    show.availableSeats = Math.max(0, show.availableSeats - booking.seats.length);
    await show.save();

    try {
      await sendEmail({
        to: booking.userId.email,
        subject: "Your ticket is confirmed 🎟️",
        html: bookingConfirmationTemplate({
          customerName: booking.userId.name,
          bookingCode: booking.bookingCode,
          movieTitle: booking.showId?.movieId?.title || "Movie",
          theatreName: booking.venueId?.name || "Theatre",
          showDate: booking.showId?.showDate || "-",
          showTime: booking.showId?.showTime || "-",
          seats: booking.seats || [],
          totalAmount: booking.totalAmount || 0,
        }),
      });
    } catch (mailError) {
      console.error("Confirmation email failed:", mailError.message);
    }

    try {
      await Notification.create({
        title: "Ticket Confirmed! 🎟️",
        message: `Your booking (Code: ${booking.bookingCode}) for ${booking.showId?.movieId?.title || "Movie"} has been confirmed. Enjoy the show!`,
        type: "BOOKING",
        receiverId: req.user.id,
      });
    } catch (notifErr) {
      console.error("Confirmation notification failed:", notifErr.message);
    }


    res.json({
      message: "Payment confirmed successfully",
      paymentId: payment._id,
      bookingId: booking._id,
      status: payment.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};