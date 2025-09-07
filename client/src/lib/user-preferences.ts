import { LocalSongStorage } from './local-song-storage';

export interface MetronomePreferences {
  bpm: string;
  countIn: boolean;
  metronomeOn: boolean;
  wholeSong: boolean;
}

export class UserPreferences {
  private static getPreferencesKey(userEmail: string): string {
    return `user_preferences_${userEmail}`;
  }

  static getMetronomePreferences(userEmail: string): MetronomePreferences {
    try {
      const stored = localStorage.getItem(this.getPreferencesKey(userEmail));
      if (stored) {
        return JSON.parse(stored);
      }
      return {
        bpm: "120.0000",
        countIn: false,
        metronomeOn: false,
        wholeSong: false,
      };
    } catch (error) {
      console.error('Error loading user preferences:', error);
      return {
        bpm: "120.0000",
        countIn: false,
        metronomeOn: false,
        wholeSong: false,
      };
    }
  }

  static saveMetronomePreferences(userEmail: string, preferences: MetronomePreferences): void {
    try {
      localStorage.setItem(this.getPreferencesKey(userEmail), JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  }
}