import React, { useState } from "react";
import axios from "axios";

function LoginModal({ setToken, onClose }) {
  const [step, setStep] = useState(1); // 1: Enter ID, 2: Enter OTP
  const [id, setId] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const trimmedId = id.trim();
      await axios.post('http://jemapps.in/api/auth/send-otp', {
        code: trimmedId,  // Send JE Plus ID
      });
      
      setStep(2); // Move to OTP verification step
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const trimmedId = id.trim();
      const trimmedOtp = otp.trim();
      
      const response = await axios.post('http://jemapps.in/api/auth/verify-otp', {
        code: trimmedId,    // Send JE Plus ID
        otp: trimmedOtp,
      });
      
      localStorage.setItem("token", response.data.token);
      setToken(response.data.token);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            {step === 1 ? "Login" : "Verify OTP"}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="id" className="block text-sm font-medium text-gray-700 mb-1">
                JE Plus ID
              </label>
              <input
                id="id"
                type="text"
                placeholder="Enter your JE Plus ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 disabled:opacity-50"
            >
              {loading ? "Sending OTP..." : "Send OTP via WhatsApp"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                We've sent an OTP to your WhatsApp. Please check and enter it below.
              </p>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                OTP
              </label>
              <input
                id="otp"
                type="text"
                placeholder="Enter OTP"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Back to ID entry
              </button>
            </div>
          </form>
        )}
        
        <div className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <button className="text-blue-600 hover:text-blue-800 font-medium">
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;