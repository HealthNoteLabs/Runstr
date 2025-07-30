/**
 * Nostr Hashtag Test
 * Tests relays for running-related hashtags to diagnose feed issues
 */

const WebSocket = require('ws');

// List of relays to test
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol', 
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://relay.current.fyi'
];

// List of hashtags to test
const HASHTAGS = [
  'running', 'run', 'runner', 'runstr', '5k', '10k', 'marathon', 'jog'
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
  white: '\x1b[37m'
};

// Test a single relay with a single hashtag
async function testRelayWithHashtag(relayUrl, hashtag) {
  return new Promise((resolve) => {
    console.log(`${colors.cyan}Testing ${relayUrl} with hashtag #${hashtag}...${colors.reset}`);
    
    const ws = new WebSocket(relayUrl);
    let events = [];
    let timeout;
    
    // Setup timeout to close connection if it takes too long
    timeout = setTimeout(() => {
      console.log(`${colors.yellow}Connection to ${relayUrl} timed out${colors.reset}`);
      try {
        ws.close();
      } catch (_) {
        // Ignore errors when closing
      }
      resolve({ events: [], error: 'Timeout' });
    }, 8000);
    
    ws.on('open', () => {
      // Create a 30-day window
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
      
      // Send request for posts with specific hashtag
      const req = JSON.stringify([
        "REQ", 
        `HASHTAG_${hashtag}`,
        { 
          "kinds": [1], 
          "#t": [hashtag],
          "since": thirtyDaysAgo,
          "limit": 5 
        }
      ]);
      
      ws.send(req);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message[0] === 'EVENT' && message[1] === `HASHTAG_${hashtag}`) {
          events.push(message[2]);
        } else if (message[0] === 'EOSE' && message[1] === `HASHTAG_${hashtag}`) {
          clearTimeout(timeout);
          ws.close();
          resolve({ events, error: null });
        }
      } catch (err) {
        console.log(`${colors.red}Error parsing message: ${err.message}${colors.reset}`);
      }
    });
    
    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`${colors.red}WebSocket error with ${relayUrl}: ${err.message}${colors.reset}`);
      try {
        ws.close();
      } catch (_) {
        // Ignore errors when closing
      }
      resolve({ events: [], error: err.message });
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// Test a simple filter with no hashtags (fallback test)
async function testSimpleFilter(relayUrl) {
  return new Promise((resolve) => {
    console.log(`${colors.cyan}Testing ${relayUrl} with simple filter (no hashtags)...${colors.reset}`);
    
    const ws = new WebSocket(relayUrl);
    let events = [];
    let timeout;
    
    // Setup timeout to close connection if it takes too long
    timeout = setTimeout(() => {
      console.log(`${colors.yellow}Connection to ${relayUrl} timed out${colors.reset}`);
      try {
        ws.close();
      } catch (_) {
        // Ignore errors when closing
      }
      resolve({ events: [], error: 'Timeout' });
    }, 8000);
    
    ws.on('open', () => {
      // Create a 7-day window (smaller to reduce data)
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      
      // Send request for any recent posts
      const req = JSON.stringify([
        "REQ", 
        "SIMPLE_FILTER",
        { 
          "kinds": [1], 
          "since": sevenDaysAgo,
          "limit": 10 
        }
      ]);
      
      ws.send(req);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message[0] === 'EVENT' && message[1] === "SIMPLE_FILTER") {
          events.push(message[2]);
        } else if (message[0] === 'EOSE' && message[1] === "SIMPLE_FILTER") {
          clearTimeout(timeout);
          ws.close();
          
          // Check for running content in the events
          const runningEvents = events.filter(event => {
            const content = event.content.toLowerCase();
            return HASHTAGS.some(tag => content.includes(tag));
          });
          
          resolve({ 
            events, 
            runningEvents,
            error: null 
          });
        }
      } catch (err) {
        console.log(`${colors.red}Error parsing message: ${err.message}${colors.reset}`);
      }
    });
    
    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`${colors.red}WebSocket error with ${relayUrl}: ${err.message}${colors.reset}`);
      try {
        ws.close();
      } catch (_) {
        // Ignore errors when closing
      }
      resolve({ events: [], runningEvents: [], error: err.message });
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// Run all the tests
async function runTests() {
  console.log(`${colors.magenta}===== NOSTR RUNNING HASHTAG TEST =====${colors.reset}`);
  console.log(`${colors.cyan}Testing ${RELAYS.length} relays with ${HASHTAGS.length} hashtags${colors.reset}\n`);
  
  const results = {};
  
  // First test: Standard hashtag filtering
  console.log(`${colors.magenta}===== PHASE 1: HASHTAG FILTERING =====${colors.reset}`);
  for (const relay of RELAYS) {
    results[relay] = { hashtags: {}, simple: null };
    
    for (const hashtag of HASHTAGS) {
      const result = await testRelayWithHashtag(relay, hashtag);
      
      results[relay].hashtags[hashtag] = {
        count: result.events.length,
        error: result.error
      };
      
      if (result.events.length > 0) {
        console.log(`${colors.green}✓ Found ${result.events.length} posts with #${hashtag} on ${relay}${colors.reset}`);
        console.log(`  Sample: "${result.events[0].content.substring(0, 100)}..."\n`);
      } else {
        if (result.error) {
          console.log(`${colors.red}✗ Error testing #${hashtag} on ${relay}: ${result.error}${colors.reset}\n`);
        } else {
          console.log(`${colors.yellow}⚠ No posts with #${hashtag} found on ${relay}${colors.reset}\n`);
        }
      }
    }
  }
  
  // Second test: Simple filter with content-based filtering
  console.log(`${colors.magenta}===== PHASE 2: CONTENT-BASED FILTERING =====${colors.reset}`);
  for (const relay of RELAYS) {
    const simpleResult = await testSimpleFilter(relay);
    results[relay].simple = {
      totalCount: simpleResult.events.length,
      runningCount: simpleResult.runningEvents?.length || 0,
      error: simpleResult.error
    };
    
    if (simpleResult.events.length > 0) {
      console.log(`${colors.green}✓ Found ${simpleResult.events.length} general posts on ${relay}${colors.reset}`);
      
      if (simpleResult.runningEvents?.length > 0) {
        console.log(`${colors.green}✓ ${simpleResult.runningEvents.length} of these contain running keywords${colors.reset}`);
        console.log(`  Sample: "${simpleResult.runningEvents[0].content.substring(0, 100)}..."\n`);
      } else {
        console.log(`${colors.yellow}⚠ None of these contain running keywords${colors.reset}\n`);
      }
    } else {
      if (simpleResult.error) {
        console.log(`${colors.red}✗ Error fetching general posts from ${relay}: ${simpleResult.error}${colors.reset}\n`);
      } else {
        console.log(`${colors.yellow}⚠ No general posts found on ${relay}${colors.reset}\n`);
      }
    }
  }
  
  // Summary
  console.log(`\n${colors.magenta}===== TEST SUMMARY =====${colors.reset}`);
  let totalHashtagPosts = 0;
  let totalContentPosts = 0;
  
  for (const relay in results) {
    console.log(`\n${colors.cyan}${relay}:${colors.reset}`);
    let relayHashtagPosts = 0;
    
    for (const hashtag in results[relay].hashtags) {
      const { count, error } = results[relay].hashtags[hashtag];
      relayHashtagPosts += count;
      
      const status = error ? `${colors.red}✗` : (count > 0 ? `${colors.green}✓` : `${colors.yellow}⚠`);
      console.log(`  ${status} #${hashtag}: ${count} posts ${error ? `(Error: ${error})` : ''}${colors.reset}`);
    }
    
    const simpleResults = results[relay].simple;
    if (simpleResults) {
      console.log(`  ${colors.blue}Content filtering: ${simpleResults.runningCount} out of ${simpleResults.totalCount} posts${colors.reset}`);
    }
    
    totalHashtagPosts += relayHashtagPosts;
    totalContentPosts += simpleResults?.runningCount || 0;
  }
  
  console.log(`\n${colors.magenta}===== FINAL RESULTS =====${colors.reset}`);
  console.log(`${colors.cyan}Total posts found via hashtags: ${totalHashtagPosts}${colors.reset}`);
  console.log(`${colors.cyan}Total posts found via content: ${totalContentPosts}${colors.reset}`);
  
  if (totalHashtagPosts === 0 && totalContentPosts === 0) {
    console.log(`\n${colors.red}No running-related posts found. This explains your empty feed.${colors.reset}`);
    console.log(`${colors.yellow}Possible solutions:${colors.reset}`);
    console.log(`1. Try content-based filtering instead of hashtag filtering`);
    console.log(`2. Expand the time window beyond 30 days`);
    console.log(`3. Add more relays to your configuration`);
    console.log(`4. Try querying global feeds first, then filter client-side`);
  } else if (totalHashtagPosts === 0 && totalContentPosts > 0) {
    console.log(`\n${colors.yellow}Found running-related posts via content but not hashtags.${colors.reset}`);
    console.log(`${colors.green}Solution: Implement content-based filtering in your app.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}Running posts ARE available. The issue may be with your app's rendering or a specific relay connection.${colors.reset}`);
  }
  
  console.log(`\n${colors.magenta}Next step: Run nostr-debug.js for an interactive diagnostics session${colors.reset}`);
}

// Handle errors and start the tests
process.on('unhandledRejection', (err) => {
  console.error(`${colors.red}Unhandled rejection:${colors.reset}`, err);
});

// Start the tests
try {
  runTests();
} catch (err) {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
} 