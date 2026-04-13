import mongoose from "mongoose"

const venueRequestSchema = new mongoose.Schema(
  {
    requestType: {
      type: String,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "ADD_SCREEN",
        "DELETE_SCREEN",
        "UPDATE_SEAT_LAYOUT",
      ],
      required: true,
    },

    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      default: null,
    },

    screenId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
      trim: true,
      default: "",
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

const VenueRequest = mongoose.model("VenueRequest", venueRequestSchema)
export default VenueRequest