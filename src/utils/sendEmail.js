import nodemailer from 'nodemailer';
import EmailSettings from '../models/EmailSettings.js';

/**
 * Dynamically constructs a nodemailer Transporter based on active DB EmailSettings
 */
export const getEmailTransporter = async () => {
  const settings = await EmailSettings.findOne();

  if (settings && settings.isConfigured && settings.smtpUsername) {
    const plainPassword = settings.getDecryptedPassword();
    const isSecure = settings.encryption === 'SSL' || settings.smtpPort === 465;

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: isSecure,
      auth: {
        user: settings.smtpUsername,
        pass: plainPassword,
      },
      connectionTimeout: settings.connectionTimeout || 10000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    return {
      transporter,
      senderName: settings.senderName,
      senderEmail: settings.senderEmail,
      replyToEmail: settings.replyToEmail,
    };
  }

  // Fallback to environment variables if DB settings are not configured yet
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false,
    },
  });

  return {
    transporter,
    senderName: process.env.SENDER_NAME || 'Work Portal',
    senderEmail: process.env.SENDER_EMAIL || user || 'noreply@portal.com',
    replyToEmail: '',
  };
};

/**
 * Universal email dispatch utility
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const { transporter, senderName, senderEmail, replyToEmail } = await getEmailTransporter();

  // Clean and format sender display
  const cleanSenderName = (senderName || 'WODWES LLC').replace(/"/g, '');
  const fromHeader = `"${cleanSenderName}" <${senderEmail}>`;

  const mailOptions = {
    from: fromHeader,
    to,
    subject,
    text: text || html.replace(/<[^>]+>/g, ''), // Provide clean plain-text fallback for anti-spam alignment
    html,
    headers: {
      'X-Priority': '1 (Highest)',
      'X-MSMail-Priority': 'High',
      'Importance': 'High',
      'X-Mailer': 'WODWES System Mailer v1.0',
      'Auto-Submitted': 'auto-generated',
    },
  };

  if (replyToEmail) {
    mailOptions.replyTo = replyToEmail;
  }

  const info = await transporter.sendMail(mailOptions);
  return info;
};

