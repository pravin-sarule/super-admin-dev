import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DashboardContent from './pages/dashboard/DashboardContent';
import UserManagement from './pages/dashboard/UserManagement';
import UserAnalytics from './pages/dashboard/UserAnalytics';
import PlanAnalytics from './pages/dashboard/PlanAnalytics';
import AdminManagement from './components/auth/Admins/AdminManagement';
import ContentManagement from './pages/dashboard/ContentManagement';
import TemplateManagement from './pages/dashboard/TemplateManagement/index';
import SubscriptionManagement from './pages/dashboard/SubscriptionManagement';
import SupportHelp from './pages/dashboard/SupportHelp';
import PromptManagement from './pages/dashboard/PromptManagement';
import SystemPromptManagement from './pages/dashboard/SystemPromptManagement';
import AgentList from './pages/dashboard/agent-prompt';
import LLMManagement from './pages/dashboard/LLMManagement';
import DocumentManagement from './pages/dashboard/DocumentManagement';
import DemoManagement from './pages/dashboard/DemoManagement';
import JudgementManagement from './pages/dashboard/JudgementManagement';
import JudgementSearch from './pages/dashboard/JudgementSearch';
import CitationManagement from './pages/dashboard/CitationManagement';
import AddCaseType from './pages/dashboard/content/AddCaseType';
import AddCourt from './pages/dashboard/content/AddCourt';
import AddJudge from './pages/dashboard/content/AddJudge';
import VoiceManagementPage from './features/jurinex-voice/pages/VoiceManagementPage';
import RoleManagement from './pages/dashboard/RoleManagement';
import './App.css';
import './index.css';

// Where each role lands by default and gets redirected when it hits a page
// it isn't allowed to see. Every role's home MUST be a route that role can
// access, otherwise RequireRole would redirect-loop.
const ROLE_HOME = {
  'super-admin': '/dashboard',
  'user-admin': '/dashboard/users',
  'account-admin': '/dashboard/subscriptions',
  'marketing-admin': '/dashboard/demo-bookings',
  'support-admin': '/dashboard/support',
};

// Route-level role guard. Hiding a sidebar item is only cosmetic; this blocks
// direct URL access for roles that aren't allowed on a given route.
// super-admin (and the legacy generic "admin") always pass, so each route only
// needs to list the ADDITIONAL non-super roles that may access it.
const RequireRole = ({ allow, children }) => {
  const role = localStorage.getItem('userRole');
  if (role === 'super-admin' || role === 'admin' || allow.includes(role)) {
    return children;
  }
  return <Navigate to={ROLE_HOME[role] || '/dashboard'} replace />;
};

const DashboardIndex = () => {
  const role = localStorage.getItem('userRole');
  // Roles without the generic dashboard land on their own home instead.
  if (role === 'marketing-admin' || role === 'support-admin') {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }
  return <DashboardContent />;
};

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
            <Route index element={<DashboardIndex />} />
            <Route path="users" element={<RequireRole allow={['user-admin']}><UserManagement /></RequireRole>} />
            <Route path="users/:userId/analytics" element={<RequireRole allow={['user-admin']}><UserAnalytics /></RequireRole>} />
            <Route path="firms/:firmId/analytics" element={<RequireRole allow={['user-admin']}><UserAnalytics mode="firm" /></RequireRole>} />
            <Route path="admins" element={<RequireRole allow={[]}><AdminManagement /></RequireRole>} />
            <Route path="content" element={<RequireRole allow={['user-admin']}><ContentManagement /></RequireRole>} />
            <Route path="content/case-type" element={<RequireRole allow={['user-admin']}><AddCaseType /></RequireRole>} />
            <Route path="content/court" element={<RequireRole allow={['user-admin']}><AddCourt /></RequireRole>} />
            <Route path="content/judge" element={<RequireRole allow={['user-admin']}><AddJudge /></RequireRole>} />
            <Route path="templates" element={<RequireRole allow={[]}><TemplateManagement /></RequireRole>} />
            <Route path="subscriptions" element={<RequireRole allow={['account-admin']}><SubscriptionManagement /></RequireRole>} />
            <Route path="subscriptions/analytics" element={<RequireRole allow={['account-admin']}><PlanAnalytics /></RequireRole>} />
            <Route path="prompts" element={<RequireRole allow={[]}><PromptManagement /></RequireRole>} />
            <Route path="agent-prompts" element={<RequireRole allow={[]}><AgentList /></RequireRole>} />
            <Route path="system-prompts" element={<RequireRole allow={[]}><SystemPromptManagement /></RequireRole>} />
            <Route path="llm-management" element={<RequireRole allow={[]}><LLMManagement /></RequireRole>} />
            <Route path="documents" element={<RequireRole allow={['marketing-admin']}><DocumentManagement /></RequireRole>} />
            <Route path="demo-bookings" element={<RequireRole allow={['marketing-admin']}><DemoManagement /></RequireRole>} />
            <Route path="judgements" element={<RequireRole allow={[]}><JudgementManagement /></RequireRole>} />
            <Route path="judgement-search" element={<RequireRole allow={[]}><JudgementSearch /></RequireRole>} />
            <Route path="citation-management" element={<RequireRole allow={[]}><CitationManagement /></RequireRole>} />
            <Route path="voice-management" element={<RequireRole allow={[]}><VoiceManagementPage /></RequireRole>} />
            <Route path="roles" element={<RequireRole allow={[]}><RoleManagement /></RequireRole>} />
            <Route path="support" element={<RequireRole allow={['support-admin']}><SupportHelp /></RequireRole>} />
            <Route path="support/admin/:managerId" element={<RequireRole allow={['support-admin']}><SupportHelp /></RequireRole>} />
            <Route path="support/:queryId" element={<RequireRole allow={['support-admin']}><SupportHelp /></RequireRole>} />
          </Route>
        </Route>

        {/* Fallback for any unmatched routes */}
        <Route path="*" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
