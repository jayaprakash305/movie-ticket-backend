import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },

    type: {
      type: String,
      enum: ["MOVIE", "SHOW", "BOOKING", "APPROVAL", "SYSTEM"],
      default: "SYSTEM",
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    receiverRole: {
      type: String, // USER / ADMIN / MANAGER / AGENT
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    meta: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.post("save", async function (doc) {
  try {
    const { io } = await import("../server.js");
    if (!io) return;
    
    if (doc.receiverId) {
      io.to(`user:${doc.receiverId.toString()}`).emit("notification", doc);
    } else if (doc.receiverRole) {
      io.to(`role:${doc.receiverRole}`).emit("notification", doc);
    }
  } catch (err) {
    console.error("Socket notification emit error:", err);
  }
});

export default mongoose.model("Notification", notificationSchema);