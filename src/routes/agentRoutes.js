import express from "express"
import authMiddleware from "../middleware/authMiddleware.js"
import roleMiddleware from "../middleware/roleMiddleware.js"

import { getSeatStateByShow } from "../controllers/seatController.js"

import {
  createAgent,
  getPartnerAgents,
  updateAgent,
  requestAgentStatusChange,
  createOfflineBooking,
  getAgentDashboard,
  getMyAgentBookings,
  getAgentVenues,
  getAgentShows,
} from "../controllers/agentController.js"

const router = express.Router()

// ─────────────────────────────────────────────────────
// Agent Management (Only Manager/Admin)
// ─────────────────────────────────────────────────────

router.post(
  "/",
  authMiddleware,
  roleMiddleware("MANAGER", "ADMIN", "SUPER_ADMIN"),
  createAgent
)

router.get(
  "/",
  authMiddleware,
  roleMiddleware("MANAGER", "ADMIN", "SUPER_ADMIN"),
  getPartnerAgents
)

router.patch(
  "/:id",
  authMiddleware,
  roleMiddleware("MANAGER", "ADMIN", "SUPER_ADMIN"),
  updateAgent
)

router.patch(
  "/:id/status-request",
  authMiddleware,
  roleMiddleware("MANAGER"),
  requestAgentStatusChange
)

// ─────────────────────────────────────────────────────
// Booking (Agent + Manager)
// ─────────────────────────────────────────────────────

router.post(
  "/offline-booking",
  authMiddleware,
  roleMiddleware("MANAGER", "AGENT", "ADMIN", "SUPER_ADMIN"),
  createOfflineBooking
)

// ─────────────────────────────────────────────────────
// Seat State (Shared)
// ─────────────────────────────────────────────────────

router.get(
  "/seats/venue/:venueId/state",
  authMiddleware,
  getSeatStateByShow
)

// ─────────────────────────────────────────────────────
// Agent Dashboard (Only Agent)
// ─────────────────────────────────────────────────────

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("AGENT"),
  getAgentDashboard
)

router.get(
  "/bookings",
  authMiddleware,
  roleMiddleware("AGENT"),
  getMyAgentBookings
)

router.get(
  "/venues",
  authMiddleware,
  roleMiddleware("AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN"),
  getAgentVenues
)

router.get(
  "/shows",
  authMiddleware,
  roleMiddleware("AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN"),
  getAgentShows
)

export default router

