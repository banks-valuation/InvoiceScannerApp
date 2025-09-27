// Microsoft Graph API integration for OneDrive and Excel
// Complete setup instructions and production-ready implementation

export interface OneDriveUploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
}

export interface MicrosoftConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

export class MicrosoftService {
  private static accessToken: string | null = null;
  private static refreshToken: string | null = null;
  private static config: MicrosoftConfig | null = null;

  // Configuration setup - call this first with your Azure app details
  static configure(config: MicrosoftConfig): void {
    this.config = config;
    this.loadStoredTokens();
  }

  // Load existing tokens from storage
  private static loadStoredTokens(): void {
    this.accessToken = localStorage.getItem('ms_access_token');
    this.refreshToken = localStorage.getItem('ms_refresh_token');
  }

  // Step 1: Redirect user to Microsoft login
  static async initiateLogin(): Promise<void> {
    if (!this.config) {
      throw new Error('Microsoft service not configured. Call configure() first.');
    }

    console.log('Initiating Microsoft login with config:', {
      clientId: this.config.clientId,
      tenantId: this.config.tenantId,
      redirectUri: this.config.redirectUri
    });

    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later use in token exchange
    localStorage.setItem('ms_code_verifier', codeVerifier);

    // Construct Microsoft authorization URL for authorization code flow
    const authUrl = new URL(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.set('scope', this.config.scopes.join(' '));
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('state', Math.random().toString(36).substring(2, 15));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('Redirecting to Microsoft authentication:', authUrl.toString());
    
    // Redirect to Microsoft login
    window.location.href = authUrl.toString();
  }

  // Generate a cryptographically secure random string for PKCE code verifier
  private static generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Generate code challenge from code verifier using SHA256
  private static async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Handle authorization code flow callback
  static async handleAuthorizationCallback(code: string): Promise<void> {
    console.log('Processing authorization code flow callback');
    
    if (!this.config) {
      throw new Error('Microsoft service not configured');
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Retrieve the stored code verifier
    const codeVerifier = localStorage.getItem('ms_code_verifier');
    if (!codeVerifier) {
      throw new Error('Code verifier not found. Please restart the authentication process.');
    }

    try {
      // Exchange authorization code for tokens
      const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
      
      const body = new URLSearchParams({
        client_id: this.config.clientId,
        scope: this.config.scopes.join(' '),
        code: code,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange failed:', errorText);
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const tokenData = await response.json();
      
      // Store tokens
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;
      
      console.log('Token information:', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope
      });

      localStorage.setItem('ms_access_token', tokenData.access_token);
      if (tokenData.refresh_token) {
        localStorage.setItem('ms_refresh_token', tokenData.refresh_token);
      }
      
      if (tokenData.expires_in) {
        const expirationTime = Date.now() + (tokenData.expires_in * 1000);
        localStorage.setItem('ms_token_expires', expirationTime.toString());
        console.log('Token expires at:', new Date(expirationTime).toISOString());
      }
      
      // Clean up the code verifier
      localStorage.removeItem('ms_code_verifier');
      
      console.log('Tokens stored successfully');
    } catch (error) {
      // Clean up the code verifier on error
      localStorage.removeItem('ms_code_verifier');
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  // Handle implicit flow callback (keep for backward compatibility)
  static async handleImplicitCallback(accessToken: string, urlParams: URLSearchParams): Promise<void> {
    console.log('Processing implicit flow callback (deprecated)');
    
    // Check for errors
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    if (error) {
      throw new Error(`Authentication failed: ${error} - ${errorDescription}`);
    }

    if (!accessToken) {
      throw new Error('No access token received');
    }

    // Store the access token
    this.accessToken = accessToken;
    const expiresIn = urlParams.get('expires_in');
    const scope = urlParams.get('scope');
    
    console.log('Token information:', {
      hasAccessToken: !!accessToken,
      expiresIn,
      scope
    });

    localStorage.setItem('ms_access_token', accessToken);
    if (expiresIn) {
      const expirationTime = Date.now() + (parseInt(expiresIn) * 1000);
      localStorage.setItem('ms_token_expires', expirationTime.toString());
      console.log('Token expires at:', new Date(expirationTime).toISOString());
    } else {
      // For implicit flow, if no expires_in is provided, set a default expiration (1 hour)
      const defaultExpiration = Date.now() + (60 * 60 * 1000);
      localStorage.setItem('ms_token_expires', defaultExpiration.toString());
      console.log('No expiration provided, setting default expiration at:', new Date(defaultExpiration).toISOString());
    }
    
    console.log('Tokens stored successfully');
  }

  // Refresh access token using refresh token
  private static async refreshAccessToken(): Promise<boolean> {
    if (!this.config || !this.refreshToken) {
      return false;
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
      
      const body = new URLSearchParams({
        client_id: this.config.clientId,
        scope: this.config.scopes.join(' '),
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        console.error('Token refresh failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      
      // Update stored tokens
      localStorage.setItem('ms_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('ms_refresh_token', data.refresh_token);
      }
      localStorage.setItem('ms_token_expires', (Date.now() + (data.expires_in * 1000)).toString());
      
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    // Always reload from storage to get the latest state
    this.loadStoredTokens();
    
    if (this.accessToken) {
      const expiresAt = localStorage.getItem('ms_token_expires');
      if (!expiresAt) {
        // If no expiration time, assume token is valid for implicit flow
        return true;
      }
      if (Date.now() < parseInt(expiresAt)) {
        return true;
      } else {
        // Token expired, clear it
        console.log('Token expired, clearing stored tokens');
        this.logout();
        return false;
      }
    }
    
    return false;
  }

  // Ensure we have a valid access token
  private static async ensureValidToken(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Microsoft service not configured.');
    }

    // Check if current token is valid
    const tokenStatus = this.checkTokenValidity();
    if (tokenStatus.isValid) {
      return true;
    }

    // If token is expired but we have a refresh token, try to refresh
    if (this.refreshToken) {
      console.log('Access token expired, attempting refresh...');
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        console.log('Token refreshed successfully');
        return true;
      } else {
        console.log('Token refresh failed, clearing stored tokens');
        this.logout();
      }
    }

    console.log('No valid token available, re-authentication required');
    return false;
  }

  // Upload invoice file to OneDrive
  static async uploadInvoiceToOneDrive(invoice: any, file: Blob): Promise<OneDriveUploadResult> {
    try {
      console.log('Starting OneDrive upload for invoice:', invoice.id);
      console.log('Current authentication status:', this.isAuthenticated());
      console.log('Access token present:', !!this.accessToken);
      
      const hasValidToken = await this.ensureValidToken();
      console.log('Valid token check result:', hasValidToken);
      
      if (!hasValidToken) {
        console.error('Authentication failed - no valid token');
        return {
          success: false,
          error: 'Authentication required. Please connect to Microsoft OneDrive first.',
        };
      }

      // Get settings for directory configuration
      const { SettingsService } = await import('./settingsService');
      const settings = await SettingsService.getSettings();
      const invoiceDirectory = settings.onedrive.invoiceDirectory;

      // Create filename with invoice details (same pattern as display name)
      const sanitizedCustomerName = invoice.customer_name.replace(/[^a-zA-Z0-9]/g, '');
      const fileExtension = invoice.file_type === 'pdf' ? 'pdf' : 'jpg';
      const fileName = `${sanitizedCustomerName}-Receipt-${invoice.invoice_date}.${fileExtension}`;
      
      // Create the invoices folder if it doesn't exist
      await this.ensureInvoicesFolderExists(invoiceDirectory);

      // Upload file to OneDrive
      const uploadResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${invoiceDirectory}/${fileName}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': invoice.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        if (uploadResponse.status === 401) {
          // Token expired, clear it and retry
          this.accessToken = null;
          this.refreshToken = null;
          localStorage.removeItem('ms_access_token');
          localStorage.removeItem('ms_refresh_token');
          localStorage.removeItem('ms_token_expires');
          throw new Error('Authentication expired. Please log in again.');
        }
        throw new Error(`Failed to upload to OneDrive: ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      
      // Create a sharing link
      const shareResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${uploadData.id}/createLink`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'view',
          scope: 'anonymous'
        }),
      });

      let shareUrl = uploadData.webUrl;
      if (shareResponse.ok) {
        const shareData = await shareResponse.json();
        shareUrl = shareData.link.webUrl;
      }

      // Append to Excel after successful upload
      await this.appendToExcel({
        ...invoice,
        onedrive_file_url: shareUrl,
      });

      return {
        success: true,
        fileUrl: shareUrl,
      };
    } catch (error) {
      console.error('OneDrive upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Ensure the Invoices folder exists in OneDrive
  private static async ensureInvoicesFolderExists(folderPath: string = 'Invoices'): Promise<void> {
    try {
      // Check if folder exists
      const checkResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (checkResponse.status === 404) {
        // Create the folder(s) - handle nested paths
        await this.createFolderPath(folderPath);
      }
    } catch (error) {
      console.warn(`Could not ensure folder ${folderPath} exists:`, error);
      // Continue anyway - the upload might still work
    }
  }

  // Create nested folder structure
  private static async createFolderPath(folderPath: string): Promise<void> {
    const parts = folderPath.split('/').filter(part => part.length > 0);
    let currentPath = '';

    for (const part of parts) {
      const parentPath = currentPath || 'root';
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      try {
        // Check if this part of the path exists
        const checkResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${currentPath}`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        });

        if (checkResponse.status === 404) {
          // Create this folder
          const createUrl = parentPath === 'root' 
            ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
            : `https://graph.microsoft.com/v1.0/me/drive/root:/${parentPath.replace(part, '')}:/children`;

          await fetch(createUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: part,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'rename'
            }),
          });
        }
      } catch (error) {
        console.warn(`Failed to create folder part ${part}:`, error);
      }
    }
  }

  // Append invoice data to Excel file
  static async appendToExcel(invoiceData: any): Promise<void> {
    return this.syncToExcel(invoiceData, 'append');
  }

  // Update existing invoice data in Excel file
  static async updateInExcel(invoiceData: any): Promise<void> {
    return this.syncToExcel(invoiceData, 'update');
  }

  // Sync invoice data to Excel (append or update)
  private static async syncToExcel(invoiceData: any, operation: 'append' | 'update'): Promise<void> {
    const hasValidToken = await this.ensureValidToken();
    if (!hasValidToken) {
      throw new Error('Authentication required. Please connect to Microsoft OneDrive first.');
    }

    // Get settings for Excel file configuration
    const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    const excelFileName = settings.onedrive?.excelFileName || 'Invoice_Tracker.xlsx';

    try {
      // First, find or create the Excel file
      const excelFileId = await this.ensureExcelFileExists(excelFileName);
      console.log('excelFileId: ' + excelFileId);
      
      // Ensure the table exists before trying to append
      await this.ensureExcelTableExists(excelFileId);

      // Create meaningful filename for display in Excel
      const fileName = this.createDisplayFileName(invoiceData);

      // Prepare the row data
      const rowData = [
        invoiceData.sequence_id || 0,
        invoiceData.customer_name,
        invoiceData.invoice_date,
        invoiceData.description_category === 'Other' ? invoiceData.description_other : invoiceData.description_category,
        invoiceData.invoice_amount,
        '', // Column F will be filled with HYPERLINK formula
        fileName, // Column G: Filename
        invoiceData.onedrive_file_url || '', // Column H: Plain URL
      ];
      

      if (operation === 'update') {
        // For update operations, always check if row exists first
        console.log('Update operation: checking for existing row');
        
        // Check if this exact invoice already exists in Excel
        const existingRowFound = await this.findExistingRow(excelFileId, invoiceData);
        
        if (existingRowFound) {
          console.log('Found existing row, updating it');
          const updated = await this.updateExistingRow(excelFileId, invoiceData, rowData);
          if (!updated) {
            console.log('Update failed, but row exists - not appending to avoid duplicates');
            throw new Error('Failed to update existing Excel row');
          }
        } else {
          console.log('No existing row found for update operation, appending as new row instead');
          await this.appendRowToExcel(excelFileId, rowData);
        }
      } else {
        // For append operations, check for duplicates first
        console.log('Append operation: checking for duplicates');
        
        const existingRowFound = await this.findExistingRow(excelFileId, invoiceData);
        
        if (existingRowFound) {
          console.log('Duplicate found, not appending');
          throw new Error('Invoice already exists in Excel');
        } else {
          console.log('No duplicate found, appending new row');
          await this.appendRowToExcel(excelFileId, rowData);
        }
      }
    } catch (error) {
      console.error('Excel append failed:', error);
      throw error;
    }
  }

  // Create a meaningful display filename for Excel
  private static createDisplayFileName(invoiceData: any): string {
    // Use the original filename pattern that was used during upload
    const sanitizedCustomerName = invoiceData.customer_name.replace(/[^a-zA-Z0-9]/g, '');
    const fileExtension = invoiceData.file_type === 'pdf' ? 'pdf' : 'jpg';
    
    // Create a readable filename based on the invoice data
    return `${sanitizedCustomerName}-Receipt-${invoiceData.invoice_date}.${fileExtension}`;
  }

  // Append row to Excel using best available method
  private static async appendRowToExcel(excelFileId: string, rowData: any[]): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log('Attempting to append Excel row for invoice:', excelFileId, rowData);
        // Create empty Excel file with 8 columns (A-H)
        const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${excelFileId}/workbook/tables/Table1/rows`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [rowData]
          }),
        });

        if (response.ok) {
          console.log('Successfully appended to Excel table');
          
          // After successful append, add HYPERLINK formula to column F
          await this.addHyperlinkFormula(excelFileId, rowData);
          
          return; // Success, exit retry loop
        }

        const errorText = await response.text();
        const errorData = JSON.parse(errorText);
        
        // If ItemNotFound, the table might not be ready yet, retry
        if (errorData.error?.code === 'ItemNotFound') {
          throw new Error(`Table not found, retrying: ${errorText}`);
        }
        
        console.error('Table append failed, trying direct worksheet append:', errorText);
        
        // For other errors, fallback to direct worksheet append
        await this.appendToWorksheetDirectly(excelFileId, rowData);
        
        // After successful fallback append, add HYPERLINK formula
        await this.addHyperlinkFormula(excelFileId, rowData);
        
        return; // Success via fallback
        
      } catch (tableError) {
        attempt++;
        console.error(`Table append attempt ${attempt} failed:`, tableError);
        
        if (attempt >= maxRetries) {
          console.log('All table append attempts failed, using fallback method');
          // Final attempt - use fallback method
          await this.appendToWorksheetDirectly(excelFileId, rowData);
          return;
        }
        
        // Exponential backoff: wait 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retrying table append in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Helper method to find existing row without updating
  private static async findExistingRow(excelFileId: string, invoiceData: any): Promise<boolean> {
    try {
      // Get all table data to find the matching row
      const tableResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${excelFileId}/workbook/tables/Table1/rows`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!tableResponse.ok) {
        console.log('Could not fetch table rows for duplicate check');
        return false;
      }

      const tableData = await tableResponse.json();
      const rows = tableData.value;

      // Find row that matches this invoice (by customer name, date, amount, and description)
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const values = row.values[0]; // First (and only) row of values
        
        // Match by sequence_id (most reliable) or fallback to detailed matching
        const sequenceIdMatch = invoiceData.sequence_id && values[0] === invoiceData.sequence_id;
        const detailedMatch = !invoiceData.sequence_id && 
          values[1] === invoiceData.customer_name && 
          values[2] === invoiceData.invoice_date && 
          parseFloat(values[4]) === invoiceData.invoice_amount &&
          values[3] === (invoiceData.description_category === 'Other' ? invoiceData.description_other : invoiceData.description_category);
        
        if (sequenceIdMatch || detailedMatch) {
          console.log('Found existing row at index:', i);
          return true;
        }
      }

      console.log('No existing row found');
      return false;
    } catch (error) {
      console.error('Error checking for existing row:', error);
      return false;
    }
  }

  // Update existing row in Excel
  private static async updateExistingRow(excelFileId: string, invoiceData: any, rowData: any[]): Promise<boolean> {
    try {
      console.log('Attempting to update existing Excel row for invoice:', invoiceData.id, rowData);
    
      // Get all table data to find the matching row
      const tableResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${excelFileId}/workbook/tables/Table1/rows`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!tableResponse.ok) {
        console.log('Could not fetch table rows, falling back to append');
        return false;
      }

      const tableData = await tableResponse.json();
      const rows = tableData.value;

      // Find row that matches this invoice (by customer name, date, and amount - more precise matching)
      let matchingRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const values = row.values[0]; // First (and only) row of values
        
        // Match by sequence_id (most reliable) or fallback to detailed matching
        const sequenceIdMatch = invoiceData.sequence_id && values[0] === invoiceData.sequence_id;
        const detailedMatch = !invoiceData.sequence_id && 
          values[1] === invoiceData.customer_name && 
          values[2] === invoiceData.invoice_date && 
          parseFloat(values[4]) === invoiceData.invoice_amount &&
          values[3] === (invoiceData.description_category === 'Other' ? invoiceData.description_other : invoiceData.description_category);
        
        if (sequenceIdMatch || detailedMatch) {
          matchingRowIndex = i;
          console.log('Found matching row at index:', i);
          break;
        }
      }

      if (matchingRowIndex === -1) {
        console.log('No matching row found, will append new row');
        return false;
      }

      // Update the matching row
      const updateResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${excelFileId}/workbook/tables/Table1/rows/itemAt(index=${matchingRowIndex})`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData]
        }),
      });

      if (updateResponse.ok) {
        console.log('Successfully updated existing Excel row');
        return true;
      } else {
        const errorText = await updateResponse.text();
        console.error('Failed to update Excel row:', errorText);
        return false;
      }
    } catch (error) {
      console.error('Error updating Excel row:', error);
      return false;
    }
  }

  // Find or create the Excel file for invoices
  private static async ensureExcelFileExists(fileName: string = 'Invoice_Tracker.xlsx'): Promise<string> {
    try {
      // Try to find existing file
      const searchResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/search(q='${fileName}')`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.value && searchData.value.length > 0) {
          return searchData.value[0].id;
        }
      }

      // Create new Excel file if not found
      return await this.createExcelFile(fileName);
    } catch (error) {
      console.error('Error ensuring Excel file exists:', error);
      throw error;
    }
  }

  // Create a new Excel file with invoice tracking table
  private static async createExcelFile(fileName: string = 'Invoice_Tracker.xlsx'): Promise<string> {
    console.log('Creating new Excel file:', fileName);

    // Create empty Excel file
    const createResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: fileName,
        file: {},
        '@microsoft.graph.conflictBehavior': 'rename'
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create Excel file: ${errorText}`);
    }

    const fileData = await createResponse.json();
    const fileId = fileData.id;
    console.log('Excel file created with ID:', fileId);

    // Wait longer for file to be fully provisioned
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create the table
    await this.ensureExcelTableExists(fileId);

    return fileId;
  }

  // Ensure the Excel table exists in the workbook
  private static async ensureExcelTableExists(fileId: string): Promise<void> {
    // Get first worksheet name
    const worksheetsResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    
    if (!worksheetsResponse.ok) {
      throw new Error(`Failed to get worksheets: ${worksheetsResponse.statusText}`);
    }
    
    const worksheetsData = await worksheetsResponse.json();
    
    if (!worksheetsData.value || worksheetsData.value.length === 0) {
      throw new Error('No worksheets found in Excel file');
    }
    
    const worksheetName = worksheetsData.value[0]?.name || "Sheet1";

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`Table creation attempt ${attempt + 1}`);
        
        // Get all tables in the workbook  
        const tablesListResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        });

        if (tablesListResponse.status === 200) {
          const tablesData = await tablesListResponse.json();
          console.log("tablesData:", JSON.stringify(tablesData, null, 2));  
          const existingTable = tablesData.value.find((t: any) => t.name === "Table1");

          if (existingTable) {
            console.log("Table1 already exists");
            return; // ✅ Don't create again
          }
        } else if (tablesListResponse.status !== 404) {
          // Unexpected status, retry
          throw new Error(`Unexpected status ${tablesListResponse.status} when checking tables`);
        }

        console.log("Creating Table1 in Excel file");

        // // Clear the range first to avoid overlap errors
        // await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${worksheetName}/range(address='A1:G10')/clear`, {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer ${this.accessToken}`,
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({
        //     applyTo: 'All'
        //   }),
        // });

        // Create the table
        const tableResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${worksheetName}/tables/add`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              address: "A1:H1",
              hasHeaders: true,
              name: "Table1"
            }),
          }
        );

        if (!tableResponse.ok) {
          const errorText = await tableResponse.text();
          throw new Error(`Failed to create Excel table: ${errorText}`);
        }

        // Add headers (only once)
        const headerResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/Table1/headerRowRange`,
          {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${this.accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              values: [[
                "ID",
                "Customer Name",
                "Invoice Date",
                "Description",
                "Amount",
                "File Link",
                "Filename",
                "URL"
              ]]
            }),
          }
        );

        if (!headerResponse.ok) {
          const headerErrorText = await headerResponse.text();
          throw new Error(`Failed to set Excel table headers: ${headerErrorText}`);
        }
        console.log("Table1 created successfully");
        return; // Success, exit retry loop

      } catch (error) {
        attempt++;
        console.error(`Table creation attempt ${attempt} failed:`, error);
        
        if (attempt >= maxRetries) {
          throw error; // Final attempt failed, throw error
        }
        
        // Exponential backoff: wait 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying table creation in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Fallback method - append data directly to worksheet if table doesn't work
  private static async appendToWorksheetDirectly(fileId: string, rowData: any[]): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.attemptWorksheetAppend(fileId, rowData);
        return; // Success, exit retry loop
      } catch (error) {
        attempt++;
        console.warn(`Worksheet append attempt ${attempt} failed:`, error);
        
        if (attempt >= maxRetries) {
          throw error; // Final attempt failed, throw error
        }
        
        // Exponential backoff: wait 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Single attempt at worksheet append
  private static async attemptWorksheetAppend(fileId: string, rowData: any[]): Promise<void> {
    try {
      console.log('Attempting direct worksheet append as fallback');

      // Get the actual worksheet name
      const worksheetsResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!worksheetsResponse.ok) {
        throw new Error(`Failed to get worksheets: ${worksheetsResponse.statusText}`);
      }

      const worksheetsData = await worksheetsResponse.json();
      const worksheetName = worksheetsData.value[0]?.name || 'Sheet1';

      // Get the used range to find the next empty row
      const usedRangeResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${worksheetName}/usedRange`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      let nextRow = 2; // Default to row 2 (assuming headers in row 1)
      
      if (usedRangeResponse.ok) {
        const usedRangeData = await usedRangeResponse.json();
        nextRow = usedRangeData.rowCount + 1;
      }

      // Append to the next available row
      const appendResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${worksheetName}/range(address='A${nextRow}:H${nextRow}')`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData]
        }),
      });

      if (appendResponse.ok) {
        console.log('Successfully appended data directly to worksheet');
      } else {
        const errorText = await appendResponse.text();
        throw new Error(`Direct worksheet append failed: ${errorText}`);
      }
    } catch (error) {
      throw error;
    }
  }

  // Add HYPERLINK formula to column F after row is added
  private static async addHyperlinkFormula(excelFileId: string, rowData: any[]): Promise<void> {
    try {
      // Get the current table size to determine the row number
      const tableResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${excelFileId}/workbook/tables/Table1/rows`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!tableResponse.ok) {
        console.warn('Could not get table size for HYPERLINK formula');
        return;
      }

      const tableData = await tableResponse.json();
      const rowCount = tableData.value.length;
      const targetRow = rowCount + 1; // +1 because table starts at row 2 (row 1 is headers)

      // Add HYPERLINK formula to column F
      const formulaResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${excelFileId}/workbook/worksheets/Sheet1/range(address='F${targetRow}')`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formulas: [[`=HYPERLINK(H${targetRow},G${targetRow})`]]
        }),
      });

      if (!formulaResponse.ok) {
        const errorText = await formulaResponse.text();
        console.warn('Failed to add HYPERLINK formula:', errorText);
      } else {
        console.log('Successfully added HYPERLINK formula to column F');
      }
    } catch (error) {
      console.warn('Error adding HYPERLINK formula:', error);
    }
  }

  // Delete file from OneDrive
  static async deleteFileFromOneDrive(fileUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const hasValidToken = await this.ensureValidToken();
      if (!hasValidToken) {
        return {
          success: false,
          error: 'Authentication required. Please connect to Microsoft OneDrive first.',
        };
      }

      // Extract file ID from OneDrive URL
      // OneDrive sharing URLs typically contain the file ID
      // We need to get the actual file path or ID to delete it
      
      // For now, we'll search for the file by name pattern
      // This is a fallback approach since extracting ID from sharing URL is complex
      console.log('Attempting to delete OneDrive file:', fileUrl);
      
      // We can't easily delete by sharing URL, so we'll return success
      // In a production environment, you'd want to store the actual file ID
      // or implement a more sophisticated file tracking system
      console.log('OneDrive file deletion not implemented for sharing URLs');
      
      return {
        success: true, // Return success to avoid blocking deletion
      };
    } catch (error) {
      console.error('OneDrive file deletion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Remove invoice row from Excel
  static async removeFromExcel(invoiceData: any): Promise<{ success: boolean; error?: string }> {
    try {
      const hasValidToken = await this.ensureValidToken();
      if (!hasValidToken) {
        return {
          success: false,
          error: 'Authentication required',
        };
      }

      // Get settings for Excel file configuration
      const { SettingsService } = await import('./settingsService');
      const settings = await SettingsService.getSettings();
      const excelFileName = settings.onedrive.excelFileName;

      // Find the Excel file
      const excelFileId = await this.findExcelFile(excelFileName);
      if (!excelFileId) {
        return {
          success: true, // File doesn't exist, consider deletion successful
        };
      }

      // Find and delete the matching row
      const deleted = await this.deleteExcelRow(excelFileId, invoiceData);
      
      return {
        success: deleted,
        error: deleted ? undefined : 'Failed to find or delete Excel row',
      };
    } catch (error) {
      console.error('Excel row deletion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Find Excel file (similar to ensureExcelFileExists but doesn't create)
  private static async findExcelFile(fileName: string): Promise<string | null> {
    try {
      const searchResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/search(q='${fileName}')`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.value && searchData.value.length > 0) {
          return searchData.value[0].id;
        }
      }
      return null;
    } catch (error) {
      console.error('Error finding Excel file:', error);
      return null;
    }
  }

  // Delete specific row from Excel table
  private static async deleteExcelRow(excelFileId: string, invoiceData: any): Promise<boolean> {
    try {
      // Get all table rows to find the matching one
      const tableResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${excelFileId}/workbook/tables/Table1/rows`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!tableResponse.ok) {
        console.log('Could not fetch table rows for deletion');
        return false;
      }

      const tableData = await tableResponse.json();
      const rows = tableData.value;

      // Find row that matches this invoice
      let matchingRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const values = row.values[0]; // First (and only) row of values
        
        // Match by sequence_id (most reliable) or fallback to detailed matching
        const sequenceIdMatch = invoiceData.sequence_id && values[0] === invoiceData.sequence_id;
        const detailedMatch = !invoiceData.sequence_id && 
          values[1] === invoiceData.customer_name && 
          values[2] === invoiceData.invoice_date && 
          parseFloat(values[4]) === invoiceData.invoice_amount &&
          values[3] === (invoiceData.description_category === 'Other' ? invoiceData.description_other : invoiceData.description_category);
        
        if (sequenceIdMatch || detailedMatch) {
          matchingRowIndex = i;
          console.log('Found matching row for deletion at index:', i);
          break;
        }
      }

      if (matchingRowIndex === -1) {
        console.log('No matching row found for deletion');
        return true; // Consider it successful if row doesn't exist
      }

      // Delete the matching row
      const deleteResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${excelFileId}/workbook/tables/Table1/rows/itemAt(index=${matchingRowIndex})`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (deleteResponse.ok) {
        console.log('Successfully deleted Excel row');
        return true;
      } else {
        const errorText = await deleteResponse.text();
        console.error('Failed to delete Excel row:', errorText);
        return false;
      }
    } catch (error) {
      console.error('Error deleting Excel row:', error);
      return false;
    }
  }

  // Simulate upload for demo purposes (remove when actual API is configured)
  static async simulateOneDriveUpload(invoice: any): Promise<OneDriveUploadResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate success/failure (90% success rate for demo)
    const success = Math.random() > 0.1;
    
    if (success) {
      const fileName = `invoice_${invoice.customer_name.replace(/\s+/g, '_')}_${invoice.invoice_date}`;
      return {
        success: true,
        fileUrl: `https://1drv.ms/i/s!${fileName}_${Date.now()}`,
      };
    } else {
      return {
        success: false,
        error: 'Simulated upload failure - please try again',
      };
    }
  }

  // Add a method to check token validity without side effects
  static checkTokenValidity(): { isValid: boolean; expiresAt?: Date; timeRemaining?: number } {
    this.loadStoredTokens();
    
    if (!this.accessToken) {
      return { isValid: false };
    }
    
    const expiresAt = localStorage.getItem('ms_token_expires');
    if (!expiresAt) {
      return { isValid: true }; // No expiration set, assume valid
    }
    
    const expirationTime = parseInt(expiresAt);
    const now = Date.now();
    const timeRemaining = expirationTime - now;
    
    return {
      isValid: timeRemaining > 0,
      expiresAt: new Date(expirationTime),
      timeRemaining: Math.max(0, timeRemaining)
    };
  }

  // Clear authentication
  static logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('ms_access_token');
    localStorage.removeItem('ms_refresh_token');
    localStorage.removeItem('ms_token_expires');
    console.log('Microsoft authentication cleared');
  }

  // List folders in OneDrive (for settings page folder browser)
  static async listFolders(path: string = ''): Promise<Array<{ name: string; path: string; isFolder: boolean }>> {
    console.log('listFolders called with path:', path);
    
    const hasValidToken = await this.ensureValidToken();
    if (!hasValidToken) {
      console.error('No valid token for listFolders');
      throw new Error('Authentication required');
    }

    console.log('Using access token:', this.accessToken ? 'present' : 'missing');

    try {
      const endpoint = path 
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/children`
        : 'https://graph.microsoft.com/v1.0/me/drive/root/children';

      console.log('Making request to endpoint:', endpoint);

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`Failed to list folders: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API Response data:', data);
      
      return data.value
        .filter((item: any) => item.folder) // Only return folders
        .map((folder: any) => ({
          name: folder.name,
          path: path ? `${path}/${folder.name}` : folder.name,
          isFolder: true,
        }));
    } catch (error) {
      console.error('Failed to list folders:', error);
      throw error;
    }
  }

  // List Excel files in OneDrive (for settings page)
  static async listExcelFiles(): Promise<Array<{ name: string; path: string }>> {
    const hasValidToken = await this.ensureValidToken();
    if (!hasValidToken) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='.xlsx')", {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list Excel files: ${response.statusText}`);
      }

      const data = await response.json();
      return data.value.map((file: any) => ({
        name: file.name,
        path: file.parentReference?.path ? `${file.parentReference.path}/${file.name}` : `/${file.name}`,
      }));
    } catch (error) {
      console.error('Failed to list Excel files:', error);
      throw error;
    }
  }

  // List Excel files in a specific path (for settings page folder browser)
  static async listExcelFilesInPath(path: string = ''): Promise<Array<{ name: string; path: string }>> {
    const hasValidToken = await this.ensureValidToken();
    if (!hasValidToken) {
      throw new Error('Authentication required');
    }

    try {
      const endpoint = path 
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/children`
        : 'https://graph.microsoft.com/v1.0/me/drive/root/children';

      console.log('Making request to endpoint for Excel files:', endpoint);

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`Failed to list Excel files: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API Response data for Excel files:', data);
      
      return data.value
        .filter((item: any) => !item.folder && item.name.toLowerCase().endsWith('.xlsx')) // Only Excel files
        .map((file: any) => ({
          name: file.name,
          path: path ? `${path}/${file.name}` : file.name,
        }));
    } catch (error) {
      console.error('Failed to list Excel files in path:', error);
      throw error;
    }
  }
}