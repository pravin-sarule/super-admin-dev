// const axios = require('axios');

// // Assuming you have a database pool configured
// const pool = require('../config/docDB'); // Adjust path as needed

// // ---------------------
// // Get total count of all files
// // ---------------------
// const getTotalFilesCount = async (req, res) => {
//   try {
//     const query = `
//       SELECT 
//         COUNT(*) as total_files,
//         COUNT(CASE WHEN is_folder = true THEN 1 END) as total_folders,
//         COUNT(CASE WHEN is_folder = false THEN 1 END) as total_documents,
//         COALESCE(SUM(CASE WHEN is_folder = false AND page_count IS NOT NULL THEN page_count ELSE 0 END), 0) as total_pages,
//         COALESCE(SUM(CASE WHEN is_folder = false AND size IS NOT NULL THEN size ELSE 0 END), 0) as total_size,
//         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_files,
//         COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_files,
//         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_files,
//         COUNT(CASE WHEN ocr_completed_at IS NOT NULL THEN 1 END) as ocr_completed_files
//       FROM user_files
//       WHERE is_folder = false OR is_folder IS NULL
//     `;
    
//     const result = await pool.query(query);
//     const stats = result.rows[0];
    
//     // Calculate total OCR cost
//     const totalPages = parseInt(stats.total_pages) || 0;
//     const ocrCostPerThousandPagesUSD = 1.50; // $1.50 per 1000 pages for Document AI OCR
//     const totalOCRCostUSD = (totalPages / 1000) * ocrCostPerThousandPagesUSD;
    
//     // Get USD to INR conversion rate
//     let totalOCRCostINR = 0;
//     let conversionRate = 0;
    
//     try {
//       const currencyResponse = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR');
//       conversionRate = currencyResponse.data.rates.INR;
//       totalOCRCostINR = totalOCRCostUSD * conversionRate;
//     } catch (currencyErr) {
//       console.error('Error fetching currency conversion:', currencyErr.message);
//       // Fallback to approximate rate if API fails
//       conversionRate = 83; // Approximate fallback rate
//       totalOCRCostINR = totalOCRCostUSD * conversionRate;
//     }
    
//     res.status(200).json({
//       success: true,
//       data: {
//         total_files: parseInt(stats.total_files) || 0,
//         total_folders: parseInt(stats.total_folders) || 0,
//         total_documents: parseInt(stats.total_documents) || 0,
//         total_pages: totalPages,
//         total_size_bytes: parseInt(stats.total_size) || 0,
//         total_size_mb: ((parseInt(stats.total_size) || 0) / (1024 * 1024)).toFixed(2),
//         total_size_gb: ((parseInt(stats.total_size) || 0) / (1024 * 1024 * 1024)).toFixed(2),
//         completed_files: parseInt(stats.completed_files) || 0,
//         processing_files: parseInt(stats.processing_files) || 0,
//         failed_files: parseInt(stats.failed_files) || 0,
//         ocr_completed_files: parseInt(stats.ocr_completed_files) || 0,
//         ocr_cost: {
//           total_pages: totalPages,
//           cost_per_1000_pages_usd: ocrCostPerThousandPagesUSD,
//           cost_per_page_usd: parseFloat((ocrCostPerThousandPagesUSD / 1000).toFixed(6)),
//           total_cost_usd: parseFloat(totalOCRCostUSD.toFixed(4)),
//           total_cost_inr: parseFloat(totalOCRCostINR.toFixed(2)),
//           conversion_rate: conversionRate,
//           currency: 'INR'
//         }
//       }
//     });
//   } catch (err) {
//     console.error('Error fetching total files count:', err.message);
//     console.error('Full error:', err);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch total files count: ' + err.message 
//     });
//   }
// };

// // ---------------------
// // Get user-specific files count with page details
// // ---------------------
// const getUserFilesCount = async (req, res) => {
//   try {
//     const { userId } = req.params;
    
//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         error: 'User ID is required'
//       });
//     }
    
//     // Get user summary statistics
//     const summaryQuery = `
//       SELECT 
//         COUNT(*) as total_files,
//         COUNT(CASE WHEN is_folder = true THEN 1 END) as total_folders,
//         COUNT(CASE WHEN is_folder = false OR is_folder IS NULL THEN 1 END) as total_documents,
//         COALESCE(SUM(CASE WHEN (is_folder = false OR is_folder IS NULL) AND page_count IS NOT NULL THEN page_count ELSE 0 END), 0) as total_pages,
//         COALESCE(SUM(CASE WHEN (is_folder = false OR is_folder IS NULL) AND size IS NOT NULL THEN size ELSE 0 END), 0) as total_size,
//         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_files,
//         COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_files,
//         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_files,
//         COUNT(CASE WHEN ocr_completed_at IS NOT NULL THEN 1 END) as ocr_completed_files
//       FROM user_files
//       WHERE user_id = $1 AND (is_folder = false OR is_folder IS NULL)
//     `;
    
//     const summaryResult = await pool.query(summaryQuery, [parseInt(userId)]);
//     const summary = summaryResult.rows[0];
    
//     // Get detailed file list with page counts
//     const filesQuery = `
//       SELECT 
//         id,
//         user_id,
//         originalname,
//         gcs_path,
//         folder_path,
//         mimetype,
//         size,
//         status,
//         processing_progress,
//         page_count,
//         ocr_completed_at,
//         ocr_cost_total,
//         currency,
//         created_at,
//         updated_at,
//         processed_at,
//         is_folder,
//         current_operation,
//         chunking_method,
//         firm_id,
//         full_text_content,
//         summary,
//         edited_docx_path,
//         edited_pdf_path
//       FROM user_files
//       WHERE user_id = $1 AND (is_folder = false OR is_folder IS NULL)
//       ORDER BY created_at DESC
//     `;
    
//     const filesResult = await pool.query(filesQuery, [parseInt(userId)]);
    
//     // Calculate total OCR cost
//     const totalPages = parseInt(summary.total_pages) || 0;
//     const ocrCostPerThousandPagesUSD = 1.50; // $1.50 per 1000 pages for Document AI OCR
//     const totalOCRCostUSD = (totalPages / 1000) * ocrCostPerThousandPagesUSD;
    
//     // Get USD to INR conversion rate
//     let totalOCRCostINR = 0;
//     let conversionRate = 0;
    
//     try {
//       const currencyResponse = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR');
//       conversionRate = currencyResponse.data.rates.INR;
//       totalOCRCostINR = totalOCRCostUSD * conversionRate;
//     } catch (currencyErr) {
//       console.error('Error fetching currency conversion:', currencyErr.message);
//       conversionRate = 83; // Approximate fallback rate
//       totalOCRCostINR = totalOCRCostUSD * conversionRate;
//     }
    
//     // Calculate individual file costs and enrich data
//     const enrichedFiles = filesResult.rows.map(file => {
//       const filePages = parseInt(file.page_count) || 0;
//       const fileCostUSD = (filePages / 1000) * ocrCostPerThousandPagesUSD;
//       const fileCostINR = fileCostUSD * conversionRate;
      
//       return {
//         id: file.id,
//         user_id: file.user_id,
//         file_name: file.originalname,
//         gcs_path: file.gcs_path,
//         folder_path: file.folder_path,
//         mimetype: file.mimetype,
//         size_bytes: parseInt(file.size) || 0,
//         size_mb: ((parseInt(file.size) || 0) / (1024 * 1024)).toFixed(2),
//         size_kb: ((parseInt(file.size) || 0) / 1024).toFixed(2),
//         status: file.status,
//         processing_progress: file.processing_progress,
//         page_count: filePages,
//         ocr_completed_at: file.ocr_completed_at,
//         ocr_cost_total: file.ocr_cost_total,
//         stored_currency: file.currency,
//         created_at: file.created_at,
//         updated_at: file.updated_at,
//         processed_at: file.processed_at,
//         current_operation: file.current_operation,
//         chunking_method: file.chunking_method,
//         firm_id: file.firm_id,
//         has_full_text: !!file.full_text_content,
//         has_summary: !!file.summary,
//         has_edited_docx: !!file.edited_docx_path,
//         has_edited_pdf: !!file.edited_pdf_path,
//         ocr_cost: {
//           pages: filePages,
//           cost_per_1000_pages_usd: ocrCostPerThousandPagesUSD,
//           cost_per_page_usd: parseFloat((ocrCostPerThousandPagesUSD / 1000).toFixed(6)),
//           total_cost_usd: parseFloat(fileCostUSD.toFixed(4)),
//           total_cost_inr: parseFloat(fileCostINR.toFixed(2)),
//           currency: 'INR'
//         }
//       };
//     });
    
//     res.status(200).json({
//       success: true,
//       data: {
//         user_id: parseInt(userId),
//         summary: {
//           total_files: parseInt(summary.total_files) || 0,
//           total_folders: parseInt(summary.total_folders) || 0,
//           total_documents: parseInt(summary.total_documents) || 0,
//           total_pages: totalPages,
//           total_size_bytes: parseInt(summary.total_size) || 0,
//           total_size_mb: ((parseInt(summary.total_size) || 0) / (1024 * 1024)).toFixed(2),
//           total_size_gb: ((parseInt(summary.total_size) || 0) / (1024 * 1024 * 1024)).toFixed(2),
//           completed_files: parseInt(summary.completed_files) || 0,
//           processing_files: parseInt(summary.processing_files) || 0,
//           failed_files: parseInt(summary.failed_files) || 0,
//           ocr_completed_files: parseInt(summary.ocr_completed_files) || 0,
//           total_ocr_cost: {
//             total_pages: totalPages,
//             cost_per_1000_pages_usd: ocrCostPerThousandPagesUSD,
//             cost_per_page_usd: parseFloat((ocrCostPerThousandPagesUSD / 1000).toFixed(6)),
//             total_cost_usd: parseFloat(totalOCRCostUSD.toFixed(4)),
//             total_cost_inr: parseFloat(totalOCRCostINR.toFixed(2)),
//             conversion_rate: conversionRate,
//             currency: 'INR'
//           }
//         },
//         files: enrichedFiles,
//         count: enrichedFiles.length
//       }
//     });
//   } catch (err) {
//     console.error('Error fetching user files count:', err.message);
//     console.error('Full error:', err);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch user files count: ' + err.message 
//     });
//   }
// };

// // ---------------------
// // Get files grouped by user with costs
// // ---------------------
// const getFilesGroupedByUser = async (req, res) => {
//   try {
//     const query = `
//       SELECT 
//         user_id,
//         COUNT(*) as total_files,
//         COUNT(CASE WHEN is_folder = false OR is_folder IS NULL THEN 1 END) as total_documents,
//         COALESCE(SUM(CASE WHEN (is_folder = false OR is_folder IS NULL) AND page_count IS NOT NULL THEN page_count ELSE 0 END), 0) as total_pages,
//         COALESCE(SUM(CASE WHEN (is_folder = false OR is_folder IS NULL) AND size IS NOT NULL THEN size ELSE 0 END), 0) as total_size,
//         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_files,
//         COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_files,
//         COUNT(CASE WHEN ocr_completed_at IS NOT NULL THEN 1 END) as ocr_completed_files
//       FROM user_files
//       WHERE is_folder = false OR is_folder IS NULL
//       GROUP BY user_id
//       ORDER BY total_pages DESC
//     `;
    
//     const result = await pool.query(query);
    
//     // Get USD to INR conversion rate
//     let conversionRate = 0;
//     try {
//       const currencyResponse = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR');
//       conversionRate = currencyResponse.data.rates.INR;
//     } catch (currencyErr) {
//       console.error('Error fetching currency conversion:', currencyErr.message);
//       conversionRate = 83; // Approximate fallback rate
//     }
    
//     const ocrCostPerThousandPagesUSD = 1.50; // $1.50 per 1000 pages
    
//     // Fetch user details from users table
//     const userIds = result.rows.map(row => row.user_id).filter(id => id);
//     let userMap = {};
    
//     if (userIds.length > 0) {
//       try {
//         const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
//         const userQuery = `
//           SELECT id, username, email
//           FROM users
//           WHERE id IN (${placeholders})
//         `;
//         const userResult = await pool.query(userQuery, userIds);
        
//         userResult.rows.forEach(user => {
//           userMap[user.id] = {
//             username: user.username || `User ${user.id}`,
//             email: user.email || ''
//           };
//         });
//       } catch (userErr) {
//         console.error('Error fetching user details:', userErr.message);
//       }
//     }
    
//     // Enrich with cost calculations and user details
//     const enrichedData = result.rows.map(row => {
//       const totalPages = parseInt(row.total_pages) || 0;
//       const totalCostUSD = (totalPages / 1000) * ocrCostPerThousandPagesUSD;
//       const totalCostINR = totalCostUSD * conversionRate;
      
//       return {
//         user_id: row.user_id,
//         user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
//         user_email: userMap[row.user_id]?.email || null,
//         total_files: parseInt(row.total_files) || 0,
//         total_documents: parseInt(row.total_documents) || 0,
//         total_pages: totalPages,
//         total_size_bytes: parseInt(row.total_size) || 0,
//         total_size_mb: ((parseInt(row.total_size) || 0) / (1024 * 1024)).toFixed(2),
//         total_size_gb: ((parseInt(row.total_size) || 0) / (1024 * 1024 * 1024)).toFixed(2),
//         completed_files: parseInt(row.completed_files) || 0,
//         processing_files: parseInt(row.processing_files) || 0,
//         ocr_completed_files: parseInt(row.ocr_completed_files) || 0,
//         ocr_cost: {
//           total_pages: totalPages,
//           cost_per_1000_pages_usd: ocrCostPerThousandPagesUSD,
//           cost_per_page_usd: parseFloat((ocrCostPerThousandPagesUSD / 1000).toFixed(6)),
//           total_cost_usd: parseFloat(totalCostUSD.toFixed(4)),
//           total_cost_inr: parseFloat(totalCostINR.toFixed(2)),
//           currency: 'INR'
//         }
//       };
//     });
    
//     res.status(200).json({
//       success: true,
//       data: enrichedData,
//       count: enrichedData.length,
//       conversion_rate: conversionRate
//     });
//   } catch (err) {
//     console.error('Error fetching files grouped by user:', err.message);
//     console.error('Full error:', err);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch files grouped by user: ' + err.message 
//     });
//   }
// };

// module.exports = {
//   getTotalFilesCount,
//   getUserFilesCount,
//   getFilesGroupedByUser
// };



const axios = require('axios');

// Database pools
const docPool = require('../config/docDB'); // Document database pool
const authPool = require('../config/db'); // Auth database pool for users table

// ---------------------
// Get total count of all files
// ---------------------
const getTotalFilesCount = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_files,
        COUNT(CASE WHEN is_folder = true THEN 1 END) as total_folders,
        COUNT(CASE WHEN is_folder = false THEN 1 END) as total_documents,
        COALESCE(SUM(CASE WHEN is_folder = false AND page_count IS NOT NULL THEN page_count ELSE 0 END), 0) as total_pages,
        COALESCE(SUM(CASE WHEN is_folder = false AND size IS NOT NULL THEN size ELSE 0 END), 0) as total_size,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_files,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_files,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_files,
        COUNT(CASE WHEN ocr_completed_at IS NOT NULL THEN 1 END) as ocr_completed_files
      FROM user_files
      WHERE is_folder = false OR is_folder IS NULL
    `;
    
    const result = await docPool.query(query);
    const stats = result.rows[0];
    
    // Calculate total OCR cost
    const totalPages = parseInt(stats.total_pages) || 0;
    const ocrCostPerThousandPagesUSD = 1.50; // $1.50 per 1000 pages for Document AI OCR
    const totalOCRCostUSD = (totalPages / 1000) * ocrCostPerThousandPagesUSD;
    
    // Get USD to INR conversion rate
    let totalOCRCostINR = 0;
    let conversionRate = 0;
    
    try {
      const currencyResponse = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR');
      conversionRate = currencyResponse.data.rates.INR;
      totalOCRCostINR = totalOCRCostUSD * conversionRate;
    } catch (currencyErr) {
      console.error('Error fetching currency conversion:', currencyErr.message);
      // Fallback to approximate rate if API fails
      conversionRate = 83; // Approximate fallback rate
      totalOCRCostINR = totalOCRCostUSD * conversionRate;
    }
    
    res.status(200).json({
      success: true,
      data: {
        total_files: parseInt(stats.total_files) || 0,
        total_folders: parseInt(stats.total_folders) || 0,
        total_documents: parseInt(stats.total_documents) || 0,
        total_pages: totalPages,
        total_size_bytes: parseInt(stats.total_size) || 0,
        total_size_mb: ((parseInt(stats.total_size) || 0) / (1024 * 1024)).toFixed(2),
        total_size_gb: ((parseInt(stats.total_size) || 0) / (1024 * 1024 * 1024)).toFixed(2),
        completed_files: parseInt(stats.completed_files) || 0,
        processing_files: parseInt(stats.processing_files) || 0,
        failed_files: parseInt(stats.failed_files) || 0,
        ocr_completed_files: parseInt(stats.ocr_completed_files) || 0,
        ocr_cost: {
          total_pages: totalPages,
          cost_per_1000_pages_usd: ocrCostPerThousandPagesUSD,
          cost_per_page_usd: parseFloat((ocrCostPerThousandPagesUSD / 1000).toFixed(6)),
          total_cost_usd: parseFloat(totalOCRCostUSD.toFixed(4)),
          total_cost_inr: parseFloat(totalOCRCostINR.toFixed(2)),
          conversion_rate: conversionRate,
          currency: 'INR'
        }
      }
    });
  } catch (err) {
    console.error('Error fetching total files count:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch total files count: ' + err.message 
    });
  }
};

// ---------------------
// Get user-specific files count with page details
// ---------------------
const getUserFilesCount = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Get user summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_files,
        COUNT(CASE WHEN is_folder = true THEN 1 END) as total_folders,
        COUNT(CASE WHEN is_folder = false OR is_folder IS NULL THEN 1 END) as total_documents,
        COALESCE(SUM(CASE WHEN (is_folder = false OR is_folder IS NULL) AND page_count IS NOT NULL THEN page_count ELSE 0 END), 0) as total_pages,
        COALESCE(SUM(CASE WHEN (is_folder = false OR is_folder IS NULL) AND size IS NOT NULL THEN size ELSE 0 END), 0) as total_size,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_files,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_files,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_files,
        COUNT(CASE WHEN ocr_completed_at IS NOT NULL THEN 1 END) as ocr_completed_files
      FROM user_files
      WHERE user_id = $1 AND (is_folder = false OR is_folder IS NULL)
    `;
    
    const summaryResult = await docPool.query(summaryQuery, [parseInt(userId)]);
    const summary = summaryResult.rows[0];
    
    // Fetch user details from auth database
    let userName = `User ${userId}`;
    let userEmail = null;
    
    try {
      const userQuery = `SELECT username, email FROM users WHERE id = $1`;
      const userResult = await authPool.query(userQuery, [parseInt(userId)]);
      
      if (userResult.rows.length > 0) {
        userName = userResult.rows[0].username || userName;
        userEmail = userResult.rows[0].email;
      }
    } catch (userErr) {
      console.error('Error fetching user details:', userErr.message);
    }
    
    // Get detailed file list with page counts
    const filesQuery = `
      SELECT 
        id,
        user_id,
        originalname,
        gcs_path,
        folder_path,
        mimetype,
        size,
        status,
        processing_progress,
        page_count,
        ocr_completed_at,
        ocr_cost_total,
        currency,
        created_at,
        updated_at,
        processed_at,
        is_folder,
        current_operation,
        chunking_method,
        firm_id,
        full_text_content,
        summary,
        edited_docx_path,
        edited_pdf_path
      FROM user_files
      WHERE user_id = $1 AND (is_folder = false OR is_folder IS NULL)
      ORDER BY created_at DESC
    `;
    
    const filesResult = await docPool.query(filesQuery, [parseInt(userId)]);
    
    // Calculate total OCR cost
    const totalPages = parseInt(summary.total_pages) || 0;
    const ocrCostPerThousandPagesUSD = 1.50; // $1.50 per 1000 pages for Document AI OCR
    const totalOCRCostUSD = (totalPages / 1000) * ocrCostPerThousandPagesUSD;
    
    // Get USD to INR conversion rate
    let totalOCRCostINR = 0;
    let conversionRate = 0;
    
    try {
      const currencyResponse = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR');
      conversionRate = currencyResponse.data.rates.INR;
      totalOCRCostINR = totalOCRCostUSD * conversionRate;
    } catch (currencyErr) {
      console.error('Error fetching currency conversion:', currencyErr.message);
      conversionRate = 83; // Approximate fallback rate
      totalOCRCostINR = totalOCRCostUSD * conversionRate;
    }
    
    // Calculate individual file costs and enrich data
    const enrichedFiles = filesResult.rows.map(file => {
      const filePages = parseInt(file.page_count) || 0;
      const fileCostUSD = (filePages / 1000) * ocrCostPerThousandPagesUSD;
      const fileCostINR = fileCostUSD * conversionRate;
      
      return {
        id: file.id,
        user_id: file.user_id,
        user_name: userName,
        user_email: userEmail,
        file_name: file.originalname,
        gcs_path: file.gcs_path,
        folder_path: file.folder_path,
        mimetype: file.mimetype,
        size_bytes: parseInt(file.size) || 0,
        size_mb: ((parseInt(file.size) || 0) / (1024 * 1024)).toFixed(2),
        size_kb: ((parseInt(file.size) || 0) / 1024).toFixed(2),
        status: file.status,
        processing_progress: file.processing_progress,
        page_count: filePages,
        ocr_completed_at: file.ocr_completed_at,
        ocr_cost_total: file.ocr_cost_total,
        stored_currency: file.currency,
        created_at: file.created_at,
        updated_at: file.updated_at,
        processed_at: file.processed_at,
        current_operation: file.current_operation,
        chunking_method: file.chunking_method,
        firm_id: file.firm_id,
        has_full_text: !!file.full_text_content,
        has_summary: !!file.summary,
        has_edited_docx: !!file.edited_docx_path,
        has_edited_pdf: !!file.edited_pdf_path,
        ocr_cost: {
          pages: filePages,
          cost_per_1000_pages_usd: ocrCostPerThousandPagesUSD,
          cost_per_page_usd: parseFloat((ocrCostPerThousandPagesUSD / 1000).toFixed(6)),
          total_cost_usd: parseFloat(fileCostUSD.toFixed(4)),
          total_cost_inr: parseFloat(fileCostINR.toFixed(2)),
          currency: 'INR'
        }
      };
    });
    
    res.status(200).json({
      success: true,
      data: {
        user_id: parseInt(userId),
        user_name: userName,
        user_email: userEmail,
        summary: {
          total_files: parseInt(summary.total_files) || 0,
          total_folders: parseInt(summary.total_folders) || 0,
          total_documents: parseInt(summary.total_documents) || 0,
          total_pages: totalPages,
          total_size_bytes: parseInt(summary.total_size) || 0,
          total_size_mb: ((parseInt(summary.total_size) || 0) / (1024 * 1024)).toFixed(2),
          total_size_gb: ((parseInt(summary.total_size) || 0) / (1024 * 1024 * 1024)).toFixed(2),
          completed_files: parseInt(summary.completed_files) || 0,
          processing_files: parseInt(summary.processing_files) || 0,
          failed_files: parseInt(summary.failed_files) || 0,
          ocr_completed_files: parseInt(summary.ocr_completed_files) || 0,
          total_ocr_cost: {
            total_pages: totalPages,
            cost_per_1000_pages_usd: ocrCostPerThousandPagesUSD,
            cost_per_page_usd: parseFloat((ocrCostPerThousandPagesUSD / 1000).toFixed(6)),
            total_cost_usd: parseFloat(totalOCRCostUSD.toFixed(4)),
            total_cost_inr: parseFloat(totalOCRCostINR.toFixed(2)),
            conversion_rate: conversionRate,
            currency: 'INR'
          }
        },
        files: enrichedFiles,
        count: enrichedFiles.length
      }
    });
  } catch (err) {
    console.error('Error fetching user files count:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user files count: ' + err.message 
    });
  }
};

// ---------------------
// Get files grouped by user with costs
// ---------------------
const getFilesGroupedByUser = async (req, res) => {
  try {
    const query = `
      SELECT 
        user_id,
        COUNT(*) as total_files,
        COUNT(CASE WHEN is_folder = false OR is_folder IS NULL THEN 1 END) as total_documents,
        COALESCE(SUM(CASE WHEN (is_folder = false OR is_folder IS NULL) AND page_count IS NOT NULL THEN page_count ELSE 0 END), 0) as total_pages,
        COALESCE(SUM(CASE WHEN (is_folder = false OR is_folder IS NULL) AND size IS NOT NULL THEN size ELSE 0 END), 0) as total_size,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_files,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_files,
        COUNT(CASE WHEN ocr_completed_at IS NOT NULL THEN 1 END) as ocr_completed_files
      FROM user_files
      WHERE is_folder = false OR is_folder IS NULL
      GROUP BY user_id
      ORDER BY total_pages DESC
    `;
    
    const result = await docPool.query(query);
    
    // Get USD to INR conversion rate
    let conversionRate = 0;
    try {
      const currencyResponse = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR');
      conversionRate = currencyResponse.data.rates.INR;
    } catch (currencyErr) {
      console.error('Error fetching currency conversion:', currencyErr.message);
      conversionRate = 83; // Approximate fallback rate
    }
    
    const ocrCostPerThousandPagesUSD = 1.50; // $1.50 per 1000 pages
    
    // Fetch user details from auth database - USING authPool
    const userIds = result.rows.map(row => row.user_id).filter(id => id);
    const userMap = {};
    
    if (userIds.length > 0) {
      try {
        const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
        const userQuery = `
          SELECT id, username, email
          FROM users
          WHERE id IN (${placeholders})
        `;
        const userResult = await authPool.query(userQuery, userIds);
        
        userResult.rows.forEach(user => {
          userMap[user.id] = {
            username: user.username || `User ${user.id}`,
            email: user.email || ''
          };
        });
      } catch (userErr) {
        console.error('Error fetching user details:', userErr.message);
      }
    }
    
    // Enrich with cost calculations and user details
    const enrichedData = result.rows.map(row => {
      const totalPages = parseInt(row.total_pages) || 0;
      const totalCostUSD = (totalPages / 1000) * ocrCostPerThousandPagesUSD;
      const totalCostINR = totalCostUSD * conversionRate;
      
      return {
        user_id: row.user_id,
        user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
        user_email: userMap[row.user_id]?.email || null,
        total_files: parseInt(row.total_files) || 0,
        total_documents: parseInt(row.total_documents) || 0,
        total_pages: totalPages,
        total_size_bytes: parseInt(row.total_size) || 0,
        total_size_mb: ((parseInt(row.total_size) || 0) / (1024 * 1024)).toFixed(2),
        total_size_gb: ((parseInt(row.total_size) || 0) / (1024 * 1024 * 1024)).toFixed(2),
        completed_files: parseInt(row.completed_files) || 0,
        processing_files: parseInt(row.processing_files) || 0,
        ocr_completed_files: parseInt(row.ocr_completed_files) || 0,
        ocr_cost: {
          total_pages: totalPages,
          cost_per_1000_pages_usd: ocrCostPerThousandPagesUSD,
          cost_per_page_usd: parseFloat((ocrCostPerThousandPagesUSD / 1000).toFixed(6)),
          total_cost_usd: parseFloat(totalCostUSD.toFixed(4)),
          total_cost_inr: parseFloat(totalCostINR.toFixed(2)),
          currency: 'INR'
        }
      };
    });
    
    res.status(200).json({
      success: true,
      data: enrichedData,
      count: enrichedData.length,
      conversion_rate: conversionRate
    });
  } catch (err) {
    console.error('Error fetching files grouped by user:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch files grouped by user: ' + err.message 
    });
  }
};
// ---------------------
// Heartbeat endpoint - Get real-time file stats
// ---------------------
const getHeartbeatFileStats = async (req, res) => {
  try {
    console.log('💓 File heartbeat request received at:', new Date().toISOString());
    
    const query = `
      SELECT 
        COUNT(*) as total_files,
        COUNT(CASE WHEN is_folder = true THEN 1 END) as total_folders,
        COUNT(CASE WHEN is_folder = false THEN 1 END) as total_documents,
        COALESCE(SUM(CASE WHEN is_folder = false AND page_count IS NOT NULL THEN page_count ELSE 0 END), 0) as total_pages,
        COALESCE(SUM(CASE WHEN is_folder = false AND size IS NOT NULL THEN size ELSE 0 END), 0) as total_size
      FROM user_files
      WHERE is_folder = false OR is_folder IS NULL
    `;
    
    const result = await docPool.query(query);
    const stats = result.rows[0];
    
    // Calculate total OCR cost
    const totalPages = parseInt(stats.total_pages) || 0;
    const ocrCostPerThousandPagesUSD = 1.50;
    const totalOCRCostUSD = (totalPages / 1000) * ocrCostPerThousandPagesUSD;
    
    // Get USD to INR conversion rate
    let totalOCRCostINR = 0;
    let conversionRate = 83;
    
    try {
      const currencyResponse = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR');
      conversionRate = currencyResponse.data.rates.INR;
      totalOCRCostINR = totalOCRCostUSD * conversionRate;
    } catch (currencyErr) {
      totalOCRCostINR = totalOCRCostUSD * conversionRate;
    }
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        file_stats: {
          total_files: parseInt(stats.total_files) || 0,
          total_folders: parseInt(stats.total_folders) || 0,
          total_documents: parseInt(stats.total_documents) || 0,
          total_pages: totalPages,
          total_size_mb: ((parseInt(stats.total_size) || 0) / (1024 * 1024)).toFixed(2),
          total_size_gb: ((parseInt(stats.total_size) || 0) / (1024 * 1024 * 1024)).toFixed(2),
          ocr_cost: {
            total_pages: totalPages,
            cost_per_1000_pages_usd: ocrCostPerThousandPagesUSD,
            cost_per_page_usd: parseFloat((ocrCostPerThousandPagesUSD / 1000).toFixed(6)),
            total_cost_usd: parseFloat(totalOCRCostUSD.toFixed(4)),
            total_cost_inr: parseFloat(totalOCRCostINR.toFixed(2)),
            conversion_rate: conversionRate,
            currency: 'INR'
          }
        }
      }
    });
  } catch (err) {
    console.error('Error in file heartbeat endpoint:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch file heartbeat stats: ' + err.message 
    });
  }
};

module.exports = {
  getTotalFilesCount,
  getUserFilesCount,
  getFilesGroupedByUser,
  getHeartbeatFileStats  // Add this new function
};
