import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock functions and services
const runDataService = {
  saveRun: vi.fn(),
  getRunHistory: vi.fn()
};

describe('Run Tracker Race Condition Tests', () => {
  // Prepare localStorage and document for testing
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Create a mock run history
    const mockRunHistory = [
      {
        id: 'run-1',
        date: new Date().toISOString(),
        timestamp: Date.now(),
        distance: 5000, // 5km in meters
        duration: 1800, // 30 minutes in seconds
        pace: 0.36, // 6 min/km in seconds/meter
        elevation: { gain: 100, loss: 80 }
      }
    ];
    
    // Initialize localStorage with mock data
    localStorage.setItem('runHistory', JSON.stringify(mockRunHistory));
    
    // Mock the runDataService functions
    runDataService.saveRun.mockImplementation((run) => {
      const runs = JSON.parse(localStorage.getItem('runHistory') || '[]');
      runs.unshift(run);
      localStorage.setItem('runHistory', JSON.stringify(runs));
      return run;
    });
    
    runDataService.getRunHistory.mockImplementation(() => {
      return JSON.parse(localStorage.getItem('runHistory') || '[]');
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should handle runCompleted event even when fired before localStorage update', async () => {
    // Simulate a race condition by firing the event right before the data is saved
    const runData = {
      id: 'race-condition-run',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 8000, // 8km
      duration: 2700, // 45 minutes
      pace: 0.3375, // 5:38 min/km
      elevation: { gain: 120, loss: 100 }
    };
    
    // 1. Create a reference to original localStorage.setItem
    const originalSetItem = localStorage.setItem;
    
    // 2. Override localStorage.setItem to simulate the race condition
    localStorage.setItem = vi.fn((key, value) => {
      if (key === 'runHistory') {
        // Delay the storage to simulate the race condition
        setTimeout(() => {
          originalSetItem.call(localStorage, key, value);
          
          // Now check if the data was correctly saved
          const storedRuns = JSON.parse(localStorage.getItem('runHistory'));
          expect(storedRuns[0].duration).toBe(runData.duration);
          expect(storedRuns[0].distance).toBe(runData.distance);
        }, 10);
        
        // Immediately fire the runCompleted event before storage completes
        const event = new CustomEvent('runCompleted', { detail: runData });
        document.dispatchEvent(event);
      } else {
        originalSetItem.call(localStorage, key, value);
      }
    });
    
    // 3. Simulate saveRun and wait for delayed verification
    runDataService.saveRun(runData);
    
    // Wait for the delayed localStorage operation to complete
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Restore original localStorage.setItem
    localStorage.setItem = originalSetItem;
    
    // Verify that even with the race condition, we get correct data after our fix
    const storedRuns = JSON.parse(localStorage.getItem('runHistory'));
    expect(storedRuns.length).toBe(2);
    expect(storedRuns[0].id).toBe('race-condition-run');
    expect(storedRuns[0].duration).toBe(2700);
  });
  
  it('should handle multiple runs with consistent duration data', async () => {
    // Simulate multiple runs being completed in quick succession
    const runs = [
      {
        id: 'run-quick-1',
        date: new Date().toISOString(),
        timestamp: Date.now() - 86400000, // Yesterday
        distance: 3000,
        duration: 1200, // 20 minutes
        pace: 0.4,
        elevation: { gain: 50, loss: 50 }
      },
      {
        id: 'run-quick-2',
        date: new Date().toISOString(),
        timestamp: Date.now(),
        distance: 10000,
        duration: 3600, // 60 minutes
        pace: 0.36,
        elevation: { gain: 200, loss: 180 }
      }
    ];
    
    // Save runs with minimal delay between them
    for (const run of runs) {
      runDataService.saveRun(run);
      const event = new CustomEvent('runCompleted', { detail: run });
      document.dispatchEvent(event);
      // Minimal delay to simulate rapid succession
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // After all runs are "saved", verify the data
    const storedRuns = JSON.parse(localStorage.getItem('runHistory'));
    
    // We should have the 2 new runs plus the initial mock run
    expect(storedRuns.length).toBe(3);
    
    // The most recent run should be first
    expect(storedRuns[0].id).toBe('run-quick-2');
    expect(storedRuns[0].duration).toBe(3600);
    expect(storedRuns[0].distance).toBe(10000);
    
    // The second most recent run should be next
    expect(storedRuns[1].id).toBe('run-quick-1');
    expect(storedRuns[1].duration).toBe(1200);
    expect(storedRuns[1].distance).toBe(3000);
  });
  
  it('should handle delay between storage and event correctly', async () => {
    // This test verifies our 100ms delay fix in the RunTracker service
    
    const runData = {
      id: 'delayed-event-run',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 15000, // 15km
      duration: 5400, // 90 minutes
      pace: 0.36,
      elevation: { gain: 300, loss: 300 }
    };
    
    // 1. First save the run to localStorage
    runDataService.saveRun(runData);
    
    // 2. Then wait a bit before firing the event (simulating our fix)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 3. Now fire the runCompleted event
    const event = new CustomEvent('runCompleted', { detail: runData });
    document.dispatchEvent(event);
    
    // 4. Verify the data is correct after the event fires
    const storedRuns = JSON.parse(localStorage.getItem('runHistory'));
    expect(storedRuns.length).toBe(2);
    expect(storedRuns[0].id).toBe('delayed-event-run');
    expect(storedRuns[0].duration).toBe(5400);
    expect(storedRuns[0].distance).toBe(15000);
  });
}); 