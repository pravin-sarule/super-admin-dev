import React, { useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const ProtectedRoute = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        const currentTime = Date.now() / 1000; // in seconds

        if (decodedToken.exp < currentTime) {
          // Token expired
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          navigate('/login');
        }
      } catch (error) {
        // Invalid token
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/login');
      }
    }
  }, [token, navigate]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet context={{ userRole }} />;
};

export default ProtectedRoute;