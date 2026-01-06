const fs = require('fs');
const path = require('path');

/**
 * Get firm approval email template
 * @param {Object} firmData - Firm data
 * @param {string} certificateUrl - Certificate signed URL (valid for 30 days)
 * @returns {string} - HTML email content
 */
const getFirmApprovalEmailTemplate = (firmData, certificateUrl) => {
  const issueDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Get frontend URL from environment or use default
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://jurinex-dev.netlify.app';
  
  // Encode email for URL
  const encodedEmail = encodeURIComponent(firmData.email);
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
            <a href="${setPasswordUrl}" style="display: block; background: linear-gradient(135deg, #21C1B6 0%, #1AA49B 100%); color: white; padding: 16px 32px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 700; box-shadow: 0 4px 14px rgba(33, 193, 182, 0.3); transition: all 0.3s ease; margin-bottom: 12px;">
              Generate Login Password
            </a>
            
            <a href="${certificateUrl}" style="display: inline-block; background: transparent; color: #4b5563; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; border: 1px solid #e5e7eb; transition: all 0.2s ease;">
              📥 Download Certificate (PDF)
            </a>
            <p style="margin: 8px 0 0; font-size: 11px; color: #9ca3af; text-align: center;">
              Certificate link valid for 24 hours
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

module.exports = {
  getFirmApprovalEmailTemplate
};
