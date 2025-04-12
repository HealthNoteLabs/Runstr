/**
 * Group Discovery Test
 * 
 * Tests NIP29 group discovery functionality
 */

const { SimplePool } = require('nostr-tools');
const colors = require('colors/safe');

// Try to import our app's NIP29 bridge
let nip29Bridge = null;
try {
  nip29Bridge = require('../../src/services/NIP29Bridge').default;
} catch (error) {
  console.log(colors.yellow('Note: Could not load app\'s NIP29Bridge module. Using standalone tests only.'));
}

// NIP-29 event kinds
const NIP29_KINDS = {
  GROUP_CREATION: 80,
  GROUP_METADATA: 81,
  GROUP_MEMBERSHIP: 82,
  GROUP_LIST: 83,
  GROUP_MESSAGES: 84,
  GROUP_HIDE_MESSAGE: 85,
  GROUP_REMOVE_MESSAGE: 86
};

// List of relays to test with, including those known to support NIP29
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://purplepag.es',
  'wss://relay.0xchat.com' // NIP-29 group support
];

// Default timeouts
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const EXTENDED_TIMEOUT = 20000; // 20 seconds for more complex queries

/**
 * Test raw group discovery directly with nostr-tools
 * @returns {Promise<Object>} Test results
 */
async function testRawGroupDiscovery() {
  console.log(colors.bold.blue('\n=== RAW NIP29 GROUP DISCOVERY TEST ===\n'));
  
  const results = {
    success: false,
    foundGroups: false,
    relayResults: {},
    totalGroupsFound: 0,
    allGroups: []
  };
  
  try {
    console.log('Testing raw NIP29 group discovery using nostr-tools...');
    
    const pool = new SimplePool();
    
    // Test each relay individually
    for (const relay of RELAYS) {
      console.log(`\nChecking ${colors.cyan(relay)} for NIP29 groups...`);
      
      try {
        // Filter for recent NIP29 group creation events
        const filter = {
          kinds: [NIP29_KINDS.GROUP_CREATION],
          since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Last 30 days
          limit: 20
        };
        
        const start = Date.now();
        console.log(`Querying for groups since: ${new Date(filter.since * 1000).toLocaleString()}`);
        
        // Query the relay
        const events = await pool.list([relay], [filter], {
          timeout: EXTENDED_TIMEOUT
        });
        
        const duration = Date.now() - start;
        const eventCount = events.length;
        
        // Process results for this relay
        results.relayResults[relay] = {
          success: true,
          duration,
          groupCount: eventCount
        };
        
        if (eventCount > 0) {
          results.foundGroups = true;
          results.totalGroupsFound += eventCount;
          
          console.log(`${colors.green('✓')} Found ${eventCount} NIP29 groups on ${colors.cyan(relay)} in ${duration}ms`);
          
          // Add groups to overall list (avoiding duplicates)
          events.forEach(event => {
            if (!results.allGroups.find(g => g.id === event.id)) {
              let metadata = {};
              
              try {
                metadata = JSON.parse(event.content);
              } catch {
                metadata = { name: 'Unknown Group' };
              }
              
              results.allGroups.push({
                id: event.id,
                pubkey: event.pubkey,
                created_at: event.created_at,
                metadata,
                relay
              });
            }
          });
          
          // Show sample of found groups
          console.log('\nSample groups found:');
          events.slice(0, 3).forEach(event => {
            let name = 'Unknown';
            try {
              const metadata = JSON.parse(event.content);
              name = metadata.name || 'Unnamed Group';
            } catch {}
            
            console.log(`  - ${colors.cyan(name)} (${event.id.substring(0, 8)}...)`);
          });
        } else {
          console.log(`${colors.yellow('!')} No NIP29 groups found on ${colors.cyan(relay)}`);
        }
      } catch (error) {
        console.error(`${colors.red('✗')} Error querying ${colors.cyan(relay)}: ${error.message}`);
        results.relayResults[relay] = {
          success: false,
          error: error.message
        };
      }
    }
    
    // Query with a wider timeframe if no groups were found
    if (!results.foundGroups) {
      console.log(colors.yellow('\nNo groups found in the last 30 days. Trying with a larger timeframe...'));
      
      const pool = new SimplePool();
      const filter = {
        kinds: [NIP29_KINDS.GROUP_CREATION],
        limit: 50
      };
      
      const events = await pool.list(RELAYS, [filter], {
        timeout: EXTENDED_TIMEOUT
      });
      
      if (events.length > 0) {
        results.foundGroups = true;
        results.totalGroupsFound = events.length;
        console.log(`${colors.green('✓')} Found ${events.length} NIP29 groups with wider query`);
        
        // Add groups to overall list (avoiding duplicates)
        events.forEach(event => {
          if (!results.allGroups.find(g => g.id === event.id)) {
            let metadata = {};
            
            try {
              metadata = JSON.parse(event.content);
            } catch {
              metadata = { name: 'Unknown Group' };
            }
            
            results.allGroups.push({
              id: event.id,
              pubkey: event.pubkey,
              created_at: event.created_at,
              metadata
            });
          }
        });
      } else {
        console.log(colors.red('No NIP29 groups found even with wider query'));
      }
    }
    
    results.success = true;
  } catch (error) {
    console.error(`${colors.red('✗')} Raw group discovery test failed: ${error.message}`);
    results.error = error.message;
  }
  
  return results;
}

/**
 * Test app's NIP29Bridge for group discovery
 * @returns {Promise<Object>} Test results
 */
async function testAppGroupDiscovery() {
  console.log(colors.bold.blue('\n=== APP NIP29 GROUP DISCOVERY TEST ===\n'));
  
  const results = {
    success: false,
    hasNIP29Bridge: false,
    bridgeInitialized: false,
    canDiscoverGroups: false,
    canSearchGroups: false,
    canDiscoverRunningGroups: false,
    foundGroups: false,
    details: {}
  };
  
  try {
    // Check if app's NIP29Bridge is available
    if (!nip29Bridge) {
      console.log(colors.yellow('App\'s NIP29Bridge module not available. Skipping app group discovery tests.'));
      results.error = 'App\'s NIP29Bridge module not available';
      return results;
    }
    
    results.hasNIP29Bridge = true;
    console.log('App\'s NIP29Bridge module loaded successfully');
    
    // Test bridge initialization
    if (typeof nip29Bridge.initialize !== 'function') {
      console.log(colors.yellow('NIP29Bridge doesn\'t have initialize function'));
      results.details.missingFunctions = ['initialize'];
    } else {
      console.log('Initializing NIP29Bridge...');
      const initResult = await nip29Bridge.initialize();
      
      results.bridgeInitialized = initResult === true;
      results.details.initialization = {
        success: initResult === true,
        result: initResult
      };
      
      if (results.bridgeInitialized) {
        console.log(`${colors.green('✓')} NIP29Bridge initialized successfully`);
      } else {
        console.log(colors.yellow('NIP29Bridge initialization incomplete or failed'));
      }
    }
    
    // Test general group discovery
    if (typeof nip29Bridge.discoverGroups !== 'function') {
      console.log(colors.yellow('NIP29Bridge doesn\'t have discoverGroups function'));
      results.details.missingFunctions = [...(results.details.missingFunctions || []), 'discoverGroups'];
    } else {
      console.log('\nTesting general group discovery...');
      try {
        const groups = await nip29Bridge.discoverGroups(20);
        
        results.canDiscoverGroups = true;
        results.details.generalDiscovery = {
          groupCount: groups.length,
          success: groups.length > 0
        };
        
        if (groups.length > 0) {
          results.foundGroups = true;
          
          console.log(`${colors.green('✓')} Found ${groups.length} groups using app's discoverGroups function`);
          
          // Display sample of discovered groups
          console.log('\nSample groups found:');
          groups.slice(0, 3).forEach(group => {
            console.log(`  - ${colors.cyan(group.metadata.name || 'Unnamed')} (${group.id.substring(0, 8)}...)`);
          });
        } else {
          console.log(colors.yellow('No groups found using app\'s discoverGroups function'));
        }
      } catch (error) {
        console.error(`${colors.red('✗')} Error using app's discoverGroups function: ${error.message}`);
        results.details.generalDiscovery = {
          error: error.message
        };
      }
    }
    
    // Test running-specific group discovery
    if (typeof nip29Bridge.discoverRunningGroups !== 'function') {
      console.log(colors.yellow('NIP29Bridge doesn\'t have discoverRunningGroups function'));
      results.details.missingFunctions = [...(results.details.missingFunctions || []), 'discoverRunningGroups'];
    } else {
      console.log('\nTesting running-specific group discovery...');
      try {
        const runningGroups = await nip29Bridge.discoverRunningGroups(20);
        
        results.canDiscoverRunningGroups = true;
        results.details.runningDiscovery = {
          groupCount: runningGroups.length,
          success: runningGroups.length > 0
        };
        
        if (runningGroups.length > 0) {
          results.foundGroups = true;
          
          console.log(`${colors.green('✓')} Found ${runningGroups.length} running groups`);
          
          // Display sample of discovered running groups
          console.log('\nSample running groups found:');
          runningGroups.slice(0, 3).forEach(group => {
            console.log(`  - ${colors.cyan(group.metadata.name || 'Unnamed')} (${group.id.substring(0, 8)}...)`);
          });
        } else {
          console.log(colors.yellow('No running groups found'));
        }
      } catch (error) {
        console.error(`${colors.red('✗')} Error discovering running groups: ${error.message}`);
        results.details.runningDiscovery = {
          error: error.message
        };
      }
    }
    
    // Test search group functionality
    if (typeof nip29Bridge.searchGroupsByName !== 'function') {
      console.log(colors.yellow('NIP29Bridge doesn\'t have searchGroupsByName function'));
      results.details.missingFunctions = [...(results.details.missingFunctions || []), 'searchGroupsByName'];
    } else {
      console.log('\nTesting group search functionality...');
      
      // Try searching with common terms
      const searchTerms = ['running', 'club', 'group', 'run'];
      
      for (const term of searchTerms) {
        try {
          console.log(`Searching for groups with term: "${term}"...`);
          const searchResults = await nip29Bridge.searchGroupsByName(term, 10);
          
          results.canSearchGroups = true;
          
          if (!results.details.search) {
            results.details.search = {
              results: {}
            };
          }
          
          results.details.search.results[term] = {
            count: searchResults.length,
            success: searchResults.length > 0
          };
          
          if (searchResults.length > 0) {
            results.foundGroups = true;
            
            console.log(`${colors.green('✓')} Found ${searchResults.length} groups matching "${term}"`);
            
            // Display sample of search results
            console.log('\nSample search results:');
            searchResults.slice(0, 2).forEach(group => {
              console.log(`  - ${colors.cyan(group.metadata.name || 'Unnamed')} (${group.id.substring(0, 8)}...)`);
            });
            
            // No need to test more search terms if we found results
            break;
          } else {
            console.log(colors.yellow(`No groups found matching "${term}"`));
          }
        } catch (error) {
          console.error(`${colors.red('✗')} Error searching for "${term}": ${error.message}`);
          
          if (!results.details.search) {
            results.details.search = {
              results: {}
            };
          }
          
          results.details.search.results[term] = {
            error: error.message
          };
        }
      }
    }
    
    // Check if we can find a specific known group
    if (typeof nip29Bridge.findGroupByExactName === 'function') {
      console.log('\nTesting finding a specific group by name...');
      
      const knownGroupNames = [
        'Messi Run Club',
        'Running Club',
        'Global Runners'
      ];
      
      for (const groupName of knownGroupNames) {
        try {
          console.log(`Looking for specific group: "${groupName}"...`);
          const group = await nip29Bridge.findGroupByExactName(groupName);
          
          if (group) {
            results.foundGroups = true;
            console.log(`${colors.green('✓')} Found specific group: ${colors.cyan(groupName)}`);
            break;
          } else {
            console.log(colors.yellow(`Specific group "${groupName}" not found`));
          }
        } catch (error) {
          console.error(`${colors.red('✗')} Error finding specific group "${groupName}": ${error.message}`);
        }
      }
    }
    
    // Consider discovery test successful if we've initialized and can call discovery methods
    results.success = results.bridgeInitialized && 
      (results.canDiscoverGroups || results.canSearchGroups || results.canDiscoverRunningGroups);
  } catch (error) {
    console.error(`${colors.red('✗')} App group discovery test failed: ${error.message}`);
    results.error = error.message;
  }
  
  return results;
}

/**
 * Compare raw discovery results with app discovery results
 * @param {Object} rawResults - Results from raw group discovery
 * @param {Object} appResults - Results from app group discovery
 * @returns {Object} Comparison results and potential issues
 */
function compareDiscoveryResults(rawResults, appResults) {
  console.log(colors.bold.blue('\n=== DISCOVERY COMPARISON ANALYSIS ===\n'));
  
  const comparison = {
    rawFoundGroups: rawResults.foundGroups,
    rawGroupCount: rawResults.totalGroupsFound,
    appFoundGroups: appResults.foundGroups,
    potentialIssues: []
  };
  
  // Identify potential issues
  if (rawResults.foundGroups && !appResults.foundGroups) {
    comparison.potentialIssues.push({
      severity: 'critical',
      issue: 'Raw queries found groups but app discovery did not',
      recommendation: 'Check NIP29Bridge implementation and network connectivity in the app'
    });
    
    console.log(colors.red('CRITICAL ISSUE: Raw queries found groups but app discovery did not'));
  }
  
  if (!rawResults.foundGroups) {
    comparison.potentialIssues.push({
      severity: 'critical',
      issue: 'No NIP29 groups found with raw queries',
      recommendation: 'Check relay connectivity and NIP29 support on configured relays'
    });
    
    console.log(colors.red('CRITICAL ISSUE: No NIP29 groups found with raw queries'));
  }
  
  if (!appResults.bridgeInitialized) {
    comparison.potentialIssues.push({
      severity: 'critical',
      issue: 'NIP29Bridge initialization failed',
      recommendation: 'Check NIP29Bridge initialization and make sure nostr_groups_enabled is set to true'
    });
    
    console.log(colors.red('CRITICAL ISSUE: NIP29Bridge initialization failed'));
  }
  
  if (!appResults.hasNIP29Bridge) {
    comparison.potentialIssues.push({
      severity: 'critical',
      issue: 'NIP29Bridge module could not be loaded',
      recommendation: 'Check file paths and imports for NIP29Bridge'
    });
    
    console.log(colors.red('CRITICAL ISSUE: NIP29Bridge module could not be loaded'));
  }
  
  // Check for missing functions
  if (appResults.details.missingFunctions && appResults.details.missingFunctions.length > 0) {
    comparison.potentialIssues.push({
      severity: 'high',
      issue: `Missing NIP29Bridge functions: ${appResults.details.missingFunctions.join(', ')}`,
      recommendation: 'Implement missing functions in NIP29Bridge'
    });
    
    console.log(colors.red(`HIGH SEVERITY: Missing NIP29Bridge functions: ${appResults.details.missingFunctions.join(', ')}`));
  }
  
  return comparison;
}

/**
 * Run all group discovery tests
 * @returns {Promise<Object>} Combined test results
 */
async function runGroupDiscoveryTests() {
  console.log(colors.bold.magenta('\n=========================================='));
  console.log(colors.bold.magenta('      NIP29 GROUP DISCOVERY TESTS'));
  console.log(colors.bold.magenta('==========================================\n'));
  
  const rawResults = await testRawGroupDiscovery();
  const appResults = await testAppGroupDiscovery();
  const comparison = compareDiscoveryResults(rawResults, appResults);
  
  // Overall summary
  console.log(colors.bold.blue('\n=== GROUP DISCOVERY TEST SUMMARY ===\n'));
  
  console.log(`Raw Discovery: ${rawResults.foundGroups ? colors.green('GROUPS FOUND') : colors.red('NO GROUPS FOUND')}`);
  console.log(`App Discovery: ${appResults.foundGroups ? colors.green('GROUPS FOUND') : colors.red('NO GROUPS FOUND')}`);
  console.log(`Bridge Initialized: ${appResults.bridgeInitialized ? colors.green('YES') : colors.red('NO')}`);
  
  console.log('\nPotential issues:');
  if (comparison.potentialIssues.length === 0) {
    console.log(colors.green('  No critical issues detected'));
  } else {
    comparison.potentialIssues.forEach(issue => {
      const color = issue.severity === 'critical' ? colors.red : 
                    issue.severity === 'high' ? colors.yellow : colors.blue;
      
      console.log(`  ${color(`[${issue.severity.toUpperCase()}] ${issue.issue}`)}`);
      console.log(`    ${colors.cyan('Recommendation:')} ${issue.recommendation}`);
    });
  }
  
  return {
    rawDiscovery: rawResults,
    appDiscovery: appResults,
    comparison: comparison
  };
}

module.exports = { runGroupDiscoveryTests }; 