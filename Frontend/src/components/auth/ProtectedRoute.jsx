import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const ProtectedRoute = ({ isAuthenticated }) => {
  const userRole = localStorage.getItem('userRole');
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  useEffect(() => {
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        const currentTime = Date.now() / 1000;

        if (decodedToken.exp < currentTime) {
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('userRole');
          window.location.href = '/login';
        }
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('userRole');
        window.location.href = '/login';
      }
    }
  }, [token]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet context={{ userRole }} />;
};

export default ProtectedRoute;