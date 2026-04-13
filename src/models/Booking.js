import mongoose from "mongoose";
import crypto from "crypto";

const generateBookingCode = () => {
  return "BK-" + crypto.randomBytes(4).toString("hex").toUpperCase();
};

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      unique: true,
      default: generateBookingCode,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Show",
      required: true,
    },

    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },

    seats: {
      type: [String],
      default: [],
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

   status: {
  type: String,
  enum: ["PENDING", "LOCKED", "CONFIRMED", "CANCELLED"],
  default: "PENDING",
},

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },

    lockExpiresAt: {
      type: Date,
      default: null,
    },

    source: {
      type: String,
      enum: ["ONLINE", "OFFLINE"],
      default: "ONLINE",
    },

    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    customerName: {
      type: String,
      trim: true,
      default: "",
    },

    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "ONLINE", ""],
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);