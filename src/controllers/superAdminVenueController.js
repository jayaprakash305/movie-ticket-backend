import Venue from "../models/Venue.js";
import User from "../models/User.js";
import generateSeatLayout from "../utils/generateSeatLayout.js";

// ── Helper: format venue for response ────────────────────────────────────────
const formatVenue = (venue) => {
  const partner = venue.createdBy
    ? {
        id: venue.createdBy?._id || venue.createdBy,
        _id: venue.createdBy?._id || venue.createdBy,
        name: venue.createdBy?.name || "",
        email: venue.createdBy?.email || "",
        role: venue.createdBy?.role || "",
      }
    : null;

  return {
    id: venue._id,
    _id: venue._id,
    name: venue.name,
    city: venue.city,
    area: venue.area,
    address: venue.address,
    amenities: venue.amenities,

    // legacy compatibility
    screenName: venue.screenName || venue.screens?.[0]?.screenName || "",
    totalSeats:
      venue.totalSeats ||
      venue.screens?.reduce((sum, sc) => sum + Number(sc.totalSeats || 0), 0) ||
      0,

    // ownership — expose as both 'partner' and 'createdByUser' so frontend works either way
    createdBy: venue.createdBy?._id || venue.createdBy || null,
    partner,
    createdByUser: partner,

    screens: (venue.screens || []).map((sc) => ({
      id: sc._id,
      _id: sc._id,
      screenName: sc.screenName,
      totalSeats: sc.totalSeats,
    })),

    isActive: venue.isActive,
    createdAt: venue.createdAt,
    updatedAt: venue.updatedAt,
  };
};

// ── Helper: ensure partnerId is set (fixes old venues missing partnerId) ─────
const ensurePartnerId = (venue) => {
  if (!venue.partnerId && venue.createdBy) {
    venue.partnerId = venue.createdBy._id || venue.createdBy;
  }
};

// ── GET all venues for super admin ───────────────────────────────────────────
export const getAllVenuesForSuperAdmin = async (req, res) => {
  try {
    const venues = await Venue.find({ isActive: true })
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    res.json(venues.map(formatVenue));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET single venue for super admin ─────────────────────────────────────────
export const getVenueByIdForSuperAdmin = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      isActive: true,
    }).populate("createdBy", "name email role");

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    res.json(formatVenue(venue));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── CREATE venue by super admin ──────────────────────────────────────────────
export const createVenueBySuperAdmin = async (req, res) => {
  try {
    const {
      name,
      city,
      area,
      address,
      amenities,
      screenName,
      totalSeats,
      screens,
      partnerId,
    } = req.body;

    if (!name || !city || !address || !partnerId) {
      return res
        .status(400)
        .json({ message: "Name, city, address and partnerId are required" });
    }

    const partner = await User.findOne({
      _id: partnerId,
      role: "MANAGER",
      isBanned: false,
      approvalStatus: "APPROVED",
      isActive: true,
    });

    if (!partner) {
      return res
        .status(404)
        .json({ message: "Approved active partner not found" });
    }

    let screensData = [];

    if (Array.isArray(screens) && screens.length > 0) {
      for (const sc of screens) {
        if (!sc?.screenName || !sc?.totalSeats) continue;

        const num = Number(sc.totalSeats);
        if (!num || num < 1) continue;

        screensData.push({
          screenName: String(sc.screenName).trim(),
          totalSeats: num,
          seatLayout: generateSeatLayout(num),
        });
      }
    }

    if (screensData.length === 0) {
      if (!screenName || !totalSeats) {
        return res.status(400).json({
          message:
            "At least one screen with screenName and totalSeats is required",
        });
      }

      const num = Number(totalSeats);
      if (!num || num < 1) {
        return res
          .status(400)
          .json({ message: "totalSeats must be greater than 0" });
      }

      screensData.push({
        screenName: String(screenName).trim(),
        totalSeats: num,
        seatLayout: generateSeatLayout(num),
      });
    }

    const totalSeatsAll = screensData.reduce(
      (sum, sc) => sum + Number(sc.totalSeats || 0),
      0
    );

    const venue = await Venue.create({
      name: String(name).trim(),
      city: String(city).trim(),
      area: area?.trim?.() || "",
      address: String(address).trim(),
      amenities: amenities?.trim?.() || "",

      // legacy single screen fields
      screenName: screensData[0].screenName,
      totalSeats: totalSeatsAll,
      seatLayout: screensData[0].seatLayout,

      // multi-screen
      screens: screensData,

      createdBy: partnerId,
      partnerId,
      isActive: true,
    });

    await User.findByIdAndUpdate(partnerId, {
      $addToSet: { venueIds: venue._id },
    });

    const populatedVenue = await Venue.findById(venue._id).populate(
      "createdBy",
      "name email role"
    );

    res.status(201).json({
      message: "Venue created successfully",
      venue: formatVenue(populatedVenue),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── UPDATE venue by super admin ──────────────────────────────────────────────
export const updateVenueBySuperAdmin = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      isActive: true,
    });

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    venue.name = req.body.name ?? venue.name;
    venue.city = req.body.city ?? venue.city;
    venue.area = req.body.area ?? venue.area;
    venue.address = req.body.address ?? venue.address;
    venue.amenities = req.body.amenities ?? venue.amenities;

    // ── partner reassignment ─────────────────────────────────────────────────
    if (
      req.body.partnerId &&
      String(req.body.partnerId) !== String(venue.createdBy)
    ) {
      const newPartner = await User.findOne({
        _id: req.body.partnerId,
        role: "MANAGER",
        isBanned: false,
        approvalStatus: "APPROVED",
        isActive: true,
      });

      if (!newPartner) {
        return res
          .status(404)
          .json({ message: "New assigned partner not found" });
      }

      const oldOwnerId = venue.createdBy;
      venue.createdBy = req.body.partnerId;
      venue.partnerId = req.body.partnerId;

      if (oldOwnerId) {
        await User.findByIdAndUpdate(oldOwnerId, {
          $pull: { venueIds: venue._id },
        });
      }

      await User.findByIdAndUpdate(req.body.partnerId, {
        $addToSet: { venueIds: venue._id },
      });
    } else {
      // FIX: ensure partnerId is always in sync with createdBy
      ensurePartnerId(venue);
    }

    // ── screens update ──────────────────────────────────────────────────────
    if (Array.isArray(req.body.screens) && req.body.screens.length > 0) {
      const updatedScreens = [];

      for (const sc of req.body.screens) {
        if (!sc?.screenName || !sc?.totalSeats) continue;

        const num = Number(sc.totalSeats);
        if (!num || num < 1) continue;

        const existingScreen = sc.id
          ? venue.screens.find((s) => String(s._id) === String(sc.id))
          : null;

        if (existingScreen && Number(existingScreen.totalSeats) === num) {
          existingScreen.screenName = String(sc.screenName).trim();
          updatedScreens.push(existingScreen);
        } else {
          updatedScreens.push({
            ...(existingScreen ? { _id: existingScreen._id } : {}),
            screenName: String(sc.screenName).trim(),
            totalSeats: num,
            seatLayout: generateSeatLayout(num),
          });
        }
      }

      if (updatedScreens.length === 0) {
        return res.status(400).json({
          message: "At least one valid screen is required",
        });
      }

      venue.screens = updatedScreens;
      venue.screenName = updatedScreens[0].screenName;
      venue.totalSeats = updatedScreens.reduce(
        (sum, sc) => sum + Number(sc.totalSeats || 0),
        0
      );
      venue.seatLayout = updatedScreens[0].seatLayout;
    }

    await venue.save();

    const populatedVenue = await Venue.findById(venue._id).populate(
      "createdBy",
      "name email role"
    );

    res.json({
      message: "Venue updated successfully",
      venue: formatVenue(populatedVenue),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── DELETE venue by super admin (soft delete) ────────────────────────────────
export const deleteVenueBySuperAdmin = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      isActive: true,
    });

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // FIX: ensure partnerId before saving
    ensurePartnerId(venue);

    venue.isActive = false;
    await venue.save();

    if (venue.createdBy) {
      await User.findByIdAndUpdate(venue.createdBy, {
        $pull: { venueIds: venue._id },
      });
    }

    res.json({ message: "Venue deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── ADD screen by super admin ────────────────────────────────────────────────
export const addVenueScreenBySuperAdmin = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      isActive: true,
    });

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // FIX: ensure partnerId is set before saving
    ensurePartnerId(venue);

    const { screenName, totalSeats } = req.body;

    if (!screenName || !totalSeats) {
      return res
        .status(400)
        .json({ message: "screenName and totalSeats are required" });
    }

    const exists = venue.screens.some(
      (s) => s.screenName.toLowerCase() === String(screenName).toLowerCase()
    );

    if (exists) {
      return res
        .status(400)
        .json({ message: `Screen "${screenName}" already exists` });
    }

    const totalSeatsNum = Number(totalSeats);
    if (!totalSeatsNum || totalSeatsNum < 1) {
      return res
        .status(400)
        .json({ message: "totalSeats must be greater than 0" });
    }

    const seatLayout = generateSeatLayout(totalSeatsNum);

    venue.screens.push({
      screenName: String(screenName).trim(),
      totalSeats: totalSeatsNum,
      seatLayout,
    });

    venue.totalSeats = venue.screens.reduce(
      (sum, sc) => sum + Number(sc.totalSeats || 0),
      0
    );

    if (venue.screens.length > 0) {
      venue.screenName = venue.screens[0].screenName;
      venue.seatLayout = venue.screens[0].seatLayout;
    }

    await venue.save();

    const newScreen = venue.screens[venue.screens.length - 1];

    res.status(201).json({
      message: "Screen added successfully",
      screen: {
        id: newScreen._id,
        _id: newScreen._id,
        screenName: newScreen.screenName,
        totalSeats: newScreen.totalSeats,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── DELETE screen by super admin ─────────────────────────────────────────────
export const deleteVenueScreenBySuperAdmin = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      isActive: true,
    });

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // FIX: ensure partnerId is set before saving
    ensurePartnerId(venue);

    if (venue.screens.length <= 1) {
      return res.status(400).json({
        message: "Cannot delete the last screen. Delete the theatre instead.",
      });
    }

    const screenIndex = venue.screens.findIndex(
      (s) => String(s._id) === String(req.params.screenId)
    );

    if (screenIndex === -1) {
      return res.status(404).json({ message: "Screen not found" });
    }

    venue.screens.splice(screenIndex, 1);

    venue.totalSeats = venue.screens.reduce(
      (sum, sc) => sum + Number(sc.totalSeats || 0),
      0
    );

    if (venue.screens.length > 0) {
      venue.screenName = venue.screens[0].screenName;
      venue.seatLayout = venue.screens[0].seatLayout;
    }

    await venue.save();

    res.json({ message: "Screen deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET seat layout for a specific screen ────────────────────────────────────
// Converts flat DB format → grouped row format expected by the frontend
export const getScreenSeatLayoutBySuperAdmin = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      isActive: true,
    });

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    const screen = venue.screens.find(
      (s) => String(s._id) === String(req.params.screenId)
    );

    if (!screen) {
      return res.status(404).json({ message: "Screen not found" });
    }

    // Convert flat seatLayout [{seatId, seatNumber, rowLabel, isActive}]
    // → grouped rows [{row, seats:[{seatNumber, type, isActive}]}]
    const rowMap = new Map();
    for (const seat of screen.seatLayout || []) {
      const rowKey = seat.rowLabel || "A";
      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, { row: rowKey, seats: [] });
      }
      rowMap.get(rowKey).seats.push({
        seatNumber: seat.seatNumber,
        type: seat.type || "REGULAR",
        isActive: seat.isActive !== false,
      });
    }

    // If seatLayout is empty (e.g. auto-generated seats not stored yet),
    // build a default layout from totalSeats
    let groupedLayout = [...rowMap.values()];

    if (groupedLayout.length === 0 && screen.totalSeats > 0) {
      const seatsPerRow = 10;
      const rows = Math.ceil(screen.totalSeats / seatsPerRow);
      const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let remaining = screen.totalSeats;

      for (let r = 0; r < rows && remaining > 0; r++) {
        const rowLabel = rowLabels[r] || `R${r + 1}`;
        const count = Math.min(seatsPerRow, remaining);
        const seats = [];
        for (let i = 1; i <= count; i++) {
          seats.push({
            seatNumber: `${rowLabel}${i}`,
            type: "REGULAR",
            isActive: true,
          });
        }
        groupedLayout.push({ row: rowLabel, seats });
        remaining -= count;
      }
    }

    res.json({
      screenId: screen._id,
      screenName: screen.screenName,
      totalSeats: screen.totalSeats,
      seatLayout: groupedLayout,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── UPDATE seat layout by super admin ────────────────────────────────────────
// Converts grouped row format from frontend → flat DB format before saving
export const updateScreenSeatLayoutBySuperAdmin = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      isActive: true,
    });

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // FIX: ensure partnerId is set before saving
    ensurePartnerId(venue);

    const screen = venue.screens.find(
      (s) => String(s._id) === String(req.params.screenId)
    );

    if (!screen) {
      return res.status(404).json({ message: "Screen not found" });
    }

    const { seatLayout } = req.body;

    if (!Array.isArray(seatLayout)) {
      return res.status(400).json({ message: "seatLayout must be an array" });
    }

    // Convert grouped rows [{row, seats:[{seatNumber, type, isActive}]}]
    // → flat [{seatId, seatNumber, rowLabel, isActive}] for DB storage
    const flatLayout = [];
    for (const rowGroup of seatLayout) {
      const rowLabel = rowGroup.row || "A";
      for (const seat of rowGroup.seats || []) {
        flatLayout.push({
          seatId: seat.seatNumber,
          seatNumber: seat.seatNumber,
          rowLabel,
          isActive: seat.isActive !== false,
        });
      }
    }

    screen.seatLayout = flatLayout;
    screen.totalSeats = flatLayout.filter((s) => s.isActive !== false).length;

    venue.totalSeats = venue.screens.reduce(
      (sum, sc) => sum + Number(sc.totalSeats || 0),
      0
    );

    if (venue.screens.length > 0) {
      venue.screenName = venue.screens[0].screenName;
      venue.seatLayout = venue.screens[0].seatLayout;
    }

    await venue.save();

    res.json({
      message: "Seat layout updated successfully",
      totalSeats: screen.totalSeats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getApprovedPartnersForSuperAdmin = async (req, res) => {
  try {
    const partners = await User.find({
      role: "MANAGER",
      isBanned: false,
      approvalStatus: "APPROVED",
      isActive: true,
    })
      .select("_id name email role createdAt")
      .sort({ name: 1 });

    res.json(partners.map((p) => ({
      id: p._id, _id: p._id,
      name: p.name, email: p.email, role: p.role,
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};