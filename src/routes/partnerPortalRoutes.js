import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";
import uploadPoster from "../middleware/uploadMiddleware.js";

import { getPartnerMovies } from "../controllers/movieController.js";

import {
  createPartnerMovieRequest,
  getMyMovieRequests,
} from "../controllers/movieRequestController.js";

// ── Keep partner venue READ handlers only ────────────────────────────────────
import {
  getPartnerVenues,
  getScreenSeatLayout,
} from "../controllers/partnerVenueController.js";

import {
  createVenueCreateRequest,
  createVenueUpdateRequest,
  createVenueDeleteRequest,
  createAddScreenRequest,
  createDeleteScreenRequest,
  createSeatLayoutUpdateRequest,
  getMyVenueRequests,
} from "../controllers/venueRequestController.js";

import {
  getPartnerShows,
  createPartnerShow,
  updatePartnerShow,
  deletePartnerShow,
} from "../controllers/showController.js";

import {
  createShowCreateRequest,
  createShowUpdateRequest,
  createShowDeleteRequest,
  getMyShowRequests,
} from "../controllers/showRequestController.js";


import { getPartnerBookings } from "../controllers/partnerBookingController.js";
import { getPartnerAnalytics } from "../controllers/partnerAnalyticsController.js";
import { getPartnerDashboard } from "../controllers/Dashboardcontroller .js";

const router = express.Router();

// only authentication globally
router.use(authMiddleware);

// movies
router.get("/movies", roleMiddleware("MANAGER"), getPartnerMovies);

// movie requests
router.post(
  "/movie-requests",
  roleMiddleware("MANAGER"),
  uploadPoster.single("poster"),
  createPartnerMovieRequest
);
router.get("/movie-requests", roleMiddleware("MANAGER"), getMyMovieRequests);

// ── venues (READ ONLY for partner) ───────────────────────────────────────────
router.get("/venues", roleMiddleware("MANAGER"), getPartnerVenues);
router.get(
  "/venues/:venueId/screens/:screenId/seats",
  roleMiddleware("MANAGER"),
  getScreenSeatLayout
);

// ── venue requests (partner submits, admin/super admin approves) ────────────
router.get("/venue-requests", roleMiddleware("MANAGER"), getMyVenueRequests);

router.post(
  "/venue-requests/create",
  roleMiddleware("MANAGER"),
  createVenueCreateRequest
);

router.post(
  "/venue-requests/update/:venueId",
  roleMiddleware("MANAGER"),
  createVenueUpdateRequest
);

router.post(
  "/venue-requests/delete/:venueId",
  roleMiddleware("MANAGER"),
  createVenueDeleteRequest
);

router.post(
  "/venue-requests/add-screen/:venueId",
  roleMiddleware("MANAGER"),
  createAddScreenRequest
);

router.post(
  "/venue-requests/delete-screen/:venueId/:screenId",
  roleMiddleware("MANAGER"),
  createDeleteScreenRequest
);

router.post(
  "/venue-requests/update-seat-layout/:venueId/:screenId",
  roleMiddleware("MANAGER"),
  createSeatLayoutUpdateRequest
);

// shows
router.get("/shows", roleMiddleware("MANAGER", "AGENT"), getPartnerShows);
router.post(
  "/show-requests/create",
  roleMiddleware("MANAGER"),
  createShowCreateRequest
);

router.post(
  "/show-requests/update/:showId",
  roleMiddleware("MANAGER"),
  createShowUpdateRequest
);

router.post(
  "/show-requests/delete/:showId",
  roleMiddleware("MANAGER"),
  createShowDeleteRequest
);

router.get(
  "/show-requests",
  roleMiddleware("MANAGER"),
  getMyShowRequests
);


// other
router.get("/bookings", roleMiddleware("MANAGER"), getPartnerBookings);
router.get("/analytics", roleMiddleware("MANAGER"), getPartnerAnalytics);
router.get("/dashboard", roleMiddleware("MANAGER"), getPartnerDashboard);

export default router;