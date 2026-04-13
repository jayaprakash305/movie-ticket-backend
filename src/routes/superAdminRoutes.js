import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";
import uploadPoster from "../middleware/uploadMiddleware.js";

import {
  getSuperAdminDashboard,
  getAllUsersForSuperAdmin,
  deleteUser,
  toggleBanUser,
  updateUser,
  changeUserRole,
  updateUserPermissions,
  updatePermissionsForAllAdmins,
  getGlobalAdminPermissions,
  getAllMoviesPaginated,
  createAdminUser,
} from "../controllers/superAdminController.js";

import {
  getPendingPartners,
  getAllPartners,
  approvePartner,
  rejectPartner,
  createPartnerBySuperAdmin,
} from "../controllers/superAdminPartnerController.js";

import {
  getPendingAgents,
  getAllAgentsForApproval,
  approveAgent,
  rejectAgent,
  createAgentBySuperAdmin,
  getAgentStatusChangeRequests,
  approveAgentStatusChange,
  rejectAgentStatusChange,
} from "../controllers/superAdminAgentController.js";

import {
  getAllMovieRequests,
  approveMovieRequest,
  rejectMovieRequest,
} from "../controllers/movieRequestController.js";

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
} from "../controllers/superAdminVenueController.js";

import {
  getAllShowsForSuperAdmin,
  createShowBySuperAdmin,
  updateShowBySuperAdmin,
  deleteShowBySuperAdmin,
} from "../controllers/superAdminShowController.js";

import {
  getAllVenueRequests,
  approveVenueRequest,
  rejectVenueRequest,
} from "../controllers/venueRequestController.js";

import {
  getAllShowRequests,
  approveShowRequest,
  rejectShowRequest,
} from "../controllers/showRequestController.js";

import {
  getPartnerTheatreHierarchyReport,
  getPartnerBusinessOverview
} from "../controllers/superAdminReportController.js";
import { createAdminMovie } from "../controllers/movieController.js";

const router = express.Router();

router.get("/dashboard", authMiddleware, roleMiddleware("SUPER_ADMIN"), getSuperAdminDashboard);

router.get("/users", authMiddleware, roleMiddleware("SUPER_ADMIN"), getAllUsersForSuperAdmin);
router.delete("/users/:id", authMiddleware, roleMiddleware("SUPER_ADMIN"), deleteUser);
router.patch("/users/:id/ban", authMiddleware, roleMiddleware("SUPER_ADMIN"), toggleBanUser);
router.put("/users/:id", authMiddleware, roleMiddleware("SUPER_ADMIN"), updateUser);
router.patch("/users/:id/role", authMiddleware, roleMiddleware("SUPER_ADMIN"), changeUserRole);
router.patch("/users/:id/permissions", authMiddleware, roleMiddleware("SUPER_ADMIN"), updateUserPermissions);
router.patch("/admins/permissions/global", authMiddleware, roleMiddleware("SUPER_ADMIN"), updatePermissionsForAllAdmins);
router.get("/admins/permissions/global", authMiddleware, roleMiddleware("SUPER_ADMIN"), getGlobalAdminPermissions);

// movie requests
router.get("/movie-requests", authMiddleware, roleMiddleware("SUPER_ADMIN"), getAllMovieRequests);
router.patch("/movie-requests/:id/approve", authMiddleware, roleMiddleware("SUPER_ADMIN"), approveMovieRequest);
router.patch("/movie-requests/:id/reject", authMiddleware, roleMiddleware("SUPER_ADMIN"), rejectMovieRequest);

// official movie creation
router.post(
  "/movies",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  uploadPoster.single("poster"),
  createAdminMovie
);

router.get(
  "/movies",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getAllMoviesPaginated
);

// partner routes
router.post("/partners", authMiddleware, roleMiddleware("SUPER_ADMIN"), createPartnerBySuperAdmin);
router.get("/partners/pending", authMiddleware, roleMiddleware("SUPER_ADMIN"), getPendingPartners);
router.get("/partners", authMiddleware, roleMiddleware("SUPER_ADMIN"), getAllPartners);
router.patch("/partners/:id/approve", authMiddleware, roleMiddleware("SUPER_ADMIN"), approvePartner);
router.patch("/partners/:id/reject", authMiddleware, roleMiddleware("SUPER_ADMIN"), rejectPartner);

// agent routes
router.post("/agents", authMiddleware, roleMiddleware("SUPER_ADMIN"), createAgentBySuperAdmin);
router.get("/agents/pending", authMiddleware, roleMiddleware("SUPER_ADMIN"), getPendingAgents);
router.get("/agents", authMiddleware, roleMiddleware("SUPER_ADMIN"), getAllAgentsForApproval);
router.patch("/agents/:id/approve", authMiddleware, roleMiddleware("SUPER_ADMIN"), approveAgent);
router.patch("/agents/:id/reject", authMiddleware, roleMiddleware("SUPER_ADMIN"), rejectAgent);

router.get("/agents/status-requests", authMiddleware, roleMiddleware("SUPER_ADMIN"), getAgentStatusChangeRequests);
router.patch("/agents/:id/status-approve", authMiddleware, roleMiddleware("SUPER_ADMIN"), approveAgentStatusChange);
router.patch("/agents/:id/status-reject", authMiddleware, roleMiddleware("SUPER_ADMIN"), rejectAgentStatusChange);

// venue management
router.get("/venues", authMiddleware, roleMiddleware("SUPER_ADMIN"), getAllVenuesForSuperAdmin);
router.get("/venues/:venueId", authMiddleware, roleMiddleware("SUPER_ADMIN"), getVenueByIdForSuperAdmin);
router.post("/venues", authMiddleware, roleMiddleware("SUPER_ADMIN"), createVenueBySuperAdmin);
router.put("/venues/:venueId", authMiddleware, roleMiddleware("SUPER_ADMIN"), updateVenueBySuperAdmin);
router.delete("/venues/:venueId", authMiddleware, roleMiddleware("SUPER_ADMIN"), deleteVenueBySuperAdmin);
router.post("/venues/:venueId/screens", authMiddleware, roleMiddleware("SUPER_ADMIN"), addVenueScreenBySuperAdmin);
router.delete("/venues/:venueId/screens/:screenId", authMiddleware, roleMiddleware("SUPER_ADMIN"), deleteVenueScreenBySuperAdmin);
router.get("/venues/:venueId/screens/:screenId/seats", authMiddleware, roleMiddleware("SUPER_ADMIN"), getScreenSeatLayoutBySuperAdmin);
router.patch("/venues/:venueId/screens/:screenId/seats", authMiddleware, roleMiddleware("SUPER_ADMIN"), updateScreenSeatLayoutBySuperAdmin);

// show management
router.get("/shows", authMiddleware, roleMiddleware("SUPER_ADMIN"), getAllShowsForSuperAdmin);
router.post("/shows", authMiddleware, roleMiddleware("SUPER_ADMIN"), createShowBySuperAdmin);
router.put("/shows/:showId", authMiddleware, roleMiddleware("SUPER_ADMIN"), updateShowBySuperAdmin);
router.delete("/shows/:showId", authMiddleware, roleMiddleware("SUPER_ADMIN"), deleteShowBySuperAdmin);

router.get("/show-requests", authMiddleware, roleMiddleware("SUPER_ADMIN"), getAllShowRequests);
router.patch("/show-requests/:id/approve", authMiddleware, roleMiddleware("SUPER_ADMIN"), approveShowRequest);
router.patch("/show-requests/:id/reject", authMiddleware, roleMiddleware("SUPER_ADMIN"), rejectShowRequest);

// reports
router.get("/partner-theatre-report", authMiddleware, roleMiddleware("SUPER_ADMIN"), getPartnerTheatreHierarchyReport);
router.get("/approved-partners", authMiddleware, roleMiddleware("SUPER_ADMIN"), getApprovedPartnersForSuperAdmin);

router.get("/venue-requests", authMiddleware, roleMiddleware("SUPER_ADMIN"), getAllVenueRequests);
router.patch("/venue-requests/:requestId/approve", authMiddleware, roleMiddleware("SUPER_ADMIN"), approveVenueRequest);
router.patch("/venue-requests/:requestId/reject", authMiddleware, roleMiddleware("SUPER_ADMIN"), rejectVenueRequest);
router.get("/dashboard/partner-overview", authMiddleware, roleMiddleware("SUPER_ADMIN"), getPartnerBusinessOverview);

router.post("/admins", authMiddleware, roleMiddleware("SUPER_ADMIN"), createAdminUser);

export default router;