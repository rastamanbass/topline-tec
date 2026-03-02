export const MARGIN_THRESHOLDS = {
  healthy: 18,     // >= 18% es saludable
  acceptable: 12,  // >= 12% es aceptable, < 12% es bajo
} as const;

export const ACCESSORIES_MARGIN_THRESHOLDS = {
  healthy: 30,
  acceptable: 15,
} as const;
