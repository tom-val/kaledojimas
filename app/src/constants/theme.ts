import '@/global.css';

/** One spooky palette — the app is always dark, it's a night-time thing. */
export const Colors = {
  background: '#0F0A1A',
  card: '#1C1330',
  cardBorder: '#2E2147',
  text: '#F6F1FF',
  textSecondary: '#B6A9CF',
  pumpkin: '#FF7A1A',
  danger: '#FF5A5F',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;

export const MaxPanelWidth = 520;

/** Vilnius — used until we know where the user is. */
export const DefaultCenter = { lat: 54.6872, lng: 25.2797 };
