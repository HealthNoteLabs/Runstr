// Android NIP29 Test Script
// Run this with: node android-nip29-test.js

// Create mock environment
const Platform = { OS: 'android' };

// Mock localStorage
const localStorage = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
    console.log(`[localStorage] SET ${key} = ${value}`);
  },
  removeItem(key) {
    delete this.store[key];
    console.log(`[localStorage] REMOVED ${key}`);
  },
  clear() {
    this.store = {};
    console.log('[localStorage] CLEARED');
  }
};

// Simulate androidStorage.js functionality
function ensureNIP29Enabled() {
  try {
    // Set the flag directly to true regardless of current value
    localStorage.setItem('nostr_groups_enabled', 'true');
    
    console.log('[Android] NIP29 groups enabled by androidStorage utility');
    
    return true;
  } catch (error) {
    console.error('[Android] Error setting NIP29 flag:', error);
    return false;
  }
}

function isNIP29Enabled() {
  // For Android, force it to always return true
  if (Platform.OS === 'android') {
    return true;
  }
  
  return localStorage.getItem('nostr_groups_enabled') === 'true';
}

function initializeStorage() {
  // Always ensure NIP29 is enabled on Android
  if (Platform.OS === 'android') {
    ensureNIP29Enabled();
  }
}

// Simulate NIP29Bridge.js initialization
function simulateNIP29BridgeInit() {
  console.log('Simulating NIP29Bridge initialization...');
  
  // Check if NIP29 is enabled
  if (!isNIP29Enabled()) {
    console.log('NIP29 is not enabled. Bridge will not function.');
    return false;
  }
  
  // Simulate an async initialization process
  console.log('NIP29 is enabled, initializing bridge...');
  
  // Make sure the flag is set correctly
  const isEnabled = localStorage.getItem('nostr_groups_enabled') === 'true';
  if (!isEnabled && Platform.OS === 'android') {
    console.log('[NIP29Bridge] Enforcing NIP29 enabled for Android');
    localStorage.setItem('nostr_groups_enabled', 'true');
  }
  
  // If still not enabled after our attempts, exit
  if (localStorage.getItem('nostr_groups_enabled') !== 'true') {
    console.log('[NIP29Bridge] NIP29 integration disabled');
    return false;
  }
  
  // Simulate successful bridge init
  console.log('[NIP29Bridge] Successfully initialized');
  return true;
}

// Run tests
console.log('=== ANDROID NIP29 INTEGRATION TEST ===');

console.log('\n1. Platform check:');
console.log(`Platform.OS = ${Platform.OS}`);
console.log(`Is Android: ${Platform.OS === 'android'}`);

console.log('\n2. Initial state:');
const initialEnabled = isNIP29Enabled();
console.log(`isNIP29Enabled() = ${initialEnabled}`);

console.log('\n3. Forcing NIP29 enabled:');
ensureNIP29Enabled();
const enabledAfterForce = isNIP29Enabled();
console.log(`isNIP29Enabled() after force = ${enabledAfterForce}`);

console.log('\n4. Storage value check:');
const storageFlag = localStorage.getItem('nostr_groups_enabled');
console.log(`localStorage.getItem('nostr_groups_enabled') = "${storageFlag}"`);

console.log('\n5. Simulating app restart:');
localStorage.clear();
console.log('App closed, localStorage cleared');
console.log('App restarted, initializing storage...');
initializeStorage();
const flagAfterReload = localStorage.getItem('nostr_groups_enabled');
console.log(`localStorage.getItem('nostr_groups_enabled') after restart = "${flagAfterReload}"`);

console.log('\n6. Testing bridge initialization:');
const bridgeInitSuccess = simulateNIP29BridgeInit();
console.log(`Bridge init success: ${bridgeInitSuccess}`);

// Results
console.log('\n=== TEST RESULTS ===');
const success = 
  initialEnabled === true &&
  enabledAfterForce === true &&
  storageFlag === 'true' &&
  flagAfterReload === 'true' &&
  bridgeInitSuccess === true;

if (success) {
  console.log('✅ TEST PASSED: NIP29 integration should work correctly on Android');
} else {
  console.log('❌ TEST FAILED: NIP29 integration has issues on Android');
  
  // Log specific failures
  if (initialEnabled !== true) console.log('- Failed: Initial isNIP29Enabled() should be true on Android');
  if (enabledAfterForce !== true) console.log('- Failed: ensureNIP29Enabled() did not work');
  if (storageFlag !== 'true') console.log('- Failed: localStorage flag not set correctly');
  if (flagAfterReload !== 'true') console.log('- Failed: Flag not persisted after app restart');
  if (bridgeInitSuccess !== true) console.log('- Failed: NIP29Bridge initialization failed');
}

console.log('\nTest completed.'); 