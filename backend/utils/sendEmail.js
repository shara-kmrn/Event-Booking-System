import nodemailer from 'nodemailer';

export const assertEmailConfigured = () => {
  if (!process.env.SMTP_HOST || !process.env.FROM_EMAIL ||
      Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASS)) {
    const error = new Error('Email delivery is unavailable. Configure SMTP_HOST and FROM_EMAIL, and paired SMTP credentials when required.');
    error.status = 503;
    throw error;
  }
};

// OTPs are delivered only by SMTP, never through API responses or application logs.
const sendEmail = async ({ to, subject, html }) => {
  assertEmailConfigured();
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    const info = await transporter.sendMail({ from: process.env.FROM_EMAIL, to, subject, html });
    if (!info.accepted?.length) throw new Error('Email was not accepted.');
    return { success: true };
  } catch {
    const error = new Error('Email delivery is temporarily unavailable. Please try again later.');
    error.status = 503;
    throw error;
  }
};
export default sendEmail;
