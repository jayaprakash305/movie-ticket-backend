import nodemailer from "nodemailer";
import dns from "dns";

// Node.js v24 uses c-ares DNS resolver by default which can fail
// to resolve certain hostnames. Fall back to the system resolver order.
dns.setDefaultResultOrder("verbatim");

let transporter = null;

export const initMailer = async () => {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log("✅ Mail service ready");
  } catch (err) {
    console.warn("⚠️  Mail service verification failed (emails may not work):", err.message);
    // Don't crash the server — transporter is still usable; it will retry on send
  }
};

export const getMailer = () => {
  if (!transporter) {
    throw new Error("Mailer not initialized");
  }
  return transporter;
};