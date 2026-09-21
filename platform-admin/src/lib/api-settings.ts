// Global configuration registry client — GET /api/platform/settings and
// PUT (flags.write + fresh re-auth). Values are validated server-side against
// the registry bounds; the shapes here mirror config/platformSettingsRegistry.js.
import { http } from './api';

export type SettingType = 'integer' | 'stringList';
export type SettingValue = number | string[];

export interface SettingBounds {
  min?: number;
  max?: number;
  allowlist?: string[];
}

export interface PlatformSetting {
  key: string;
  group: string;
  label: string;
  description: string;
  type: SettingType;
  editable: boolean;
  default: SettingValue;
  bounds: SettingBounds | null;
  value: SettingValue;
  overridden: boolean;
}

export interface SettingUpdate {
  key: string;
  /** `null` clears the override (back to the code default). */
  value: SettingValue | null;
}

export const settingsApi = {
  get: async () => {
    const res = await http.get('/settings');
    return res.data.data as { settings: PlatformSetting[] };
  },
  update: async (updates: SettingUpdate[], reason: string) => {
    const res = await http.put('/settings', { updates, reason });
    return res.data.data as { settings: PlatformSetting[] };
  },
};
