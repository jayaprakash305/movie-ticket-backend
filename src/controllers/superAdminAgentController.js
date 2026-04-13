import bcrypt from "bcryptjs"
import User from "../models/User.js"
import Venue from "../models/Venue.js"
import Notification from "../models/Notification.js"

export const getPendingAgents = async (req, res) => {
  try {
    const agents = await User.find({
      role: "AGENT",
      approvalStatus: "PENDING",
    })
      .select("-password")
      .populate("partnerId", "name email")
      .populate("venueIds", "name city area")
      .sort({ createdAt: -1 })

    const result = agents.map((agent) => ({
      ...agent.toObject(),
      theatres: Array.isArray(agent.venueIds)
        ? agent.venueIds.map((v) => ({
            id: String(v._id),
            name: v.name || "",
            city: v.city || "",
            area: v.area || "",
          }))
        : [],
      theatreCount: Array.isArray(agent.venueIds) ? agent.venueIds.length : 0,
    }))

    res.json(result)
  } catch (error) {
    console.error("getPendingAgents error:", error)
    res.status(500).json({ message: error.message })
  }
}

export const getAllAgentsForApproval = async (req, res) => {
  try {
    const { status } = req.query

    const filter = { role: "AGENT" }

    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      filter.approvalStatus = status
    }

    const agents = await User.find(filter)
      .select("-password")
      .populate("partnerId", "name email")
      .populate("venueIds", "name city area")
      .populate("approvedBy", "name email role")
      .sort({ createdAt: -1 })

    const partnerIds = [
      ...new Set(
        agents
          .map((a) => a.partnerId?._id || a.partnerId)
          .filter(Boolean)
          .map((id) => String(id))
      ),
    ]

    const partnerVenues = await Venue.find({
      createdBy: { $in: partnerIds },
      isActive: true,
    }).select("name city area createdBy")

    const partnerVenueMap = new Map()

    for (const venue of partnerVenues) {
      const key = String(venue.createdBy)
      if (!partnerVenueMap.has(key)) {
        partnerVenueMap.set(key, [])
      }

      partnerVenueMap.get(key).push({
        id: String(venue._id),
        name: venue.name || "",
        city: venue.city || "",
        area: venue.area || "",
      })
    }

    const result = agents.map((agent) => {
      const assignedVenues = Array.isArray(agent.venueIds)
        ? agent.venueIds.map((v) => ({
            id: String(v._id),
            name: v.name || "",
            city: v.city || "",
            area: v.area || "",
          }))
        : []

      const fallbackPartnerVenues =
        partnerVenueMap.get(String(agent.partnerId?._id || agent.partnerId)) || []

      const theatres =
        assignedVenues.length > 0 ? assignedVenues : fallbackPartnerVenues

      return {
        ...agent.toObject(),
        theatres,
        theatreCount: theatres.length,
      }
    })

    res.json(result)
  } catch (error) {
    console.error("getAllAgentsForApproval error:", error)
    res.status(500).json({ message: error.message })
  }
}

export const approveAgent = async (req, res) => {
  try {
    const { id } = req.params

    const agent = await User.findOne({
      _id: id,
      role: "AGENT",
    })

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" })
    }

    if (agent.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: `Agent is already ${agent.approvalStatus.toLowerCase()}` })
    }

    agent.approvalStatus = "APPROVED"
    agent.approvedBy = req.user.id
    agent.approvedAt = new Date()
    agent.rejectionReason = ""
    agent.isActive = true

    await agent.save()

    await Notification.create({
  title: "Agent Approved ✅",
  message: `Your agent ${agent.name} has been approved successfully`,
  type: "APPROVAL",
  receiverId: agent.partnerId,
  meta: {
    requestType: "AGENT_CREATE",
    agentId: agent._id,
    approvalStatus: "APPROVED",
  },
})

    res.json({
      message: "Agent approved successfully",
      id: String(agent._id),
      approvalStatus: agent.approvalStatus,
      isActive: agent.isActive,
    })
  } catch (error) {
    console.error("approveAgent error:", error)
    res.status(500).json({ message: error.message })
  }
}

export const rejectAgent = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const agent = await User.findOne({
      _id: id,
      role: "AGENT",
    })

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" })
    }

    if (agent.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: `Agent is already ${agent.approvalStatus.toLowerCase()}` })
    }

    agent.approvalStatus = "REJECTED"
    agent.approvedBy = req.user.id
    agent.approvedAt = new Date()
    agent.rejectionReason = reason || ""
    agent.isActive = false

    await agent.save()

    await Notification.create({
  title: "Agent Rejected ❌",
  message: `Your agent ${agent.name} was rejected${reason ? `: ${reason}` : ""}`,
  type: "APPROVAL",
  receiverId: agent.partnerId,
  meta: {
    requestType: "AGENT_CREATE",
    agentId: agent._id,
    approvalStatus: "REJECTED",
  },
})

    res.json({
      message: "Agent rejected successfully",
      id: String(agent._id),
      approvalStatus: agent.approvalStatus,
      isActive: agent.isActive,
    })
  } catch (error) {
    console.error("rejectAgent error:", error)
    res.status(500).json({ message: error.message })
  }
}

export const createAgentBySuperAdmin = async (req, res) => {
  try {
    const { name, email, password, partnerId, venueIds = [] } = req.body

    if (!name || !email || !password || !partnerId) {
      return res.status(400).json({
        message: "Name, email, password and partnerId are required",
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    let existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      if (existingUser.role === "AGENT" && existingUser.approvalStatus === "REJECTED") {
        await User.findByIdAndDelete(existingUser._id)
      } else {
        return res.status(400).json({
          message: "User already exists with this email",
        })
      }
    }

    const partner = await User.findOne({
      _id: partnerId,
      role: "MANAGER",
      approvalStatus: "APPROVED",
    })

    if (!partner) {
      return res.status(400).json({
        message: "Valid approved partner not found",
      })
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

    const hashedPassword = await bcrypt.hash(password.trim(), 10)

    const agent = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "AGENT",
      partnerId,
      venueIds,
      isActive: true,
      isBanned: false,
      approvalStatus: "APPROVED",
      approvedBy: req.user.id,
      approvedAt: new Date(),
      rejectionReason: "",
    })

    const createdAgent = await User.findById(agent._id)
      .select("-password")
      .populate("partnerId", "name email")
      .populate("venueIds", "name city area")

    res.status(201).json({
      message: "Agent created successfully",
      agent: createdAgent,
    })
  } catch (error) {
    console.error("createAgentBySuperAdmin error:", error)
    res.status(500).json({ message: error.message })
  }
}

//----------------active or deactive agent ------------

export const getAgentStatusChangeRequests = async (req, res) => {
  try {
    const agents = await User.find({
      role: "AGENT",
      statusChangeRequest: { $in: ["ACTIVATE", "DEACTIVATE"] },
    })
      .select("-password")
      .populate("partnerId", "name email")
      .populate("statusChangeRequestedBy", "name email role")
      .populate("venueIds", "name city area")
      .sort({ statusChangeRequestedAt: -1 })

    const result = agents.map((agent) => ({
      ...agent.toObject(),
      theatres: Array.isArray(agent.venueIds)
        ? agent.venueIds.map((v) => ({
            id: String(v._id),
            name: v.name || "",
            city: v.city || "",
            area: v.area || "",
          }))
        : [],
      theatreCount: Array.isArray(agent.venueIds) ? agent.venueIds.length : 0,
    }))

    res.json(result)
  } catch (error) {
    console.error("getAgentStatusChangeRequests error:", error)
    res.status(500).json({ message: error.message })
  }
}
export const approveAgentStatusChange = async (req, res) => {
  try {
    const { id } = req.params

    const agent = await User.findOne({
      _id: id,
      role: "AGENT",
    })

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" })
    }

    if (!["ACTIVATE", "DEACTIVATE"].includes(agent.statusChangeRequest)) {
      return res.status(400).json({ message: "No pending status change request" })
    }

    agent.isActive = agent.statusChangeRequest === "ACTIVATE"
    agent.statusChangeRequest = "NONE"
    agent.statusChangeRequestedAt = null
    agent.statusChangeRequestedBy = null
    agent.approvedBy = req.user.id
    agent.approvedAt = new Date()

    await agent.save()

    await Notification.create({
  title: "Agent Status Request Approved ✅",
  message: `Your request to ${agent.statusChangeRequest.toLowerCase()} agent ${agent.name} has been approved`,
  type: "APPROVAL",
  receiverId: agent.partnerId,
  meta: {
    requestType: "AGENT_STATUS_CHANGE",
    agentId: agent._id,
    approvedAction: agent.statusChangeRequest,
    approvalStatus: "APPROVED",
  },
})

    res.json({
      message: `Agent ${agent.isActive ? "activated" : "deactivated"} successfully`,
      agent: {
        _id: agent._id,
        isActive: agent.isActive,
        statusChangeRequest: agent.statusChangeRequest,
      },
    })
  } catch (error) {
    console.error("approveAgentStatusChange error:", error)
    res.status(500).json({ message: error.message })
  }
}

export const rejectAgentStatusChange = async (req, res) => {
  try {
    const { id } = req.params

    const agent = await User.findOne({
      _id: id,
      role: "AGENT",
    })

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" })
    }

    if (!["ACTIVATE", "DEACTIVATE"].includes(agent.statusChangeRequest)) {
      return res.status(400).json({ message: "No pending status change request" })
    }

    agent.statusChangeRequest = "NONE"
    agent.statusChangeRequestedAt = null
    agent.statusChangeRequestedBy = null

    await agent.save()

    await Notification.create({
  title: "Agent Status Request Rejected ❌",
  message: `Your request for agent ${agent.name} was rejected${req.body?.reason ? `: ${req.body.reason}` : ""}`,
  type: "APPROVAL",
  receiverId: agent.partnerId,
  meta: {
    requestType: "AGENT_STATUS_CHANGE",
    agentId: agent._id,
    approvalStatus: "REJECTED",
  },
})

    res.json({
      message: "Agent status change request rejected",
      agent: {
        _id: agent._id,
        isActive: agent.isActive,
        statusChangeRequest: agent.statusChangeRequest,
      },
    })
  } catch (error) {
    console.error("rejectAgentStatusChange error:", error)
    res.status(500).json({ message: error.message })
  }
}