/**
 * Android NIP29 Integration Test
 * 
 * This script tests the NIP29 integration specifically for Android devices.
 * It simulates the Android environment and verifies the settings persistence.
 */

// Create Android platform simulation
const androidPlatform = { OS: 'android' };

// Mock localStorage for testing
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  
  getItem(key) {
    return this.store[key] || null;
  }
  
  setItem(key, value) {
    this.store[key] = String(value);
    console.log(`[localStorage] SET ${key} = ${value}`);
  }
  
  removeItem(key) {
    delete this.store[key];
    console.log(`[localStorage] REMOVED ${key}`);
  }
  
  clear() {
    this.store = {};
    console.log('[localStorage] CLEARED');
  }
}

// Save original objects
const originalPlatform = typeof Platform !== 'undefined' ? Platform : null;
const originalLocalStorage = typeof localStorage !== 'undefined' ? localStorage : null;

// Create mock objects
const mockPlatform = { ...androidPlatform };
const mockStorage = new MockLocalStorage();

/**
 * Run the NIP29 Android integration test
 */
async function testAndroidNIP29Integration() {
  console.group('ANDROID NIP29 INTEGRATION TEST');
  
  // Test results object
  const results = {
    success: false,
    steps: [],
    errors: []
  };
  
  try {
    // 1. Mock the environment to simulate Android
    console.log('\n1. Simulating Android environment...');
    global.Platform = mockPlatform;
    global.localStorage = mockStorage;
    results.steps.push('Android environment simulated');
    
    // 2. Import key utilities
    console.log('\n2. Importing utilities...');
    // Use dynamic imports to get fresh instances with our mocks
    const { ensureNIP29Enabled, isNIP29Enabled } = await import('./utils/androidStorage.js');
    const nip29Bridge = await import('./services/NIP29Bridge.js');
    results.steps.push('Utilities imported');
    
    // 3. Check initial state
    console.log('\n3. Testing initial state...');
    const initialEnabled = isNIP29Enabled();
    console.log(`  Initial NIP29 enabled: ${initialEnabled}`);
    results.steps.push(`Initial NIP29 enabled: ${initialEnabled}`);
    
    // 4. Force enable NIP29
    console.log('\n4. Forcing NIP29 enabled...');
    ensureNIP29Enabled();
    const enabledAfterForce = isNIP29Enabled();
    console.log(`  NIP29 enabled after force: ${enabledAfterForce}`);
    results.steps.push(`NIP29 enabled after force: ${enabledAfterForce}`);
    
    // 5. Check localStorage flag
    console.log('\n5. Checking localStorage flag...');
    const storageFlag = localStorage.getItem('nostr_groups_enabled');
    console.log(`  'nostr_groups_enabled' value: "${storageFlag}"`);
    results.steps.push(`localStorage flag: "${storageFlag}"`);
    
    // 6. Initialize NIP29Bridge
    console.log('\n6. Testing NIP29Bridge initialization...');
    const bridge = nip29Bridge.default;
    results.steps.push(`Bridge created: ${!!bridge}`);
    
    console.log(`  Bridge enabled: ${bridge.enabled}`);
    results.steps.push(`Bridge enabled: ${bridge.enabled}`);
    
    try {
      await bridge.initialize();
      console.log(`  Bridge initialized: ${bridge.isInitialized}`);
      results.steps.push(`Bridge initialized: ${bridge.isInitialized}`);
    } catch (initError) {
      console.log(`  Bridge initialization failed: ${initError.message}`);
      results.steps.push(`Bridge initialization failed: ${initError.message}`);
      results.errors.push(`Bridge initialization: ${initError.message}`);
    }
    
    // 7. Test storage persistence across reloads
    console.log('\n7. Testing storage persistence across reloads...');
    // Simulate app reload by clearing and recreating storage
    const currentFlag = localStorage.getItem('nostr_groups_enabled');
    localStorage.clear();
    
    // Import fresh to simulate reload
    const reloadedStorage = await import('./utils/androidStorage.js');
    
    // Initialize storage on "reload"
    reloadedStorage.initializeStorage();
    
    // Check if flag is still set
    const flagAfterReload = localStorage.getItem('nostr_groups_enabled');
    console.log(`  Flag before reload: "${currentFlag}"`);
    console.log(`  Flag after reload: "${flagAfterReload}"`);
    
    const persistenceSuccess = flagAfterReload === 'true';
    results.steps.push(`Flag persistence: ${persistenceSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    if (!persistenceSuccess) {
      results.errors.push('NIP29 flag not persisted across reloads');
    }
    
    // 8. Test detecting Android platform
    console.log('\n8. Testing platform detection...');
    console.log(`  Detected Platform.OS: ${Platform.OS}`);
    const correctPlatform = Platform.OS === 'android';
    results.steps.push(`Platform detection: ${correctPlatform ? 'CORRECT (android)' : 'INCORRECT'}`);
    
    if (!correctPlatform) {
      results.errors.push('Platform not correctly detected as Android');
    }
    
    // 9. Overall success determination
    results.success = enabledAfterForce && 
                      storageFlag === 'true' && 
                      persistenceSuccess && 
                      correctPlatform &&
                      bridge.enabled;
    
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Status: ${results.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Steps completed: ${results.steps.length}`);
    console.log(`Errors: ${results.errors.length > 0 ? results.errors.join(', ') : 'None'}`);
    
  } catch (error) {
    console.error('\nTest failed with error:', error);
    results.success = false;
    results.errors.push(error.message);
  } finally {
    // Restore original objects if they existed
    if (originalPlatform) global.Platform = originalPlatform;
    if (originalLocalStorage) global.localStorage = originalLocalStorage;
    
    console.groupEnd();
    return results;
  }
}

// Only run the test if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Running Android NIP29 integration test...');
  testAndroidNIP29Integration()
    .then(results => {
      console.log('Test completed.');
      if (!results.success) {
        console.error('❌ Test failed! NIP29 integration has issues on Android');
        process.exit(1);
      } else {
        console.log('✅ Test passed! NIP29 integration should work on Android');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('Test failed with unexpected error:', error);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  if (typeof module !== 'undefined') {
    module.exports = { testAndroidNIP29Integration };
  }
} 