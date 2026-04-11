/**
 * User permissions helpers.
 * Only Eduardo (administration@toplintecinc.com) can see cost prices and profit margins.
 * All other users see sale prices only.
 */

const COST_VIEWER_EMAILS = [
  'administration@toplintecinc.com',
  'danielabrego95@gmail.com',
];

export function canViewCosts(email: string | null | undefined): boolean {
  if (!email) return false;
  return COST_VIEWER_EMAILS.includes(email.toLowerCase().trim());
}
