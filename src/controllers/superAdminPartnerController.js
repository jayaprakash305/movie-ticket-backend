import bcrypt from "bcryptjs"
import User from "../models/User.js"
import Venue from "../models/Venue.js"
import { sendEmail } from "../services/emailService.js"
import { partnerApprovedTemplate, partnerRejectedTemplate } from "../templates/partnerApprovalTemplate.js"

export const getPendingPartners = async (req, res) => {
  try {
    const partners = await User.find({
      role: "MANAGER",
      approvalStatus: "PENDING",
    })
      .sort({ createdAt: -1 })
      .select("-password")
      .populate("approvedBy", "name email role")

    res.json(partners)
  } catch (error) {
    console.error("getPendingPartners error:", error)
    res.status(500).json({ message: error.message })
  }
}

export const getAllPartners = async (req, res) => {
  try {
    const { status } = req.query

    const filter = { role: "MANAGER" }

    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      filter.approvalStatus = status
    }

    const partners = await User.find(filter)
      .sort({ createdAt: -1 })
      .select("-password")
      .populate("approvedBy", "name email role")

    const partnerIds = partners.map((p) => p._id)

    const venues = await Venue.find({
      createdBy: { $in: partnerIds },
      isActive: true,
    }).select("name city area createdBy")

    const venueMap = new Map()

    for (const venue of venues) {
      const key = String(venue.createdBy)
      if (!venueMap.has(key)) {
        venueMap.set(key, [])
      }
      venueMap.get(key).push({
        id: String(venue._id),
        name: venue.name || "",
        city: venue.city || "",
        area: venue.area || "",
      })
    }

    const result = partners.map((partner) => ({
      ...partner.toObject(),
      theatres: venueMap.get(String(partner._id)) || [],
      theatreCount: (venueMap.get(String(partner._id)) || []).length,
    }))

    res.json(result)
  } catch (error) {
    console.error("getAllPartners error:", error)
    res.status(500).json({ message: error.message })
  }
}

export const approvePartner = async (req, res) => {
  try {
    const { id } = req.params

    const partner = await User.findOne({
      _id: id,
      role: "MANAGER",
    })

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" })
    }

    if (partner.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: `Partner is already ${partner.approvalStatus.toLowerCase()}` })
    }

    partner.approvalStatus = "APPROVED"
    partner.approvedBy = req.user.id
    partner.approvedAt = new Date()
    partner.rejectionReason = ""

    await partner.save()

     // send approval mail
    try {
      await sendEmail({
        to: partner.email,
        subject: "Your partner account has been approved ✅",
        html: partnerApprovedTemplate({
          name: partner.name,
        }),
      });
    } catch (mailError) {
      console.error("Partner approval email failed:", mailError.message);
    }

    res.json({
      message: "Partner approved successfully",
      id: String(partner._id),
      approvalStatus: partner.approvalStatus,
    })
  } catch (error) {
    console.error("approvePartner error:", error)
    res.status(500).json({ message: error.message })
  }
}

export const rejectPartner = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const partner = await User.findOne({
      _id: id,
      role: "MANAGER",
    })

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" })
    }

    if (partner.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: `Partner is already ${partner.approvalStatus.toLowerCase()}` })
    }

    partner.approvalStatus = "REJECTED"
    partner.approvedBy = req.user.id
    partner.approvedAt = new Date()
    partner.rejectionReason = reason || ""

    await partner.save()

    // send rejection mail
    try {
      await sendEmail({
        to: partner.email,
        subject: "Your partner account request was rejected ❌",
        html: partnerRejectedTemplate({
          name: partner.name,
          reason: partner.rejectionReason,
        }),
      });
    } catch (mailError) {
      console.error("Partner rejection email failed:", mailError.message);
    }

    res.json({
      message: "Partner rejected successfully",
      id: String(partner._id),
      approvalStatus: partner.approvalStatus,
    })
  } catch (error) {
    console.error("rejectPartner error:", error)
    res.status(500).json({ message: error.message })
  }
}

export const createPartnerBySuperAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email",
      })
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10)

    const partner = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "MANAGER",
      partnerId: null,
      venueIds: [],
      isActive: true,
      isBanned: false,
      approvalStatus: "APPROVED",
      approvedBy: req.user.id,
      approvedAt: new Date(),
      rejectionReason: "",
    })

    res.status(201).json({
      message: "Partner created successfully",
      partner: {
        id: String(partner._id),
        name: partner.name,
        email: partner.email,
        role: partner.role,
        approvalStatus: partner.approvalStatus,
        approvedBy: partner.approvedBy,
        approvedAt: partner.approvedAt,
        isActive: partner.isActive,
        isBanned: partner.isBanned,
        createdAt: partner.createdAt,
      },
    })
  } catch (error) {
    console.error("createPartnerBySuperAdmin error:", error)
    res.status(500).json({ message: error.message })
  }
}