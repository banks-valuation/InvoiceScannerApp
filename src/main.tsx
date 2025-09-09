import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MicrosoftService } from './services/microsoftService';
import { AuthCallback } from './components/AuthCallback';
import App from './App.tsx';
import './index.css';

// Configure Microsoft Graph API immediately when app loads
// Replace with your actual Azure app credentials
MicrosoftService.configure({
  clientId: '9117a1ac-c6b7-4222-8e11-290d5cca0bcc', // Replace with your Azure app Client ID
  tenantId: '4057aa25-ad69-450c-a984-349410211e98', // Replace with your Azure app Tenant ID
  redirectUri: window.location.origin + '/auth/callback',
  scopes: [
    'https://graph.microsoft.com/Files.ReadWrite',
    'https://graph.microsoft.com/Sites.ReadWrite.All'
  ]
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
