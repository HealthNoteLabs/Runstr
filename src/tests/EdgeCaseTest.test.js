import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTime, convertDistance, formatPace } from '../utils/formatters';

// Mock RunDataService
const runDataService = {
  saveRun: vi.fn(),
  calculatePace: vi.fn()
};

describe('Run Tracker Edge Case Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    
    // Set up the calculatePace mock
    runDataService.calculatePace.mockImplementation((distance, duration, unit) => {
      if (!distance || distance === 0) return 0;
      // Return pace in minutes per unit (km or mi)
      const distanceInUnits = unit === 'km' ? distance / 1000 : distance / 1609.344;
      return duration / 60 / distanceInUnits;
    });
    
    // Set up the saveRun mock
    runDataService.saveRun.mockImplementation((run) => {
      const runs = JSON.parse(localStorage.getItem('runHistory') || '[]');
      runs.unshift(run);
      localStorage.setItem('runHistory', JSON.stringify(runs));
      return run;
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should handle extremely short runs correctly (< 10 seconds)', () => {
    // Create a very short run
    const shortRun = {
      id: 'short-run',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 50, // 50 meters
      duration: 8, // 8 seconds
      pace: runDataService.calculatePace(50, 8, 'km'),
      elevation: { gain: 0, loss: 0 }
    };
    
    // Save the run
    runDataService.saveRun(shortRun);
    
    // Check if the run is saved correctly
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    expect(storedRuns.length).toBe(1);
    
    // Verify duration is formatted correctly
    const formattedDuration = formatTime(storedRuns[0].duration);
    expect(formattedDuration).toBe('00:00:08');
    
    // Verify distance is formatted correctly
    const formattedDistance = convertDistance(storedRuns[0].distance, 'km');
    expect(formattedDistance).toBe('0.05');
    
    // Verify pace is calculated correctly
    const pace = runDataService.calculatePace(storedRuns[0].distance, storedRuns[0].duration, 'km');
    expect(pace).toBeCloseTo(2.67, 1); // About 2:40 min/km, which is very fast but possible for a short sprint
  });
  
  it('should handle very long runs correctly (multiple hours)', () => {
    // Create a very long run (marathon+)
    const longRun = {
      id: 'long-run',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 45000, // 45km
      duration: 16200, // 4.5 hours (16,200 seconds)
      pace: runDataService.calculatePace(45000, 16200, 'km'),
      elevation: { gain: 800, loss: 800 }
    };
    
    // Save the run
    runDataService.saveRun(longRun);
    
    // Check if the run is saved correctly
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    expect(storedRuns.length).toBe(1);
    
    // Verify duration is formatted correctly
    const formattedDuration = formatTime(storedRuns[0].duration);
    expect(formattedDuration).toBe('04:30:00');
    
    // Verify distance is formatted correctly
    const formattedDistance = convertDistance(storedRuns[0].distance, 'km');
    expect(formattedDistance).toBe('45.00');
    
    // Verify pace is calculated correctly (should be 6 min/km)
    const pace = runDataService.calculatePace(storedRuns[0].distance, storedRuns[0].duration, 'km');
    expect(pace).toBeCloseTo(6, 1);
  });
  
  it('should handle zero distance but non-zero duration correctly', () => {
    // Create a run with zero distance but some duration
    // This could happen if GPS signal is lost or user is stationary
    const stationaryRun = {
      id: 'stationary-run',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 0, // No distance
      duration: 300, // 5 minutes
      pace: runDataService.calculatePace(0, 300, 'km'),
      elevation: { gain: 0, loss: 0 }
    };
    
    // Save the run
    runDataService.saveRun(stationaryRun);
    
    // Check if the run is saved correctly
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    expect(storedRuns.length).toBe(1);
    
    // Verify duration is formatted correctly
    const formattedDuration = formatTime(storedRuns[0].duration);
    expect(formattedDuration).toBe('00:05:00');
    
    // Verify distance is formatted correctly
    const formattedDistance = convertDistance(storedRuns[0].distance, 'km');
    expect(formattedDistance).toBe('0.00');
    
    // Pace should be 0 or Infinity when distance is 0
    const pace = runDataService.calculatePace(storedRuns[0].distance, storedRuns[0].duration, 'km');
    expect(pace).toBe(0);
    
    // Format the pace for display - should handle Infinity/NaN/0 gracefully
    const formattedPace = formatPace(pace, 'km');
    expect(formattedPace).toBe('-- min/km');
  });
  
  it('should handle fractional seconds in duration correctly', () => {
    // Create a run with fractional seconds
    const fractionalRun = {
      id: 'fractional-run',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 1000, // 1km
      duration: 240.75, // 4 minutes and 0.75 seconds
      pace: runDataService.calculatePace(1000, 240.75, 'km'),
      elevation: { gain: 10, loss: 10 }
    };
    
    // Save the run
    runDataService.saveRun(fractionalRun);
    
    // Check if the run is saved correctly
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    expect(storedRuns.length).toBe(1);
    
    // Verify the duration was stored precisely
    expect(storedRuns[0].duration).toBeCloseTo(240.75, 2);
    
    // Verify duration is formatted correctly
    const formattedDuration = formatTime(storedRuns[0].duration);
    expect(formattedDuration).toBe('00:04:00'); // formatTime rounds down to the floor of seconds
  });
  
  it('should handle runs with negative elevation correctly', () => {
    // Create a run with negative elevation (net downhill)
    const downhillRun = {
      id: 'downhill-run',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 5000, // 5km
      duration: 1200, // 20 minutes
      pace: runDataService.calculatePace(5000, 1200, 'km'),
      elevation: { gain: 50, loss: 200 } // Net -150m
    };
    
    // Save the run
    runDataService.saveRun(downhillRun);
    
    // Check if the run is saved correctly
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    expect(storedRuns.length).toBe(1);
    
    // Verify elevation values are stored correctly
    expect(storedRuns[0].elevation.gain).toBe(50);
    expect(storedRuns[0].elevation.loss).toBe(200);
    expect(storedRuns[0].elevation.net).toBe(undefined); // Only gain and loss are stored
  });
}); 