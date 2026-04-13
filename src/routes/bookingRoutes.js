import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  lockSeats,
  getMyBookings,
  cancelBooking,
} from "../controllers/bookingController.js";

const router = express.Router();

router.post("/lock/:showId", authMiddleware, lockSeats);
router.get("/my", authMiddleware, getMyBookings);
router.delete("/:bookingId/cancel", authMiddleware, cancelBooking);

export default router;