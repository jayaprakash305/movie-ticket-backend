const permissionMiddleware = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (req.user.role === "SUPER_ADMIN") {
      return next();
    }

    if (!req.user.permissions?.[permissionKey]) {
      return res.status(403).json({
        message: `Permission denied: ${permissionKey}`,
      });
    }

    next();
  };
};

export default permissionMiddleware;