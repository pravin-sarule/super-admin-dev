import React from 'react';

const ContentManagement = () => {
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Content Management</h1>
      <p className="text-gray-600">This is the Content Management section. Only accessible by Super Admin and User Admin roles.</p>
    </div>
  );
};

export default ContentManagement;