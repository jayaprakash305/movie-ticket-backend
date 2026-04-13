import express from "express"
import authMiddleware from "../middleware/authMiddleware.js"
import roleMiddleware from "../middleware/roleMiddleware.js"
import permissionMiddleware from "../middleware/permissionMiddleware.js"
import uploadPoster from "../middleware/uploadMiddleware.js"

import {
  getSuperAdminDashboard,
  getAllMoviesPaginated,
} from "../controllers/superAdminController.js"

import {
  getAllMovieRequests,
  approveMovieRequest,
  rejectMovieRequest,
} from "../controllers/movieRequestController.js"

import {
  getAllVenueRequests,
  approveVenueRequest,
  rejectVenueRequest,
} from "../controllers/venueRequestController.js"

import {
  getAllVenuesForSuperAdmin,
  getVenueByIdForSuperAdmin,
  createVenueBySuperAdmin,
  updateVenueBySuperAdmin,
  deleteVenueBySuperAdmin,
  addVenueScreenBySuperAdmin,
  deleteVenueScreenBySuperAdmin,
  getScreenSeatLayoutBySuperAdmin,
  updateScreenSeatLayoutBySuperAdmin,
  getApprovedPartnersForSuperAdmin,
} from "../controllers/superAdminVenueController.js"

import {
  getAllShowsForSuperAdmin,
  createShowBySuperAdmin,
  updateShowBySuperAdmin,
  deleteShowBySuperAdmin,
} from "../controllers/superAdminShowController.js"

import {
  getAllShowRequests,
  approveShowRequest,
  rejectShowRequest,
} from "../controllers/showRequestController.js"
import {
  createPartnerBySuperAdmin,
    getPendingPartners,
  getAllPartners,
  approvePartner,
  rejectPartner,
} from "../controllers/superAdminPartnerController.js"

import {
  createAgentBySuperAdmin,
  getPendingAgents,
  getAllAgentsForApproval,
  approveAgent,
  rejectAgent,
  getAgentStatusChangeRequests,
  approveAgentStatusChange,
  rejectAgentStatusChange,
} from "../controllers/superAdminAgentController.js"

import { getPartnerTheatreHierarchyReport ,
  getPartnerBusinessOverview
} from "../controllers/superAdminReportController.js"
import { createAdminMovie } from "../controllers/movieController.js"

const router = express.Router()

// ── Dashboard ─────────────────────────────────────────
router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getSuperAdminDashboard
)

// ── Movie Requests ────────────────────────────────────
router.get(
  "/movie-requests",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getAllMovieRequests
)

router.patch(
  "/movie-requests/:id/approve",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("approveMovieRequest"),
  approveMovieRequest
)

router.patch(
  "/movie-requests/:id/reject",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("approveMovieRequest"),
  rejectMovieRequest
)

// ── Movies ────────────────────────────────────────────
router.get(
  "/movies",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getAllMoviesPaginated
)

router.post(
  "/movies",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("addMovie"),
  uploadPoster.single("poster"),
  createAdminMovie
)

// ── Theatre / Venue Management ───────────────────────
router.get(
  "/venues",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getAllVenuesForSuperAdmin
)

router.get(
  "/venues/:venueId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getVenueByIdForSuperAdmin
)

router.post(
  "/venues",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("addTheater"),
  createVenueBySuperAdmin
)

router.put(
  "/venues/:venueId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("editTheater"),
  updateVenueBySuperAdmin
)

router.delete(
  "/venues/:venueId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("deleteTheater"),
  deleteVenueBySuperAdmin
)

// ── Screen Management ─────────────────────────────────
router.post(
  "/venues/:venueId/screens",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("addScreen"),
  addVenueScreenBySuperAdmin
)

router.delete(
  "/venues/:venueId/screens/:screenId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("deleteScreen"),
  deleteVenueScreenBySuperAdmin
)

// ── Seat Layout ───────────────────────────────────────
router.get(
  "/venues/:venueId/screens/:screenId/seats",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getScreenSeatLayoutBySuperAdmin
)

router.patch(
  "/venues/:venueId/screens/:screenId/seats",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("editTheater"),
  updateScreenSeatLayoutBySuperAdmin
)

// ── Approved Partners for theatre assignment ──────────
router.get(
  "/approved-partners",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getApprovedPartnersForSuperAdmin
)

// ── Partner theatre report ────────────────────────────
router.get(
  "/partner-theatre-report",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getPartnerTheatreHierarchyReport
)

// ── Venue Requests ────────────────────────────────────
router.get(
  "/venue-requests",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getAllVenueRequests
)

router.patch(
  "/venue-requests/:requestId/approve",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("approveVenueRequest"),
  approveVenueRequest
)

router.patch(
  "/venue-requests/:requestId/reject",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("approveVenueRequest"),
  rejectVenueRequest
)


  // partner routes
  router.post("/partners", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), permissionMiddleware("createPartner"), createPartnerBySuperAdmin);
  router.get("/partners/pending", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), getPendingPartners);
  router.get("/partners", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), getAllPartners);
  router.patch("/partners/:id/approve", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), permissionMiddleware("approvePartner"), approvePartner);
  router.patch("/partners/:id/reject", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), permissionMiddleware("rejectPartner"), rejectPartner);
  

// agent routes
router.post("/agents", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), permissionMiddleware("createAgent"), createAgentBySuperAdmin);
router.get("/agents/pending", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), getPendingAgents);
router.get("/agents", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), getAllAgentsForApproval);
router.patch("/agents/:id/approve", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), permissionMiddleware("approveAgent"), approveAgent);
router.patch("/agents/:id/reject", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), permissionMiddleware("rejectAgent"), rejectAgent);

router.get("/agents/status-requests", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), getAgentStatusChangeRequests);
router.patch("/agents/:id/status-approve", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), permissionMiddleware("approveStatusRequest"), approveAgentStatusChange);
router.patch("/agents/:id/status-reject", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), permissionMiddleware("approveStatusRequest"), rejectAgentStatusChange);


// ── Shows ─────────────────────────────────────────────
router.get(
  "/shows",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getAllShowsForSuperAdmin
)

router.post(
  "/shows",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("addShow"),
  createShowBySuperAdmin
)

router.put(
  "/shows/:showId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("editShow"),
  updateShowBySuperAdmin
)

router.delete(
  "/shows/:showId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("deleteShow"),
  deleteShowBySuperAdmin
)

// ── Show Requests ─────────────────────────────────────
router.get(
  "/show-requests",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getAllShowRequests
)

router.patch(
  "/show-requests/:id/approve",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("approveShowRequest"),
  approveShowRequest
)

router.patch(
  "/show-requests/:id/reject",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  permissionMiddleware("approveShowRequest"),
  rejectShowRequest
)
router.get("/dashboard/partner-overview", authMiddleware, roleMiddleware("ADMIN", "SUPER_ADMIN"), getPartnerBusinessOverview);
export default router