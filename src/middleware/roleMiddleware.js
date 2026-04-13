const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    // ── Check authentication ─────────────────────────────
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // ── Check role ───────────────────────────────────────
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

export default roleMiddleware;