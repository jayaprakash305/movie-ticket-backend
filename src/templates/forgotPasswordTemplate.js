export const forgotPasswordOtpTemplate = ({ name, otp }) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Password Reset OTP 🔐</h2>
      <p>Hello ${name},</p>
      <p>We received a request to reset your password.</p>
      <p>Your OTP is:</p>
      <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 20px 0;">
        ${otp}
      </div>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;
};