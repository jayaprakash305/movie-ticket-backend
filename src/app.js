  import express from "express";
  import cors from "cors";
  import path from "path";
  import authRoutes from "./routes/authRoutes.js";
  import userRoutes from "./routes/userRoutes.js";
  import partnerPortalRoutes from "./routes/partnerPortalRoutes.js";
  import bookingRoutes from "./routes/bookingRoutes.js";
  import paymentRoutes from "./routes/paymentRoutes.js";
  import superAdminRoutes from "./routes/superAdminRoutes.js";
  import agentRoutes from "./routes/agentRoutes.js"
  import adminRoutes from "./routes/adminRoutes.js"
  import notificationRoutes from "./routes/notificationRoutes.js"

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/uploads", express.static(path.resolve("uploads")));

  app.get("/", (req, res) => {
    res.send("Backend is running");
  });

  app.use("/auth", authRoutes);
  app.use("/user", userRoutes);
  app.use("/partner-portal", partnerPortalRoutes);
  app.use("/bookings", bookingRoutes);
  app.use("/payments", paymentRoutes);
  app.use("/super-admin", superAdminRoutes);
  app.use("/agent",agentRoutes);
  app.use("/admin",adminRoutes);
  app.use("/notifications",notificationRoutes);

  export default app;