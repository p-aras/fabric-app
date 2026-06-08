import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import FabricSplashScreen from './components/FabricSplashScreen';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import FabricStickerForm from './components/FabricStickerForm';
import FabricIssued from './components/FabricIssued';
import StockReports from './components/StockReports';
import DigitalizeGatta from './components/DigitalizeGatta';
import UploadCopy from './components/UploadCopy';
import CopyCuttingReport from './components/CopyCuttingReport';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  console.log('ProtectedRoute - isAuthenticated:', isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Clear any existing session when app starts
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    
    // Set timeout to ensure splash screen doesn't get stuck
    const timer = setTimeout(() => {
      if (showSplash) {
        console.log('Forcing splash to close');
        setShowSplash(false);
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  const handleSplashFinish = () => {
    console.log('Splash finished, setting showSplash to false');
    setShowSplash(false);
  };

  console.log('App rendering - showSplash:', showSplash);

  if (showSplash) {
    console.log('Showing Splash Screen');
    return (
      <FabricSplashScreen
        duration={2500}
        minDisplayTime={800}
        onFinish={handleSplashFinish}
      />
    );
  }

  console.log('Showing Router with Login');
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/create-sticker" element={
          <ProtectedRoute>
            <FabricStickerForm />
          </ProtectedRoute>
        } />
        <Route path="/fabric-issue" element={
          <ProtectedRoute>
            <FabricIssued />
          </ProtectedRoute>
        } />
        <Route path="/stock-reports" element={
          <ProtectedRoute>
            <StockReports />
          </ProtectedRoute>
        } />
        <Route path="/digitalize-gatta" element={<DigitalizeGatta />} />
        <Route path="/upload-copy" element={<UploadCopy />} />
         <Route path="/copy-cutting-report" element={<CopyCuttingReport />} />
      </Routes>
    </Router>
  );
}

export default App;