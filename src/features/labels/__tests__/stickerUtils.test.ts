import { describe, it, expect } from 'vitest';
import { buildTrackingUrl, formatStickerInfo, formatImeiDisplay } from '../utils/stickerUtils';

describe('stickerUtils', () => {
  describe('buildTrackingUrl', () => {
    it('generates portal URL with IMEI', () => {
      const url = buildTrackingUrl('356371101234567');
      expect(url).toContain('/phone/356371101234567');
    });
  });

  describe('formatStickerInfo', () => {
    it('formats modelo + storage', () => {
      expect(formatStickerInfo('iPhone 15 Pro Max', '256GB')).toBe('iPhone 15 Pro Max · 256GB');
    });
    it('omits storage if missing', () => {
      expect(formatStickerInfo('Galaxy S24', undefined)).toBe('Galaxy S24');
    });
  });

  describe('formatImeiDisplay', () => {
    it('groups 15-digit IMEI for readability', () => {
      expect(formatImeiDisplay('356371101234567')).toBe('35 637110 123456 7');
    });
    it('returns raw if not 15 digits', () => {
      expect(formatImeiDisplay('12345678')).toBe('12345678');
    });
  });
});
