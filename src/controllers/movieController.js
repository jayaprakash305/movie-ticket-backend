import Movie from "../models/Movie.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

export const getAllMovies = async (req, res) => {
  try {
    const movies = await Movie.find({ isActive: true }).sort({ createdAt: -1 });

    res.json(
      movies.map((movie) => ({
  id: movie._id,
  title: movie.title,
  description: movie.description,
  genre: movie.genre,
  language: movie.language,
  rating: movie.rating,
  censorRating: movie.censorRating,
  duration: movie.duration,
  releaseDate: movie.releaseDate,
  year: movie.year,
  cast: movie.cast,
  posterUrl: movie.posterUrl,
}))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMovieById = async (req, res) => {
  try {
    const movie = await Movie.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json({
  id: movie._id,
  title: movie.title,
  description: movie.description,
  genre: movie.genre,
  language: movie.language,
  rating: movie.rating,
  censorRating: movie.censorRating,
  duration: movie.duration,
  releaseDate: movie.releaseDate,
  year: movie.year,
  cast: movie.cast,
  posterUrl: movie.posterUrl,
});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMoviesByGenre = async (req, res) => {
  try {
    const genre = req.params.genre;

    const movies = await Movie.find({
      isActive: true,
      genre: { $regex: genre, $options: "i" },
    }).sort({ createdAt: -1 });

    res.json(
      movies.map((movie) => ({
        id: movie._id,
        title: movie.title,
        description: movie.description,
        genre: movie.genre,
        language: movie.language,
        rating: movie.rating,
        censorRating: movie.censorRating,
        duration: movie.duration,
        releaseDate: movie.releaseDate,
        year: movie.year,
        cast: movie.cast,
        posterUrl: movie.posterUrl,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createAdminMovie = async (req, res) => {
  try {
    const {
      title,
      description,
      genre,
      language,
      rating,
      censorRating,
      duration,
      releaseDate,
      year,
      cast,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const posterUrl = req.file ? `/uploads/posters/${req.file.filename}` : "";

    const movie = await Movie.create({
      title,
      description,
      genre,
      language,
      rating: rating ? Number(rating) : 0,
      censorRating,
      duration: duration ? Number(duration) : 0,
      releaseDate,
      year: year ? Number(year) : new Date().getFullYear(),
      cast,
      posterUrl,
      createdBy: req.user.id,
      isActive: true,
    });

    res.status(201).json({
      message: "Movie created successfully",
      movie: {
        id: movie._id,
        title: movie.title,
        description: movie.description,
        genre: movie.genre,
        language: movie.language,
        rating: movie.rating,
        censorRating: movie.censorRating,
        duration: movie.duration,
        releaseDate: movie.releaseDate,
        year: movie.year,
        cast: movie.cast,
        posterUrl: movie.posterUrl,
      },
    });

    const partners = await User.find({
      role: "MANAGER",
      approvalStatus: "APPROVED",
      isActive: true,
      isBanned: false,
    }).select("_id");

    if (partners.length > 0) {
      await Notification.create(
        partners.map((partner) => ({
          title: "New Movie Added 🍿",
          message: `A new movie "${movie.title}" has been added to the platform`,
          type: "MOVIE",
          receiverId: partner._id,
          meta: {
            movieId: movie._id,
            addedBy: req.user.id,
          },
        }))
      );
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getPartnerMovies = async (req, res) => {
  try {
    const movies = await Movie.find({
      createdBy: req.user.id,
    }).sort({ createdAt: -1 });

    res.json(
      movies.map((movie) => ({
        id: movie._id,
        title: movie.title,
        description: movie.description,
        genre: movie.genre,
        language: movie.language,
        rating: movie.rating,
        duration: movie.duration,
        year: movie.year,
        posterUrl: movie.posterUrl,
        isActive: movie.isActive,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};