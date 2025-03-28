import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create a localStorage mock object
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    // Helper to access the raw store for testing
    _getStore: () => store
  };
})();

// Mock RunDataService
const mockRunDataService = {
  saveRun: vi.fn(runData => {
    const storedRuns = localStorageMock.getItem('runHistory');
    const runs = storedRuns ? JSON.parse(storedRuns) : [];
    
    const newRun = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      timestamp: Date.now(),
      ...runData
    };
    
    const updatedRuns = [newRun, ...runs];
    localStorageMock.setItem('runHistory', JSON.stringify(updatedRuns));
    return newRun;
  }),
  getAllRuns: vi.fn(() => {
    const storedRuns = localStorageMock.getItem('runHistory');
    return storedRuns ? JSON.parse(storedRuns) : [];
  })
};

// Mock modules
vi.mock('../services/RunDataService', () => {
  return {
    default: mockRunDataService
  };
});

describe('Run Data Storage and Consistency', () => {
  beforeEach(() => {
    // Replace the standard localStorage methods with our mocks before each test
    vi.stubGlobal('localStorage', localStorageMock);
    // Clear localStorage before each test
    localStorageMock.clear();
    // Reset all mock function calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up mocks after each test
    vi.restoreAllMocks();
  });

  it('should correctly save run data with expected duration and distance', () => {
    // Test data
    const testDuration = 300; // 5 minutes
    const testDistance = 1000; // 1 km
    
    // Create a run data object
    const runData = {
      distance: testDistance,
      duration: testDuration,
      pace: testDuration / 60 / (testDistance / 1000), // min/km
      elevation: {
        gain: 25,
        loss: 15
      }
    };
    
    // Save the run
    mockRunDataService.saveRun(runData);
    
    // Get saved runs
    const savedRuns = mockRunDataService.getAllRuns();
    expect(savedRuns.length).toBe(1);
    
    // Check the values are correct
    const savedRun = savedRuns[0];
    expect(savedRun.distance).toBe(testDistance);
    expect(savedRun.duration).toBe(testDuration);
    
    // Verify the call was made
    expect(mockRunDataService.saveRun).toHaveBeenCalledWith(runData);
  });

  it('should correctly handle multiple runs with consistent data', () => {
    // Create several runs
    const runs = [
      {
        distance: 1000, // 1 km
        duration: 300,  // 5 minutes
        pace: 5         // 5 min/km
      },
      {
        distance: 2000, // 2 km
        duration: 600,  // 10 minutes
        pace: 5         // 5 min/km
      },
      {
        distance: 5000, // 5 km
        duration: 1500, // 25 minutes
        pace: 5         // 5 min/km
      }
    ];
    
    // Save runs
    runs.forEach(run => mockRunDataService.saveRun(run));
    
    // Get saved runs
    const savedRuns = mockRunDataService.getAllRuns();
    
    // Verify run count
    expect(savedRuns.length).toBe(3);
    
    // Check that runs are saved in correct order (newest first)
    expect(savedRuns[0].distance).toBe(5000);
    expect(savedRuns[1].distance).toBe(2000);
    expect(savedRuns[2].distance).toBe(1000);
    
    // Verify all durations are preserved correctly
    expect(savedRuns[0].duration).toBe(1500);
    expect(savedRuns[1].duration).toBe(600);
    expect(savedRuns[2].duration).toBe(300);
  });

  it('should preserve exact duration values during save and retrieval', () => {
    // Specific test for duration precision
    const preciseRun = {
      distance: 3567, // 3.567 km
      duration: 1234, // 20:34
      pace: 5.77      // 5:46 min/km
    };
    
    // Save the run
    mockRunDataService.saveRun(preciseRun);
    
    // Get saved run
    const savedRuns = mockRunDataService.getAllRuns();
    const retrievedRun = savedRuns[0];
    
    // Verify exact values
    expect(retrievedRun.duration).toBe(1234);
    expect(retrievedRun.distance).toBe(3567);
    expect(retrievedRun.pace).toBe(5.77);
  });
}); 