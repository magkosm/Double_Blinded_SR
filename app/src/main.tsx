import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminScreen } from './pages/AdminScreen';
import { ReviewerScreen } from './pages/ReviewerScreen';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/Double_Blinded_SR">
      <AuthProvider>
        <Routes>
          <Route path="/" element={<ReviewerScreen />} />
          <Route path="/admin" element={<AdminScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
