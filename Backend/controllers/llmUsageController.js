const paymentPool = require('../config/payment_DB');

const authPool = require('../config/db'); // Auth database pool

// ---------------------
// Get all LLM usage logs with user information
// ---------------------
const getAllLlmUsageLogs = async (req, res) => {
  try {
    const { limit = 1000, offset = 0, userId, modelName, userName, startDate, endDate, all = false } = req.query;

    let query = `
      SELECT 
        l.id,
        l.user_id,
        l.model_name,
        l.input_tokens,
        l.output_tokens,
        l.total_tokens,
        l.input_cost,
        l.output_cost,
        l.total_cost,
        l.request_id,
        l.endpoint,
        l.file_id,
        l.session_id,
        l.used_at,
        l.created_at,
        l.request_count
      FROM llm_usage_logs l
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
          // No users match, return empty result
          return res.status(200).json({
            success: true,
            data: [],
            count: 0
          });
        }
        
        // Add user ID filter to main query
        const userIdPlaceholders = filteredUserIds.map((_, index) => `$${paramCount + index + 1}`).join(',');
        query += ` AND l.user_id IN (${userIdPlaceholders})`;
        queryParams.push(...filteredUserIds);
        paramCount += filteredUserIds.length;
      } catch (userErr) {
        console.error('Error fetching users by name:', userErr.message);
        // Continue without userName filter if there's an error
      }
    }
    if (userId) {
      paramCount++;
      query += ` AND l.user_id = $${paramCount}`;
      queryParams.push(parseInt(userId));
    }
    if (modelName) {
      paramCount++;
      query += ` AND l.model_name ILIKE $${paramCount}`;
      queryParams.push(`%${modelName}%`);
    }
    if (shouldFilterByDate) {
      if (startDate) {
        paramCount++;
        query += ` AND l.used_at >= $${paramCount}::date`;
        queryParams.push(startDate);
      }
      if (endDate) {
        paramCount++;
        // Include the full end date (end of day)
        query += ` AND l.used_at < ($${paramCount}::date + INTERVAL '1 day')`;
        queryParams.push(endDate);
      }
    }
    query += ` ORDER BY l.used_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    console.log('📊 Query:', query);
    console.log('📊 Query params:', queryParams);
    
    const result = await paymentPool.query(query, queryParams);
    
    console.log('📊 Query result count:', result.rows.length);
    
    // Fetch user names from auth database
    const userIds = [...new Set(result.rows.map(row => row.user_id))];
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
        // Continue without user names if there's an error
      }
    }
    
    // Enrich the results with user names
    const enrichedData = result.rows.map(row => ({
      ...row,
      user_name: userMap[row.user_id]?.username || `User ${row.user_id}`,
      user_email: userMap[row.user_id]?.email || null
    }));
    
    res.status(200).json({
      success: true,
      data: enrichedData,
      count: enrichedData.length
    });
  } catch (err) {
    console.error('Error fetching LLM usage logs:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch LLM usage logs: ' + err.message 
    });
  }
};

// ---------------------
// Get aggregated statistics
// ---------------------
const getLlmUsageStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    const queryParams = [];
    if (startDate && endDate) {
      dateFilter = 'WHERE used_at >= $1::date AND used_at < ($2::date + INTERVAL \'1 day\')';
      queryParams.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = 'WHERE used_at >= $1::date';
      queryParams.push(startDate);
    } else if (endDate) {
      dateFilter = 'WHERE used_at < ($1::date + INTERVAL \'1 day\')';
      queryParams.push(endDate);
    }
    
    console.log('📊 Stats query date filter:', dateFilter);
    console.log('📊 Stats query params:', queryParams);
    // Total statistics - Sum request_count instead of COUNT(*) since rows can represent multiple requests
    const totalStatsQuery = `
      SELECT 
        SUM(request_count) as total_requests,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT model_name) as unique_models,
        SUM(total_tokens) as total_tokens,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_cost) as total_cost,
        SUM(input_cost) as total_input_cost,
        SUM(output_cost) as total_output_cost
      FROM llm_usage_logs
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
    // Statistics by model - Sum request_count instead of COUNT(*)
    const modelStatsQuery = `
      SELECT 
        model_name,
        SUM(request_count) as request_count,
        COUNT(DISTINCT user_id) as user_count,
        SUM(total_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(total_cost) as total_cost,
        SUM(input_cost) as input_cost,
        SUM(output_cost) as output_cost
      FROM llm_usage_logs
      ${dateFilter}
      GROUP BY model_name
      ORDER BY total_cost DESC
    `;
    const modelStats = await paymentPool.query(modelStatsQuery, queryParams);
    // Statistics by user - Sum request_count instead of COUNT(*)
    const userStatsQuery = `
      SELECT 
        user_id,
        SUM(request_count) as request_count,
        COUNT(DISTINCT model_name) as model_count,
        SUM(total_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(total_cost) as total_cost,
        SUM(input_cost) as input_cost,
        SUM(output_cost) as output_cost
      FROM llm_usage_logs
      ${dateFilter}
      GROUP BY user_id
      ORDER BY total_cost DESC
      LIMIT 20
    `;
    const userStats = await paymentPool.query(userStatsQuery, queryParams);
    
    // Fetch user names for statistics
    const statsUserIds = userStats.rows.map(row => row.user_id);
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
    // Daily usage trend (last 30 days or within date range)
    // Use used_date column directly for grouping (more efficient than DATE(used_at))
    let dailyTrendFilter = '';
    let dailyTrendParams = [];
    
    if (dateFilter) {
      // Replace used_at with used_date in the filter for consistency
      dailyTrendFilter = dateFilter.replace(/used_at/g, 'used_date');
      dailyTrendParams = [...queryParams];
    } else {
      dailyTrendFilter = 'WHERE used_date >= CURRENT_DATE - INTERVAL \'30 days\'';
      dailyTrendParams = [];
    }
    
    const dailyTrendQuery = `
      SELECT 
        used_date as date,
        SUM(request_count) as request_count,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost
      FROM llm_usage_logs
      ${dailyTrendFilter}
      GROUP BY used_date
      ORDER BY date ASC
    `;
    const dailyTrendResult = await paymentPool.query(dailyTrendQuery, dailyTrendParams);

    // Convert string values to numbers for totals (PostgreSQL returns COUNT/SUM as strings)
    const totalsRow = totalStats.rows[0] || {};
    const totals = {
      total_requests: parseInt(totalsRow.total_requests) || 0,
      unique_users: parseInt(totalsRow.unique_users) || 0,
      unique_models: parseInt(totalsRow.unique_models) || 0,
      total_tokens: parseFloat(totalsRow.total_tokens) || 0,
      total_input_tokens: parseFloat(totalsRow.total_input_tokens) || 0,
      total_output_tokens: parseFloat(totalsRow.total_output_tokens) || 0,
      total_cost: parseFloat(totalsRow.total_cost) || 0,
      total_input_cost: parseFloat(totalsRow.total_input_cost) || 0,
      total_output_cost: parseFloat(totalsRow.total_output_cost) || 0,
      total_users: totalUsersCount
    };

    // Convert model stats to proper numbers
    const byModel = modelStats.rows.map(row => ({
      model_name: row.model_name,
      request_count: parseInt(row.request_count) || 0,
      user_count: parseInt(row.user_count) || 0,
      total_tokens: parseFloat(row.total_tokens) || 0,
      input_tokens: parseFloat(row.input_tokens) || 0,
      output_tokens: parseFloat(row.output_tokens) || 0,
      total_cost: parseFloat(row.total_cost) || 0,
      input_cost: parseFloat(row.input_cost) || 0,
      output_cost: parseFloat(row.output_cost) || 0
    }));

    // Convert user stats to proper numbers
    const byUser = enrichedUserStats.map(row => ({
      user_id: row.user_id,
      user_name: row.user_name,
      user_email: row.user_email,
      request_count: parseInt(row.request_count) || 0,
      model_count: parseInt(row.model_count) || 0,
      total_tokens: parseFloat(row.total_tokens) || 0,
      input_tokens: parseFloat(row.input_tokens) || 0,
      output_tokens: parseFloat(row.output_tokens) || 0,
      total_cost: parseFloat(row.total_cost) || 0,
      input_cost: parseFloat(row.input_cost) || 0,
      output_cost: parseFloat(row.output_cost) || 0
    }));

    // Convert daily trend to proper numbers
    const dailyTrend = dailyTrendResult.rows.map(row => ({
      date: row.date,
      request_count: parseInt(row.request_count) || 0,
      total_tokens: parseFloat(row.total_tokens) || 0,
      total_cost: parseFloat(row.total_cost) || 0
    }));

    res.status(200).json({
      success: true,
      data: {
        totals,
        byModel,
        byUser,
        dailyTrend
      }
    });
  } catch (err) {
    console.error('Error fetching LLM usage statistics:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch LLM usage statistics: ' + err.message 
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
        id,
        user_id,
        model_name,
        input_tokens,
        output_tokens,
        total_tokens,
        input_cost,
        output_cost,
        total_cost,
        request_id,
        endpoint,
        file_id,
        session_id,
        used_at,
        created_at,
        request_count
      FROM llm_usage_logs
      WHERE user_id = $1
      ORDER BY used_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await paymentPool.query(query, [parseInt(userId), parseInt(limit), parseInt(offset)]);
    
    // Fetch user name
    let userName = `User ${userId}`;
    try {
      const userResult = await authPool.query('SELECT username, email FROM users WHERE id = $1', [parseInt(userId)]);
      if (userResult.rows.length > 0) {
        userName = userResult.rows[0].username || userName;
      }
    } catch (userErr) {
      console.error('Error fetching user name:', userErr.message);
    }
    
    // Enrich results
    const enrichedData = result.rows.map(row => ({
      ...row,
      user_name: userName,
      user_email: null
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

module.exports = {
  getAllLlmUsageLogs,
  getLlmUsageStats,
  getUsageByUserId
};


