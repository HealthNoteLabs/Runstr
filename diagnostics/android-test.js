/**
 * Android NIP29 Test
 * 
 * Tests specific issues with NIP29 on Android
 */

// Create mock environment that simulates Android
const mockAndroid = {
  Platform: {
    OS: 'android'  // Simulate Android platform
  },
  localStorage: {
    store: {},
    getItem(key) {
      return this.store[key] || null;
    },
    setItem(key, value) {
      this.store[key] = String(value);
    },
    removeItem(key) {
      delete this.store[key];
    },
    clear() {
      this.store = {};
    }
  }
};

// Simulate the TeamsDataService for testing initialization
class MockTeamsDataService {
  constructor() {
    this.teamsStorageKey = 'teamsData';
    this.membershipStorageKey = 'teamMemberships';
    this.teamMessagesKey = 'teamMessages';
    this.teamChallengesKey = 'teamChallenges';
    this.pinnedPostsKey = 'teamPinnedPosts';
    this.listeners = [];
    
    // Nostr integration state - this is initialized directly from localStorage
    this.isNip29Initialized = false;
    this.nostrEnabled = mockAndroid.localStorage.getItem('nostr_groups_enabled') === 'true';
    
    // Output initial state
    console.log(`Initial nostrEnabled value: ${this.nostrEnabled}`);
  }
  
  // Mock initialization
  initialize() {
    console.log('Running initialize()...');
    
    // Initialize empty storage if not exists
    this._initializeStorage();
    
    // Check if nostr_groups_enabled is set and ensure it's enabled by default
    if (mockAndroid.localStorage.getItem('nostr_groups_enabled') === null) {
      console.log('nostr_groups_enabled is null, setting to true...');
      mockAndroid.localStorage.setItem('nostr_groups_enabled', 'true');
      this.nostrEnabled = true;
    } else {
      console.log(`nostr_groups_enabled was already set to: ${mockAndroid.localStorage.getItem('nostr_groups_enabled')}`);
    }
    
    // Setting updated
    console.log(`Updated nostrEnabled value: ${this.nostrEnabled}`);
    
    // Show all localStorage
    console.log('\nAll localStorage values:');
    Object.keys(mockAndroid.localStorage.store).forEach(key => {
      console.log(`${key}: ${mockAndroid.localStorage.getItem(key)}`);
    });
  }
  
  // Helper for storage initialization
  _initializeStorage() {
    console.log('Initializing storage...');
    
    const storageKeys = [
      this.teamsStorageKey,
      this.membershipStorageKey,
      this.teamMessagesKey,
      this.pinnedPostsKey,
      this.teamChallengesKey
    ];
    
    storageKeys.forEach(key => {
      if (!mockAndroid.localStorage.getItem(key)) {
        mockAndroid.localStorage.setItem(key, JSON.stringify([]));
      }
    });
  }
  
  // Simulate browser refresh (clears instance variables but keeps localStorage)
  simulateRestart() {
    // In a real environment, this would be a new instance being created
    console.log('\n--- Simulating app restart ---\n');
    this.isNip29Initialized = false;
    this.nostrEnabled = mockAndroid.localStorage.getItem('nostr_groups_enabled') === 'true';
    console.log(`After restart, nostrEnabled = ${this.nostrEnabled}`);
  }
}

// Run the test
console.log('======================================');
console.log('    ANDROID NIP29 INITIALIZATION TEST');
console.log('======================================\n');

console.log('Test scenario: Fresh install (no localStorage values set)');

// Create a mock service and simulate initialization
const mockService = new MockTeamsDataService();
mockService.initialize();

// Test that restarting the app preserves the setting
mockService.simulateRestart();

// Test manual setting of the flag
console.log('\nTest scenario: Manual setting of the flag to false');
mockAndroid.localStorage.setItem('nostr_groups_enabled', 'false');
mockService.simulateRestart();

// Ensure the initialize method sets it back to true if manually cleared
console.log('\nTest scenario: Flag was deleted');
mockAndroid.localStorage.removeItem('nostr_groups_enabled');
mockService.simulateRestart();
mockService.initialize();

// Final output
console.log('\n======================================');
console.log('      ANDROID NIP29 TEST RESULTS');
console.log('======================================');

const finalValue = mockAndroid.localStorage.getItem('nostr_groups_enabled');
console.log(`\nFinal nostr_groups_enabled value: ${finalValue}`);

if (finalValue === 'true') {
  console.log('\n✅ The flag should be properly set to true after initialization');
  console.log('If the app still shows no NIP29 groups, check:');
  console.log('1. Android WebView localStorage persistence');
  console.log('2. Network connectivity and CORS issues on Android');
  console.log('3. Relay connectivity from the mobile device');
  console.log('4. WebSocket support in the Android WebView');
} else {
  console.log('\n❌ The flag was not successfully set to true');
  console.log('This may indicate an issue with the initialization process');
} 