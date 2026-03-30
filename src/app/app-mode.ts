export type AppMode = 'cafe' | 'flower_demo';

export function getAppMode(): AppMode {
  const rawMode = String(import.meta.env.VITE_APP_MODE || 'cafe').trim().toLowerCase();

  if (rawMode === 'flower_demo') {
    return 'flower_demo';
  }

  return 'cafe';
}

export function isFlowerDemoMode(): boolean {
  return getAppMode() === 'flower_demo';
}
