const nodemailer = require('nodemailer');
require('dotenv').config();

const sendEmail = async (options) => {
  // 1. Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: false,
    },
  });

  // 2. Define the email options
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: options.email,
    subject: options.subject,
    html: options.html,
    text: options.text, // Fallback for clients that don't render HTML
  };

  // 3. Send the email
  try {
    console.log('Attempting to send email with mailOptions:', mailOptions); // Added for debugging
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', options.email);
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('Mail options:', mailOptions);
    throw error; // Re-throw to propagate the error
  }
};

module.exports = sendEmail;