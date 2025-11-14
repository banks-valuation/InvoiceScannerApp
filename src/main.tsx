import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MicrosoftService } from "./services/microsoftService";
import { AuthProvider } from "./components/AuthProvider";
import { AuthCallback } from "./components/AuthCallback";
import App from "./App.tsx";
import "./index.css";

// Configure Microsoft Graph API immediately when app loads
// Replace with your actual Azure app credentials
MicrosoftService.configure({
  clientId: import.meta.env.VITE_AZURE_APP_CLIENT_ID, // Loaded from environment variables
  tenantId: import.meta.env.VITE_AZURE_APP_TENANT_ID, // Loaded from environment variables
  redirectUri: `${window.location.protocol}//${window.location.host}/auth/callback`,
  scopes: [
    "https://graph.microsoft.com/Files.ReadWrite",
    "https://graph.microsoft.com/Files.ReadWrite.All",
    "https://graph.microsoft.com/Sites.ReadWrite.All",
  ],
});

// Console log the redirect URI for debugging
console.log(
  "Microsoft redirect URI:",
  `${window.location.protocol}//${window.location.host}/auth/callback`,
);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
