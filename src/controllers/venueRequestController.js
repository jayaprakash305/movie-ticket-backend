import Venue from "../models/Venue.js"
import VenueRequest from "../models/VenueRequest.js"
import User from "../models/User.js"
import generateSeatLayout from "../utils/generateSeatLayout.js"
import Notification from "../models/Notification.js"

// ── Helpers ──────────────────────────────────────────────────────────────────
const getUserId = (req) => req.user?._id || req.user?.id

const isVenueOwner = (venue, userId) => {
  return (
    String(venue?.createdBy?._id || venue?.createdBy || "") === String(userId) ||
    String(venue?.partnerId?._id || venue?.partnerId || "") === String(userId)
  )
}

const ensurePartnerId = (venue) => {
  if (!venue.partnerId && venue.createdBy) {
    venue.partnerId = venue.createdBy._id || venue.createdBy
  }
}

const flatToGrouped = (flatLayout = [], totalSeats = 0) => {
  if (flatLayout.length > 0 && flatLayout[0]?.rowLabel !== undefined) {
    const rowMap = new Map()

    for (const seat of flatLayout) {
      const rowKey = seat.rowLabel || "A"
      if (!rowMap.has(rowKey)) rowMap.set(rowKey, { row: rowKey, seats: [] })

      rowMap.get(rowKey).seats.push({
        seatNumber: seat.seatNumber,
        type: seat.type || "REGULAR",
        isActive: seat.isActive !== false,
      })
    }

    return [...rowMap.values()]
  }

  if (flatLayout.length > 0 && flatLayout[0]?.row !== undefined) {
    return flatLayout
  }

  if (totalSeats > 0) {
    const seatsPerRow = 10
    const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let remaining = totalSeats
    const grouped = []

    for (let r = 0; r < 26 && remaining > 0; r++) {
      const rowLabel = rowLabels[r]
      const count = Math.min(seatsPerRow, remaining)
      const seats = []

      for (let i = 1; i <= count; i++) {
        seats.push({
          seatNumber: `${rowLabel}${i}`,
          type: "REGULAR",
          isActive: true,
        })
      }

      grouped.push({ row: rowLabel, seats })
      remaining -= count
    }

    return grouped
  }

  return []
}

const groupedToFlat = (groupedLayout = []) => {
  const flat = []

  for (const rowGroup of groupedLayout) {
    const rowLabel = rowGroup.row || "A"

    for (const seat of rowGroup.seats || []) {
      flat.push({
        seatId: seat.seatNumber,
        seatNumber: seat.seatNumber,
        rowLabel,
        isActive: seat.isActive !== false,
      })
    }
  }

  return flat
}

const formatRequest = (request) => ({
  id: request._id,
  requestType: request.requestType,
  venueId: request.venueId && request.venueId.name ? {
    _id: request.venueId._id || request.venueId,
    name: request.venueId.name,
    city: request.venueId.city,
    area: request.venueId.area,
    address: request.venueId.address
  } : (request.venueId?._id || request.venueId || null),
  screenId: request.screenId || request.payload?.screenId || null,
  requestedBy: request.requestedBy
    ? {
        id: request.requestedBy._id || request.requestedBy,
        name: request.requestedBy.name || "",
        email: request.requestedBy.email || "",
        role: request.requestedBy.role || "",
      }
    : null,
  approvalStatus: request.approvalStatus,
  reviewedBy: request.reviewedBy
    ? {
        id: request.reviewedBy._id || request.reviewedBy,
        name: request.reviewedBy.name || "",
        email: request.reviewedBy.email || "",
        role: request.reviewedBy.role || "",
      }
    : null,
  reviewedAt: request.reviewedAt,
  adminNote: request.adminNote || "",
  payload: request.payload || {},
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
})

const validateCreateOrUpdatePayload = (payload) => {
  const { name, city, address, screenName, totalSeats, screens } = payload || {}

  if (!name || !city || !address) {
    return "Name, city and address are required"
  }

  let screensData = []

  if (Array.isArray(screens) && screens.length > 0) {
    for (const sc of screens) {
      if (!sc?.screenName || !sc?.totalSeats) continue
      const num = Number(sc.totalSeats)
      if (!num || num < 1) continue

      screensData.push({
        ...(sc.id ? { _id: sc.id } : {}),
        screenName: String(sc.screenName).trim(),
        totalSeats: num,
      })
    }
  }

  if (screensData.length === 0) {
    if (!screenName || !totalSeats) {
      return "At least one screen with screenName and totalSeats is required"
    }

    const num = Number(totalSeats)
    if (!num || num < 1) {
      return "totalSeats must be greater than 0"
    }
  }

  return null
}

// ── Partner: create venue request ────────────────────────────────────────────
export const createVenueCreateRequest = async (req, res) => {
  try {
    const requestedBy = getUserId(req)
    const payload = req.body || {}

    const validationError = validateCreateOrUpdatePayload(payload)
    if (validationError) {
      return res.status(400).json({ message: validationError })
    }

    const request = await VenueRequest.create({
      requestType: "CREATE",
      requestedBy,
      payload,
      approvalStatus: "PENDING",
    })

    await Notification.create([
  {
    title: "New Venue Request 🏢",
    message: `${req.user.name} submitted a venue create request`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "VENUE_CREATE",
      requestId: request._id,
      partnerId: requestedBy,
    },
  },
  {
    title: "New Venue Request 🏢",
    message: `${req.user.name} submitted a venue create request`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "VENUE_CREATE",
      requestId: request._id,
      partnerId: requestedBy,
    },
  },
])

    const populated = await VenueRequest.findById(request._id)
      .populate("requestedBy", "name email role")

    res.status(201).json({
      message: "Venue create request submitted successfully",
      request: formatRequest(populated),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Partner: update venue request ────────────────────────────────────────────
export const createVenueUpdateRequest = async (req, res) => {
  try {
    const requestedBy = getUserId(req)
    const { venueId } = req.params
    const payload = req.body || {}

    const venue = await Venue.findOne({ _id: venueId, isActive: true })
    if (!venue) return res.status(404).json({ message: "Venue not found" })

    if (!isVenueOwner(venue, requestedBy)) {
      return res.status(403).json({ message: "You can request changes only for your own theatre" })
    }

    const validationError = validateCreateOrUpdatePayload({
      ...venue.toObject(),
      ...payload,
    })
    if (validationError) {
      return res.status(400).json({ message: validationError })
    }

    const request = await VenueRequest.create({
      requestType: "UPDATE",
      venueId,
      requestedBy,
      payload,
      approvalStatus: "PENDING",
    })

    await Notification.create([
  {
    title: "Venue Update Request ✏️",
    message: `${req.user.name} requested updates for a venue`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "VENUE_UPDATE",
      requestId: request._id,
      venueId,
      partnerId: requestedBy,
    },
  },
  {
    title: "Venue Update Request ✏️",
    message: `${req.user.name} requested updates for a venue`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "VENUE_UPDATE",
      requestId: request._id,
      venueId,
      partnerId: requestedBy,
    },
  },
])

    const populated = await VenueRequest.findById(request._id)
      .populate("requestedBy", "name email role")

    res.status(201).json({
      message: "Venue update request submitted successfully",
      request: formatRequest(populated),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Partner: delete venue request ────────────────────────────────────────────
export const createVenueDeleteRequest = async (req, res) => {
  try {
    const requestedBy = getUserId(req)
    const { venueId } = req.params

    const venue = await Venue.findOne({ _id: venueId, isActive: true })
    if (!venue) return res.status(404).json({ message: "Venue not found" })

    if (!isVenueOwner(venue, requestedBy)) {
      return res.status(403).json({ message: "You can request changes only for your own theatre" })
    }

    const request = await VenueRequest.create({
      requestType: "DELETE",
      venueId,
      requestedBy,
      payload: {
        venueName: venue.name,
      },
      approvalStatus: "PENDING",
    })
await Notification.create([
  {
    title: "Venue Delete Request 🗑️",
    message: `${req.user.name} requested venue deletion`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "VENUE_DELETE",
      requestId: request._id,
      venueId,
      partnerId: requestedBy,
    },
  },
  {
    title: "Venue Delete Request 🗑️",
    message: `${req.user.name} requested venue deletion`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "VENUE_DELETE",
      requestId: request._id,
      venueId,
      partnerId: requestedBy,
    },
  },
])
    
    const populated = await VenueRequest.findById(request._id)
      .populate("requestedBy", "name email role")

    res.status(201).json({
      message: "Venue delete request submitted successfully",
      request: formatRequest(populated),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Partner: add screen request ──────────────────────────────────────────────
export const createAddScreenRequest = async (req, res) => {
  try {
    const requestedBy = getUserId(req)
    const { venueId } = req.params
    const { screenName, totalSeats } = req.body || {}

    const venue = await Venue.findOne({ _id: venueId, isActive: true })
    if (!venue) return res.status(404).json({ message: "Venue not found" })

    if (!isVenueOwner(venue, requestedBy)) {
      return res.status(403).json({ message: "You can request changes only for your own theatre" })
    }

    if (!screenName || !totalSeats) {
      return res.status(400).json({ message: "screenName and totalSeats are required" })
    }

    const num = Number(totalSeats)
    if (!num || num < 1) {
      return res.status(400).json({ message: "totalSeats must be greater than 0" })
    }

    const exists = (venue.screens || []).some(
      (s) => s.screenName.toLowerCase() === String(screenName).toLowerCase()
    )
    if (exists) {
      return res.status(400).json({ message: `Screen "${screenName}" already exists` })
    }

    const request = await VenueRequest.create({
      requestType: "ADD_SCREEN",
      venueId,
      requestedBy,
      payload: {
        screenName: String(screenName).trim(),
        totalSeats: num,
      },
      approvalStatus: "PENDING",
    })

await Notification.create([
  {
    title: "Add Screen Request 🎥",
    message: `${req.user.name} requested a new screen for a venue`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "ADD_SCREEN",
      requestId: request._id,
      venueId,
      partnerId: requestedBy,
    },
  },
  {
    title: "Add Screen Request 🎥",
    message: `${req.user.name} requested a new screen for a venue`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "ADD_SCREEN",
      requestId: request._id,
      venueId,
      partnerId: requestedBy,
    },
  },
])

    const populated = await VenueRequest.findById(request._id)
      .populate("requestedBy", "name email role")

    res.status(201).json({
      message: "Add screen request submitted successfully",
      request: formatRequest(populated),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Partner: delete screen request ───────────────────────────────────────────
export const createDeleteScreenRequest = async (req, res) => {
  try {
    const requestedBy = getUserId(req)
    const { venueId, screenId } = req.params

    const venue = await Venue.findOne({ _id: venueId, isActive: true })
    if (!venue) return res.status(404).json({ message: "Venue not found" })

    if (!isVenueOwner(venue, requestedBy)) {
      return res.status(403).json({ message: "You can request changes only for your own theatre" })
    }

    const screen = venue.screens.find((s) => String(s._id) === String(screenId))
    if (!screen) return res.status(404).json({ message: "Screen not found" })

    if (venue.screens.length <= 1) {
      return res.status(400).json({
        message: "Cannot request delete for the last screen. Delete the theatre instead.",
      })
    }

    const request = await VenueRequest.create({
      requestType: "DELETE_SCREEN",
      venueId,
      screenId,
      requestedBy,
      payload: {
        screenId,
        screenName: screen.screenName,
      },
      approvalStatus: "PENDING",
    })

    await Notification.create([
  {
    title: "Add Screen Request 🎥",
    message: `${req.user.name} requested a new screen for a venue`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "ADD_SCREEN",
      requestId: request._id,
      venueId,
      partnerId: requestedBy,
    },
  },
  {
    title: "Add Screen Request 🎥",
    message: `${req.user.name} requested a new screen for a venue`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "ADD_SCREEN",
      requestId: request._id,
      venueId,
      partnerId: requestedBy,
    },
  },
])

    const populated = await VenueRequest.findById(request._id)
      .populate("requestedBy", "name email role")

    res.status(201).json({
      message: "Delete screen request submitted successfully",
      request: formatRequest(populated),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Partner: update seat layout request ──────────────────────────────────────
export const createSeatLayoutUpdateRequest = async (req, res) => {
  try {
    const requestedBy = getUserId(req)
    const { venueId, screenId } = req.params
    const { seatLayout } = req.body || {}

    const venue = await Venue.findOne({ _id: venueId, isActive: true })
    if (!venue) return res.status(404).json({ message: "Venue not found" })

    if (!isVenueOwner(venue, requestedBy)) {
      return res.status(403).json({ message: "You can request changes only for your own theatre" })
    }

    const screen = venue.screens.find((s) => String(s._id) === String(screenId))
    if (!screen) return res.status(404).json({ message: "Screen not found" })

    if (!Array.isArray(seatLayout)) {
      return res.status(400).json({ message: "seatLayout must be an array" })
    }

    const request = await VenueRequest.create({
      requestType: "UPDATE_SEAT_LAYOUT",
      venueId,
      screenId,
      requestedBy,
      payload: {
        screenId,
        seatLayout,
      },
      approvalStatus: "PENDING",
    })

    await Notification.create([
  {
    title: "Delete Screen Request ❌",
    message: `${req.user.name} requested screen deletion`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "DELETE_SCREEN",
      requestId: request._id,
      venueId,
      screenId,
      partnerId: requestedBy,
    },
  },
  {
    title: "Delete Screen Request ❌",
    message: `${req.user.name} requested screen deletion`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "DELETE_SCREEN",
      requestId: request._id,
      venueId,
      screenId,
      partnerId: requestedBy,
    },
  },
])

    const populated = await VenueRequest.findById(request._id)
      .populate("requestedBy", "name email role")

    res.status(201).json({
      message: "Seat layout update request submitted successfully",
      request: formatRequest(populated),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Partner: my requests ─────────────────────────────────────────────────────
export const getMyVenueRequests = async (req, res) => {
  try {
    const requestedBy = getUserId(req)

    const requests = await VenueRequest.find({ requestedBy })
      .populate("requestedBy", "name email role")
      .populate("reviewedBy", "name email role")
      .sort({ createdAt: -1 })

    res.json(requests.map(formatRequest))
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Admin/Super Admin: all requests ──────────────────────────────────────────
export const getAllVenueRequests = async (req, res) => {
  try {
    const requests = await VenueRequest.find({})
      .populate("requestedBy", "name email role")
      .populate("reviewedBy", "name email role")
      .populate("venueId", "name city area address")
      .sort({ createdAt: -1 })

    res.json(requests.map(formatRequest))
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Admin/Super Admin: approve request ───────────────────────────────────────
export const approveVenueRequest = async (req, res) => {
  try {
    const reviewerId = getUserId(req)
    const { requestId } = req.params
    const { adminNote = "Approved" } = req.body || {}

    const request = await VenueRequest.findById(requestId)
      .populate("requestedBy", "name email role")

    if (!request) {
      return res.status(404).json({ message: "Venue request not found" })
    }

    if (request.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: `Request already ${request.approvalStatus.toLowerCase()}` })
    }

    const requestedById = request.requestedBy?._id || request.requestedBy

    switch (request.requestType) {
      case "CREATE": {
        const payload = request.payload || {}
        const validationError = validateCreateOrUpdatePayload(payload)
        if (validationError) {
          return res.status(400).json({ message: validationError })
        }

        let screensData = []

        if (Array.isArray(payload.screens) && payload.screens.length > 0) {
          for (const sc of payload.screens) {
            if (!sc?.screenName || !sc?.totalSeats) continue
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
          const num = Number(payload.totalSeats)
          screensData.push({
            screenName: String(payload.screenName).trim(),
            totalSeats: num,
            seatLayout: generateSeatLayout(num),
          })
        }

        const totalSeatsAll = screensData.reduce((sum, sc) => sum + Number(sc.totalSeats || 0), 0)

        const venue = await Venue.create({
          name: String(payload.name).trim(),
          city: String(payload.city).trim(),
          area: payload.area?.trim?.() || "",
          address: String(payload.address).trim(),
          amenities: payload.amenities?.trim?.() || "",
          screenName: screensData[0].screenName,
          totalSeats: totalSeatsAll,
          seatLayout: screensData[0].seatLayout,
          screens: screensData,
          createdBy: requestedById,
          partnerId: requestedById,
          isActive: true,
        })

        await User.findByIdAndUpdate(requestedById, {
          $addToSet: { venueIds: venue._id },
        })

        request.venueId = venue._id
        break
      }

      case "UPDATE": {
        const venue = await Venue.findOne({
          _id: request.venueId,
          isActive: true,
        })

        if (!venue) {
          return res.status(404).json({ message: "Venue not found" })
        }

        ensurePartnerId(venue)

        if (!isVenueOwner(venue, requestedById)) {
          return res.status(403).json({ message: "Requester is not owner of this venue" })
        }

        const payload = request.payload || {}

        venue.name = payload.name ?? venue.name
        venue.city = payload.city ?? venue.city
        venue.area = payload.area ?? venue.area
        venue.address = payload.address ?? venue.address
        venue.amenities = payload.amenities ?? venue.amenities

        if (Array.isArray(payload.screens) && payload.screens.length > 0) {
          const updatedScreens = []

          for (const sc of payload.screens) {
            if (!sc?.screenName || !sc?.totalSeats) continue

            const num = Number(sc.totalSeats)
            if (!num || num < 1) continue

            const existingScreen = sc.id
              ? venue.screens.find((s) => String(s._id) === String(sc.id))
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
            venue.screens = updatedScreens
            venue.screenName = updatedScreens[0].screenName
            venue.totalSeats = updatedScreens.reduce((sum, sc) => sum + Number(sc.totalSeats || 0), 0)
            venue.seatLayout = updatedScreens[0].seatLayout
          }
        }

        await venue.save()
        break
      }

      case "DELETE": {
        const venue = await Venue.findOne({
          _id: request.venueId,
          isActive: true,
        })

        if (!venue) {
          return res.status(404).json({ message: "Venue not found" })
        }

        ensurePartnerId(venue)

        if (!isVenueOwner(venue, requestedById)) {
          return res.status(403).json({ message: "Requester is not owner of this venue" })
        }

        venue.isActive = false
        await venue.save()

        await User.findByIdAndUpdate(venue.createdBy, {
          $pull: { venueIds: venue._id },
        })

        break
      }

      case "ADD_SCREEN": {
        const venue = await Venue.findOne({
          _id: request.venueId,
          isActive: true,
        })

        if (!venue) {
          return res.status(404).json({ message: "Venue not found" })
        }

        ensurePartnerId(venue)

        if (!isVenueOwner(venue, requestedById)) {
          return res.status(403).json({ message: "Requester is not owner of this venue" })
        }

        const { screenName, totalSeats } = request.payload || {}

        const exists = venue.screens.some(
          (s) => s.screenName.toLowerCase() === String(screenName).toLowerCase()
        )
        if (exists) {
          return res.status(400).json({ message: `Screen "${screenName}" already exists` })
        }

        const seatLayout = generateSeatLayout(Number(totalSeats))

        venue.screens.push({
          screenName: String(screenName).trim(),
          totalSeats: Number(totalSeats),
          seatLayout,
        })

        venue.totalSeats = venue.screens.reduce((sum, sc) => sum + Number(sc.totalSeats || 0), 0)

        if (venue.screens.length > 0) {
          venue.screenName = venue.screens[0].screenName
          venue.seatLayout = venue.screens[0].seatLayout
        }

        await venue.save()
        break
      }

      case "DELETE_SCREEN": {
        const venue = await Venue.findOne({
          _id: request.venueId,
          isActive: true,
        })

        if (!venue) {
          return res.status(404).json({ message: "Venue not found" })
        }

        ensurePartnerId(venue)

        if (!isVenueOwner(venue, requestedById)) {
          return res.status(403).json({ message: "Requester is not owner of this venue" })
        }

        if (venue.screens.length <= 1) {
          return res.status(400).json({
            message: "Cannot delete the last screen. Delete the theatre instead.",
          })
        }

        const screenId = request.screenId || request.payload?.screenId

        const screenIndex = venue.screens.findIndex(
          (s) => String(s._id) === String(screenId)
        )

        if (screenIndex === -1) {
          return res.status(404).json({ message: "Screen not found" })
        }

        venue.screens.splice(screenIndex, 1)

        venue.totalSeats = venue.screens.reduce((sum, sc) => sum + Number(sc.totalSeats || 0), 0)

        if (venue.screens.length > 0) {
          venue.screenName = venue.screens[0].screenName
          venue.seatLayout = venue.screens[0].seatLayout
        }

        await venue.save()
        break
      }

      case "UPDATE_SEAT_LAYOUT": {
        const venue = await Venue.findOne({
          _id: request.venueId,
          isActive: true,
        })

        if (!venue) {
          return res.status(404).json({ message: "Venue not found" })
        }

        ensurePartnerId(venue)

        if (!isVenueOwner(venue, requestedById)) {
          return res.status(403).json({ message: "Requester is not owner of this venue" })
        }

        const screenId = request.screenId || request.payload?.screenId
        const seatLayout = request.payload?.seatLayout || []

        const screen = venue.screens.find(
          (s) => String(s._id) === String(screenId)
        )

        if (!screen) {
          return res.status(404).json({ message: "Screen not found" })
        }

        const flatLayout =
          Array.isArray(seatLayout) && seatLayout.length > 0 && seatLayout[0]?.row !== undefined
            ? groupedToFlat(seatLayout)
            : seatLayout

        screen.seatLayout = flatLayout
        screen.totalSeats = flatLayout.filter((s) => s.isActive !== false).length

        venue.totalSeats = venue.screens.reduce((sum, sc) => sum + Number(sc.totalSeats || 0), 0)

        if (venue.screens.length > 0) {
          venue.screenName = venue.screens[0].screenName
          venue.seatLayout = venue.screens[0].seatLayout
        }

        await venue.save()
        break
      }

      default:
        return res.status(400).json({ message: "Unsupported request type" })
    }

    request.approvalStatus = "APPROVED"
    request.reviewedBy = reviewerId
    request.reviewedAt = new Date()
    request.adminNote = adminNote

    await request.save()

    const populated = await VenueRequest.findById(request._id)
      .populate("requestedBy", "name email role")
      .populate("reviewedBy", "name email role")

    res.json({
      message: "Venue request approved successfully",
      request: formatRequest(populated),
    })
  } catch (error) {
    console.error("approveVenueRequest error:", error)
    res.status(500).json({ message: error.message })
  }
}

// ── Admin/Super Admin: reject request ────────────────────────────────────────
export const rejectVenueRequest = async (req, res) => {
  try {
    const reviewerId = getUserId(req)
    const { requestId } = req.params
    const { adminNote = "Rejected" } = req.body || {}

    const request = await VenueRequest.findById(requestId)
      .populate("requestedBy", "name email role")

    if (!request) {
      return res.status(404).json({ message: "Venue request not found" })
    }

    if (request.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: `Request already ${request.approvalStatus.toLowerCase()}` })
    }

    request.approvalStatus = "REJECTED"
    request.reviewedBy = reviewerId
    request.reviewedAt = new Date()
    request.adminNote = adminNote

    await request.save()

    const populated = await VenueRequest.findById(request._id)
      .populate("requestedBy", "name email role")
      .populate("reviewedBy", "name email role")

    res.json({
      message: "Venue request rejected successfully",
      request: formatRequest(populated),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// ── Optional: partner read current seat layout for request screen ────────────
export const getVenueRequestScreenSeatLayout = async (req, res) => {
  try {
    const requestedBy = getUserId(req)
    const { venueId, screenId } = req.params

    const venue = await Venue.findOne({
      _id: venueId,
      isActive: true,
    })

    if (!venue) return res.status(404).json({ message: "Venue not found" })

    if (!isVenueOwner(venue, requestedBy)) {
      return res.status(403).json({ message: "You can access only your own theatre" })
    }

    const screen = venue.screens.find((s) => String(s._id) === String(screenId))
    if (!screen) return res.status(404).json({ message: "Screen not found" })

    const groupedLayout = flatToGrouped(screen.seatLayout || [], screen.totalSeats)

    res.json({
      screenId: screen._id,
      screenName: screen.screenName,
      totalSeats: screen.totalSeats,
      seatLayout: groupedLayout,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}