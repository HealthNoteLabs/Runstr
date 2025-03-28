import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Constants for performance testing
const LARGE_HISTORY_SIZE = 100; // Number of runs in a large history
const PERFORMANCE_THRESHOLD_MS = 200; // Maximum acceptable time for operations

// Helper to measure execution time
function measurePerformance(fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { result, duration: end - start };
}

// Test service functions
const testServices = {
  generateMockRun: (index, baseTime) => {
    // Create deterministic but varied mock run data
    const date = new Date(baseTime - (index * 86400000)); // One day between each run
    
    // Use index to create variation between runs
    const distance = 5000 + (index % 10) * 500; // 5km to 9.5km
    const duration = 1800 + (index % 12) * 300; // 30min to 1h45min
    const pace = duration / 60 / (distance / 1000);
    
    return {
      id: `run-${index}-${Date.now()}`,
      date: date.toISOString(),
      timestamp: date.getTime(),
      distance: distance,
      duration: duration,
      pace: pace,
      elevation: {
        gain: 50 + (index % 10) * 10,
        loss: 50 + (index % 8) * 10
      },
      points: Array(20).fill().map((_, i) => ({
        latitude: 37.7749 + (i * 0.001),
        longitude: -122.4194 + (i * 0.001),
        altitude: 10 + (i % 5),
        timestamp: date.getTime() + (i * 60000)
      }))
    };
  },
  
  generateLargeHistory: (count) => {
    const baseTime = Date.now();
    const history = [];
    
    for (let i = 0; i < count; i++) {
      history.push(testServices.generateMockRun(i, baseTime));
    }
    
    return history;
  },
  
  // Run statistics calculation
  calculateTotalDistance: (runs) => {
    return runs.reduce((total, run) => total + run.distance, 0);
  },
  
  calculateTotalDuration: (runs) => {
    return runs.reduce((total, run) => total + run.duration, 0);
  },
  
  calculateAveragePace: (runs) => {
    const totalDistance = testServices.calculateTotalDistance(runs);
    const totalDuration = testServices.calculateTotalDuration(runs);
    
    if (totalDistance === 0) return 0;
    return totalDuration / 60 / (totalDistance / 1000);
  },
  
  findFastestRun: (runs) => {
    if (runs.length === 0) return null;
    
    return runs.reduce((fastest, run) => {
      // Skip runs with no distance
      if (run.distance === 0) return fastest;
      
      const currentPace = run.duration / 60 / (run.distance / 1000);
      const fastestPace = fastest ? fastest.duration / 60 / (fastest.distance / 1000) : Infinity;
      
      return currentPace < fastestPace ? run : fastest;
    }, null);
  },
  
  findLongestRun: (runs) => {
    if (runs.length === 0) return null;
    
    return runs.reduce((longest, run) => {
      return (run.distance > (longest ? longest.distance : 0)) ? run : longest;
    }, null);
  },
  
  // Complex stats calculation that would be slow with large datasets
  calculateComplexStats: (runs) => {
    // Simulating a complex calculation that would be slow
    // This calculates custom metrics across all runs
    
    // First, sort all runs by date
    const sortedRuns = [...runs].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Group runs by month
    const monthlyRuns = {};
    sortedRuns.forEach(run => {
      const date = new Date(run.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyRuns[monthKey]) {
        monthlyRuns[monthKey] = [];
      }
      
      monthlyRuns[monthKey].push(run);
    });
    
    // Calculate stats for each month
    const monthlyStats = Object.keys(monthlyRuns).map(month => {
      const runsInMonth = monthlyRuns[month];
      const totalDistance = testServices.calculateTotalDistance(runsInMonth);
      const totalDuration = testServices.calculateTotalDuration(runsInMonth);
      const averagePace = testServices.calculateAveragePace(runsInMonth);
      
      return {
        month,
        runCount: runsInMonth.length,
        totalDistance,
        totalDuration,
        averagePace,
        longestRun: testServices.findLongestRun(runsInMonth),
        fastestRun: testServices.findFastestRun(runsInMonth)
      };
    });
    
    // Calculate streaks (consecutive days of running)
    let maxStreak = 0;
    let currentStreak = 0;
    let lastRunDate = null;
    
    sortedRuns.forEach(run => {
      const runDate = new Date(run.date);
      runDate.setHours(0, 0, 0, 0);
      
      if (!lastRunDate) {
        // First run
        currentStreak = 1;
      } else {
        const prevDay = new Date(lastRunDate);
        prevDay.setDate(prevDay.getDate() + 1);
        
        if (runDate.getTime() === prevDay.getTime()) {
          // Consecutive day
          currentStreak++;
        } else {
          // Streak broken
          currentStreak = 1;
        }
      }
      
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
      
      lastRunDate = runDate;
    });
    
    return {
      totalRuns: runs.length,
      totalDistance: testServices.calculateTotalDistance(runs),
      totalDuration: testServices.calculateTotalDuration(runs),
      averagePace: testServices.calculateAveragePace(runs),
      longestRun: testServices.findLongestRun(runs),
      fastestRun: testServices.findFastestRun(runs),
      monthlyStats,
      maxStreak
    };
  }
};

describe('Run Tracker Performance Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers(); // Use fake timers for testing
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Restore real timers
  });
  
  it('should handle loading large run history efficiently', () => {
    // Generate large run history
    const largeHistory = testServices.generateLargeHistory(LARGE_HISTORY_SIZE);
    
    // Save to localStorage
    const { duration: saveTime } = measurePerformance(() => {
      localStorage.setItem('runHistory', JSON.stringify(largeHistory));
    });
    
    console.log(`Save time for ${LARGE_HISTORY_SIZE} runs: ${saveTime.toFixed(2)}ms`);
    
    // Load from localStorage
    const { duration: loadTime, result: loadedHistory } = measurePerformance(() => {
      return JSON.parse(localStorage.getItem('runHistory') || '[]');
    });
    
    console.log(`Load time for ${LARGE_HISTORY_SIZE} runs: ${loadTime.toFixed(2)}ms`);
    
    // Verify data loaded correctly
    expect(loadedHistory.length).toBe(LARGE_HISTORY_SIZE);
    expect(loadedHistory[0].id).toBe(largeHistory[0].id);
    
    // Verify performance
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  });
  
  it('should calculate run statistics efficiently with large datasets', () => {
    // Generate large run history
    const largeHistory = testServices.generateLargeHistory(LARGE_HISTORY_SIZE);
    
    // Save to localStorage
    localStorage.setItem('runHistory', JSON.stringify(largeHistory));
    
    // Measure performance of simple stats calculations
    const { duration: distanceCalcTime } = measurePerformance(() => {
      return testServices.calculateTotalDistance(largeHistory);
    });
    
    console.log(`Total distance calculation time: ${distanceCalcTime.toFixed(2)}ms`);
    expect(distanceCalcTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS / 4); // Should be very fast
    
    const { duration: paceCalcTime } = measurePerformance(() => {
      return testServices.calculateAveragePace(largeHistory);
    });
    
    console.log(`Average pace calculation time: ${paceCalcTime.toFixed(2)}ms`);
    expect(paceCalcTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS / 2);
    
    const { duration: findLongestTime } = measurePerformance(() => {
      return testServices.findLongestRun(largeHistory);
    });
    
    console.log(`Find longest run time: ${findLongestTime.toFixed(2)}ms`);
    expect(findLongestTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS / 2);
    
    // Measure performance of complex stats calculation
    const { duration: complexStatsTime } = measurePerformance(() => {
      return testServices.calculateComplexStats(largeHistory);
    });
    
    console.log(`Complex stats calculation time: ${complexStatsTime.toFixed(2)}ms`);
    expect(complexStatsTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2); // More complex calculations allowed more time
  });
  
  it('should efficiently filter and sort large run history', () => {
    // Generate large run history
    const largeHistory = testServices.generateLargeHistory(LARGE_HISTORY_SIZE);
    
    // Save to localStorage
    localStorage.setItem('runHistory', JSON.stringify(largeHistory));
    
    // Measure performance of sorting by date
    const { duration: sortTime } = measurePerformance(() => {
      return [...largeHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    
    console.log(`Sort ${LARGE_HISTORY_SIZE} runs by date: ${sortTime.toFixed(2)}ms`);
    expect(sortTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    
    // Measure performance of filtering by distance range
    const { duration: filterTime } = measurePerformance(() => {
      return largeHistory.filter(run => run.distance >= 5000 && run.distance <= 7000);
    });
    
    console.log(`Filter ${LARGE_HISTORY_SIZE} runs by distance: ${filterTime.toFixed(2)}ms`);
    expect(filterTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS / 2);
    
    // Measure performance of complex filter + sort + map operation
    const { duration: complexOperationTime } = measurePerformance(() => {
      return largeHistory
        .filter(run => run.distance > 0) // Remove invalid runs
        .sort((a, b) => b.distance - a.distance) // Sort by distance (descending)
        .map(run => ({ // Transform to simplified view model
          id: run.id,
          date: new Date(run.date).toLocaleDateString(),
          distance: (run.distance / 1000).toFixed(2),
          duration: Math.floor(run.duration / 60),
          pace: (run.duration / 60 / (run.distance / 1000)).toFixed(2)
        }))
        .slice(0, 10); // Get top 10
    });
    
    console.log(`Complex operation on ${LARGE_HISTORY_SIZE} runs: ${complexOperationTime.toFixed(2)}ms`);
    expect(complexOperationTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  });
  
  it('should handle adding new runs to large history efficiently', () => {
    // Generate large run history
    const largeHistory = testServices.generateLargeHistory(LARGE_HISTORY_SIZE);
    
    // Save to localStorage
    localStorage.setItem('runHistory', JSON.stringify(largeHistory));
    
    // Generate a new run
    const newRun = testServices.generateMockRun(LARGE_HISTORY_SIZE, Date.now());
    
    // Measure performance of adding a run to the beginning (most recent)
    const { duration: addToStartTime } = measurePerformance(() => {
      const history = JSON.parse(localStorage.getItem('runHistory') || '[]');
      history.unshift(newRun);
      localStorage.setItem('runHistory', JSON.stringify(history));
      return history;
    });
    
    console.log(`Add run to start of ${LARGE_HISTORY_SIZE} runs: ${addToStartTime.toFixed(2)}ms`);
    expect(addToStartTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    
    // Verify run was added correctly
    const updatedHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
    expect(updatedHistory.length).toBe(LARGE_HISTORY_SIZE + 1);
    expect(updatedHistory[0].id).toBe(newRun.id);
  });
  
  it('should handle deleting runs from large history efficiently', () => {
    // Generate large run history
    const largeHistory = testServices.generateLargeHistory(LARGE_HISTORY_SIZE);
    
    // Save to localStorage
    localStorage.setItem('runHistory', JSON.stringify(largeHistory));
    
    // Get a run ID to delete (middle of the array)
    const runToDeleteId = largeHistory[Math.floor(LARGE_HISTORY_SIZE / 2)].id;
    
    // Measure performance of deleting a run
    const { duration: deleteTime } = measurePerformance(() => {
      const history = JSON.parse(localStorage.getItem('runHistory') || '[]');
      const filteredHistory = history.filter(run => run.id !== runToDeleteId);
      localStorage.setItem('runHistory', JSON.stringify(filteredHistory));
      return filteredHistory;
    });
    
    console.log(`Delete run from ${LARGE_HISTORY_SIZE} runs: ${deleteTime.toFixed(2)}ms`);
    expect(deleteTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    
    // Verify run was deleted correctly
    const updatedHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
    expect(updatedHistory.length).toBe(LARGE_HISTORY_SIZE - 1);
    expect(updatedHistory.find(run => run.id === runToDeleteId)).toBeUndefined();
  });
  
  it('should optimize storage by removing unused data from large history', () => {
    // Generate large run history with full GPS points
    const largeHistory = testServices.generateLargeHistory(LARGE_HISTORY_SIZE);
    
    // Save to localStorage and measure size
    localStorage.setItem('runHistory', JSON.stringify(largeHistory));
    const fullSize = localStorage.getItem('runHistory').length;
    
    console.log(`Full storage size: ${fullSize} bytes`);
    
    // Optimize storage by removing points from older runs
    const { duration: optimizeTime, result: optimizedHistory } = measurePerformance(() => {
      const history = JSON.parse(localStorage.getItem('runHistory') || '[]');
      
      // Sort by date
      history.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Keep detailed points only for the most recent 10 runs
      return history.map((run, index) => {
        if (index >= 10) {
          // For older runs, remove detailed GPS points to save space
          // eslint-disable-next-line no-unused-vars
          const { points, ...runWithoutPoints } = run;
          return runWithoutPoints;
        }
        return run;
      });
    });
    
    // Save optimized history
    localStorage.setItem('runHistory', JSON.stringify(optimizedHistory));
    
    // Measure optimized size
    const optimizedSize = localStorage.getItem('runHistory').length;
    
    console.log(`Optimization time: ${optimizeTime.toFixed(2)}ms`);
    console.log(`Optimized storage size: ${optimizedSize} bytes`);
    console.log(`Storage saved: ${(fullSize - optimizedSize)} bytes (${((fullSize - optimizedSize) / fullSize * 100).toFixed(2)}%)`);
    
    // Verify optimized history contains all runs
    expect(optimizedHistory.length).toBe(LARGE_HISTORY_SIZE);
    
    // Verify optimization reduced storage size
    expect(optimizedSize).toBeLessThan(fullSize);
    
    // Verify recent runs still have GPS points
    expect(optimizedHistory[0].points).toBeDefined();
    expect(optimizedHistory[5].points).toBeDefined();
    
    // Verify older runs have points removed
    expect(optimizedHistory[20].points).toBeUndefined();
    expect(optimizedHistory[50].points).toBeUndefined();
    
    // Performance should be reasonable
    expect(optimizeTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  });
}); 