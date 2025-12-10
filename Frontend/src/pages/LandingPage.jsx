
import React from 'react';
import { Link } from 'react-router-dom'; // Import Link
import { Scale, Users, TrendingUp, Shield, FileText, BarChart3 } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Navbar */}
      <nav className="bg-gray-800 p-4 shadow-lg border-b border-gray-700">
        <div className="container mx-auto flex justify-between items-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-white text-2xl font-semibold">Nexintel Admin Portal</h1>
          <ul className="flex space-x-6">
            {/* These links can be updated to use Link component if they lead to internal routes */}
            <li><a href="#" className="text-gray-200 hover:text-white font-medium transition-colors">Dashboard</a></li>
            <li><a href="#" className="text-gray-200 hover:text-white font-medium transition-colors">Cases</a></li>
            <li><a href="#" className="text-gray-200 hover:text-white font-medium transition-colors">Clients</a></li>
            <li><a href="#" className="text-gray-200 hover:text-white font-medium transition-colors">Settings</a></li>
            <li>
              <Link to="/login" className="bg-gray-700 hover:bg-gray-800 text-white font-semibold py-3 px-8 rounded-lg text-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl inline-flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Login
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="bg-white py-16 shadow-sm border-b border-gray-200">
        <div className="container mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-700 rounded-xl mb-6 shadow-lg">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-semibold text-gray-800 mb-4">Welcome to the Admin Dashboard</h2>
          <p className="text-lg text-gray-600 mb-8 font-medium max-w-2xl mx-auto">
            Manage your legal operations efficiently and securely with our comprehensive admin portal.
          </p>
          <Link to="/login" className="bg-gray-700 hover:bg-gray-800 text-white font-semibold py-3 px-8 rounded-lg text-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl inline-flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Admin Login
          </Link>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <h3 className="text-3xl font-semibold text-center text-gray-800 mb-12">Key Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature Card 1 */}
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
              <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-6 mx-auto">
                <Scale className="w-8 h-8 text-gray-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3 text-center">Case Management</h4>
              <p className="text-gray-600 text-center font-medium leading-relaxed">
                Streamline your case workflows from intake to resolution with our comprehensive management system.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
              <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-6 mx-auto">
                <Users className="w-8 h-8 text-gray-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3 text-center">Client Relations</h4>
              <p className="text-gray-600 text-center font-medium leading-relaxed">
                Maintain detailed client profiles and comprehensive communication logs for better relationship management.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
              <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-6 mx-auto">
                <TrendingUp className="w-8 h-8 text-gray-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3 text-center">Performance Analytics</h4>
              <p className="text-gray-600 text-center font-medium leading-relaxed">
                Gain valuable insights into your firm's performance with comprehensive reports and analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-semibold text-gray-800 mb-4">Why Choose Our Platform</h3>
            <p className="text-gray-600 font-medium max-w-2xl mx-auto">
              Built for modern legal professionals who demand efficiency, security, and comprehensive functionality.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-gray-600" />
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Secure & Compliant</h4>
                <p className="text-gray-600 font-medium">
                  Enterprise-grade security with full compliance to legal industry standards and regulations.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-gray-600" />
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Real-time Reporting</h4>
                <p className="text-gray-600 font-medium">
                  Access detailed reports and analytics in real-time to make informed business decisions.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-gray-600" />
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Document Management</h4>
                <p className="text-gray-600 font-medium">
                  Organize, store, and manage all your legal documents in one centralized, secure location.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-gray-600" />
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Team Collaboration</h4>
                <p className="text-gray-600 font-medium">
                  Enable seamless collaboration across your team with integrated communication tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-800">
        <div className="container mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-semibold text-white mb-4">Ready to Get Started?</h3>
          <p className="text-gray-300 font-medium mb-8 max-w-2xl mx-auto">
            Join thousands of legal professionals who trust our platform for their administrative needs.
          </p>
          <Link to="/login" className="bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-8 rounded-lg text-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl inline-flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Access Admin Portal
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 border-t border-gray-800">
        <div className="container mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-gray-500 mr-2" />
            <span className="text-lg font-semibold text-gray-400">Nexintel</span>
          </div>
          <p className="text-sm font-medium">&copy; 2024 Nexintel. All rights reserved.</p>
          <p className="text-xs text-gray-500 mt-2">
            Secure • Professional • Compliant
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;