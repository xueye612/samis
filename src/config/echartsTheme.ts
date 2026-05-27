export const qualityChartPalette = {
  primary: '#2563eb',
  secondary: '#14b8a6',
  accent: '#f97316',
  neutral: '#94a3b8',
  positive: '#16a34a',
  negative: '#dc2626',
};

export const anesthesiaChartPalette = {
  primary: '#2563eb',
  systolic: '#ef4444',
  diastolic: '#f97316',
  spo2: '#14b8a6',
  etco2: '#7c3aed',
  temperatureSafe: '#0d9488',
  temperatureRisk: '#dc2626',
  reserve: '#64748b',
  reserveAlt: '#eab308',
};

export const buildAxisStyle = () => ({
  axisLabel: { color: '#64748b' },
  splitLine: { lineStyle: { color: '#e2e8f0' } },
});

export const buildGrid = (overrides: Partial<Record<'left' | 'right' | 'top' | 'bottom' | 'containLabel', number | boolean>> = {}) => ({
  left: 48,
  right: 24,
  top: 42,
  bottom: 34,
  containLabel: true,
  ...overrides,
});
