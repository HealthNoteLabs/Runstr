/**
 * NIP29 Debug Helper
 * 
 * This script helps diagnose issues with NIP29 groups in the Runstr app.
 * Add this file to your project and import it in App.jsx or another early initialization file.
 * 
 * Usage:
 * import { debugNIP29 } from './debug-nip29';
 * debugNIP29();  // Call this early in app initialization
 */

import { ensureNIP29Enabled, isNIP29Enabled } from './utils/androidStorage';
import { Platform } from './utils/react-native-shim';
import { SimplePool } from 'nostr-tools';

/**
 * Helper to check localStorage state for a key
 * @param {string} key - The localStorage key to check
 * @returns {string} The state information
 */
function checkStorageKey(key) {
  try {
    const value = localStorage.getItem(key);
    return `${key}: ${value !== null ? `"${value}"` : 'null'}`;
  } catch (e) {
    return `${key}: ERROR: ${e.message}`;
  }
}

/**
 * Diagnose NIP29 settings and initialization
 */
export function debugNIP29() {
  console.group('NIP29 Debug Information');
  
  // Platform information
  console.log(`Platform: ${Platform.OS}`);
  
  // Check storage before any initialization
  console.log('Initial localStorage state:');
  console.log(checkStorageKey('nostr_groups_enabled'));
  
  // Force NIP29 enabled and check again
  console.log('\nForcing NIP29 enabled...');
  ensureNIP29Enabled();
  console.log('After ensureNIP29Enabled:');
  console.log(checkStorageKey('nostr_groups_enabled'));
  
  // Check the status using the isNIP29Enabled function
  console.log('\nStatus via isNIP29Enabled function:');
  console.log(`NIP29 Enabled: ${isNIP29Enabled()}`);
  
  // Verify localStorage persistence by adding a test value
  try {
    const testKey = 'runstr_nip29_test_key';
    const testValue = `test-${Date.now()}`;
    
    console.log('\nTesting localStorage persistence:');
    localStorage.setItem(testKey, testValue);
    
    // Immediate verification
    const readValue = localStorage.getItem(testKey);
    console.log(`Test key write/read: ${readValue === testValue ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Expected: "${testValue}"`);
    console.log(`Actual: "${readValue}"`);
    
    // Clean up
    localStorage.removeItem(testKey);
  } catch (e) {
    console.error('localStorage test error:', e);
  }
  
  // WebSocket availability check
  console.log('\nChecking WebSocket availability:');
  if (typeof WebSocket !== 'undefined') {
    console.log('WebSocket is available');
  } else {
    console.error('WebSocket is NOT available - this will prevent Nostr communication');
  }
  
  console.groupEnd();
  
  // Return some info for programmatic use
  return {
    platform: Platform.OS,
    nip29Enabled: isNIP29Enabled(),
    localStorage: localStorage.getItem('nostr_groups_enabled'),
    webSocketAvailable: typeof WebSocket !== 'undefined'
  };
}

/**
 * Test group discovery by directly querying relays
 */
export async function testGroupDiscovery() {
  try {
    console.group('NIP29 Group Discovery Test');
    
    // Check if the required libraries are available
    if (typeof SimplePool === 'undefined') {
      console.error('SimplePool from nostr-tools is not available');
      return { error: 'SimplePool not available' };
    }
    
    // List of relays to check
    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://relay.snort.social',
      'wss://purplepag.es',
      'wss://relay.0xchat.com' // Known to support NIP29
    ];
    
    console.log(`Checking ${relays.length} relays for NIP29 groups...`);
    
    // Create a pool for querying
    const pool = new SimplePool();
    
    // We're looking for group creation events (kind 80)
    const filter = {
      kinds: [80], // NIP29 GROUP_CREATION kind
      limit: 20,
      // Last 30 days
      since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
    };
    
    // Query all relays
    console.log('Querying relays...');
    const events = await pool.list(relays, [filter], { timeout: 10000 });
    
    if (events && events.length > 0) {
      console.log(`Found ${events.length} NIP29 groups`);
      
      // Show first 3 groups
      console.log('Sample groups:');
      events.slice(0, 3).forEach(event => {
        let name = 'Unknown';
        try {
          const metadata = JSON.parse(event.content);
          name = metadata.name || 'Unnamed Group';
        } catch (error) {
          // Parsing error, use default name
          console.log(`Could not parse group metadata: ${error.message}`);
        }
        
        console.log(`- ${name} (${event.id.substring(0, 8)}...)`);
      });
      
      return { success: true, count: events.length, groups: events };
    } else {
      console.log('No NIP29 groups found');
      return { success: false, count: 0 };
    }
  } catch (error) {
    console.error('Error during group discovery test:', error);
    return { error: error.message };
  } finally {
    console.groupEnd();
  }
}

/**
 * Utility to fix NIP29 initialization
 */
export function fixNIP29Settings() {
  try {
    console.group('NIP29 Fix Attempt');
    
    // 1. Force the NIP29 flag to be enabled
    localStorage.setItem('nostr_groups_enabled', 'true');
    console.log('Set nostr_groups_enabled = true');
    
    // 2. Set a permanent flag to remember this setting
    localStorage.setItem('runstr_nip29_permanent', 'true');
    console.log('Set permanent flag');
    
    // Check results
    const enabled = localStorage.getItem('nostr_groups_enabled') === 'true';
    console.log(`NIP29 setting fixed: ${enabled ? 'SUCCESS' : 'FAILED'}`);
    
    console.groupEnd();
    return { success: enabled };
  } catch (error) {
    console.error('Error fixing NIP29 settings:', error);
    return { success: false, error: error.message };
  }
}

// Automatically run diagnostics when this file is loaded
debugNIP29(); 