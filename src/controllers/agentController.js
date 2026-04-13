import bcrypt from "bcryptjs"
import Booking from "../models/Booking.js"
import Show from "../models/Show.js"
import Venue from "../models/Venue.js"
import User from "../models/User.js"
import Movie from "../models/Movie.js"
import Notification from "../models/Notification.js"

// ── Create Agent ─────────────────────────────────────────────────────────────
export const createAgent = async (req, res) => {
  try {
    const partnerId = req.user.id
    const { name, email, password, venueIds = [] } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" })
    }

    let existingUser = await User.findOne({ email: email.trim().toLowerCase() })
    if (existingUser) {
      if (existingUser.role === "AGENT" && existingUser.approvalStatus === "REJECTED") {
        await User.findByIdAndDelete(existingUser._id)
      } else {
        return res.status(400).json({ message: "User already exists with this email" })
      }
    }

    if (Array.isArray(venueIds) && venueIds.length > 0) {
      const venues = await Venue.find({
        _id: { $in: venueIds },
        createdBy: partnerId,
      })

      if (venues.length !== venueIds.length) {
        return res.status(400).json({
          message: "One or more venues are invalid or not owned by this partner",
        })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const agent = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: "AGENT",
      partnerId,
      venueIds,
      isActive: false,
      isBanned: false,
      approvalStatus: "PENDING",
      approvedBy: null,
      approvedAt: null,
      rejectionReason: "",
    })

    await Notification.create([
  {
    title: "New Agent Request 👤",
    message: `${req.user.name} created an agent request for approval`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "AGENT_CREATE",
      agentId: agent._id,
      partnerId,
    },
  },
  {
    title: "New Agent Request 👤",
    message: `${req.user.name} created an agent request for approval`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "AGENT_CREATE",
      agentId: agent._id,
      partnerId,
    },
  },
])

    res.status(201).json({
      message: "Agent request created successfully. Waiting for admin approval.",
      agent: {
        _id: agent._id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        partnerId: agent.partnerId,
        venueIds: agent.venueIds,
        isActive: agent.isActive,
        isBanned: agent.isBanned,
        approvalStatus: agent.approvalStatus,
        createdAt: agent.createdAt,
      },
    })
  } catch (error) {
    console.error("createAgent error:", error)
    res.status(500).json({ message: error.message })
  }
}
// ── Get Partner Agents ───────────────────────────────────────────────────────
export const getPartnerAgents = async (req, res) => {
  try {
    const partnerId = req.user.id

    const agents = await User.find({
      role: "AGENT",
      partnerId,
    })
      .select("-password")
      .populate("venueIds", "name location city")
      .sort({ createdAt: -1 })

    res.json({
      agents,
    })
  } catch (error) {
    console.error("getPartnerAgents error:", error)
    res.status(500).json({ message: error.message })
  }
}

// ── Update Agent ─────────────────────────────────────────────────────────────
export const updateAgent = async (req, res) => {
  try {
    const partnerId = req.user.id
    const { id } = req.params
    const { name, email, password, venueIds } = req.body

    const agent = await User.findOne({
      _id: id,
      role: "AGENT",
      partnerId,
    })

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" })
    }

    if (name !== undefined) {
      agent.name = name.trim()
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase()

      const existingEmailUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: agent._id },
      })

      if (existingEmailUser) {
        return res.status(400).json({ message: "Email already in use" })
      }

      agent.email = normalizedEmail
    }

    if (password !== undefined && password.trim()) {
      agent.password = await bcrypt.hash(password.trim(), 10)
    }

    if (venueIds !== undefined) {
      if (!Array.isArray(venueIds)) {
        return res.status(400).json({ message: "venueIds must be an array" })
      }

      if (venueIds.length > 0) {
        const venues = await Venue.find({
          _id: { $in: venueIds },
          createdBy: partnerId,
        })

        if (venues.length !== venueIds.length) {
          return res.status(400).json({
            message: "One or more venues are invalid or not owned by this partner",
          })
        }
      }

      agent.venueIds = venueIds
    }

    await agent.save()

    const updatedAgent = await User.findById(agent._id)
      .select("-password")
      .populate("venueIds", "name location city")

    res.json({
      message: "Agent updated successfully",
      agent: updatedAgent,
    })
  } catch (error) {
    console.error("updateAgent error:", error)
    res.status(500).json({ message: error.message })
  }
}

// ── Toggle Agent Status ──────────────────────────────────────────────────────
export const requestAgentStatusChange = async (req, res) => {
  try {
    const partnerId = req.user.id
    const { id } = req.params

    const agent = await User.findOne({
      _id: id,
      role: "AGENT",
      partnerId,
    })

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" })
    }

    if (agent.approvalStatus !== "APPROVED") {
      return res.status(403).json({
        message: "Only approved agents can have activation status requests",
      })
    }

    const requestedAction = agent.isActive ? "DEACTIVATE" : "ACTIVATE"

    agent.statusChangeRequest = requestedAction
    agent.statusChangeRequestedAt = new Date()
    agent.statusChangeRequestedBy = req.user.id

    await agent.save()

  await Notification.create([
  {
    title: "Agent Status Change Request 🔄",
    message: `${req.user.name} requested to ${requestedAction.toLowerCase()} agent ${agent.name}`,
    type: "APPROVAL",
    receiverRole: "ADMIN",
    meta: {
      requestType: "AGENT_STATUS_CHANGE",
      agentId: agent._id,
      partnerId,
      requestedAction,
    },
  },
  {
    title: "Agent Status Change Request 🔄",
    message: `${req.user.name} requested to ${requestedAction.toLowerCase()} agent ${agent.name}`,
    type: "APPROVAL",
    receiverRole: "SUPER_ADMIN",
    meta: {
      requestType: "AGENT_STATUS_CHANGE",
      agentId: agent._id,
      partnerId,
      requestedAction,
    },
  },
])
    res.json({
      message: `Agent ${requestedAction.toLowerCase()} request sent for admin approval`,
      agent: {
        _id: agent._id,
        name: agent.name,
        email: agent.email,
        isActive: agent.isActive,
        statusChangeRequest: agent.statusChangeRequest,
        statusChangeRequestedAt: agent.statusChangeRequestedAt,
      },
    })

  } catch (error) {
    console.error("requestAgentStatusChange error:", error)
    res.status(500).json({ message: error.message })
  }
}
// ── Create Offline Booking ───────────────────────────────────────────────────
export const createOfflineBooking = async (req, res) => {
  try {
    const loggedInUserId = req.user.id
    const loggedInRole = req.user.role

    const {
      showId,
      venueId,
      seats = [],
      totalAmount,
      customerName = "",
      customerPhone = "",
      paymentMethod = "CASH",
    } = req.body

    if (!showId || !venueId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({
        message: "showId, venueId and at least one seat are required",
      })
    }

    const loggedInUser = await User.findById(loggedInUserId)
    if (!loggedInUser) {
      return res.status(401).json({ message: "User not found" })
    }

    if (loggedInUser.isBanned) {
      return res.status(403).json({ message: "Your account is banned" })
    }

    if (loggedInRole === "AGENT" && !loggedInUser.isActive) {
      return res.status(403).json({ message: "Agent account is inactive" })
    }

    const show = await Show.findById(showId)
    if (!show) {
      return res.status(404).json({ message: "Show not found" })
    }

    const venue = await Venue.findById(venueId)
    if (!venue) {
      return res.status(404).json({ message: "Venue not found" })
    }

    // show and venue match check
    if (String(show.venueId) !== String(venueId)) {
      return res.status(400).json({ message: "Show does not belong to the selected venue" })
    }

    // permission check
    if (loggedInRole === "MANAGER") {
      if (String(show.createdBy) !== String(loggedInUserId)) {
        return res.status(403).json({ message: "You can create bookings only for your own shows" })
      }
    }

    if (loggedInRole === "AGENT") {
      if (!loggedInUser.partnerId) {
        return res.status(403).json({ message: "Agent is not linked to a partner" })
      }

      if (String(show.createdBy) !== String(loggedInUser.partnerId)) {
        return res.status(403).json({ message: "You can create bookings only for your partner's shows" })
      }

      if (
        Array.isArray(loggedInUser.venueIds) &&
        loggedInUser.venueIds.length > 0 &&
        !loggedInUser.venueIds.some((id) => String(id) === String(venueId))
      ) {
        return res.status(403).json({
          message: "You are not assigned to this venue",
        })
      }
    }

    if (!["MANAGER", "AGENT", "ADMIN", "SUPER_ADMIN"].includes(loggedInRole)) {
      return res.status(403).json({ message: "Not allowed to create offline booking" })
    }

    // check already booked seats
    const existingBookings = await Booking.find({
      showId,
      status: { $ne: "CANCELLED" },
      seats: { $in: seats },
    })

    if (existingBookings.length > 0) {
      const alreadyBookedSeats = [
        ...new Set(existingBookings.flatMap((b) => b.seats || []).filter((s) => seats.includes(s))),
      ]

      return res.status(400).json({
        message: "Some seats are already booked",
        seats: alreadyBookedSeats,
      })
    }

    const normalizedPaymentMethod = ["CASH", "UPI", "CARD", "ONLINE"].includes(paymentMethod)
      ? paymentMethod
      : "CASH"

    const booking = await Booking.create({
      userId: null,
      showId,
      venueId,
      seats,
      totalAmount: Number(totalAmount) || 0,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      source: "OFFLINE",
      bookedBy: loggedInUserId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod: normalizedPaymentMethod,
      lockExpiresAt: null,
    })

    res.status(201).json({
      message: "Offline booking created successfully",
      booking,
    })
  } catch (error) {
    console.error("createOfflineBooking error:", error)
    res.status(500).json({ message: error.message })
  }
}
//--------------------------------agent dashboard------------//

export const getAgentDashboard = async (req, res) => {
  try {
    const agentId = req.user.id

    const agent = await User.findById(agentId)
      .select("name email role isActive partnerId venueIds createdAt")
      .populate("venueIds", "name city area")
      .populate("partnerId", "name email")

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" })
    }

    const bookings = await Booking.find({
      bookedBy: agentId,
      status: "CONFIRMED",
      source: "OFFLINE",
    }).sort({ createdAt: -1 })

    const today = new Date().toISOString().slice(0, 10)

    const totalBookings = bookings.length

    const todayBookings = bookings.filter(
      (b) => new Date(b.createdAt).toISOString().slice(0, 10) === today
    ).length

    const totalRevenue = bookings.reduce(
      (sum, b) => sum + (Number(b.totalAmount) || 0),
      0
    )

    const recentBookings = bookings.slice(0, 5)

    res.json({
      agent: {
        id: String(agent._id),
        name: agent.name || "",
        email: agent.email || "",
        role: agent.role || "AGENT",
        isActive: agent.isActive,
        createdAt: agent.createdAt,
        partner: agent.partnerId
          ? {
              id: String(agent.partnerId._id),
              name: agent.partnerId.name || "",
              email: agent.partnerId.email || "",
            }
          : null,
        venues: Array.isArray(agent.venueIds)
          ? agent.venueIds.map((v) => ({
              id: String(v._id),
              name: v.name || "",
              city: v.city || "",
              area: v.area || "",
            }))
          : [],
      },

      stats: {
        totalBookings,
        todayBookings,
        totalRevenue,
      },

      recentBookings,
    })
  } catch (error) {
    console.error("getAgentDashboard error:", error)
    res.status(500).json({ message: error.message })
  }
}

//----------------agentbookings-------------------
export const getMyAgentBookings = async (req, res) => {
  try {
    const agentId = req.user.id

    const bookings = await Booking.find({
      bookedBy: agentId,
      source: "OFFLINE",
    }).sort({ createdAt: -1 })

    // ── Collect IDs ─────────────────────────────
    const showIds = [...new Set(bookings.map((b) => String(b.showId)))]
    const venueIds = [...new Set(bookings.map((b) => String(b.venueId)))]

    const shows = await Show.find({ _id: { $in: showIds } })
    const venues = await Venue.find({ _id: { $in: venueIds } })

    const movieIds = [...new Set(shows.map((s) => String(s.movieId)))]
    const movies = await Movie.find({ _id: { $in: movieIds } })

    // ── Maps ───────────────────────────────────
    const showMap = new Map(shows.map((s) => [String(s._id), s]))
    const venueMap = new Map(venues.map((v) => [String(v._id), v]))
    const movieMap = new Map(movies.map((m) => [String(m._id), m]))

    // ── Final result ───────────────────────────
    const result = bookings.map((booking) => {
      const show = showMap.get(String(booking.showId))
      const venue = venueMap.get(String(booking.venueId))
      const movie = show ? movieMap.get(String(show.movieId)) : null

      return {
        id: String(booking._id),
        bookingCode: booking.bookingCode,

        // 🎬 NEW
        movieTitle: movie?.title || "Unknown Movie",
        venueName: venue?.name || "Unknown Venue",
        showDate: show?.showDate || "",
        showTime: show?.showTime || "",

        customerName: booking.customerName || "Walk-in Customer",
        customerPhone: booking.customerPhone || "",
        seats: booking.seats || [],
        totalAmount: Number(booking.totalAmount) || 0,
        status: booking.status || "PENDING",
        paymentStatus: booking.paymentStatus || "PENDING",
        paymentMethod: booking.paymentMethod || "",

        createdAt: booking.createdAt,
      }
    })

    res.json(result)
  } catch (error) {
    console.error("getMyAgentBookings error:", error)
    res.status(500).json({ message: error.message })
  }
}


// ── Get Agent Venues ───────────────────────────────────────────────────────
export const getAgentVenues = async (req, res) => {
  try {
    const loggedInUserId = req.user.id
    const loggedInRole = req.user.role

    const loggedInUser = await User.findById(loggedInUserId)
    if (!loggedInUser) {
      return res.status(404).json({ message: "User not found" })  
    }

    let venues = []

    // AGENT → only assigned venues if present, else partner venues
    if (loggedInRole === "AGENT") {
      if (!loggedInUser.partnerId) {
        return res.status(403).json({ message: "Agent is not linked to a partner" })
      }

      if (Array.isArray(loggedInUser.venueIds) && loggedInUser.venueIds.length > 0) {
        venues = await Venue.find({
          _id: { $in: loggedInUser.venueIds },
          isActive: true,
        }).sort({ createdAt: -1 })
      } else {
        venues = await Venue.find({
          createdBy: loggedInUser.partnerId,
          isActive: true,
        }).sort({ createdAt: -1 })
      }
    }

    // MANAGER / ADMIN / SUPER_ADMIN → own venues
    else if (["MANAGER", "ADMIN", "SUPER_ADMIN"].includes(loggedInRole)) {
      venues = await Venue.find({
        createdBy: loggedInUserId,
        isActive: true,
      }).sort({ createdAt: -1 })
    }

    else {
      return res.status(403).json({ message: "Not allowed to access venues" })
    }

    res.json(
      venues.map((venue) => ({
        id: String(venue._id),
        name: venue.name || "",
        city: venue.city || "",
        area: venue.area || "",
        address: venue.address || "",
        screensCount: Array.isArray(venue.screens) ? venue.screens.length : 0,
        totalSeats:
          Array.isArray(venue.screens) && venue.screens.length > 0
            ? venue.screens.reduce((sum, screen) => sum + (Number(screen.totalSeats) || 0), 0)
            : Array.isArray(venue.seatLayout)
            ? venue.seatLayout.length
            : 0,
      }))
    )
  } catch (error) {
    console.error("getAgentVenues error:", error)
    res.status(500).json({ message: error.message })
  }
}


export const getAgentShows = async (req, res) => {
  try {
    const loggedInUserId = req.user.id
    const loggedInRole = req.user.role

    const loggedInUser = await User.findById(loggedInUserId)
    if (!loggedInUser) {
      return res.status(404).json({ message: "User not found" })
    }

    let ownerId = loggedInUserId

    if (loggedInRole === "AGENT") {
      if (!loggedInUser.partnerId) {
        return res.status(403).json({ message: "Agent is not linked to a partner" })
      }
      ownerId = loggedInUser.partnerId
    }

    const today = new Date().toISOString().slice(0, 10)

    const query = {
      createdBy: ownerId,
      isActive: true,
      showDate: { $gte: today },
    }

    if (
      loggedInRole === "AGENT" &&
      Array.isArray(loggedInUser.venueIds) &&
      loggedInUser.venueIds.length > 0
    ) {
      query.venueId = { $in: loggedInUser.venueIds }
    }

    const shows = await Show.find(query)
      .populate("movieId", "title posterUrl duration genre language")
      .populate("venueId", "name city area")
      .sort({ showDate: 1, showTime: 1 })

    res.json(
      shows.map((s) => ({
        id: String(s._id),
        movieId: String(s.movieId?._id || s.movieId || ""),
        movie: s.movieId
          ? {
              id: String(s.movieId._id),
              title: s.movieId.title,
              posterUrl: s.movieId.posterUrl,
              duration: s.movieId.duration,
              genre: s.movieId.genre,
              language: s.movieId.language,
            }
          : null,
        venueId: String(s.venueId?._id || s.venueId || ""),
        venue: s.venueId
          ? {
              id: String(s.venueId._id),
              name: s.venueId.name,
              city: s.venueId.city,
              area: s.venueId.area,
            }
          : null,
        screenId: s.screenId ? String(s.screenId) : null,
        screenName: s.screenName || "",
        showDate: s.showDate,
        showTime: s.showTime,
        showEndTime: s.showEndTime || null,
        price: s.price,
        totalSeats: s.totalSeats,
        availableSeats: s.availableSeats,
        isActive: s.isActive,
      }))
    )
  } catch (error) {
    console.error("getAgentShows error:", error)
    res.status(500).json({ message: error.message })
  }
}