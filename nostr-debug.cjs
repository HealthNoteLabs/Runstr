/**
 * Nostr Debugging Tool
 * A simplified version for Windows compatibility
 */

const WebSocket = require('ws');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Default relays to test
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol', 
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://relay.current.fyi'
];

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// Test relay connections
async function testRelayConnections(relays = DEFAULT_RELAYS) {
  console.log(`${colors.magenta}${colors.bold}===== RELAY CONNECTION TEST =====${colors.reset}\n`);
  console.log(`${colors.cyan}Testing connections to ${relays.length} relays...${colors.reset}\n`);
  
  const results = {};
  
  for (const relay of relays) {
    process.stdout.write(`Testing ${relay}: `);
    
    try {
      const connected = await new Promise((resolve) => {
        const ws = new WebSocket(relay);
        
        const timeout = setTimeout(() => {
          try {
            ws.close();
          } catch (_) {
            // Ignore errors
          }
          resolve(false);
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          try {
            ws.close();
          } catch (_) {
            // Ignore errors
          }
          resolve(true);
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          try {
            ws.close();
          } catch (_) {
            // Ignore errors
          }
          resolve(false);
        });
      });
      
      if (connected) {
        console.log(`${colors.green}✓ Connected${colors.reset}`);
        results[relay] = true;
      } else {
        console.log(`${colors.red}✗ Failed${colors.reset}`);
        results[relay] = false;
      }
    } catch (err) {
      console.log(`${colors.red}✗ Error: ${err.message}${colors.reset}`);
      results[relay] = false;
    }
  }
  
  // Summary
  console.log(`\n${colors.magenta}===== CONNECTION SUMMARY =====${colors.reset}`);
  const connectedCount = Object.values(results).filter(v => v).length;
  
  console.log(`\n${colors.cyan}Successfully connected to ${connectedCount} out of ${relays.length} relays${colors.reset}`);
  
  if (connectedCount === 0) {
    console.log(`\n${colors.red}No successful connections. Check your internet connection or firewall settings.${colors.reset}`);
  } else if (connectedCount < relays.length) {
    console.log(`\n${colors.yellow}Some relays are not available. This is normal and your app should still work.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}All relays are accessible! Your network connection looks good.${colors.reset}`);
  }
  
  console.log(`\n${colors.yellow}Next step: Run npm run test-hashtag to test for running-related content${colors.reset}`);
  rl.close();
}

// Start the program
try {
  testRelayConnections();
} catch (err) {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  rl.close();
  process.exit(1);
} 