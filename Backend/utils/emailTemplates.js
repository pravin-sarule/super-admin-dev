// const getQueryStatusUpdateEmailTemplate = (userName, querySubject, newStatus, message) => {
//   return `
//     <!DOCTYPE html>
//     <html lang="en">
//     <head>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <title>Support Query Status Update</title>
//         <style>
//             body {
//                 font-family: Arial, sans-serif;
//                 line-height: 1.6;
//                 color: #333;
//             }
//             .container {
//                 max-width: 600px;
//                 margin: 20px auto;
//                 padding: 20px;
//                 border: 1px solid #ddd;
//                 border-radius: 8px;
//                 background-color: #f9f9f9;
//             }
//             .header {
//                 background-color: #4CAF50;
//                 color: white;
//                 padding: 10px 0;
//                 text-align: center;
//                 border-radius: 8px 8px 0 0;
//             }
//             .content {
//                 padding: 20px;
//             }
//             .footer {
//                 text-align: center;
//                 margin-top: 20px;
//                 font-size: 0.9em;
//                 color: #777;
//             }
//             .status-badge {
//                 display: inline-block;
//                 padding: 5px 10px;
//                 border-radius: 5px;
//                 font-weight: bold;
//                 color: white;
//             }
//             .status-open { background-color: #007bff; }
//             .status-in_progress { background-color: #ffc107; }
//             .status-resolved { background-color: #28a745; }
//             .status-closed { background-color: #6c757d; }
//         </style>
//     </head>
//     <body>
//         <div class="container">
//             <div class="header">
//                 <h2>Support Query Status Update</h2>
//             </div>
//             <div class="content">
//                 <p>Dear ${userName},</p>
//                 <p>This is an automated notification to inform you that the status of your support query has been updated.</p>
//                 <p><strong>Subject:</strong> ${querySubject}</p>
//                 <p><strong>New Status:</strong> <span class="status-badge status-${newStatus.toLowerCase().replace(' ', '_')}">${newStatus}</span></p>
//                 <p><strong>Admin Message:</strong></p>
//                 <p style="border-left: 4px solid #ccc; padding-left: 10px; margin-left: 10px; font-style: italic;">${message}</p>
//                 <p>If you have any further questions, please reply to this email or log in to your account.</p>
//                 <p>Thank you for your patience.</p>
//                 <p>Sincerely,<br>Nexintel Support Team</p>
//             </div>
//             <div class="footer">
//                 <p>&copy; ${new Date().getFullYear()} Nexintel. All rights reserved.</p>
//             </div>
//         </div>
//     </body>
//     </html>
//   `;
// };

// module.exports = {
//   getQueryStatusUpdateEmailTemplate,
// };

const getQueryStatusUpdateEmailTemplate = (userName, querySubject, newStatus, message) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support Query Status Update - Nexintel</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #2c3e50;
                margin: 0;
                padding: 0;
                background-color: #f8fafc;
            }
            .container {
                max-width: 600px;
                margin: 30px auto;
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 30px 40px;
                text-align: center;
                color: white;
            }
            .logo {
                max-width: 120px;
                height: auto;
                margin-bottom: 15px;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 300;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 40px;
                background-color: #ffffff;
            }
            .greeting {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 25px;
                font-weight: 500;
            }
            .intro-text {
                color: #5a6c7d;
                margin-bottom: 30px;
                font-size: 16px;
            }
            .info-section {
                background-color: #f8fafc;
                border-left: 4px solid #667eea;
                padding: 25px;
                margin: 25px 0;
                border-radius: 0 8px 8px 0;
            }
            .info-item {
                margin-bottom: 15px;
            }
            .info-label {
                font-weight: 600;
                color: #2c3e50;
                display: inline-block;
                min-width: 80px;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .info-value {
                color: #5a6c7d;
                font-size: 16px;
            }
            .status-badge {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border: 2px solid;
            }
            .status-open { 
                color: #3498db; 
                background-color: #ebf3fd; 
                border-color: #3498db; 
            }
            .status-in_progress { 
                color: #f39c12; 
                background-color: #fef9e7; 
                border-color: #f39c12; 
            }
            .status-resolved { 
                color: #27ae60; 
                background-color: #eafaf1; 
                border-color: #27ae60; 
            }
            .status-closed { 
                color: #7f8c8d; 
                background-color: #f8f9fa; 
                border-color: #7f8c8d; 
            }
            .message-section {
                background-color: #f8fafc;
                border-radius: 8px;
                padding: 20px;
                margin: 25px 0;
                border-left: 4px solid #95a5a6;
            }
            .message-label {
                font-weight: 600;
                color: #2c3e50;
                margin-bottom: 10px;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .message-content {
                color: #5a6c7d;
                font-size: 16px;
                line-height: 1.7;
                font-style: italic;
            }
            .action-section {
                background-color: #f1f3f4;
                padding: 20px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            .action-text {
                color: #5a6c7d;
                margin-bottom: 15px;
                font-size: 15px;
            }
            .contact-link {
                color: #667eea;
                text-decoration: none;
                font-weight: 500;
            }
            .contact-link:hover {
                text-decoration: underline;
            }
            .closing {
                margin-top: 35px;
                color: #5a6c7d;
                line-height: 1.8;
            }
            .signature {
                font-weight: 600;
                color: #2c3e50;
                margin-top: 20px;
            }
            .footer {
                background-color: #2c3e50;
                color: #ecf0f1;
                text-align: center;
                padding: 25px;
                font-size: 14px;
            }
            .footer-links {
                margin-bottom: 15px;
            }
            .footer-link {
                color: #bdc3c7;
                text-decoration: none;
                margin: 0 15px;
                font-size: 13px;
            }
            .footer-link:hover {
                color: #ecf0f1;
            }
            .copyright {
                color: #95a5a6;
                font-size: 12px;
                margin-top: 15px;
            }
            
            /* Mobile responsiveness */
            @media only screen and (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 8px;
                }
                .header, .content {
                    padding: 25px 20px;
                }
                .info-section, .message-section {
                    padding: 20px 15px;
                }
                .logo {
                    max-width: 100px;
                }
                .header h1 {
                    font-size: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="https://www.nexintelai.com/assets/img/Ai%20logo-01.png" alt="Nexintel Logo" class="logo" />
                <h1>Support Query Status Update</h1>
            </div>
            
            <div class="content">
                <div class="greeting">Hello ${userName},</div>
                
                <div class="intro-text">
                    We're writing to update you on the status of your recent support request. 
                    Our team has been working on your query and wanted to keep you informed of our progress.
                </div>
                
                <div class="info-section">
                    <div class="info-item">
                        <span class="info-label">Subject:</span>
                        <div class="info-value">${querySubject}</div>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status:</span>
                        <div class="info-value">
                            <span class="status-badge status-${newStatus.toLowerCase().replace(' ', '_')}">${newStatus}</span>
                        </div>
                    </div>
                </div>
                
                <div class="message-section">
                    <div class="message-label">Update from our team:</div>
                    <div class="message-content">${message}</div>
                </div>
                
                <div class="action-section">
                    <div class="action-text">
                        Have questions or need additional assistance?
                    </div>
                    <div>
                        Reply to this email or <a href="mailto:support@nexintelai.com" class="contact-link">contact our support team</a>
                    </div>
                </div>
                
                <div class="closing">
                    Thank you for choosing Nexintel. We appreciate your patience as we work to provide you with the best possible service.
                </div>
                
                <div class="signature">
                    Best regards,<br>
                    The Nexintel Support Team
                </div>
            </div>
            
            <div class="footer">
                <div class="footer-links">
                    <a href="https://www.nexintelai.com" class="footer-link">Visit Our Website</a>
                    <a href="#" class="footer-link">Help Center</a>
                    <a href="#" class="footer-link">Privacy Policy</a>
                </div>
                <div class="copyright">
                    &copy; ${new Date().getFullYear()} Nexintel AI. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

const getAdminCreationEmailTemplate = (adminName, username, password) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Account Created - Nexintel</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #2c3e50;
                margin: 0;
                padding: 0;
                background-color: #f8fafc;
            }
            .container {
                max-width: 600px;
                margin: 30px auto;
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 30px 40px;
                text-align: center;
                color: white;
            }
            .logo {
                max-width: 120px;
                height: auto;
                margin-bottom: 15px;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 300;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 40px;
                background-color: #ffffff;
            }
            .greeting {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 25px;
                font-weight: 500;
            }
            .intro-text {
                color: #5a6c7d;
                margin-bottom: 30px;
                font-size: 16px;
            }
            .info-section {
                background-color: #f8fafc;
                border-left: 4px solid #667eea;
                padding: 25px;
                margin: 25px 0;
                border-radius: 0 8px 8px 0;
            }
            .info-item {
                margin-bottom: 15px;
            }
            .info-label {
                font-weight: 600;
                color: #2c3e50;
                display: inline-block;
                min-width: 80px;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .info-value {
                color: #5a6c7d;
                font-size: 16px;
            }
            .action-section {
                background-color: #f1f3f4;
                padding: 20px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            .action-text {
                color: #5a6c7d;
                margin-bottom: 15px;
                font-size: 15px;
            }
            .contact-link {
                color: #667eea;
                text-decoration: none;
                font-weight: 500;
            }
            .contact-link:hover {
                text-decoration: underline;
            }
            .closing {
                margin-top: 35px;
                color: #5a6c7d;
                line-height: 1.8;
            }
            .signature {
                font-weight: 600;
                color: #2c3e50;
                margin-top: 20px;
            }
            .footer {
                background-color: #2c3e50;
                color: #ecf0f1;
                text-align: center;
                padding: 25px;
                font-size: 14px;
            }
            .footer-links {
                margin-bottom: 15px;
            }
            .footer-link {
                color: #bdc3c7;
                text-decoration: none;
                margin: 0 15px;
                font-size: 13px;
            }
            .footer-link:hover {
                color: #ecf0f1;
            }
            .copyright {
                color: #95a5a6;
                font-size: 12px;
                margin-top: 15px;
            }
            
            /* Mobile responsiveness */
            @media only screen and (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 8px;
                }
                .header, .content {
                    padding: 25px 20px;
                }
                .info-section {
                    padding: 20px 15px;
                }
                .logo {
                    max-width: 100px;
                }
                .header h1 {
                    font-size: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="https://www.nexintelai.com/assets/img/Ai%20logo-01.png" alt="Nexintel Logo" class="logo" />
                <h1>Welcome to Nexintel Admin!</h1>
            </div>
            
            <div class="content">
                <div class="greeting">Hello ${adminName},</div>
                
                <div class="intro-text">
                    Your administrator account for Nexintel has been successfully created.
                    You can now log in using the credentials provided below.
                </div>
                
                <div class="info-section">
                    <div class="info-item">
                        <span class="info-label">Username:</span>
                        <div class="info-value">${username}</div>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Password:</span>
                        <div class="info-value">${password}</div>
                    </div>
                </div>
                
                <div class="action-section">
                    <div class="action-text">
                        Click the button below to log in to your admin panel:
                    </div>
                    <div>
                        <a href="https://nexintel-super-admin.netlify.app" style="background-color: #667eea; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">Log In to Admin Panel</a>
                    </div>
                </div>
                
                <div class="closing">
                    For security reasons, we recommend changing your password after your first login.
                    If you have any questions or encounter any issues, please do not hesitate to contact our support team.
                </div>
                
                <div class="signature">
                    Best regards,<br>
                    The Nexintel Team
                </div>
            </div>
            
            <div class="footer">
                <div class="footer-links">
                    <a href="https://www.nexintelai.com" class="footer-link">Visit Our Website</a>
                    <a href="#" class="footer-link">Help Center</a>
                    <a href="#" class="footer-link">Privacy Policy</a>
                </div>
                <div class="copyright">
                    &copy; ${new Date().getFullYear()} Nexintel AI. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

const getAdminDeletionEmailTemplate = (adminName, username) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Account Deleted - Nexintel</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #2c3e50;
                margin: 0;
                padding: 0;
                background-color: #f8fafc;
            }
            .container {
                max-width: 600px;
                margin: 30px auto;
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                padding: 30px 40px;
                text-align: center;
                color: white;
            }
            .logo {
                max-width: 120px;
                height: auto;
                margin-bottom: 15px;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 300;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 40px;
                background-color: #ffffff;
            }
            .greeting {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 25px;
                font-weight: 500;
            }
            .intro-text {
                color: #5a6c7d;
                margin-bottom: 30px;
                font-size: 16px;
            }
            .info-section {
                background-color: #f8fafc;
                border-left: 4px solid #e74c3c;
                padding: 25px;
                margin: 25px 0;
                border-radius: 0 8px 8px 0;
            }
            .info-item {
                margin-bottom: 15px;
            }
            .info-label {
                font-weight: 600;
                color: #2c3e50;
                display: inline-block;
                min-width: 80px;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .info-value {
                color: #5a6c7d;
                font-size: 16px;
            }
            .closing {
                margin-top: 35px;
                color: #5a6c7d;
                line-height: 1.8;
            }
            .signature {
                font-weight: 600;
                color: #2c3e50;
                margin-top: 20px;
            }
            .footer {
                background-color: #2c3e50;
                color: #ecf0f1;
                text-align: center;
                padding: 25px;
                font-size: 14px;
            }
            .footer-links {
                margin-bottom: 15px;
            }
            .footer-link {
                color: #bdc3c7;
                text-decoration: none;
                margin: 0 15px;
                font-size: 13px;
            }
            .footer-link:hover {
                color: #ecf0f1;
            }
            .copyright {
                color: #95a5a6;
                font-size: 12px;
                margin-top: 15px;
            }
            
            /* Mobile responsiveness */
            @media only screen and (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 8px;
                }
                .header, .content {
                    padding: 25px 20px;
                }
                .info-section {
                    padding: 20px 15px;
                }
                .logo {
                    max-width: 100px;
                }
                .header h1 {
                    font-size: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="https://www.nexintelai.com/assets/img/Ai%20logo-01.png" alt="Nexintel Logo" class="logo" />
                <h1>Admin Account Deleted</h1>
            </div>
            
            <div class="content">
                <div class="greeting">Hello ${adminName},</div>
                
                <div class="intro-text">
                    This is to confirm that your administrator account with username <strong>${username}</strong> has been successfully deleted from the Nexintel system.
                </div>
                
                <div class="info-section">
                    <div class="info-item">
                        <span class="info-label">Username:</span>
                        <div class="info-value">${username}</div>
                    </div>
                </div>
                
                <div class="closing">
                    If you believe this was done in error or have any questions, please contact our support team immediately.
                </div>
                
                <div class="signature">
                    Best regards,<br>
                    The Nexintel Team
                </div>
            </div>
            
            <div class="footer">
                <div class="footer-links">
                    <a href="https://www.nexintelai.com" class="footer-link">Visit Our Website</a>
                    <a href="#" class="footer-link">Help Center</a>
                    <a href="#" class="footer-link">Privacy Policy</a>
                </div>
                <div class="copyright">
                    &copy; ${new Date().getFullYear()} Nexintel AI. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

const getAdminUpdateEmailTemplate = (adminName, username, updatedFields) => {
  let fieldsList = Object.entries(updatedFields).map(([key, value]) => {
    if (key === 'password') {
      return `
        <div class="info-item">
            <span class="info-label">Password:</span>
            <div class="info-value">New password set (not displayed for security)</div>
        </div>
      `;
    }
    return `
      <div class="info-item">
          <span class="info-label">${key.charAt(0).toUpperCase() + key.slice(1)}:</span>
          <div class="info-value">${value}</div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Account Updated - Nexintel</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #2c3e50;
                margin: 0;
                padding: 0;
                background-color: #f8fafc;
            }
            .container {
                max-width: 600px;
                margin: 30px auto;
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                padding: 30px 40px;
                text-align: center;
                color: white;
            }
            .logo {
                max-width: 120px;
                height: auto;
                margin-bottom: 15px;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 300;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 40px;
                background-color: #ffffff;
            }
            .greeting {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 25px;
                font-weight: 500;
            }
            .intro-text {
                color: #5a6c7d;
                margin-bottom: 30px;
                font-size: 16px;
            }
            .info-section {
                background-color: #f8fafc;
                border-left: 4px solid #3498db;
                padding: 25px;
                margin: 25px 0;
                border-radius: 0 8px 8px 0;
            }
            .info-item {
                margin-bottom: 15px;
            }
            .info-label {
                font-weight: 600;
                color: #2c3e50;
                display: inline-block;
                min-width: 120px;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .info-value {
                color: #5a6c7d;
                font-size: 16px;
            }
            .closing {
                margin-top: 35px;
                color: #5a6c7d;
                line-height: 1.8;
            }
            .signature {
                font-weight: 600;
                color: #2c3e50;
                margin-top: 20px;
            }
            .footer {
                background-color: #2c3e50;
                color: #ecf0f1;
                text-align: center;
                padding: 25px;
                font-size: 14px;
            }
            .footer-links {
                margin-bottom: 15px;
            }
            .footer-link {
                color: #bdc3c7;
                text-decoration: none;
                margin: 0 15px;
                font-size: 13px;
            }
            .footer-link:hover {
                color: #ecf0f1;
            }
            .copyright {
                color: #95a5a6;
                font-size: 12px;
                margin-top: 15px;
            }
            
            /* Mobile responsiveness */
            @media only screen and (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 8px;
                }
                .header, .content {
                    padding: 25px 20px;
                }
                .info-section {
                    padding: 20px 15px;
                }
                .logo {
                    max-width: 100px;
                }
                .header h1 {
                    font-size: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="https://www.nexintelai.com/assets/img/Ai%20logo-01.png" alt="Nexintel Logo" class="logo" />
                <h1>Admin Account Updated</h1>
            </div>
            
            <div class="content">
                <div class="greeting">Hello ${adminName},</div>
                
                <div class="intro-text">
                    This is to confirm that your administrator account with username <strong>${username}</strong> has been updated.
                    Below are the details of the changes made:
                </div>
                
                <div class="info-section">
                    ${fieldsList}
                </div>
                
                <div class="closing">
                    If you did not authorize these changes or have any questions, please contact our support team immediately.
                </div>
                
                <div class="signature">
                    Best regards,<br>
                    The Nexintel Team
                </div>
            </div>
            
            <div class="footer">
                <div class="footer-links">
                    <a href="https://www.nexintelai.com" class="footer-link">Visit Our Website</a>
                    <a href="#" class="footer-link">Help Center</a>
                    <a href="#" class="footer-link">Privacy Policy</a>
                </div>
                <div class="copyright">
                    &copy; ${new Date().getFullYear()} Nexintel AI. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = {
  getQueryStatusUpdateEmailTemplate,
  getAdminCreationEmailTemplate,
  getAdminDeletionEmailTemplate,
  getAdminUpdateEmailTemplate,
};