# Microsoft Graph API Integration Setup

This guide will walk you through setting up Microsoft Graph API integration for OneDrive file uploads and Excel data synchronization.

## Prerequisites

- Microsoft 365 account (personal or business)
- Azure account (free tier is sufficient)
- Basic understanding of OAuth 2.0 flow

## Step 1: Create Azure App Registration

1. **Go to Azure Portal**
   - Visit [Azure Portal](https://portal.azure.com)
   - Sign in with your Microsoft account

2. **Navigate to App Registrations**
   - Search for "App registrations" in the top search bar
   - Click on "App registrations" service

3. **Create New Registration**
   - Click "New registration"
   - Fill in the details:
     - **Name**: `Invoice Manager App` (or your preferred name)
     - **Supported account types**: 
       - Choose "Accounts in any organizational directory and personal Microsoft accounts" for maximum compatibility
     - **Redirect URI**: 
       - Platform: `Web`
       - URI: `http://localhost:5173/auth/callback` (for development)
       - For production: `https://invoice-scanner-and-8sv8.bolt.host/auth/callback`

4. **Note Important Values**
   - After creation, copy these values:
     - **Application (client) ID**
     - **Directory (tenant) ID**

## Step 2: Configure API Permissions

1. **Go to API Permissions**
   - In your app registration, click "API permissions"

2. **Add Required Permissions**
   - Click "Add a permission"
   - Select "Microsoft Graph"
   - Choose "Delegated permissions"
   - Add these permissions:
     - `Files.ReadWrite` - Upload and manage files in OneDrive
     - `Files.ReadWrite.All` - Access all files (if needed for shared scenarios)
     - `Sites.ReadWrite.All` - Access Excel files in SharePoint/OneDrive

3. **Grant Admin Consent**
   - Click "Grant admin consent for [Your Organization]"
   - Confirm the consent

## Step 3: Configure Authentication

1. **Add Redirect URIs**
   - Go to "Authentication" in your app registration
   - Under "Web" platform, ensure you have:
     - Development: `http://localhost:5173/auth/callback`
     - Production: `https://yourdomain.com/auth/callback`

2. **Configure Token Settings**
   - Check "Access tokens" and "ID tokens" under "Implicit grant and hybrid flows"
   - Set "Supported account types" as needed

## Step 4: Update Your Application Code

1. **Configure the Microsoft Service**

```typescript
// In your main App component or initialization file
import { MicrosoftService } from './services/microsoftService';

// Configure with your Azure app details
MicrosoftService.configure({
  clientId: 'YOUR_CLIENT_ID_HERE',
  tenantId: 'YOUR_TENANT_ID_HERE', // or 'common' for multi-tenant
  redirectUri: 'http://localhost:5173/auth/callback', // Update for production
  scopes: [
    'https://graph.microsoft.com/Files.ReadWrite',
    'https://graph.microsoft.com/Sites.ReadWrite.All'
  ]
});
```

2. **Handle Authentication Callback**

Create a callback route to handle the OAuth response:

```typescript
// Create src/components/AuthCallback.tsx
import React, { useEffect } from 'react';
import { MicrosoftService } from '../services/microsoftService';

export function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        console.error('Authentication error:', error);
        // Handle error - redirect to login or show error message
        window.location.href = '/';
        return;
      }

      if (code) {
        try {
          await MicrosoftService.handleCallback(code);
          // Success - redirect to main app
          window.location.href = '/';
        } catch (error) {
          console.error('Token exchange failed:', error);
          // Handle error
          window.location.href = '/';
        }
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
```

3. **Add Authentication Button**

```typescript
// Add to your main component or settings page
import { MicrosoftService } from '../services/microsoftService';

function AuthenticationButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(MicrosoftService.isAuthenticated());
  }, []);

  const handleLogin = () => {
    MicrosoftService.initiateLogin();
  };

  const handleLogout = () => {
    MicrosoftService.logout();
    setIsAuthenticated(false);
  };

  return (
    <div className="p-4">
      {isAuthenticated ? (
        <div className="flex items-center gap-4">
          <span className="text-green-600">✓ Connected to Microsoft</span>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button 
          onClick={handleLogin}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Connect to Microsoft OneDrive
        </button>
      )}
    </div>
  );
}
```

## Step 5: Update Invoice Service

Replace the simulated upload with the real implementation:

```typescript
// In src/services/invoiceService.ts
static async uploadToOneDrive(invoice: Invoice): Promise<OneDriveUploadResult> {
  try {
    const file = await IndexedDBService.getFile(invoice.file_url);
    if (!file) {
      return { success: false, error: 'Invoice file not found' };
    }

    // Use real Microsoft service instead of simulation
    const result = await MicrosoftService.uploadInvoiceToOneDrive(invoice, file);
    
    if (result.success) {
      await LocalStorageService.updateInvoiceOneDriveStatus(invoice.id, {
        onedrive_uploaded: true,
        onedrive_file_url: result.fileUrl,
        excel_synced: true,
      });
    }

    return result;
  } catch (error) {
    console.error('OneDrive upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
```

## Step 6: Environment Variables (Optional)

For better security, store your configuration in environment variables:

```typescript
// Create .env file
VITE_MS_CLIENT_ID=your_client_id_here
VITE_MS_TENANT_ID=your_tenant_id_here
VITE_MS_REDIRECT_URI=http://localhost:5173/auth/callback

// Update your configuration
MicrosoftService.configure({
  clientId: import.meta.env.VITE_MS_CLIENT_ID,
  tenantId: import.meta.env.VITE_MS_TENANT_ID,
  redirectUri: import.meta.env.VITE_MS_REDIRECT_URI,
  scopes: [
    'https://graph.microsoft.com/Files.ReadWrite',
    'https://graph.microsoft.com/Sites.ReadWrite.All'
  ]
});
```

## Step 7: Testing

1. **Test Authentication**
   - Click the "Connect to Microsoft OneDrive" button
   - Complete the Microsoft login flow
   - Verify you're redirected back to your app

2. **Test File Upload**
   - Create a test invoice with an image or PDF
   - Click the OneDrive upload button
   - Check your OneDrive for the uploaded file in the "Invoices" folder

3. **Test Excel Integration**
   - After successful upload, check for "Invoice_Tracker.xlsx" in your OneDrive
   - Verify the invoice data was added to the Excel file

## Production Deployment

1. **Update Redirect URIs**
   - Add your production domain to Azure app registration
   - Update the redirect URI in your app configuration

2. **Security Considerations**
   - Use HTTPS in production
   - Consider implementing token refresh logic
   - Store sensitive data securely (not in localStorage for production)

3. **Error Handling**
   - Implement proper error handling for network failures
   - Add retry logic for failed uploads
   - Provide user-friendly error messages

## Troubleshooting

### Common Issues

1. **"AADSTS50011: The reply URL specified in the request does not match"**
   - Ensure your redirect URI exactly matches what's configured in Azure

2. **"Insufficient privileges to complete the operation"**
   - Check that all required permissions are granted
   - Ensure admin consent was provided

3. **"Token has expired"**
   - Implement token refresh logic
   - Clear stored tokens and re-authenticate

4. **CORS Issues**
   - Microsoft Graph API supports CORS, but ensure your domain is properly configured

### Support Resources

- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/)
- [Azure App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) - Test API calls

## What Happens After Setup

Once configured, your app will:

1. **Upload Files**: Invoice images/PDFs are uploaded to OneDrive in an "Invoices" folder
2. **Create Sharing Links**: Generate shareable links for each uploaded file
3. **Excel Integration**: Automatically create and update an "Invoice_Tracker.xlsx" file with:
   - Customer Name
   - Invoice Date
   - Description/Category
   - Invoice Amount
   - OneDrive File Link
   - Date Added
4. **Status Tracking**: Visual indicators show which invoices have been uploaded and synced

The integration provides a complete workflow from invoice capture to cloud storage and Excel tracking!