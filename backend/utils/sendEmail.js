import nodemailer from 'nodemailer';

/**
 * Send email utility for Eventra platform.
 * If SMTP environment variables are configured, uses Nodemailer.
 * Otherwise, logs the OTP prominently to the console for testing.
 */
const sendEmail = async ({ to, subject, html, otp }) => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // Print OTP code prominently in terminal for easy local testing
  console.log('\n==================================================');
  console.log(`📧 [EVENTRA EMAIL SERVICE] To: ${to}`);
  console.log(`🔑 [OTP CODE]: ${otp || 'N/A'}`);
  console.log(`📌 Subject: ${subject}`);
  console.log('==================================================\n');

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const mailOptions = {
        from: process.env.FROM_EMAIL || `"Eventra" <noreply@eventra.com>`,
        to,
        subject,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Real email sent successfully: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('⚠️ Real SMTP email sending failed, used console fallback instead:', err.message);
      return { success: true, fallback: true };
    }
  } else {
    console.log('ℹ️ SMTP is not configured in .env. Using console OTP logging for dev testing.');
    return { success: true, fallback: true };
  }
};

export default sendEmail;
