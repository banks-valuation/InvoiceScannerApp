import { supabase } from '../lib/supabaseClient';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

export class SettingsService {
  private static readonly SETTINGS_KEY = 'app_settings'; // Keep for migration fallback
  private static cachedSettings: AppSettings | null = null;

  static async getSettings(user?: any): Promise<AppSettings> {
    // Return cached settings immediately if available
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      // For Microsoft auth, we need to use the Microsoft user ID
      const msUserId = user?.id;
      
      if (!msUserId) {
        // If not authenticated, fall back to localStorage
        const localSettings = this.getLocalSettings();
        this.cachedSettings = localSettings;
        return localSettings;
      }

      // Try to get settings from database with timeout
      const dbPromise = supabase
        .from('user_settings')
        .select('settings')
        .eq('ms_user_id', msUserId)
        .maybeSingle()
        .then(result => ({ result, timeout: false }))
        .catch(err => ({ error: err, timeout: false }));

      const dbTimeoutPromise = new Promise(resolve =>
        setTimeout(() => resolve({ timeout: true }), 15000)
      );

      const dbResult = await Promise.race([dbPromise, dbTimeoutPromise]) as any;

      if (dbResult.timeout) {
        console.warn('Database query timed out, falling back to localStorage');
        const localSettings = this.getLocalSettings();
        this.cachedSettings = localSettings;
        return localSettings;
      }

      if (dbResult.error) {
        console.error('Error fetching settings from database:', dbResult.error);
        const localSettings = this.getLocalSettings();
        this.cachedSettings = localSettings;
        return localSettings;
      }

      const { data, error } = dbResult.result;

      if (error) {
        console.error('Error fetching settings from database:', error);
        const localSettings = this.getLocalSettings();
        this.cachedSettings = localSettings;
        return localSettings;
      }

      if (data?.settings) {
        // Merge with defaults to ensure all properties exist
        const dbSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings,
          onedrive: {
            ...DEFAULT_SETTINGS.onedrive,
            ...data.settings.onedrive,
          },
          general: {
            ...DEFAULT_SETTINGS.general,
            ...data.settings.general,
          },
        };

        this.cachedSettings = dbSettings;
        return dbSettings;
      }

      // No settings found in database, check localStorage for migration
      const localSettings = this.getLocalSettings();
      if (localSettings !== DEFAULT_SETTINGS) {
        // Migrate localStorage settings to database
        try {
          await this.saveSettings(localSettings);
        } catch (migrationError) {
          console.warn('Settings migration failed:', migrationError);
        }
        return localSettings;
      }

      this.cachedSettings = DEFAULT_SETTINGS;
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error in getSettings:', error);
      const localSettings = this.getLocalSettings();
      this.cachedSettings = localSettings;
      return localSettings;
    }
  }

  static async saveSettings(settings: AppSettings): Promise<void> {
    try {
      // Get current Microsoft user
      const { MicrosoftService } = await import('./microsoftService');
      const currentUser = MicrosoftService.getCurrentUser();
      
      if (!currentUser) {
        this.saveLocalSettings(settings);
        return;
      }

      // First, try to find existing settings by ms_user_id
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('id, user_id')
        .eq('ms_user_id', currentUser.id)
        .maybeSingle();

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: existingSettings?.user_id || currentUser.id, // Use existing user_id or fallback to ms_user_id
          ms_user_id: currentUser.id,
          settings: settings,
        }, {
          onConflict: 'ms_user_id'
        });

      if (error) {
        console.error('Error saving settings to database:', error);
        this.saveLocalSettings(settings);
        throw new Error('Failed to save settings to database');
      }

      this.cachedSettings = settings;
      this.saveLocalSettings(settings);
    } catch (error) {
      console.error('Error in saveSettings:', error);
      this.saveLocalSettings(settings);
      throw error;
    }
  }

  static async resetSettings(): Promise<void> {
    try {
      // Get current Microsoft user
      const { MicrosoftService } = await import('./microsoftService');
      const currentUser = MicrosoftService.getCurrentUser();

      if (currentUser) {
        const { error } = await supabase
          .from('user_settings')
          .delete()
          .eq('ms_user_id', currentUser.id);

        if (error) {
          console.error('Error deleting settings from database:', error);
        }
      }

      this.cachedSettings = null;
      localStorage.removeItem(this.SETTINGS_KEY);
    } catch (error) {
      console.error('Error in resetSettings:', error);
      localStorage.removeItem(this.SETTINGS_KEY);
    }
  }

  static async updateOneDriveSettings(oneDriveSettings: Partial<AppSettings['onedrive']>): Promise<void> {
    const currentSettings = await this.getSettings();
    const updatedSettings: AppSettings = {
      ...currentSettings,
      onedrive: {
        ...currentSettings.onedrive,
        ...oneDriveSettings,
      },
    };
    await this.saveSettings(updatedSettings);
  }

  static async updateGeneralSettings(generalSettings: Partial<AppSettings['general']>): Promise<void> {
    const currentSettings = await this.getSettings();
    const updatedSettings: AppSettings = {
      ...currentSettings,
      general: {
        ...currentSettings.general,
        ...generalSettings,
      },
    };
    await this.saveSettings(updatedSettings);
  }

  // Helper methods for localStorage fallback
  private static getLocalSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          onedrive: {
            ...DEFAULT_SETTINGS.onedrive,
            ...parsed.onedrive,
          },
          general: {
            ...DEFAULT_SETTINGS.general,
            ...parsed.general,
          },
        };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private static saveLocalSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }

  static clearCache(): void {
    this.cachedSettings = null;
  }
}
