// const paymentPool = require('../config/payment_DB');
// const authPool = require('../config/db'); // Auth database pool

// // ---------------------
// // Get all token usage logs with user information
// // ---------------------
// const getAllTokenUsageLogs = async (req, res) => {
//   try {
//     const { limit = 1000, offset = 0, userId, modelName, userName, startDate, endDate, all = false } = req.query;

//     let query = `
//       SELECT 
//         t.user_id,
//         t.tokens_used,
//         t.remaining_tokens,
//         t.action_description,
//         t.used_at,
//         t.request_type,
//         t.firm_id,
//         t.model_name,
//         t.input_tokens,
//         t.output_tokens,
//         t.total_tokens,
//         t.total_cost,
//         t.session_id
//       FROM token_usage_logs t
//       WHERE 1=1
//     `;
    
//     const queryParams = [];
//     let paramCount = 0;
    
//     // If 'all' is true, skip date filtering
//     const shouldFilterByDate = !all && (startDate || endDate);
    
//     // If userName filter is provided, first get matching user IDs from auth DB
//     let filteredUserIds = null;
//     if (userName) {
//       try {
//         const userNameQuery = `
//           SELECT id
//           FROM users
//           WHERE username ILIKE $1 OR email ILIKE $1
//         `;
//         const userNameResult = await authPool.query(userNameQuery, [`%${userName}%`]);
//         filteredUserIds = userNameResult.rows.map(row => row.id);
        
//         if (filteredUserIds.length === 0) {
//           return res.status(200).json({
//             success: true,
//             data: [],
//             count: 0
//           });
//         }
        
//         const userIdPlaceholders = filteredUserIds.map((_, index) => `$${paramCount + index + 1}`).join(',');
//         query += ` AND t.user_id IN (${userIdPlaceholders})`;
//         queryParams.push(...filteredUserIds);
//         paramCount += filteredUserIds.length;
//       } catch (userErr) {
//         console.error('Error fetching users by name:', userErr.message);
//       }
//     }
    
//     if (userId) {
//       paramCount++;
//       query += ` AND t.user_id = $${paramCount}`;
//       queryParams.push(parseInt(userId));
//     }
    
//     if (modelName) {
//       paramCount++;
//       query += ` AND t.model_name ILIKE $${paramCount}`;
//       queryParams.push(`%${modelName}%`);
//     }
    
//     if (shouldFilterByDate) {
//       if (startDate) {
//         paramCount++;
//         query += ` AND t.used_at >= $${paramCount}::timestamp`;
//         queryParams.push(startDate);
//       }
//       if (endDate) {
//         paramCount++;
//         query += ` AND t.used_at < ($${paramCount}::timestamp + INTERVAL '1 day')`;
//         queryParams.push(endDate);
//       }
//     }
    
//     query += ` ORDER BY t.used_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
//     queryParams.push(parseInt(limit), parseInt(offset));

//     console.log('📊 Query:', query);
//     console.log('📊 Query params:', queryParams);
    
//     const result = await paymentPool.query(query, queryParams);
    
//     console.log('📊 Query result count:', result.rows.length);
    
//     // Fetch user names from auth database
//     const userIds = [...new Set(result.rows.map(row => row.user_id).filter(id => id))];
//     const userMap = {};
    
//     if (userIds.length > 0) {
//       try {
//         const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
//         const userQuery = `
//           SELECT id, username, email
//           FROM users
//           WHERE id IN (${placeholders})
//         `;
//         const userResult = await authPool.query(userQuery, userIds);
        
//         userResult.rows.forEach(user => {
//           userMap[user.id] = {
//             username: user.username || `User ${user.id}`,
//             email: user.email || ''
//           };
//         });
//       } catch (userErr) {
//         console.error('Error fetching user names:', userErr.message);
//       }
//     }
    
//     // Enrich the results with user names
//     const enrichedData = result.rows.map(row => ({
//       ...row,
//       user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
//       user_email: userMap[row.user_id]?.email || null,
//       // Add a unique ID for frontend key prop
//       id: `${row.user_id}-${row.session_id || ''}-${new Date(row.used_at).getTime()}`
//     }));
    
//     res.status(200).json({
//       success: true,
//       data: enrichedData,
//       count: enrichedData.length
//     });
//   } catch (err) {
//     console.error('Error fetching token usage logs:', err.message);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch token usage logs: ' + err.message 
//     });
//   }
// };

// // ---------------------
// // Get aggregated statistics
// // ---------------------
// const getTokenUsageStats = async (req, res) => {
//   try {
//     const { startDate, endDate } = req.query;
//     let dateFilter = '';
//     const queryParams = [];
    
//     if (startDate && endDate) {
//       dateFilter = 'WHERE used_at >= $1::timestamp AND used_at < ($2::timestamp + INTERVAL \'1 day\')';
//       queryParams.push(startDate, endDate);
//     } else if (startDate) {
//       dateFilter = 'WHERE used_at >= $1::timestamp';
//       queryParams.push(startDate);
//     } else if (endDate) {
//       dateFilter = 'WHERE used_at < ($1::timestamp + INTERVAL \'1 day\')';
//       queryParams.push(endDate);
//     }
    
//     console.log('📊 Stats query date filter:', dateFilter);
//     console.log('📊 Stats query params:', queryParams);
    
//     // Total statistics
//     const totalStatsQuery = `
//       SELECT 
//         COUNT(*) as total_requests,
//         COUNT(DISTINCT user_id) as unique_users,
//         COUNT(DISTINCT model_name) as unique_models,
//         COALESCE(SUM(total_tokens), 0) as total_tokens,
//         COALESCE(SUM(input_tokens), 0) as total_input_tokens,
//         COALESCE(SUM(output_tokens), 0) as total_output_tokens,
//         COALESCE(SUM(total_cost), 0) as total_cost,
//         COALESCE(SUM(tokens_used), 0) as total_tokens_used,
//         COALESCE(AVG(remaining_tokens), 0) as avg_remaining_tokens
//       FROM token_usage_logs
//       ${dateFilter}
//     `;
//     const totalStats = await paymentPool.query(totalStatsQuery, queryParams);
    
//     // Get total users from auth database
//     let totalUsersCount = 0;
//     try {
//       const totalUsersQuery = `SELECT COUNT(*) as total FROM users`;
//       const totalUsersResult = await authPool.query(totalUsersQuery);
//       totalUsersCount = parseInt(totalUsersResult.rows[0]?.total || 0);
//     } catch (userErr) {
//       console.error('Error fetching total users count:', userErr.message);
//     }
    
//     // Statistics by model
//     const modelStatsQuery = `
//       SELECT 
//         model_name,
//         COUNT(*) as request_count,
//         COUNT(DISTINCT user_id) as user_count,
//         COALESCE(SUM(total_tokens), 0) as total_tokens,
//         COALESCE(SUM(input_tokens), 0) as input_tokens,
//         COALESCE(SUM(output_tokens), 0) as output_tokens,
//         COALESCE(SUM(total_cost), 0) as total_cost,
//         COALESCE(SUM(tokens_used), 0) as tokens_used
//       FROM token_usage_logs
//       ${dateFilter}
//       GROUP BY model_name
//       ORDER BY total_cost DESC
//     `;
//     const modelStats = await paymentPool.query(modelStatsQuery, queryParams);
    
//     // Statistics by user
//     const userStatsQuery = `
//       SELECT 
//         user_id,
//         COUNT(*) as request_count,
//         COUNT(DISTINCT model_name) as model_count,
//         COALESCE(SUM(total_tokens), 0) as total_tokens,
//         COALESCE(SUM(input_tokens), 0) as input_tokens,
//         COALESCE(SUM(output_tokens), 0) as output_tokens,
//         COALESCE(SUM(total_cost), 0) as total_cost,
//         COALESCE(SUM(tokens_used), 0) as tokens_used,
//         COALESCE(AVG(remaining_tokens), 0) as avg_remaining_tokens
//       FROM token_usage_logs
//       ${dateFilter}
//       GROUP BY user_id
//       ORDER BY total_cost DESC
//       LIMIT 20
//     `;
//     const userStats = await paymentPool.query(userStatsQuery, queryParams);
    
//     // Fetch user names for statistics
//     const statsUserIds = userStats.rows.map(row => row.user_id).filter(id => id);
//     const statsUserMap = {};
    
//     if (statsUserIds.length > 0) {
//       try {
//         const placeholders = statsUserIds.map((_, index) => `$${index + 1}`).join(',');
//         const statsUserQuery = `
//           SELECT id, username, email
//           FROM users
//           WHERE id IN (${placeholders})
//         `;
//         const statsUserResult = await authPool.query(statsUserQuery, statsUserIds);
        
//         statsUserResult.rows.forEach(user => {
//           statsUserMap[user.id] = {
//             username: user.username || `User ${user.id}`,
//             email: user.email || ''
//           };
//         });
//       } catch (userErr) {
//         console.error('Error fetching user names for stats:', userErr.message);
//       }
//     }
    
//     // Enrich user stats with names
//     const enrichedUserStats = userStats.rows.map(row => ({
//       ...row,
//       user_name: statsUserMap[row.user_id]?.username || `User ${row.user_id}`,
//       user_email: statsUserMap[row.user_id]?.email || null
//     }));
    
//     // Daily usage trend (last 30 days or within date range)
//     let dailyTrendFilter = '';
//     let dailyTrendParams = [];
    
//     if (dateFilter) {
//       dailyTrendFilter = dateFilter;
//       dailyTrendParams = [...queryParams];
//     } else {
//       dailyTrendFilter = 'WHERE used_at >= CURRENT_TIMESTAMP - INTERVAL \'30 days\'';
//       dailyTrendParams = [];
//     }
    
//     const dailyTrendQuery = `
//       SELECT 
//         DATE(used_at) as date,
//         COUNT(*) as request_count,
//         COALESCE(SUM(total_tokens), 0) as total_tokens,
//         COALESCE(SUM(total_cost), 0) as total_cost,
//         COALESCE(SUM(tokens_used), 0) as tokens_used
//       FROM token_usage_logs
//       ${dailyTrendFilter}
//       GROUP BY DATE(used_at)
//       ORDER BY date ASC
//     `;
//     const dailyTrendResult = await paymentPool.query(dailyTrendQuery, dailyTrendParams);

//     // Convert string values to numbers for totals
//     const totalsRow = totalStats.rows[0] || {};
//     const totals = {
//       total_requests: parseInt(totalsRow.total_requests) || 0,
//       unique_users: parseInt(totalsRow.unique_users) || 0,
//       unique_models: parseInt(totalsRow.unique_models) || 0,
//       total_tokens: parseFloat(totalsRow.total_tokens) || 0,
//       total_input_tokens: parseFloat(totalsRow.total_input_tokens) || 0,
//       total_output_tokens: parseFloat(totalsRow.total_output_tokens) || 0,
//       total_cost: parseFloat(totalsRow.total_cost) || 0,
//       total_tokens_used: parseFloat(totalsRow.total_tokens_used) || 0,
//       avg_remaining_tokens: parseFloat(totalsRow.avg_remaining_tokens) || 0,
//       total_users: totalUsersCount
//     };

//     // Convert model stats to proper numbers
//     const byModel = modelStats.rows.map(row => ({
//       model_name: row.model_name || 'Unknown',
//       request_count: parseInt(row.request_count) || 0,
//       user_count: parseInt(row.user_count) || 0,
//       total_tokens: parseFloat(row.total_tokens) || 0,
//       input_tokens: parseFloat(row.input_tokens) || 0,
//       output_tokens: parseFloat(row.output_tokens) || 0,
//       total_cost: parseFloat(row.total_cost) || 0,
//       tokens_used: parseFloat(row.tokens_used) || 0
//     }));

//     // Convert user stats to proper numbers
//     const byUser = enrichedUserStats.map(row => ({
//       user_id: row.user_id,
//       user_name: row.user_name,
//       user_email: row.user_email,
//       request_count: parseInt(row.request_count) || 0,
//       model_count: parseInt(row.model_count) || 0,
//       total_tokens: parseFloat(row.total_tokens) || 0,
//       input_tokens: parseFloat(row.input_tokens) || 0,
//       output_tokens: parseFloat(row.output_tokens) || 0,
//       total_cost: parseFloat(row.total_cost) || 0,
//       tokens_used: parseFloat(row.tokens_used) || 0,
//       avg_remaining_tokens: parseFloat(row.avg_remaining_tokens) || 0
//     }));

//     // Convert daily trend to proper numbers
//     const dailyTrend = dailyTrendResult.rows.map(row => ({
//       date: row.date,
//       request_count: parseInt(row.request_count) || 0,
//       total_tokens: parseFloat(row.total_tokens) || 0,
//       total_cost: parseFloat(row.total_cost) || 0,
//       tokens_used: parseFloat(row.tokens_used) || 0
//     }));

//     res.status(200).json({
//       success: true,
//       data: {
//         totals,
//         byModel,
//         byUser,
//         dailyTrend
//       }
//     });
//   } catch (err) {
//     console.error('Error fetching token usage statistics:', err.message);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch token usage statistics: ' + err.message 
//     });
//   }
// };

// // ---------------------
// // Get usage by user ID
// // ---------------------
// const getUsageByUserId = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { limit = 100, offset = 0 } = req.query;
    
//     const query = `
//       SELECT 
//         user_id,
//         tokens_used,
//         remaining_tokens,
//         action_description,
//         used_at,
//         request_type,
//         firm_id,
//         model_name,
//         input_tokens,
//         output_tokens,
//         total_tokens,
//         total_cost,
//         session_id
//       FROM token_usage_logs
//       WHERE user_id = $1
//       ORDER BY used_at DESC
//       LIMIT $2 OFFSET $3
//     `;
//     const result = await paymentPool.query(query, [parseInt(userId), parseInt(limit), parseInt(offset)]);
    
//     // Fetch user name
//     let userName = `User ${userId}`;
//     let userEmail = null;
//     try {
//       const userResult = await authPool.query('SELECT username, email FROM users WHERE id = $1', [parseInt(userId)]);
//       if (userResult.rows.length > 0) {
//         userName = userResult.rows[0].username || userName;
//         userEmail = userResult.rows[0].email;
//       }
//     } catch (userErr) {
//       console.error('Error fetching user name:', userErr.message);
//     }
    
//     // Enrich results
//     const enrichedData = result.rows.map(row => ({
//       ...row,
//       user_name: userName,
//       user_email: userEmail,
//       id: `${row.user_id}-${row.session_id || ''}-${new Date(row.used_at).getTime()}`
//     }));
    
//     res.status(200).json({
//       success: true,
//       data: enrichedData,
//       count: enrichedData.length
//     });
//   } catch (err) {
//     console.error('Error fetching usage by user ID:', err.message);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch usage by user ID: ' + err.message 
//     });
//   }
// };

// module.exports = {
//   getAllTokenUsageLogs,
//   getTokenUsageStats,
//   getUsageByUserId
// };

//====================================================================================================//



// const paymentPool = require('../config/payment_DB');
// const authPool = require('../config/db'); // Auth database pool


// // ---------------------
// // Get all token usage logs with user information and session details
// // ---------------------
// const getAllTokenUsageLogs = async (req, res) => {
//   try {
//     const { limit = 1000, offset = 0, userId, modelName, userName, startDate, endDate, all = false } = req.query;

//     let query = `
//       SELECT 
//         t.user_id,
//         t.tokens_used,
//         t.remaining_tokens,
//         t.action_description,
//         t.used_at,
//         t.request_type,
//         t.firm_id,
//         t.model_name,
//         t.input_tokens,
//         t.output_tokens,
//         t.total_tokens,
//         t.total_cost,
//         t.session_id
//       FROM token_usage_logs t
//       WHERE 1=1
//     `;
    
//     const queryParams = [];
//     let paramCount = 0;
    
//     // If 'all' is true, skip date filtering
//     const shouldFilterByDate = !all && (startDate || endDate);
    
//     // If userName filter is provided, first get matching user IDs from auth DB
//     let filteredUserIds = null;
//     if (userName) {
//       try {
//         const userNameQuery = `
//           SELECT id
//           FROM users
//           WHERE username ILIKE $1 OR email ILIKE $1
//         `;
//         const userNameResult = await authPool.query(userNameQuery, [`%${userName}%`]);
//         filteredUserIds = userNameResult.rows.map(row => row.id);
        
//         if (filteredUserIds.length === 0) {
//           return res.status(200).json({
//             success: true,
//             data: [],
//             count: 0
//           });
//         }
        
//         const userIdPlaceholders = filteredUserIds.map((_, index) => `$${paramCount + index + 1}`).join(',');
//         query += ` AND t.user_id IN (${userIdPlaceholders})`;
//         queryParams.push(...filteredUserIds);
//         paramCount += filteredUserIds.length;
//       } catch (userErr) {
//         console.error('Error fetching users by name:', userErr.message);
//       }
//     }
    
//     if (userId) {
//       paramCount++;
//       query += ` AND t.user_id = $${paramCount}`;
//       queryParams.push(parseInt(userId));
//     }
    
//     if (modelName) {
//       paramCount++;
//       query += ` AND t.model_name ILIKE $${paramCount}`;
//       queryParams.push(`%${modelName}%`);
//     }
    
//     if (shouldFilterByDate) {
//       if (startDate) {
//         paramCount++;
//         query += ` AND t.used_at >= $${paramCount}::timestamp`;
//         queryParams.push(startDate);
//       }
//       if (endDate) {
//         paramCount++;
//         query += ` AND t.used_at < ($${paramCount}::timestamp + INTERVAL '1 day')`;
//         queryParams.push(endDate);
//       }
//     }
    
//     query += ` ORDER BY t.used_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
//     queryParams.push(parseInt(limit), parseInt(offset));

//     console.log('📊 Query:', query);
//     console.log('📊 Query params:', queryParams);
    
//     const result = await paymentPool.query(query, queryParams);
    
//     console.log('📊 Query result count:', result.rows.length);
    
//     // Fetch user names from auth database
//     const userIds = [...new Set(result.rows.map(row => row.user_id).filter(id => id))];
//     const userMap = {};
    
//     if (userIds.length > 0) {
//       try {
//         const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
//         const userQuery = `
//           SELECT id, username, email
//           FROM users
//           WHERE id IN (${placeholders})
//         `;
//         const userResult = await authPool.query(userQuery, userIds);
        
//         userResult.rows.forEach(user => {
//           userMap[user.id] = {
//             username: user.username || `User ${user.id}`,
//             email: user.email || ''
//           };
//         });
//       } catch (userErr) {
//         console.error('Error fetching user names:', userErr.message);
//       }
//     }
    
//     // Fetch session information
//     const sessionIds = [...new Set(result.rows.map(row => row.session_id).filter(id => id))];
//     const sessionMap = {};
    
//     if (sessionIds.length > 0) {
//       try {
//         const sessionPlaceholders = sessionIds.map((_, index) => `$${index + 1}`).join(',');
//         const sessionQuery = `
//           SELECT 
//             id,
//             user_id,
//             login_time,
//             logout_time,
//             created_at,
//             last_seen_at
//           FROM user_sessions
//           WHERE id IN (${sessionPlaceholders})
//         `;
//         const sessionResult = await authPool.query(sessionQuery, sessionIds);
        
//         sessionResult.rows.forEach(session => {
//           sessionMap[session.id] = {
//             login_time: session.login_time,
//             logout_time: session.logout_time,
//             created_at: session.created_at,
//             last_seen_at: session.last_seen_at,
//             is_active: !session.logout_time,
//             session_duration: session.logout_time && session.login_time 
//               ? Math.round((new Date(session.logout_time) - new Date(session.login_time)) / 1000 / 60)
//               : null
//           };
//         });
//       } catch (sessionErr) {
//         console.error('Error fetching session info:', sessionErr.message);
//       }
//     }
    
//     // Enrich the results with user names and session info
//     const enrichedData = result.rows.map(row => ({
//       ...row,
//       user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
//       user_email: userMap[row.user_id]?.email || null,
//       session_info: row.session_id ? sessionMap[row.session_id] : null,
//       id: `${row.user_id}-${row.session_id || ''}-${new Date(row.used_at).getTime()}`
//     }));
    
//     res.status(200).json({
//       success: true,
//       data: enrichedData,
//       count: enrichedData.length
//     });
//   } catch (err) {
//     console.error('Error fetching token usage logs:', err.message);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch token usage logs: ' + err.message 
//     });
//   }
// };

// // ---------------------
// // Get aggregated statistics including session data
// // ---------------------
// const getTokenUsageStats = async (req, res) => {
//   try {
//     const { startDate, endDate } = req.query;
//     let dateFilter = '';
//     const queryParams = [];
    
//     if (startDate && endDate) {
//       dateFilter = 'WHERE used_at >= $1::timestamp AND used_at < ($2::timestamp + INTERVAL \'1 day\')';
//       queryParams.push(startDate, endDate);
//     } else if (startDate) {
//       dateFilter = 'WHERE used_at >= $1::timestamp';
//       queryParams.push(startDate);
//     } else if (endDate) {
//       dateFilter = 'WHERE used_at < ($1::timestamp + INTERVAL \'1 day\')';
//       queryParams.push(endDate);
//     }
    
//     console.log('📊 Stats query date filter:', dateFilter);
//     console.log('📊 Stats query params:', queryParams);
    
//     // Total statistics
//     const totalStatsQuery = `
//       SELECT 
//         COUNT(*) as total_requests,
//         COUNT(DISTINCT user_id) as unique_users,
//         COUNT(DISTINCT model_name) as unique_models,
//         COUNT(DISTINCT session_id) as unique_sessions,
//         COALESCE(SUM(total_tokens), 0) as total_tokens,
//         COALESCE(SUM(input_tokens), 0) as total_input_tokens,
//         COALESCE(SUM(output_tokens), 0) as total_output_tokens,
//         COALESCE(SUM(total_cost), 0) as total_cost,
//         COALESCE(SUM(tokens_used), 0) as total_tokens_used,
//         COALESCE(AVG(remaining_tokens), 0) as avg_remaining_tokens
//       FROM token_usage_logs
//       ${dateFilter}
//     `;
//     const totalStats = await paymentPool.query(totalStatsQuery, queryParams);
    
//     // Get total users from auth database
//     let totalUsersCount = 0;
//     try {
//       const totalUsersQuery = `SELECT COUNT(*) as total FROM users`;
//       const totalUsersResult = await authPool.query(totalUsersQuery);
//       totalUsersCount = parseInt(totalUsersResult.rows[0]?.total || 0);
//     } catch (userErr) {
//       console.error('Error fetching total users count:', userErr.message);
//     }
    
//     // Get session statistics
//     let sessionStats = {
//       total_sessions: 0,
//       active_sessions: 0,
//       live_users: 0,
//       recent_users: 0,
//       avg_session_duration: 0
//     };
    
//     try {
//       let sessionDateFilter = '';
//       let sessionParams = [];
      
//       if (startDate && endDate) {
//         sessionDateFilter = 'WHERE login_time >= $1::timestamp AND login_time < ($2::timestamp + INTERVAL \'1 day\')';
//         sessionParams = [startDate, endDate];
//       } else if (startDate) {
//         sessionDateFilter = 'WHERE login_time >= $1::timestamp';
//         sessionParams = [startDate];
//       } else if (endDate) {
//         sessionDateFilter = 'WHERE login_time < ($1::timestamp + INTERVAL \'1 day\')';
//         sessionParams = [endDate];
//       }
      
//       // Get session stats
//       const sessionStatsQuery = `
//         SELECT 
//           COUNT(*) as total_sessions,
//           COUNT(CASE WHEN logout_time IS NULL THEN 1 END) as active_sessions,
//           COUNT(DISTINCT CASE WHEN logout_time IS NULL THEN user_id END) as live_users,
//           COUNT(DISTINCT CASE WHEN last_seen_at >= NOW() - INTERVAL '15 minutes' THEN user_id END) as recent_users,
//           AVG(
//             CASE 
//               WHEN logout_time IS NOT NULL 
//               THEN EXTRACT(EPOCH FROM (logout_time - login_time)) / 60 
//             END
//           ) as avg_session_duration
//         FROM user_sessions
//         ${sessionDateFilter}
//       `;
//       const sessionStatsResult = await authPool.query(sessionStatsQuery, sessionParams);
      
//       if (sessionStatsResult.rows.length > 0) {
//         sessionStats = {
//           total_sessions: parseInt(sessionStatsResult.rows[0].total_sessions) || 0,
//           active_sessions: parseInt(sessionStatsResult.rows[0].active_sessions) || 0,
//           live_users: parseInt(sessionStatsResult.rows[0].live_users) || 0,
//           recent_users: parseInt(sessionStatsResult.rows[0].recent_users) || 0,
//           avg_session_duration: parseFloat(sessionStatsResult.rows[0].avg_session_duration) || 0
//         };
//       }
//     } catch (sessionErr) {
//       console.error('Error fetching session stats:', sessionErr.message);
//     }
    
//     // Statistics by model
//     const modelStatsQuery = `
//       SELECT 
//         model_name,
//         COUNT(*) as request_count,
//         COUNT(DISTINCT user_id) as user_count,
//         COUNT(DISTINCT session_id) as session_count,
//         COALESCE(SUM(total_tokens), 0) as total_tokens,
//         COALESCE(SUM(input_tokens), 0) as input_tokens,
//         COALESCE(SUM(output_tokens), 0) as output_tokens,
//         COALESCE(SUM(total_cost), 0) as total_cost,
//         COALESCE(SUM(tokens_used), 0) as tokens_used
//       FROM token_usage_logs
//       ${dateFilter}
//       GROUP BY model_name
//       ORDER BY total_cost DESC
//     `;
//     const modelStats = await paymentPool.query(modelStatsQuery, queryParams);
    
//     // Statistics by user
//     const userStatsQuery = `
//       SELECT 
//         user_id,
//         COUNT(*) as request_count,
//         COUNT(DISTINCT model_name) as model_count,
//         COUNT(DISTINCT session_id) as session_count,
//         COALESCE(SUM(total_tokens), 0) as total_tokens,
//         COALESCE(SUM(input_tokens), 0) as input_tokens,
//         COALESCE(SUM(output_tokens), 0) as output_tokens,
//         COALESCE(SUM(total_cost), 0) as total_cost,
//         COALESCE(SUM(tokens_used), 0) as tokens_used,
//         COALESCE(AVG(remaining_tokens), 0) as avg_remaining_tokens
//       FROM token_usage_logs
//       ${dateFilter}
//       GROUP BY user_id
//       ORDER BY total_cost DESC
//       LIMIT 20
//     `;
//     const userStats = await paymentPool.query(userStatsQuery, queryParams);
    
//     // Fetch user names for statistics
//     const statsUserIds = userStats.rows.map(row => row.user_id).filter(id => id);
//     const statsUserMap = {};
    
//     if (statsUserIds.length > 0) {
//       try {
//         const placeholders = statsUserIds.map((_, index) => `$${index + 1}`).join(',');
//         const statsUserQuery = `
//           SELECT id, username, email
//           FROM users
//           WHERE id IN (${placeholders})
//         `;
//         const statsUserResult = await authPool.query(statsUserQuery, statsUserIds);
        
//         statsUserResult.rows.forEach(user => {
//           statsUserMap[user.id] = {
//             username: user.username || `User ${user.id}`,
//             email: user.email || ''
//           };
//         });
//       } catch (userErr) {
//         console.error('Error fetching user names for stats:', userErr.message);
//       }
//     }
    
//     // Enrich user stats with names
//     const enrichedUserStats = userStats.rows.map(row => ({
//       ...row,
//       user_name: statsUserMap[row.user_id]?.username || `User ${row.user_id}`,
//       user_email: statsUserMap[row.user_id]?.email || null
//     }));
    
//     // Daily usage trend
//     let dailyTrendFilter = '';
//     let dailyTrendParams = [];
    
//     if (dateFilter) {
//       dailyTrendFilter = dateFilter;
//       dailyTrendParams = [...queryParams];
//     } else {
//       dailyTrendFilter = 'WHERE used_at >= CURRENT_TIMESTAMP - INTERVAL \'30 days\'';
//       dailyTrendParams = [];
//     }
    
//     const dailyTrendQuery = `
//       SELECT 
//         DATE(used_at) as date,
//         COUNT(*) as request_count,
//         COUNT(DISTINCT session_id) as session_count,
//         COALESCE(SUM(total_tokens), 0) as total_tokens,
//         COALESCE(SUM(total_cost), 0) as total_cost,
//         COALESCE(SUM(tokens_used), 0) as tokens_used
//       FROM token_usage_logs
//       ${dailyTrendFilter}
//       GROUP BY DATE(used_at)
//       ORDER BY date ASC
//     `;
//     const dailyTrendResult = await paymentPool.query(dailyTrendQuery, dailyTrendParams);

//     // Convert string values to numbers for totals
//     const totalsRow = totalStats.rows[0] || {};
//     const totals = {
//       total_requests: parseInt(totalsRow.total_requests) || 0,
//       unique_users: parseInt(totalsRow.unique_users) || 0,
//       unique_models: parseInt(totalsRow.unique_models) || 0,
//       unique_sessions: parseInt(totalsRow.unique_sessions) || 0,
//       total_tokens: parseFloat(totalsRow.total_tokens) || 0,
//       total_input_tokens: parseFloat(totalsRow.total_input_tokens) || 0,
//       total_output_tokens: parseFloat(totalsRow.total_output_tokens) || 0,
//       total_cost: parseFloat(totalsRow.total_cost) || 0,
//       total_tokens_used: parseFloat(totalsRow.total_tokens_used) || 0,
//       avg_remaining_tokens: parseFloat(totalsRow.avg_remaining_tokens) || 0,
//       total_users: totalUsersCount,
//       ...sessionStats
//     };

//     // Convert model stats to proper numbers
//     const byModel = modelStats.rows.map(row => ({
//       model_name: row.model_name || 'Unknown',
//       request_count: parseInt(row.request_count) || 0,
//       user_count: parseInt(row.user_count) || 0,
//       session_count: parseInt(row.session_count) || 0,
//       total_tokens: parseFloat(row.total_tokens) || 0,
//       input_tokens: parseFloat(row.input_tokens) || 0,
//       output_tokens: parseFloat(row.output_tokens) || 0,
//       total_cost: parseFloat(row.total_cost) || 0,
//       tokens_used: parseFloat(row.tokens_used) || 0
//     }));

//     // Convert user stats to proper numbers
//     const byUser = enrichedUserStats.map(row => ({
//       user_id: row.user_id,
//       user_name: row.user_name,
//       user_email: row.user_email,
//       request_count: parseInt(row.request_count) || 0,
//       model_count: parseInt(row.model_count) || 0,
//       session_count: parseInt(row.session_count) || 0,
//       total_tokens: parseFloat(row.total_tokens) || 0,
//       input_tokens: parseFloat(row.input_tokens) || 0,
//       output_tokens: parseFloat(row.output_tokens) || 0,
//       total_cost: parseFloat(row.total_cost) || 0,
//       tokens_used: parseFloat(row.tokens_used) || 0,
//       avg_remaining_tokens: parseFloat(row.avg_remaining_tokens) || 0
//     }));

//     // Convert daily trend to proper numbers
//     const dailyTrend = dailyTrendResult.rows.map(row => ({
//       date: row.date,
//       request_count: parseInt(row.request_count) || 0,
//       session_count: parseInt(row.session_count) || 0,
//       total_tokens: parseFloat(row.total_tokens) || 0,
//       total_cost: parseFloat(row.total_cost) || 0,
//       tokens_used: parseFloat(row.tokens_used) || 0
//     }));

//     res.status(200).json({
//       success: true,
//       data: {
//         totals,
//         byModel,
//         byUser,
//         dailyTrend
//       }
//     });
//   } catch (err) {
//     console.error('Error fetching token usage statistics:', err.message);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch token usage statistics: ' + err.message 
//     });
//   }
// };


const paymentPool = require('../config/payment_DB');
const authPool = require('../config/db'); // Auth database pool
const axios = require('axios');

// Exchange rate cache
let exchangeRateCache = {
  rate: 83.50, // Default fallback rate
  lastUpdated: null
};

// Fetch exchange rate from Frankfurter API
const fetchExchangeRate = async () => {
  try {
    const response = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR');
    if (response.data && response.data.rates && response.data.rates.INR) {
      exchangeRateCache.rate = response.data.rates.INR;
      exchangeRateCache.lastUpdated = new Date();
      console.log(`💱 Exchange rate updated: 1 USD = ₹${exchangeRateCache.rate.toFixed(2)}`);
    }
  } catch (err) {
    console.error('❌ Error fetching exchange rate:', err.message);
    // Keep using cached rate
  }
};

// Update exchange rate every 30 minutes
setInterval(fetchExchangeRate, 1800000);
// Initial fetch
fetchExchangeRate();

// Convert USD to INR
const convertToINR = (usdAmount) => {
  return usdAmount * exchangeRateCache.rate;
};

// ---------------------
// Get all token usage logs with user information and session details
// ---------------------
const getAllTokenUsageLogs = async (req, res) => {
  try {
    const { limit = 1000, offset = 0, userId, modelName, userName, startDate, endDate, all = false } = req.query;

    let query = `
      SELECT 
        t.user_id,
        t.tokens_used,
        t.remaining_tokens,
        t.action_description,
        t.used_at,
        t.request_type,
        t.firm_id,
        t.model_name,
        t.input_tokens,
        t.output_tokens,
        t.total_tokens,
        t.total_cost,
        t.session_id
      FROM token_usage_logs t
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 0;
    
    // If 'all' is true, skip date filtering
    const shouldFilterByDate = !all && (startDate || endDate);
    
    // If userName filter is provided, first get matching user IDs from auth DB
    let filteredUserIds = null;
    if (userName) {
      try {
        const userNameQuery = `
          SELECT id
          FROM users
          WHERE username ILIKE $1 OR email ILIKE $1
        `;
        const userNameResult = await authPool.query(userNameQuery, [`%${userName}%`]);
        filteredUserIds = userNameResult.rows.map(row => row.id);
        
        if (filteredUserIds.length === 0) {
          return res.status(200).json({
            success: true,
            data: [],
            count: 0,
            exchange_rate: {
              usd_to_inr: exchangeRateCache.rate,
              last_updated: exchangeRateCache.lastUpdated
            }
          });
        }
        
        const userIdPlaceholders = filteredUserIds.map((_, index) => `$${paramCount + index + 1}`).join(',');
        query += ` AND t.user_id IN (${userIdPlaceholders})`;
        queryParams.push(...filteredUserIds);
        paramCount += filteredUserIds.length;
      } catch (userErr) {
        console.error('Error fetching users by name:', userErr.message);
      }
    }
    
    if (userId) {
      paramCount++;
      query += ` AND t.user_id = $${paramCount}`;
      queryParams.push(parseInt(userId));
    }
    
    if (modelName) {
      paramCount++;
      query += ` AND t.model_name ILIKE $${paramCount}`;
      queryParams.push(`%${modelName}%`);
    }
    
    if (shouldFilterByDate) {
      if (startDate) {
        paramCount++;
        query += ` AND t.used_at >= $${paramCount}::timestamp`;
        queryParams.push(startDate);
      }
      if (endDate) {
        paramCount++;
        query += ` AND t.used_at < ($${paramCount}::timestamp + INTERVAL '1 day')`;
        queryParams.push(endDate);
      }
    }
    
    query += ` ORDER BY t.used_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    console.log('📊 Query:', query);
    console.log('📊 Query params:', queryParams);
    
    const result = await paymentPool.query(query, queryParams);
    
    console.log('📊 Query result count:', result.rows.length);
    
    // Fetch user names from auth database
    const userIds = [...new Set(result.rows.map(row => row.user_id).filter(id => id))];
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
        console.error('Error fetching user names:', userErr.message);
      }
    }
    
    // Fetch session information
    const sessionIds = [...new Set(result.rows.map(row => row.session_id).filter(id => id))];
    const sessionMap = {};
    
    if (sessionIds.length > 0) {
      try {
        const sessionPlaceholders = sessionIds.map((_, index) => `$${index + 1}`).join(',');
        const sessionQuery = `
          SELECT 
            id,
            user_id,
            login_time,
            logout_time,
            created_at,
            last_seen_at
          FROM user_sessions
          WHERE id IN (${sessionPlaceholders})
        `;
        const sessionResult = await authPool.query(sessionQuery, sessionIds);
        
        sessionResult.rows.forEach(session => {
          sessionMap[session.id] = {
            login_time: session.login_time,
            logout_time: session.logout_time,
            created_at: session.created_at,
            last_seen_at: session.last_seen_at,
            is_active: !session.logout_time,
            session_duration: session.logout_time && session.login_time 
              ? Math.round((new Date(session.logout_time) - new Date(session.login_time)) / 1000 / 60)
              : null
          };
        });
      } catch (sessionErr) {
        console.error('Error fetching session info:', sessionErr.message);
      }
    }
    
    // Enrich the results with user names, session info, and INR conversion
    const enrichedData = result.rows.map(row => ({
      ...row,
      total_cost_inr: convertToINR(parseFloat(row.total_cost) || 0),
      user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
      user_email: userMap[row.user_id]?.email || null,
      session_info: row.session_id ? sessionMap[row.session_id] : null,
      id: `${row.user_id}-${row.session_id || ''}-${new Date(row.used_at).getTime()}`
    }));
    
    res.status(200).json({
      success: true,
      data: enrichedData,
      count: enrichedData.length,
      exchange_rate: {
        usd_to_inr: exchangeRateCache.rate,
        last_updated: exchangeRateCache.lastUpdated
      }
    });
  } catch (err) {
    console.error('Error fetching token usage logs:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch token usage logs: ' + err.message 
    });
  }
};

// ---------------------
// Get aggregated statistics including session data
// ---------------------
const getTokenUsageStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    const queryParams = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE used_at >= $1::timestamp AND used_at < ($2::timestamp + INTERVAL \'1 day\')';
      queryParams.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = 'WHERE used_at >= $1::timestamp';
      queryParams.push(startDate);
    } else if (endDate) {
      dateFilter = 'WHERE used_at < ($1::timestamp + INTERVAL \'1 day\')';
      queryParams.push(endDate);
    }
    
    console.log('📊 Stats query date filter:', dateFilter);
    console.log('📊 Stats query params:', queryParams);
    
    // Total statistics
    const totalStatsQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT model_name) as unique_models,
        COUNT(DISTINCT session_id) as unique_sessions,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(tokens_used), 0) as total_tokens_used,
        COALESCE(AVG(remaining_tokens), 0) as avg_remaining_tokens
      FROM token_usage_logs
      ${dateFilter}
    `;
    const totalStats = await paymentPool.query(totalStatsQuery, queryParams);
    
    // Get total users from auth database
    let totalUsersCount = 0;
    try {
      const totalUsersQuery = `SELECT COUNT(*) as total FROM users`;
      const totalUsersResult = await authPool.query(totalUsersQuery);
      totalUsersCount = parseInt(totalUsersResult.rows[0]?.total || 0);
    } catch (userErr) {
      console.error('Error fetching total users count:', userErr.message);
    }
    
    // Get session statistics
    let sessionStats = {
      total_sessions: 0,
      active_sessions: 0,
      live_users: 0,
      recent_users: 0,
      avg_session_duration: 0
    };
    
    try {
      let sessionDateFilter = '';
      let sessionParams = [];
      
      if (startDate && endDate) {
        sessionDateFilter = 'WHERE login_time >= $1::timestamp AND login_time < ($2::timestamp + INTERVAL \'1 day\')';
        sessionParams = [startDate, endDate];
      } else if (startDate) {
        sessionDateFilter = 'WHERE login_time >= $1::timestamp';
        sessionParams = [startDate];
      } else if (endDate) {
        sessionDateFilter = 'WHERE login_time < ($1::timestamp + INTERVAL \'1 day\')';
        sessionParams = [endDate];
      }
      
      const sessionStatsQuery = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN logout_time IS NULL THEN 1 END) as active_sessions,
          COUNT(DISTINCT CASE WHEN logout_time IS NULL THEN user_id END) as live_users,
          COUNT(DISTINCT CASE WHEN last_seen_at >= NOW() - INTERVAL '15 minutes' THEN user_id END) as recent_users,
          AVG(
            CASE 
              WHEN logout_time IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (logout_time - login_time)) / 60 
            END
          ) as avg_session_duration
        FROM user_sessions
        ${sessionDateFilter}
      `;
      const sessionStatsResult = await authPool.query(sessionStatsQuery, sessionParams);
      
      if (sessionStatsResult.rows.length > 0) {
        sessionStats = {
          total_sessions: parseInt(sessionStatsResult.rows[0].total_sessions) || 0,
          active_sessions: parseInt(sessionStatsResult.rows[0].active_sessions) || 0,
          live_users: parseInt(sessionStatsResult.rows[0].live_users) || 0,
          recent_users: parseInt(sessionStatsResult.rows[0].recent_users) || 0,
          avg_session_duration: parseFloat(sessionStatsResult.rows[0].avg_session_duration) || 0
        };
      }
    } catch (sessionErr) {
      console.error('Error fetching session stats:', sessionErr.message);
    }
    
    // Statistics by model
    const modelStatsQuery = `
      SELECT 
        model_name,
        COUNT(*) as request_count,
        COUNT(DISTINCT user_id) as user_count,
        COUNT(DISTINCT session_id) as session_count,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(tokens_used), 0) as tokens_used
      FROM token_usage_logs
      ${dateFilter}
      GROUP BY model_name
      ORDER BY total_cost DESC
    `;
    const modelStats = await paymentPool.query(modelStatsQuery, queryParams);
    
    // Statistics by user
    const userStatsQuery = `
      SELECT 
        user_id,
        COUNT(*) as request_count,
        COUNT(DISTINCT model_name) as model_count,
        COUNT(DISTINCT session_id) as session_count,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(tokens_used), 0) as tokens_used,
        COALESCE(AVG(remaining_tokens), 0) as avg_remaining_tokens
      FROM token_usage_logs
      ${dateFilter}
      GROUP BY user_id
      ORDER BY total_cost DESC
      LIMIT 20
    `;
    const userStats = await paymentPool.query(userStatsQuery, queryParams);
    
    // Fetch user names for statistics
    const statsUserIds = userStats.rows.map(row => row.user_id).filter(id => id);
    const statsUserMap = {};
    
    if (statsUserIds.length > 0) {
      try {
        const placeholders = statsUserIds.map((_, index) => `$${index + 1}`).join(',');
        const statsUserQuery = `
          SELECT id, username, email
          FROM users
          WHERE id IN (${placeholders})
        `;
        const statsUserResult = await authPool.query(statsUserQuery, statsUserIds);
        
        statsUserResult.rows.forEach(user => {
          statsUserMap[user.id] = {
            username: user.username || `User ${user.id}`,
            email: user.email || ''
          };
        });
      } catch (userErr) {
        console.error('Error fetching user names for stats:', userErr.message);
      }
    }
    
    // Enrich user stats with names
    const enrichedUserStats = userStats.rows.map(row => ({
      ...row,
      user_name: statsUserMap[row.user_id]?.username || `User ${row.user_id}`,
      user_email: statsUserMap[row.user_id]?.email || null
    }));
    
    // Daily usage trend
    let dailyTrendFilter = '';
    let dailyTrendParams = [];
    
    if (dateFilter) {
      dailyTrendFilter = dateFilter;
      dailyTrendParams = [...queryParams];
    } else {
      dailyTrendFilter = 'WHERE used_at >= CURRENT_TIMESTAMP - INTERVAL \'30 days\'';
      dailyTrendParams = [];
    }
    
    const dailyTrendQuery = `
      SELECT 
        DATE(used_at) as date,
        COUNT(*) as request_count,
        COUNT(DISTINCT session_id) as session_count,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(tokens_used), 0) as tokens_used
      FROM token_usage_logs
      ${dailyTrendFilter}
      GROUP BY DATE(used_at)
      ORDER BY date ASC
    `;
    const dailyTrendResult = await paymentPool.query(dailyTrendQuery, dailyTrendParams);

    // Convert string values to numbers for totals
    const totalsRow = totalStats.rows[0] || {};
    const totals = {
      total_requests: parseInt(totalsRow.total_requests) || 0,
      unique_users: parseInt(totalsRow.unique_users) || 0,
      unique_models: parseInt(totalsRow.unique_models) || 0,
      unique_sessions: parseInt(totalsRow.unique_sessions) || 0,
      total_tokens: parseFloat(totalsRow.total_tokens) || 0,
      total_input_tokens: parseFloat(totalsRow.total_input_tokens) || 0,
      total_output_tokens: parseFloat(totalsRow.total_output_tokens) || 0,
      total_cost: parseFloat(totalsRow.total_cost) || 0,
      total_tokens_used: parseFloat(totalsRow.total_tokens_used) || 0,
      avg_remaining_tokens: parseFloat(totalsRow.avg_remaining_tokens) || 0,
      total_users: totalUsersCount,
      ...sessionStats
    };

    // Convert model stats to proper numbers
    const byModel = modelStats.rows.map(row => ({
      model_name: row.model_name || 'Unknown',
      request_count: parseInt(row.request_count) || 0,
      user_count: parseInt(row.user_count) || 0,
      session_count: parseInt(row.session_count) || 0,
      total_tokens: parseFloat(row.total_tokens) || 0,
      input_tokens: parseFloat(row.input_tokens) || 0,
      output_tokens: parseFloat(row.output_tokens) || 0,
      total_cost: parseFloat(row.total_cost) || 0,
      tokens_used: parseFloat(row.tokens_used) || 0
    }));

    // Convert user stats to proper numbers
    const byUser = enrichedUserStats.map(row => ({
      user_id: row.user_id,
      user_name: row.user_name,
      user_email: row.user_email,
      request_count: parseInt(row.request_count) || 0,
      model_count: parseInt(row.model_count) || 0,
      session_count: parseInt(row.session_count) || 0,
      total_tokens: parseFloat(row.total_tokens) || 0,
      input_tokens: parseFloat(row.input_tokens) || 0,
      output_tokens: parseFloat(row.output_tokens) || 0,
      total_cost: parseFloat(row.total_cost) || 0,
      tokens_used: parseFloat(row.tokens_used) || 0,
      avg_remaining_tokens: parseFloat(row.avg_remaining_tokens) || 0
    }));

    // Convert daily trend to proper numbers
    const dailyTrend = dailyTrendResult.rows.map(row => ({
      date: row.date,
      request_count: parseInt(row.request_count) || 0,
      session_count: parseInt(row.session_count) || 0,
      total_tokens: parseFloat(row.total_tokens) || 0,
      total_cost: parseFloat(row.total_cost) || 0,
      tokens_used: parseFloat(row.tokens_used) || 0
    }));

    res.status(200).json({
      success: true,
      data: {
        totals,
        byModel,
        byUser,
        dailyTrend
      },
      exchange_rate: {
        usd_to_inr: exchangeRateCache.rate,
        last_updated: exchangeRateCache.lastUpdated
      }
    });
  } catch (err) {
    console.error('Error fetching token usage statistics:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch token usage statistics: ' + err.message 
    });
  }
};

// ---------------------
// Get usage by user ID
// ---------------------
const getUsageByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        user_id,
        tokens_used,
        remaining_tokens,
        action_description,
        used_at,
        request_type,
        firm_id,
        model_name,
        input_tokens,
        output_tokens,
        total_tokens,
        total_cost,
        session_id
      FROM token_usage_logs
      WHERE user_id = $1
      ORDER BY used_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await paymentPool.query(query, [parseInt(userId), parseInt(limit), parseInt(offset)]);
    
    // Fetch user name
    let userName = `User ${userId}`;
    let userEmail = null;
    try {
      const userResult = await authPool.query('SELECT username, email FROM users WHERE id = $1', [parseInt(userId)]);
      if (userResult.rows.length > 0) {
        userName = userResult.rows[0].username || userName;
        userEmail = userResult.rows[0].email;
      }
    } catch (userErr) {
      console.error('Error fetching user name:', userErr.message);
    }
    
    // Fetch session information
    const sessionIds = [...new Set(result.rows.map(row => row.session_id).filter(id => id))];
    const sessionMap = {};
    
    if (sessionIds.length > 0) {
      try {
        const sessionPlaceholders = sessionIds.map((_, index) => `$${index + 1}`).join(',');
        const sessionQuery = `
          SELECT 
            id,
            user_id,
            login_time,
            logout_time,
            created_at,
            last_seen_at
          FROM user_sessions
          WHERE id IN (${sessionPlaceholders})
        `;
        const sessionResult = await authPool.query(sessionQuery, sessionIds);
        
        sessionResult.rows.forEach(session => {
          sessionMap[session.id] = {
            login_time: session.login_time,
            logout_time: session.logout_time,
            created_at: session.created_at,
            last_seen_at: session.last_seen_at,
            is_active: !session.logout_time,
            session_duration: session.logout_time && session.login_time 
              ? Math.round((new Date(session.logout_time) - new Date(session.login_time)) / 1000 / 60)
              : null
          };
        });
      } catch (sessionErr) {
        console.error('Error fetching session info:', sessionErr.message);
      }
    }
    
    // Enrich results
    const enrichedData = result.rows.map(row => ({
      ...row,
      user_name: userName,
      user_email: userEmail,
      session_info: row.session_id ? sessionMap[row.session_id] : null,
      id: `${row.user_id}-${row.session_id || ''}-${new Date(row.used_at).getTime()}`
    }));
    
    res.status(200).json({
      success: true,
      data: enrichedData,
      count: enrichedData.length
    });
  } catch (err) {
    console.error('Error fetching usage by user ID:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch usage by user ID: ' + err.message 
    });
  }
};



// ... (keep all your existing functions)

// ---------------------
// Get active login users
// ---------------------
const getActiveLoginUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        us.id as session_id,
        us.user_id,
        us.login_time,
        us.logout_time,
        us.created_at,
        us.last_seen_at,
        EXTRACT(EPOCH FROM (NOW() - us.login_time)) / 60 as session_duration_minutes
      FROM user_sessions us
      WHERE us.logout_time IS NULL
      ORDER BY us.login_time DESC
    `;
    
    const result = await authPool.query(query);
    
    // Fetch user details
    const userIds = result.rows.map(row => row.user_id);
    const userMap = {};
    
    if (userIds.length > 0) {
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
    }
    
    const enrichedData = result.rows.map(row => ({
      ...row,
      user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
      user_email: userMap[row.user_id]?.email || null,
      is_active: true
    }));
    
    res.status(200).json({
      success: true,
      data: enrichedData,
      count: enrichedData.length
    });
  } catch (err) {
    console.error('Error fetching active login users:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch active login users: ' + err.message 
    });
  }
};

// ---------------------
// Get live users (active in last 15 minutes)
// ---------------------
const getLiveUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        us.id as session_id,
        us.user_id,
        us.login_time,
        us.logout_time,
        us.created_at,
        us.last_seen_at,
        EXTRACT(EPOCH FROM (NOW() - us.last_seen_at)) / 60 as minutes_since_last_seen,
        EXTRACT(EPOCH FROM (NOW() - us.login_time)) / 60 as session_duration_minutes
      FROM user_sessions us
      WHERE us.last_seen_at >= NOW() - INTERVAL '15 minutes'
      ORDER BY us.last_seen_at DESC
    `;
    
    const result = await authPool.query(query);
    
    // Fetch user details
    const userIds = [...new Set(result.rows.map(row => row.user_id))];
    const userMap = {};
    
    if (userIds.length > 0) {
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
    }
    
    const enrichedData = result.rows.map(row => ({
      ...row,
      user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
      user_email: userMap[row.user_id]?.email || null,
      is_active: !row.logout_time
    }));
    
    res.status(200).json({
      success: true,
      data: enrichedData,
      count: enrichedData.length
    });
  } catch (err) {
    console.error('Error fetching live users:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch live users: ' + err.message 
    });
  }
};

// ---------------------
// Get all sessions with duration info
// ---------------------
const getAllSessions = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        us.id as session_id,
        us.user_id,
        us.login_time,
        us.logout_time,
        us.created_at,
        us.last_seen_at,
        CASE 
          WHEN us.logout_time IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (us.logout_time - us.login_time)) / 60 
          ELSE EXTRACT(EPOCH FROM (NOW() - us.login_time)) / 60
        END as session_duration_minutes
      FROM user_sessions us
      ORDER BY us.login_time DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await authPool.query(query, [parseInt(limit), parseInt(offset)]);
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM user_sessions`;
    const countResult = await authPool.query(countQuery);
    const totalCount = parseInt(countResult.rows[0].total);
    
    // Fetch user details
    const userIds = [...new Set(result.rows.map(row => row.user_id))];
    const userMap = {};
    
    if (userIds.length > 0) {
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
    }
    
    const enrichedData = result.rows.map(row => ({
      ...row,
      user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
      user_email: userMap[row.user_id]?.email || null,
      is_active: !row.logout_time
    }));
    
    res.status(200).json({
      success: true,
      data: enrichedData,
      count: enrichedData.length,
      total: totalCount
    });
  } catch (err) {
    console.error('Error fetching all sessions:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch all sessions: ' + err.message 
    });
  }
};

// ---------------------
// Get session statistics summary
// ---------------------
// const getSessionStatsSummary = async (req, res) => {
//   try {
//     const statsQuery = `
//       SELECT 
//         COUNT(*) as total_sessions,
//         COUNT(CASE WHEN logout_time IS NULL THEN 1 END) as active_login_users,
//         COUNT(DISTINCT CASE WHEN last_seen_at >= NOW() - INTERVAL '15 minutes' THEN user_id END) as live_users,
//         AVG(
//           CASE 
//             WHEN logout_time IS NOT NULL 
//             THEN EXTRACT(EPOCH FROM (logout_time - login_time)) / 60 
//           END
//         ) as avg_session_duration
//       FROM user_sessions
//     `;
    
//     const result = await authPool.query(statsQuery);
//     const stats = result.rows[0];
    
//     res.status(200).json({
//       success: true,
//       data: {
//         total_sessions: parseInt(stats.total_sessions) || 0,
//         active_login_users: parseInt(stats.active_login_users) || 0,
//         live_users: parseInt(stats.live_users) || 0,
//         avg_session_duration: parseFloat(stats.avg_session_duration) || 0,
//         active_sessions: parseInt(stats.active_login_users) || 0
//       }
//     });
//   } catch (err) {
//     console.error('Error fetching session stats summary:', err.message);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch session stats summary: ' + err.message 
//     });
//   }
// };
// ---------------------
// Get user session details with active time
// ---------------------
const getUserSessionDetails = async (req, res) => {
  try {
    const query = `
      SELECT 
        us.id as session_id,
        us.user_id,
        us.login_time,
        us.logout_time,
        us.last_seen_at,
        us.active_time_seconds,
        ROUND(CAST(us.active_time_seconds AS NUMERIC) / 60, 2) as active_time_minutes
      FROM user_sessions us
      ORDER BY us.active_time_seconds DESC NULLS LAST
    `;
    
    const result = await authPool.query(query);
    
    // Fetch user details
    const userIds = [...new Set(result.rows.map(row => row.user_id))];
    const userMap = {};
    
    if (userIds.length > 0) {
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
    }
    
    const enrichedData = result.rows.map(row => ({
      session_id: row.session_id,
      user_id: row.user_id,
      user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
      user_email: userMap[row.user_id]?.email || null,
      login_time: row.login_time,
      logout_time: row.logout_time,
      last_seen_at: row.last_seen_at,
      active_time_seconds: parseInt(row.active_time_seconds) || 0,
      active_time_minutes: parseFloat(row.active_time_minutes) || 0,
      is_active: !row.logout_time
    }));
    
    res.status(200).json({
      success: true,
      data: enrichedData,
      count: enrichedData.length
    });
  } catch (err) {
    console.error('Error fetching user session details:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user session details: ' + err.message 
    });
  }
};

// Update the getSessionStatsSummary function to use active_time_seconds
const getSessionStatsSummary = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN logout_time IS NULL THEN 1 END) as active_login_users,
        COUNT(DISTINCT CASE WHEN last_seen_at >= NOW() - INTERVAL '15 minutes' THEN user_id END) as live_users,
        ROUND(AVG(
          CASE 
            WHEN active_time_seconds IS NOT NULL AND active_time_seconds > 0
            THEN CAST(active_time_seconds AS NUMERIC) / 60
            ELSE NULL
          END
        ), 2) as avg_session_duration_minutes
      FROM user_sessions
    `;
    
    const result = await authPool.query(statsQuery);
    const stats = result.rows[0];
    
    res.status(200).json({
      success: true,
      data: {
        total_sessions: parseInt(stats.total_sessions) || 0,
        active_login_users: parseInt(stats.active_login_users) || 0,
        live_users: parseInt(stats.live_users) || 0,
        avg_session_duration: parseFloat(stats.avg_session_duration_minutes) || 0,
        active_sessions: parseInt(stats.active_login_users) || 0
      }
    });
  } catch (err) {
    console.error('Error fetching session stats summary:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch session stats summary: ' + err.message 
    });
  }
};

// ---------------------
// Heartbeat endpoint - Get real-time dashboard stats
// ---------------------
// const getHeartbeatStats = async (req, res) => {
//   try {
//     console.log('💓 Heartbeat request received at:', new Date().toISOString());
    
//     // Get session stats
//     const sessionStatsQuery = `
//       SELECT 
//         COUNT(*) as total_sessions,
//         COUNT(CASE WHEN logout_time IS NULL THEN 1 END) as active_login_users,
//         COUNT(DISTINCT CASE WHEN last_seen_at >= NOW() - INTERVAL '15 minutes' THEN user_id END) as live_users,
//         ROUND(AVG(
//           CASE 
//             WHEN active_time_seconds IS NOT NULL AND active_time_seconds > 0
//             THEN CAST(active_time_seconds AS NUMERIC) / 60
//             ELSE NULL
//           END
//         ), 2) as avg_session_duration_minutes
//       FROM user_sessions
//     `;
    
//     const sessionStatsResult = await authPool.query(sessionStatsQuery);
//     const sessionStats = sessionStatsResult.rows[0];
    
//     res.status(200).json({
//       success: true,
//       timestamp: new Date().toISOString(),
//       data: {
//         session_stats: {
//           total_sessions: parseInt(sessionStats.total_sessions) || 0,
//           active_login_users: parseInt(sessionStats.active_login_users) || 0,
//           live_users: parseInt(sessionStats.live_users) || 0,
//           avg_session_duration: parseFloat(sessionStats.avg_session_duration_minutes) || 0,
//           active_sessions: parseInt(sessionStats.active_login_users) || 0
//         }
//       }
//     });
//   } catch (err) {
//     console.error('Error in heartbeat endpoint:', err.message);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch heartbeat stats: ' + err.message 
//     });
//   }
// };

const getHeartbeatStats = async (req, res) => {
  try {
    console.log('💓 Heartbeat request received at:', new Date().toISOString());
    
    // Get session stats
    const sessionStatsQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN logout_time IS NULL THEN 1 END) as active_login_users,
        COUNT(DISTINCT CASE WHEN last_seen_at >= NOW() - INTERVAL '15 minutes' THEN user_id END) as live_users,
        ROUND(AVG(
          CASE 
            WHEN active_time_seconds IS NOT NULL AND active_time_seconds > 0
            THEN CAST(active_time_seconds AS NUMERIC) / 60
            ELSE NULL
          END
        ), 2) as avg_session_duration_minutes
      FROM user_sessions
    `;
    
    const sessionStatsResult = await authPool.query(sessionStatsQuery);
    const sessionStats = sessionStatsResult.rows[0];
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        session_stats: {
          total_sessions: parseInt(sessionStats.total_sessions) || 0,
          active_login_users: parseInt(sessionStats.active_login_users) || 0,
          live_users: parseInt(sessionStats.live_users) || 0,
          avg_session_duration: parseFloat(sessionStats.avg_session_duration_minutes) || 0,
          active_sessions: parseInt(sessionStats.active_login_users) || 0
        }
      },
      exchange_rate: {
        usd_to_inr: exchangeRateCache.rate,
        last_updated: exchangeRateCache.lastUpdated
      }
    });
  } catch (err) {
    console.error('Error in heartbeat endpoint:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch heartbeat stats: ' + err.message 
    });
  }
};


// Update module.exports to include the new function
module.exports = {
  getAllTokenUsageLogs,
  getTokenUsageStats,
  getUsageByUserId,
  getActiveLoginUsers,
  getLiveUsers,
  getAllSessions,
  getSessionStatsSummary,
  getUserSessionDetails,
  getHeartbeatStats  // Add this new function
};

