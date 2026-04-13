import User from "../models/User.js";
import Movie from "../models/Movie.js";
import Booking from "../models/Booking.js";
import GlobalSettings from "../models/GlobalSettings.js";
import { io } from "../server.js";
const normalizePermissions = (permissions = {}) => ({
  // Movies
  addMovie:            !!permissions.addMovie,
  editMovie:           !!permissions.editMovie,
  deleteMovie:         !!permissions.deleteMovie,
  approveMovieRequest: !!permissions.approveMovieRequest,

  // Theaters
  addTheater:          !!permissions.addTheater,
  editTheater:         !!permissions.editTheater,
  deleteTheater:       !!permissions.deleteTheater,
  addScreen:           !!permissions.addScreen,
  deleteScreen:        !!permissions.deleteScreen,
  approveVenueRequest: !!permissions.approveVenueRequest,

  // Shows
  addShow:             !!permissions.addShow,
  editShow:            !!permissions.editShow,
  deleteShow:          !!permissions.deleteShow,
  approveShowRequest:  !!permissions.approveShowRequest,

  // Partners
  createPartner:       !!permissions.createPartner,
  approvePartner:      !!permissions.approvePartner,
  rejectPartner:       !!permissions.rejectPartner,

  //Agents
  createAgent:         !!permissions.createAgent,
  approveAgent:        !!permissions.approveAgent,
  rejectAgent:         !!permissions.rejectAgent,
  approveStatusRequest: !!permissions.approveStatusRequest,

  // Management
  manageUsers:         !!permissions.manageUsers,
  managePartners:      !!permissions.managePartners,
  manageAgents:        !!permissions.manageAgents,
})

export const getSuperAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "USER" });
    const totalPartners = await User.countDocuments({ role: "MANAGER" });
    const totalAdmins = await User.countDocuments({ role: "ADMIN" });
    const totalSuperAdmins = await User.countDocuments({ role: "SUPER_ADMIN" });
    const totalMovies = await Movie.countDocuments({ isActive: true });
    const totalBookings = await Booking.countDocuments();

    const confirmedBookings = await Booking.find({ status: "CONFIRMED" });
    const totalRevenue = confirmedBookings.reduce(
      (sum, item) => sum + (Number(item.totalAmount) || 0),
      0
    );

    res.json({
      totalUsers,
      totalPartners,
      totalAdmins,
      totalSuperAdmins,
      totalMovies,
      totalBookings,
      totalRevenue,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllUsersForSuperAdmin = async (req, res) => {
  try {
    const users = await User.find({
      $or: [
        { role: { $ne: "MANAGER" } },
        { role: "MANAGER", approvalStatus: "APPROVED" },
      ],
    }).sort({ createdAt: -1 });

    res.json(
      users.map((user) => {
        const payload = {
          id: String(user._id),
          name: user.name || "",
          email: user.email || "",
          role: user.role || "USER",
          approvalStatus: user.approvalStatus || "APPROVED",
          isBanned: user.isBanned || false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
        if (user.role === "ADMIN") {
          payload.permissions = normalizePermissions(user.permissions);
        }
        return payload;
      })
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "SUPER_ADMIN") {
      return res.status(403).json({ message: "Cannot delete a Super Admin" });
    }

    await user.deleteOne();

    res.json({
      message: "User deleted successfully",
      userId: id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleBanUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "SUPER_ADMIN") {
      return res.status(403).json({ message: "Cannot ban a Super Admin" });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({
      message: user.isBanned
        ? "User banned successfully"
        : "User unbanned successfully",
      userId: String(user._id),
      isBanned: user.isBanned,
    });
  } catch (error) {
    console.error("toggleBanUser error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "SUPER_ADMIN") {
      return res.status(403).json({ message: "Cannot edit a Super Admin" });
    }

    if (name)  user.name  = name.trim();
    if (email) user.email = email.trim().toLowerCase();

    await user.save();

    res.json({
      message: "User updated successfully",
      id: String(user._id),
      name: user.name,
      email: user.email,
      permissions: normalizePermissions(user.permissions),
    });
  } catch (error) {
    console.error("updateUser error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already in use" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowed = ["USER", "MANAGER", "ADMIN"];
    if (!allowed.includes(role)) {
      return res
        .status(400)
        .json({ message: "Invalid role. Allowed: USER, MANAGER, ADMIN" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "SUPER_ADMIN") {
      return res.status(403).json({ message: "Cannot change Super Admin role" });
    }

    user.role = role;

    if (role !== "ADMIN") {
      user.permissions = normalizePermissions({});
    }

    await user.save();

    res.json({
      message: "Role updated successfully",
      id: String(user._id),
      role: user.role,
      permissions: normalizePermissions(user.permissions),
    });
  } catch (error) {
    console.error("changeUserRole error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "ADMIN") {
      return res.status(400).json({ message: "Permissions can only be managed for ADMIN users" });
    }

    user.permissions = {
      ...normalizePermissions(user.permissions),
      ...normalizePermissions(permissions),
    };

    await user.save();

    io.to(`user:${user._id}`).emit("permissions-updated", {
  userId: String(user._id),
  permissions: normalizePermissions(user.permissions),
})

    res.json({
      message: "Permissions updated successfully",
      id: String(user._id),
      role: user.role,
      permissions: normalizePermissions(user.permissions),
    });
  } catch (error) {
    console.error("updateUserPermissions error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getGlobalAdminPermissions = async (req, res) => {
  try {
    const doc = await GlobalSettings.findOne({ key: "admin_permissions_template" });
    return res.json({
      permissions: doc ? normalizePermissions(doc.value) : normalizePermissions({}),
    });
  } catch (error) {
    console.error("getGlobalAdminPermissions error:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const updatePermissionsForAllAdmins = async (req, res) => {
  try {
    const { permissions } = req.body;

    const normalized = normalizePermissions(permissions);

    // Persist the template so it survives reopens and applies to new admins
    await GlobalSettings.findOneAndUpdate(
      { key: "admin_permissions_template" },
      { value: normalized },
      { upsert: true, new: true }
    );

    await User.updateMany(
      { role: "ADMIN" },
      { $set: { permissions: normalized } }
    );

    io.to("role:ADMIN").emit("permissions-updated-global", {
      permissions: normalized,
    });

    return res.json({
      message: "Permissions updated for all admins successfully",
      permissions: normalized,
    });
  } catch (error) {
    console.error("updatePermissionsForAllAdmins error:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAllMoviesPaginated = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(20, parseInt(req.query.limit) || 8);
    const search = (req.query.search || "").trim();
    const genre  = (req.query.genre  || "").trim();
    const lang   = (req.query.lang   || "").trim();
    const active = req.query.active;

    const query = {};

    if (search) {
      query.$or = [
        { title:    { $regex: search, $options: "i" } },
        { cast:     { $regex: search, $options: "i" } },
        { genre:    { $regex: search, $options: "i" } },
        { language: { $regex: search, $options: "i" } },
      ];
    }

    if (genre)  query.genre    = { $regex: genre, $options: "i" };
    if (lang)   query.language = { $regex: lang,  $options: "i" };
    if (active !== undefined && active !== "") query.isActive = active === "true";

    const total  = await Movie.countDocuments(query);
    const movies = await Movie.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("createdBy", "name email role")
      .lean();

    res.json({
      movies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext:    page * limit < total,
        hasPrev:    page > 1,
      },
    });
  } catch (error) {
    console.error("getAllMoviesPaginated error:", error);
    res.status(500).json({ message: error.message });
  }
};

//create admin user
export const createAdminUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
 
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
 
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }
 
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.default.hash(password, 10);
 
    // Apply stored global admin permissions template if it exists
    const globalTemplate = await GlobalSettings.findOne({ key: "admin_permissions_template" });
    const templatePerms = globalTemplate ? normalizePermissions(globalTemplate.value) : normalizePermissions({});

    const newAdmin = new User({
      name:        name.trim(),
      email:       email.trim().toLowerCase(),
      password:    hashedPassword,
      role:        "ADMIN",
      permissions: templatePerms,
      approvalStatus: "APPROVED",
    });
 
    await newAdmin.save();
 
    res.status(201).json({
      message: "Admin created successfully",
      id:          String(newAdmin._id),
      name:        newAdmin.name,
      email:       newAdmin.email,
      role:        newAdmin.role,
      isBanned:    newAdmin.isBanned,
      permissions: normalizePermissions(newAdmin.permissions),
      createdAt:   newAdmin.createdAt,
    });
  } catch (error) {
    console.error("createAdminUser error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already in use" });
    }
    res.status(500).json({ message: error.message });
  }
};