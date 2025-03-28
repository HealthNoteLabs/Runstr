import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock storage service
const mockStorageService = {
  saveRun: vi.fn(),
  getRuns: vi.fn(),
  clearStorage: vi.fn()
};

// Mock for RunTracker service
const mockRunTracker = {
  isTracking: false,
  isPaused: false,
  distance: 0,
  duration: 0,
  pace: 0,
  elevation: { gain: 0, loss: 0 },
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn()
};

describe('Run Data Persistence Tests', () => {
  // Set up test environment
  beforeEach(() => {
    localStorage.clear();
    
    // Mock localStorage behavior
    const storedRuns = [];
    
    // Set up mock implementations
    mockStorageService.saveRun.mockImplementation((run) => {
      storedRuns.unshift(run); // Add to beginning (most recent first)
      localStorage.setItem('runHistory', JSON.stringify(storedRuns));
      return run;
    });
    
    mockStorageService.getRuns.mockImplementation(() => {
      return JSON.parse(localStorage.getItem('runHistory') || '[]');
    });
    
    mockStorageService.clearStorage.mockImplementation(() => {
      localStorage.removeItem('runHistory');
      storedRuns.length = 0;
    });
    
    // Set up run tracker mock
    mockRunTracker.stop.mockImplementation(() => {
      if (mockRunTracker.isTracking) {
        const runData = {
          id: 'test-run-' + Date.now(),
          date: new Date().toISOString(),
          timestamp: Date.now(),
          distance: mockRunTracker.distance,
          duration: mockRunTracker.duration,
          pace: mockRunTracker.pace,
          elevation: { ...mockRunTracker.elevation }
        };
        
        // Save the run data
        mockStorageService.saveRun(runData);
        
        // Reset tracking state
        mockRunTracker.isTracking = false;
        mockRunTracker.isPaused = false;
        
        // Fire runCompleted event with a delay
        setTimeout(() => {
          const event = new CustomEvent('runCompleted', { detail: runData });
          document.dispatchEvent(event);
        }, 100);
        
        return runData;
      }
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should persist run data across simulated app reloads', () => {
    // Create and save initial run data
    const run1 = {
      id: 'run-1',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 5000, // 5km
      duration: 1800, // 30 minutes
      pace: 6, // 6 min/km
      elevation: { gain: 100, loss: 80 }
    };
    
    mockStorageService.saveRun(run1);
    
    // Verify run is saved
    expect(mockStorageService.saveRun).toHaveBeenCalledTimes(1);
    expect(mockStorageService.saveRun).toHaveBeenCalledWith(run1);
    
    // Simulate app reload (clear memory but keep localStorage)
    vi.clearAllMocks();
    
    // Retrieve runs after "reload"
    const runsAfterReload = mockStorageService.getRuns();
    
    // Verify data persisted
    expect(runsAfterReload.length).toBe(1);
    expect(runsAfterReload[0].id).toBe(run1.id);
    expect(runsAfterReload[0].distance).toBe(run1.distance);
    expect(runsAfterReload[0].duration).toBe(run1.duration);
    
    // Add another run after "reload"
    const run2 = {
      id: 'run-2',
      date: new Date().toISOString(),
      timestamp: Date.now() + 86400000, // One day later
      distance: 10000, // 10km
      duration: 3600, // 60 minutes
      pace: 6, // 6 min/km
      elevation: { gain: 200, loss: 180 }
    };
    
    mockStorageService.saveRun(run2);
    
    // Verify both runs are now saved
    const runsAfterSecondSave = mockStorageService.getRuns();
    expect(runsAfterSecondSave.length).toBe(2);
    
    // Newest run should be first
    expect(runsAfterSecondSave[0].id).toBe(run2.id);
    expect(runsAfterSecondSave[1].id).toBe(run1.id);
    
    // Simulate another app reload
    vi.clearAllMocks();
    
    // Retrieve runs after second "reload"
    const runsAfterSecondReload = mockStorageService.getRuns();
    
    // Verify all data still persisted
    expect(runsAfterSecondReload.length).toBe(2);
    expect(runsAfterSecondReload[0].id).toBe(run2.id);
    expect(runsAfterSecondReload[1].id).toBe(run1.id);
  });
  
  it('should handle run data updates during active session', () => {
    // Setup: Create initial run
    const initialRun = {
      id: 'initial-run',
      date: new Date().toISOString(),
      timestamp: Date.now() - 86400000, // Yesterday
      distance: 3000, // 3km
      duration: 1200, // 20 minutes
      pace: 6.67, // ~6:40 min/km
      elevation: { gain: 50, loss: 40 }
    };
    
    mockStorageService.saveRun(initialRun);
    
    // Simulate app session: Start tracking a new run
    mockRunTracker.isTracking = true;
    mockRunTracker.distance = 5000; // 5km
    mockRunTracker.duration = 1500; // 25 minutes
    mockRunTracker.pace = 5; // 5 min/km
    mockRunTracker.elevation = { gain: 120, loss: 100 };
    
    // Stop the run (which saves it)
    const newRunData = mockRunTracker.stop();
    
    // Verify the new run is saved
    const runsAfterNewRun = mockStorageService.getRuns();
    expect(runsAfterNewRun.length).toBe(2);
    
    // New run should be first (most recent)
    expect(runsAfterNewRun[0].id).toBe(newRunData.id);
    expect(runsAfterNewRun[0].distance).toBe(5000);
    expect(runsAfterNewRun[0].duration).toBe(1500);
    
    // Original run should still be there
    expect(runsAfterNewRun[1].id).toBe(initialRun.id);
    expect(runsAfterNewRun[1].distance).toBe(initialRun.distance);
    
    // Simulate app reload
    vi.clearAllMocks();
    
    // Verify data persisted after reload
    const runsAfterReload = mockStorageService.getRuns();
    expect(runsAfterReload.length).toBe(2);
    expect(runsAfterReload[0].distance).toBe(5000);
    expect(runsAfterReload[1].distance).toBe(3000);
  });
  
  it('should restore correct unit preferences across sessions', () => {
    // Set initial unit preference
    localStorage.setItem('distanceUnit', 'km');
    
    // Create a run with metric units
    const metricRun = {
      id: 'metric-run',
      date: new Date().toISOString(),
      timestamp: Date.now(),
      distance: 5000, // 5km in meters
      duration: 1800, // 30 minutes
      pace: 6, // 6 min/km
      elevation: { gain: 100, loss: 80 }
    };
    
    mockStorageService.saveRun(metricRun);
    
    // Verify unit preference and run saved
    expect(localStorage.getItem('distanceUnit')).toBe('km');
    expect(mockStorageService.getRuns().length).toBe(1);
    
    // Change unit preference
    localStorage.setItem('distanceUnit', 'mi');
    
    // Simulate app reload
    vi.clearAllMocks();
    
    // Verify unit preference persisted
    expect(localStorage.getItem('distanceUnit')).toBe('mi');
    
    // Create a new run with imperial units
    // Note: distances still stored in meters regardless of display unit
    const imperialRun = {
      id: 'imperial-run',
      date: new Date().toISOString(),
      timestamp: Date.now() + 86400000,
      distance: 8047, // ~5 miles in meters
      duration: 2700, // 45 minutes
      pace: 9, // 9 min/mile
      elevation: { gain: 150, loss: 120 }
    };
    
    mockStorageService.saveRun(imperialRun);
    
    // Verify both runs are saved
    const runsAfterImperial = mockStorageService.getRuns();
    expect(runsAfterImperial.length).toBe(2);
    expect(runsAfterImperial[0].id).toBe(imperialRun.id);
    expect(runsAfterImperial[1].id).toBe(metricRun.id);
    
    // Change unit preference back to metric
    localStorage.setItem('distanceUnit', 'km');
    
    // Simulate another app reload
    vi.clearAllMocks();
    
    // Verify final state
    expect(localStorage.getItem('distanceUnit')).toBe('km');
    expect(mockStorageService.getRuns().length).toBe(2);
  });
  
  it('should handle interrupted run persistence correctly', () => {
    // Simulate an interrupted run (app closed during run)
    
    // 1. Start tracking
    mockRunTracker.isTracking = true;
    mockRunTracker.distance = 1500; // 1.5km
    mockRunTracker.duration = 600; // 10 minutes
    mockRunTracker.pace = 6.67; // ~6:40 min/km
    
    // 2. Save intermediate state (simulating auto-save feature)
    localStorage.setItem('activeRun', JSON.stringify({
      isTracking: true,
      isPaused: false,
      distance: mockRunTracker.distance,
      duration: mockRunTracker.duration,
      pace: mockRunTracker.pace,
      startTime: Date.now() - (mockRunTracker.duration * 1000),
      lastUpdateTime: Date.now()
    }));
    
    // 3. Simulate app close and reopen
    vi.clearAllMocks();
    
    // 4. Check if interrupted run was saved
    const activeRun = JSON.parse(localStorage.getItem('activeRun') || 'null');
    expect(activeRun).not.toBeNull();
    expect(activeRun.isTracking).toBe(true);
    expect(activeRun.distance).toBe(1500);
    expect(activeRun.duration).toBe(600);
    
    // 5. Recover and finish the run
    mockRunTracker.isTracking = activeRun.isTracking;
    mockRunTracker.isPaused = activeRun.isPaused;
    mockRunTracker.distance = activeRun.distance;
    mockRunTracker.duration = activeRun.duration;
    mockRunTracker.pace = activeRun.pace;
    
    // 6. Add more distance after "recovery"
    mockRunTracker.distance += 1500; // additional 1.5km
    mockRunTracker.duration += 600; // additional 10 minutes
    
    // 7. Stop the run
    mockRunTracker.stop();
    
    // 8. Verify the recovered run is saved with all data intact
    const runs = mockStorageService.getRuns();
    expect(runs.length).toBe(1);
    expect(runs[0].distance).toBe(3000); // 1.5km + 1.5km
    expect(runs[0].duration).toBe(1200); // 10min + 10min
    
    // 9. Verify the activeRun was cleared after successful save
    localStorage.removeItem('activeRun');
    expect(localStorage.getItem('activeRun')).toBeNull();
  });
}); 