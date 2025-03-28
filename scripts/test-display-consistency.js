import puppeteer from 'puppeteer';
import http from 'http';
import handler from 'serve-handler';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * Test Run Display Consistency
 * 
 * This script:
 * 1. Starts a local server to serve the app
 * 2. Launches a headless browser with Puppeteer
 * 3. Simulates a run
 * 4. Checks if the Recent Runs section displays the correct duration and distance
 */

// Get current directory with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create server to host the app
const server = http.createServer((request, response) => {
  // Serve files from the dist directory if it exists, otherwise from the root
  const publicDir = fs.existsSync(path.join(process.cwd(), 'dist')) 
    ? 'dist' 
    : '.';
  
  return handler(request, response, {
    public: publicDir,
  });
});

// Start the server on a random port
let PORT = 0;
const runTest = async () => {
  try {
    // Launch server
    await new Promise((resolve) => {
      server.listen(() => {
        const address = server.address();
        PORT = address.port;
        console.log(`Server running at http://localhost:${PORT}`);
        resolve();
      });
    });

    // Launch browser
    console.log('📊 Launching headless browser...');
    const browser = await puppeteer.launch({
      headless: 'new', // Use the new headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to the app
    console.log(`🌐 Navigating to app at http://localhost:${PORT}`);
    await page.goto(`http://localhost:${PORT}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for app to load
    console.log('⏳ Waiting for app to load...');
    await page.waitForSelector('body', { timeout: 5000 });
    
    // Check if we need to set permissions
    const permissionDialog = await page.$('.permission-dialog');
    if (permissionDialog) {
      console.log('🔑 Setting location permissions...');
      await page.evaluate(() => {
        localStorage.setItem('permissionsGranted', 'true');
        window.location.reload();
      });
      
      // Wait for reload
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }
    
    // Inject mock GPS
    console.log('📍 Setting up mock GPS...');
    await page.evaluate(() => {
      // Mock the Background Geolocation plugin
      window.BackgroundGeolocation = {
        addWatcher: (config, callback) => {
          console.log('GPS tracking started');
          window._mockGpsCallback = callback;
          return 'mock-watcher-id';
        },
        removeWatcher: () => {
          console.log('GPS tracking stopped');
          return Promise.resolve();
        }
      };
      
      // Store any existing run history
      window._originalRunHistory = localStorage.getItem('runHistory');
    });
    
    // Start a run
    console.log('🏃‍♂️ Starting a simulated run...');
    
    // Simulate 5 seconds countdown
    await page.click('.from-indigo-600'); // Click start button
    
    // Wait for countdown to complete and run to start
    console.log('⏱️ Waiting for countdown...');
    await page.waitForSelector('.z-50', { timeout: 10000 }); // Wait for countdown overlay
    await page.waitForFunction(() => !document.querySelector('.z-50'), { timeout: 10000 }); // Wait for countdown to disappear
    
    // Set run duration and distance variables
    const RUN_DURATION = 300; // 5 minutes in seconds
    const RUN_DISTANCE = 1000; // 1km in meters
    
    // Simulate GPS movement
    console.log('📡 Simulating GPS movement...');
    await page.evaluate((distance, duration) => {
      // Import the RunTracker services
      const runTracker = window.runTracker || {};
      if (!runTracker) {
        console.error('RunTracker not found');
        return;
      }
      
      // Hack to set data directly rather than simulating full GPS movement
      runTracker.distance = distance;
      runTracker.duration = duration;
      runTracker.pace = duration / 60 / (distance / 1000); // min/km pace
      
      // Emit events to update UI
      if (runTracker.emit) {
        runTracker.emit('distanceChange', distance);
        runTracker.emit('durationChange', duration);
        runTracker.emit('paceChange', runTracker.pace);
      }
      
      // Needed for completion checks
      window._simRunData = {
        distance: distance,
        duration: duration,
        pace: runTracker.pace
      };
    }, RUN_DISTANCE, RUN_DURATION);
    
    // Wait a moment for UI to update
    await page.waitForTimeout(2000);
    
    // Stop the run
    console.log('🛑 Stopping the run...');
    
    // Click the stop button
    const stopButton = await page.$('.bg-red-600');
    if (stopButton) {
      await stopButton.click();
      
      // Wait for countdown and stopping to complete
      await page.waitForSelector('.z-50', { timeout: 10000 }); // Wait for countdown overlay
      await page.waitForFunction(() => !document.querySelector('.z-50'), { timeout: 10000 }); // Wait for countdown to disappear
    } else {
      console.warn('Stop button not found, manually stopping run');
      
      // Directly stop the run if button not found
      await page.evaluate(() => {
        const runTracker = window.runTracker || {};
        if (runTracker && runTracker.stop) {
          runTracker.stop();
        }
      });
    }
    
    // Give time for the run to be saved and UI to update
    console.log('⏳ Waiting for run data to be saved...');
    await page.waitForTimeout(500);
    
    // Wait for Recent Runs section to appear
    await page.waitForSelector('.bg-\\[\\#1a222e\\]', { timeout: 10000 });
    
    // Extract data from Recent Runs section
    console.log('🔍 Verifying Recent Runs display...');
    const displayData = await page.evaluate(() => {
      // Get the expected data from localStorage
      const runHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
      const expectedRun = runHistory.length > 0 ? runHistory[0] : null;
      
      // Format expected values
      const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '--:--';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };
      
      const formatDistance = (meters, unit = 'km') => {
        if (meters === 0) return `0.00 ${unit}`;
        const value = unit === 'km' ? meters / 1000 : meters / 1609.344;
        return `${value.toFixed(2)} ${unit}`;
      };
      
      // Get displayed values
      const durationElem = document.querySelector('.bg-\\[\\#1a222e\\] .text-lg.font-semibold');
      const distanceElem = document.querySelector('.flex.items-center.text-xs.text-gray-400 span:first-child');
      const paceElem = document.querySelector('.bg-gray-800.rounded-full');
      
      let displayedDistance = null;
      if (distanceElem) {
        const text = distanceElem.textContent;
        const parts = text.split('•');
        if (parts.length > 1) {
          displayedDistance = parts[1].trim();
        }
      }
      
      // Get raw values from simulation
      const simData = window._simRunData || { distance: 0, duration: 0 };
      
      return {
        expected: expectedRun ? {
          duration: formatTime(expectedRun.duration),
          distance: formatDistance(expectedRun.distance),
          rawDuration: expectedRun.duration,
          rawDistance: expectedRun.distance
        } : null,
        displayed: {
          duration: durationElem ? durationElem.textContent.trim() : null,
          distance: displayedDistance,
          pace: paceElem ? paceElem.textContent.trim() : null
        },
        simulated: {
          duration: formatTime(simData.duration),
          distance: formatDistance(simData.distance),
          rawDuration: simData.duration,
          rawDistance: simData.distance
        }
      };
    });
    
    // Format results for display
    console.log('\n================= TEST RESULTS =================');
    console.log('DURATION CHECK:');
    if (displayData.expected) {
      console.log(`Expected:   ${displayData.expected.duration} (${displayData.expected.rawDuration}s)`);
    }
    console.log(`Simulated:  ${displayData.simulated.duration} (${displayData.simulated.rawDuration}s)`);
    console.log(`Displayed:  ${displayData.displayed.duration}`);
    
    console.log('\nDISTANCE CHECK:');
    if (displayData.expected) {
      console.log(`Expected:   ${displayData.expected.distance} (${displayData.expected.rawDistance}m)`);
    }
    console.log(`Simulated:  ${displayData.simulated.distance} (${displayData.simulated.rawDistance}m)`);
    console.log(`Displayed:  ${displayData.displayed.distance}`);
    
    console.log('\nPACE:');
    console.log(`Displayed:  ${displayData.displayed.pace}`);
    
    // Determine if test passed
    let durationMatch = false;
    let distanceMatch = false;
    
    if (displayData.expected) {
      // Compare with expected (from localStorage)
      durationMatch = displayData.displayed.duration === displayData.expected.duration;
      
      // For distance, extract numbers for comparison to avoid unit issues
      const extractNumber = (str) => {
        const match = str.match(/(\d+\.\d+)/);
        return match ? parseFloat(match[1]) : null;
      };
      
      const displayedDistNumber = extractNumber(displayData.displayed.distance);
      const expectedDistNumber = extractNumber(displayData.expected.distance);
      
      if (displayedDistNumber !== null && expectedDistNumber !== null) {
        // Allow small rounding differences
        distanceMatch = Math.abs(displayedDistNumber - expectedDistNumber) < 0.1;
      }
    } else {
      // Compare with simulated values
      durationMatch = displayData.displayed.duration === displayData.simulated.duration;
      
      // For distance, extract numbers for comparison to avoid unit issues
      const extractNumber = (str) => {
        const match = str.match(/(\d+\.\d+)/);
        return match ? parseFloat(match[1]) : null;
      };
      
      const displayedDistNumber = extractNumber(displayData.displayed.distance);
      const simulatedDistNumber = extractNumber(displayData.simulated.distance);
      
      if (displayedDistNumber !== null && simulatedDistNumber !== null) {
        // Allow small rounding differences
        distanceMatch = Math.abs(displayedDistNumber - simulatedDistNumber) < 0.1;
      }
    }
    
    const testPassed = durationMatch && distanceMatch;
    
    console.log('\nTEST RESULT:');
    console.log(`Duration Match: ${durationMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Distance Match: ${distanceMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Overall Test:   ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    // Clean up
    console.log('\n⏳ Cleaning up...');
    
    // Restore original run history if it existed
    await page.evaluate(() => {
      if (window._originalRunHistory) {
        localStorage.setItem('runHistory', window._originalRunHistory);
      } else {
        localStorage.removeItem('runHistory');
      }
    });
    
    // Close browser and server
    await browser.close();
    server.close();
    
    // Exit with appropriate code
    console.log('✅ Test completed.');
    process.exit(testPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    server.close();
    process.exit(1);
  }
};

// Run the test
runTest(); 