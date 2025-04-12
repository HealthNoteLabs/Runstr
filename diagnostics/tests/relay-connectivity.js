/**
 * Relay Connectivity Test
 * 
 * Tests connection to Nostr relays and verifies basic functionality
 */

const { SimplePool } = require('nostr-tools');
const colors = require('colors/safe');

const DEFAULT_TIMEOUT = 5000; // 5 seconds timeout

// List of relays to test, including those known to support NIP29
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://purplepag.es',
  'wss://relay.0xchat.com' // NIP-29 group support
];

/**
 * Test connection to a single relay
 * @param {string} relay - Relay URL
 * @returns {Promise<Object>} Test result
 */
async function testRelayConnection(relay) {
  console.log(`Testing connection to ${colors.cyan(relay)}...`);
  
  try {
    const pool = new SimplePool();
    const start = Date.now();
    
    // Try to establish connection with timeout
    const connectionPromise = new Promise((resolve, reject) => {
      const connection = pool.ensureRelay(relay);
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${DEFAULT_TIMEOUT}ms`));
      }, DEFAULT_TIMEOUT);
      
      // Wait for connection to open
      connection.on('connect', () => {
        clearTimeout(timeoutId);
        resolve(connection);
      });
      
      // Handle connection error
      connection.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
    
    // Wait for connection
    await connectionPromise;
    const duration = Date.now() - start;
    
    console.log(`${colors.green('✓')} Connected to ${colors.cyan(relay)} in ${duration}ms`);
    
    // Try fetching a simple event as a sanity check
    const testResult = await testSimpleQuery(pool, relay);
    
    return {
      success: true,
      relay,
      connectionTime: duration,
      query: testResult
    };
  } catch (error) {
    console.error(`${colors.red('✗')} Failed to connect to ${colors.cyan(relay)}: ${error.message}`);
    return {
      success: false,
      relay,
      error: error.message
    };
  }
}

/**
 * Test a simple query to verify relay functionality
 * @param {SimplePool} pool - Nostr pool
 * @param {string} relay - Relay URL 
 * @returns {Promise<Object>} Test result
 */
async function testSimpleQuery(pool, relay) {
  try {
    const start = Date.now();
    
    // Simple query for recent events
    const filter = {
      kinds: [1], // Regular text notes
      limit: 1 // Just get one to verify connectivity
    };
    
    const events = await pool.list([relay], [filter], {
      timeout: DEFAULT_TIMEOUT
    });
    
    const duration = Date.now() - start;
    const eventCount = events.length;
    
    if (eventCount > 0) {
      console.log(`${colors.green('✓')} Received ${eventCount} event(s) from ${colors.cyan(relay)} in ${duration}ms`);
      return {
        success: true,
        duration,
        eventCount
      };
    } else {
      console.log(`${colors.yellow('!')} Connected to ${colors.cyan(relay)} but received no events`);
      return {
        success: true,
        duration, 
        eventCount: 0,
        warning: 'No events received'
      };
    }
  } catch (error) {
    console.error(`${colors.red('✗')} Query failed for ${colors.cyan(relay)}: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test NIP29 specific functionality
 * @param {SimplePool} pool - Nostr pool
 * @param {string} relay - Relay URL
 * @returns {Promise<Object>} Test result
 */
async function testNIP29Support(pool, relay) {
  try {
    const start = Date.now();
    
    // Query for NIP29 group creation events (kind 80)
    const filter = {
      kinds: [80], // NIP29 group creation
      limit: 5
    };
    
    const events = await pool.list([relay], [filter], {
      timeout: DEFAULT_TIMEOUT * 2 // Double timeout for NIP29 queries
    });
    
    const duration = Date.now() - start;
    const eventCount = events.length;
    
    if (eventCount > 0) {
      console.log(`${colors.green('✓')} Received ${eventCount} NIP29 group(s) from ${colors.cyan(relay)} in ${duration}ms`);
      return {
        success: true,
        duration,
        eventCount,
        events: events.map(e => ({ id: e.id, pubkey: e.pubkey, created_at: e.created_at }))
      };
    } else {
      console.log(`${colors.yellow('!')} No NIP29 groups found on ${colors.cyan(relay)}`);
      return {
        success: false,
        duration,
        eventCount: 0,
        warning: 'No NIP29 groups found'
      };
    }
  } catch (error) {
    console.error(`${colors.red('✗')} NIP29 query failed for ${colors.cyan(relay)}: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run connectivity tests on all relays
 * @returns {Promise<Object>} Combined test results
 */
async function runRelayTests() {
  console.log(colors.bold.blue('\n=== RELAY CONNECTIVITY TESTS ===\n'));
  
  const results = {
    totalRelays: RELAYS.length,
    successfulConnections: 0,
    failedConnections: 0,
    relayResults: {},
    nip29Support: {
      supported: [],
      notSupported: [],
      error: []
    }
  };
  
  // Test each relay
  for (const relay of RELAYS) {
    const connectionResult = await testRelayConnection(relay);
    results.relayResults[relay] = connectionResult;
    
    if (connectionResult.success) {
      results.successfulConnections++;
      
      // For successful connections, also test NIP29 support
      const pool = new SimplePool();
      const nip29Result = await testNIP29Support(pool, relay);
      
      results.relayResults[relay].nip29 = nip29Result;
      
      if (nip29Result.success) {
        results.nip29Support.supported.push(relay);
      } else if (nip29Result.warning) {
        results.nip29Support.notSupported.push(relay);
      } else {
        results.nip29Support.error.push(relay);
      }
    } else {
      results.failedConnections++;
    }
    
    console.log('-----------------------------------');
  }
  
  // Summary
  console.log(colors.bold.blue('\n=== RELAY TEST SUMMARY ===\n'));
  console.log(`Total Relays: ${results.totalRelays}`);
  console.log(`Connected: ${colors.green(results.successfulConnections)}/${results.totalRelays}`);
  console.log(`Failed: ${results.failedConnections > 0 ? colors.red(results.failedConnections) : 0}/${results.totalRelays}`);
  console.log(`\nNIP29 Support:`);
  console.log(`  Supported: ${results.nip29Support.supported.length > 0 ? colors.green(results.nip29Support.supported.length) : 0}/${results.totalRelays}`);
  console.log(`  Not Found: ${results.nip29Support.notSupported.length}/${results.totalRelays}`);
  console.log(`  Error: ${results.nip29Support.error.length > 0 ? colors.red(results.nip29Support.error.length) : 0}/${results.totalRelays}`);
  
  return results;
}

module.exports = { runRelayTests }; 