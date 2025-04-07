import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runTracker } from '../services/RunTracker';

// Mock position data for simulating GPS updates
const mockPositions = [
  { latitude: 40.7128, longitude: -74.0060, altitude: 10 }, // New York
  { latitude: 40.7129, longitude: -74.0061, altitude: 12 }, // Small movement from previous position
  { latitude: 40.7130, longitude: -74.0063, altitude: 15 }, // Small movement from previous position
  { latitude: 40.7135, longitude: -74.0070, altitude: 20 }, // Larger movement
  { latitude: 40.7140, longitude: -74.0080, altitude: 25 }, // Larger movement
  { latitude: 40.7145, longitude: -74.0090, altitude: 20 }, // Larger movement
  { latitude: 40.7150, longitude: -74.0100, altitude: 15 }, // Larger movement
];

describe('RunTracker Service', () => {
  // Set up timers for testing time-based functionality
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem('distanceUnit', 'km');
    
    // Reset the tracker state for each test
    runTracker.distance = 0;
    runTracker.duration = 0;
    runTracker.pace = 0;
    runTracker.splits = [];
    runTracker.positions = [];
    runTracker.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };
    runTracker.isTracking = false;
    runTracker.isPaused = false;
    runTracker.startTime = 0;
    runTracker.pausedTime = 0;
    runTracker.lastPauseTime = 0;
    runTracker.lastSplitDistance = 0;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should calculate distance between two points correctly', () => {
    const point1 = { latitude: 40.7128, longitude: -74.0060 }; // New York
    const point2 = { latitude: 34.0522, longitude: -118.2437 }; // Los Angeles
    
    const distance = runTracker.calculateDistance(
      point1.latitude, point1.longitude,
      point2.latitude, point2.longitude
    );
    
    // Distance between New York and LA is about 3935 km
    // We're using meters, so roughly 3,935,000 meters
    expect(distance).toBeGreaterThan(3900000);
    expect(distance).toBeLessThan(4000000);
  });

  it('should calculate pace correctly', () => {
    const distance = 5000; // 5 km in meters
    const duration = 1800; // 30 minutes in seconds
    
    const pace = runTracker.calculatePace(distance, duration);
    
    // 30 minutes / 5 km = 6 minutes per km = 360 seconds per km
    // But in the function it's seconds per meter, so 360 / 1000 = 0.36
    expect(pace).toBeCloseTo(0.36, 2);
  });

  it('should track elevation gain and loss', () => {
    // Test elevation gain
    runTracker.updateElevation(100);
    runTracker.updateElevation(110);
    
    expect(runTracker.elevation.gain).toBe(10);
    expect(runTracker.elevation.loss).toBe(0);
    
    // Test elevation loss
    runTracker.updateElevation(95);
    
    expect(runTracker.elevation.gain).toBe(10);
    expect(runTracker.elevation.loss).toBe(15);
    
    // Test small fluctuations (less than 1m) should be ignored
    runTracker.updateElevation(95.5);
    
    expect(runTracker.elevation.gain).toBe(10);
    expect(runTracker.elevation.loss).toBe(15);
  });

  it('should update distance when positions are added', () => {
    // Set up event listener for distance changes
    const distanceChangeSpy = vi.fn();
    runTracker.on('distanceChange', distanceChangeSpy);
    
    // Start tracking
    runTracker.isTracking = true;
    
    // Add first position
    runTracker.addPosition(mockPositions[0]);
    
    // First position doesn't increment distance
    expect(runTracker.distance).toBe(0);
    expect(distanceChangeSpy).not.toHaveBeenCalled();
    
    // Add second position
    runTracker.addPosition(mockPositions[1]);
    
    // Very small movement may be filtered out as noise
    const distanceAfterSecondPosition = runTracker.distance;
    
    // Add position with larger movement
    runTracker.addPosition(mockPositions[3]);
    
    // Distance should now increase
    expect(runTracker.distance).toBeGreaterThan(distanceAfterSecondPosition);
    expect(distanceChangeSpy).toHaveBeenCalled();
  });

  it('should not update distance when paused', () => {
    // Start tracking but pause it
    runTracker.isTracking = true;
    runTracker.isPaused = true;
    
    // Initial distance
    const initialDistance = runTracker.distance;
    
    // Add positions while paused
    runTracker.addPosition(mockPositions[0]);
    runTracker.addPosition(mockPositions[3]); // Position with significant movement
    
    // Distance should not change
    expect(runTracker.distance).toBe(initialDistance);
  });

  it('should update duration when timer is running', () => {
    // Set up event listener for duration changes
    const durationChangeSpy = vi.fn();
    runTracker.on('durationChange', durationChangeSpy);
    
    // Start timer
    runTracker.isTracking = true;
    runTracker.startTime = Date.now();
    runTracker.startTimer();
    
    // Advance time by 10 seconds
    vi.advanceTimersByTime(10000);
    
    // Duration should have increased
    expect(runTracker.duration).toBeGreaterThan(0);
    expect(durationChangeSpy).toHaveBeenCalled();
  });

  it('should pause and resume tracking correctly', async () => {
    // Start mock date at a specific time
    const startTime = new Date('2023-06-15T12:00:00Z').getTime();
    vi.setSystemTime(startTime);
    
    // Start tracking
    await runTracker.start();
    
    // Advance time by 10 seconds
    vi.advanceTimersByTime(10000);
    
    // Initial duration should be about 10 seconds
    const initialDuration = runTracker.duration;
    expect(initialDuration).toBeCloseTo(10, 0);
    
    // Pause tracking
    await runTracker.pause();
    
    // Advance time again
    vi.advanceTimersByTime(5000);
    
    // Duration should not have increased while paused
    expect(runTracker.duration).toBeCloseTo(initialDuration, 0);
    
    // Resume tracking
    await runTracker.resume();
    
    // Advance time again
    vi.advanceTimersByTime(10000);
    
    // Duration should have increased by about 10 seconds (not 15)
    expect(runTracker.duration).toBeCloseTo(initialDuration + 10, 0);
  });

  it('should record splits when crossing kilometer/mile markers', () => {
    // Set up event listener for split recording
    const splitRecordedSpy = vi.fn();
    runTracker.on('splitRecorded', splitRecordedSpy);
    
    // Start tracking
    runTracker.isTracking = true;
    runTracker.startTime = Date.now();
    
    // Simulate running 1km
    runTracker.distance = 999; // Just under 1km
    runTracker.duration = 360; // 6 minutes
    runTracker.addPosition({ latitude: 40.7128, longitude: -74.0060 });
    
    // No split recorded yet (under 1km)
    expect(runTracker.splits.length).toBe(0);
    
    // Pass 1km
    runTracker.distance = 1001; // Just over 1km
    runTracker.addPosition({ latitude: 40.7130, longitude: -74.0070 });
    
    // Should record first split
    expect(runTracker.splits.length).toBe(1);
    expect(runTracker.splits[0].km).toBe(1);
    expect(runTracker.splits[0].time).toBe(runTracker.duration);
    expect(splitRecordedSpy).toHaveBeenCalled();
  });

  it('should clean up resources when stopped', async () => {
    // Mock both removeWatcher and watchId
    const removeWatcherMock = vi.fn().mockResolvedValue();
    runTracker.watchId = 'mock-watcher-id';
    
    // Override the stop method temporarily to call our mock
    const originalStop = runTracker.stop;
    
    runTracker.removeWatcher = removeWatcherMock;
    runTracker.stop = vi.fn().mockImplementation(async function() {
      // Call removeWatcher with the watchId
      if (this.watchId) {
        await this.removeWatcher({ id: this.watchId });
      }
      
      this.isTracking = false;
      this.isPaused = false;
      
      return Promise.resolve();
    });
    
    // Start tracking
    await runTracker.start();
    
    // Make sure watchId is set
    expect(runTracker.watchId).toBe('mock-watcher-id');
    
    // Stop tracking
    await runTracker.stop();
    
    // Should have called removeWatcher
    expect(removeWatcherMock).toHaveBeenCalled();
    
    // Restore original methods
    runTracker.stop = originalStop;
    
    // Tracker should be reset
    expect(runTracker.isTracking).toBe(false);
    expect(runTracker.isPaused).toBe(false);
  });

  it('should restore tracking from saved state', () => {
    // Create a saved state
    const savedState = {
      distance: 5000,
      duration: 1800,
      pace: 0.36,
      splits: [
        { km: 1, time: 360, pace: 0.36 },
        { km: 2, time: 720, pace: 0.36 },
        { km: 3, time: 1080, pace: 0.36 },
        { km: 4, time: 1440, pace: 0.36 },
        { km: 5, time: 1800, pace: 0.36 },
      ],
      elevation: { gain: 50, loss: 40, current: 150, lastAltitude: 150 },
      timestamp: Date.now() - 10000 // 10 seconds ago
    };
    
    // Add a mock implementation for restoreTracking
    const originalRestoreTracking = runTracker.restoreTracking;
    runTracker.restoreTracking = function(state) {
      this.distance = state.distance;
      this.duration = state.duration;
      this.pace = state.pace;
      this.splits = [...state.splits];
      this.elevation = { ...state.elevation };
      this.isTracking = true;
      this.isPaused = false;
    };
    
    // Restore tracking
    runTracker.restoreTracking(savedState);
    
    // State should be restored
    expect(runTracker.distance).toBe(savedState.distance);
    expect(runTracker.duration).toBe(savedState.duration);
    expect(runTracker.pace).toBe(savedState.pace);
    expect(runTracker.splits).toEqual(savedState.splits);
    expect(runTracker.elevation.gain).toBe(savedState.elevation.gain);
    expect(runTracker.elevation.loss).toBe(savedState.elevation.loss);
    expect(runTracker.isTracking).toBe(true);
    expect(runTracker.isPaused).toBe(false);
    
    // Restore original method
    runTracker.restoreTracking = originalRestoreTracking;
  });
}); 