import { Invoice } from '../types/invoice';
import { SettingsService } from './settingsService';
import * as ExcelJS from 'exceljs';

export interface OneDriveUploadResult {
  success: boolean;
  error?: string;
  fileUrl?: string;
}

export interface MicrosoftConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

export class MicrosoftService {
  private static config: MicrosoftConfig | null = null;
  private static accessToken: string | null = null;
  private static refreshToken: string | null = null;
  private static tokenExpiry: number | null = null;

  static configure(config: MicrosoftConfig) {
    this.config = config;
    console.log('Microsoft service configured with:', {
      clientId: config.clientId,
      tenantId: config.tenantId,
      redirectUri: config.redirectUri,
      scopes: config.scopes
    });
    
    // Load stored tokens
    this.loadStoredTokens();
  }

  private static loadStoredTokens() {
    try {
      const storedToken = localStorage.getItem('ms_access_token');
      const storedRefresh = localStorage.getItem('ms_refresh_token');
      const storedExpiry = localStorage.getItem('ms_token_expiry');
      
      if (storedToken && storedExpiry) {
        const expiryTime = parseInt(storedExpiry);
        if (Date.now() < expiryTime) {
          this.accessToken = storedToken;
          this.refreshToken = storedRefresh;
          this.tokenExpiry = expiryTime;
          console.log('Loaded stored Microsoft tokens');
        } else {
          console.log('Stored tokens expired, clearing');
          this.clearStoredTokens();
        }
      }
    } catch (error) {
      console.error('Error loading stored tokens:', error);
    }
  }

  private static storeTokens(accessToken: string, refreshToken?: string, expiresIn?: number) {
    try {
      localStorage.setItem('ms_access_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('ms_refresh_token', refreshToken);
      }
      
      const expiry = Date.now() + (expiresIn ? expiresIn * 1000 : 3600000); // Default 1 hour
      localStorage.setItem('ms_token_expiry', expiry.toString());
      
      this.accessToken = accessToken;
      if (refreshToken) {
        this.refreshToken = refreshToken;
      }
      this.tokenExpiry = expiry;
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  }

  private static clearStoredTokens() {
    try {
      localStorage.removeItem('ms_access_token');
      localStorage.removeItem('ms_refresh_token');
      localStorage.removeItem('ms_token_expiry');
      localStorage.removeItem('ms_code_verifier');
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  // PKCE helper methods
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

  static async initiateLogin(): Promise<void> {
    if (!this.config) {
      throw new Error('Microsoft service not configured');
    }

    try {
      // Generate PKCE parameters
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      
      // Store code verifier for later use
      localStorage.setItem('ms_code_verifier', codeVerifier);

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        response_type: 'code',
        redirect_uri: this.config.redirectUri,
        scope: this.config.scopes.join(' '),
        response_mode: 'query',
        state: Math.random().toString(36).substring(2),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });

      const authUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?${params}`;
      console.log('Redirecting to Microsoft login:', authUrl);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating Microsoft login:', error);
      throw error;
    }
  }

  static async handleAuthorizationCallback(code: string): Promise<void> {
    if (!this.config) {
      throw new Error('Microsoft service not configured');
    }

    try {
      // Retrieve the stored code verifier
      const codeVerifier = localStorage.getItem('ms_code_verifier');
      if (!codeVerifier) {
        throw new Error('Code verifier not found. Please try logging in again.');
      }

      const tokenData = {
        client_id: this.config.clientId,
        scope: this.config.scopes.join(' '),
        code: code,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      };

      const response = await fetch(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Token exchange failed:', response.status, errorData);
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      const tokens = await response.json();
      console.log('Token exchange successful');
      
      this.storeTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
      
      // Clean up the code verifier
      localStorage.removeItem('ms_code_verifier');
    } catch (error) {
      // Clean up the code verifier on error
      localStorage.removeItem('ms_code_verifier');
      console.error('Authorization callback failed:', error);
      throw error;
    }
  }

  static async handleImplicitCallback(accessToken: string, params: URLSearchParams): Promise<void> {
    try {
      const expiresIn = params.get('expires_in');
      this.storeTokens(accessToken, undefined, expiresIn ? parseInt(expiresIn) : undefined);
      console.log('Implicit flow tokens stored');
    } catch (error) {
      console.error('Implicit callback failed:', error);
      throw error;
    }
  }

  static isAuthenticated(): boolean {
    if (!this.accessToken || !this.tokenExpiry) {
      return false;
    }
    
    // Check if token is expired (with 5 minute buffer)
    return Date.now() < (this.tokenExpiry - 300000);
  }

  static checkTokenValidity(): { isValid: boolean; expiresAt?: Date; timeRemaining?: number } {
    if (!this.accessToken || !this.tokenExpiry) {
      return { isValid: false };
    }
    
    const now = Date.now();
    const timeRemaining = this.tokenExpiry - now;
    const isValid = timeRemaining > 300000; // 5 minute buffer
    
    return {
      isValid,
      expiresAt: new Date(this.tokenExpiry),
      timeRemaining: Math.max(0, timeRemaining)
    };
  }

  static logout(): void {
    this.clearStoredTokens();
    console.log('Microsoft service logged out');
  }

  private static async ensureValidToken(): Promise<void> {
    if (!this.isAuthenticated()) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw new Error('Not authenticated with Microsoft. Please log in again.');
      }
    }
  }

  private static async refreshAccessToken(): Promise<void> {
    if (!this.config || !this.refreshToken) {
      throw new Error('Cannot refresh token: missing configuration or refresh token');
    }

    try {
      const response = await fetch(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          scope: this.config.scopes.join(' '),
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokens = await response.json();
      this.storeTokens(tokens.access_token, tokens.refresh_token || this.refreshToken, tokens.expires_in);
      console.log('Access token refreshed successfully');
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearStoredTokens();
      throw error;
    }
  }

  static async uploadInvoiceToOneDrive(invoice: Invoice, file: Blob): Promise<OneDriveUploadResult> {
    try {
      await this.ensureValidToken();
      
      const settings = await SettingsService.getSettings();
      const directory = settings.onedrive.invoiceDirectory || 'Invoices';
      
      // Create filename with customer name and date
      const date = new Date(invoice.invoice_date).toISOString().split('T')[0];
      const customerName = invoice.customer_name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileExtension = invoice.file_type === 'pdf' ? 'pdf' : 'jpg';
      const fileName = `${date}_${customerName}_${invoice.sequence_id}.${fileExtension}`;
      
      // Ensure directory exists
      await this.ensureDirectoryExists(directory);
      
      // Upload file
      const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${directory}/${fileName}:/content`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': invoice.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`File upload failed: ${uploadResponse.status} ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('File uploaded to OneDrive:', uploadResult.webUrl);

      // Create sharing link
      const sharingResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${uploadResult.id}/createLink`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'view',
          scope: 'anonymous',
        }),
      });

      let sharingLink = uploadResult.webUrl;
      if (sharingResponse.ok) {
        const sharingResult = await sharingResponse.json();
        sharingLink = sharingResult.link.webUrl;
      }

      // Add to Excel
      await this.appendToExcel({
        ...invoice,
        onedrive_file_url: sharingLink,
        filename: fileName,
      });

      return {
        success: true,
        fileUrl: sharingLink,
      };
    } catch (error) {
      console.error('OneDrive upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private static async ensureDirectoryExists(path: string): Promise<void> {
    try {
      const pathParts = path.split('/').filter(part => part.length > 0);
      let currentPath = '';

      for (const part of pathParts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        try {
          await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${currentPath}`, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
            },
          });
        } catch {
          // Directory doesn't exist, create it
          await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: part,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'rename',
            }),
          });
        }
      }
    } catch (error) {
      console.error('Error ensuring directory exists:', error);
    }
  }

  static async appendToExcel(invoice: Invoice & { filename?: string }): Promise<void> {
    try {
      await this.ensureValidToken();
      
      const settings = await SettingsService.getSettings();
      const excelFileName = settings.onedrive.excelFileName || 'Invoice_Tracker.xlsx';
      
      // Ensure Excel file exists
      await this.ensureExcelFileExists(excelFileName);
      
      // Get the workbook
      const workbookResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${excelFileName}:/workbook/worksheets('Sheet1')/tables`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      let tableId = 'Table1';
      if (workbookResponse.ok) {
        const tables = await workbookResponse.json();
        if (tables.value && tables.value.length > 0) {
          tableId = tables.value[0].id;
        }
      }

      // Add row to table
      const rowData = [
        invoice.sequence_id,
        invoice.customer_name,
        invoice.invoice_date,
        invoice.description_category === 'Other' ? invoice.description_other : invoice.description_category,
        invoice.invoice_amount,
        invoice.onedrive_file_url || '',
        invoice.filename || (invoice.onedrive_file_url ? invoice.onedrive_file_url.split('/').pop() : ''),
        new Date().toISOString().split('T')[0],
      ];

      const addRowResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${excelFileName}:/workbook/tables/${tableId}/rows/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData],
        }),
      });

      if (!addRowResponse.ok) {
        const errorText = await addRowResponse.text();
        throw new Error(`Failed to add row to Excel: ${addRowResponse.status} ${errorText}`);
      }

      console.log('Invoice added to Excel successfully');
    } catch (error) {
      console.error('Error adding to Excel:', error);
      throw error;
    }
  }

  static async updateInExcel(invoice: Invoice & { filename?: string }): Promise<void> {
    try {
      await this.ensureValidToken();
      
      const settings = await SettingsService.getSettings();
      const excelFileName = settings.onedrive.excelFileName || 'Invoice_Tracker.xlsx';
      
      // Ensure Excel file exists before attempting to update
      await this.ensureExcelFileExists(excelFileName);
      
      // Get the workbook and find the row to update
      const workbookResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${excelFileName}:/workbook/worksheets('Sheet1')/tables`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      let tableId = 'Table1';
      if (workbookResponse.ok) {
        const tables = await workbookResponse.json();
        if (tables.value && tables.value.length > 0) {
          tableId = tables.value[0].id;
        }
      }

      // Get all rows to find the one to update
      const rowsResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${excelFileName}:/workbook/tables/${tableId}/rows`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!rowsResponse.ok) {
        throw new Error(`Failed to get Excel rows: ${rowsResponse.status}`);
      }

      const rowsData = await rowsResponse.json();
      const rows = rowsData.value || [];
      
      // Find the row with matching sequence_id (first column)
      let targetRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].values[0][0] === invoice.sequence_id) {
          targetRowIndex = i;
          break;
        }
      }

      if (targetRowIndex === -1) {
        throw new Error(`Invoice with sequence_id ${invoice.sequence_id} not found in Excel`);
      }

      // Update the row with all current data including file information
      const updatedRowData = [
        invoice.sequence_id,
        invoice.customer_name,
        invoice.invoice_date,
        invoice.description_category === 'Other' ? invoice.description_other : invoice.description_category,
        invoice.invoice_amount,
        invoice.onedrive_file_url || '',
        invoice.filename || (invoice.onedrive_file_url ? invoice.onedrive_file_url.split('/').pop() : ''),
        new Date().toISOString().split('T')[0], // Updated date
      ];

      const updateResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${excelFileName}:/workbook/tables/${tableId}/rows/itemAt(index=${targetRowIndex})`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [updatedRowData],
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update Excel row: ${updateResponse.status} ${errorText}`);
      }

      console.log('Invoice updated in Excel successfully');
    } catch (error) {
      console.error('Error updating Excel:', error);
      throw error;
    }
  }

  static async removeFromExcel(invoice: Invoice): Promise<OneDriveUploadResult> {
    try {
      await this.ensureValidToken();
      
      const settings = await SettingsService.getSettings();
      const excelFileName = settings.onedrive.excelFileName || 'Invoice_Tracker.xlsx';
      
      // Get the workbook and find the row to delete
      const workbookResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${excelFileName}:/workbook/worksheets('Sheet1')/tables`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      let tableId = 'Table1';
      if (workbookResponse.ok) {
        const tables = await workbookResponse.json();
        if (tables.value && tables.value.length > 0) {
          tableId = tables.value[0].id;
        }
      }

      // Get all rows to find the one to delete
      const rowsResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${excelFileName}:/workbook/tables/${tableId}/rows`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!rowsResponse.ok) {
        return { success: false, error: `Failed to get Excel rows: ${rowsResponse.status}` };
      }

      const rowsData = await rowsResponse.json();
      const rows = rowsData.value || [];
      
      // Find the row with matching sequence_id (first column)
      let targetRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].values[0][0] === invoice.sequence_id) {
          targetRowIndex = i;
          break;
        }
      }

      if (targetRowIndex === -1) {
        return { success: false, error: `Invoice with sequence_id ${invoice.sequence_id} not found in Excel` };
      }

      // Delete the row
      const deleteResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${excelFileName}:/workbook/tables/${tableId}/rows/itemAt(index=${targetRowIndex})`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!deleteResponse.ok) {
        return { success: false, error: `Failed to delete Excel row: ${deleteResponse.status}` };
      }

      console.log('Invoice removed from Excel successfully');
      return { success: true };
    } catch (error) {
      console.error('Error removing from Excel:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async deleteFileFromOneDrive(fileUrl: string): Promise<OneDriveUploadResult> {
    try {
      await this.ensureValidToken();
      
      // Extract file path from sharing URL or direct URL
      // This is a simplified approach - in practice, you might need more robust URL parsing
      const urlParts = fileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      const settings = await SettingsService.getSettings();
      const directory = settings.onedrive.invoiceDirectory || 'Invoices';
      
      const deleteUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${directory}/${fileName}`;
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        return { success: false, error: `Failed to delete file: ${response.status}` };
      }

      console.log('File deleted from OneDrive successfully');
      return { success: true };
    } catch (error) {
      console.error('Error deleting from OneDrive:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private static async ensureExcelFileExists(fileName: string): Promise<void> {
    try {
      // Check if file exists
      const checkResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (checkResponse.ok) {
        return; // File exists
      }

      // Create new Excel file with headers
      const excelContent = await this.createExcelTemplate();
      
      const createResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        body: excelContent,
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create Excel file: ${createResponse.status}`);
      }

      // Wait a moment for the file to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create table with headers
      await this.createExcelTable(fileName);
      
      console.log('Excel file created successfully');
    } catch (error) {
      console.error('Error ensuring Excel file exists:', error);
      throw error;
    }
  }

  private static async createExcelTemplate(): Promise<ArrayBuffer> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');
      
      // Add headers
      const headers = ['ID', 'Customer Name', 'Date', 'Description', 'Amount', 'File Link', 'Filename', 'Date Added'];
      worksheet.addRow(headers);
      
      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        column.width = Math.max(headers[index].length + 2, 15);
      });
      
      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer as ArrayBuffer;
    } catch (error) {
      console.error('Error creating Excel template:', error);
      throw error;
    }
  }

  private static async createExcelTable(fileName: string): Promise<void> {
    try {
      // Wait a bit longer for the file to be processed by Microsoft
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/workbook/worksheets('Sheet1')/tables/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: 'A1:H1',
          hasHeaders: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Failed to create Excel table:', response.status, errorText);
      }
    } catch (error) {
      console.warn('Error creating Excel table:', error);
    }
  }

  // Folder and file browsing methods
  static async listFolders(path: string = ''): Promise<Array<{ name: string; path: string }>> {
    try {
      await this.ensureValidToken();
      
      const url = path 
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/children?$filter=folder ne null`
        : `https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=folder ne null`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list folders: ${response.status}`);
      }

      const data = await response.json();
      return data.value.map((item: any) => ({
        name: item.name,
        path: path ? `${path}/${item.name}` : item.name,
      }));
    } catch (error) {
      console.error('Error listing folders:', error);
      throw error;
    }
  }

  static async listExcelFiles(): Promise<Array<{ name: string; path: string }>> {
    try {
      await this.ensureValidToken();
      
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/search(q='.xlsx')?$filter=file ne null`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list Excel files: ${response.status}`);
      }

      const data = await response.json();
      return data.value
        .filter((item: any) => item.name.endsWith('.xlsx'))
        .map((item: any) => ({
          name: item.name,
          path: item.parentReference?.path ? `${item.parentReference.path}/${item.name}` : item.name,
        }));
    } catch (error) {
      console.error('Error listing Excel files:', error);
      throw error;
    }
  }

  static async listExcelFilesInPath(path: string = ''): Promise<Array<{ name: string; path: string }>> {
    try {
      await this.ensureValidToken();
      
      const url = path 
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/children?$filter=endswith(name,'.xlsx')`
        : `https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=endswith(name,'.xlsx')`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list Excel files: ${response.status}`);
      }

      const data = await response.json();
      return data.value.map((item: any) => ({
        name: item.name,
        path: path ? `${path}/${item.name}` : item.name,
      }));
    } catch (error) {
      console.error('Error listing Excel files in path:', error);
      throw error;
    }
  }
}