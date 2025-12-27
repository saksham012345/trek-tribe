import React, { useState, useEffect } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

const APIDebugger: React.FC = () => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [testResults, setTestResults] = useState<any>({});

  useEffect(() => {
    checkDebugInfo();
  }, []);

  const checkDebugInfo = async () => {
    try {
      // Tokens are now in httpOnly cookies, not accessible via JavaScript
      setDebugInfo({
        hasToken: !!user, // Check user instead of token
        tokenLength: 0, // Cannot access httpOnly cookie
        tokenPreview: user ? 'Token in httpOnly cookie (secure)' : 'No authentication',
        user: user,
        apiBaseUrl: process.env.REACT_APP_API_URL,
        currentTime: new Date().toISOString()
      });

      // Test auth endpoint
      try {
        const authTest = await api.get('/auth/me');
        setTestResults((prev: any) => ({
          ...prev,
          authTest: { success: true, data: authTest.data }
        }));
      } catch (error: any) {
        setTestResults((prev: any) => ({
          ...prev,
          authTest: { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status
          }
        }));
      }

      // Test trips endpoint
      try {
        const tripsTest = await api.get('/trips?limit=1');
        setTestResults((prev: any) => ({
          ...prev,
          tripsTest: { success: true, dataLength: Array.isArray(tripsTest.data) ? tripsTest.data.length : 'not array' }
        }));
      } catch (error: any) {
        setTestResults((prev: any) => ({
          ...prev,
          tripsTest: { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status
          }
        }));
      }

    } catch (error: any) {
      console.error('Debug info error:', error);
    }
  };

  const testTripCreation = async () => {
    const testTripData = {
      title: "Test Trip - Debug",
      description: "This is a test trip for debugging",
      destination: "Test Destination",
      price: 1000,
      capacity: 5,
      categories: ["Adventure"],
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
    };

    try {
      const response = await api.post('/trips', testTripData);
      setTestResults((prev: any) => ({
        ...prev,
        tripCreationTest: { success: true, data: response.data }
      }));
    } catch (error: any) {
      setTestResults((prev: any) => ({
        ...prev,
        tripCreationTest: { 
          success: false, 
          error: error.response?.data || error.message,
          status: error.response?.status,
          sentData: testTripData
        }
      }));
    }
  };

  const testBookingCreation = async () => {
    const testBookingData = {
      tripId: "test-trip-id", // This will fail, but we'll see the validation errors
      numberOfTravelers: 1,
      contactPhone: "+1234567890",
      travelerDetails: [{
        name: "Test User",
        age: 30,
        phone: "+1234567890"
      }]
    };

    try {
      const response = await api.post('/bookings', testBookingData);
      setTestResults((prev: any) => ({
        ...prev,
        bookingCreationTest: { success: true, data: response.data }
      }));
    } catch (error: any) {
      setTestResults((prev: any) => ({
        ...prev,
        bookingCreationTest: { 
          success: false, 
          error: error.response?.data || error.message,
          status: error.response?.status,
          sentData: testBookingData
        }
      }));
    }
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-md w-full bg-white shadow-2xl rounded-lg border p-4 z-50 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-gray-800">🔧 API Debugger</h3>
        <button 
          onClick={() => document.getElementById('api-debugger')?.remove()}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-3 text-xs">
        <div className="bg-gray-50 p-2 rounded">
          <h4 className="font-semibold mb-1">🔍 Debug Info</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        <div className="bg-blue-50 p-2 rounded">
          <h4 className="font-semibold mb-1">🧪 Test Results</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={checkDebugInfo}
            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
          >
            Refresh
          </button>
          <button 
            onClick={testTripCreation}
            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
          >
            Test Trip Creation
          </button>
          <button 
            onClick={testBookingCreation}
            className="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600"
          >
            Test Booking
          </button>
        </div>
      </div>
    </div>
  );
};

export default APIDebugger;