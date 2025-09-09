import { supabase } from '../lib/supabaseClient';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

export class SettingsService {
  private static readonly SETTINGS_KEY = 'app_settings'; // Keep for migration fallback
  private static cachedSettings: AppSettings | null = null;

  static async getSettings(): Promise<AppSettings> {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // If not authenticated, fall back to localStorage
        return this.getLocalSettings();
      }

      // Try to get settings from database
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings from database:', error);
        // Fall back to localStorage on error
        return this.getLocalSettings();
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
        await this.saveSettings(localSettings);
        return localSettings;
      }

      // Return defaults
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error in getSettings:', error);
      return this.getLocalSettings();
    }
  }

  static async saveSettings(settings: AppSettings): Promise<void> {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // If not authenticated, save to localStorage
        this.saveLocalSettings(settings);
        return;
      }

      // Save to database using upsert
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings: settings,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving settings to database:', error);
        // Fall back to localStorage on error
        this.saveLocalSettings(settings);
        throw new Error('Failed to save settings to database');
      }

      // Update cache
      this.cachedSettings = settings;

      // Also save to localStorage as backup
      this.saveLocalSettings(settings);
    } catch (error) {
      console.error('Error in saveSettings:', error);
      // Fall back to localStorage
      this.saveLocalSettings(settings);
      throw error;
    }
  }

  static async resetSettings(): Promise<void> {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Delete from database
        const { error } = await supabase
          .from('user_settings')
          .delete()
          .eq('user_id', user.id);

        if (error) {
          console.error('Error deleting settings from database:', error);
        }
      }

      // Clear cache
      this.cachedSettings = null;
      
      // Also clear localStorage
      localStorage.removeItem(this.SETTINGS_KEY);
    } catch (error) {
      console.error('Error in resetSettings:', error);
      // At least clear localStorage
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
        // Merge with defaults to ensure all properties exist
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

  // Clear cached settings when user signs out
  static clearCache(): void {
    this.cachedSettings = null;
  }
}