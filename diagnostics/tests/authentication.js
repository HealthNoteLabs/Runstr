/**
 * Authentication Test
 * 
 * Tests Nostr key management and authentication functionality
 */

const { nip19, getPublicKey, finalizeEvent, verifyEvent } = require('nostr-tools');
const colors = require('colors/safe');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Try to import our app's nostr client utils
let appNostrClient = null;
try {
  // We're trying to use the app's own nostr client code, but this might fail
  appNostrClient = require('../../src/utils/nostrClient');
} catch (error) {
  console.log(colors.yellow('Note: Could not load app\'s nostrClient module. Using standalone tests only.'));
}

/**
 * Test key generation and management
 * @returns {Object} Test result
 */
async function testKeyManagement() {
  console.log(colors.bold.blue('\n=== NOSTR KEY MANAGEMENT TEST ===\n'));
  
  const results = {
    success: false,
    canGenerateKeys: false,
    canConvertFormats: false,
    canValidateKeys: false,
    details: {}
  };
  
  try {
    // Test key generation
    console.log('Testing key generation...');
    const privateKey = generateTestKey();
    
    if (!privateKey) {
      throw new Error('Failed to generate test private key');
    }
    
    results.canGenerateKeys = true;
    results.details.privateKey = {
      hex: privateKey.slice(0, 8) + '...' + privateKey.slice(-8)
    };
    
    // Derive public key
    console.log('Deriving public key...');
    const publicKey = getPublicKey(privateKey);
    
    if (!publicKey) {
      throw new Error('Failed to derive public key from private key');
    }
    
    results.details.publicKey = {
      hex: publicKey.slice(0, 8) + '...' + publicKey.slice(-8)
    };
    
    // Test NIP-19 format conversion
    console.log('Testing NIP-19 format conversion...');
    const npub = nip19.npubEncode(publicKey);
    const nsec = nip19.nsecEncode(privateKey);
    
    const decodedNpub = nip19.decode(npub);
    const decodedNsec = nip19.decode(nsec);
    
    if (decodedNpub.data !== publicKey || decodedNsec.data !== privateKey) {
      throw new Error('NIP-19 format conversion failed');
    }
    
    results.canConvertFormats = true;
    results.details.formats = {
      npub: npub.substring(0, 10) + '...' + npub.substring(npub.length - 5),
      nsec: nsec.substring(0, 10) + '...' + nsec.substring(nsec.length - 5)
    };
    
    // Test event signing and verification
    console.log('Testing event signing and verification...');
    const testEvent = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Test event for NIP29 diagnostics'
    };
    
    const signedEvent = finalizeEvent(testEvent, privateKey);
    const isValid = verifyEvent(signedEvent);
    
    if (!isValid || signedEvent.pubkey !== publicKey) {
      throw new Error('Event signing or verification failed');
    }
    
    results.canValidateKeys = true;
    results.details.validation = {
      eventSigning: true,
      eventVerification: true
    };
    
    console.log(`${colors.green('✓')} Key management tests passed successfully`);
    results.success = true;
  } catch (error) {
    console.error(`${colors.red('✗')} Key management test failed: ${error.message}`);
    results.error = error.message;
  }
  
  return results;
}

/**
 * Test app's nostr client key management
 * @returns {Object} Test result
 */
async function testAppAuthentication() {
  console.log(colors.bold.blue('\n=== APP NOSTR AUTHENTICATION TEST ===\n'));
  
  const results = {
    success: false,
    hasNostrClient: false,
    publicKeyAvailable: false,
    canCreateEvents: false,
    details: {}
  };
  
  try {
    // Check if app's nostr client is available
    if (!appNostrClient) {
      console.log(colors.yellow('App\'s nostr client module not available. Skipping app authentication tests.'));
      results.error = 'App\'s nostr client module not available';
      return results;
    }
    
    results.hasNostrClient = true;
    console.log('App\'s nostr client module loaded successfully');
    
    // Test public key retrieval
    console.log('Testing public key retrieval using app\'s nostr client...');
    
    if (typeof appNostrClient.getUserPublicKey !== 'function') {
      console.log(colors.yellow('App\'s nostr client doesn\'t have getUserPublicKey function'));
      results.details.missingFunctions = ['getUserPublicKey'];
    } else {
      const publicKey = await appNostrClient.getUserPublicKey();
      
      if (publicKey) {
        results.publicKeyAvailable = true;
        results.details.publicKey = {
          hex: publicKey.slice(0, 8) + '...' + publicKey.slice(-8)
        };
        
        try {
          const npub = nip19.npubEncode(publicKey);
          results.details.publicKey.npub = npub.substring(0, 10) + '...' + npub.substring(npub.length - 5);
        } catch (e) {
          results.details.publicKey.npubError = e.message;
        }
        
        console.log(`${colors.green('✓')} Public key available: ${results.details.publicKey.hex}`);
      } else {
        console.log(colors.yellow('No public key available from app\'s nostr client'));
        results.details.publicKeyError = 'No public key returned';
      }
    }
    
    // Test event creation and publication
    if (typeof appNostrClient.createAndPublishEvent !== 'function') {
      console.log(colors.yellow('App\'s nostr client doesn\'t have createAndPublishEvent function'));
      results.details.missingFunctions = [...(results.details.missingFunctions || []), 'createAndPublishEvent'];
    } else {
      console.log('App has createAndPublishEvent function (not testing actual creation to avoid creating test events)');
      results.canCreateEvents = true;
    }
    
    // Consider authentication successful if we have a public key
    results.success = results.publicKeyAvailable;
    
    if (results.success) {
      console.log(`${colors.green('✓')} App authentication tests passed`);
    } else {
      console.log(colors.yellow('App authentication tests not fully passed - may need to authenticate'));
    }
  } catch (error) {
    console.error(`${colors.red('✗')} App authentication test failed: ${error.message}`);
    results.error = error.message;
  }
  
  return results;
}

/**
 * Generate a test private key
 * @returns {string} Hex private key
 */
function generateTestKey() {
  // Generate a random 32-byte private key
  const privateKey = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    privateKey[i] = Math.floor(Math.random() * 256);
  }
  
  // Convert to hex
  return Array.from(privateKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check for local nostr keys or configuration
 * @returns {Object} Result with found keys or configs
 */
function checkLocalKeys() {
  console.log(colors.bold.blue('\n=== CHECKING LOCAL NOSTR CONFIGURATION ===\n'));
  
  const results = {
    success: false,
    foundLocalStorage: false,
    foundConfigFiles: false,
    details: {}
  };
  
  try {
    // Check for localStorage
    try {
      const localStorage = global.localStorage;
      
      if (localStorage) {
        const storageKeys = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('nostr') || key.includes('key'))) {
            storageKeys.push(key);
          }
        }
        
        if (storageKeys.length > 0) {
          results.foundLocalStorage = true;
          results.details.localStorage = {
            keys: storageKeys
          };
          
          console.log(`${colors.green('✓')} Found ${storageKeys.length} potential Nostr-related keys in localStorage`);
          
          // Check specifically for the flag that enables Nostr groups
          const nostrGroupsEnabled = localStorage.getItem('nostr_groups_enabled');
          results.details.localStorage.nostrGroupsEnabled = nostrGroupsEnabled === 'true';
          
          if (nostrGroupsEnabled === 'true') {
            console.log(`${colors.green('✓')} Nostr groups feature flag is ENABLED`);
          } else {
            console.log(`${colors.yellow('!')} Nostr groups feature flag is NOT ENABLED`);
          }
        } else {
          console.log(colors.yellow('No Nostr-related keys found in localStorage'));
        }
      }
    } catch (e) {
      console.log(colors.yellow(`localStorage check error: ${e.message}`));
    }
    
    // Try to check common config file locations
    const homeDir = os.homedir();
    const possiblePaths = [
      path.join(homeDir, '.nostr'),
      path.join(homeDir, '.config', 'nostr'),
      path.join(process.cwd(), '.nostr'),
      path.join(process.cwd(), 'nostr.json'),
      path.join(process.cwd(), '.env')
    ];
    
    const foundFiles = [];
    
    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          foundFiles.push(filePath);
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    if (foundFiles.length > 0) {
      results.foundConfigFiles = true;
      results.details.configFiles = foundFiles;
      
      console.log(`${colors.green('✓')} Found ${foundFiles.length} potential Nostr config files`);
      for (const file of foundFiles) {
        console.log(`  - ${file}`);
      }
    } else {
      console.log(colors.yellow('No Nostr config files found in common locations'));
    }
    
    results.success = results.foundLocalStorage || results.foundConfigFiles;
  } catch (error) {
    console.error(`${colors.red('✗')} Error checking local Nostr configuration: ${error.message}`);
    results.error = error.message;
  }
  
  return results;
}

/**
 * Run all authentication tests
 * @returns {Promise<Object>} Combined test results
 */
async function runAuthenticationTests() {
  const results = {
    keyManagement: await testKeyManagement(),
    appAuthentication: await testAppAuthentication(),
    localConfiguration: checkLocalKeys()
  };
  
  // Overall summary
  console.log(colors.bold.blue('\n=== AUTHENTICATION TEST SUMMARY ===\n'));
  
  const overall = {
    keysWork: results.keyManagement.success,
    appAuthWorks: results.appAuthentication.success,
    configFound: results.localConfiguration.success
  };
  
  console.log(`Key Management: ${overall.keysWork ? colors.green('PASS') : colors.red('FAIL')}`);
  console.log(`App Authentication: ${overall.appAuthWorks ? colors.green('PASS') : colors.yellow('NOT VERIFIED')}`);
  console.log(`Local Config: ${overall.configFound ? colors.green('FOUND') : colors.yellow('NOT FOUND')}`);
  
  // Check for critical issues with auth that would affect NIP29
  const nostrGroupsEnabled = results.localConfiguration.details.localStorage?.nostrGroupsEnabled;
  
  if (nostrGroupsEnabled === false) {
    console.log(colors.red.bold('\n⚠️ CRITICAL ISSUE: Nostr groups feature flag is NOT enabled'));
    console.log(colors.yellow('This is likely why NIP29 groups are not showing up'));
    console.log(colors.green('To fix: Run this in the browser console:'));
    console.log(colors.cyan('localStorage.setItem("nostr_groups_enabled", "true")'));
  }
  
  if (!overall.appAuthWorks) {
    console.log(colors.yellow('\n⚠️ NOTE: App authentication could not be verified'));
    console.log(colors.yellow('This might prevent the app from accessing NIP29 groups'));
  }
  
  return results;
}

module.exports = { runAuthenticationTests }; 