/**
 * Runstr Test Runner
 * 
 * This script runs automated tests for various features of the Runstr app.
 * Usage:
 * 1. Start the development server with `npm run dev`
 * 2. Open the browser console
 * 3. Run this script with `node scripts/test-runner.js`
 */

import { simulateMovement, verifyRunHistory, testNostrConnection } from './test-distance-tracking.js';

// Automated test battery
const runAllTests = async () => {
  console.log('=== RUNSTR AUTOMATED TEST SUITE ===');
  console.log('Starting automated tests...');
  
  // Test 1: Verify run history data
  console.log('\n--- Test 1: Run History Data Integrity ---');
  const historyResults = verifyRunHistory();
  
  // Test 2: Test Nostr connection
  console.log('\n--- Test 2: Nostr Connectivity ---');
  const nostrConnected = await testNostrConnection();
  
  // Test 3: Simulate movement for distance tracking
  console.log('\n--- Test 3: Distance Tracking Simulation ---');
  console.log('Starting simulated movement test...');
  
  const movementSimulation = await simulateMovement({
    delay: 1000, // Use faster updates for automated testing
    logDetails: false // Reduce console noise
  });
  
  // Wait for the simulation to complete (8 positions * 1000ms = ~8 seconds)
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Cleanup after test completion
  if (movementSimulation && movementSimulation.stopTest) {
    movementSimulation.stopTest();
  }
  
  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Run History: ${historyResults?.isValid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Nostr Connection: ${nostrConnected ? '✅ PASS' : '❌ FAIL'}`);
  console.log('Distance Tracking: Check console output above');
  
  console.log('\nTests completed. You can run individual tests using:');
  console.log('- RunstrTest.verifyRunHistory()');
  console.log('- RunstrTest.testNostrConnection()');
  console.log('- RunstrTest.simulateMovement()');
};

// Execute all tests
if (typeof window !== 'undefined') {
  // Only run in browser environment
  window.runAllTests = runAllTests;
  console.log('Test runner loaded. Run all tests with window.runAllTests()');
}

export { runAllTests }; 