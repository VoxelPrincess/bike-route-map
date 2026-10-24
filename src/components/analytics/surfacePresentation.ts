const ALIASES: Record<string, string> = {
  earth: 'ground',
  bare_ground: 'ground',
  soil: 'ground',
  stone: 'rock',
  bedrock: 'rock',
  unhewn_cobblestone: 'cobblestone',
  metal_grate: 'metal',
  boardwalk: 'wood',
  compacted_gravel: 'compacted',
  grass_paver: 'grass',
  paving_stone: 'paving_stones',
  woodchips: 'wood',
  wood_chips: 'wood',
  pebble_stone: 'pebblestone',
  pebbles: 'pebblestone',
  pebble: 'pebblestone',
};

const COLORS: Record<string, string> = {
  asphalt: '#2f2f33',
  rock: '#56657a',
  gravel: '#8c5a2b',
  fine_gravel: '#b79a80',
  compacted: '#c7b08b',
  dirt: '#8a4b27',
  ground: '#cdb793',
  sand: '#e6cfa4',
  unpaved: '#e4e9ee',
  paved: '#cfd4da',
  concrete: '#d9dee4',
  concrete_plates: '#d9dee4',
  paving_stones: '#9aa4b2',
  cobblestone: '#6b7280',
  sett: '#444c57',
  grass: '#6fb26a',
  mud: '#6b3f2b',
  wood: '#c89e6a',
  metal: '#b8c6d6',
  ice: '#cfe9ff',
  snow: '#ffffff',
  pebblestone: '#b79269',
  unknown: '#cfd6df',
};

const DISPLAY_NAMES: Record<string, string> = {
  compacted_gravel: 'Compacted gravel',
  fine_gravel: 'Fine gravel',
  paving_stones: 'Paving stones',
  concrete_plates: 'Concrete plates',
  woodchips: 'Wood chips',
  wood_chips: 'Wood chips',
  grass_paver: 'Grass paver',
  pebblestone: 'Pebblestone',
};

export function surfaceKey(surface: string): string {
  const normalized = surface.trim().toLowerCase().replace(/[:\s-]+/g, '_');
  return ALIASES[normalized] ?? normalized;
}

export function surfaceLabel(surface: string): string {
  const normalized = surface.trim().toLowerCase().replace(/[:\s-]+/g, '_');
  const key = surfaceKey(surface);
  return DISPLAY_NAMES[normalized] ?? DISPLAY_NAMES[key]
    ?? key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function surfaceColor(surface: string): string {
  return COLORS[surfaceKey(surface)] ?? COLORS.unknown;
}

export function surfaceDashArray(surface: string): string | undefined {
  return surfaceKey(surface) === 'unknown' ? '5 6' : undefined;
}
