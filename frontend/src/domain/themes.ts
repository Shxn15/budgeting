/**
 * Colour themes ("Farbthemen"). Stored in data.json as the key (settings.colorTheme).
 * Every theme has a light and a dark variant; light/dark itself is the
 * separate setting `settings.theme`. The colours live in styles/tokens.css
 * (`:root[data-palette='<key>']`), the preview colours below only draw the
 * little swatches in the settings.
 */
export const COLOR_THEMES = [
  {
    key: 'standard',
    label: 'Standard',
    description: 'Ruhiges Grau mit Indigo',
    preview: { light: ['#f3f4f8', '#ffffff', '#4f46e5'], dark: ['#0d1016', '#161a22', '#5b5ff0'] },
  },
  {
    key: 'rose',
    label: 'Babyrosa',
    description: 'Zartes Rosa mit Himbeere',
    preview: { light: ['#fcf0f4', '#fffbfc', '#c93a73'], dark: ['#170e13', '#22151c', '#c8417b'] },
  },
  {
    key: 'lavender',
    label: 'Lavendel',
    description: 'Flieder mit Violett',
    preview: { light: ['#f4f1fc', '#fffeff', '#7048d0'], dark: ['#110e1b', '#1b1729', '#7c55e0'] },
  },
  {
    key: 'mint',
    label: 'Mint',
    description: 'Frisches Mintgrün',
    preview: { light: ['#edf7f2', '#fdfffe', '#0f7a58'], dark: ['#0b1512', '#13201b', '#138562'] },
  },
  {
    key: 'peach',
    label: 'Pfirsich',
    description: 'Warmes Apricot',
    preview: { light: ['#fdf3ec', '#fffdfb', '#c0531f'], dark: ['#17100b', '#221812', '#bb5523'] },
  },
  {
    key: 'sky',
    label: 'Himmelblau',
    description: 'Leichtes Hellblau',
    preview: { light: ['#edf5fc', '#fdfeff', '#1a72bb'], dark: ['#0a121b', '#121c28', '#2878c4'] },
  },
] as const;

export type ColorThemeKey = (typeof COLOR_THEMES)[number]['key'];

export const DEFAULT_COLOR_THEME: ColorThemeKey = 'standard';

export function isColorTheme(value: unknown): value is ColorThemeKey {
  return typeof value === 'string' && COLOR_THEMES.some((t) => t.key === value);
}
