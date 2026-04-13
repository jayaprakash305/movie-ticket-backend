  import mongoose from "mongoose";

  const movieSchema = new mongoose.Schema(
    {
      title: {
        type: String,
        required: true,
        trim: true,
      },
      description: {
        type: String,
        default: "",
        trim: true,
      },
      genre: {
        type: String,
        default: "",
        trim: true,
      },
      language: {
        type: String,
        default: "",
        trim: true,
      },
      rating: {
        type: Number,
        default: 0,
      },
      censorRating: {
        type: String,
        default: "",
        trim: true,
      },
      duration: {
        type: Number,
        default: 0,
      },
      releaseDate: {
        type: String,
        default: "",
        trim: true,
      },
      year: {
        type: Number,
        default: new Date().getFullYear(),
      },
      cast: {
        type: String,
        default: "",
        trim: true,
      },
      posterUrl: {
        type: String,
        default: "",
        trim: true,
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
    { timestamps: true }
  );

  const Movie = mongoose.model("Movie", movieSchema);

  export default Movie;