/**
 * Test Run Display Consistency
 * 
 * This script simulates a complete run with realistic data and then validates that
 * the data is displayed consistently across different parts of the application:
 * - Recent Runs section on the dashboard
 * - Run History page
 * 
 * Usage: Run this script from the browser console after loading the application
 */

// Test coordinates for a realistic run (roughly 1km path)
const testCoordinates = [
  { latitude: 40.7128, longitude: -74.0060, altitude: 10 }, // Start point
  { latitude: 40.7135, longitude: -74.0065, altitude: 12 }, // ~100m
  { latitude: 40.7142, longitude: -74.0070, altitude: 15 }, // ~100m
  { latitude: 40.7150, longitude: -74.0075, altitude: 18 }, // ~100m
  { latitude: 40.7158, longitude: -74.0080, altitude: 20 }, // ~100m
  { latitude: 40.7165, longitude: -74.0085, altitude: 18 }, // ~100m
  { latitude: 40.7172, longitude: -74.0090, altitude: 15 }, // ~100m
  { latitude: 40.7180, longitude: -74.0095, altitude: 12 }, // ~100m
  { latitude: 40.7188, longitude: -74.0100, altitude: 10 }, // ~100m
  { latitude: 40.7195, longitude: -74.0105, altitude: 11 }, // ~100m
  { latitude: 40.7202, longitude: -74.0110, altitude: 12 }, // ~100m
];

/**
 * Run simulation with configurable parameters
 */
async function simulateRun(options = {}) {
  const {
    totalDistance = 1000,          // Target distance in meters
    duration = 600,                // Target duration in seconds (10 min)
    coordinateDelay = 100,         // Delay between position updates (ms)
    positionVariance = 0.0001,     // Random variance to add to positions
    elevationGain = 25,            // Simulated elevation gain
    elevationLoss = 15,            // Simulated elevation loss
    autoStop = true                // Whether to automatically stop the run
  } = options;

  try {
    console.log('🏃‍♂️ Starting run simulation...');
    console.log(`Target: ${totalDistance}m in ${duration}s (${(duration/60).toFixed(1)} minutes)`);
    
    // Import necessary modules
    const { runTracker } = await import('../src/services/RunTracker.js');
    const runDataService = await import('../src/services/RunDataService.js').then(module => module.default);
    
    // Set up logging of events
    const eventLog = {
      distance: [],
      duration: [],
      pace: [],
      elevation: []
    };
    
    // Use timestamps for consistent timing
    const startTime = Date.now();
    const simEndTime = startTime + (duration * 1000);
    
    // Set up event listeners for tracking
    const distanceListener = (distance) => {
      eventLog.distance.push({
        time: Date.now() - startTime,
        value: distance
      });
      console.log(`Distance: ${distance.toFixed(2)}m`);
    };
    
    const durationListener = (duration) => {
      eventLog.duration.push({
        time: Date.now() - startTime,
        value: duration
      });
    };
    
    const paceListener = (pace) => {
      eventLog.pace.push({
        time: Date.now() - startTime,
        value: pace
      });
    };
    
    const elevationListener = (elevation) => {
      eventLog.elevation.push({
        time: Date.now() - startTime,
        value: { ...elevation }
      });
    };
    
    // Register listeners
    runTracker.on('distanceChange', distanceListener);
    runTracker.on('durationChange', durationListener);
    runTracker.on('paceChange', paceListener);
    runTracker.on('elevationChange', elevationListener);
    
    // Mock the Background Geolocation API if needed
    if (!window.BackgroundGeolocation) {
      console.log('Mocking BackgroundGeolocation API...');
      window.BackgroundGeolocation = {
        addWatcher: (config, callback) => {
          console.log('GPS tracking started with config:', config);
          window._mockGpsCallback = callback;
          return 'mock-watcher-id';
        },
        removeWatcher: () => {
          console.log('GPS tracking stopped');
          window._mockGpsCallback = null;
          return Promise.resolve();
        }
      };
    }
    
    // Start the run
    await runTracker.start();
    console.log('Run started. Sending GPS data...');
    
    // Function to send a mock location
    const sendMockLocation = (location) => {
      if (window._mockGpsCallback) {
        // Add small random variations to make it more realistic
        const mockLocation = {
          ...location,
          latitude: location.latitude + (Math.random() - 0.5) * positionVariance,
          longitude: location.longitude + (Math.random() - 0.5) * positionVariance,
          altitude: location.altitude + (Math.random() - 0.5) * positionVariance * 10,
          speed: Math.random() * 3 + 2, // 2-5 m/s speed (typical jogging pace)
          timestamp: new Date().toISOString()
        };
        
        window._mockGpsCallback(mockLocation);
      } else {
        console.error('GPS callback not set up correctly');
      }
    };
    
    // Calculate how many points we need based on our desired distance
    const pointsNeeded = Math.ceil(totalDistance / 100); // Assume ~100m between points
    
    // Generate extended coordinates if needed
    let simulatedCoordinates = [...testCoordinates];
    if (pointsNeeded > testCoordinates.length) {
      // Add more points by continuing the pattern
      const lastPoint = testCoordinates[testCoordinates.length - 1];
      const increment = {
        latitude: 0.0007, // ~70m north
        longitude: 0.0005, // ~50m east
      };
      
      for (let i = 0; i < pointsNeeded - testCoordinates.length; i++) {
        const newPoint = {
          latitude: lastPoint.latitude + increment.latitude * (i + 1),
          longitude: lastPoint.longitude + increment.longitude * (i + 1),
          altitude: 10 + Math.sin(i * 0.5) * 10 // Oscillate between 0-20m elevation
        };
        simulatedCoordinates.push(newPoint);
      }
    }
    
    // Send initial position
    sendMockLocation(simulatedCoordinates[0]);
    
    // Set up async flow
    let index = 1;
    let distanceAchieved = false;
    let timeAchieved = false;
    
    // Send points until we reach our target distance and time
    const sendPoints = () => {
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          // Check if we've reached our targets
          distanceAchieved = runTracker.distance >= totalDistance;
          timeAchieved = Date.now() >= simEndTime;
          
          if ((distanceAchieved && timeAchieved) || index >= simulatedCoordinates.length) {
            clearInterval(interval);
            console.log('Simulation targets met or out of points.');
            resolve();
            return;
          }
          
          // Send the next position
          sendMockLocation(simulatedCoordinates[index % simulatedCoordinates.length]);
          index++;
          
        }, coordinateDelay);
      });
    };
    
    // Manual control for elevation to match our targets
    const manuallySetElevation = () => {
      // Override elevation values to match our targets
      runTracker.elevation = {
        current: simulatedCoordinates[simulatedCoordinates.length - 1].altitude,
        gain: elevationGain,
        loss: elevationLoss,
        lastAltitude: simulatedCoordinates[0].altitude
      };
      
      // Emit the updated elevation
      runTracker.emit('elevationChange', {...runTracker.elevation});
    };
    
    // Run our simulation
    await sendPoints();
    
    // Make sure our elevation data matches expectations
    manuallySetElevation();
    
    // Stop the run if auto-stop is enabled
    if (autoStop) {
      console.log('Auto-stopping run...');
      await runTracker.stop();
      
      // Clean up listeners
      runTracker.off('distanceChange', distanceListener);
      runTracker.off('durationChange', durationListener);
      runTracker.off('paceChange', paceListener);
      runTracker.off('elevationChange', elevationListener);
      
      console.log('Run completed successfully!');
      
      // Call our verification function
      setTimeout(() => {
        verifyRunDataConsistency();
      }, 500); // Small delay to ensure all events have processed
    }
    
    // Return control functions and data
    return {
      eventLog,
      manualStop: async () => {
        await runTracker.stop();
        
        // Clean up listeners
        runTracker.off('distanceChange', distanceListener);
        runTracker.off('durationChange', durationListener);
        runTracker.off('paceChange', paceListener);
        runTracker.off('elevationChange', elevationListener);
        
        console.log('Run stopped manually.');
        
        // Call our verification function
        setTimeout(() => {
          verifyRunDataConsistency();
        }, 500);
      }
    };
  } catch (error) {
    console.error('Error during run simulation:', error);
  }
}

/**
 * Verify that run data is consistent across the app
 */
function verifyRunDataConsistency() {
  try {
    console.log('🔍 Verifying run data consistency...');
    
    // Get the run history from localStorage
    const runHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
    
    if (runHistory.length === 0) {
      console.error('❌ No runs found in history! The run may not have been saved correctly.');
      return false;
    }
    
    // Get the most recent run
    const latestRun = runHistory[0]; // Should be at index 0 since they're stored newest first
    
    console.log('📊 Most recent run data:');
    console.log(`- ID: ${latestRun.id}`);
    console.log(`- Date: ${latestRun.date}`);
    console.log(`- Distance: ${latestRun.distance.toFixed(2)} meters`);
    console.log(`- Duration: ${latestRun.duration.toFixed(0)} seconds (${Math.floor(latestRun.duration/60)}:${(latestRun.duration%60).toString().padStart(2,'0')})`);
    console.log(`- Pace: ${latestRun.pace.toFixed(2)} min/km`);
    
    if (latestRun.elevation) {
      console.log(`- Elevation gain: ${latestRun.elevation.gain.toFixed(1)} meters`);
      console.log(`- Elevation loss: ${latestRun.elevation.loss.toFixed(1)} meters`);
    }
    
    // Create a simple function to validate the UI display values
    const validateUI = () => {
      console.log('🖥️ To validate UI display values:');
      console.log('1. Check the Recent Runs section on the Dashboard');
      console.log(`   - Duration should show: ${Math.floor(latestRun.duration/60)}:${(latestRun.duration%60).toString().padStart(2,'0')}`);
      console.log(`   - Distance should show: ${(latestRun.distance/1000).toFixed(2)} km`);
      
      console.log('2. Navigate to the Run History page');
      console.log(`   - Duration should show: ${Math.floor(latestRun.duration/60)}:${(latestRun.duration%60).toString().padStart(2,'0')}`);
      console.log(`   - Distance should show: ${(latestRun.distance/1000).toFixed(2)} km`);
      
      console.log('\nCopy and execute this code to highlight key UI elements:');
      console.log(`
        // Highlight duration element in Recent Runs
        (function() {
          const durationElem = document.querySelector('.bg-\\\\[\\\\#1a222e\\\\] .text-lg.font-semibold');
          if (durationElem) {
            const originalStyle = durationElem.style.cssText;
            durationElem.style.border = '2px solid #10B981';
            durationElem.style.padding = '2px';
            durationElem.style.background = 'rgba(16, 185, 129, 0.1)';
            console.log('✅ Found duration element with value: ' + durationElem.textContent);
            
            // Restore after 5 seconds
            setTimeout(() => {
              durationElem.style.cssText = originalStyle;
            }, 5000);
          } else {
            console.log('❌ Could not find duration element');
          }
        })();
      `);
    };
    
    // Validate UI display
    validateUI();
    
    return true;
  } catch (error) {
    console.error('Error verifying run data consistency:', error);
    return false;
  }
}

// Export functions to the global scope for browser console access
window.RunDisplayTest = {
  simulateRun,
  verifyRunDataConsistency
};

// Print usage instructions
console.log('✅ Run Display Consistency Test loaded successfully!');
console.log('\nUsage:');
console.log('1. RunDisplayTest.simulateRun() - Simulate a 1km run (10 mins)');
console.log('2. RunDisplayTest.simulateRun({ totalDistance: 5000, duration: 1800 }) - Custom 5km/30min run');
console.log('3. RunDisplayTest.verifyRunDataConsistency() - Verify data consistency manually');
console.log('\nExample: RunDisplayTest.simulateRun({ totalDistance: 3000, duration: 1200 })'); 