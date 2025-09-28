interface MicrosoftConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

export interface OneDriveUploadResult {
  success: boolean;
  error?: string;
  fileUrl?: string;
}

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at?: number;
}

interface DriveItem {
  id: string;
  name: string;
  webUrl: string;
  '@microsoft.graph.downloadUrl'?: string;
  folder?: any;
  file?: any;
}

export class MicrosoftService {
  private static config: MicrosoftConfig | null = null;
  private static tokenData: TokenData | null = null;
  private static readonly TOKEN_STORAGE_KEY = 'microsoft_token_data';
  private static readonly CODE_VERIFIER_KEY = 'microsoft_code_verifier';

  static configure(config: MicrosoftConfig) {
    this.config = config;
    console.log('Microsoft service configured with client ID:', config.clientId);
    
    // Load existing token data
    this.loadTokenData();
  }

  static isAuthenticated(): boolean {
    if (!this.tokenData) {
      return false;
    }

    // Check if token is expired
    const now = Date.now();
    const expiresAt = this.tokenData.expires_at || 0;
    
    if (now >= expiresAt) {
      console.log('Token expired, clearing authentication');
      this.clearTokenData();
      return false;
    }

    return true;
  }

  private static generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private static async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  static checkTokenValidity(): { isValid: boolean; expiresAt?: number; timeRemaining?: number } {
    if (!this.tokenData) {
      return { isValid: false };
    }

    const now = Date.now();
    const expiresAt = this.tokenData.expires_at || 0;
    const timeRemaining = expiresAt - now;

    return {
      isValid: timeRemaining > 0,
      expiresAt,
      timeRemaining: Math.max(0, timeRemaining)
    };
  }

  static async initiateLogin(): Promise<void> {
    if (!this.config) {
      throw new Error('Microsoft service not configured');
    }

    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later use
    localStorage.setItem(this.CODE_VERIFIER_KEY, codeVerifier);

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.set('scope', this.config.scopes.join(' '));
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('state', Math.random().toString(36).substring(2));
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('Redirecting to Microsoft login:', authUrl.toString());
    window.location.href = authUrl.toString();
  }

  static async handleAuthorizationCallback(code: string): Promise<void> {
    if (!this.config) {
      throw new Error('Microsoft service not configured');
    }

    try {
      // Retrieve code verifier from storage
      const codeVerifier = localStorage.getItem(this.CODE_VERIFIER_KEY);
      if (!codeVerifier) {
        throw new Error('Code verifier not found. Please restart the authentication process.');
      }

      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
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
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData: TokenData = await response.json();
      
      // Calculate expiration time
      tokenData.expires_at = Date.now() + (tokenData.expires_in * 1000);
      
      this.tokenData = tokenData;
      this.saveTokenData();
      
      // Clean up code verifier
      localStorage.removeItem(this.CODE_VERIFIER_KEY);
      
      console.log('Microsoft authentication successful');
    } catch (error) {
      console.error('Authorization callback failed:', error);
      // Clean up code verifier on error
      localStorage.removeItem(this.CODE_VERIFIER_KEY);
      throw error;
    }
  }

  static async handleImplicitCallback(accessToken: string, params: URLSearchParams): Promise<void> {
    try {
      const expiresIn = parseInt(params.get('expires_in') || '3600');
      const scope = params.get('scope') || this.config?.scopes.join(' ') || '';
      
      const tokenData: TokenData = {
        access_token: accessToken,
        expires_in: expiresIn,
        token_type: 'Bearer',
        scope: scope,
        expires_at: Date.now() + (expiresIn * 1000)
      };
      
      this.tokenData = tokenData;
      this.saveTokenData();
      
      console.log('Microsoft implicit authentication successful');
    } catch (error) {
      console.error('Implicit callback failed:', error);
      throw error;
    }
  }

  static logout(): void {
    this.clearTokenData();
    localStorage.removeItem(this.CODE_VERIFIER_KEY);
    console.log('Microsoft logout completed');
  }

  private static loadTokenData(): void {
    try {
      const stored = localStorage.getItem(this.TOKEN_STORAGE_KEY);
      if (stored) {
        this.tokenData = JSON.parse(stored);
        console.log('Loaded existing Microsoft token data');
      }
    } catch (error) {
      console.error('Failed to load token data:', error);
      this.clearTokenData();
    }
  }

  private static saveTokenData(): void {
    try {
      if (this.tokenData) {
        localStorage.setItem(this.TOKEN_STORAGE_KEY, JSON.stringify(this.tokenData));
      }
    } catch (error) {
      console.error('Failed to save token data:', error);
    }
  }

  private static clearTokenData(): void {
    this.tokenData = null;
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    localStorage.removeItem(this.CODE_VERIFIER_KEY);
  }

  private static async makeGraphRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Microsoft');
    }

    const url = endpoint.startsWith('https://') ? endpoint : `https://graph.microsoft.com/v1.0${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.tokenData!.access_token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Graph API request failed: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use the raw error text if JSON parsing fails
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }
      
      throw new Error(errorMessage);
    }

    // Handle responses that don't contain JSON
    if (response.status === 204 || 
        response.headers.get('Content-Length') === '0' ||
        !response.headers.get('Content-Type')?.includes('application/json')) {
      return null;
    }

    try {
      return await response.json();
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      const responseText = await response.text().catch(() => 'Unable to read response text');
      console.error('Raw response:', responseText);
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async uploadInvoiceToOneDrive(invoice: any, file: Blob): Promise<OneDriveUploadResult> {
    try {
      console.log('Starting OneDrive upload for invoice:', invoice.id);
      
      // Get settings for directory configuration
      const { SettingsService } = await import('./settingsService');
      const settings = await SettingsService.getSettings();
      
      const invoiceDirectory = settings.onedrive.invoiceDirectory || 'Invoices';
      const excelFileName = settings.onedrive.excelFileName || 'Invoice_Tracker.xlsx';
      
      // Ensure the invoice directory exists
      await this.ensureDirectoryExists(invoiceDirectory);
      
      // Generate filename for the invoice file
      const fileExtension = invoice.file_type === 'pdf' ? 'pdf' : 'jpg';
      const fileName = `${invoice.customer_name.replace(/[^a-zA-Z0-9]/g, '_')}_${invoice.invoice_date}_${invoice.sequence_id}.${fileExtension}`;
      const filePath = `${invoiceDirectory}/${fileName}`;
      
      // Upload the file
      console.log('Uploading file to OneDrive:', filePath);
      const uploadResponse = await this.uploadFile(filePath, file);
      const fileUrl = uploadResponse.webUrl;
      
      console.log('File uploaded successfully:', fileUrl);
      
      // Update Excel file
      try {
        console.log('Updating Excel file...');
        await this.appendToExcel({
          ...invoice,
          onedrive_file_url: fileUrl,
        });
        console.log('Excel file updated successfully');
      } catch (excelError) {
        console.warn('Excel update failed, but file upload succeeded:', excelError);
        // Don't fail the entire operation if Excel update fails
      }
      
      return {
        success: true,
        fileUrl: fileUrl,
      };
    } catch (error) {
      console.error('OneDrive upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private static async ensureDirectoryExists(directoryPath: string): Promise<void> {
    try {
      // Split path into parts and create each directory level
      const pathParts = directoryPath.split('/').filter(part => part.length > 0);
      let currentPath = '';
      
      for (const part of pathParts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        try {
          // Try to get the folder
          await this.makeGraphRequest(`/me/drive/root:/${currentPath}`);
        } catch (error) {
          // If folder doesn't exist, create it
          if (error instanceof Error && error.message.includes('404')) {
            const parentPath = currentPath.split('/').slice(0, -1).join('/');
            const parentEndpoint = parentPath ? `/me/drive/root:/${parentPath}:/children` : '/me/drive/root/children';
            
            await this.makeGraphRequest(parentEndpoint, {
              method: 'POST',
              body: JSON.stringify({
                name: part,
                folder: {},
                '@microsoft.graph.conflictBehavior': 'rename'
              }),
            });
            
            console.log(`Created directory: ${currentPath}`);
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Failed to ensure directory exists:', error);
      throw new Error(`Failed to create directory ${directoryPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async uploadFile(filePath: string, file: Blob): Promise<DriveItem> {
    try {
      // For files larger than 4MB, we should use resumable upload, but for simplicity we'll use simple upload
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${filePath}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.tokenData!.access_token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: file,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`File upload failed: ${response.status} ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  static async appendToExcel(invoice: any): Promise<void> {
    try {
      const { SettingsService } = await import('./settingsService');
      const settings = await SettingsService.getSettings();
      const excelFileName = settings.onedrive.excelFileName || 'Invoice_Tracker.xlsx';
      
      // Try to get the Excel file, create if it doesn't exist
      let workbook;
      try {
        workbook = await this.getOrCreateExcelFile(excelFileName);
      } catch (error) {
        console.error('Failed to get or create Excel file:', error);
        throw new Error(`Excel file access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Get the first worksheet
      let worksheet;
      try {
        const worksheetsResponse = await this.makeGraphRequest(`/me/drive/items/${workbook.id}/workbook/worksheets`);
        
        if (!worksheetsResponse.value || worksheetsResponse.value.length === 0) {
          // Create a new worksheet if none exist
          worksheet = await this.makeGraphRequest(`/me/drive/items/${workbook.id}/workbook/worksheets`, {
            method: 'POST',
            body: JSON.stringify({
              name: 'Invoice Tracker'
            }),
          });
        } else {
          worksheet = worksheetsResponse.value[0];
        }
      } catch (error) {
        console.error('Failed to get worksheets:', error);
        throw new Error(`Failed to get worksheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Check if headers exist, add them if not
      await this.ensureExcelHeaders(workbook.id, worksheet.id);
      
      // Find the next empty row
      const nextRow = await this.findNextEmptyRow(workbook.id, worksheet.id);
      
      // Prepare the data
      const rowData = [
        invoice.sequence_id,
        invoice.customer_name,
        invoice.invoice_date,
        invoice.description_category === 'Other' ? invoice.description_other : invoice.description_category,
        invoice.invoice_amount,
        invoice.onedrive_file_url || '',
        new Date().toISOString().split('T')[0] // Date added
      ];
      
      // Add the row
      await this.makeGraphRequest(`/me/drive/items/${workbook.id}/workbook/worksheets/${worksheet.id}/range(address='A${nextRow}:G${nextRow}')`, {
        method: 'PATCH',
        body: JSON.stringify({
          values: [rowData]
        }),
      });
      
      console.log(`Added invoice to Excel at row ${nextRow}`);
    } catch (error) {
      console.error('Failed to append to Excel:', error);
      throw error;
    }
  }

  static async updateInExcel(invoice: any): Promise<void> {
    try {
      const { SettingsService } = await import('./settingsService');
      const settings = await SettingsService.getSettings();
      const excelFileName = settings.onedrive.excelFileName || 'Invoice_Tracker.xlsx';
      
      const workbook = await this.getOrCreateExcelFile(excelFileName);
      const worksheetsResponse = await this.makeGraphRequest(`/me/drive/items/${workbook.id}/workbook/worksheets`);
      
      if (!worksheetsResponse.value || worksheetsResponse.value.length === 0) {
        throw new Error('No worksheets found in Excel file');
      }
      
      const worksheet = worksheetsResponse.value[0];
      
      // Find the row with this sequence_id
      const usedRange = await this.makeGraphRequest(`/me/drive/items/${workbook.id}/workbook/worksheets/${worksheet.id}/usedRange`);
      
      if (!usedRange.values) {
        throw new Error('Invoice not found in Excel');
      }
      
      let targetRow = -1;
      for (let i = 1; i < usedRange.values.length; i++) { // Skip header row
        if (usedRange.values[i][0] === invoice.sequence_id) {
          targetRow = i + 1; // Excel rows are 1-indexed
          break;
        }
      }
      
      if (targetRow === -1) {
        throw new Error('Invoice not found in Excel');
      }
      
      // Update the row
      const rowData = [
        invoice.sequence_id,
        invoice.customer_name,
        invoice.invoice_date,
        invoice.description_category === 'Other' ? invoice.description_other : invoice.description_category,
        invoice.invoice_amount,
        invoice.onedrive_file_url || '',
        new Date().toISOString().split('T')[0] // Date modified
      ];
      
      await this.makeGraphRequest(`/me/drive/items/${workbook.id}/workbook/worksheets/${worksheet.id}/range(address='A${targetRow}:G${targetRow}')`, {
        method: 'PATCH',
        body: JSON.stringify({
          values: [rowData]
        }),
      });
      
      console.log(`Updated invoice in Excel at row ${targetRow}`);
    } catch (error) {
      console.error('Failed to update Excel:', error);
      throw error;
    }
  }

  static async removeFromExcel(invoice: any): Promise<OneDriveUploadResult> {
    try {
      const { SettingsService } = await import('./settingsService');
      const settings = await SettingsService.getSettings();
      const excelFileName = settings.onedrive.excelFileName || 'Invoice_Tracker.xlsx';
      
      const workbook = await this.getOrCreateExcelFile(excelFileName);
      const worksheetsResponse = await this.makeGraphRequest(`/me/drive/items/${workbook.id}/workbook/worksheets`);
      
      if (!worksheetsResponse.value || worksheetsResponse.value.length === 0) {
        return { success: true }; // No worksheets, nothing to remove
      }
      
      const worksheet = worksheetsResponse.value[0];
      
      // Find the row with this sequence_id
      const usedRange = await this.makeGraphRequest(`/me/drive/items/${workbook.id}/workbook/worksheets/${worksheet.id}/usedRange`);
      
      if (!usedRange.values) {
        return { success: true }; // No data, nothing to remove
      }
      
      let targetRow = -1;
      for (let i = 1; i < usedRange.values.length; i++) { // Skip header row
        if (usedRange.values[i][0] === invoice.sequence_id) {
          targetRow = i + 1; // Excel rows are 1-indexed
          break;
        }
      }
      
      if (targetRow === -1) {
        return { success: true }; // Row not found, nothing to remove
      }
      
      // Delete the row
      await this.makeGraphRequest(`/me/drive/items/${workbook.id}/workbook/worksheets/${worksheet.id}/range(address='${targetRow}:${targetRow}')`, {
        method: 'DELETE',
      });
      
      console.log(`Removed invoice from Excel at row ${targetRow}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to remove from Excel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private static async getOrCreateExcelFile(fileName: string): Promise<DriveItem> {
    try {
      // Try to get existing file
      const existingFile = await this.makeGraphRequest(`/me/drive/root:/${fileName}`);
      
      // Handle null response (file not found)
      if (!existingFile) {
        console.log('Excel file not found (null response), creating new one:', fileName);
        return await this.createExcelFile(fileName);
      }
      
      // Check if the file has the correct MIME type for Excel
      if (existingFile.file && existingFile.file.mimeType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        console.log('Existing file has incorrect MIME type, deleting and recreating:', existingFile.file.mimeType);
        
        // Delete the malformed file
        await this.makeGraphRequest(`/me/drive/items/${existingFile.id}`, {
          method: 'DELETE',
        });
        
        // Create a new Excel file
        return await this.createExcelFile(fileName);
      }
      
      // Additional validation: try to access worksheets to ensure the file is a valid Excel workbook
      try {
        await this.makeGraphRequest(`/me/drive/items/${existingFile.id}/workbook/worksheets`);
      } catch (worksheetError) {
        if (worksheetError instanceof Error && worksheetError.message.includes('file format may not be matching')) {
          console.log('Existing file is malformed (cannot access worksheets), deleting and recreating');
          
          // Delete the malformed file
          await this.makeGraphRequest(`/me/drive/items/${existingFile.id}`, {
            method: 'DELETE',
          });
          
          // Create a new Excel file
          return await this.createExcelFile(fileName);
        }
        // Re-throw other worksheet errors
        throw worksheetError;
      }
      
      return existingFile;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        // File doesn't exist, create it
        console.log('Excel file not found, creating new one:', fileName);
        return await this.createExcelFile(fileName);
      }
      throw error;
    }
  }

  private static async createExcelFile(fileName: string): Promise<DriveItem> {
    try {
      // Create a new Excel workbook
      const workbook = await this.makeGraphRequest('/me/drive/root/children', {
        method: 'POST',
        body: JSON.stringify({
          name: fileName,
          file: {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          },
          '@microsoft.graph.conflictBehavior': 'rename'
        }),
      });
      
      // Wait a moment for the file to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return workbook;
    } catch (error) {
      console.error('Failed to create Excel file:', error);
      throw error;
    }
  }

  private static async ensureExcelHeaders(workbookId: string, worksheetId: string): Promise<void> {
    try {
      // Check if headers already exist
      const headerRange = await this.makeGraphRequest(`/me/drive/items/${workbookId}/workbook/worksheets/${worksheetId}/range(address='A1:G1')`);
      
      // If first cell is empty, add headers
      if (!headerRange.values || !headerRange.values[0] || !headerRange.values[0][0]) {
        const headers = [
          'Invoice #',
          'Customer Name',
          'Date',
          'Description',
          'Amount',
          'File Link',
          'Date Added'
        ];
        
        await this.makeGraphRequest(`/me/drive/items/${workbookId}/workbook/worksheets/${worksheetId}/range(address='A1:G1')`, {
          method: 'PATCH',
          body: JSON.stringify({
            values: [headers]
          }),
        });
        
        console.log('Added Excel headers');
      }
    } catch (error) {
      console.error('Failed to ensure Excel headers:', error);
      throw error;
    }
  }

  private static async findNextEmptyRow(workbookId: string, worksheetId: string): Promise<number> {
    try {
      const usedRange = await this.makeGraphRequest(`/me/drive/items/${workbookId}/workbook/worksheets/${worksheetId}/usedRange`);
      
      if (!usedRange.values || usedRange.values.length === 0) {
        return 1; // First row if no data
      }
      
      return usedRange.values.length + 1; // Next row after used range
    } catch (error) {
      console.error('Failed to find next empty row:', error);
      return 2; // Default to row 2 (assuming row 1 has headers)
    }
  }

  static async deleteFileFromOneDrive(fileUrl: string): Promise<OneDriveUploadResult> {
    try {
      // Extract file path from the OneDrive URL
      const url = new URL(fileUrl);
      const pathMatch = url.pathname.match(/\/personal\/[^\/]+\/Documents\/(.+)$/);
      
      if (!pathMatch) {
        throw new Error('Could not extract file path from OneDrive URL');
      }
      
      const filePath = decodeURIComponent(pathMatch[1]);
      
      // Delete the file
      await this.makeGraphRequest(`/me/drive/root:/${filePath}`, {
        method: 'DELETE',
      });
      
      console.log('File deleted from OneDrive:', filePath);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete file from OneDrive:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  static async listExcelFiles(): Promise<Array<{ name: string; path: string }>> {
    try {
      const response = await this.makeGraphRequest('/me/drive/root/search(q=\'.xlsx\')');
      
      return response.value
        .filter((item: DriveItem) => item.name.endsWith('.xlsx'))
        .map((item: DriveItem) => ({
          name: item.name,
          path: item.webUrl,
        }));
    } catch (error) {
      console.error('Failed to list Excel files:', error);
      return [];
    }
  }

  static async listExcelFilesInPath(path: string): Promise<Array<{ name: string; path: string }>> {
    try {
      const endpoint = path 
        ? `/me/drive/root:/${path}:/children`
        : '/me/drive/root/children';
      
      const response = await this.makeGraphRequest(endpoint);
      
      return response.value
        .filter((item: DriveItem) => item.file && item.name.endsWith('.xlsx'))
        .map((item: DriveItem) => ({
          name: item.name,
          path: path ? `${path}/${item.name}` : item.name,
        }));
    } catch (error) {
      console.error('Failed to list Excel files in path:', error);
      return [];
    }
  }

  static async listFolders(path: string = ''): Promise<Array<{ name: string; path: string }>> {
    try {
      const endpoint = path 
        ? `/me/drive/root:/${path}:/children`
        : '/me/drive/root/children';
      
      const response = await this.makeGraphRequest(endpoint);
      
      return response.value
        .filter((item: DriveItem) => item.folder)
        .map((item: DriveItem) => ({
          name: item.name,
          path: path ? `${path}/${item.name}` : item.name,
        }));
    } catch (error) {
      console.error('Failed to list folders:', error);
      return [];
    }
  }
}