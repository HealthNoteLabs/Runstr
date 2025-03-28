import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertDistance, formatPace, displayDistance } from '../utils/formatters';

// Constants for conversion testing
const KM_TO_MI = 0.621371;
const M_TO_FT = 3.28084;

describe('Run Tracker Unit Consistency Tests', () => {
  // Set up storage for tests
  let runHistory = [];
  let distanceUnit = 'km'; // Default unit
  
  beforeEach(() => {
    // Clear storage and mocks
    localStorage.clear();
    runHistory = [];
    
    // Mock localStorage
    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;
    
    localStorage.getItem = vi.fn((key) => {
      if (key === 'runHistory') {
        return JSON.stringify(runHistory);
      }
      if (key === 'distanceUnit') {
        return distanceUnit;
      }
      return originalGetItem.call(localStorage, key);
    });
    
    localStorage.setItem = vi.fn((key, value) => {
      if (key === 'runHistory') {
        runHistory = JSON.parse(value);
      }
      if (key === 'distanceUnit') {
        distanceUnit = value;
      }
      originalSetItem.call(localStorage, key, value);
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should maintain consistent data storage regardless of display unit', () => {
    // Create a standard 5km run
    const run5km = {
      id: 'run-5km',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 5000, // Always stored in meters regardless of display unit
      duration: 1800, // 30 minutes
      pace: 6, // 6 min/km
      elevation: { gain: 100, loss: 80 }
    };
    
    // Save with default km units
    distanceUnit = 'km';
    localStorage.setItem('distanceUnit', distanceUnit);
    runHistory.push(run5km);
    localStorage.setItem('runHistory', JSON.stringify(runHistory));
    
    // Convert to imperial units
    distanceUnit = 'mi';
    localStorage.setItem('distanceUnit', distanceUnit);
    
    // Get run history
    const storedRuns = JSON.parse(localStorage.getItem('runHistory'));
    
    // Verify data was not altered by unit change
    expect(storedRuns.length).toBe(1);
    expect(storedRuns[0].distance).toBe(5000); // Still in meters
    expect(storedRuns[0].duration).toBe(1800); // Time is universal
    
    // Test distance conversion consistency
    const kmDistance = convertDistance(storedRuns[0].distance, 'km');
    const miDistance = convertDistance(storedRuns[0].distance, 'mi');
    
    // Verify conversion correctness
    expect(parseFloat(kmDistance)).toBeCloseTo(5.0, 1);
    expect(parseFloat(miDistance)).toBeCloseTo(5.0 * KM_TO_MI, 1); // ~3.11 miles
    
    // Verify elevation conversion
    const elevMeters = storedRuns[0].elevation.gain;
    const elevFeet = elevMeters * M_TO_FT;
    
    expect(elevMeters).toBe(100);
    expect(elevFeet).toBeCloseTo(328.08, 1);
  });
  
  it('should handle unit switching during an active run', () => {
    // Mock run tracker with a partial run
    const mockRunTracker = {
      isTracking: true,
      distance: 2500, // 2.5km in meters
      duration: 900, // 15 minutes
      pace: 6, // 6 min/km
      elevation: { gain: 50, loss: 30 }
    };
    
    // Start with km units
    distanceUnit = 'km';
    localStorage.setItem('distanceUnit', distanceUnit);
    
    // Verify metric display formats
    const kmDistance = convertDistance(mockRunTracker.distance, distanceUnit);
    expect(parseFloat(kmDistance)).toBeCloseTo(2.5, 1);
    
    // Switch to miles mid-run
    distanceUnit = 'mi';
    localStorage.setItem('distanceUnit', distanceUnit);
    
    // Verify imperial display formats
    const miDistance = convertDistance(mockRunTracker.distance, distanceUnit);
    expect(parseFloat(miDistance)).toBeCloseTo(2.5 * KM_TO_MI, 1); // ~1.55 miles
    
    // Add more distance with imperial units
    mockRunTracker.distance += 2500; // +2.5km
    mockRunTracker.duration += 900; // +15 minutes
    
    // Verify total distance in both systems
    const totalKm = convertDistance(mockRunTracker.distance, 'km');
    const totalMi = convertDistance(mockRunTracker.distance, 'mi');
    
    expect(parseFloat(totalKm)).toBeCloseTo(5.0, 1);
    expect(parseFloat(totalMi)).toBeCloseTo(5.0 * KM_TO_MI, 1); // ~3.11 miles
    
    // Verify pace calculation is consistent
    const kmPace = mockRunTracker.duration / 60 / (mockRunTracker.distance / 1000);
    const miPace = mockRunTracker.duration / 60 / (mockRunTracker.distance / 1609.344);
    
    expect(kmPace).toBeCloseTo(6, 1); // ~6 min/km
    expect(miPace).toBeCloseTo(6 * (1609.344 / 1000), 1); // ~9.66 min/mile (6 min/km * 1.609344)
  });
  
  it('should correctly apply units in pace calculations', () => {
    // Test case data for 10-minute kilometers vs miles
    const testCases = [
      {
        distance: 1000, // 1km in meters
        duration: 600, // 10 minutes
        expectedKmPace: 10, // 10 min/km
        expectedMiPace: 10 * (1609.344 / 1000) // ~16.09 min/mile
      },
      {
        distance: 1609.344, // 1 mile in meters
        duration: 600, // 10 minutes
        expectedKmPace: 10 * (1000 / 1609.344), // ~6.21 min/km
        expectedMiPace: 10 // 10 min/mile
      }
    ];
    
    testCases.forEach((testCase) => {
      // Test km pace calculation
      distanceUnit = 'km';
      const kmPace = testCase.duration / 60 / (testCase.distance / 1000);
      expect(kmPace).toBeCloseTo(testCase.expectedKmPace, 1);
      
      // Test mile pace calculation
      distanceUnit = 'mi';
      const miPace = testCase.duration / 60 / (testCase.distance / 1609.344);
      expect(miPace).toBeCloseTo(testCase.expectedMiPace, 1);
      
      // Verify pace formatting
      const formattedKmPace = formatPace(kmPace, 'km');
      const formattedMiPace = formatPace(miPace, 'mi');
      
      const kmPaceMinutes = Math.floor(testCase.expectedKmPace);
      // Track only minutes for the test to avoid issues with second precision
      
      const miPaceMinutes = Math.floor(testCase.expectedMiPace);
      // Track only minutes for the test to avoid issues with second precision
      
      // Verify formatted pace matches expected values
      expect(formattedKmPace).toContain(`${kmPaceMinutes}:`);
      expect(formattedKmPace).toContain('min/km');
      expect(formattedMiPace).toContain(`${miPaceMinutes}:`);
      expect(formattedMiPace).toContain('min/mi');
    });
  });
  
  it('should handle multiple runs with mixed units consistently', () => {
    // Create run history with runs done in different units
    const mixedRuns = [
      {
        id: 'km-run-1',
        date: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
        timestamp: Date.now() - 7 * 86400000,
        distance: 5000, // 5km
        duration: 1800, // 30 minutes
        pace: 6, // 6 min/km
        unitAtCreation: 'km',
        elevation: { gain: 100, loss: 80 }
      },
      {
        id: 'mi-run-1', 
        date: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
        timestamp: Date.now() - 5 * 86400000,
        distance: 8047, // 5 miles in meters
        duration: 2700, // 45 minutes
        pace: 9, // 9 min/mile (converted to seconds/meter internally)
        unitAtCreation: 'mi',
        elevation: { gain: 150, loss: 120 }
      },
      {
        id: 'km-run-2',
        date: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
        timestamp: Date.now() - 2 * 86400000,
        distance: 10000, // 10km
        duration: 3600, // 60 minutes
        pace: 6, // 6 min/km
        unitAtCreation: 'km',
        elevation: { gain: 200, loss: 180 }
      }
    ];
    
    // Save runs to history
    runHistory = mixedRuns;
    localStorage.setItem('runHistory', JSON.stringify(runHistory));
    
    // Test total distance calculation in kilometers
    distanceUnit = 'km';
    localStorage.setItem('distanceUnit', distanceUnit);
    
    const totalKmDistance = runHistory.reduce((sum, run) => sum + parseFloat(convertDistance(run.distance, 'km')), 0);
    const expectedKmTotal = 5 + (5 * 1.609344) + 10; // ~23.05km
    
    expect(totalKmDistance).toBeCloseTo(expectedKmTotal, 1);
    
    // Test total distance calculation in miles
    distanceUnit = 'mi';
    localStorage.setItem('distanceUnit', distanceUnit);
    
    const totalMiDistance = runHistory.reduce((sum, run) => sum + parseFloat(convertDistance(run.distance, 'mi')), 0);
    const expectedMiTotal = (5 * 0.621371) + 5 + (10 * 0.621371); // ~14.31 miles
    
    expect(totalMiDistance).toBeCloseTo(expectedMiTotal, 1);
    
    // Verify pace displays correctly for each unit system
    const run1KmPace = formatPace(mixedRuns[0].pace, 'km');
    const run2MiPace = formatPace(mixedRuns[1].pace, 'mi');
    
    expect(run1KmPace).toContain('min/km');
    expect(run2MiPace).toContain('min/mi');
  });
  
  it('should handle zero and extreme values consistently across units', () => {
    // Test edge cases like zero distance, very short distances, etc.
    const edgeCaseRuns = [
      {
        // Zero distance run (e.g., GPS failure)
        id: 'zero-distance',
        distance: 0,
        duration: 300, // 5 minutes
        pace: 0 // undefined pace
      },
      {
        // Very short run
        id: 'very-short',
        distance: 10, // 10 meters
        duration: 20, // 20 seconds
        pace: 33.33 // ~33:20 min/km (very slow pace for a very short distance)
      },
      {
        // Ultra-marathon
        id: 'ultra',
        distance: 100000, // 100km
        duration: 36000, // 10 hours
        pace: 6 // 6 min/km
      }
    ];
    
    // Test with km units
    distanceUnit = 'km';
    
    edgeCaseRuns.forEach(run => {
      // Zero distance should show as 0.00 in any unit
      if (run.id === 'zero-distance') {
        expect(convertDistance(run.distance, 'km')).toBe('0.00');
        expect(convertDistance(run.distance, 'mi')).toBe('0.00');
        expect(formatPace(run.pace, 'km')).toBe('-- min/km');
        expect(formatPace(run.pace, 'mi')).toBe('-- min/mi');
      }
      
      // Very short run should still convert correctly
      if (run.id === 'very-short') {
        expect(parseFloat(convertDistance(run.distance, 'km'))).toBeCloseTo(0.01, 2);
        // Lower precision for very small distances in miles due to rounding errors
        expect(parseFloat(convertDistance(run.distance, 'mi'))).toBeCloseTo(0.01 * KM_TO_MI, 2);
      }
      
      // Ultra distance should convert correctly
      if (run.id === 'ultra') {
        expect(parseFloat(convertDistance(run.distance, 'km'))).toBe(100);
        expect(parseFloat(convertDistance(run.distance, 'mi'))).toBeCloseTo(100 * KM_TO_MI, 1);
      }
    });
    
    // Test with imperial units
    distanceUnit = 'mi';
    
    // Re-check the same scenarios
    edgeCaseRuns.forEach(run => {
      // Verify unit display is correct
      const miDistance = displayDistance(run.distance, 'mi');
      expect(miDistance).toContain('mi');
      
      // Ultra distance with miles should show correctly
      if (run.id === 'ultra') {
        const formattedMiPace = formatPace(run.pace * (1000 / 1609.344), 'mi');
        expect(formattedMiPace).toContain('min/mi');
      }
    });
  });
}); 