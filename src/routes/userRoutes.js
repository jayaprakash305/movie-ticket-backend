import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getAllMovies,
  getMovieById,
  getMoviesByGenre,
} from "../controllers/movieController.js";
import { getShowsByMovie } from "../controllers/showController.js";
import { getSeatStateByShow } from "../controllers/seatController.js";
const router = express.Router();

router.get("/movies", authMiddleware, getAllMovies);
router.get("/movies/genre/:genre", authMiddleware, getMoviesByGenre);
router.get("/movies/:id", authMiddleware, getMovieById);
router.get("/shows", authMiddleware, getShowsByMovie);
router.get("/seats/venue/:venueId/state", authMiddleware, getSeatStateByShow);

export default router;