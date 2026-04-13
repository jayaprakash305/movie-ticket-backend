import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  initiatePayment,
  confirmPayment,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/initiate/:bookingId", authMiddleware, initiatePayment);
router.post("/confirm/:paymentId", authMiddleware, confirmPayment);

export default router;