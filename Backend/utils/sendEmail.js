const nodemailer = require('nodemailer');
require('dotenv').config();

const sendEmail = async (options) => {
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  const secure =
    process.env.EMAIL_SECURE === 'true' ||
    (process.env.EMAIL_SECURE !== 'false' && port === 465);
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });

  const mailOptions = {
    from: `"JuriNex Team" <${fromAddress}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
    text: options.text,
  };

  try {
    console.log('Attempting to send email to:', options.email, 'subject:', options.subject);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', options.email, 'id:', info.messageId || info.response);
    return info;
  } catch (error) {
    console.error('Error sending email:', error.message);
    console.error('Email config host/port/user:', process.env.EMAIL_HOST, port, process.env.EMAIL_USER);
    throw error;
  }
};

module.exports = sendEmail;
