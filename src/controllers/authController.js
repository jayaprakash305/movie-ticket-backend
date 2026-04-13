import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import { sendEmail } from "../services/emailService.js";
import { welcomeTemplate, partnerWelcomeTemplate } from "../templates/welcomeTemplate.js";
import { forgotPasswordOtpTemplate } from "../templates/forgotPasswordTemplate.js";

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "USER",
      approvalStatus: "APPROVED",
    });

    // Send welcome email after successful registration
    try {
      const previewUrl = await sendEmail({
        to: user.email,
        subject: "Welcome to Movie Booking 🎉",
        html: welcomeTemplate(user.name),
      });

      console.log("User welcome mail preview:", previewUrl);
    } catch (mailError) {
      console.error("Welcome email failed:", mailError.message);
    }


    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const partnerRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "MANAGER",
      approvalStatus: "PENDING",
    });

    try {
      const previewUrl = await sendEmail({
        to: user.email,
        subject: "Partner Registration Received 🎭",
        html: partnerWelcomeTemplate(user.name),
      });

      console.log("Partner welcome mail preview:", previewUrl);
    } catch (mailError) {
      console.error("Partner welcome email failed:", mailError.message);
    }

    res.status(201).json({
      message: "Partner registered successfully. Waiting for admin approval.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: "Your account has been banned" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // partner approval check
    if (["MANAGER", "AGENT"].includes(user.role)) {
      if (user.approvalStatus === "PENDING") {
        return res.status(403).json({
          message: "Your account is waiting for admin approval",
        })
      }

      if (user.approvalStatus === "REJECTED") {
        return res.status(403).json({
          message: user.rejectionReason
            ? `Your account was rejected: ${user.rejectionReason}`
            : "Your account was rejected. Contact admin.",
        })
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account is inactive" })
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
        ...(user.role === "ADMIN" && { permissions: user.permissions || {} }),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//-----forgotpassword

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    // do not reveal whether user exists or not
    if (!user) {
      return res.status(200).json({
        message: "If an account exists with this email, an OTP has been sent",
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    user.resetOtp = otp;
    user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "Your password reset OTP",
        html: forgotPasswordOtpTemplate({
          name: user.name,
          otp,
        }),
      });
    } catch (mailError) {
      console.error("Forgot password OTP email failed:", mailError.message);
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    return res.status(200).json({
      message: "If an account exists with this email, an OTP has been sent",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


//---reset password


export const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        message: "Email, OTP and new password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "Invalid request" });
    }

    if (!user.resetOtp || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: "No reset request found" });
    }

    if (user.resetOtp !== otp.trim()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.resetOtpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetOtp = null;
    user.resetOtpExpiresAt = null;

    await user.save();

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};