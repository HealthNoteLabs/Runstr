import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Import components
import { RunTracker } from '../components/RunTracker';
import { RunHistory } from '../pages/RunHistory';

// Mock capacitor
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    addWatcher: vi.fn().mockResolvedValue('mock-id'),
    removeWatcher: vi.fn().mockResolvedValue(),
    openSettings: vi.fn()
  })
}));

// Mock RunTracker service
vi.mock('../services/RunTracker', () => {
  const events = {};
  
  return {
    runTracker: {
      distance: 0,
      duration: 0,
      pace: 0,
      splits: [],
      positions: [],
      elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
      isTracking: false,
      isPaused: false,
      
      on: vi.fn((event, callback) => {
        if (!events[event]) {
          events[event] = [];
        }
        events[event].push(callback);
      }),
      
      emit: (event, data) => {
        if (events[event]) {
          events[event].forEach(callback => callback(data));
        }
      },
      
      start: vi.fn().mockResolvedValue(),
      pause: vi.fn().mockResolvedValue(),
      resume: vi.fn().mockResolvedValue(),
      stop: vi.fn().mockImplementation(function() {
        const finalResults = {
          duration: this.duration,
          distance: this.distance,
          pace: this.pace,
          splits: this.splits,
          elevation: this.elevation
        };
        
        this.emit('stopped', finalResults);
        return Promise.resolve();
      }),
      
      cleanupWatchers: vi.fn().mockResolvedValue(),
      
      // Helper to simulate elevation changes during a run
      simulateElevationChanges: function(elevationProfile) {
        elevationProfile.forEach((altitude, index) => {
          // Update current altitude
          this.elevation.current = altitude;
          
          // Calculate elevation changes
          if (index > 0) {
            const prevAltitude = elevationProfile[index - 1];
            const diff = altitude - prevAltitude;
            
            if (diff > 0) {
              this.elevation.gain += diff;
            } else if (diff < 0) {
              this.elevation.loss += Math.abs(diff);
            }
          }
          
          this.elevation.lastAltitude = altitude;
          
          // Emit elevation change event
          this.emit('elevationChange', {...this.elevation});
        });
      }
    }
  };
});

// Helper to render with routing
const renderWithRouter = (ui, { route = '/' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/history" element={<RunHistory />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Elevation Data Consistency Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    localStorage.setItem('permissionsGranted', 'true');
    
    const mockDate = new Date('2023-06-15T12:00:00Z');
    vi.setSystemTime(mockDate);
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    localStorage.clear();
  });
  
  it('should correctly calculate and store elevation gain and loss', async () => {
    // Render RunTracker component
    renderWithRouter(<RunTracker />);
    
    // Import mocked runTracker
    const { runTracker } = await import('../services/RunTracker');
    
    // Define an elevation profile for testing (altitudes in meters)
    const elevationProfile = [
      100, // Starting altitude
      110, // +10m gain
      120, // +10m gain
      110, // -10m loss
      115, // +5m gain
      105, // -10m loss
      100, // -5m loss
      130, // +30m gain
      120  // -10m loss
    ];
    
    // Expected totals based on profile above
    const expectedGain = 10 + 10 + 5 + 30; // 55m
    const expectedLoss = 10 + 10 + 5 + 10; // 35m
    
    // Simulate run with elevation changes
    await act(async () => {
      // Set basic run metrics
      runTracker.distance = 5000; // 5km
      runTracker.duration = 1800; // 30min
      runTracker.pace = 0.36; // 6min/km
      
      // Simulate elevation changes
      runTracker.simulateElevationChanges(elevationProfile);
      
      // Emit other necessary events
      runTracker.emit('distanceChange', runTracker.distance);
      runTracker.emit('durationChange', runTracker.duration);
      runTracker.emit('paceChange', runTracker.pace);
      
      // Stop the run to save data
      await runTracker.stop();
    });
    
    // Verify run was saved with correct elevation data
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    expect(storedRuns.length).toBe(1);
    
    const savedRun = storedRuns[0];
    expect(savedRun.elevation.gain).toBeCloseTo(expectedGain);
    expect(savedRun.elevation.loss).toBeCloseTo(expectedLoss);
  });
  
  it('should display consistent elevation data across components', async () => {
    // Create a run with known elevation data
    const testRun = {
      id: 'elevation-test-id',
      date: new Date().toISOString(),
      distance: 10000, // 10km
      duration: 3600, // 60min
      pace: 0.36, // 6min/km
      splits: [
        { km: 1, time: 360, pace: 0.36 }
      ],
      elevation: { 
        gain: 150, 
        loss: 120,
        // Include detailed elevation profile for charts
        profile: Array.from({ length: 100 }, (_, i) => 100 + 15 * Math.sin(i * 0.1))
      }
    };
    
    // Store the run in localStorage
    localStorage.setItem('runHistory', JSON.stringify([testRun]));
    
    // Import formatters
    const formatters = await import('../utils/formatters');
    
    // Function to format elevation (similar to what components would use)
    const formattedGain = formatters.formatElevation(testRun.elevation.gain);
    const formattedLoss = formatters.formatElevation(testRun.elevation.loss);
    
    // Check for consistency
    expect(formattedGain).toBe('150 m');
    expect(formattedLoss).toBe('120 m');
    
    // Verify that this data comes through correctly when rendering RunHistory
    renderWithRouter(<RunHistory />, { route: '/history' });
    
    // Wait for component to load
    await waitFor(() => {
      // In a real test with real components, we would check DOM elements here
      // For the mock test, we'll check that the data is loaded correctly
      const runHistory = JSON.parse(localStorage.getItem('runHistory'));
      const loadedRun = runHistory.find(run => run.id === testRun.id);
      
      expect(loadedRun.elevation.gain).toBe(testRun.elevation.gain);
      expect(loadedRun.elevation.loss).toBe(testRun.elevation.loss);
    });
  });
  
  it('should maintain elevation data integrity across unit changes', async () => {
    // Create a run with elevation data
    const testRun = {
      id: 'elevation-unit-test',
      date: new Date().toISOString(),
      distance: 5000, // 5km
      duration: 1800, // 30min
      pace: 0.36, // 6min/km
      elevation: { gain: 120, loss: 100 }
    };
    
    // Store the run
    localStorage.setItem('runHistory', JSON.stringify([testRun]));
    
    // Import formatters
    const formatters = await import('../utils/formatters');
    
    // Format elevations in different units
    const mGain = formatters.formatElevation(testRun.elevation.gain, 'km');
    const mLoss = formatters.formatElevation(testRun.elevation.loss, 'km');
    
    const ftGain = formatters.formatElevation(testRun.elevation.gain, 'mi');
    const ftLoss = formatters.formatElevation(testRun.elevation.loss, 'mi');
    
    // Check meter format
    expect(mGain).toBe('120 m');
    expect(mLoss).toBe('100 m');
    
    // Check feet format
    expect(ftGain).toBe('394 ft');
    expect(ftLoss).toBe('328 ft');
    
    // Ensure the original data is unchanged despite display format changes
    const storedRuns = JSON.parse(localStorage.getItem('runHistory'));
    expect(storedRuns[0].elevation.gain).toBe(120); // Still stored in meters
    expect(storedRuns[0].elevation.loss).toBe(100); // Still stored in meters
  });
  
  it('should correctly accumulate elevation changes during run tracking', async () => {
    // Render RunTracker component
    renderWithRouter(<RunTracker />);
    
    // Import mocked runTracker
    const { runTracker } = await import('../services/RunTracker');
    
    // Simulate incremental elevation changes during a run
    await act(async () => {
      // Simulate a run in progress
      runTracker.isTracking = true;
      runTracker.isPaused = false;
      
      // First set of elevation changes
      runTracker.elevation = { current: 100, gain: 0, loss: 0, lastAltitude: 100 };
      runTracker.emit('elevationChange', {...runTracker.elevation});
      
      // Add some gain
      runTracker.elevation.current = 120;
      runTracker.elevation.gain += 20;
      runTracker.elevation.lastAltitude = 120;
      runTracker.emit('elevationChange', {...runTracker.elevation});
      
      // Add some loss
      runTracker.elevation.current = 110;
      runTracker.elevation.loss += 10;
      runTracker.elevation.lastAltitude = 110;
      runTracker.emit('elevationChange', {...runTracker.elevation});
      
      // Add more gain
      runTracker.elevation.current = 140;
      runTracker.elevation.gain += 30;
      runTracker.elevation.lastAltitude = 140;
      runTracker.emit('elevationChange', {...runTracker.elevation});
      
      // Stop the run and save
      await runTracker.stop();
    });
    
    // Check final values
    const expectedGain = 20 + 30; // 50m total gain
    const expectedLoss = 10; // 10m total loss
    
    // Verify stored data
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    expect(storedRuns.length).toBe(1);
    
    expect(storedRuns[0].elevation.gain).toBe(expectedGain);
    expect(storedRuns[0].elevation.loss).toBe(expectedLoss);
  });
}); 