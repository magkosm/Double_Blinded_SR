import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { HomeScreen } from './pages/HomeScreen';
import { SuperAdminScreen } from './pages/SuperAdminScreen';
import { AdminScreen } from './pages/AdminScreen';
import { ReviewerScreen } from './pages/ReviewerScreen';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/Double_Blinded_SR">
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/admin" element={<SuperAdminScreen />} />
            <Route path="/admin/:reviewSlug" element={<AdminScreen />} />
            <Route path="/r/:reviewSlug" element={<ReviewerScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
