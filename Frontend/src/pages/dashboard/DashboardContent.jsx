// import React from 'react';

// const DashboardContent = () => {
//   console.log('DashboardContent is rendering');
//   return (
//     <div className="p-6 bg-white rounded-lg shadow-md">
//       <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Overview</h2>
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//         {/* Card 1 */}
//         <div className="bg-blue-100 p-4 rounded-lg shadow">
//           <h3 className="text-xl font-semibold text-blue-800 mb-2">Total Cases</h3>
//           <p className="text-3xl font-bold text-blue-900">1,234</p>
//         </div>
//         {/* Card 2 */}
//         <div className="bg-green-100 p-4 rounded-lg shadow">
//           <h3 className="text-xl font-semibold text-green-800 mb-2">Active Clients</h3>
//           <p className="text-3xl font-bold text-green-900">567</p>
//         </div>
//         {/* Card 3 */}
//         <div className="bg-yellow-100 p-4 rounded-lg shadow">
//           <h3 className="text-xl font-semibold text-yellow-800 mb-2">Pending Tasks</h3>
//           <p className="text-3xl font-bold text-yellow-900">89</p>
//         </div>
//       </div>
//       <div className="mt-8">
//         <h3 className="text-2xl font-bold text-gray-800 mb-4">Recent Activity</h3>
//         <ul className="list-disc list-inside text-gray-700">
//           <li>Case #1234 updated by John Doe.</li>
//           <li>New client "ABC Corp" added.</li>
//           <li>Document "Contract_v2.pdf" uploaded.</li>
//         </ul>
//       </div>
//     </div>
//   );
// };

// export default DashboardContent;


import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, CreditCard, DollarSign, Calendar, UserCheck, AlertCircle, Eye } from 'lucide-react';

const SubscriptionDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');

  // Sample data - in real app, this would come from your API
  const monthlyRevenue = [
    { month: 'Jan', revenue: 12500, subscribers: 250 },
    { month: 'Feb', revenue: 15800, subscribers: 316 },
    { month: 'Mar', revenue: 18200, subscribers: 364 },
    { month: 'Apr', revenue: 22100, subscribers: 442 },
    { month: 'May', revenue: 25400, subscribers: 508 },
    { month: 'Jun', revenue: 28900, subscribers: 578 },
    { month: 'Jul', revenue: 32100, subscribers: 642 },
    { month: 'Aug', revenue: 35600, subscribers: 712 }
  ];

  const subscriptionTiers = [
    { name: 'Basic', value: 45, color: '#3B82F6' },
    { name: 'Pro', value: 35, color: '#10B981' },
    { name: 'Enterprise', value: 20, color: '#F59E0B' }
  ];

  const recentActivities = [
    { id: 1, user: 'Alice Johnson', action: 'Upgraded to Pro', time: '2 hours ago', type: 'upgrade' },
    { id: 2, user: 'Tech Corp Ltd', action: 'New Enterprise subscription', time: '4 hours ago', type: 'new' },
    { id: 3, user: 'Mike Chen', action: 'Payment processed', time: '6 hours ago', type: 'payment' },
    { id: 4, user: 'Sarah Wilson', action: 'Subscription renewed', time: '1 day ago', type: 'renewal' },
    { id: 5, user: 'David Brown', action: 'Canceled subscription', time: '2 days ago', type: 'cancel' }
  ];

  const getActivityIcon = (type) => {
    switch(type) {
      case 'upgrade': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'new': return <UserCheck className="w-4 h-4 text-blue-500" />;
      case 'payment': return <CreditCard className="w-4 h-4 text-green-500" />;
      case 'renewal': return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'cancel': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Eye className="w-4 h-4 text-gray-500" />;
    }
  };

  const StatCard = ({ title, value, change, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {change && (
        <div className="mt-4 flex items-center">
          <span className={`text-sm font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
          <span className="text-sm text-gray-500 ml-2">vs last month</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Subscription Dashboard</h1>
          <p className="text-gray-600">Track your subscription metrics and revenue performance</p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Subscribers"
            value="712"
            change={12.5}
            icon={Users}
            color="bg-blue-500"
            subtitle="Active users"
          />
          <StatCard
            title="Monthly Revenue"
            value="$35,600"
            change={8.3}
            icon={DollarSign}
            color="bg-green-500"
            subtitle="Recurring revenue"
          />
          <StatCard
            title="Active Subscriptions"
            value="698"
            change={5.2}
            icon={CreditCard}
            color="bg-purple-500"
            subtitle="98% retention rate"
          />
          <StatCard
            title="Churn Rate"
            value="2.1%"
            change={-0.4}
            icon={TrendingUp}
            color="bg-orange-500"
            subtitle="Industry avg: 5.6%"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Revenue Trend */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Revenue & Subscriber Growth</h3>
              <select 
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#3B82F6', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Subscription Tiers */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Subscription Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={subscriptionTiers}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {subscriptionTiers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4">
              {subscriptionTiers.map((tier, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: tier.color }}
                    ></div>
                    <span className="text-sm font-medium text-gray-700">{tier.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{tier.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activities & Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Activities</h3>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <div className="mr-3">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.user}</p>
                    <p className="text-sm text-gray-600">{activity.action}</p>
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Performance Metrics</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Customer Lifetime Value</span>
                  <span className="text-sm font-bold text-gray-900">$2,840</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Monthly Growth Rate</span>
                  <span className="text-sm font-bold text-green-600">+12.3%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Payment Success Rate</span>
                  <span className="text-sm font-bold text-gray-900">97.8%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: '98%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">User Engagement</span>
                  <span className="text-sm font-bold text-gray-900">89.2%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: '89%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDashboard;