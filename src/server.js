import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Booking from "./models/Booking.js";
import { initMailer, getMailer } from "./config/mail.js";


dotenv.config();

const PORT = process.env.PORT || 5000;
await initMailer();
connectDB();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || "*" },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded._id || decoded.id;
    socket.userRole = decoded.role;
    socket.username = decoded.name;
    socket.join(`user:${socket.userId}`);      // personal room
    socket.join(`role:${decoded.role}`);       // role-wide room
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id, socket.username)

  socket.on("join-show", (showId) => {
    if (!showId) return
    socket.join(`show:${showId}`)
    console.log(`User ${socket.username} joined show:${showId}`)
  })

  socket.on("leave-show", (showId) => {
    if (!showId) return
    socket.leave(`show:${showId}`)
    console.log(`User ${socket.username} left show:${showId}`)
  })

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id)
  })
})

// ── Background Worker: Auto-Release Expired Seat Locks ──
setInterval(async () => {
  try {
    const expiredLocks = await Booking.find({
      status: "LOCKED",
      lockExpiresAt: { $lte: new Date() },
    }).select("seats showId");

    if (expiredLocks.length > 0) {
      await Booking.deleteMany({
        _id: { $in: expiredLocks.map((b) => b._id) },
      });

      // Group seats by showId to emit efficiently to each room
      const unlockedByShow = {};
      expiredLocks.forEach((lock) => {
        const sid = String(lock.showId);
        if (!unlockedByShow[sid]) unlockedByShow[sid] = [];
        unlockedByShow[sid].push(...(lock.seats || []));
      });

      // Emit "seat-unlocked" event to each active show room
      for (const [showId, seats] of Object.entries(unlockedByShow)) {
        if (seats.length > 0) {
          io.to(`show:${showId}`).emit("seat-unlocked", {
            showId,
            seats,
          });
          // console.log(`Auto-unlocked ${seats.length} seats for show ${showId}`);
        }
      }
    }
  } catch (err) {
    console.error("Auto-unlock worker failed:", err);
  }
}, 10000); // Run every 10 seconds

httpServer.listen(PORT, () => {
  // console.log(`Server running on port ${PORT}`);
});

export { io };