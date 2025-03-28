/**
 * Terminal-Only Run Tracker Test
 * 
 * This script tests the run data consistency by:
 * 1. Directly calling the RunTracker service functions
 * 2. Simulating a run with specified duration and distance
 * 3. Verifying the data is stored correctly in localStorage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock localStorage for Node environment
global.localStorage = {
  store: {},
  getItem: function(key) {
    return this.store[key] || null;
  },
  setItem: function(key, value) {
    this.store[key] = value.toString();
  },
  removeItem: function(key) {
    delete this.store[key];
  },
  clear: function() {
    this.store = {};
  }
};

// Mock window object
global.window = {
  localStorage: global.localStorage
};

// Mock document for event listeners
const eventListeners = {};
global.document = {
  addEventListener: (event, callback) => {
    if (!eventListeners[event]) {
      eventListeners[event] = [];
    }
    eventListeners[event].push(callback);
  },
  removeEventListener: (event, callback) => {
    if (eventListeners[event]) {
      const index = eventListeners[event].indexOf(callback);
      if (index !== -1) {
        eventListeners[event].splice(index, 1);
      }
    }
  },
  dispatchEvent: (event) => {
    if (eventListeners[event.type]) {
      eventListeners[event.type].forEach(callback => {
        callback(event);
      });
    }
  }
};

// Mock CustomEvent
global.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail || null;
  }
};

// Run the test
async function runTest() {
  console.log('🧪 Starting Run Tracker Test (Terminal Only)');
  
  try {
    console.log('⏳ Loading modules...');
    
    // Load modules dynamically with better error handling
    let RunTracker, runTracker, RunDataService;
    try {
      // Import RunTracker
      const RunTrackerModule = await import('../src/services/RunTracker.js')
        .catch(error => {
          throw new Error(`Failed to import RunTracker: ${error.message}\nTry running this from project root with: node scripts/terminal-only-test.js`);
        });
      
      // Extract the runTracker instance and class
      RunTracker = RunTrackerModule.default;
      runTracker = RunTrackerModule.runTracker;
      
      if (!runTracker) {
        throw new Error('RunTracker instance not found, try checking the exports in src/services/RunTracker.js');
      }
      
      // Import RunDataService
      RunDataService = await import('../src/services/RunDataService.js')
        .then(module => module.default)
        .catch(error => {
          throw new Error(`Failed to import RunDataService: ${error.message}`);
        });
      
      if (!RunDataService) {
        throw new Error('RunDataService not found');
      }
    } catch (error) {
      console.error('❌ Module loading error:', error.message);
      // Try the alternative path for vite bundled projects
      console.log('⏳ Trying alternative import paths...');
      try {
        // Try to load the compiled bundle if it exists
        if (fs.existsSync(path.join(process.cwd(), 'dist', 'assets'))) {
          const files = fs.readdirSync(path.join(process.cwd(), 'dist', 'assets'));
          const jsFile = files.find(file => file.endsWith('.js'));
          if (jsFile) {
            console.log(`Found bundle: ${jsFile}. Try running the app first with 'npm run dev' or 'npm run build'`);
          }
        }
      } catch (err) {
        // Ignore errors in the fallback
      }
      
      console.log('\n❌ This test requires direct access to the source modules.');
      console.log('Try running one of the browser-based tests instead:');
      console.log('npm run test-display:win (for Windows)');
      console.log('npm run test-display:unix (for Unix/Mac)');
      process.exit(1);
    }
    
    console.log('✅ Modules loaded successfully');
    
    // Set up and validate RunTracker
    if (!runTracker || typeof runTracker.start !== 'function' || 
        typeof runTracker.stop !== 'function') {
      console.error('❌ Invalid RunTracker module structure');
      process.exit(1);
    }
    
    console.log('🏃‍♂️ Simulating a run...');
    
    // Set test parameters
    const TEST_DURATION = 300; // 5 minutes
    const TEST_DISTANCE = 1000; // 1 km
    
    // Mock any needed methods for testing
    runTracker.startTracking = async function() {
      console.log('  Mock GPS tracking started');
      return Promise.resolve();
    };
    
    runTracker.stopTracking = async function() {
      console.log('  Mock GPS tracking stopped');
      return Promise.resolve();
    };
    
    // Make sure we start with clean state
    localStorage.clear();
    
    // Begin the run
    console.log('  Starting the run...');
    await runTracker.start();
    
    // Simulate data accumulation - directly set the values
    console.log(`  Setting distance to ${TEST_DISTANCE}m and duration to ${TEST_DURATION}s`);
    runTracker.distance = TEST_DISTANCE;
    runTracker.duration = TEST_DURATION;
    runTracker.pace = TEST_DURATION / 60 / (TEST_DISTANCE / 1000); // min/km
    
    // Add some elevation data for completeness
    runTracker.elevation = {
      current: 100,
      gain: 25,
      loss: 15,
      lastAltitude: 100
    };
    
    // Emit events to trigger UI updates in a real app
    runTracker.emit('distanceChange', runTracker.distance);
    runTracker.emit('durationChange', runTracker.duration);
    runTracker.emit('paceChange', runTracker.pace);
    runTracker.emit('elevationChange', runTracker.elevation);
    
    // Stop the run to save the data
    console.log('  Stopping the run...');
    await runTracker.stop();
    
    // Give a moment for any asynchronous operations to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Check if the run was saved correctly
    console.log('\n🔍 Checking run data consistency...');
    
    // Get the saved run history
    const runHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
    
    if (runHistory.length === 0) {
      console.error('❌ No run data was saved to localStorage!');
      process.exit(1);
    }
    
    // Get the most recent run (should be first in the array)
    const savedRun = runHistory[0];
    
    console.log('\n📊 Run Data in localStorage:');
    console.log(`  Distance: ${savedRun.distance}m (Expected: ${TEST_DISTANCE}m)`);
    console.log(`  Duration: ${savedRun.duration}s (Expected: ${TEST_DURATION}s)`);
    console.log(`  Pace: ${savedRun.pace ? savedRun.pace.toFixed(2) : 'N/A'} min/km`);
    
    if (savedRun.elevation) {
      console.log('  Elevation:');
      console.log(`    Gain: ${savedRun.elevation.gain}m`);
      console.log(`    Loss: ${savedRun.elevation.loss}m`);
    }
    
    // Verify if values match
    const distanceMatch = savedRun.distance === TEST_DISTANCE;
    const durationMatch = savedRun.duration === TEST_DURATION;
    
    console.log('\n🏁 Test Results:');
    console.log(`  Distance Test: ${distanceMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Duration Test: ${durationMatch ? '✅ PASS' : '❌ FAIL'}`);
    
    const testPassed = distanceMatch && durationMatch;
    console.log(`\n  Overall Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    // Return appropriate exit code
    process.exit(testPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
runTest(); 