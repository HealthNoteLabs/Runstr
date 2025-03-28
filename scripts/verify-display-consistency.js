/**
 * Run Display Consistency Verification
 * 
 * This script verifies that run data displays consistently across:
 * 1. Recent Runs section on the Dashboard
 * 2. Run History page
 * 
 * It performs direct DOM inspection to extract and compare displayed values
 */

// Create a namespace to avoid conflicts
const RunDisplayVerifier = {
  
  /**
   * Extract run data from the Recent Runs section on the Dashboard
   */
  getDashboardRunData() {
    try {
      console.log('🔍 Inspecting Dashboard Recent Runs section...');
      
      // Select the Recent Runs container
      const recentRunsContainer = document.querySelector('.bg-\\[\\#1a222e\\] .p-4');
      
      if (!recentRunsContainer) {
        console.error('❌ Could not find Recent Runs section on Dashboard');
        return null;
      }
      
      // Extract duration
      const durationElement = recentRunsContainer.querySelector('.text-lg.font-semibold');
      const duration = durationElement ? durationElement.textContent.trim() : null;
      
      // Extract distance
      const distanceElement = recentRunsContainer.querySelector('.flex.items-center.text-xs.text-gray-400 span:first-child');
      let distance = null;
      if (distanceElement) {
        const textParts = distanceElement.textContent.trim().split('•');
        if (textParts.length > 1) {
          distance = textParts[1].trim();
        }
      }
      
      // Extract pace
      const paceElement = recentRunsContainer.querySelector('.bg-gray-800.rounded-full');
      const pace = paceElement ? paceElement.textContent.trim() : null;
      
      console.log('📊 Dashboard Recent Run Display:');
      console.log(`- Duration: ${duration || 'Not found'}`);
      console.log(`- Distance: ${distance || 'Not found'}`);
      console.log(`- Pace: ${pace || 'Not found'}`);
      
      return { duration, distance, pace };
    } catch (error) {
      console.error('Error extracting dashboard run data:', error);
      return null;
    }
  },
  
  /**
   * Navigate to Run History page and extract data from there
   */
  async getHistoryPageData() {
    try {
      console.log('📝 Navigating to Run History page...');
      
      // First check if we're already on the history page
      const currentPath = window.location.pathname;
      let needToNavigateBack = false;
      
      // If we're not on the history page, navigate there
      if (!currentPath.includes('/history')) {
        needToNavigateBack = true;
        
        // Check if we have a history navigation element
        const historyNavLink = document.querySelector('a[href="/history"]');
        if (historyNavLink) {
          console.log('Found history link, clicking it...');
          historyNavLink.click();
        } else {
          // Direct navigation
          console.log('No history link found, navigating directly...');
          window.location.href = '/history';
          
          // Wait for navigation to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Allow time for page to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now extract data from the history page
      console.log('🔍 Inspecting Run History page...');
      
      // Find the first run in the history list
      const firstRunElement = document.querySelector('.run-list-item, .run-card');
      
      if (!firstRunElement) {
        console.error('❌ Could not find run items in Run History page');
        return null;
      }
      
      // Extract duration
      const durationElement = firstRunElement.querySelector('.duration, [data-testid="run-duration"]');
      const duration = durationElement ? durationElement.textContent.trim() : null;
      
      // Extract distance
      const distanceElement = firstRunElement.querySelector('.distance, [data-testid="run-distance"]');
      const distance = distanceElement ? distanceElement.textContent.trim() : null;
      
      // Extract pace
      const paceElement = firstRunElement.querySelector('.pace, [data-testid="run-pace"]');
      const pace = paceElement ? paceElement.textContent.trim() : null;
      
      console.log('📊 Run History Page Display:');
      console.log(`- Duration: ${duration || 'Not found'}`);
      console.log(`- Distance: ${distance || 'Not found'}`);
      console.log(`- Pace: ${pace || 'Not found'}`);
      
      // If we navigated to history page, go back
      if (needToNavigateBack) {
        console.log('Navigating back to previous page...');
        window.history.back();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return { duration, distance, pace };
    } catch (error) {
      console.error('Error extracting history page run data:', error);
      return null;
    }
  },
  
  /**
   * Compare run data from localStorage with what's displayed in the UI
   */
  compareWithLocalStorage() {
    try {
      console.log('🔍 Comparing displayed data with localStorage data...');
      
      // Get run history from localStorage
      const runHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
      
      if (runHistory.length === 0) {
        console.error('❌ No runs found in localStorage!');
        return false;
      }
      
      // Get the most recent run
      const latestRun = runHistory[0]; // Should be newest first
      
      console.log('📊 Most recent run in localStorage:');
      console.log(`- ID: ${latestRun.id || 'unknown'}`);
      console.log(`- Date: ${latestRun.date || 'unknown'}`);
      console.log(`- Distance: ${latestRun.distance ? (latestRun.distance/1000).toFixed(2) + ' km' : 'unknown'}`);
      console.log(`- Duration: ${latestRun.duration ? Math.floor(latestRun.duration/60) + ':' + (latestRun.duration%60).toString().padStart(2,'0') : 'unknown'}`);
      console.log(`- Raw Duration: ${latestRun.duration || 'unknown'} seconds`);
      
      // Format duration to match UI format (mm:ss)
      const formattedDuration = latestRun.duration ?
        `${Math.floor(latestRun.duration/60)}:${(latestRun.duration%60).toString().padStart(2,'0')}` :
        'unknown';
        
      // Format distance to match UI format
      const distanceUnit = localStorage.getItem('distanceUnit') || 'km';
      const formattedDistance = latestRun.distance ?
        `${(distanceUnit === 'km' ? latestRun.distance/1000 : latestRun.distance/1609.344).toFixed(2)} ${distanceUnit}` :
        'unknown';
      
      return {
        expectedDuration: formattedDuration,
        expectedDistance: formattedDistance,
        actualRun: latestRun
      };
    } catch (error) {
      console.error('Error comparing with localStorage:', error);
      return null;
    }
  },
  
  /**
   * Verify consistency between dashboard and history page
   */
  async verifyConsistency() {
    try {
      console.log('🧪 Starting display consistency verification...');
      
      // First get the localStorage data as our source of truth
      const localStorageData = this.compareWithLocalStorage();
      if (!localStorageData) {
        console.error('❌ Failed to get localStorage data for comparison');
        return false;
      }
      
      // Get dashboard data
      const dashboardData = this.getDashboardRunData();
      if (!dashboardData) {
        console.error('❌ Failed to get dashboard run data');
        return false;
      }
      
      // Get history page data
      const historyData = await this.getHistoryPageData();
      if (!historyData) {
        console.error('❌ Failed to get history page run data');
        return false;
      }
      
      // Compare the data
      console.log('\n📋 Consistency Check Results:');
      
      // Check duration consistency
      const durationConsistent = 
        dashboardData.duration === historyData.duration && 
        (dashboardData.duration === localStorageData.expectedDuration || 
         dashboardData.duration.includes(localStorageData.expectedDuration));
      
      console.log(`Duration Consistency: ${durationConsistent ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`- Dashboard: ${dashboardData.duration}`);
      console.log(`- History Page: ${historyData.duration}`);
      console.log(`- Expected (localStorage): ${localStorageData.expectedDuration}`);
      
      // Check distance consistency (more flexible matching since formatting might vary)
      const dashboardDistance = dashboardData.distance ? 
        parseFloat(dashboardData.distance.replace(/[^0-9.]/g, '')) : null;
      const historyDistance = historyData.distance ? 
        parseFloat(historyData.distance.replace(/[^0-9.]/g, '')) : null;
      const expectedDistance = localStorageData.expectedDistance ? 
        parseFloat(localStorageData.expectedDistance.replace(/[^0-9.]/g, '')) : null;
        
      const distanceConsistent = 
        dashboardDistance !== null && 
        historyDistance !== null && 
        expectedDistance !== null &&
        Math.abs(dashboardDistance - historyDistance) < 0.1 &&
        Math.abs(dashboardDistance - expectedDistance) < 0.1;
      
      console.log(`Distance Consistency: ${distanceConsistent ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`- Dashboard: ${dashboardData.distance} (${dashboardDistance})`);
      console.log(`- History Page: ${historyData.distance} (${historyDistance})`);
      console.log(`- Expected (localStorage): ${localStorageData.expectedDistance} (${expectedDistance})`);
      
      const overallConsistency = durationConsistent && distanceConsistent;
      
      console.log(`\n🏁 Overall Consistency: ${overallConsistency ? '✅ PASS' : '❌ FAIL'}`);
      
      return {
        dashboardData,
        historyData,
        localStorageData,
        durationConsistent,
        distanceConsistent,
        overallConsistency
      };
    } catch (error) {
      console.error('Error verifying consistency:', error);
      return false;
    }
  },
  
  /**
   * Run both a simulation and verification
   */
  async runFullTest() {
    try {
      // First import and run the simulation
      console.log('📋 Starting full test sequence...');
      console.log('Step 1: Loading simulation module...');
      
      const testRunModule = await import('./test-run-display-consistency.js');
      
      // Now run a simulation
      console.log('Step 2: Running simulation...');
      await testRunModule.RunDisplayTest.simulateRun({
        totalDistance: 3000,  // 3km
        duration: 1200,       // 20 minutes
        coordinateDelay: 50,  // Faster simulation
        autoStop: true
      });
      
      // Give time for all events to process
      console.log('Step 3: Waiting for simulation to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now verify consistency
      console.log('Step 4: Verifying data consistency...');
      await this.verifyConsistency();
      
      console.log('✅ Full test sequence completed!');
    } catch (error) {
      console.error('Error running full test:', error);
    }
  }
};

// Export to global scope for browser console access
window.RunDisplayVerifier = RunDisplayVerifier;

// Print usage instructions
console.log('✅ Run Display Verifier loaded successfully!');
console.log('\nUsage:');
console.log('1. RunDisplayVerifier.verifyConsistency() - Verify display consistency between dashboard and history');
console.log('2. RunDisplayVerifier.getDashboardRunData() - Inspect dashboard run display');
console.log('3. RunDisplayVerifier.getHistoryPageData() - Inspect history page run display');
console.log('4. RunDisplayVerifier.compareWithLocalStorage() - Compare UI with localStorage data');
console.log('5. RunDisplayVerifier.runFullTest() - Run a full simulation and verification');
console.log('\nExample: RunDisplayVerifier.verifyConsistency()'); 