import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';

const AuthChecker: React.FC = () => {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<any>({});

  const testAuth = async () => {
    try {
      const response = await api.get('/auth/me');
      setTestResults((prev: any) => ({
        ...prev,
        authMe: { success: true, data: response.data }
      }));
    } catch (error: any) {
      setTestResults((prev: any) => ({
        ...prev,
        authMe: { 
          success: false, 
          error: error.response?.data || error.message,
          status: error.response?.status
        }
      }));
    }
  };

  return (
    <div className="fixed top-4 left-4 max-w-sm w-full bg-white shadow-lg rounded-lg border p-4 z-50">
      <h3 className="font-bold text-sm mb-2">🔐 Auth Status</h3>
      
      <div className="space-y-2 text-xs">
        <div>
          <strong>User:</strong> {user?.name || 'Not logged in'}
        </div>
        <div>
          <strong>Role:</strong> {user?.role || 'None'}
        </div>
        <div>
          <strong>Auth:</strong> {user ? 'Authenticated (cookie-based)' : 'Not authenticated'}
        </div>
        
        <button 
          onClick={testAuth}
          className="w-full mt-2 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
        >
          Test Auth
        </button>
        
        {testResults.authMe && (
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
            <strong>Auth Test:</strong>
            <pre>{JSON.stringify(testResults.authMe, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthChecker;