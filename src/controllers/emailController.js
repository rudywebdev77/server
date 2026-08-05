import EmailSettings from '../models/EmailSettings.js';
import CompanySettings from '../models/CompanySettings.js';
import User from '../models/User.js';
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
    const companyName = company?.companyName || 'WODWES LLC';
    
    // Look up recipient name dynamically by email
    const cleanRecipientEmail = String(testEmailRecipient).toLowerCase().trim();
    const recipientUser = await User.findOne({ email: cleanRecipientEmail });

    let recipientName = recipientUser?.fullName;
    if (!recipientName && req.user?.email?.toLowerCase() === cleanRecipientEmail) {
      recipientName = req.user.fullName;
    }
    if (!recipientName) {
      const emailPrefix = cleanRecipientEmail.split('@')[0];
      recipientName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }

    const greeting = `Hello ${recipientName},`;
    const clientUrl = process.env.CLIENT_URL || 'https://client-hussnain5.vercel.app';
    const adminPortalUrl = `${clientUrl}/admin`;

    const subject = 'Email Configuration Verified';
    const textBody = `${greeting}\n\nYour email configuration has been successfully verified.\n\n✅ Email service is configured successfully.\n\nOrganization:\n${companyName}\n\nNeed assistance?\nContact our support team: support@wodwes.com\n\n© 2026 WODWES LLC. All Rights Reserved.`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Configuration Verified</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f1f5f9;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #131b2e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                    <span style="color: #a855f7;">WODWES</span> <span style="font-size: 13px; font-weight: 600; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">LLC</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; line-height: 1.25;">
                Email Configuration Verified
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                ${greeting}
              </p>


              <p style="margin: 0 0 20px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                Your email configuration has been successfully verified.
              </p>

              <!-- Modern Success Alert -->
              <div style="margin: 0 0 28px 0; background-color: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 16px 20px;">
                <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size: 15px; font-weight: 600; color: #4ade80; line-height: 1.4;">
                      ✅ Email service is configured successfully.
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Organization Info Card -->
              <div style="margin: 0; background-color: #1a233a; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 16px 20px;">
                <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">
                  Organization
                </p>
                <p style="margin: 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                  ${companyName}
                </p>
              </div>
            </td>
          </tr>


          <!-- Subtle Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 36px 36px 36px; text-align: left;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #94a3b8;">
                Need assistance?
              </p>
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b;">
                Contact our support team: <a href="mailto:support@wodwes.com" style="color: #a855f7; text-decoration: none; font-weight: 600;">support@wodwes.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #475569; font-weight: 500;">
                © 2026 WODWES LLC. All Rights Reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;


    const info = await sendEmail({
      to: testEmailRecipient,
      subject,
      text: textBody,
      html: htmlBody,
    });

    console.log(`[sendTestEmail SUCCESS] Delivered to ${testEmailRecipient} | SMTP Response: ${info.response} | MessageID: ${info.messageId}`);

    res.status(200).json({
      success: true,
      message: `Test email dispatched successfully to ${testEmailRecipient}! (SMTP 250 OK)`,
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
