export const partnerApprovedTemplate = ({ name }) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Partner Account Approved ✅</h2>
      <p>Hello ${name},</p>
      <p>Your partner account has been approved successfully.</p>
      <p>You can now log in and access the partner dashboard.</p>
      <p>Welcome to the Movie Booking platform 🎬</p>
    </div>
  `;
};

export const partnerRejectedTemplate = ({ name, reason }) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Partner Account Rejected ❌</h2>
      <p>Hello ${name},</p>
      <p>We’re sorry to inform you that your partner account request has been rejected.</p>
      <p><strong>Admin / Super Admin Note:</strong></p>
      <div style="padding: 10px; background: #f4f4f4; border-left: 4px solid #d33;">
        ${reason || "No reason was provided."}
      </div>
      <p>Please contact support or re-apply with the required corrections.</p>
    </div>
  `;
};