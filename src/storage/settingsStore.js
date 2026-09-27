import { dbGet, dbPut } from './db.js';

export const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
  haptics: true,
  showTimer: true,
  reducedMotion: false,
  placementAssist: true,
  confirmReset: true,
};

export async function getSettings() {
  const row = await dbGet('settings', 'app');
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

export async function saveSettings(settings) {
  const value = { ...DEFAULT_SETTINGS, ...settings };
  await dbPut('settings', { key: 'app', value });
  return value;
}
