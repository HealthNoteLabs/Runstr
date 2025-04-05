import { describe, it, expect } from 'vitest';
import {
  formatTime,
  displayDistance,
  formatElevation,
  formatDate,
  formatPace,
  convertDistance,
  formatPaceWithUnit
} from '../utils/formatters';

describe('Formatters Utility Functions', () => {
  describe('formatTime', () => {
    it('formats seconds into HH:MM:SS format', () => {
      expect(formatTime(0)).toBe('00:00:00');
      expect(formatTime(30)).toBe('00:00:30');
      expect(formatTime(60)).toBe('00:01:00');
      expect(formatTime(90)).toBe('00:01:30');
      expect(formatTime(3600)).toBe('01:00:00');
      expect(formatTime(3661)).toBe('01:01:01');
      expect(formatTime(86400)).toBe('24:00:00'); // 1 day
    });

    it('handles decimal seconds by rounding to nearest integer', () => {
      expect(formatTime(60.4)).toBe('00:01:00');
      expect(formatTime(60.6)).toBe('00:01:00');
    });
  });

  describe('displayDistance', () => {
    it('formats meters to kilometers with 2 decimal places', () => {
      expect(displayDistance(0)).toBe('0.00 km');
      expect(displayDistance(1000)).toBe('1.00 km');
      expect(displayDistance(1500)).toBe('1.50 km');
      expect(displayDistance(1532)).toBe('1.53 km');
      expect(displayDistance(10000)).toBe('10.00 km');
    });

    it('formats meters to miles when unit is "mi"', () => {
      expect(displayDistance(0, 'mi')).toBe('0.00 mi');
      expect(displayDistance(1609.344, 'mi')).toBe('1.00 mi');
      expect(displayDistance(3218.688, 'mi')).toBe('2.00 mi');
      expect(displayDistance(8046.72, 'mi')).toBe('5.00 mi');
    });

    it('handles invalid values gracefully', () => {
      expect(displayDistance(NaN)).toBe('0.00 km');
      expect(displayDistance(-10)).toBe('0.00 km');
      expect(displayDistance(null)).toBe('0.00 km');
      expect(displayDistance(undefined)).toBe('0.00 km');
    });
  });

  describe('formatElevation', () => {
    it('formats elevation in meters for metric system', () => {
      expect(formatElevation(100)).toBe('100 m');
      expect(formatElevation(123.6)).toBe('124 m'); // rounds to nearest integer
    });

    it('formats elevation in feet for imperial system', () => {
      expect(formatElevation(1, 'mi')).toBe('3 ft'); // 1m ≈ 3.28ft
      expect(formatElevation(100, 'mi')).toBe('328 ft');
    });

    it('handles invalid values gracefully', () => {
      expect(formatElevation(null)).toBe('-- ');
      expect(formatElevation(undefined)).toBe('-- ');
      expect(formatElevation(NaN)).toBe('-- ');
      expect(formatElevation(0)).toBe('-- ');
    });
  });

  describe('formatDate', () => {
    it('formats date strings to localized date format', () => {
      const mockDate = new Date('2023-06-15');
      const expectedFormat = mockDate.toLocaleDateString();
      expect(formatDate('2023-06-15')).toBe(expectedFormat);
    });

    it('handles invalid dates by returning current date', () => {
      expect(formatDate('invalid-date')).not.toBe('');
      expect(formatDate(null)).not.toBe('');
      expect(formatDate(undefined)).not.toBe('');
    });

    it('handles future dates by returning current date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expect(formatDate(futureDate.toISOString())).not.toBe('');
    });
  });

  describe('formatPace', () => {
    it('formats pace to MM:SS format for kilometers', () => {
      expect(formatPace(5)).toBe('5:00 min/km');
      expect(formatPace(5.5)).toBe('5:30 min/km');
      expect(formatPace(6.25)).toBe('6:15 min/km');
    });

    it('formats pace to MM:SS format for miles when unit is "mi"', () => {
      expect(formatPace(8, 'mi')).toBe('8:00 min/mi');
      expect(formatPace(8.75, 'mi')).toBe('8:45 min/mi');
    });

    it('handles invalid values gracefully', () => {
      expect(formatPace(0)).toBe('-- min/km');
      expect(formatPace(Infinity)).toBe('-- min/km');
      expect(formatPace(null)).toBe('-- min/km');
      expect(formatPace(undefined)).toBe('-- min/km');
    });
  });

  describe('convertDistance', () => {
    it('converts meters to kilometers', () => {
      expect(convertDistance(0, 'km')).toBe('0.00');
      expect(convertDistance(1000, 'km')).toBe('1.00');
      expect(convertDistance(1500, 'km')).toBe('1.50');
      expect(convertDistance(10000, 'km')).toBe('10.00');
    });

    it('converts meters to miles', () => {
      expect(convertDistance(0, 'mi')).toBe('0.00');
      expect(convertDistance(1609.344, 'mi')).toBe('1.00');
      expect(convertDistance(8046.72, 'mi')).toBe('5.00');
    });

    it('throws error for invalid inputs', () => {
      expect(() => convertDistance(-10, 'km')).toThrow();
      expect(() => convertDistance(1000, 'invalid-unit')).toThrow();
    });
  });

  describe('formatPaceWithUnit', () => {
    it('formats pace with unit properly', () => {
      expect(formatPaceWithUnit(5)).toBe('5:00 min/km min/km');
      expect(formatPaceWithUnit(6, 'mi')).toBe('6:00 min/mi min/mi');
    });
  });
}); 