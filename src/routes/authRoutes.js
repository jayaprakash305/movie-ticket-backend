import express from "express";
import {
  register,
  partnerRegister,
  login,
  getMe,
  forgotPassword,
  resetPasswordWithOtp,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/partner/register", partnerRegister);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPasswordWithOtp);

export default router;