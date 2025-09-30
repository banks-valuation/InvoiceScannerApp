import { supabase } from '../lib/supabaseClient';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

export class SettingsService {
  private static readonly SETTINGS_KEY = 'app_settings'; // Keep for migration fallback
  private static cachedSettings: AppSettings | null = null;

  static async getSettings(user?: any): Promise<AppSettings> {
    // Return cached settings immediately if available
    if (this.cachedSettings) {
      console.log('Returning cached settings');
      return this.cachedSettings;
    }

    console.log('Loading settings from database...');

    try {
      let currentUser = user;

      // Only check authentication if user not provided
      if (!currentUser) {
        console.log('No user provided, checking authentication...');
        const authPromise = supabase.auth.getUser()
          .then(result => ({ result, timeout: false }))
          .catch(err => ({ error: err, timeout: false }));

        const authTimeoutPromise = new Promise(resolve =>
          setTimeout(() => resolve({ timeout: true }), 15000)
        );

        const authResult = await Promise.race([authPromise, authTimeoutPromise]) as any;

        if (authResult.timeout) {
          console.warn('Authentication check timed out, falling back to localStorage');
          const localSettings = this.getLocalSettings();
          this.cachedSettings = localSettings;
          return localSettings;
        }

        if (authResult.error) {
          if (authResult.error.message === 'Auth session missing!') {
            console.log('No auth session, using localStorage settings');
            const localSettings = this.getLocalSettings();
            this.cachedSettings = localSettings;
            return localSettings;
          }
          console.error('Auth error when fetching settings:', authResult.error);
          const localSettings = this.getLocalSettings();
          this.cachedSettings = localSettings;
          return localSettings;
        }

        currentUser = authResult.result?.data?.user;
      }

      if (!currentUser) {
        console.log('No authenticated user found, using localStorage settings');
        // If not authenticated, fall back to localStorage
        const localSettings = this.getLocalSettings();
        this.cachedSettings = localSettings;
        return localSettings;
      }

      console.log('Authenticated user found, fetching from database:', currentUser.id);

      // Try to get settings from database with timeout
      const dbPromise = supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', currentUser.id)
        .maybeSingle()
        .then(result => ({ result, timeout: false }))
        .catch(err => ({ error: err, timeout: false }));

      const dbTimeoutPromise = new Promise(resolve =>
        setTimeout(() => resolve({ timeout: true }), 8000)
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
        console.log('Settings found in database:', data.settings);
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
        // Also save to localStorage as backup
        this.saveLocalSettings(dbSettings);
        return dbSettings;
      }

      console.log('No settings found in database, checking localStorage for migration');
      // No settings found in database, check localStorage for migration
      const localSettings = this.getLocalSettings();
      if (localSettings !== DEFAULT_SETTINGS) {
        console.log('Migrating localStorage settings to database');
        // Migrate localStorage settings to database
        try {
          await this.saveSettings(localSettings);
          console.log('Settings migration successful');
        } catch (migrationError) {
          console.warn('Settings migration failed:', migrationError);
        }
        this.cachedSettings = localSettings;
        return localSettings;
      }

      console.log('Using default settings');
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
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) {
        if (authError.message === 'Auth session missing!') {
          console.log('No auth session, saving settings locally');
          this.saveLocalSettings(settings);
          return;
        }
        throw authError;
      }

      const user = data?.user;
      if (!user) {
        this.saveLocalSettings(settings);
        return;
      }

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
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) {
        if (authError.message === 'Auth session missing!') {
          console.log('No auth session, clearing local settings only');
          localStorage.removeItem(this.SETTINGS_KEY);
          this.cachedSettings = null;
          return;
        }
        throw authError;
      }

      const user = data?.user;

      if (user) {
        const { error } = await supabase
          .from('user_settings')
          .delete()
          .eq('user_id', user.id);

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
