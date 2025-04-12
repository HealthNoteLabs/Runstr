#!/usr/bin/env node

/**
 * NIP29 Diagnostics Tool
 * 
 * A standalone diagnostic tool for testing NIP29 group functionality
 * in the RUNSTR app. This script runs tests for relay connectivity,
 * authentication, and group discovery to identify issues with NIP29.
 */

// Import required modules
const colors = require('colors/safe');
const fs = require('fs');
const path = require('path');

// Load polyfills first
try {
  require('./polyfills/localStorage');
  require('./polyfills/webSocket');
  console.log(colors.green('✓ Polyfills loaded successfully'));
} catch (error) {
  console.error(colors.red(`✗ Error loading polyfills: ${error.message}`));
  console.error(colors.yellow('Please ensure polyfill files exist and are valid'));
  process.exit(1);
}

// Import test modules
let relayTests, authTests, groupTests;
try {
  relayTests = require('./tests/relay-connectivity');
  authTests = require('./tests/authentication');
  groupTests = require('./tests/group-discovery');
  console.log(colors.green('✓ Test modules loaded successfully'));
} catch (error) {
  console.error(colors.red(`✗ Error loading test modules: ${error.message}`));
  console.error(colors.yellow('Please ensure test files exist and are valid'));
  process.exit(1);
}

// Log diagnostics start
console.log(colors.bold.magenta('\n================================================='));
console.log(colors.bold.magenta('         RUNSTR NIP29 DIAGNOSTICS TOOL           '));
console.log(colors.bold.magenta('=================================================\n'));

console.log(colors.cyan('This tool will test NIP29 group functionality and identify issues.'));
console.log(colors.cyan('Running diagnostics on: ') + colors.yellow(new Date().toLocaleString()));

/**
 * Run all diagnostic tests
 */
async function runDiagnostics() {
  const results = {
    timestamp: new Date().toISOString(),
    relayConnectivity: null,
    authentication: null,
    groupDiscovery: null,
    overallSuccess: false,
    criticalIssues: [],
    recommendations: []
  };
  
  // Test 1: Relay Connectivity
  console.log(colors.bold.magenta('\n[Test 1/3] Relay Connectivity'));
  results.relayConnectivity = await relayTests.runRelayTests();
  
  // Test 2: Authentication
  console.log(colors.bold.magenta('\n[Test 2/3] Authentication'));
  results.authentication = await authTests.runAuthenticationTests();
  
  // Test 3: Group Discovery
  console.log(colors.bold.magenta('\n[Test 3/3] Group Discovery'));
  results.groupDiscovery = await groupTests.runGroupDiscoveryTests();
  
  // Analyze results
  analyzeResults(results);
  
  // Save results
  saveResults(results);
  
  return results;
}

/**
 * Analyze test results and identify critical issues
 * @param {Object} results - Test results
 */
function analyzeResults(results) {
  console.log(colors.bold.magenta('\n================================================='));
  console.log(colors.bold.magenta('              DIAGNOSTICS SUMMARY                '));
  console.log(colors.bold.magenta('=================================================\n'));
  
  // Check relay connectivity
  const relayConnect = results.relayConnectivity;
  if (relayConnect.successfulConnections === 0) {
    results.criticalIssues.push({
      area: 'Relay Connectivity',
      issue: 'Could not connect to any Nostr relays',
      recommendation: 'Check internet connection and relay availability'
    });
  }
  
  const hasNIP29Relay = (relayConnect.nip29Support?.supported || []).length > 0;
  if (!hasNIP29Relay) {
    results.criticalIssues.push({
      area: 'Relay Connectivity',
      issue: 'No relay supporting NIP29 was found',
      recommendation: 'Ensure at least one relay with NIP29 support is configured and accessible'
    });
  }
  
  // Check authentication
  const auth = results.authentication;
  const nostrGroupsEnabled = auth.localConfiguration.details.localStorage?.nostrGroupsEnabled;
  
  if (nostrGroupsEnabled === false) {
    results.criticalIssues.push({
      area: 'Authentication',
      issue: 'Nostr groups feature flag is disabled',
      recommendation: 'Enable the feature flag with: localStorage.setItem("nostr_groups_enabled", "true")'
    });
  }
  
  if (!auth.appAuthentication.publicKeyAvailable) {
    results.criticalIssues.push({
      area: 'Authentication',
      issue: 'No Nostr public key available',
      recommendation: 'Ensure user is authenticated with Nostr in the app'
    });
  }
  
  // Check group discovery
  const discovery = results.groupDiscovery;
  
  if (discovery.rawDiscovery.foundGroups && !discovery.appDiscovery.foundGroups) {
    results.criticalIssues.push({
      area: 'Group Discovery',
      issue: 'Raw queries found groups but app discovery did not',
      recommendation: 'Check NIP29Bridge implementation and initialization'
    });
  }
  
  if (!discovery.rawDiscovery.foundGroups) {
    results.criticalIssues.push({
      area: 'Group Discovery',
      issue: 'No NIP29 groups found in raw queries',
      recommendation: 'Check if NIP29 groups exist on the configured relays'
    });
  }
  
  if (!discovery.appDiscovery.bridgeInitialized) {
    results.criticalIssues.push({
      area: 'Group Discovery',
      issue: 'NIP29Bridge failed to initialize',
      recommendation: 'Check NIP29Bridge initialization code and dependencies'
    });
  }
  
  // Generate recommendations
  generateRecommendations(results);
  
  // Determine overall success
  results.overallSuccess = results.criticalIssues.length === 0 && 
    discovery.appDiscovery.foundGroups;
  
  // Print summary
  printSummary(results);
}

/**
 * Generate recommendations based on test results
 * @param {Object} results - Test results
 */
function generateRecommendations(results) {
  const auth = results.authentication;
  const discovery = results.groupDiscovery;
  
  // Check if nostr_groups_enabled flag needs to be set
  if (auth.localConfiguration.details.localStorage?.nostrGroupsEnabled === false) {
    results.recommendations.push({
      priority: 'high',
      action: 'Enable Nostr groups feature flag',
      implementation: 'Run this in browser console: localStorage.setItem("nostr_groups_enabled", "true")'
    });
  }
  
  // Check if we need better relay connections
  const nip29SupportedRelays = results.relayConnectivity.nip29Support?.supported || [];
  if (nip29SupportedRelays.length < 2) {
    results.recommendations.push({
      priority: 'medium',
      action: 'Add more NIP29-supporting relays',
      implementation: 'Add wss://relay.0xchat.com to the relay list'
    });
  }
  
  // Check if bridge initialization is failing
  if (!discovery.appDiscovery.bridgeInitialized) {
    results.recommendations.push({
      priority: 'high',
      action: 'Fix NIP29Bridge initialization',
      implementation: 'Debug the initialize() method in NIP29Bridge.js'
    });
  }
  
  // Check if there's an issue with search implementation
  if (discovery.rawDiscovery.foundGroups && 
      discovery.appDiscovery.canDiscoverGroups && 
      !discovery.appDiscovery.foundGroups) {
    results.recommendations.push({
      priority: 'high',
      action: 'Fix group discovery implementation',
      implementation: 'Check filter parameters in the discoverGroups() method'
    });
  }
}

/**
 * Print a summary of the diagnostics results
 * @param {Object} results - Test results
 */
function printSummary(results) {
  console.log(colors.bold('Overall Result: ') + 
    (results.overallSuccess ? colors.green('PASS') : colors.red('FAIL')));
  
  console.log(colors.bold('\nRelay Connectivity:'));
  console.log(`  Connected: ${colors.cyan(results.relayConnectivity.successfulConnections)}/${results.relayConnectivity.totalRelays}`);
  console.log(`  NIP29 Support: ${colors.cyan((results.relayConnectivity.nip29Support?.supported || []).length)}/${results.relayConnectivity.totalRelays}`);
  
  console.log(colors.bold('\nNostr Authentication:'));
  console.log(`  Public Key Available: ${results.authentication.appAuthentication.publicKeyAvailable ? colors.green('YES') : colors.red('NO')}`);
  console.log(`  Groups Feature Flag: ${results.authentication.localConfiguration.details.localStorage?.nostrGroupsEnabled ? colors.green('ENABLED') : colors.red('DISABLED')}`);
  
  console.log(colors.bold('\nGroup Discovery:'));
  console.log(`  Raw Discovery: ${results.groupDiscovery.rawDiscovery.foundGroups ? colors.green('GROUPS FOUND') : colors.red('NO GROUPS')}`);
  console.log(`  App Discovery: ${results.groupDiscovery.appDiscovery.foundGroups ? colors.green('GROUPS FOUND') : colors.red('NO GROUPS')}`);
  
  // Critical issues
  if (results.criticalIssues.length > 0) {
    console.log(colors.bold.red('\nCritical Issues:'));
    results.criticalIssues.forEach((issue, index) => {
      console.log(`  ${index + 1}. [${colors.yellow(issue.area)}] ${issue.issue}`);
      console.log(`     ${colors.magenta('Recommendation:')} ${issue.recommendation}`);
    });
  }
  
  // Recommendations
  if (results.recommendations.length > 0) {
    console.log(colors.bold.green('\nRecommended Actions:'));
    results.recommendations.forEach((rec, index) => {
      const priority = rec.priority === 'high' ? colors.red(rec.priority) : 
                       rec.priority === 'medium' ? colors.yellow(rec.priority) : 
                       colors.blue(rec.priority);
                       
      console.log(`  ${index + 1}. [${priority}] ${rec.action}`);
      console.log(`     ${colors.magenta('How:')} ${rec.implementation}`);
    });
  }
  
  console.log(colors.bold.magenta('\n================================================='));
  console.log(colors.bold.magenta('         DIAGNOSTICS COMPLETE          '));
  console.log(colors.bold.magenta('=================================================\n'));
}

/**
 * Save test results to a file
 * @param {Object} results - Test results
 */
function saveResults(results) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `nip29-diagnostic-results-${timestamp}.json`;
    const filePath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
    
    console.log(colors.green(`\nDiagnostic results saved to: ${filename}`));
  } catch (error) {
    console.error(colors.red(`\nError saving results: ${error.message}`));
  }
}

// Run diagnostics and handle errors
runDiagnostics().catch(error => {
  console.error(colors.red(`\nUnexpected error during diagnostics: ${error.message}`));
  console.error(colors.red(error.stack));
  process.exit(1);
}); 