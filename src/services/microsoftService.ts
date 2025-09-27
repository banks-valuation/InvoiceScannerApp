interface MicrosoftConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

interface UserProfile {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface OneDriveUploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
}

export class MicrosoftService {
  private static config: MicrosoftConfig | null = null;
  private static accessToken: string | null = null;
  private static refreshToken: string | null = null;
  private static tokenExpiry: number | null = null;
  private static userProfile: UserProfile | null = null;
  private static codeVerifier: string | null = null;

  static configure(config: MicrosoftConfig) {
    this.config = config;
    console.log('Microsoft service configured with client ID:', config.clientId);
    
    // Try to restore authentication state from localStorage
    this.restoreAuthState();
  }

  // PKCE helper functions
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

    console.log('Initiating Microsoft login with PKCE...');

    // Generate PKCE parameters
    this.codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);
    
    // Store code verifier for later use with multiple keys for redundancy
    localStorage.setItem('ms_code_verifier', this.codeVerifier);
    localStorage.setItem('pkce_code_verifier', this.codeVerifier);
    sessionStorage.setItem('ms_code_verifier', this.codeVerifier);

    // Generate state parameter for security
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('ms_pkce_state', state);
    sessionStorage.setItem('ms_pkce_state', state);

    const authUrl = new URL('https://login.microsoftonline.com/' + this.config.tenantId + '/oauth2/v2.0/authorize');
    
    authUrl.searchParams.append('client_id', this.config.clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.append('scope', this.config.scopes.join(' '));
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('response_mode', 'query');

    console.log('Redirecting to Microsoft login:', authUrl.toString());
    console.log('Stored code verifier:', this.codeVerifier.substring(0, 10) + '...');
    window.location.href = authUrl.toString();
  }

  static async handleAuthorizationCallback(code: string): Promise<void> {
    if (!this.config) {
      throw new Error('Microsoft service not configured');
    }

    // Prevent duplicate processing
    if (this.isAuthenticated()) {
      console.log('Already authenticated, skipping callback processing');
      return;
    }

    console.log('Processing authorization code with PKCE...');

    // Retrieve stored PKCE verifier and state (try multiple storage locations)
    let storedCodeVerifier = localStorage.getItem('ms_code_verifier') || 
                            localStorage.getItem('pkce_code_verifier') || 
                            sessionStorage.getItem('ms_code_verifier');
    
    let storedState = localStorage.getItem('ms_auth_state') || 
                     sessionStorage.getItem('ms_auth_state');
    let storedState = localStorage.getItem('ms_pkce_state') || 
                     sessionStorage.getItem('ms_pkce_state');

    console.log('Retrieved code verifier:', storedCodeVerifier ? storedCodeVerifier.substring(0, 10) + '...' : 'null');
    console.log('Retrieved state:', storedState ? 'present' : 'null');

    if (!storedCodeVerifier) {
      console.error('Code verifier not found in any storage location');
      // Try to get from class instance as fallback
      if (this.codeVerifier) {
        console.log('Using code verifier from class instance');
        storedCodeVerifier = this.codeVerifier;
      } else {
        throw new Error('Code verifier not found. Please try logging in again.');
      }
    }

    // Verify state parameter (basic CSRF protection)
    const urlParams = new URLSearchParams(window.location.search);
    const returnedState = urlParams.get('state');
    
    if (storedState && returnedState !== storedState) {
      throw new Error('State parameter mismatch. Possible CSRF attack.');
    }

    // Exchange authorization code for tokens using PKCE
    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    
    const tokenData = new URLSearchParams();
    tokenData.append('client_id', this.config.clientId);
    tokenData.append('grant_type', 'authorization_code');
    tokenData.append('code', code);
    tokenData.append('redirect_uri', this.config.redirectUri);
    tokenData.append('code_verifier', storedCodeVerifier);

    console.log('Exchanging code for tokens...');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Token exchange failed:', response.status, errorData);
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
    }

    const tokens: TokenResponse = await response.json();
    console.log('Tokens received successfully');

    // Store tokens
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token || null;
    this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);

    // Clean up temporary storage from all locations
    localStorage.removeItem('ms_code_verifier');
    localStorage.removeItem('pkce_code_verifier');
    localStorage.removeItem('ms_pkce_state');
    sessionStorage.removeItem('ms_code_verifier');
    sessionStorage.removeItem('ms_pkce_state');
    this.codeVerifier = null;

    // Persist authentication state
    this.saveAuthState();

    console.log('Microsoft authentication completed successfully');
  }

  static async fetchUserProfile(): Promise<UserProfile> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    console.log('Fetching user profile from Microsoft Graph...');

    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch user profile:', response.status, response.statusText);
      throw new Error(`Failed to fetch user profile: ${response.status} ${response.statusText}`);
    }

    const profile = await response.json();
    console.log('User profile fetched:', profile.displayName);

    this.userProfile = {
      id: profile.id,
      displayName: profile.displayName,
      mail: profile.mail || profile.userPrincipalName,
      userPrincipalName: profile.userPrincipalName,
    };

    // Save updated auth state with profile
    this.saveAuthState();

    return this.userProfile;
  }

  static isAuthenticated(): boolean {
    if (!this.accessToken || !this.tokenExpiry) {
      return false;
    }

    // Check if token is expired (with 5 minute buffer)
    const isExpired = Date.now() > (this.tokenExpiry - 5 * 60 * 1000);
    
    if (isExpired && this.refreshToken) {
      // Try to refresh token automatically
      this.refreshAccessToken().catch(error => {
        console.error('Auto token refresh failed:', error);
      });
      return false;
    }

    return !isExpired;
  }

  static getCurrentUser(): UserProfile | null {
    return this.userProfile;
  }

  static checkTokenValidity(): { isValid: boolean; expiresAt?: Date; timeRemaining?: number } {
    if (!this.tokenExpiry) {
      return { isValid: false };
    }

    const now = Date.now();
    const timeRemaining = this.tokenExpiry - now;
    const isValid = timeRemaining > 5 * 60 * 1000; // 5 minute buffer

    return {
      isValid,
      expiresAt: new Date(this.tokenExpiry),
      timeRemaining: Math.max(0, timeRemaining),
    };
  }

  private static async refreshAccessToken(): Promise<void> {
    if (!this.config || !this.refreshToken) {
      throw new Error('Cannot refresh token: missing configuration or refresh token');
    }

    console.log('Refreshing access token...');

    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    
    const tokenData = new URLSearchParams();
    tokenData.append('client_id', this.config.clientId);
    tokenData.append('grant_type', 'refresh_token');
    tokenData.append('refresh_token', this.refreshToken);
    tokenData.append('scope', this.config.scopes.join(' '));

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenData,
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status);
      this.logout();
      throw new Error('Token refresh failed');
    }

    const tokens: TokenResponse = await response.json();
    
    this.accessToken = tokens.access_token;
    if (tokens.refresh_token) {
      this.refreshToken = tokens.refresh_token;
    }
    this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);

    this.saveAuthState();
    console.log('Access token refreshed successfully');
  }

  private static saveAuthState(): void {
    try {
      const authState = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry,
        userProfile: this.userProfile,
      };
      localStorage.setItem('ms_auth_state', JSON.stringify(authState));
    } catch (error) {
      console.error('Failed to save auth state:', error);
    }
  }

  private static restoreAuthState(): void {
    try {
      const stored = localStorage.getItem('ms_auth_state');
      if (stored) {
        const authState = JSON.parse(stored);
        this.accessToken = authState.accessToken;
        this.refreshToken = authState.refreshToken;
        this.tokenExpiry = authState.tokenExpiry;
        this.userProfile = authState.userProfile;
        
        console.log('Restored authentication state for user:', this.userProfile?.displayName);
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error);
      this.logout();
    }
  }

  static logout(): void {
    console.log('Logging out from Microsoft...');
    
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.userProfile = null;
    this.codeVerifier = null;
    
    // Clear stored auth state
    localStorage.removeItem('ms_auth_state');
    localStorage.removeItem('ms_code_verifier');
    localStorage.removeItem('ms_auth_state');
  }

  // OneDrive and Excel integration methods (simplified for now)
  static async uploadInvoiceToOneDrive(invoice: any, file: Blob): Promise<OneDriveUploadResult> {
    // This would implement the actual OneDrive upload logic
    // For now, return a simulated success
    console.log('OneDrive upload would happen here for invoice:', invoice.id);
    return {
      success: true,
      fileUrl: `https://onedrive.com/simulated/${invoice.id}`,
    };
  }

  static async listExcelFiles(): Promise<Array<{ name: string; path: string }>> {
    // This would implement the actual Excel file listing
    console.log('Excel file listing would happen here');
    return [];
  }

  static async listFolders(path: string = ''): Promise<Array<{ name: string; path: string }>> {
    // This would implement the actual folder listing
    console.log('Folder listing would happen here for path:', path);
    return [];
  }

  static async listExcelFilesInPath(path: string = ''): Promise<Array<{ name: string; path: string }>> {
    // This would implement the actual Excel file listing in path
    console.log('Excel file listing in path would happen here for path:', path);
    return [];
  }

  static async deleteFileFromOneDrive(fileUrl: string): Promise<OneDriveUploadResult> {
    // This would implement the actual file deletion
    console.log('OneDrive file deletion would happen here for:', fileUrl);
    return { success: true };
  }

  static async removeFromExcel(invoice: any): Promise<OneDriveUploadResult> {
    // This would implement the actual Excel row removal
    console.log('Excel row removal would happen here for invoice:', invoice.id);
    return { success: true };
  }

  static async updateInExcel(invoice: any): Promise<void> {
    // This would implement the actual Excel update
    console.log('Excel update would happen here for invoice:', invoice.id);
  }

  static async appendToExcel(invoice: any): Promise<void> {
    // This would implement the actual Excel append
    console.log('Excel append would happen here for invoice:', invoice.id);
  }
}