

// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import axios from 'axios';
// import { Eye, EyeOff, Lock, Mail, Shield, User, AlertCircle, CheckCircle } from 'lucide-react';

// const LoginPage = ({ setAuthStatus }) => { // Added setAuthStatus prop
//   const [showPassword, setShowPassword] = useState(false);
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [rememberMe, setRememberMe] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [success, setSuccess] = useState('');
//   const navigate = useNavigate();

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setIsLoading(true);
//     setError('');
//     setSuccess('');

//     try {
//       const response = await axios.post('https://super-admin-backend-120280829617.asia-south1.run.app/api/auth/login',
//         { email, password },
//         {
//           headers: {
//             'Content-Type': 'application/json',
//           },
//         }
//       );
//       localStorage.setItem('token', response.data.token);
//       const roleToStore = response.data.role; // Use the role directly from the backend
//       console.log('Role from backend:', response.data.role);
//       console.log('Role to store:', roleToStore);
//       localStorage.setItem('userRole', roleToStore); // Store user role
//       setSuccess('Login successful! Redirecting to dashboard...');
//       setAuthStatus(true); // Call setAuthStatus to update authentication state in App.jsx immediately
//       setTimeout(() => {
//         navigate('/dashboard');
//       }, 1000);
//     } catch (err) {
//       setError(err.response?.data?.message || 'Login failed. Please try again.');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const togglePasswordVisibility = () => {
//     setShowPassword(!showPassword);
//   };

//   return (
//     <div className="min-h-screen bg-white flex items-center justify-center p-4 font-inter">
//       <div className="w-full max-w-md">
//         {/* Header Section */}
//         <div className="text-center mb-8">
//           <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700 rounded-xl mb-4 shadow-lg">
//             <Shield className="w-8 h-8 text-white" />
//           </div>
//           <h1 className="text-3xl font-semibold text-gray-800 mb-2">Admin Portal</h1>
//           <p className="text-gray-600 font-medium">Sign in to your admin account</p>
//         </div>

//         {/* Login Card */}
//         <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">

//           {/* Error Message */}
//           {error && (
//             <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
//               <div className="flex items-center">
//                 <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
//                 <span className="text-sm text-red-700 font-medium">{error}</span>
//               </div>
//             </div>
//           )}

//           {/* Success Message */}
//           {success && (
//             <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
//               <div className="flex items-center">
//                 <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
//                 <span className="text-sm text-green-700 font-medium">{success}</span>
//               </div>
//             </div>
//           )}

//           <form onSubmit={handleSubmit} className="space-y-6">
//             {/* Email Field */}
//             <div>
//               <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
//                 Email Address
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                   <Mail className="h-4 w-4 text-gray-600" />
//                 </div>
//                 <input
//                   id="email"
//                   name="email"
//                   type="email"
//                   autoComplete="email"
//                   required
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-medium transition-colors"
//                   placeholder="Enter your email"
//                 />
//               </div>
//             </div>

//             {/* Password Field */}
//             <div>
//               <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
//                 Password
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                   <Lock className="h-4 w-4 text-gray-600" />
//                 </div>
//                 <input
//                   id="password"
//                   name="password"
//                   type={showPassword ? 'text' : 'password'}
//                   autoComplete="current-password"
//                   required
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-medium transition-colors"
//                   placeholder="Enter your password"
//                 />
//                 <button
//                   type="button"
//                   onClick={togglePasswordVisibility}
//                   className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none"
//                 >
//                   {showPassword ? (
//                     <EyeOff className="h-4 w-4 text-gray-600 hover:text-gray-800 transition-colors" />
//                   ) : (
//                     <Eye className="h-4 w-4 text-gray-600 hover:text-gray-800 transition-colors" />
//                   )}
//                 </button>
//               </div>
//             </div>

//             {/* Remember Me & Forgot Password */}
//             <div className="flex items-center justify-between">
//               <div className="flex items-center">
//                 <input
//                   id="remember-me"
//                   name="remember-me"
//                   type="checkbox"
//                   checked={rememberMe}
//                   onChange={(e) => setRememberMe(e.target.checked)}
//                   className="h-4 w-4 text-gray-700 focus:ring-gray-500 border-gray-300 rounded transition-colors"
//                 />
//                 <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-gray-700">
//                   Remember me
//                 </label>
//               </div>

//               <div className="text-sm">
//                 <button
//                   type="button"
//                   className="font-semibold text-gray-700 hover:text-gray-800 focus:outline-none focus:underline transition-colors"
//                 >
//                   Forgot password?
//                 </button>
//               </div>
//             </div>

//             {/* Login Button */}
//             <div>
//               <button
//                 type="submit"
//                 disabled={isLoading}
//                 className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${
//                   isLoading
//                     ? 'bg-gray-400 cursor-not-allowed'
//                     : 'bg-gray-700 hover:bg-gray-800 active:bg-gray-900'
//                 }`}
//               >
//                 {isLoading ? (
//                   <div className="flex items-center">
//                     <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//                     </svg>
//                     Signing in...
//                   </div>
//                 ) : (
//                   <div className="flex items-center">
//                     <User className="w-4 h-4 mr-2" />
//                     Sign in to Admin Portal
//                   </div>
//                 )}
//               </button>
//             </div>
//           </form>

//           {/* Additional Options */}
//           <div className="mt-6 pt-6 border-t border-gray-200">
//             <div className="text-center">
//               <p className="text-xs text-gray-600">
//                 Need help accessing your account?{' '}
//                 <button className="font-semibold text-gray-700 hover:text-gray-800 focus:outline-none focus:underline transition-colors">
//                   Contact Support
//                 </button>
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="mt-8 text-center">
//           <p className="text-xs text-gray-500">
//             © 2024 Admin Portal. All rights reserved.
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default LoginPage;


import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, Lock, Mail, Shield, User, AlertCircle, CheckCircle } from 'lucide-react';

const LoginPage = ({ setAuthStatus }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('http://localhost:4000/api/auth/login',
        { email, password },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // ✅ Extract correct role and token from backend response
      const { token, admin } = response.data;

      if (!token || !admin) {
        throw new Error('Invalid server response');
      }

      // ✅ Save authentication data
      localStorage.setItem('token', token);
      localStorage.setItem('userRole', admin.role); // Correct role from DB
      localStorage.setItem('userEmail', admin.email);
      localStorage.setItem('userName', admin.name || 'Admin');

      console.log('✅ Login successful:', admin);

      setSuccess('Login successful! Redirecting to dashboard...');
      setAuthStatus(true);

      // Redirect after success
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err) {
      console.error('Login Error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-inter">
      <div className="w-full max-w-md">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700 rounded-xl mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-800 mb-2">Admin Portal</h1>
          <p className="text-gray-600 font-medium">Sign in to your admin account</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
                <span className="text-sm text-red-700 font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700 font-medium">{success}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-600" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-medium transition-colors"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-600" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-medium transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-600 hover:text-gray-800 transition-colors" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-600 hover:text-gray-800 transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-gray-700 focus:ring-gray-500 border-gray-300 rounded transition-colors"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  className="font-semibold text-gray-700 hover:text-gray-800 focus:outline-none focus:underline transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Login Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gray-700 hover:bg-gray-800 active:bg-gray-900'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Sign in to Admin Portal
                  </div>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-600">
                Need help accessing your account?{' '}
                <button className="font-semibold text-gray-700 hover:text-gray-800 focus:outline-none focus:underline transition-colors">
                  Contact Support
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            © 2024 Admin Portal. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
