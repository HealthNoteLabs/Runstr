/**
 * Quick Nostr Hashtag Test
 * Tests the most reliable relay for running-related hashtags
 */

const WebSocket = require('ws');

// Main relay to test
const RELAY = 'wss://relay.damus.io';

// List of hashtags to test
const HASHTAGS = [
  'running', 'run', 'runner', 'runstr', '5k'
];

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Test a single hashtag
async function testHashtag(hashtag) {
  return new Promise((resolve) => {
    console.log(`${colors.cyan}Testing #${hashtag}...${colors.reset}`);
    
    const ws = new WebSocket(RELAY);
    let events = [];
    let timeout;
    
    // Setup timeout
    timeout = setTimeout(() => {
      console.log(`${colors.yellow}Connection timed out${colors.reset}`);
      try { ws.close(); } catch (_) {}
      resolve({ events: [], error: 'Timeout' });
    }, 5000);
    
    ws.on('open', () => {
      // Create a 30-day window
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
      
      // Send request
      const req = JSON.stringify([
        "REQ", 
        `TEST_${hashtag}`,
        { 
          "kinds": [1], 
          "#t": [hashtag],
          "since": thirtyDaysAgo,
          "limit": 3 
        }
      ]);
      
      ws.send(req);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message[0] === 'EVENT' && message[1] === `TEST_${hashtag}`) {
          events.push(message[2]);
        } else if (message[0] === 'EOSE' && message[1] === `TEST_${hashtag}`) {
          clearTimeout(timeout);
          ws.close();
          resolve({ events, error: null });
        }
      } catch (err) {
        console.log(`${colors.red}Error: ${err.message}${colors.reset}`);
      }
    });
    
    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`${colors.red}WebSocket error: ${err.message}${colors.reset}`);
      try { ws.close(); } catch (_) {}
      resolve({ events: [], error: err.message });
    });
  });
}

// Run the test
async function runQuickTest() {
  console.log(`${colors.magenta}===== QUICK HASHTAG TEST =====${colors.reset}`);
  console.log(`${colors.cyan}Testing ${RELAY} with ${HASHTAGS.length} hashtags${colors.reset}\n`);
  
  let totalFound = 0;
  
  for (const hashtag of HASHTAGS) {
    const result = await testHashtag(hashtag);
    
    if (result.events.length > 0) {
      console.log(`${colors.green}✓ Found ${result.events.length} posts with #${hashtag}${colors.reset}`);
      totalFound += result.events.length;
      
      // Show a sample
      console.log(`  Sample: "${result.events[0].content.substring(0, 80)}..."\n`);
    } else {
      if (result.error) {
        console.log(`${colors.red}✗ Error testing #${hashtag}: ${result.error}${colors.reset}\n`);
      } else {
        console.log(`${colors.yellow}⚠ No posts with #${hashtag} found${colors.reset}\n`);
      }
    }
  }
  
  console.log(`${colors.magenta}===== TEST SUMMARY =====${colors.reset}`);
  console.log(`${colors.cyan}Total posts found: ${totalFound}${colors.reset}`);
  
  if (totalFound === 0) {
    console.log(`\n${colors.red}No running-related posts found. This explains your empty feed.${colors.reset}`);
    console.log(`${colors.yellow}Try implementing content-based filtering in your app.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}Running posts ARE available! The issue may be with your app's rendering.${colors.reset}`);
    console.log(`${colors.yellow}Check your feed component and filter settings.${colors.reset}`);
  }
}

// Start the test
try {
  runQuickTest();
} catch (err) {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
} 