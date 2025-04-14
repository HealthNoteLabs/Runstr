/**
 * Script to test distance tracking by simulating GPS movements
 * Can be used from the browser console to debug or verify tracking
 */

// Coordinates for simulating movement in a small area
// These points are roughly 10-50 meters apart (achievable in tests)
const testCoordinates = [
  { latitude: 40.7128, longitude: -74.0060, altitude: 10 }, // Start point
  { latitude: 40.7129, longitude: -74.0063, altitude: 12 }, // ~30m movement
  { latitude: 40.7131, longitude: -74.0067, altitude: 15 }, // ~40m movement
  { latitude: 40.7134, longitude: -74.0072, altitude: 18 }, // ~50m movement
  { latitude: 40.7138, longitude: -74.0075, altitude: 20 }, // ~45m movement
  { latitude: 40.7142, longitude: -74.0078, altitude: 18 }, // ~45m movement
  { latitude: 40.7145, longitude: -74.0080, altitude: 15 }, // ~35m movement
  { latitude: 40.7128, longitude: -74.0060, altitude: 10 }, // Return to start
];

// Run this function from browser console to test distance tracking
export const simulateMovement = async (options = {}) => {
  const { 
    delay = 2000,              // Delay between position updates (ms)
    mockBackgroundGeolocation = true, // Whether to mock the plugin 
    logDetails = true          // Whether to log details to console
  } = options;
  
  try {
    // Import necessary modules 
    const { runTracker } = await import('../src/services/RunTracker.js');
    
    // Clear previous listeners
    console.log('Setting up test environment...');
    
    // Add event listeners to log events
    const distanceListener = (distance) => {
      console.log(`Distance updated: ${distance.toFixed(2)}m`);
    };
    
    const elevationListener = (elevation) => {
      console.log(`Elevation: Current: ${elevation.current}m, Gain: ${elevation.gain.toFixed(2)}m, Loss: ${elevation.loss.toFixed(2)}m`);
    };
    
    runTracker.on('distanceChange', distanceListener);
    runTracker.on('elevationChange', elevationListener);
    
    if (mockBackgroundGeolocation) {
      // Mock the BackgroundGeolocation plugin
      console.log('Mocking BackgroundGeolocation plugin...');
      window.BackgroundGeolocation = {
        addWatcher: (config, callback) => {
          console.log('GPS tracking started with config:', config);
          window._mockGpsCallback = callback;
          return 'mock-watcher-id';
        },
        removeWatcher: () => {
          console.log('GPS tracking stopped');
          return Promise.resolve();
        }
      };
    }
    
    // Start run tracking
    console.log('Starting run tracking...');
    await runTracker.start();
    
    // Function to send a mock location
    const sendMockLocation = (location) => {
      if (window._mockGpsCallback) {
        window._mockGpsCallback(location);
        if (logDetails) {
          console.log(`Sent location: ${JSON.stringify(location)}`);
        }
      } else {
        console.error('GPS callback not set up correctly');
      }
    };
    
    // Send initial position
    console.log('Sending mock GPS positions...');
    sendMockLocation(testCoordinates[0]);
    
    // Iterate through coordinates with delay
    let index = 1;
    const positionInterval = setInterval(() => {
      if (index < testCoordinates.length) {
        sendMockLocation(testCoordinates[index]);
        index++;
      } else {
        clearInterval(positionInterval);
        console.log('Completed GPS simulation');
        console.log(`Final distance: ${runTracker.distance.toFixed(2)}m`);
        console.log(`Expected distance: ~250m`); // Approximate total of the test route
        
        // Cleanup
        runTracker.off('distanceChange', distanceListener);
        runTracker.off('elevationChange', elevationListener);
      }
    }, delay);
    
    return {
      stopTest: () => {
        clearInterval(positionInterval);
        runTracker.stop();
        console.log('Test manually stopped');
      }
    };
  } catch (error) {
    console.error('Error during simulated movement test:', error);
  }
};

// Function to check run history consistency
export const verifyRunHistory = () => {
  try {
    // Get run history from local storage
    const runHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
    console.log(`Found ${runHistory.length} runs in history`);
    
    if (runHistory.length === 0) {
      console.log('No runs found. Complete a run first.');
      return;
    }
    
    // Check the most recent run
    const latestRun = runHistory[runHistory.length - 1];
    console.log('Most recent run:');
    console.log('- Date:', latestRun.date);
    console.log('- Distance:', latestRun.distance, 'meters');
    console.log('- Duration:', latestRun.duration, 'seconds');
    console.log('- Pace:', latestRun.pace, 'seconds per meter');
    
    if (latestRun.elevation) {
      console.log('- Elevation gain:', latestRun.elevation.gain, 'meters');
      console.log('- Elevation loss:', latestRun.elevation.loss, 'meters');
    }
    
    // Check for potential issues in run data
    const issues = [];
    
    if (latestRun.distance <= 0) issues.push('Distance is zero or negative');
    if (latestRun.duration <= 0) issues.push('Duration is zero or negative');
    if (!latestRun.id) issues.push('Missing run ID');
    if (!latestRun.date) issues.push('Missing date');
    if (isNaN(new Date(latestRun.date).getTime())) issues.push('Invalid date format');
    
    if (issues.length > 0) {
      console.warn('Issues found in run data:');
      issues.forEach(issue => console.warn(`- ${issue}`));
    } else {
      console.log('Run data appears valid ✅');
    }
    
    return {
      isValid: issues.length === 0,
      runCount: runHistory.length,
      latestRun
    };
  } catch (error) {
    console.error('Error checking run history:', error);
    return { isValid: false, error: error.message };
  }
};

// Function to test nostr connectivity
export const testNostrConnection = async () => {
  try {
    // Import nostr utilities
    const { initializeNostr, fetchEvents } = await import('../src/utils/nostr.js');
    
    console.log('Testing Nostr connection...');
    const connected = await initializeNostr();
    
    if (connected) {
      console.log('✅ Successfully connected to Nostr network');
      
      // Try to fetch some recent events as a further test
      console.log('Fetching recent events...');
      const events = await fetchEvents({ kinds: [1], limit: 5 });
      
      if (events.size > 0) {
        console.log(`✅ Successfully fetched ${events.size} events`);
        console.log('Sample event:', [...events][0]);
      } else {
        console.log('⚠️ Connected but no events received');
      }
    } else {
      console.error('❌ Failed to connect to Nostr network');
    }
    
    return connected;
  } catch (error) {
    console.error('Error testing Nostr connection:', error);
    return false;
  }
};

// Export all test functions
window.RunstrTest = {
  simulateMovement,
  verifyRunHistory,
  testNostrConnection
};

console.log('Runstr test utilities loaded.');
console.log('You can now use these functions from the console:');
console.log('1. RunstrTest.simulateMovement() - Test distance tracking with simulated GPS');
console.log('2. RunstrTest.verifyRunHistory() - Check for issues in run history data');
console.log('3. RunstrTest.testNostrConnection() - Test Nostr connectivity'); 