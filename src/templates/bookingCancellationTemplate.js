export const bookingCancellationTemplate = ({
  customerName,
  bookingCode,
  movieTitle,
  theatreName,
  showDate,
  showTime,
  seats,
}) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
      <div style="max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
        <div style="background: #7f1d1d; color: white; padding: 20px;">
          <h2 style="margin: 0;">❌ Booking Cancelled</h2>
        </div>

        <div style="padding: 20px;">
          <p>Hello ${customerName || "Customer"},</p>
          <p>Your booking has been cancelled successfully.</p>

          <table cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="border: 1px solid #ddd;"><strong>Booking Code</strong></td>
              <td style="border: 1px solid #ddd;">${bookingCode}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd;"><strong>Movie</strong></td>
              <td style="border: 1px solid #ddd;">${movieTitle}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd;"><strong>Theatre</strong></td>
              <td style="border: 1px solid #ddd;">${theatreName}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd;"><strong>Date</strong></td>
              <td style="border: 1px solid #ddd;">${showDate}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd;"><strong>Time</strong></td>
              <td style="border: 1px solid #ddd;">${showTime}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd;"><strong>Seats</strong></td>
              <td style="border: 1px solid #ddd;">${Array.isArray(seats) ? seats.join(", ") : seats}</td>
            </tr>
          </table>

          <p style="margin-top: 20px;">
            If a refund is applicable, it will be processed according to your policy.
          </p>
        </div>
      </div>
    </div>
  `;
};