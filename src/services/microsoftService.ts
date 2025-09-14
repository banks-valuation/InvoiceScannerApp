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
  static initiateLogin(): void {
    if (!this.config) {
      throw new Error('Microsoft service not configured. Call configure() first.');
    }

    const authUrl = new URL(
      `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize`
    );
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.set('scope', this.config.scopes.join(' '));
    authUrl.searchParams.set('response_mode', 'fragment');
    authUrl.searchParams.set('state', Math.random().toString(36).substring(2, 15));

    window.location.href = authUrl.toString();
  }

  // Handle implicit flow callback
  static handleImplicitCallback(accessToken: string, urlParams: URLSearchParams): void {
    const error = urlParams.get('error');
    if (error) {
      const desc = urlParams.get('error_description');
      throw new Error(`Authentication failed: ${error} - ${desc}`);
    }

    if (!accessToken) throw new Error('No access token received');

    this.accessToken = accessToken;
    const expiresIn = urlParams.get('expires_in');
    localStorage.setItem('ms_access_token', accessToken);

    const expirationTime = expiresIn
      ? Date.now() + parseInt(expiresIn) * 1000
      : Date.now() + 60 * 60 * 1000;
    localStorage.setItem('ms_token_expires', expirationTime.toString());
  }

  // Refresh access token using refresh token
  private static async refreshAccessToken(): Promise<boolean> {
    if (!this.config || !this.refreshToken) return false;

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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.accessToken = data.access_token;
      if (data.refresh_token) this.refreshToken = data.refresh_token;

      localStorage.setItem('ms_access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('ms_refresh_token', data.refresh_token);
      localStorage.setItem(
        'ms_token_expires',
        (Date.now() + data.expires_in * 1000).toString()
      );

      return true;
    } catch {
      return false;
    }
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    this.loadStoredTokens();
    if (this.accessToken) {
      const expiresAt = localStorage.getItem('ms_token_expires');
      if (!expiresAt || Date.now() < parseInt(expiresAt)) return true;

      this.logout();
    }
    return false;
  }

  // Ensure we have a valid access token
  private static async ensureValidToken(): Promise<boolean> {
    if (!this.config) throw new Error('Microsoft service not configured.');

    if (this.isAuthenticated()) return true;

    if (this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) return true;
    }

    this.initiateLogin();
    throw new Error('Authentication required - redirecting to Microsoft login');
  }

  // Upload invoice file to OneDrive
  static async uploadInvoiceToOneDrive(invoice: any, file: Blob): Promise<OneDriveUploadResult> {
    try {
      const hasValidToken = await this.ensureValidToken();
      if (!hasValidToken) {
        return { success: false, error: 'Authentication required. Please connect to OneDrive first.' };
      }

      const { SettingsService } = await import('./settingsService');
      const settings = await SettingsService.getSettings();
      const invoiceDirectory = settings.onedrive.invoiceDirectory;

      const sanitizedCustomerName = invoice.customer_name.replace(/[^a-zA-Z0-9]/g, '');
      const fileExtension = invoice.file_type === 'pdf' ? 'pdf' : 'jpg';
      const fileName = `${sanitizedCustomerName}-Receipt-${invoice.invoice_date}.${fileExtension}`;

      await this.ensureInvoicesFolderExists(invoiceDirectory);

      const uploadResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${invoiceDirectory}/${fileName}:/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': invoice.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg',
          },
          body: file,
        }
      );

      if (!uploadResponse.ok) {
        if (uploadResponse.status === 401) this.logout();
        throw new Error(`Failed to upload to OneDrive: ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();

      const shareResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${uploadData.id}/createLink`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'view', scope: 'anonymous' }),
        }
      );

      let shareUrl = uploadData.webUrl;
      if (shareResponse.ok) {
        const shareData = await shareResponse.json();
        shareUrl = shareData.link.webUrl;
      }

      await this.appendToExcel({ ...invoice, onedrive_file_url: shareUrl });

      return { success: true, fileUrl: shareUrl };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // --- Folder helpers ---
  private static async ensureInvoicesFolderExists(folderPath = 'Invoices'): Promise<void> {
    const checkResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );

    if (checkResponse.status === 404) await this.createFolderPath(folderPath);
  }

  private static async createFolderPath(folderPath: string): Promise<void> {
    const parts = folderPath.split('/').filter(Boolean);
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      const checkResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${currentPath}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (checkResponse.status === 404) {
        await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${currentPath}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
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
  }

  // --- Excel sync (append/update) ---
  static async appendToExcel(invoiceData: any): Promise<void> {
    return this.syncToExcel(invoiceData, 'append');
  }

  static async updateInExcel(invoiceData: any): Promise<void> {
    return this.syncToExcel(invoiceData, 'update');
  }

  private static async syncToExcel(invoiceData: any, operation: 'append' | 'update'): Promise<void> {
    const hasValidToken = await this.ensureValidToken();
    if (!hasValidToken) throw new Error('Authentication required');

    const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    const excelFileName = settings.onedrive?.excelFileName || 'Invoice_Tracker.xlsx';

    const excelFileId = await this.ensureExcelFileExists(excelFileName);
    await this.ensureExcelTableExists(excelFileId);

    const fileName = this.createDisplayFileName(invoiceData);

    const rowData = [
      invoiceData.sequence_id,
      invoiceData.customer_name,
      invoiceData.invoice_date,
      invoiceData.description_category === 'Other'
        ? invoiceData.description_other
        : invoiceData.description_category,
      invoiceData.invoice_amount,
      invoiceData.onedrive_file_url
        ? `=HYPERLINK("${invoiceData.onedrive_file_url}","${fileName}")`
        : fileName,
    ];

    if (operation === 'update') {
      const updated = await this.updateExistingRow(excelFileId, invoiceData, rowData);
      if (!updated) await this.appendRowToExcel(excelFileId, rowData);
    } else {
      const exists = await this.findExistingRow(excelFileId, invoiceData);
      if (exists) throw new Error('Invoice already exists in Excel');
      await this.appendRowToExcel(excelFileId, rowData);
    }
  }

private static async updateExistingRow(
  fileId: string,
  tableName: string,
  invoice: any,
  rowIndex: number
): Promise<void> {
  // Format date for Excel: YYYY-MMM-DD
  const formattedDate = invoice.date
    ? new Date(invoice.date).toISOString().split("T")[0]
    : "";

  // Build row values
  const rowValues = [
    invoice.number || "",
    invoice.customerName || "",
    formattedDate,
    invoice.amount?.toFixed(2) || "0.00",
    invoice.fileName || "",  // filename instead of URL
    invoice.status || ""
  ];

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows/itemAt(index=${rowIndex})`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update row: ${await response.text()}`);
  }
}
  

  private static createDisplayFileName(invoiceData: any): string {
    const sanitizedCustomerName = invoiceData.customer_name.replace(/[^a-zA-Z0-9]/g, '');
    const fileExtension = invoiceData.file_type === 'pdf' ? 'pdf' : 'jpg';
    return `${sanitizedCustomerName}-Receipt-${invoiceData.invoice_date}.${fileExtension}`;
  }

private static async ensureExcelFileExists(fileName: string): Promise<string> {
  // Search for file in OneDrive root
  const searchResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${fileName}')`,
    { headers: { Authorization: `Bearer ${this.accessToken}` } }
  );

  if (!searchResponse.ok) {
    throw new Error(`Failed to search Excel file: ${await searchResponse.text()}`);
  }

  const searchData = await searchResponse.json();
  const existingFile = searchData.value.find((f: any) => f.name === fileName);

  if (existingFile) {
    return existingFile.id;
  }

  // If not found, create a new empty workbook
  const createResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root/children`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: fileName,
        file: {},
        '@microsoft.graph.conflictBehavior': 'replace'
      })
    }
  );

  if (!createResponse.ok) {
    throw new Error(`Failed to create Excel file: ${await createResponse.text()}`);
  }

  const createdFile = await createResponse.json();
  return createdFile.id;
}
  
  
  // --- Table creation (clean, no borders) ---
  private static async ensureExcelTableExists(fileId: string): Promise<void> {
    const worksheetsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const worksheetsData = await worksheetsResponse.json();
    const worksheetName = worksheetsData.value[0]?.name || 'Sheet1';

    const tablesListResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const tablesData = await tablesListResponse.json();
    const existingTable = tablesData.value.find((t: any) => t.name === 'Table1');

    if (existingTable) return;

    const tableResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${worksheetName}/tables/add`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: 'A1:F1', hasHeaders: true, name: 'Table1' }),
      }
    );

    if (!tableResponse.ok) throw new Error(`Failed to create Excel table: ${await tableResponse.text()}`);

    await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/Table1/headerRowRange`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [['ID', 'Customer Name', 'Invoice Date', 'Description', 'Amount', 'OneDrive Link']],
        }),
      }
    );
  }

  // --- Logout ---
  static logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('ms_access_token');
    localStorage.removeItem('ms_refresh_token');
    localStorage.removeItem('ms_token_expires');
  }
}

