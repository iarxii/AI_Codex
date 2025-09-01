import React from 'react';
import { Link } from 'react-router-dom';

const Landing: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-purple-200">
    <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
      <h1 className="text-4xl font-bold mb-4 text-blue-700">Welcome to HealthMedAgentix</h1>
      <p className="mb-8 text-gray-600">AI-powered chat for health, data, and more.</p>
      <div className="flex flex-col gap-4">
        <Link to="/login" className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 transition">Login</Link>
        <Link to="/register" className="border border-blue-600 text-blue-600 py-2 px-6 rounded hover:bg-blue-50 transition">Register</Link>
        <Link to="/chat" className="text-sm text-gray-500 underline mt-2">Continue as Guest</Link>
      </div>
    </div>
  </div>
);

export default Landing;
