// const puppeteer = require('puppeteer');
// const path = require('path');
// const fs = require('fs');
// const { storage } = require('../config/gcs');
// require('dotenv').config();

// /**
//  * Generate PDF certificate for a firm
//  * @param {Object} firmData - Firm data from database
//  * @returns {Promise<Object>} - Certificate file path and metadata
//  */
// const generateCertificate = async (firmData) => {
//   let browser = null;
//   try {
//     // Get certificate bucket name from env
//     const certificateBucketName = process.env.CERTIFICATE_BUCKET_NAME;
//     if (!certificateBucketName) {
//       throw new Error('CERTIFICATE_BUCKET_NAME is not set in environment variables');
//     }

//     const bucket = storage.bucket(certificateBucketName);

//     // Generate certificate ID
//     const certificateId = `JX-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}-LP`;
//     const issueDate = new Date();
//     const expiryDate = new Date();
//     expiryDate.setMonth(expiryDate.getMonth() + 12); // Valid for 1 year

//     // Format dates
//     const formattedIssueDate = issueDate.toLocaleDateString('en-GB', { 
//       day: '2-digit', 
//       month: 'short', 
//       year: 'numeric' 
//     });
//     const formattedExpiryDate = expiryDate.toLocaleDateString('en-GB', { 
//       month: 'short', 
//       year: 'numeric' 
//     });

//     // Read trust badge image and convert to base64
//     // Try multiple possible paths - prioritize Frontend/src/assets/trust-badge.png
//     const projectRoot = process.cwd();
//     const possiblePaths = [
//       path.join(projectRoot, 'Frontend/src/assets/trust-badge.png'), // Primary path
//       path.join(__dirname, '../../Frontend/src/assets/trust-badge.png'), // Relative from Backend/services
//       path.join(__dirname, '../../../Frontend/src/assets/trust-badge.png'), // Alternative relative
//       path.join(projectRoot, 'assets/trust-badge.png'),
//       path.join(__dirname, '../assets/trust-badge.png')
//     ];
    
//     let trustBadgeBase64 = '';
//     let loadedPath = '';
    
//     for (const trustBadgePath of possiblePaths) {
//       const normalizedPath = path.normalize(trustBadgePath);
//       if (fs.existsSync(normalizedPath)) {
//         try {
//           const trustBadgeBuffer = fs.readFileSync(normalizedPath);
//           trustBadgeBase64 = `data:image/png;base64,${trustBadgeBuffer.toString('base64')}`;
//           loadedPath = normalizedPath;
//           console.log('✅ Trust badge loaded successfully from:', normalizedPath);
//           console.log('   Image size:', (trustBadgeBuffer.length / 1024).toFixed(2), 'KB');
//           break;
//         } catch (error) {
//           console.warn('⚠️ Error reading trust badge from', normalizedPath, ':', error.message);
//         }
//       } else {
//         console.log('   Checking path:', normalizedPath, '- Not found');
//       }
//     }
    
//     if (!trustBadgeBase64) {
//       console.error('❌ Trust badge image not found in any of the following paths:');
//       possiblePaths.forEach(p => console.error('   -', path.normalize(p)));
//       console.warn('⚠️ Certificate will be generated without trust badge image.');
//     }

//     // Generate HTML content for certificate
//     const htmlContent = generateCertificateHTML(firmData, {
//       certificateId,
//       issueDate: formattedIssueDate,
//       expiryDate: formattedExpiryDate,
//       trustBadgeBase64
//     });

//     // Launch Puppeteer
//     browser = await puppeteer.launch({
//       headless: true,
//       args: ['--no-sandbox', '--disable-setuid-sandbox']
//     });

//     const page = await browser.newPage();
    
//     // Set content and wait for fonts to load
//     await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
//     // Generate PDF
//     const pdfBuffer = await page.pdf({
//       format: 'A4',
//       printBackground: true,
//       margin: {
//         top: '0',
//         right: '0',
//         bottom: '0',
//         left: '0'
//       }
//     });

//     await browser.close();
//     browser = null;

//     // Upload to GCS (private upload)
//     const fileName = `firms/${firmData.id}/certificates/certificate_${Date.now()}.pdf`;
//     const file = bucket.file(fileName);

//     await file.save(pdfBuffer, {
//       metadata: {
//         contentType: 'application/pdf',
//         metadata: {
//           firmId: firmData.id,
//           firmName: firmData.firm_name,
//           certificateId: certificateId,
//           issueDate: issueDate.toISOString()
//         }
//       },
//       resumable: false
//     });

//     console.log('✅ Certificate uploaded to GCS:', fileName);

//     // Generate signed URL (valid for 24 hours)
//     const [signedUrl] = await file.getSignedUrl({
//       version: 'v4',
//       action: 'read',
//       expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours validity
//     });

//     console.log('✅ Signed URL generated for certificate (valid for 24 hours)');

//     return {
//       certificatePath: `gs://${certificateBucketName}/${fileName}`,
//       signedUrl: signedUrl,
//       certificateId: certificateId,
//       issueDate: issueDate,
//       expiryDate: expiryDate,
//       urlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
//     };

//   } catch (error) {
//     if (browser) {
//       await browser.close();
//     }
//     console.error('Error generating certificate:', error);
//     throw error;
//   }
// };

// /**
//  * Generate HTML content for certificate
//  */
// const generateCertificateHTML = (firmData, options) => {
//   const { certificateId, issueDate, expiryDate, trustBadgeBase64 } = options;
  
//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Jurinex Registration Certificate</title>
//     <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lato:wght@300;400;700&family=Pinyon+Script&display=swap" rel="stylesheet">
//     <style>
//         body {
//             margin: 0;
//             padding: 40px;
//             background: #f0f2f5;
//             font-family: 'Lato', sans-serif;
//             display: flex;
//             justify-content: center;
//             align-items: center;
//             min-height: 100vh;
//         }

//         .certificate-container {
//             width: 800px; 
//             height: 600px;
//             background: #fff;
//             position: relative;
//             box-shadow: 0 20px 50px rgba(0,0,0,0.1);
//             padding: 15px;
//             color: #1a1a1a;
//         }

//         .border-outer {
//             border: 2px solid #1AA49B;
//             height: 100%;
//             box-sizing: border-box;
//             padding: 5px;
//             position: relative;
//         }

//         .border-inner {
//             border: 4px double #0f766e;
//             height: 100%;
//             box-sizing: border-box;
//             padding: 40px;
//             position: relative;
//             background: #ffffff; 
//             display: flex;
//             flex-direction: column;
//         }

//         .corner {
//             position: absolute;
//             width: 30px;
//             height: 30px;
//             border: 2px solid #C5A059; 
//             z-index: 1;
//         }
//         .tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
//         .tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
//         .bl { bottom: 10px; left: 10px; border-right: none; border-top: none; }
//         .br { bottom: 10px; right: 10px; border-left: none; border-top: none; }

//         .header {
//             text-align: center;
//             margin-bottom: 20px;
//         }

//         .brand-name {
//             font-family: 'Cinzel', serif;
//             font-size: 24px;
//             color: #1AA49B;
//             letter-spacing: 4px;
//             text-transform: uppercase;
//             margin-bottom: 5px;
//             font-weight: 700;
//         }

//         .title {
//             font-family: 'Cinzel', serif;
//             font-size: 38px;
//             color: #111;
//             margin: 5px 0;
//             text-transform: uppercase;
//             letter-spacing: 1px;
//         }

//         .subtitle {
//             font-size: 13px;
//             color: #666;
//             text-transform: uppercase;
//             letter-spacing: 2px;
//             border-top: 1px solid #ddd;
//             border-bottom: 1px solid #ddd;
//             display: inline-block;
//             padding: 4px 20px;
//         }

//         .content {
//             text-align: center;
//             margin-top: 20px;
//             flex-grow: 1;
//         }

//         .recipient-prefix {
//             font-style: italic;
//             color: #555;
//             margin-bottom: 5px;
//             font-size: 16px;
//         }

//         .recipient-name {
//             font-family: 'Arial Script', cursive;
//             font-size: 46px;
//             color: #0f766e;
//             margin: 5px 0 15px;
//             border-bottom: 1px solid #ccc;
//             display: inline-block;
//             padding: 0 40px 10px;
//             min-width: 300px;
//         }

//         .description {
//             font-size: 14px;
//             line-height: 1.6;
//             color: #444;
//             max-width: 580px;
//             margin: 0 auto;
//         }

//         .highlight {
//             font-weight: 700;
//             color: #1AA49B;
//         }

//         .footer {
//             margin-top: 20px;
//             margin-bottom: 20px;
//             display: flex;
//             justify-content: space-between;
//             align-items: flex-end;
//             padding: 0 20px;
//         }

//         .signature-block {
//             text-align: center;
//             width: 220px;
//             display: flex;
//             flex-direction: column;
//             align-items: center;
//         }

//         .signature-img {
//             font-family: 'Arial Script', cursive;
//             font-size: 16px;
//             color: #1a1a1a;
//             margin-bottom: 2px;
//             height: 35px;
//             display: flex;
//             align-items: flex-end;
//             justify-content: center;
//         }

//         .signature-line {
//             width: 100%;
//             height: 1px;
//             background: #333;
//             margin: 0 auto 8px;
//         }

//         .signature-title {
//             font-size: 10px;
//             text-transform: uppercase;
//             letter-spacing: 1px;
//             color: #666;
//             line-height: 1.2;
//             text-align: center;
//         }

//         .badge-image-container {
//             width: 110px;
//             height: 110px;
//             margin-bottom: -30px;
//             position: relative;
//             z-index: 5;
//             display: flex;
//             align-items: center;
//             justify-content: center;
//         }

//         .badge-image-container img {
//             max-width: 200%;
//             max-height: 200%;
//             object-fit: contain;
//             filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
//         }

//         .meta-data {
//             text-align: center;
//             font-size: 9px;
//             color: #999;
//             font-family: monospace;
//             padding-bottom: 2px;
//         }
//     </style>
// </head>
// <body>
//     <div class="certificate-container">
//         <div class="border-outer">
//             <div class="corner tl"></div>
//             <div class="corner tr"></div>
//             <div class="corner bl"></div>
//             <div class="corner br"></div>

//             <div class="border-inner">
//                 <div class="header">
//                     <div class="brand-name">Jurinex</div>
//                     <div class="title">Certificate of Registration</div>
//                     <div class="subtitle">AI Partner Network · ${new Date().getFullYear()}-${new Date().getFullYear() + 1}</div>
//                 </div>

//                 <div class="content">
//                     <div class="recipient-prefix">This is to certify that</div>
//                     <div class="recipient-name">${escapeHtml(firmData.firm_name)}</div>

//                     <div class="description">
//                         has successfully completed all compliance verification protocols and is hereby recognized as an 
//                         <span class="highlight">Authorized Jurinex Partner</span>.
//                         <br><br>
//                         This firm is granted full access to the Jurinex Legal AI Intelligence Suite, utilizing advanced algorithms for high-speed document summarization, precedent analysis, and strategic insight generation.
//                     </div>
//                 </div>

//                 <div class="footer">
//                     <div class="signature-block">
//                         <div class="signature-img">Mr. Santosh Dehadrai</div>
//                         <div class="signature-line"></div>
//                         <div class="signature-title">CHIEF TECHNOLOGY OFFICER<br>JURINEX</div>
//                     </div>

//                     <div class="badge-image-container">
//                         ${trustBadgeBase64 ? `<img src="${trustBadgeBase64}" alt="NexIntel AI Trust Badge">` : ''}
//                     </div>

//                     <div class="signature-block">
//                         <div class="signature-img">${issueDate}</div>
//                         <div class="signature-line"></div>
//                         <div class="signature-title">DATE OF ISSUE</div>
//                     </div>
//                 </div>

//                 <div class="meta-data">
//                     Certificate ID: ${certificateId}  •  Verify at: verify.jurinex.ai/check  •  Valid until: ${expiryDate}
//                 </div>
//             </div>
//         </div>
//     </div>
// </body>
// </html>`;
// };

// /**
//  * Escape HTML to prevent XSS
//  */
// const escapeHtml = (text) => {
//   if (!text) return '';
//   const map = {
//     '&': '&amp;',
//     '<': '&lt;',
//     '>': '&gt;',
//     '"': '&quot;',
//     "'": '&#039;'
//   };
//   return text.replace(/[&<>"']/g, m => map[m]);
// };

// module.exports = {
//   generateCertificate
// };



// const puppeteer = require('puppeteer');
// const path = require('path');
// const fs = require('fs');
// const { storage } = require('../config/gcs');
// require('dotenv').config();

// /**
//  * Generate PDF certificate for a firm
//  * @param {Object} firmData - Firm data from database
//  * @returns {Promise<Object>} - Certificate file path and metadata
//  */
// const generateCertificate = async (firmData) => {
//   let browser = null;
//   try {
//     // Get certificate bucket name from env
//     const certificateBucketName = process.env.CERTIFICATE_BUCKET_NAME;
//     if (!certificateBucketName) {
//       throw new Error('CERTIFICATE_BUCKET_NAME is not set in environment variables');
//     }

//     const bucket = storage.bucket(certificateBucketName);

//     // Generate certificate ID
//     const certificateId = `JX-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}-LP`;
//     const issueDate = new Date();
//     const expiryDate = new Date();
//     expiryDate.setMonth(expiryDate.getMonth() + 12); // Valid for 1 year

//     // Format dates
//     const formattedIssueDate = issueDate.toLocaleDateString('en-GB', { 
//       day: '2-digit', 
//       month: 'short', 
//       year: 'numeric' 
//     });
//     const formattedExpiryDate = expiryDate.toLocaleDateString('en-GB', { 
//       month: 'short', 
//       year: 'numeric' 
//     });

//     // Read trust badge image and convert to base64
//     const projectRoot = process.cwd();
//     const possiblePaths = [
//       path.join(projectRoot, 'Frontend/src/assets/trust-badge.png'),
//       path.join(__dirname, '../../Frontend/src/assets/trust-badge.png'),
//       path.join(__dirname, '../../../Frontend/src/assets/trust-badge.png'),
//       path.join(projectRoot, 'assets/trust-badge.png'),
//       path.join(__dirname, '../assets/trust-badge.png')
//     ];
    
//     let trustBadgeBase64 = '';
//     let loadedPath = '';
    
//     for (const trustBadgePath of possiblePaths) {
//       const normalizedPath = path.normalize(trustBadgePath);
//       if (fs.existsSync(normalizedPath)) {
//         try {
//           const trustBadgeBuffer = fs.readFileSync(normalizedPath);
//           trustBadgeBase64 = `data:image/png;base64,${trustBadgeBuffer.toString('base64')}`;
//           loadedPath = normalizedPath;
//           console.log('✅ Trust badge loaded successfully from:', normalizedPath);
//           console.log('   Image size:', (trustBadgeBuffer.length / 1024).toFixed(2), 'KB');
//           break;
//         } catch (error) {
//           console.warn('⚠️ Error reading trust badge from', normalizedPath, ':', error.message);
//         }
//       } else {
//         console.log('   Checking path:', normalizedPath, '- Not found');
//       }
//     }
    
//     if (!trustBadgeBase64) {
//       console.error('❌ Trust badge image not found in any of the following paths:');
//       possiblePaths.forEach(p => console.error('   -', path.normalize(p)));
//       console.warn('⚠️ Certificate will be generated without trust badge image.');
//     }

//     // Generate HTML content for certificate
//     const htmlContent = generateCertificateHTML(firmData, {
//       certificateId,
//       issueDate: formattedIssueDate,
//       expiryDate: formattedExpiryDate,
//       trustBadgeBase64
//     });

//     // Launch Puppeteer
//     browser = await puppeteer.launch({
//       headless: true,
//       args: ['--no-sandbox', '--disable-setuid-sandbox']
//     });

//     const page = await browser.newPage();
    
//     // Set content and wait for fonts to load
//     await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
//     // Generate PDF with A4 dimensions
//     const pdfBuffer = await page.pdf({
//       format: 'A4',
//       printBackground: true,
//       margin: {
//         top: '0',
//         right: '0',
//         bottom: '0',
//         left: '0'
//       }
//     });

//     await browser.close();
//     browser = null;

//     // Upload to GCS (private upload)
//     const fileName = `firms/${firmData.id}/certificates/certificate_${Date.now()}.pdf`;
//     const file = bucket.file(fileName);

//     await file.save(pdfBuffer, {
//       metadata: {
//         contentType: 'application/pdf',
//         metadata: {
//           firmId: firmData.id,
//           firmName: firmData.firm_name,
//           certificateId: certificateId,
//           issueDate: issueDate.toISOString()
//         }
//       },
//       resumable: false
//     });

//     console.log('✅ Certificate uploaded to GCS:', fileName);

//     // Generate signed URL (valid for 24 hours)
//     const [signedUrl] = await file.getSignedUrl({
//       version: 'v4',
//       action: 'read',
//       expires: Date.now() + 24 * 60 * 60 * 1000,
//     });

//     console.log('✅ Signed URL generated for certificate (valid for 24 hours)');

//     return {
//       certificatePath: `gs://${certificateBucketName}/${fileName}`,
//       signedUrl: signedUrl,
//       certificateId: certificateId,
//       issueDate: issueDate,
//       expiryDate: expiryDate,
//       urlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
//     };

//   } catch (error) {
//     if (browser) {
//       await browser.close();
//     }
//     console.error('Error generating certificate:', error);
//     throw error;
//   }
// };

// /**
//  * Generate HTML content for certificate with A4 dimensions
//  */
// const generateCertificateHTML = (firmData, options) => {
//   const { certificateId, issueDate, expiryDate, trustBadgeBase64 } = options;
  
//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Jurinex Registration Certificate</title>
//     <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lato:wght@300;400;700&family=Pinyon+Script&display=swap" rel="stylesheet">
//     <style>
//         * {
//             margin: 0;
//             padding: 0;
//             box-sizing: border-box;
//         }

//         body {
//             margin: 0;
//             padding: 0;
//             background: #ffffff;
//             font-family: 'Lato', sans-serif;
//             width: 210mm;
//             height: 297mm;
//             display: flex;
//             justify-content: center;
//             align-items: center;
//         }

//         .certificate-container {
//             width: 210mm;
//             height: 297mm;
//             background: #fff;
//             position: relative;
//             padding: 20mm;
//             color: #1a1a1a;
//         }

//         .border-outer {
//             border: 2px solid #1AA49B;
//             height: 100%;
//             width: 100%;
//             box-sizing: border-box;
//             padding: 5px;
//             position: relative;
//         }

//         .border-inner {
//             border: 4px double #0f766e;
//             height: 100%;
//             width: 100%;
//             box-sizing: border-box;
//             padding: 40px;
//             position: relative;
//             background: #ffffff; 
//             display: flex;
//             flex-direction: column;
//         }

//         .corner {
//             position: absolute;
//             width: 30px;
//             height: 30px;
//             border: 2px solid #C5A059; 
//             z-index: 1;
//         }
//         .tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
//         .tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
//         .bl { bottom: 10px; left: 10px; border-right: none; border-top: none; }
//         .br { bottom: 10px; right: 10px; border-left: none; border-top: none; }

//         .header {
//             text-align: center;
//             margin-bottom: 30px;
//         }

//         .brand-name {
//             font-family: 'Cinzel', serif;
//             font-size: 28px;
//             color: #1AA49B;
//             letter-spacing: 4px;
//             text-transform: uppercase;
//             margin-bottom: 8px;
//             font-weight: 700;
//         }

//         .title {
//             font-family: 'Cinzel', serif;
//             font-size: 42px;
//             color: #111;
//             margin: 8px 0;
//             text-transform: uppercase;
//             letter-spacing: 1px;
//         }

//         .subtitle {
//             font-size: 14px;
//             color: #666;
//             text-transform: uppercase;
//             letter-spacing: 2px;
//             border-top: 1px solid #ddd;
//             border-bottom: 1px solid #ddd;
//             display: inline-block;
//             padding: 5px 25px;
//             margin-top: 5px;
//         }

//         .content {
//             text-align: center;
//             margin-top: 40px;
//             flex-grow: 1;
//             display: flex;
//             flex-direction: column;
//             justify-content: center;
//         }

//         .recipient-prefix {
//             font-style: italic;
//             color: #555;
//             margin-bottom: 8px;
//             font-size: 18px;
//         }

//         .recipient-name {
//             font-family: 'Arial Script', cursive;
//             font-size: 52px;
//             color: #0f766e;
//             margin: 8px 0 20px;
//             border-bottom: 1px solid #ccc;
//             display: inline-block;
//             padding: 0 50px 12px;
//             min-width: 400px;
//         }

//         .description {
//             font-size: 15px;
//             line-height: 1.7;
//             color: #444;
//             max-width: 650px;
//             margin: 0 auto;
//         }

//         .highlight {
//             font-weight: 700;
//             color: #1AA49B;
//         }

//         .footer {
//             margin-top: 40px;
//             margin-bottom: 20px;
//             display: flex;
//             justify-content: space-between;
//             align-items: flex-end;
//             padding: 0 30px;
//         }

//         .signature-block {
//             text-align: center;
//             width: 250px;
//             display: flex;
//             flex-direction: column;
//             align-items: center;
//         }

//         .signature-img {
//             font-family: 'Arial Script', cursive;
//             font-size: 18px;
//             color: #1a1a1a;
//             margin-bottom: 4px;
//             height: 40px;
//             display: flex;
//             align-items: flex-end;
//             justify-content: center;
//         }

//         .signature-line {
//             width: 100%;
//             height: 1px;
//             background: #333;
//             margin: 0 auto 10px;
//         }

//         .signature-title {
//             font-size: 11px;
//             text-transform: uppercase;
//             letter-spacing: 1px;
//             color: #666;
//             line-height: 1.3;
//             text-align: center;
//         }

//         .badge-image-container {
//             width: 120px;
//             height: 120px;
//             margin-bottom: -30px;
//             position: relative;
//             z-index: 5;
//             display: flex;
//             align-items: center;
//             justify-content: center;
//         }

//         .badge-image-container img {
//             max-width: 200%;
//             max-height: 200%;
//             object-fit: contain;
//             filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
//         }

//         .meta-data {
//             text-align: center;
//             font-size: 10px;
//             color: #999;
//             font-family: monospace;
//             padding-bottom: 5px;
//         }

//         @media print {
//             body { 
//                 background: none; 
//                 padding: 0; 
//                 display: block; 
//             }
//             .certificate-container { 
//                 width: 100%; 
//                 height: 100%; 
//                 padding: 20mm;
//             }
//         }
//     </style>
// </head>
// <body>
//     <div class="certificate-container">
//         <div class="border-outer">
//             <div class="corner tl"></div>
//             <div class="corner tr"></div>
//             <div class="corner bl"></div>
//             <div class="corner br"></div>

//             <div class="border-inner">
//                 <div class="header">
//                     <div class="brand-name">Jurinex</div>
//                     <div class="title">Certificate of Registration</div>
//                     <div class="subtitle">AI Partner Network · ${new Date().getFullYear()}-${new Date().getFullYear() + 1}</div>
//                 </div>

//                 <div class="content">
//                     <div class="recipient-prefix">This is to certify that</div>
//                     <div class="recipient-name">${escapeHtml(firmData.firm_name)}</div>

//                     <div class="description">
//                         has successfully completed all compliance verification protocols and is hereby recognized as an 
//                         <span class="highlight">Authorized Jurinex Partner</span>.
//                         <br><br>
//                         This firm is granted full access to the Jurinex Legal AI Intelligence Suite, utilizing advanced algorithms for high-speed document summarization, precedent analysis, and strategic insight generation.
//                     </div>
//                 </div>

//                 <div class="footer">
//                     <div class="signature-block">
//                         <div class="signature-img">Mr. Santosh Dehadrai</div>
//                         <div class="signature-line"></div>
//                         <div class="signature-title">CHIEF TECHNOLOGY OFFICER<br>JURINEX</div>
//                     </div>

//                     <div class="badge-image-container">
//                         ${trustBadgeBase64 ? `<img src="${trustBadgeBase64}" alt="NexIntel AI Trust Badge">` : ''}
//                     </div>

//                     <div class="signature-block">
//                         <div class="signature-img">${issueDate}</div>
//                         <div class="signature-line"></div>
//                         <div class="signature-title">DATE OF ISSUE</div>
//                     </div>
//                 </div>

//                 <div class="meta-data">
//                     Certificate ID: ${certificateId}  •  Verify at: verify.jurinex.ai/check  •  Valid until: ${expiryDate}
//                 </div>
//             </div>
//         </div>
//     </div>
// </body>
// </html>`;
// };

// /**
//  * Escape HTML to prevent XSS
//  */
// const escapeHtml = (text) => {
//   if (!text) return '';
//   const map = {
//     '&': '&amp;',
//     '<': '&lt;',
//     '>': '&gt;',
//     '"': '&quot;',
//     "'": '&#039;'
//   };
//   return text.replace(/[&<>"']/g, m => map[m]);
// };

// module.exports = {
//   generateCertificate
// };


const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { storage } = require('../config/gcs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios'); // Add this import
require('dotenv').config();

/**
 * Generate PDF certificate for a firm
 * @param {Object} firmData - Firm data from database
 * @returns {Promise<Object>} - Certificate file path and metadata
 */
const generateCertificate = async (firmData, certificateUuid = null) => {
  let browser = null;
  try {
    // Get certificate bucket name from env
    const certificateBucketName = process.env.CERTIFICATE_BUCKET_NAME;
    if (!certificateBucketName) {
      throw new Error('CERTIFICATE_BUCKET_NAME is not set in environment variables');
    }

    const bucket = storage.bucket(certificateBucketName);

    // Use provided UUID from database (this will be the certificate ID shown on the certificate)
    // If UUID is provided, use it directly; otherwise generate one (should not happen in normal flow)
    const certificateId = certificateUuid || uuidv4();
    const issueDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 12); // Valid for 1 year

    // Format dates
    const formattedIssueDate = issueDate.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    const formattedExpiryDate = expiryDate.toLocaleDateString('en-GB', { 
      month: 'short', 
      year: 'numeric' 
    });

    // Fetch trust badge from GCS bucket
    let trustBadgeBase64 = '';
    
    try {
      // Option 1: Fetch from bucket using the storage SDK
      const trustBadgeFile = bucket.file(`firms/${firmData.id}/certificates/trust-badge.png`);
      const [exists] = await trustBadgeFile.exists();
      
      if (exists) {
        const [trustBadgeBuffer] = await trustBadgeFile.download();
        trustBadgeBase64 = `data:image/png;base64,${trustBadgeBuffer.toString('base64')}`;
        console.log('✅ Trust badge loaded from GCS bucket');
        console.log('   Image size:', (trustBadgeBuffer.length / 1024).toFixed(2), 'KB');
      } else {
        console.warn('⚠️ Trust badge not found in GCS bucket at:', `firms/${firmData.id}/certificates/trust-badge.png`);
        
        // Fallback: Try to load from local filesystem
        const projectRoot = process.cwd();
        const possiblePaths = [
          path.join(projectRoot, 'Frontend/src/assets/trust-badge.png'),
          path.join(__dirname, '../../Frontend/src/assets/trust-badge.png'),
          path.join(__dirname, '../../../Frontend/src/assets/trust-badge.png'),
          path.join(projectRoot, 'assets/trust-badge.png'),
          path.join(__dirname, '../assets/trust-badge.png')
        ];
        
        for (const trustBadgePath of possiblePaths) {
          const normalizedPath = path.normalize(trustBadgePath);
          if (fs.existsSync(normalizedPath)) {
            try {
              const trustBadgeBuffer = fs.readFileSync(normalizedPath);
              trustBadgeBase64 = `data:image/png;base64,${trustBadgeBuffer.toString('base64')}`;
              console.log('✅ Trust badge loaded from local filesystem:', normalizedPath);
              break;
            } catch (error) {
              console.warn('⚠️ Error reading trust badge from', normalizedPath, ':', error.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching trust badge from GCS:', error.message);
      console.warn('⚠️ Certificate will be generated without trust badge image.');
    }
    
    if (!trustBadgeBase64) {
      console.warn('⚠️ Certificate will be generated without trust badge image.');
    }

    // Generate HTML content for certificate
    const htmlContent = generateCertificateHTML(firmData, {
      certificateId,
      issueDate: formattedIssueDate,
      expiryDate: formattedExpiryDate,
      trustBadgeBase64
    });

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set content and wait for fonts to load
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate PDF with A4 dimensions
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0'
      }
    });

    await browser.close();
    browser = null;

    // Upload to GCS (private upload)
    const fileName = `firms/${firmData.id}/certificates/certificate_${Date.now()}.pdf`;
    const file = bucket.file(fileName);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          firmId: firmData.id,
          firmName: firmData.firm_name,
          certificateId: certificateId,
          issueDate: issueDate.toISOString()
        }
      },
      resumable: false
    });

    console.log('✅ Certificate uploaded to GCS:', fileName);

    // Generate signed URL (valid for 24 hours)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    console.log('✅ Signed URL generated for certificate (valid for 24 hours)');

    return {
      certificatePath: `gs://${certificateBucketName}/${fileName}`,
      signedUrl: signedUrl,
      certificateId: certificateId,
      issueDate: issueDate,
      expiryDate: expiryDate,
      urlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('Error generating certificate:', error);
    throw error;
  }
};

/**
 * Generate HTML content for certificate with A4 dimensions
 */
const generateCertificateHTML = (firmData, options) => {
  const { certificateId, issueDate, expiryDate, trustBadgeBase64 } = options;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jurinex Registration Certificate</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lato:wght@300;400;700&family=Cormorant+Garamond:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: 'Lato', sans-serif;
            width: 210mm;
            height: 297mm;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .certificate-container {
            width: 210mm;
            height: 297mm;
            background: #fff;
            position: relative;
            padding: 20mm;
            color: #1a1a1a;
        }

        .border-outer {
            border: 2px solid #1AA49B;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
            padding: 5px;
            position: relative;
        }

        .border-inner {
            border: 4px double #0f766e;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
            padding: 40px;
            position: relative;
            background: #ffffff; 
            display: flex;
            flex-direction: column;
        }

        .corner {
            position: absolute;
            width: 30px;
            height: 30px;
            border: 2px solid #C5A059; 
            z-index: 1;
        }
        .tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
        .tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
        .bl { bottom: 10px; left: 10px; border-right: none; border-top: none; }
        .br { bottom: 10px; right: 10px; border-left: none; border-top: none; }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .brand-name {
            font-family: 'Cinzel', serif;
            font-size: 28px;
            color: #1AA49B;
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-bottom: 8px;
            font-weight: 700;
        }

        .title {
            font-family: 'Cinzel', serif;
            font-size: 42px;
            color: #111;
            margin: 8px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .subtitle {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 2px;
            border-top: 1px solid #ddd;
            border-bottom: 1px solid #ddd;
            display: inline-block;
            padding: 5px 25px;
            margin-top: 5px;
        }

        .content {
            text-align: center;
            margin-top: 40px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .recipient-prefix {
            font-style: italic;
            color: #555;
            margin-bottom: 8px;
            font-size: 18px;
        }

        .recipient-name {
            font-family: 'Playfair Display', serif;
            font-size: 56px;
            font-weight: 700;
            color: #0f766e;
            margin: 8px 0 20px;
            border-bottom: 2px solid #1AA49B;
            display: inline-block;
            padding: 0 50px 12px;
            min-width: 400px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .description {
            font-size: 15px;
            line-height: 1.7;
            color: #444;
            max-width: 650px;
            margin: 0 auto;
        }

        .highlight {
            font-weight: 700;
            color: #1AA49B;
        }

        .footer {
            margin-top: 40px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding: 0 30px;
        }

        .signature-block {
            text-align: center;
            width: 250px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .signature-img {
            font-family: 'Cormorant Garamond', serif;
            font-size: 20px;
            font-weight: 500;
            color: #1a1a1a;
            margin-bottom: 4px;
            height: 40px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
        }

        .signature-line {
            width: 100%;
            height: 1px;
            background: #333;
            margin: 0 auto 10px;
        }

        .signature-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #666;
            line-height: 1.3;
            text-align: center;
        }

        .badge-image-container {
            width: 120px;
            height: 120px;
            margin-bottom: -30px;
            position: relative;
            z-index: 5;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .badge-image-container img {
            max-width: 200%;
            max-height: 200%;
            object-fit: contain;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
        }

        .meta-data {
            text-align: center;
            font-size: 10px;
            color: #999;
            font-family: 'Courier New', monospace;
            padding-bottom: 5px;
            letter-spacing: 0.5px;
        }

        .cert-id {
            font-family: 'Courier New', monospace;
            font-weight: 600;
            color: #0f766e;
            letter-spacing: 1px;
        }

        @media print {
            body { 
                background: none; 
                padding: 0; 
                display: block; 
            }
            .certificate-container { 
                width: 100%; 
                height: 100%; 
                padding: 20mm;
            }
        }
    </style>
</head>
<body>
    <div class="certificate-container">
        <div class="border-outer">
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>

            <div class="border-inner">
                <div class="header">
                    <div class="brand-name">Jurinex</div>
                    <div class="title">Certificate of Registration</div>
                    <div class="subtitle">AI Partner Network · ${new Date().getFullYear()}-${new Date().getFullYear() + 1}</div>
                </div>

                <div class="content">
                    <div class="recipient-prefix">This is to certify that</div>
                    <div class="recipient-name">${escapeHtml(firmData.firm_name)}</div>

                    <div class="description">
                        has successfully completed all compliance verification protocols and is hereby recognized as an 
                        <span class="highlight">Authorized Jurinex Partner</span>.
                        <br><br>
                        This firm is granted full access to the Jurinex Legal AI Intelligence Suite, utilizing advanced algorithms for high-speed document summarization, precedent analysis, and strategic insight generation.
                    </div>
                </div>

                <div class="footer">
                    <div class="signature-block">
                        <div class="signature-img">Mr. Santosh Dehadrai</div>
                        <div class="signature-line"></div>
                        <div class="signature-title">CHIEF TECHNOLOGY OFFICER<br>JURINEX</div>
                    </div>

                    <div class="badge-image-container">
                        ${trustBadgeBase64 ? `<img src="${trustBadgeBase64}" alt="NexIntel AI Trust Badge">` : ''}
                    </div>

                    <div class="signature-block">
                        <div class="signature-img">${issueDate}</div>
                        <div class="signature-line"></div>
                        <div class="signature-title">DATE OF ISSUE</div>
                    </div>
                </div>

                <div class="meta-data">
                    Certificate ID: <span class="cert-id">${certificateId}</span>   <br>   •  Valid until: ${expiryDate}
                </div>
            </div>
        </div>
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
  generateCertificate
};