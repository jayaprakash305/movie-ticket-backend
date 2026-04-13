import Venue from "../models/Venue.js"
import generateSeatLayout from "../utils/generateSeatLayout.js"

// ── Helper: format venue for response ────────────────────────────────────────
const formatVenue = (venue) => ({
  id:         venue._id,
  name:       venue.name,
  city:       venue.city,
  area:       venue.area,
  address:    venue.address,
  amenities:  venue.amenities,
  screenName: venue.screenName || venue.screens?.[0]?.screenName || "",
  totalSeats: venue.totalSeats || venue.screens?.reduce((s, sc) => s + sc.totalSeats, 0) || 0,
  partnerId:  venue.partnerId,
  createdBy:  venue.createdBy,
  screens: (venue.screens || []).map(sc => ({
    id:         sc._id,
    screenName: sc.screenName,
    totalSeats: sc.totalSeats,
  })),
})

// ── Helper: ensure partnerId is always set before saving ─────────────────────
const ensurePartnerId = (venue) => {
  if (!venue.partnerId && venue.createdBy) {
    venue.partnerId = venue.createdBy._id || venue.createdBy
  }
}

// ── Helper: flat DB seatLayout → grouped rows for frontend ───────────────────
// DB stores: [{ seatId, seatNumber, rowLabel, isActive }]
// Frontend expects: [{ row, seats: [{ seatNumber, type, isActive }] }]
const flatToGrouped = (flatLayout = [], totalSeats = 0) => {
  // If layout exists in flat format, group by rowLabel
  if (flatLayout.length > 0 && flatLayout[0].rowLabel !== undefined) {
    const rowMap = new Map()
    for (const seat of flatLayout) {
      const rowKey = seat.rowLabel || "A"
      if (!rowMap.has(rowKey)) rowMap.set(rowKey, { row: rowKey, seats: [] })
      rowMap.get(rowKey).seats.push({
        seatNumber: seat.seatNumber,
        type:       seat.type || "REGULAR",
        isActive:   seat.isActive !== false,
      })
    }
    return [...rowMap.values()]
  }

  // If layout exists in already-grouped format (row, seats[])
  if (flatLayout.length > 0 && flatLayout[0].row !== undefined) {
    return flatLayout
  }

  // No layout — generate default grid from totalSeats
  if (totalSeats > 0) {
    const seatsPerRow = 10
    const rowLabels   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let remaining     = totalSeats
    const grouped     = []

    for (let r = 0; r < 26 && remaining > 0; r++) {
      const rowLabel = rowLabels[r]
      const count    = Math.min(seatsPerRow, remaining)
      const seats    = []
      for (let i = 1; i <= count; i++) {
        seats.push({ seatNumber: `${rowLabel}${i}`, type: "REGULAR", isActive: true })
      }
      grouped.push({ row: rowLabel, seats })
      remaining -= count
    }
    return grouped
  }

  return []
}

// ── Helper: grouped rows from frontend → flat DB format ──────────────────────
const groupedToFlat = (groupedLayout = []) => {
  const flat = []
  for (const rowGroup of groupedLayout) {
    const rowLabel = rowGroup.row || "A"
    for (const seat of rowGroup.seats || []) {
      flat.push({
        seatId:     seat.seatNumber,
        seatNumber: seat.seatNumber,
        rowLabel,
        isActive:   seat.isActive !== false,
      })
    }
  }
  return flat
}

// ── GET partner's venues ──────────────────────────────────────────────────────
// FIX: query by BOTH partnerId and createdBy so old venues aren't missed
export const getPartnerVenues = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id

    const venues = await Venue.find({
      $or: [
        { partnerId: userId },
        { createdBy: userId },
      ],
      isActive: true,
    }).sort({ createdAt: -1 })

    // Deduplicate in case a venue matches both conditions
    const seen   = new Set()
    const unique = venues.filter(v => {
      const id = String(v._id)
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })

    res.json(unique.map(formatVenue))
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── CREATE venue ──────────────────────────────────────────────────────────────
export const createPartnerVenue = async (req, res) => {
  try {
    const { name, city, area, address, amenities, screenName, totalSeats, screens } = req.body
    const userId = req.user.id || req.user._id

    if (!name || !city || !address) {
      return res.status(400).json({ message: "Name, city and address are required" })
    }

    let screensData = []

    if (Array.isArray(screens) && screens.length > 0) {
      for (const sc of screens) {
        if (!sc.screenName || !sc.totalSeats) continue
        const num = Number(sc.totalSeats)
        if (!num || num < 1) continue
        screensData.push({
          screenName: String(sc.screenName).trim(),
          totalSeats: num,
          seatLayout: generateSeatLayout(num),
        })
      }
    }

    if (screensData.length === 0) {
      if (!screenName || !totalSeats) {
        return res.status(400).json({ message: "At least one screen with name and seats is required" })
      }
      const num = Number(totalSeats)
      if (!num || num < 1) {
        return res.status(400).json({ message: "totalSeats must be greater than 0" })
      }
      screensData.push({
        screenName: String(screenName).trim(),
        totalSeats: num,
        seatLayout: generateSeatLayout(num),
      })
    }

    const totalSeatsAll = screensData.reduce((s, sc) => s + sc.totalSeats, 0)

    const venue = await Venue.create({
      name:       String(name).trim(),
      city:       String(city).trim(),
      area:       area?.trim() || "",
      address:    String(address).trim(),
      amenities:  amenities?.trim() || "",
      screenName: screensData[0].screenName,
      totalSeats: totalSeatsAll,
      seatLayout: screensData[0].seatLayout,
      screens:    screensData,
      createdBy:  userId,
      partnerId:  userId,   // always set both
      isActive:   true,
    })

    res.status(201).json({
      message: "Venue created successfully",
      venue:   formatVenue(venue),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── UPDATE venue ──────────────────────────────────────────────────────────────
export const updatePartnerVenue = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id

    // FIX: find by either partnerId or createdBy
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      $or: [{ partnerId: userId }, { createdBy: userId }],
      isActive: true,
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    // Ensure partnerId is always in sync
    ensurePartnerId(venue)

    venue.name      = req.body.name      ?? venue.name
    venue.city      = req.body.city      ?? venue.city
    venue.area      = req.body.area      ?? venue.area
    venue.address   = req.body.address   ?? venue.address
    venue.amenities = req.body.amenities ?? venue.amenities

    if (Array.isArray(req.body.screens) && req.body.screens.length > 0) {
      const updatedScreens = []

      for (const sc of req.body.screens) {
        if (!sc.screenName || !sc.totalSeats) continue
        const num = Number(sc.totalSeats)
        if (!num || num < 1) continue

        const existingScreen = sc.id
          ? venue.screens.find(s => String(s._id) === String(sc.id))
          : null

        if (existingScreen && Number(existingScreen.totalSeats) === num) {
          existingScreen.screenName = String(sc.screenName).trim()
          updatedScreens.push(existingScreen)
        } else {
          updatedScreens.push({
            ...(existingScreen ? { _id: existingScreen._id } : {}),
            screenName: String(sc.screenName).trim(),
            totalSeats: num,
            seatLayout: generateSeatLayout(num),
          })
        }
      }

      if (updatedScreens.length > 0) {
        venue.screens    = updatedScreens
        venue.screenName = updatedScreens[0].screenName
        venue.totalSeats = updatedScreens.reduce((s, sc) => s + sc.totalSeats, 0)
        venue.seatLayout = updatedScreens[0].seatLayout
      }
    }

    await venue.save()
    res.json({ message: "Venue updated successfully", venue: formatVenue(venue) })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── DELETE venue (soft delete) ────────────────────────────────────────────────
export const deletePartnerVenue = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id

    // FIX: find by either partnerId or createdBy
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      $or: [{ partnerId: userId }, { createdBy: userId }],
      isActive: true,
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    ensurePartnerId(venue)
    venue.isActive = false
    await venue.save()

    res.json({ message: "Venue deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── ADD screen to venue ───────────────────────────────────────────────────────
export const addVenueScreen = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id

    // FIX: find by either partnerId or createdBy
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      $or: [{ partnerId: userId }, { createdBy: userId }],
      isActive: true,
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    // FIX: ensure partnerId before saving
    ensurePartnerId(venue)

    const { screenName, totalSeats } = req.body
    if (!screenName || !totalSeats) {
      return res.status(400).json({ message: "screenName and totalSeats are required" })
    }

    const exists = venue.screens.some(
      s => s.screenName.toLowerCase() === String(screenName).toLowerCase()
    )
    if (exists) return res.status(400).json({ message: `Screen "${screenName}" already exists` })

    const totalSeatsNum = Number(totalSeats)
    if (!totalSeatsNum || totalSeatsNum < 1) {
      return res.status(400).json({ message: "totalSeats must be greater than 0" })
    }

    const seatLayout = generateSeatLayout(totalSeatsNum)

    venue.screens.push({
      screenName: String(screenName).trim(),
      totalSeats: totalSeatsNum,
      seatLayout,
    })

    venue.totalSeats = venue.screens.reduce((s, sc) => s + sc.totalSeats, 0)

    if (venue.screens.length > 0) {
      venue.screenName = venue.screens[0].screenName
      venue.seatLayout = venue.screens[0].seatLayout
    }

    await venue.save()

    const newScreen = venue.screens[venue.screens.length - 1]

    res.status(201).json({
      message: "Screen added successfully",
      screen: {
        id:         newScreen._id,
        screenName: newScreen.screenName,
        totalSeats: newScreen.totalSeats,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── DELETE screen from venue ──────────────────────────────────────────────────
export const deleteVenueScreen = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id

    // FIX: find by either partnerId or createdBy
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      $or: [{ partnerId: userId }, { createdBy: userId }],
      isActive: true,
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    // FIX: ensure partnerId before saving
    ensurePartnerId(venue)

    if (venue.screens.length <= 1) {
      return res.status(400).json({ message: "Cannot delete the last screen. Delete the theatre instead." })
    }

    const screenIndex = venue.screens.findIndex(
      s => String(s._id) === String(req.params.screenId)
    )

    if (screenIndex === -1) return res.status(404).json({ message: "Screen not found" })

    venue.screens.splice(screenIndex, 1)

    venue.totalSeats = venue.screens.reduce((s, sc) => s + sc.totalSeats, 0)

    if (venue.screens.length > 0) {
      venue.screenName = venue.screens[0].screenName
      venue.seatLayout = venue.screens[0].seatLayout
    }

    await venue.save()

    res.json({ message: "Screen deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── GET seat layout for a screen ─────────────────────────────────────────────
// FIX: converts flat DB format → grouped rows that the partner frontend expects
export const getScreenSeatLayout = async (req, res) => {
  try {
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      isActive: true,
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    const screen = venue.screens.find(
      s => String(s._id) === String(req.params.screenId)
    )

    if (!screen) return res.status(404).json({ message: "Screen not found" })

    // Convert flat → grouped for the frontend seat editor
    const groupedLayout = flatToGrouped(screen.seatLayout || [], screen.totalSeats)

    res.json({
      screenId:   screen._id,
      screenName: screen.screenName,
      totalSeats: screen.totalSeats,
      seatLayout: groupedLayout,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── UPDATE seat layout for a screen ──────────────────────────────────────────
// The partner frontend sends flat format [{seatId, seatNumber, rowLabel, isActive}]
// so we save it directly. If it sends grouped format, we convert to flat first.
export const updateScreenSeatLayout = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id

    // FIX: find by either partnerId or createdBy
    const venue = await Venue.findOne({
      _id: req.params.venueId,
      $or: [{ partnerId: userId }, { createdBy: userId }],
      isActive: true,
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    // FIX: ensure partnerId before saving
    ensurePartnerId(venue)

    const screen = venue.screens.find(
      s => String(s._id) === String(req.params.screenId)
    )

    if (!screen) return res.status(404).json({ message: "Screen not found" })

    const { seatLayout } = req.body

    if (!Array.isArray(seatLayout)) {
      return res.status(400).json({ message: "seatLayout must be an array" })
    }

    // Detect format: if items have 'row' key → grouped format from super admin UI
    // If items have 'seatId' key → flat format from partner UI
    let flatLayout
    if (seatLayout.length > 0 && seatLayout[0].row !== undefined) {
      // Grouped format → convert to flat for storage
      flatLayout = groupedToFlat(seatLayout)
    } else {
      // Already flat format
      flatLayout = seatLayout
    }

    screen.seatLayout = flatLayout
    screen.totalSeats = flatLayout.filter(s => s.isActive !== false).length

    // Keep legacy top-level fields in sync
    venue.totalSeats = venue.screens.reduce((s, sc) => s + sc.totalSeats, 0)
    if (venue.screens.length > 0) {
      venue.screenName = venue.screens[0].screenName
      venue.seatLayout = venue.screens[0].seatLayout
    }

    await venue.save()

    res.json({
      message:    "Seat layout updated successfully",
      totalSeats: screen.totalSeats,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}