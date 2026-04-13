import { getMailer } from "../config/mail.js";

export const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getMailer();

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  
  return info;
};