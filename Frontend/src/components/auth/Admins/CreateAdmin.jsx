// import React, { useState } from 'react';
// import { User, Mail, Lock, Shield, X, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
// import Swal from 'sweetalert2';
// import withReactContent from 'sweetalert2-react-content';
// import { ADMIN_CREATE_URL } from '../../../config';

// const MySwal = withReactContent(Swal);

// // Re-using the Toast Notification Component from AdminManagement for consistency
// const Toast = ({ isVisible, message, type = 'info', onClose, duration = 3000 }) => {
//   // This component's logic is handled in AdminManagement.js, but included here for completeness
//   // In a real application, this would likely be a shared component.
//   if (!isVisible) return null;

//   const getToastStyles = () => {
//     switch (type) {
//       case 'success':
//         return 'bg-green-50 border-green-200 text-green-800';
//       case 'error':
//         return 'bg-red-50 border-red-200 text-red-800';
//       case 'warning':
//         return 'bg-yellow-50 border-yellow-200 text-yellow-800';
//       default:
//         return 'bg-blue-50 border-blue-200 text-blue-800';
//     }
//   };

//   const getIcon = () => {
//     switch (type) {
//       case 'success':
//         return <CheckCircle className="w-5 h-5 text-green-500" />;
//       case 'error':
//         return <AlertCircle className="w-5 h-5 text-red-500" />;
//       case 'warning':
//         return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
//       default:
//         return <AlertCircle className="w-5 h-5 text-blue-500" />;
//     }
//   };

//   return (
//     <div className="fixed top-4 right-4 z-50 transform transition-all duration-300 ease-in-out">
//       <div className={`flex items-center p-4 rounded-lg border shadow-lg ${getToastStyles()} max-w-sm`}>
//         <div className="flex-shrink-0 mr-3">
//           {getIcon()}
//         </div>
//         <div className="flex-1 text-sm font-medium">
//           {message}
//         </div>
//         <button
//           onClick={onClose}
//           className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
//         >
//           <X className="w-4 h-4" />
//         </button>
//       </div>
//     </div>
//   );
// };

// const CreateAdmin = ({ onAdminCreated, onCancel }) => {
//   const [username, setUsername] = useState('');
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [role, setRole] = useState('admin'); // Default role
//   const [loading, setLoading] = useState(false);

//   const [toast, setToast] = useState({
//     isVisible: false,
//     message: '',
//     type: 'info'
//   });

//   const showToast = (message, type = 'info', duration = 3000) => {
//     setToast({
//       isVisible: true,
//       message,
//       type
//     });
//     setTimeout(() => {
//       setToast(prev => ({ ...prev, isVisible: false }));
//     }, duration);
//   };

//   const closeToast = () => {
//     setToast(prev => ({ ...prev, isVisible: false }));
//   };

//   const getAuthToken = () => {
//     return localStorage.getItem('token') || sessionStorage.getItem('token');
//   };

//   const apiCall = async (endpoint, options = {}) => {
//     const token = getAuthToken();
    
//     const defaultHeaders = {
//       'Content-Type': 'application/json',
//       ...(token && { Authorization: `Bearer ${token}` })
//     };

//     const config = {
//       ...options,
//       headers: {
//         ...defaultHeaders,
//         ...options.headers
//       }
//     };

//     try {
//       const response = await fetch(endpoint, config);
      
//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
//       }
      
//       return await response.json();
//     } catch (error) {
//       console.error('API call error:', error);
//       throw error;
//     }
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       await apiCall(ADMIN_CREATE_URL, {
//         method: 'POST',
//         body: JSON.stringify({ username, email, password, role })
//       });
//       showToast('Admin created successfully!', 'success');
//       onAdminCreated(); // Callback to refresh admin list and go back to table
//     } catch (error) {
//       console.error('Create admin error:', error);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error',
//         text: `Failed to create admin: ${error.message}`,
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="p-6 bg-white rounded-xl shadow-lg">
//       <Toast
//         isVisible={toast.isVisible}
//         message={toast.message}
//         type={toast.type}
//         onClose={closeToast}
//       />
//       <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
//         <h2 className="text-3xl font-semibold text-gray-800 flex items-center">
//           <Shield className="mr-3" />
//           Create New Admin
//         </h2>
//         <button
//           onClick={onCancel}
//           className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
//         >
//           Back to Admin List
//         </button>
//       </div>

//       <form onSubmit={handleSubmit} className="space-y-6">
//         <div>
//           <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
//           <div className="mt-1 relative rounded-md shadow-sm">
//             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//               <User className="h-5 w-5 text-gray-400" aria-hidden="true" />
//             </div>
//             <input
//               type="text"
//               name="username"
//               id="username"
//               className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
//               placeholder="Enter username"
//               value={username}
//               onChange={(e) => setUsername(e.target.value)}
//               required
//             />
//           </div>
//         </div>

//         <div>
//           <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
//           <div className="mt-1 relative rounded-md shadow-sm">
//             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//               <Mail className="h-5 w-5 text-gray-400" aria-hidden="true" />
//             </div>
//             <input
//               type="email"
//               name="email"
//               id="email"
//               className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
//               placeholder="Enter email address"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               required
//             />
//           </div>
//         </div>

//         <div>
//           <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
//           <div className="mt-1 relative rounded-md shadow-sm">
//             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//               <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
//             </div>
//             <input
//               type="password"
//               name="password"
//               id="password"
//               className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
//               placeholder="Enter password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//             />
//           </div>
//         </div>

//         <div>
//           <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
//           <div className="mt-1 relative rounded-md shadow-sm">
//             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//               <Shield className="h-5 w-5 text-gray-400" aria-hidden="true" />
//             </div>
//             <select
//               name="role"
//               id="role"
//               className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
//               value={role}
//               onChange={(e) => setRole(e.target.value)}
//               required
//             >
//               <option value="admin">Admin</option>
//               <option value="super_admin">Super Admin</option>
//             </select>
//           </div>
//         </div>

//         <div className="flex justify-end space-x-3">
//           <button
//             type="button"
//             onClick={onCancel}
//             className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
//           >
//             Cancel
//           </button>
//           <button
//             type="submit"
//             disabled={loading}
//             className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
//           >
//             {loading ? 'Creating...' : 'Create Admin'}
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// };

// export default CreateAdmin;


import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Shield, X, CheckCircle, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { ADMIN_CREATE_URL } from '../../../config';

const MySwal = withReactContent(Swal);

const Toast = ({ isVisible, message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 transform transition-all duration-300 ease-in-out">
      <div className={`flex items-center p-4 rounded-lg border shadow-lg ${getToastStyles()} max-w-sm`}>
        <div className="flex-shrink-0 mr-3">
          {getIcon()}
        </div>
        <div className="flex-1 text-sm font-medium">
          {message}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const CreateAdmin = ({ onAdminCreated, onCancel }) => {
  const [username, setUsername] = useState(''); // Keep as username state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user-admin');
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'info'
  });

  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({
      isVisible: true,
      message,
      type
    });
    setTimeout(() => {
      setToast(prev => ({ ...prev, isVisible: false }));
    }, duration);
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const getAuthToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  };

  const apiCall = async (endpoint, options = {}) => {
    const token = getAuthToken();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      const response = await fetch(endpoint, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim() || !email.trim() || !password.trim()) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    setLoading(true);

    try {
      const postData = { name: username, email, password, role_name: role }; // Send 'name' as username, 'role_name' as role
      console.log('Sending data to API:', postData); // Log the data being sent
      const response = await apiCall(ADMIN_CREATE_URL, {
        method: 'POST',
        body: JSON.stringify(postData)
      });
      
      console.log('Admin created successfully:', response);
      MySwal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Admin created successfully!',
        confirmButtonColor: '#3085d6',
      }).then(() => {
        onAdminCreated(); // Redirect to admin management
      });
      handleReset(); // Reset form fields after successful creation
    } catch (error) {
      console.error('Create admin error:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to create admin: ${error.message}`,
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('user-admin'); // Reset to default role
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />
      
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <h2 className="text-3xl font-semibold text-gray-800 flex items-center">
          <Shield className="mr-3" />
          Create New Admin
        </h2>
        <button
          onClick={onCancel}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="name" // Changed name attribute to 'name'
              id="name" // Changed id attribute to 'name'
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Enter name"
              value={username} // Still using username state
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="email"
              name="email"
              id="email"
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="password"
              name="password"
              id="password"
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Password must be at least 6 characters long</p>
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Role <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Shield className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <select
              name="role"
              id="role"
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="user-admin">User Admin</option>
              <option value="support-admin">Support Admin</option>
              <option value="account-admin">Account Admin</option>
            </select>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Super Admin has full control including creating and managing other admins
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Create Admin
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateAdmin;