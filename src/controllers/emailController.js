import EmailSettings from '../models/EmailSettings.js';
import CompanySettings from '../models/CompanySettings.js';
import { sendEmail } from '../utils/sendEmail.js';

// Get Current Email Settings (Admin Only)
export const getEmailSettings = async (req, res, next) => {
  console.log("GET /api/admin/email-settings triggered");
  console.log("req.user:", req.user?.email, req.user?.role);
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Administrators can access email settings.',
      });
    }

    let settings = await EmailSettings.findOne();
    console.log("Email settings found in DB:", settings ? "Yes" : "No (Using defaults)");

    if (!settings) {
      try {
        settings = await EmailSettings.create({
          provider: 'custom',
          senderName: 'Work Portal',
          senderEmail: 'noreply@portal.com',
          replyToEmail: '',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          encryption: 'TLS',
          smtpUsername: '',
          smtpPasswordEncrypted: '',
          connectionTimeout: 10000,
          isConfigured: false,
        });
      } catch (createErr) {
        console.error("Error creating default settings in DB:", createErr.message);
        settings = {
          provider: 'custom',
          senderName: 'Work Portal',
          senderEmail: 'noreply@portal.com',
          replyToEmail: '',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          encryption: 'TLS',
          smtpUsername: '',
          smtpPasswordEncrypted: '',
          connectionTimeout: 10000,
          isConfigured: false,
        };
      }
    }

    const isPasswordSet = !!settings.smtpPasswordEncrypted;

    console.log("Returning 200 response with email settings...");
    return res.status(200).json({
      success: true,
      emailSettings: {
        provider: settings.provider || 'custom',
        senderName: settings.senderName || 'Work Portal',
        senderEmail: settings.senderEmail || 'noreply@portal.com',
        replyToEmail: settings.replyToEmail || '',
        smtpHost: settings.smtpHost || 'smtp.gmail.com',
        smtpPort: settings.smtpPort || 587,
        encryption: settings.encryption || 'TLS',
        smtpUsername: settings.smtpUsername || '',
        smtpPassword: isPasswordSet ? '••••••••' : '',
        isPasswordSet,
        connectionTimeout: settings.connectionTimeout || 10000,
        isConfigured: !!settings.isConfigured,
      },
    });
  } catch (error) {
    console.error("Error in getEmailSettings:", error);
    return res.status(200).json({
      success: true,
      emailSettings: {
        provider: 'custom',
        senderName: 'Work Portal',
        senderEmail: 'noreply@portal.com',
        replyToEmail: '',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        encryption: 'TLS',
        smtpUsername: '',
        smtpPassword: '',
        isPasswordSet: false,
        connectionTimeout: 10000,
        isConfigured: false,
      },
    });
  }
};

// Update Email Settings (Admin Only)
export const updateEmailSettings = async (req, res, next) => {
  console.log("PUT /api/admin/email-settings req.body:", req.body);
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Administrators can update email settings.',
      });
    }

    const {
      provider,
      senderName,
      senderEmail,
      replyToEmail,
      smtpHost,
      smtpPort,
      encryption,
      smtpUsername,
      smtpUser,
      username,
      smtpPassword,
      connectionTimeout,
    } = req.body;

    const usernameVal = (smtpUsername || smtpUser || username || senderEmail || '').toString().trim();
    const senderNameVal = (senderName || 'Work Portal').toString().trim();
    const senderEmailVal = (senderEmail || usernameVal).toString().trim();
    const smtpHostVal = (smtpHost || 'smtp.gmail.com').toString().trim();
    const portNum = Number(smtpPort) || 587;

    console.log("Saving Email Settings -> smtpUsername:", usernameVal);

    // Validation
    if (!senderNameVal || !senderEmailVal || !smtpHostVal || !usernameVal) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required email configuration fields (Sender Name, Sender Email, SMTP Host, SMTP Username).',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmailVal)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sender email address format.',
      });
    }

    if (replyToEmail && !emailRegex.test(replyToEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reply-to email address format.',
      });
    }

    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({
        success: false,
        message: 'SMTP Port must be a number between 1 and 65535.',
      });
    }

    let settings = await EmailSettings.findOne();
    if (!settings) {
      settings = new EmailSettings({
        senderName: senderNameVal,
        senderEmail: senderEmailVal,
        smtpHost: smtpHostVal,
        smtpPort: portNum,
        smtpUsername: usernameVal,
      });
    }

    settings.provider = provider || 'custom';
    settings.senderName = senderNameVal;
    settings.senderEmail = senderEmailVal;
    settings.replyToEmail = replyToEmail ? replyToEmail.trim() : '';
    settings.smtpHost = smtpHostVal;
    settings.smtpPort = portNum;
    settings.encryption = ['TLS', 'SSL', 'None'].includes(encryption) ? encryption : 'TLS';
    settings.smtpUsername = usernameVal;
    if (connectionTimeout) {
      settings.connectionTimeout = Number(connectionTimeout) || 10000;
    }
    settings.isConfigured = true;

    // Password handling: update encrypted password only if a new password is submitted and it's not the masked fallback
    if (smtpPassword && smtpPassword !== '••••••••') {
      settings.setEncryptedPassword(smtpPassword);
    }

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Email configuration saved successfully!',
      emailSettings: {
        provider: settings.provider,
        senderName: settings.senderName,
        senderEmail: settings.senderEmail,
        replyToEmail: settings.replyToEmail,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        encryption: settings.encryption,
        smtpUsername: settings.smtpUsername,
        smtpPassword: '••••••••',
        isPasswordSet: true,
        connectionTimeout: settings.connectionTimeout,
        isConfigured: settings.isConfigured,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Send Real Test Email (Admin Only)
export const sendTestEmail = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Administrators can send test emails.',
      });
    }

    const { testEmailRecipient } = req.body;

    if (!testEmailRecipient) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a destination email address for the test email.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmailRecipient)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination email address format.',
      });
    }

    // Check if email settings are saved in DB
    const settings = await EmailSettings.findOne();
    if (!settings || !settings.smtpUsername || !settings.smtpHost) {
      return res.status(400).json({
        success: false,
        message: 'SMTP settings are not configured yet. Please fill in your credentials and click "Save Configuration" first.',
      });
    }

    // Fetch company name for template
    const company = await CompanySettings.findOne();
    const companyName = company?.companyName || 'Work Portal';

    const subject = 'Email Configuration Test';
    const textBody = `Hello,\n\nThis is a test email from your Work Portal.\n\nYour email configuration is working correctly.\n\nCompany:\n${companyName}\n\nRegards,\n${companyName}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; margin-bottom: 16px;">Email Configuration Test</h2>
        <p>Hello,</p>
        <p>This is a test email from your <strong>${companyName}</strong> portal.</p>
        <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #4f46e5; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-weight: bold; color: #16a34a;">✅ Your email configuration is working correctly.</p>
        </div>
        <p><strong>Company:</strong> ${companyName}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #64748b;">Regards,<br /><strong>${companyName}</strong></p>
      </div>
    `;

    await sendEmail({
      to: testEmailRecipient,
      subject,
      text: textBody,
      html: htmlBody,
    });

    res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${testEmailRecipient}!`,
    });
  } catch (error) {
    console.error("Test email dispatch error:", error.message);
    let userMsg = error.message;

    if (error.message.includes('Invalid login') || error.message.includes('535')) {
      userMsg = 'SMTP Authentication Failed: Invalid Username or App Password. If using Gmail, make sure to use an App Password.';
    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('ESOCKET')) {
      userMsg = 'SMTP Connection Timed Out: Please check your SMTP Host, Port, and Encryption settings.';
    }

    res.status(400).json({
      success: false,
      message: `Failed to send test email: ${userMsg}`,
    });
  }
};
