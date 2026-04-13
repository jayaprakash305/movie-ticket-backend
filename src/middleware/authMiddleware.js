import jwt from "jsonwebtoken"
import User from "../models/User.js"

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" })
    }

    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // ── Fetch real user from DB ───────────────────────────────────────────────
    // The JWT payload only holds id/role at sign time — we need the live
    // document so isBanned, role changes etc. are always current
    const user = await User.findById(decoded.id).select("-password")

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    // ── Ban check ─────────────────────────────────────────────────────────────
    if (user.isBanned) {
      return res.status(403).json({
        message: "Your account has been suspended. Please contact support.",
        banned: true,
      })
    }

    req.user = user   // full Mongoose document — req.user.id, req.user.role etc.
    next()

  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" })
  }
}

export default authMiddleware