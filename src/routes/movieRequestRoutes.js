import express from "express";
import {
  createPartnerMovieRequest,
  getMyMovieRequests,
  getAllMovieRequests,
  approveMovieRequest,
  rejectMovieRequest,
} from "../controllers/movieRequestController.js";
import { protectRoute, allowRoles } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Partner
router.post(
  "/partner-portal/movie-requests",
  protectRoute,
  allowRoles("MANAGER"),
  upload.single("poster"),
  createPartnerMovieRequest
);

router.get(
  "/partner-portal/movie-requests/my",
  protectRoute,
  allowRoles("MANAGER"),
  getMyMovieRequests
);

// Admin / Super Admin
router.get(
  "/super-admin/movie-requests",
  protectRoute,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  getAllMovieRequests
);

router.patch(
  "/super-admin/movie-requests/:id/approve",
  protectRoute,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  approveMovieRequest
);

router.patch(
  "/super-admin/movie-requests/:id/reject",
  protectRoute,
  allowRoles("ADMIN", "SUPER_ADMIN"),
  rejectMovieRequest
);

export default router;