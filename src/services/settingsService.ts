import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

export class SettingsService {
  private static readonly SETTINGS_KEY = 'app_settings';

  static getSettings(): AppSettings {
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

  static saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  static resetSettings(): void {
    localStorage.removeItem(this.SETTINGS_KEY);
  }

  static updateOneDriveSettings(oneDriveSettings: Partial<AppSettings['onedrive']>): void {
    const currentSettings = this.getSettings();
    const updatedSettings: AppSettings = {
      ...currentSettings,
      onedrive: {
        ...currentSettings.onedrive,
        ...oneDriveSettings,
      },
    };
    this.saveSettings(updatedSettings);
  }

  static updateGeneralSettings(generalSettings: Partial<AppSettings['general']>): void {
    const currentSettings = this.getSettings();
    const updatedSettings: AppSettings = {
      ...currentSettings,
      general: {
        ...currentSettings.general,
        ...generalSettings,
      },
    };
    this.saveSettings(updatedSettings);
  }
}