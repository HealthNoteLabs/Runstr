#!/usr/bin/env node

/**
 * Nostr Feed Test Script (CommonJS version)
 * This script tests Nostr feed connectivity and functionality
 */

const WebSocket = require('ws');

// Default relays to test - should match those in your app
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://eden.nostr.land',
  'wss://e.nos.lol',
  'wss://relay.snort.social'
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

console.log(`${colors.magenta}${colors.bold}===== RUNSTR NOSTR FEED TEST =====${colors.reset}\n`);
console.log(`${colors.cyan}Testing connection to relays and feed functionality...${colors.reset}\n`);

// Test basic WebSocket connectivity to relays
async function testRelayConnections() {
  console.log(`${colors.blue}[1/4] Testing direct relay connections...${colors.reset}`);
  
  const results = {};
  let successCount = 0;
  
  for (const relay of RELAYS) {
    process.stdout.write(`- Testing ${relay}: `);
    
    try {
      const connected = await new Promise((resolve) => {
        const ws = new WebSocket(relay);
        
        const timeout = setTimeout(() => {
          try {
            ws.close();
          } catch (_) { /* ignore */ }
          resolve(false);
        }, 7000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          try {
            ws.close();
          } catch (_) { /* ignore */ }
          resolve(false);
        });
      });
      
      if (connected) {
        console.log(`${colors.green}✓ Connected${colors.reset}`);
        results[relay] = true;
        successCount++;
      } else {
        console.log(`${colors.red}✗ Failed${colors.reset}`);
        results[relay] = false;
      }
    } catch (err) {
      console.log(`${colors.red}✗ Error: ${err.message}${colors.reset}`);
      results[relay] = false;
    }
  }
  
  const connectionRate = (successCount / RELAYS.length) * 100;
  
  if (connectionRate === 0) {
    console.log(`\n${colors.red}❌ CRITICAL: All relays are unreachable (0%). Check your internet connection!${colors.reset}`);
  } else if (connectionRate < 50) {
    console.log(`\n${colors.red}⚠️ WARNING: Only ${connectionRate.toFixed(1)}% of relays are reachable. Feed will be limited.${colors.reset}`);
  } else if (connectionRate < 80) {
    console.log(`\n${colors.yellow}⚠️ NOTICE: ${connectionRate.toFixed(1)}% of relays are reachable. Feed may be partially working.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}✓ GOOD: ${connectionRate.toFixed(1)}% of relays are reachable. Feed should work well.${colors.reset}`);
  }
  
  return { results, successRate: connectionRate };
}

// Test hashtag filtering
async function testHashtagFiltering() {
  console.log(`\n${colors.blue}[2/4] Testing hashtag-based filtering...${colors.reset}`);
  
  const hashtags = ['running', 'run', 'runner', 'runstr', '5k', '10k', 'marathon', 'jog'];
  const workingRelays = RELAYS.slice(0, 3); // Just test first 3 relays to speed things up
  
  let postsFound = 0;
  const postSamples = [];
  
  for (const relay of workingRelays) {
    process.stdout.write(`- Testing hashtags on ${relay}: `);
    
    try {
      const events = await new Promise((resolve) => {
        const ws = new WebSocket(relay);
        const foundEvents = [];
        
        const timeout = setTimeout(() => {
          try {
            ws.close();
          } catch (_) { /* ignore */ }
          resolve({ events: foundEvents, error: 'Timeout' });
        }, 10000);
        
        ws.on('open', () => {
          // Create a 30-day window
          const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
          
          // Send request for posts with specific hashtags
          const req = JSON.stringify([
            "REQ", 
            "hashtag_test",
            { 
              "kinds": [1], 
              "#t": hashtags,
              "since": thirtyDaysAgo,
              "limit": 10 
            }
          ]);
          
          ws.send(req);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message[0] === 'EVENT' && message[1] === "hashtag_test") {
              foundEvents.push(message[2]);
            } else if (message[0] === 'EOSE' && message[1] === "hashtag_test") {
              clearTimeout(timeout);
              try {
                ws.close();
              } catch (_) { /* ignore */ }
              resolve({ events: foundEvents, error: null });
            }
          } catch (_) {
            // Ignore parsing errors
          }
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          try {
            ws.close();
          } catch (_) { /* ignore */ }
          resolve({ events: [], error: 'Connection error' });
        });
      });
      
      if (events.error && events.error !== 'Timeout') {
        console.log(`${colors.red}✗ Error: ${events.error}${colors.reset}`);
      } else if (events.events.length > 0) {
        console.log(`${colors.green}✓ Found ${events.events.length} posts${colors.reset}`);
        postsFound += events.events.length;
        
        // Get a sample post
        if (events.events.length > 0) {
          const sample = events.events[0];
          postSamples.push({
            id: sample.id?.substring(0, 8),
            pubkey: sample.pubkey?.substring(0, 8),
            content: sample.content?.substring(0, 100) + (sample.content?.length > 100 ? '...' : '')
          });
        }
      } else {
        console.log(`${colors.yellow}⚠ No posts found${colors.reset}`);
      }
    } catch (err) {
      console.log(`${colors.red}✗ Error: ${err.message}${colors.reset}`);
    }
  }
  
  if (postsFound === 0) {
    console.log(`\n${colors.red}❌ CRITICAL: No posts found with hashtags. This will cause an empty feed.${colors.reset}`);
  } else if (postsFound < 5) {
    console.log(`\n${colors.yellow}⚠️ WARNING: Only ${postsFound} posts found with hashtags. Feed may appear limited.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}✓ GOOD: ${postsFound} posts found with hashtags. Hashtag filtering is working.${colors.reset}`);
  }
  
  // Show sample posts if any were found
  if (postSamples.length > 0) {
    console.log(`\n${colors.cyan}Sample post:${colors.reset}`);
    console.log(`  ID: ${postSamples[0].id}...`);
    console.log(`  Author: ${postSamples[0].pubkey}...`);
    console.log(`  Content: "${postSamples[0].content}"`);
  }
  
  return { postsFound, postSamples };
}

// Test content filtering
async function testContentFiltering() {
  console.log(`\n${colors.blue}[3/4] Testing content-based filtering...${colors.reset}`);
  
  const keywords = ['running', 'run', 'runner', '5k', '10k', 'marathon'];
  const workingRelays = RELAYS.slice(0, 2); // Just test first 2 relays to speed things up
  
  let postsFound = 0;
  let filteredPostsCount = 0;
  const postSamples = [];
  
  for (const relay of workingRelays) {
    process.stdout.write(`- Testing content on ${relay}: `);
    
    try {
      const events = await new Promise((resolve) => {
        const ws = new WebSocket(relay);
        const foundEvents = [];
        
        const timeout = setTimeout(() => {
          try {
            ws.close();
          } catch (_) { /* ignore */ }
          resolve({ events: foundEvents, error: 'Timeout' });
        }, 10000);
        
        ws.on('open', () => {
          // Create a 30-day window
          const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
          
          // Send request for any posts (without hashtag filtering)
          const req = JSON.stringify([
            "REQ", 
            "content_test",
            { 
              "kinds": [1], 
              "since": thirtyDaysAgo,
              "limit": 30 
            }
          ]);
          
          ws.send(req);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message[0] === 'EVENT' && message[1] === "content_test") {
              foundEvents.push(message[2]);
            } else if (message[0] === 'EOSE' && message[1] === "content_test") {
              clearTimeout(timeout);
              try {
                ws.close();
              } catch (_) { /* ignore */ }
              resolve({ events: foundEvents, error: null });
            }
          } catch (_) {
            // Ignore parsing errors
          }
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          try {
            ws.close();
          } catch (_) { /* ignore */ }
          resolve({ events: [], error: 'Connection error' });
        });
      });
      
      if (events.error && events.error !== 'Timeout') {
        console.log(`${colors.red}✗ Error: ${events.error}${colors.reset}`);
      } else if (events.events.length > 0) {
        // Filter for running-related content
        const filteredEvents = events.events.filter(event => {
          const content = event.content?.toLowerCase() || '';
          return keywords.some(keyword => content.includes(keyword));
        });
        
        console.log(`${colors.green}✓ Found ${events.events.length} posts, ${filteredEvents.length} running-related${colors.reset}`);
        postsFound += events.events.length;
        filteredPostsCount += filteredEvents.length;
        
        // Get a sample post
        if (filteredEvents.length > 0) {
          const sample = filteredEvents[0];
          postSamples.push({
            id: sample.id?.substring(0, 8),
            pubkey: sample.pubkey?.substring(0, 8),
            content: sample.content?.substring(0, 100) + (sample.content?.length > 100 ? '...' : '')
          });
        }
      } else {
        console.log(`${colors.yellow}⚠ No posts found${colors.reset}`);
      }
    } catch (err) {
      console.log(`${colors.red}✗ Error: ${err.message}${colors.reset}`);
    }
  }
  
  if (postsFound === 0) {
    console.log(`\n${colors.red}❌ CRITICAL: No posts found at all. This will cause an empty feed.${colors.reset}`);
  } else if (filteredPostsCount === 0) {
    console.log(`\n${colors.red}❌ CRITICAL: Posts were found, but none contained running keywords. This will cause an empty feed.${colors.reset}`);
  } else if (filteredPostsCount < 5) {
    console.log(`\n${colors.yellow}⚠️ WARNING: Only ${filteredPostsCount} running-related posts found. Feed may appear limited.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}✓ GOOD: ${filteredPostsCount} running-related posts found. Content filtering is working.${colors.reset}`);
  }
  
  // Show sample posts if any were found
  if (postSamples.length > 0) {
    console.log(`\n${colors.cyan}Sample post:${colors.reset}`);
    console.log(`  ID: ${postSamples[0].id}...`);
    console.log(`  Author: ${postSamples[0].pubkey}...`);
    console.log(`  Content: "${postSamples[0].content}"`);
  }
  
  return { postsFound, filteredPostsCount, postSamples };
}

// Test fetch with additional relays from Primal
async function testAdditionalRelays() {
  console.log(`\n${colors.blue}[4/4] Testing additional relays from Primal...${colors.reset}`);
  
  // Sample of reliable relays from Primal's list
  const additionalRelays = [
    'wss://relay.current.fyi',
    'wss://relay.nostrplebs.com'
  ];
  
  let workingRelaysCount = 0;
  const workingRelays = [];
  
  for (const relay of additionalRelays) {
    process.stdout.write(`- Testing ${relay}: `);
    
    try {
      const connected = await new Promise((resolve) => {
        const ws = new WebSocket(relay);
        
        const timeout = setTimeout(() => {
          try {
            ws.close();
          } catch (_) { /* ignore */ }
          resolve(false);
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          try {
            ws.close();
          } catch (_) { /* ignore */ }
          resolve(false);
        });
      });
      
      if (connected) {
        console.log(`${colors.green}✓ Connected${colors.reset}`);
        workingRelaysCount++;
        workingRelays.push(relay);
      } else {
        console.log(`${colors.red}✗ Failed${colors.reset}`);
      }
    } catch (err) {
      console.log(`${colors.red}✗ Error: ${err.message}${colors.reset}`);
    }
  }
  
  if (workingRelaysCount > 0) {
    console.log(`\n${colors.green}✓ GOOD: ${workingRelaysCount} additional relays are working. Consider adding them to your app.${colors.reset}`);
    console.log(`\n${colors.cyan}Suggested relays to add:${colors.reset}`);
    workingRelays.forEach(relay => console.log(`  - '${relay}',`));
  } else {
    console.log(`\n${colors.yellow}⚠️ WARNING: No additional relays are working.${colors.reset}`);
  }
  
  return { workingRelaysCount, workingRelays };
}

// Run the tests and analyze results
async function runTests() {
  try {
    // Test 1: Connection
    const connectionResults = await testRelayConnections();
    
    // Test 2: Hashtag filtering
    const hashtagResults = await testHashtagFiltering();
    
    // Test 3: Content filtering
    const contentResults = await testContentFiltering();
    
    // Test 4: Additional relays
    const additionalRelaysResults = await testAdditionalRelays();
    
    // Analyze and display diagnosis
    console.log(`\n${colors.magenta}${colors.bold}===== DIAGNOSIS SUMMARY =====${colors.reset}\n`);
    
    // Calculate overall health score
    const connectionScore = connectionResults.successRate;
    const hashtagScore = hashtagResults.postsFound > 10 ? 100 : hashtagResults.postsFound * 10;
    const contentScore = contentResults.filteredPostsCount > 10 ? 100 : contentResults.filteredPostsCount * 10;
    const overallHealth = (connectionScore * 0.5) + (hashtagScore * 0.25) + (contentScore * 0.25);
    
    console.log(`${colors.cyan}Overall feed health: ${Math.round(overallHealth)}%${colors.reset}`);
    
    if (overallHealth >= 80) {
      console.log(`${colors.green}✓ GOOD: Your feed should be working well.${colors.reset}`);
    } else if (overallHealth >= 50) {
      console.log(`${colors.yellow}⚠️ FAIR: Your feed should work, but might be limited or intermittent.${colors.reset}`);
    } else if (overallHealth > 0) {
      console.log(`${colors.red}⚠️ POOR: Your feed will likely be very limited or fail often.${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ CRITICAL: Your feed will not work at all.${colors.reset}`);
    }
    
    // Recommendations
    console.log(`\n${colors.cyan}Recommendations:${colors.reset}`);
    
    if (connectionResults.successRate < 50) {
      console.log(`${colors.yellow}1. Network connectivity issues detected. Check your internet connection.${colors.reset}`);
      console.log(`${colors.yellow}2. Try adding more relays to increase reliability.${colors.reset}`);
    }
    
    if (hashtagResults.postsFound === 0 && contentResults.filteredPostsCount === 0) {
      console.log(`${colors.yellow}3. No running-related content found. Try adding general-purpose relays like wss://relay.damus.io${colors.reset}`);
    }
    
    if (additionalRelaysResults.workingRelaysCount > 0) {
      console.log(`${colors.yellow}4. Add these reliable relays to your RELAYS array in src/utils/nostr.js:${colors.reset}`);
      additionalRelaysResults.workingRelays.forEach(relay => {
        console.log(`   - '${relay}',`);
      });
    }
    
    console.log(`\n${colors.yellow}Next steps:${colors.reset}`);
    console.log(`${colors.yellow}1. Run the full nostr-debug.js tool for more detailed diagnostics${colors.reset}`);
    console.log(`${colors.yellow}2. Update your relay list with working relays${colors.reset}`);
    console.log(`${colors.yellow}3. Test your feed on another network connection${colors.reset}`);
    
  } catch (error) {
    console.log(`\n${colors.red}ERROR: ${error.message}${colors.reset}`);
    console.log(`\n${colors.red}Stack: ${error.stack}${colors.reset}`);
  }
}

// Run tests
runTests(); 