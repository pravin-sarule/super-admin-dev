const fs = require('fs');
const path = require('path');

/**
 * Get firm approval email template (set-password invite)
 * @param {Object} firmData - Firm data
 * @returns {string} - HTML email content
 */
const getFirmApprovalEmailTemplate = (firmData) => {
  const issueDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Get frontend URL from environment or use default
  const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://ailearn.co.in').trim().replace(/\/$/, '');
  
  // Prefer firm contact email, fall back to admin login email
  const loginEmail = firmData.email || firmData.admin_email || '';
  const encodedEmail = encodeURIComponent(loginEmail);
  const setPasswordUrl = `${frontendUrl}/set-password?email=${encodedEmail}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>Firm Registration Approved</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-8px); }
      }
      
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(33, 193, 182, 0.4); }
        50% { box-shadow: 0 0 0 10px rgba(33, 193, 182, 0); }
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes gradient-shift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      
      body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    </style>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: #f5f7fa;">
    <div style="padding: 25px 15px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 15px 50px rgba(33, 193, 182, 0.12), 0 5px 15px rgba(0, 0, 0, 0.08);">
        
        <div style="background: linear-gradient(90deg, #21C1B6 0%, #1AA49B 50%, #21C1B6 100%); background-size: 200% 100%; height: 6px; animation: gradient-shift 3s ease infinite;"></div>

        <div style="padding: 30px 35px 20px; text-align: center; background: linear-gradient(180deg, #fafbfc 0%, #ffffff 100%);">
          <div style="display: inline-block; background: linear-gradient(135deg, #21C1B6 0%, #1AA49B 100%); width: 50px; height: 50px; border-radius: 14px; margin-bottom: 15px; box-shadow: 0 8px 20px rgba(33, 193, 182, 0.35), inset 0 -3px 8px rgba(0, 0, 0, 0.15); position: relative;">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: relative; z-index: 1; transform: scale(0.6); top: 1px;">
              <path d="M9 11H15M9 15H13M19 10L19 20C19 21.1046 18.1046 22 17 22L7 22C5.89543 22 5 21.1046 5 20L5 4C5 2.89543 5.89543 2 7 2L13 2L19 8L19 10Z" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="18" cy="18" r="5" fill="#1AA49B" stroke="white" stroke-width="2"/>
              <path d="M16 18L17.5 19.5L20 16.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 style="margin: 0 0 6px; font-size: 22px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px;">Registration Approved</h1>
          <p style="margin: 0; font-size: 13px; color: #6b7280; font-weight: 500;">Jurinex Legal AI Assistant</p>
        </div>

        <div style="padding: 15px 35px 25px;">
          <p style="margin: 0 0 18px; font-size: 14px; color: #4b5563; line-height: 1.6; text-align: center;">
            Congratulations! Your firm has been officially approved. You can now access our AI services to get case summaries and key insights within minutes.
          </p>

          <div style="background: linear-gradient(145deg, #ffffff 0%, #f9fafb 100%); border-radius: 14px; padding: 22px; margin: 0 auto 20px; text-align: left; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 3px rgba(0, 0, 0, 0.04); border: 1px solid rgba(33, 193, 182, 0.15); position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 2.5px; background: linear-gradient(90deg, #21C1B6, #1AA49B, #21C1B6); border-radius: 14px 14px 0 0;"></div>
            
            <p style="margin: 0 0 15px; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.3px; text-align: center; border-bottom: 1px dashed #e5e7eb; padding-bottom: 10px;">Official Credentials</p>
            
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom: 12px; font-size: 12px; color: #6b7280; width: 40%;">Firm Name:</td>
                <td style="padding-bottom: 12px; font-size: 13px; font-weight: 600; color: #1a1a1a; text-align: right;">${escapeHtml(firmData.firm_name)}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 12px; font-size: 12px; color: #6b7280;">PAN Number:</td>
                <td style="padding-bottom: 12px; font-size: 13px; font-weight: 600; color: #1a1a1a; text-align: right; letter-spacing: 0.5px;">${escapeHtml(firmData.pan_number || 'N/A')}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 0; font-size: 12px; color: #6b7280;">Member Since:</td>
                <td style="padding-bottom: 0; font-size: 13px; font-weight: 600; color: #1a1a1a; text-align: right;">${issueDate}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin-bottom: 25px;">
            <a href="${setPasswordUrl}" style="display: block; background: linear-gradient(135deg, #21C1B6 0%, #1AA49B 100%); color: white; padding: 16px 32px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 700; box-shadow: 0 4px 14px rgba(33, 193, 182, 0.3); transition: all 0.3s ease;">
              Generate Login Password
            </a>
            <p style="margin: 12px 0 0; font-size: 12px; color: #6b7280; text-align: center;">
              Use this link to create your login password and access your account.
            </p>
          </div>

          <div style="background: #f0fdf9; border-left: 3px solid #1AA49B; border-radius: 6px; padding: 12px 14px;">
            <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #0f766e;">LEGAL NOTICE</p>
            <p style="margin: 0; font-size: 11px; color: #374151; line-height: 1.4;">
              This email is an official confirmation of your registration with Jurinex. Your access to AI summary services is subject to the terms agreed upon during registration.
            </p>
          </div>
        </div>

        <div style="background: #f9fafb; padding: 20px 35px; text-align: center; border-top: 1px solid #e5e7eb;">
          <div style="margin-bottom: 14px;">
            <a href="#" style="display: inline-block; width: 34px; height: 34px; line-height: 34px; margin: 0 5px; background: linear-gradient(135deg, #21C1B6 0%, #1AA49B 100%); border-radius: 50%; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(33, 193, 182, 0.35), inset 0 -2px 4px rgba(0, 0, 0, 0.15);">f</a>
            <a href="#" style="display: inline-block; width: 34px; height: 34px; line-height: 34px; margin: 0 5px; background: linear-gradient(135deg, #21C1B6 0%, #1AA49B 100%); border-radius: 50%; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px rgba(33, 193, 182, 0.35), inset 0 -2px 4px rgba(0, 0, 0, 0.15);">in</a>
            <a href="#" style="display: inline-block; width: 34px; height: 34px; line-height: 34px; margin: 0 5px; background: linear-gradient(135deg, #21C1B6 0%, #1AA49B 100%); border-radius: 50%; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px rgba(33, 193, 182, 0.35), inset 0 -2px 4px rgba(0, 0, 0, 0.15);">X</a>
          </div>
          
          <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280;">
            Need support? <a href="mailto:support@jurinex.ai" style="color: #21C1B6; text-decoration: none; font-weight: 600;">support@jurinex.ai</a>
          </p>
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">© 2026 Jurinex AI Assistant · All rights reserved</p>
        </div>
      </div>

      <p style="max-width: 520px; margin: 15px auto 0; text-align: center; font-size: 10px; color: #9ca3af; line-height: 1.4;">
        This is an automated message. Please do not reply. The information provided is confidential.
      </p>
    </div>
  </body>
</html>`;
};

/**
 * Escape HTML to prevent XSS
 */
const escapeHtml = (text) => {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

const getQueryStatusUpdateEmailTemplate = (
  recipientName,
  subject,
  status,
  adminMessage = '',
  ticketNumber = ''
) => {
  const statusLabel = String(status || 'open')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const safeRecipientName = escapeHtml(recipientName || 'User');
  const safeSubject = escapeHtml(subject || 'Support Query');
  const safeAdminMessage = escapeHtml(adminMessage || 'Our support team is actively reviewing your request.');
  const safeTicketNumber = escapeHtml(ticketNumber || 'Pending');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Support Query Status Updated</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:24px auto;padding:0 16px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;opacity:0.8;">Support Update</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:700;">Your support query is now ${escapeHtml(statusLabel)}</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">Hello ${safeRecipientName},</p>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;">
            The support request for <strong>${safeSubject}</strong> has been updated by our admin team.
          </p>

          <div style="border:1px solid #dbeafe;background:#f8fbff;border-radius:18px;padding:20px 22px;margin:0 0 22px;">
            <div style="margin-bottom:12px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Query Snapshot</div>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#64748b;">Ticket Number</td>
                <td style="padding:6px 0;font-size:14px;font-weight:600;color:#0f172a;text-align:right;">${safeTicketNumber}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#64748b;">Subject</td>
                <td style="padding:6px 0;font-size:14px;font-weight:600;color:#0f172a;text-align:right;">${safeSubject}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#64748b;">Current Status</td>
                <td style="padding:6px 0;font-size:14px;font-weight:700;color:#2563eb;text-align:right;">${escapeHtml(statusLabel)}</td>
              </tr>
            </table>
          </div>

          <div style="margin:0 0 22px;">
            <div style="margin-bottom:10px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Admin Note</div>
            <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.7;color:#334155;">
              ${safeAdminMessage}
            </div>
          </div>

          <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
            If you need further help, please reply through the support portal or contact our support team.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
};

/**
 * Admin account creation email — sent to the new admin with their login credentials
 */
const getAdminCreationEmailTemplate = (name, email, password, role) => {
  const safeEmail = escapeHtml(email || '');
  const safeName = escapeHtml(name || 'Admin');
  const safePassword = escapeHtml(password || '');
  const roleLabel = escapeHtml(
    (role || 'admin')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );

  const loginUrl = process.env.ADMIN_PORTAL_URL || process.env.FRONTEND_URL || 'https://admin.nexintel.ai';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your Admin Account – Nexintel</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:32px auto;padding:0 16px;">

      <!-- Card -->
      <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.10);">

        <!-- Header bar -->
        <div style="height:5px;background:linear-gradient(90deg,#3b82f6 0%,#2563eb 50%,#1d4ed8 100%);"></div>

        <!-- Logo / Brand -->
        <div style="padding:36px 40px 24px;text-align:center;background:linear-gradient(180deg,#f8fafc 0%,#ffffff 100%);">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);border-radius:16px;box-shadow:0 8px 24px rgba(37,99,235,0.35);margin-bottom:18px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#2563eb;">Nexintel Admin Portal</h1>
          <p style="margin:0;font-size:11px;color:#94a3b8;letter-spacing:0.04em;">Secure · Reliable · Powerful</p>
        </div>

        <!-- Body -->
        <div style="padding:0 40px 36px;">

          <h2 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#0f172a;">Welcome aboard, ${safeName}! 👋</h2>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569;">
            Your admin account on <strong>Nexintel Super Admin Portal</strong> has been created successfully by a Super Administrator. Use the credentials below to sign in for the first time.
          </p>

          <!-- Credentials card -->
          <div style="background:linear-gradient(145deg,#f8faff 0%,#eff6ff 100%);border:1px solid #bfdbfe;border-radius:16px;padding:28px;margin-bottom:28px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#2563eb);"></div>
            <p style="margin:0 0 18px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;border-bottom:1px dashed #bfdbfe;padding-bottom:12px;">Your Login Credentials</p>

            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#64748b;width:40%;">
                  <span style="display:inline-flex;align-items:center;gap:6px;">
                    <!-- envelope icon -->
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    Email Address
                  </span>
                </td>
                <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e40af;text-align:right;">${safeEmail}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#64748b;">
                  <span style="display:inline-flex;align-items:center;gap:6px;">
                    <!-- lock icon -->
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Temporary Password
                  </span>
                </td>
                <td style="padding:8px 0;text-align:right;">
                  <span style="display:inline-block;background:#1e40af;color:#ffffff;font-size:14px;font-weight:700;padding:4px 14px;border-radius:8px;letter-spacing:0.08em;font-family:monospace;">${safePassword}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#64748b;">
                  <span style="display:inline-flex;align-items:center;gap:6px;">
                    <!-- shield icon -->
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Assigned Role
                  </span>
                </td>
                <td style="padding:8px 0;text-align:right;">
                  <span style="display:inline-block;background:#eff6ff;color:#1e40af;font-size:13px;font-weight:700;padding:3px 12px;border-radius:20px;border:1px solid #bfdbfe;letter-spacing:0.03em;">${roleLabel}</span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Security notice -->
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px 18px;margin-bottom:28px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.1em;">⚠ Security Notice</p>
            <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
              Please change your password immediately after your first login. Do not share these credentials with anyone.
            </p>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:28px;">
            <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;font-size:15px;font-weight:700;padding:16px 40px;border-radius:12px;text-decoration:none;box-shadow:0 6px 20px rgba(37,99,235,0.35);letter-spacing:0.02em;">
              Sign In to Admin Portal →
            </a>
          </div>

          <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;text-align:center;">
            Having trouble? Contact your Super Administrator or reach out to<br/>
            <a href="mailto:support@nexintel.ai" style="color:#2563eb;text-decoration:none;font-weight:600;">support@nexintel.ai</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;color:#64748b;">© 2025 Nexintel Admin · All rights reserved</p>
          <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>

      <p style="max-width:600px;margin:14px auto 0;text-align:center;font-size:10px;color:#94a3b8;line-height:1.5;">
        This email was sent because an admin account was created for you on the Nexintel platform. If you did not expect this, contact your organisation's Super Administrator.
      </p>
    </div>
  </body>
</html>`;
};

const getAdminUpdateEmailTemplate = (name, email) => {
  const safeName = escapeHtml(name || 'Admin');
  const safeEmail = escapeHtml(email || '');
  const loginUrl = process.env.ADMIN_PORTAL_URL || process.env.FRONTEND_URL || 'https://admin.nexintel.ai';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Account Updated – Nexintel</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:32px auto;padding:0 16px;">
      <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.10);">
        <div style="height:5px;background:linear-gradient(90deg,#10b981 0%,#059669 100%);"></div>
        <div style="padding:36px 40px 28px;">
          <h2 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a;">Account Details Updated</h2>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
            Hello <strong>${safeName}</strong>, your Nexintel admin account (<strong>${safeEmail}</strong>) has been updated by a Super Administrator. If you did not expect this change, please contact support immediately.
          </p>
          <div style="text-align:center;">
            <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;">Sign In →</a>
          </div>
        </div>
        <div style="background:#f8fafc;padding:18px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">© 2025 Nexintel Admin · This is an automated message.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
};

const getAdminDeletionEmailTemplate = (name, email) => {
  const safeName = escapeHtml(name || 'Admin');
  const safeEmail = escapeHtml(email || '');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Account Removed – Nexintel</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:32px auto;padding:0 16px;">
      <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.10);">
        <div style="height:5px;background:linear-gradient(90deg,#ef4444 0%,#dc2626 100%);"></div>
        <div style="padding:36px 40px 28px;">
          <h2 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a;">Admin Account Deactivated</h2>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
            Hello <strong>${safeName}</strong>, your Nexintel admin account (<strong>${safeEmail}</strong>) has been removed by a Super Administrator. Your access to the admin portal has been revoked.
          </p>
          <p style="margin:0;font-size:14px;color:#475569;">
            If you believe this was done in error, please reach out to your organisation's Super Administrator or contact <a href="mailto:support@nexintel.ai" style="color:#ef4444;text-decoration:none;font-weight:600;">support@nexintel.ai</a>.
          </p>
        </div>
        <div style="background:#f8fafc;padding:18px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">© 2025 Nexintel Admin · This is an automated message.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
};

module.exports = {
  getFirmApprovalEmailTemplate,
  getQueryStatusUpdateEmailTemplate,
  getAdminCreationEmailTemplate,
  getAdminUpdateEmailTemplate,
  getAdminDeletionEmailTemplate,
};
