import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; // Removed useNavigate
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DashboardContent from './pages/dashboard/DashboardContent';
import UserManagement from './pages/dashboard/UserManagement';
import AdminManagement from './components/auth/Admins/AdminManagement';
import ContentManagement from './pages/dashboard/ContentManagement';
// import TemplateManagement from './pages/dashboard/TemplateManagement';
import SubscriptionManagement from './pages/dashboard/SubscriptionManagement';
import SupportHelp from './pages/dashboard/SupportHelp';
import PromptManagement from './pages/dashboard/PromptManagement';
import SystemPromptManagement from './pages/dashboard/SystemPromptManagement';
import LLMManagement from './pages/dashboard/LLMManagement';
import AddCaseType from './pages/dashboard/content/AddCaseType';
import AddCourt from './pages/dashboard/content/AddCourt';
import AddJudge from './pages/dashboard/content/AddJudge';
import './App.css';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Initialize isAuthenticated from localStorage on component mount
    const token = localStorage.getItem('token');
    // In a real application, you would decode the token and check its validity/expiration
    return !!token; // Returns true if token exists, false otherwise
  });

  // Placeholder for login logic
  const handleLogin = () => {
    setIsAuthenticated(true);
    // Redirection is now handled by LoginPage itself
  };

  // Placeholder for logout logic
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('token'); // Clear token on logout
    setIsAuthenticated(false); // Update state on logout
  };

  // Effect to handle authentication status on initial load and token changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // In a real application, you would decode the token and check its expiration
      // For now, we'll just assume it's valid if it exists
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []); // Empty dependency array means this effect runs once on mount

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage setAuthStatus={setIsAuthenticated} />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardContent />} /> {/* Default dashboard content */}
            <Route path="users" element={<UserManagement />} />
            <Route path="admins" element={<AdminManagement />} />
            <Route path="content" element={<ContentManagement />} />
            <Route path="content/case-type" element={<AddCaseType />} />
  <Route path="content/court" element={<AddCourt />} />
  <Route path="content/judge" element={<AddJudge />} />
            {/* <Route path="templates" element={<TemplateManagement />} /> */}
            <Route path="subscriptions" element={<SubscriptionManagement />} />
            <Route path="prompts" element={<PromptManagement />} />
            <Route path="system-prompts" element={<SystemPromptManagement />} />
            <Route path="llm-management" element={<LLMManagement />} />
            <Route path="support" element={<SupportHelp />} />
          </Route>
        </Route>

        {/* Fallback for any unmatched routes */}
        <Route path="*" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
