import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Users, CreditCard, DollarSign, Calendar, Activity, Database, Zap, RefreshCw, AlertCircle, BarChart3, PieChart as PieChartIcon, ChevronLeft, ChevronRight, X, User } from 'lucide-react';
import axios from 'axios';

const DashboardContent = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [usageLogs, setUsageLogs] = useState([]);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination and filters for logs table
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(10);
  const [filterUsername, setFilterUsername] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [totalLogsCount, setTotalLogsCount] = useState(0);
  const API_BASE_URL = 'https://super-admin-backend-120280829617.asia-south1.run.app/api/llm-usage';

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, filterUsername, filterModel]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterUsername, filterModel]);

  const fetchDashboardData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please login again.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Calculate date range based on selected period
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(selectedPeriod));
      
      // Set time to start of day for startDate and end of day for endDate
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const dateParams = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
      
      console.log('📅 Date range:', {
        start: dateParams.startDate,
        end: dateParams.endDate,
        startDateObj: startDate,
        endDateObj: endDate
      });

      console.log('📊 Fetching dashboard data with params:', dateParams);

      // Fetch statistics - try with date filter first, if empty try without
      let statsResponse;
      try {
        statsResponse = await axios.get(`${API_BASE_URL}/stats`, {
          headers,
          params: dateParams,
        });
        console.log('📊 Stats response:', statsResponse.data);
        
        // If no data with date filter, try without date filter
        if (statsResponse.data?.data?.totals?.total_requests === '0' || 
            statsResponse.data?.data?.totals?.total_requests === 0 ||
            !statsResponse.data?.data?.totals) {
          console.log('📊 No data with date filter, trying without date filter...');
          statsResponse = await axios.get(`${API_BASE_URL}/stats`, {
            headers,
            params: {},
          });
          console.log('📊 Stats response (no date filter):', statsResponse.data);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
        throw err;
      }

      // Fetch usage logs with filters and pagination
      let logsResponse;
      try {
        const logsParams = {
          limit: 1000, // Fetch enough for client-side pagination and filtering
          offset: 0,
          ...dateParams
        };
        
        if (filterUsername) {
          logsParams.userName = filterUsername;
        }
        if (filterModel) {
          logsParams.modelName = filterModel;
        }
        
        logsResponse = await axios.get(`${API_BASE_URL}`, {
          headers,
          params: logsParams,
        });
        console.log('📊 Logs response:', logsResponse.data);
        
        // If no data with date filter, try without date filter
        if (!logsResponse.data?.data || logsResponse.data.data.length === 0) {
          console.log('📊 No logs with date filter, trying without date filter...');
          const fallbackParams = {
            limit: 1000,
            offset: 0,
            all: true
          };
          if (filterUsername) fallbackParams.userName = filterUsername;
          if (filterModel) fallbackParams.modelName = filterModel;
          
          logsResponse = await axios.get(`${API_BASE_URL}`, {
            headers,
            params: fallbackParams,
          });
          console.log('📊 Logs response (no date filter):', logsResponse.data);
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
        throw err;
      }

      // Check if response has the expected structure
      if (statsResponse.data && statsResponse.data.success && statsResponse.data.data) {
        setStats(statsResponse.data.data);
      } else {
        console.error('Unexpected stats response structure:', statsResponse.data);
        setStats(null);
      }

      if (logsResponse.data && logsResponse.data.success && logsResponse.data.data) {
        setUsageLogs(logsResponse.data.data || []);
      } else if (Array.isArray(logsResponse.data)) {
        // Handle case where API returns array directly
        setUsageLogs(logsResponse.data || []);
      } else {
        console.error('Unexpected logs response structure:', logsResponse.data);
        setUsageLogs([]);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, gradient, subtitle, formatValue, trend }) => (
    <div className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
      
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl ${color} shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {trend && (
            <div className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <TrendingUp className={`w-3 h-3 mr-1 ${trend > 0 ? '' : 'rotate-180'}`} />
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {formatValue ? formatValue(value) : value || '0'}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 flex items-center mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const formatCurrency = (value) => {
    if (!value) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(value));
  };

  const formatNumber = (value) => {
    if (!value) return '0';
    return new Intl.NumberFormat('en-IN').format(parseInt(value));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Prepare chart data
  const dailyTrendData = stats?.dailyTrend?.length > 0 
    ? stats.dailyTrend.map((item) => ({
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cost: parseFloat(item.total_cost) || 0,
        tokens: parseInt(item.total_tokens) || 0,
        requests: parseInt(item.request_count) || 0,
      }))
    : [];

  const modelDistributionData = stats?.byModel?.length > 0
    ? stats.byModel.slice(0, 10).map((item) => ({
        name: item.model_name.length > 15 ? item.model_name.substring(0, 15) + '...' : item.model_name,
        fullName: item.model_name,
        value: parseFloat(item.total_cost) || 0,
        requests: parseInt(item.request_count) || 0,
      }))
    : [];

  const COLORS = [
    'rgba(59, 130, 246, 0.8)',   // Blue
    'rgba(16, 185, 129, 0.8)',   // Green
    'rgba(245, 158, 11, 0.8)',   // Amber
    'rgba(239, 68, 68, 0.8)',    // Red
    'rgba(139, 92, 246, 0.8)',   // Purple
    'rgba(236, 72, 153, 0.8)',   // Pink
    'rgba(6, 182, 212, 0.8)',    // Cyan
    'rgba(249, 115, 22, 0.8)',   // Orange
  ];

  const COLORS_SOLID = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>
          </div>
          <p className="text-gray-600 font-medium mt-4">Loading dashboard data...</p>
          <p className="text-sm text-gray-400 mt-2">Please wait while we fetch your analytics</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-red-100 max-w-md w-full">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Error Loading Dashboard</h3>
          <p className="text-red-600 text-center mb-6">{error}</p>
          <button
            onClick={() => fetchDashboardData()}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              LLM Usage Dashboard
            </h1>
            <p className="text-gray-600 text-sm md:text-base">Track model usage, tokens, and costs across all users</p>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="mt-4 md:mt-0 px-6 py-3 bg-white rounded-xl shadow-md hover:shadow-lg border border-gray-200 text-gray-700 font-medium transition-all duration-300 hover:bg-gray-50 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard
            title="Total Requests"
            value={stats?.totals?.total_requests || 0}
            icon={Activity}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
            gradient="from-blue-500 to-blue-600"
            subtitle="API calls processed"
            formatValue={formatNumber}
          />
          <StatCard
            title="Total Cost"
            value={stats?.totals?.total_cost || 0}
            icon={DollarSign}
            color="bg-gradient-to-br from-green-500 to-emerald-600"
            gradient="from-green-500 to-emerald-600"
            subtitle="All models combined"
            formatValue={formatCurrency}
          />
          <StatCard
            title="Total Tokens"
            value={stats?.totals?.total_tokens || 0}
            icon={Zap}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
            gradient="from-purple-500 to-purple-600"
            subtitle="Input + Output tokens"
            formatValue={formatNumber}
          />
          <StatCard
            title="Unique Users"
            value={stats?.totals?.unique_users || 0}
            icon={Users}
            color="bg-gradient-to-br from-orange-500 to-orange-600"
            gradient="from-orange-500 to-orange-600"
            subtitle={`${stats?.totals?.total_users || 0} total users`}
            formatValue={formatNumber}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Daily Usage Trend */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Usage Trend</h3>
              </div>
              <select
                className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-medium transition-all duration-200 hover:border-gray-400"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
            {dailyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={dailyTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280" 
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    yAxisId="left" 
                    stroke="#6b7280" 
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#6b7280" 
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      padding: '12px',
                    }}
                    formatter={(value, name) => {
                      if (name === 'Cost (₹)') {
                        return formatCurrency(value);
                      }
                      return formatNumber(value);
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cost"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    name="Cost (₹)"
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2, fill: '#fff' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="tokens"
                    stroke="#10B981"
                    strokeWidth={3}
                    name="Tokens"
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2, fill: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[320px] text-gray-400">
                <BarChart3 className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">No data available</p>
                <p className="text-sm mt-1">for the selected period</p>
              </div>
            )}
          </div>

          {/* Model Distribution */}
          <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <PieChartIcon className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Cost by Model</h3>
            </div>
            {modelDistributionData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={modelDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {modelDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                  {modelDistributionData.map((model, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center flex-1 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
                          style={{ backgroundColor: COLORS_SOLID[index % COLORS_SOLID.length] }}
                        ></div>
                        <span className="text-sm font-medium text-gray-700 truncate" title={model.fullName}>
                          {model.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900 ml-2">
                        {formatCurrency(model.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
                <PieChartIcon className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-sm font-medium">No model data</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Users and Models Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Top Users */}
          <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Top Users by Cost</h3>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {stats?.byUser?.slice(0, 10).map((user, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border border-transparent hover:border-blue-100">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mr-3 shadow-md flex-shrink-0">
                      <span className="text-white font-bold text-sm">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {user.user_name || `User #${user.user_id}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatNumber(user.request_count)} requests • {formatNumber(user.total_tokens)} tokens
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(user.total_cost)}</p>
                    <p className="text-xs text-gray-500">{user.model_count} models</p>
                  </div>
                </div>
              ))}
              {(!stats?.byUser || stats.byUser.length === 0) && (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No user data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Models */}
          <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <Database className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Top Models by Cost</h3>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {stats?.byModel?.slice(0, 10).map((model, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 transition-all duration-200 border border-transparent hover:border-green-100">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mr-3 shadow-md flex-shrink-0">
                      <Database className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate" title={model.model_name}>
                        {model.model_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatNumber(model.request_count)} requests • {formatNumber(model.user_count)} users
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(model.total_cost)}</p>
                    <p className="text-xs text-gray-500">{formatNumber(model.total_tokens)} tokens</p>
                  </div>
                </div>
              ))}
              {(!stats?.byModel || stats.byModel.length === 0) && (
                <div className="text-center py-12 text-gray-400">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No model data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Usage Logs Table */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                <Activity className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Recent Usage Logs</h3>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by username..."
                  value={filterUsername}
                  onChange={(e) => {
                    setFilterUsername(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-4 py-2 w-48 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
                <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by model..."
                  value={filterModel}
                  onChange={(e) => {
                    setFilterModel(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-4 py-2 w-48 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
                <Database className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
              
              {(filterUsername || filterModel) && (
                <button
                  onClick={() => {
                    setFilterUsername('');
                    setFilterModel('');
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 flex items-center"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </button>
              )}
              
              <button
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium transition-all duration-300 shadow-md hover:shadow-lg flex items-center disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Input Tokens
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Output Tokens
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total Tokens
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Input Cost
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Output Cost
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Used At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usageLogs.length > 0 ? (
                  usageLogs
                    .slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage)
                    .map((log, index) => (
                    <tr 
                      key={log.id} 
                      className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <span className="text-sm font-semibold text-gray-900 block">
                            {log.user_name || `User #${log.user_id}`}
                          </span>
                          {log.user_email && (
                            <span className="text-xs text-gray-500">{log.user_email}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 font-medium">{log.model_name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatNumber(log.input_tokens)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatNumber(log.output_tokens)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatNumber(log.total_tokens)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatCurrency(log.input_cost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatCurrency(log.output_cost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-green-600">
                          {formatCurrency(log.total_cost)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(log.used_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <Activity className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No usage logs found</p>
                        <p className="text-sm text-gray-400 mt-1">Try adjusting the date range or refresh the data</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {usageLogs.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{(currentPage - 1) * logsPerPage + 1}</span> to{' '}
                <span className="font-semibold">
                  {Math.min(currentPage * logsPerPage, usageLogs.length)}
                </span>{' '}
                of <span className="font-semibold">{usageLogs.length}</span> results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.ceil(usageLogs.length / logsPerPage) }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first page, last page, current page, and pages around current
                      return (
                        page === 1 ||
                        page === Math.ceil(usageLogs.length / logsPerPage) ||
                        Math.abs(page - currentPage) <= 1
                      );
                    })
                    .map((page, index, array) => {
                      // Add ellipsis if there's a gap
                      const prevPage = array[index - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;
                      
                      return (
                        <React.Fragment key={page}>
                          {showEllipsis && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                              currentPage === page
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(usageLogs.length / logsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(usageLogs.length / logsPerPage)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardContent;
