import mongoose from "mongoose";

const showRequestSchema = new mongoose.Schema(
  {
    requestType: {
      type: String,
      enum: ["CREATE", "UPDATE", "DELETE"],
      required: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },

    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Show",
      default: null,
    },

    payload: {
      type: Object,
      default: {},
    },

    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    adminNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("ShowRequest", showRequestSchema);