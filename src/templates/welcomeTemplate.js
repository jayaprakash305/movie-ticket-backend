export const welcomeTemplate = (name) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Welcome to CINE BOOK 🎬</h2>
      <p>Hello ${name},</p>
      <p>Your account has been created successfully.</p>
      <p>You can now explore movies, choose seats, and book tickets easily.</p>
      <p>Enjoy your show 🍿</p>
    </div>
  `;
};

export const partnerWelcomeTemplate = (name) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Partner Registration Received 🎭</h2>
      <p>Hello ${name},</p>
      <p>Your partner account request has been submitted successfully.</p>
      <p>Your account is currently waiting for admin approval.</p>
      <p>We will notify you once it is reviewed.</p>
    </div>
  `;
};