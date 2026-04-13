import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    // Movies
    addMovie: { type: Boolean, default: false },
    editMovie: { type: Boolean, default: false },
    deleteMovie: { type: Boolean, default: false },
    approveMovieRequest: { type: Boolean, default: false },

    // Theaters
    addTheater: { type: Boolean, default: false },
    editTheater: { type: Boolean, default: false },
    deleteTheater: { type: Boolean, default: false },
    addScreen: { type: Boolean, default: false },
    deleteScreen: { type: Boolean, default: false },
    approveVenueRequest: { type: Boolean, default: false },

    // Shows
    addShow: { type: Boolean, default: false },
    editShow: { type: Boolean, default: false },
    deleteShow: { type: Boolean, default: false },
    approveShowRequest: { type: Boolean, default: false },

    // Partners
    createPartner: { type: Boolean, default: false },
    approvePartner: { type: Boolean, default: false },
    rejectPartner: { type: Boolean, default: false },

    // Agents
    createAgent: { type: Boolean, default: false },
    approveAgent: { type: Boolean, default: false },
    rejectAgent: { type: Boolean, default: false },
    approveStatusRequest: { type: Boolean, default: false },
    // Management
    manageUsers: { type: Boolean, default: false },
    managePartners: { type: Boolean, default: false },
    manageAgents: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["USER", "MANAGER", "ADMIN", "SUPER_ADMIN", "AGENT"],
      default: "USER",
    },

    permissions: {
      type: permissionSchema,
      default: () => ({}),
    },

    isBanned: {
      type: Boolean,
      default: false,
    },

    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    venueIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Venue",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "APPROVED",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    statusChangeRequest: {
      type: String,
      enum: ["NONE", "ACTIVATE", "DEACTIVATE"],
      default: "NONE",
    },

    statusChangeRequestedAt: {
      type: Date,
      default: null,
    },

    statusChangeRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    resetOtp: { type: String, default: null },
    resetOtpExpiresAt: { type: Date, default: null },

  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;