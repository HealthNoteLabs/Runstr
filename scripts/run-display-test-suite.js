/**
 * Runstr Display Test Suite
 *
 * This script combines both the run simulation and display verification
 * to provide a comprehensive test suite for ensuring data consistency
 * across the Runstr application.
 */

// Create a test suite namespace
const RunstrTestSuite = {
  /**
   * Load all test modules
   */
  async loadModules() {
    try {
      console.log('🔄 Loading test modules...');
      
      // Load the run simulation module
      const simulationModule = await import('./test-run-display-consistency.js')
        .catch(error => {
          console.error('Failed to load simulation module:', error);
          return { RunDisplayTest: null };
        });
      
      // Load the display verification module
      const verificationModule = await import('./verify-display-consistency.js')
        .catch(error => {
          console.error('Failed to load verification module:', error);
          return { RunDisplayVerifier: null };
        });
      
      // Store module references
      this.simulator = simulationModule.RunDisplayTest;
      this.verifier = window.RunDisplayVerifier;
      
      if (!this.simulator) {
        console.error('❌ Failed to load simulation module!');
      } else {
        console.log('✅ Simulation module loaded successfully');
      }
      
      if (!this.verifier) {
        console.error('❌ Failed to load verification module!');
      } else {
        console.log('✅ Verification module loaded successfully');
      }
      
      return {
        simulator: this.simulator,
        verifier: this.verifier
      };
    } catch (error) {
      console.error('Error loading test modules:', error);
      return null;
    }
  },
  
  /**
   * Run a standard test scenario
   */
  async runStandardTest() {
    try {
      console.log('🏃‍♂️ Running standard test scenario...');
      
      // Load modules if not already loaded
      if (!this.simulator || !this.verifier) {
        await this.loadModules();
      }
      
      if (!this.simulator || !this.verifier) {
        console.error('❌ Cannot run test: modules not loaded!');
        return false;
      }
      
      // Step 1: Run a simulation of a standard 3km run (20 minutes)
      console.log('\n📊 STEP 1: Running standard 3km run simulation');
      const simResult = await this.simulator.simulateRun({
        totalDistance: 3000,  // 3km
        duration: 1200,       // 20 minutes
        coordinateDelay: 50,  // Faster simulation for testing
        autoStop: true
      });
      
      // Step 2: Wait for all events to process
      console.log('\n⏱️ STEP 2: Waiting for events to process...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Verify consistency across the app
      console.log('\n🔍 STEP 3: Verifying display consistency');
      const verifyResult = await this.verifier.verifyConsistency();
      
      // Print overall test results
      console.log('\n==================================');
      console.log('📝 TEST RESULTS SUMMARY');
      console.log('==================================');
      
      if (verifyResult && verifyResult.overallConsistency) {
        console.log('✅ TEST PASSED: Data displays consistently across the app!');
      } else {
        console.log('❌ TEST FAILED: Inconsistencies detected in data display.');
        console.log('   See details above for specific issues.');
      }
      
      return verifyResult;
    } catch (error) {
      console.error('Error running standard test:', error);
      return false;
    }
  },
  
  /**
   * Run a custom test with specific parameters
   */
  async runCustomTest(options = {}) {
    try {
      const {
        distance = 5000,        // 5km by default
        duration = 1800,        // 30 minutes by default
        coordinateDelay = 50,   // Faster simulation for testing
        verificationDelay = 1000 // Delay before verification
      } = options;
      
      console.log(`🏃‍♂️ Running custom test: ${distance/1000}km in ${Math.floor(duration/60)} minutes`);
      
      // Load modules if not already loaded
      if (!this.simulator || !this.verifier) {
        await this.loadModules();
      }
      
      if (!this.simulator || !this.verifier) {
        console.error('❌ Cannot run test: modules not loaded!');
        return false;
      }
      
      // Run the simulation
      console.log('\n📊 Running custom simulation...');
      await this.simulator.simulateRun({
        totalDistance: distance,
        duration: duration,
        coordinateDelay: coordinateDelay,
        autoStop: true
      });
      
      // Wait for processing
      console.log(`\n⏱️ Waiting ${verificationDelay}ms for events to process...`);
      await new Promise(resolve => setTimeout(resolve, verificationDelay));
      
      // Verify consistency
      console.log('\n🔍 Verifying display consistency...');
      return await this.verifier.verifyConsistency();
    } catch (error) {
      console.error('Error running custom test:', error);
      return false;
    }
  },
  
  /**
   * Directly access localStorage to check run data
   */
  inspectRunData() {
    try {
      const runHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
      
      console.log(`Found ${runHistory.length} runs in localStorage`);
      
      if (runHistory.length > 0) {
        console.log('\nMost recent run:');
        const latestRun = runHistory[0];
        
        // Format and display the run data in a readable way
        const formattedDate = new Date(latestRun.date).toLocaleString();
        const formattedDuration = `${Math.floor(latestRun.duration/60)}:${(latestRun.duration%60).toString().padStart(2,'0')}`;
        const formattedDistance = `${(latestRun.distance/1000).toFixed(2)} km`;
        
        console.log(`- Date: ${formattedDate}`);
        console.log(`- Duration: ${formattedDuration} (${latestRun.duration} seconds)`);
        console.log(`- Distance: ${formattedDistance} (${latestRun.distance} meters)`);
        
        if (latestRun.elevation) {
          console.log(`- Elevation Gain: ${latestRun.elevation.gain} meters`);
          console.log(`- Elevation Loss: ${latestRun.elevation.loss} meters`);
        }
        
        return latestRun;
      }
      
      return null;
    } catch (error) {
      console.error('Error inspecting run data:', error);
      return null;
    }
  }
};

// Automatically load modules when script is loaded
RunstrTestSuite.loadModules().then(() => {
  console.log('✅ Runstr Test Suite loaded and ready to use!');
});

// Export to global scope for browser console access
window.RunstrTestSuite = RunstrTestSuite;

// Print usage instructions
console.log('📋 Runstr Test Suite - Usage Instructions:');
console.log('1. RunstrTestSuite.runStandardTest() - Run a standard 3km test');
console.log('2. RunstrTestSuite.runCustomTest({ distance: 5000, duration: 1800 }) - Run a custom test');
console.log('3. RunstrTestSuite.inspectRunData() - Inspect the run data in localStorage');
console.log('4. RunstrTestSuite.simulator - Access the simulation module directly');
console.log('5. RunstrTestSuite.verifier - Access the verification module directly'); 