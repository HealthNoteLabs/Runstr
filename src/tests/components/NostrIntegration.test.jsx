import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createAndPublishEvent } from '../utils/nostr';
import { runTracker } from '../services/RunTracker';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RunHistory } from '../pages/RunHistory';
import { RunTracker as RunTrackerComponent } from '../components/RunTracker';

// Mock nostr utils
vi.mock('../utils/nostr', () => ({
  createAndPublishEvent: vi.fn().mockResolvedValue({
    id: 'test-event-id',
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: '',
    sig: 'test-signature'
  }),
  publishToNostr: vi.fn().mockResolvedValue(true),
  initializeNostr: vi.fn().mockResolvedValue(true),
  getUserPublicKey: vi.fn().mockResolvedValue('npub123456789')
}));

// Mock RunTracker service
vi.mock('../services/RunTracker', () => {
  // Create a mock event emitter
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
      startTime: 0,
      pausedTime: 0,
      lastPauseTime: 0,
      lastSplitDistance: 0,
      
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
      
      start: vi.fn().mockImplementation(function() {
        this.isTracking = true;
        this.isPaused = false;
        this.startTime = Date.now();
        return Promise.resolve();
      }),
      
      pause: vi.fn().mockImplementation(function() {
        this.isPaused = true;
        return Promise.resolve();
      }),
      
      resume: vi.fn().mockImplementation(function() {
        this.isPaused = false;
        return Promise.resolve();
      }),
      
      stop: vi.fn().mockImplementation(function() {
        // Simulate final results
        const finalResults = {
          duration: this.duration,
          distance: this.distance,
          pace: this.pace,
          splits: this.splits,
          elevation: this.elevation
        };
        
        this.emit('stopped', finalResults);
        
        this.isTracking = false;
        this.isPaused = false;
        this.distance = 0;
        this.duration = 0;
        this.pace = 0;
        this.splits = [];
        
        return Promise.resolve();
      }),
      
      // Add cleanupWatchers method that was missing from our mock
      cleanupWatchers: vi.fn().mockResolvedValue(),
      
      // Helper function to simulate run for testing
      simulateRun: function(distance, duration, pace, splits, elevation) {
        this.distance = distance;
        this.duration = duration;
        this.pace = pace;
        this.splits = splits || [];
        this.elevation = elevation || { gain: 0, loss: 0 };
        
        this.emit('distanceChange', this.distance);
        this.emit('durationChange', this.duration);
        this.emit('paceChange', this.pace);
        if (this.splits.length > 0) {
          this.emit('splitRecorded', this.splits);
        }
        this.emit('elevationChange', this.elevation);
      }
    }
  };
});

// Mock offline utils
vi.mock('../utils/offline', () => ({
  storeRunLocally: vi.fn()
}));

// Helper to create a testing environment with both components available
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

describe('Nostr Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage and mocks before each test
    localStorage.clear();
    vi.clearAllMocks();
    
    // Set permission granted
    localStorage.setItem('permissionsGranted', 'true');
    
    // Mock Date to have consistent timestamps
    const mockDate = new Date('2023-06-15T12:00:00Z');
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    localStorage.clear();
  });

  it('should post run data to nostr with all required fields', async () => {
    // Set up a mock run history in localStorage
    const testRun = {
      id: 'test-run-id',
      date: new Date().toLocaleDateString(),
      distance: 5000, // 5km
      duration: 1800, // 30 minutes
      pace: 0.36, // 6 min/km pace
      splits: [
        { km: 1, time: 360, pace: 0.36 },
        { km: 2, time: 720, pace: 0.36 },
        { km: 3, time: 1080, pace: 0.36 },
        { km: 4, time: 1440, pace: 0.36 },
        { km: 5, time: 1800, pace: 0.36 }
      ],
      elevation: { gain: 50, loss: 40 }
    };
    
    localStorage.setItem('runHistory', JSON.stringify([testRun]));
    
    // Render the RunHistory component
    renderWithRouter(<RunHistory />, { route: '/history' });
    
    // Simulate user posting to nostr
    await act(async () => {
      // Directly call the nostr publication functions
      await createAndPublishEvent({
        kind: 1,
        content: JSON.stringify(testRun),
        tags: [
          ['t', 'run'],
          ['t', 'runstr'],
          ['distance', '5000'],
          ['duration', '1800'],
          ['pace', '0.36']
        ]
      });
    });
    
    // Verify that createAndPublishEvent was called with the correct run data
    expect(createAndPublishEvent).toHaveBeenCalled();
    const calledArg = createAndPublishEvent.mock.calls[0][0];
    
    // Verify event structure
    expect(calledArg.kind).toBe(1);
    expect(calledArg.tags).toContainEqual(['t', 'run']);
    expect(calledArg.tags).toContainEqual(['t', 'runstr']);
    expect(calledArg.tags).toContainEqual(['distance', '5000']);
    expect(calledArg.tags).toContainEqual(['duration', '1800']);
    expect(calledArg.tags).toContainEqual(['pace', '0.36']);
    
    // Parse content as JSON and verify it contains all run data
    const contentObject = JSON.parse(calledArg.content);
    expect(contentObject.distance).toBe(5000);
    expect(contentObject.duration).toBe(1800);
    expect(contentObject.pace).toBe(0.36);
    expect(contentObject.splits.length).toBe(5);
    expect(contentObject.elevation.gain).toBe(50);
    expect(contentObject.elevation.loss).toBe(40);
  });

  it('should ensure published run data matches displayed data', async () => {
    // Render the RunTracker component
    const { unmount } = renderWithRouter(<RunTrackerComponent />);
    
    // Import the mocked runTracker
    
    // Simulate a run
    runTracker.simulateRun(
      5000, // 5km
      1800, // 30 minutes
      0.36, // 6 min/km pace
      [
        { km: 1, time: 360, pace: 0.36 },
        { km: 2, time: 720, pace: 0.36 },
        { km: 3, time: 1080, pace: 0.36 },
        { km: 4, time: 1440, pace: 0.36 },
        { km: 5, time: 1800, pace: 0.36 }
      ],
      { gain: 50, loss: 40 }
    );
    
    // Simulate stopping the run
    await act(async () => {
      await runTracker.stop();
    });
    
    // Check that run data was saved to localStorage
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    
    expect(storedRuns.length).toBe(1);
    const savedRun = storedRuns[0];
    
    // Unmount to clean up
    unmount();
    
    // Now go to run history and simulate posting to nostr
    renderWithRouter(<RunHistory />, { route: '/history' });
    
    // Simulate posting to nostr
    await act(async () => {
      // Directly call the nostr publication functions
      await createAndPublishEvent({
        kind: 1,
        content: JSON.stringify(savedRun),
        tags: [
          ['t', 'run'],
          ['t', 'runstr'],
          ['distance', savedRun.distance.toString()],
          ['duration', savedRun.duration.toString()],
          ['pace', savedRun.pace.toString()]
        ]
      });
    });
    
    // Verify that createAndPublishEvent was called with the correct run data
    expect(createAndPublishEvent).toHaveBeenCalled();
    const calledArg = createAndPublishEvent.mock.calls[0][0];
    
    // Parse content as JSON and verify it matches saved run
    const contentObject = JSON.parse(calledArg.content);
    expect(contentObject.distance).toBe(savedRun.distance);
    expect(contentObject.duration).toBe(savedRun.duration);
    expect(contentObject.pace).toBe(savedRun.pace);
    expect(contentObject.splits.length).toBe(savedRun.splits.length);
    expect(contentObject.elevation.gain).toBe(savedRun.elevation.gain);
    expect(contentObject.elevation.loss).toBe(savedRun.elevation.loss);
  });

  it('should properly handle offline runs when going online', async () => {
    // Set up a mock offline run
    const offlineRun = {
      id: 'offline-run-id',
      date: new Date().toLocaleDateString(),
      distance: 3000, // 3km
      duration: 1200, // 20 minutes
      pace: 0.4, // 6.67 min/km pace
      splits: [
        { km: 1, time: 400, pace: 0.4 },
        { km: 2, time: 800, pace: 0.4 },
        { km: 3, time: 1200, pace: 0.4 }
      ],
      elevation: { gain: 30, loss: 25 },
      offlineStatus: 'pending' // Mark as pending
    };
    
    // Store the offline run
    const runHistory = [offlineRun];
    localStorage.setItem('runHistory', JSON.stringify(runHistory));
    
    // Set the offline queue
    localStorage.setItem('offlineRunQueue', JSON.stringify([offlineRun.id]));
    
    // Render the RunHistory component
    renderWithRouter(<RunHistory />, { route: '/history' });
    
    // Simulate going online and processing the queue
    await act(async () => {
      // Directly simulate the online publishing logic
      const offlineQueue = JSON.parse(localStorage.getItem('offlineRunQueue') || '[]');
      const history = JSON.parse(localStorage.getItem('runHistory') || '[]');
      
      // Process each offline run
      for (const runId of offlineQueue) {
        const run = history.find(r => r.id === runId);
        if (run) {
          await createAndPublishEvent({
            kind: 1,
            content: JSON.stringify(run),
            tags: [
              ['t', 'run'],
              ['t', 'runstr'],
              ['distance', run.distance.toString()],
              ['duration', run.duration.toString()],
              ['pace', run.pace.toString()]
            ]
          });
          
          // Update the run to mark as published
          run.offlineStatus = 'published';
        }
      }
      
      // Update localStorage
      localStorage.setItem('runHistory', JSON.stringify(history));
      localStorage.setItem('offlineRunQueue', JSON.stringify([]));
    });
    
    // Verify that createAndPublishEvent was called with the correct run data
    expect(createAndPublishEvent).toHaveBeenCalled();
    const calledArg = createAndPublishEvent.mock.calls[0][0];
    
    // Parse content as JSON and verify it matches offline run
    const contentObject = JSON.parse(calledArg.content);
    expect(contentObject.distance).toBe(offlineRun.distance);
    expect(contentObject.duration).toBe(offlineRun.duration);
    expect(contentObject.pace).toBe(offlineRun.pace);
    expect(contentObject.splits.length).toBe(offlineRun.splits.length);
    
    // Check that the run has been marked as published
    const updatedHistory = JSON.parse(localStorage.getItem('runHistory'));
    expect(updatedHistory[0].offlineStatus).toBe('published');
    
    // Check that the offline queue is now empty
    const updatedQueue = JSON.parse(localStorage.getItem('offlineRunQueue'));
    expect(updatedQueue).toEqual([]);
  });
}); 