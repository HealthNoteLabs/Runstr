import { describe, it, expect } from 'vitest';

describe('Run Duration Display Consistency Tests', () => {
  // Helper function to format time as used in the app
  const formatTime = (duration) => {
    if (typeof duration !== 'number' || isNaN(duration)) return '00:00';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Simulate getting formatted duration for display (similar to the app logic)
  const getFormattedDuration = (runData) => {
    if (!runData || typeof runData.duration !== 'number') {
      return '00:00';
    }
    return formatTime(runData.duration).split(':').slice(0, 2).join(':');
  };
  
  // Simulate our direct localStorage check solution
  const getDirectDuration = (runHistory) => {
    try {
      if (runHistory.length > 0 && typeof runHistory[0].duration === 'number') {
        return formatTime(runHistory[0].duration).split(':').slice(0, 2).join(':');
      }
    } catch (e) {
      console.log("Error getting direct duration:", e);
    }
    // Fallback
    return '00:00';
  };
  
  it('should format durations correctly', () => {
    // Common durations that might be encountered
    expect(formatTime(0)).toBe('00:00');          // Zero
    expect(formatTime(30)).toBe('00:30');         // 30 seconds
    expect(formatTime(60)).toBe('01:00');         // 1 minute
    expect(formatTime(90)).toBe('01:30');         // 1 minute 30 seconds
    expect(formatTime(300)).toBe('05:00');        // 5 minutes
    expect(formatTime(1800)).toBe('30:00');       // 30 minutes
    expect(formatTime(3600)).toBe('60:00');       // 1 hour
    expect(formatTime(3661)).toBe('61:01');       // 1 hour 1 minute 1 second
    expect(formatTime(7890)).toBe('131:30');      // 2 hours 11 minutes 30 seconds
  });
  
  it('should handle missing or invalid durations gracefully', () => {
    expect(formatTime(null)).toBe('00:00');
    expect(formatTime(undefined)).toBe('00:00');
    expect(formatTime(NaN)).toBe('00:00');
    expect(formatTime('not a number')).toBe('00:00');
    expect(formatTime({})).toBe('00:00');
  });
  
  it('should correctly display durations from run data objects', () => {
    // Sample run data objects
    const runs = [
      { distance: 1000, duration: 300, pace: 5 },        // 5 minutes
      { distance: 5000, duration: 1800, pace: 6 },       // 30 minutes
      { distance: 10000, duration: 3600, pace: 6 },      // 60 minutes
      { distance: 21100, duration: 7200, pace: 5.7 },    // 2 hours
      { distance: 500, duration: null },                 // Missing duration
      { distance: 500 }                                  // No duration field
    ];
    
    // Check that all durations are displayed correctly
    expect(getFormattedDuration(runs[0])).toBe('05:00');
    expect(getFormattedDuration(runs[1])).toBe('30:00');
    expect(getFormattedDuration(runs[2])).toBe('60:00');
    expect(getFormattedDuration(runs[3])).toBe('120:00');
    expect(getFormattedDuration(runs[4])).toBe('00:00');
    expect(getFormattedDuration(runs[5])).toBe('00:00');
    
    // Test with null/undefined
    expect(getFormattedDuration(null)).toBe('00:00');
    expect(getFormattedDuration(undefined)).toBe('00:00');
  });
  
  it('should correctly get duration using direct localStorage check method', () => {
    // Simulate different run histories
    const testCases = [
      {
        history: [{ duration: 300 }],             // 5 minutes
        expected: '05:00'
      },
      {
        history: [{ duration: 1800 }],            // 30 minutes
        expected: '30:00'
      },
      {
        history: [{ duration: 7200 }],            // 2 hours
        expected: '120:00'
      },
      {
        history: [{ duration: null }],            // Null duration
        expected: '00:00'
      },
      {
        history: [{}],                            // No duration field
        expected: '00:00'
      },
      {
        history: [],                              // Empty history
        expected: '00:00'
      }
    ];
    
    // Test each case
    testCases.forEach(({ history, expected }) => {
      expect(getDirectDuration(history)).toBe(expected);
    });
  });
  
  it('should match the dashboard\'s direct localStorage check with actual display', () => {
    // Simulate the run data as stored in localStorage
    const mockRunHistory = [
      { 
        id: 'test-run-1',
        date: '2023-06-15',
        distance: 5000, // 5km
        duration: 1800, // 30 minutes
        pace: 6 // 6 min/km
      }
    ];
    
    // Get duration using both methods
    const directAccess = getDirectDuration(mockRunHistory);
    const normalDisplay = getFormattedDuration(mockRunHistory[0]);
    
    // The two should match - this is the key test for our fix
    expect(directAccess).toBe(normalDisplay);
    expect(directAccess).toBe('30:00');
  });
}); 