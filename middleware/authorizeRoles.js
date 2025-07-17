module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    // 1. Ensure req.user exists (authMiddleware must run before this)
    if (!req.user || !req.user.role) {
      return res.status(403).json({ msg: "Forbidden: User role not found" });
    }
    const userRole = req.user.role;
    // 2. Check if the user's role is included in the allowedRoles array
    const isAuthorized = allowedRoles.includes(userRole);

    if (isAuthorized) {
      next(); // User is authorized, proceed to the next middleware/route handler
    } else {
      // User is not authorized for this specific action/route
      return res
        .status(403)
        .json({ msg: "Forbidden: You do not have the required permissions" });
    }
  };
};
