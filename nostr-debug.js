#!/usr/bin/env node

/**
 * Nostr Debugging Tool
 * A comprehensive interactive tool for diagnosing Nostr feed issues
 */

import WebSocket from 'ws';
import * as readline from 'readline';

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

// Default hashtags for running posts
const DEFAULT_HASHTAGS = [
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
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// Clear the console screen
function clearScreen() {
  process.stdout.write('\x1Bc');
}

// Ask a question and get user input
function question(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

// Display the main menu and get user choice
async function showMainMenu() {
  clearScreen();
  console.log(`${colors.magenta}${colors.bold}===== NOSTR DEBUGGING TOOL =====${colors.reset}\n`);
  console.log(`${colors.cyan}1. Test relay connections${colors.reset}`);
  console.log(`${colors.cyan}2. Test hashtag filtering${colors.reset}`);
  console.log(`${colors.cyan}3. Test content-based filtering${colors.reset}`);
  console.log(`${colors.cyan}4. Test non-reply posts${colors.reset}`);
  console.log(`${colors.cyan}5. Test custom filters${colors.reset}`);
  console.log(`${colors.cyan}6. Generate fix recommendations${colors.reset}`);
  console.log(`${colors.cyan}7. Exit${colors.reset}\n`);
  
  const choice = await question(`${colors.yellow}Enter your choice (1-7): ${colors.reset}`);
  return choice;
}

// Test relay connections
async function testRelayConnections(relays = DEFAULT_RELAYS) {
  clearScreen();
  console.log(`${colors.magenta}${colors.bold}===== RELAY CONNECTION TEST =====${colors.reset}\n`);
  console.log(`${colors.cyan}Testing connections to ${relays.length} relays...${colors.reset}\n`);
  
  const results = {};
  
  for (const relay of relays) {
    process.stdout.write(`Testing ${relay}: `);
    
    try {
      const connected = await new Promise((resolve) => {
        const ws = new WebSocket(relay);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          ws.close();
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
  
  await question(`\n${colors.yellow}Press Enter to return to the main menu...${colors.reset}`);
  return results;
}

// Test hashtag filtering
async function testHashtagFiltering(relays = DEFAULT_RELAYS, hashtags = DEFAULT_HASHTAGS) {
  clearScreen();
  console.log(`${colors.magenta}${colors.bold}===== HASHTAG FILTERING TEST =====${colors.reset}\n`);
  console.log(`${colors.cyan}Testing ${relays.length} relays with ${hashtags.length} hashtags...${colors.reset}\n`);
  
  const results = {};
  let totalFound = 0;
  
  for (const relay of relays) {
    console.log(`\n${colors.cyan}Testing ${relay}:${colors.reset}`);
    results[relay] = {};
    
    for (const hashtag of hashtags) {
      process.stdout.write(`  Testing #${hashtag}: `);
      
      try {
        const events = await new Promise((resolve) => {
          const ws = new WebSocket(relay);
          const foundEvents = [];
          
          const timeout = setTimeout(() => {
            ws.close();
            resolve({ events: foundEvents, error: 'Timeout' });
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
                foundEvents.push(message[2]);
              } else if (message[0] === 'EOSE' && message[1] === `HASHTAG_${hashtag}`) {
                clearTimeout(timeout);
                ws.close();
                resolve({ events: foundEvents, error: null });
              }
            } catch (err) {
              // Ignore parsing errors
            }
          });
          
          ws.on('error', (err) => {
            clearTimeout(timeout);
            ws.close();
            resolve({ events: [], error: err.message });
          });
        });
        
        if (events.error) {
          console.log(`${colors.red}✗ Error: ${events.error}${colors.reset}`);
          results[relay][hashtag] = { count: 0, error: events.error };
        } else if (events.events.length > 0) {
          console.log(`${colors.green}✓ Found ${events.events.length} posts${colors.reset}`);
          totalFound += events.events.length;
          results[relay][hashtag] = { count: events.events.length, error: null };
          
          // Show a sample post
          if (events.events.length > 0) {
            const sample = events.events[0].content.substring(0, 100) + (events.events[0].content.length > 100 ? '...' : '');
            console.log(`    Sample: "${sample}"`);
          }
        } else {
          console.log(`${colors.yellow}⚠ No posts found${colors.reset}`);
          results[relay][hashtag] = { count: 0, error: null };
        }
      } catch (err) {
        console.log(`${colors.red}✗ Error: ${err.message}${colors.reset}`);
        results[relay][hashtag] = { count: 0, error: err.message };
      }
    }
  }
  
  // Summary
  console.log(`\n${colors.magenta}===== HASHTAG FILTERING SUMMARY =====${colors.reset}`);
  console.log(`\n${colors.cyan}Total posts found: ${totalFound}${colors.reset}`);
  
  if (totalFound === 0) {
    console.log(`\n${colors.red}No posts found with hashtags. This could explain your empty feed.${colors.reset}`);
    console.log(`${colors.yellow}Try content-based filtering instead.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}Posts with hashtags ARE available. If your feed is empty, the issue may be with rendering or specific relay configuration.${colors.reset}`);
  }
  
  await question(`\n${colors.yellow}Press Enter to return to the main menu...${colors.reset}`);
  return results;
}

// Test content-based filtering
async function testContentFiltering(relays = DEFAULT_RELAYS, keywords = DEFAULT_HASHTAGS) {
  clearScreen();
  console.log(`${colors.magenta}${colors.bold}===== CONTENT-BASED FILTERING TEST =====${colors.reset}\n`);
  console.log(`${colors.cyan}Testing ${relays.length} relays for content containing running keywords...${colors.reset}\n`);
  
  const results = {};
  let totalFound = 0;
  
  for (const relay of relays) {
    console.log(`\n${colors.cyan}Testing ${relay}:${colors.reset}`);
    
    try {
      const eventResult = await new Promise((resolve) => {
        const ws = new WebSocket(relay);
        const foundEvents = [];
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ events: foundEvents, error: 'Timeout' });
        }, 8000);
        
        ws.on('open', () => {
          // Create a 7-day window (smaller to reduce data)
          const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
          
          // Send request for any recent posts
          const req = JSON.stringify([
            "REQ", 
            "CONTENT_FILTER",
            { 
              "kinds": [1], 
              "since": sevenDaysAgo,
              "limit": 20 
            }
          ]);
          
          ws.send(req);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message[0] === 'EVENT' && message[1] === "CONTENT_FILTER") {
              foundEvents.push(message[2]);
            } else if (message[0] === 'EOSE' && message[1] === "CONTENT_FILTER") {
              clearTimeout(timeout);
              ws.close();
              resolve({ events: foundEvents, error: null });
            }
          } catch (err) {
            // Ignore parsing errors
          }
        });
        
        ws.on('error', (err) => {
          clearTimeout(timeout);
          ws.close();
          resolve({ events: [], error: err.message });
        });
      });
      
      if (eventResult.error) {
        console.log(`  ${colors.red}✗ Error: ${eventResult.error}${colors.reset}`);
        results[relay] = { total: 0, running: 0, error: eventResult.error };
      } else if (eventResult.events.length > 0) {
        // Filter events by running-related keywords
        const runningEvents = eventResult.events.filter(event => {
          const content = event.content.toLowerCase();
          return keywords.some(keyword => content.includes(keyword));
        });
        
        console.log(`  ${colors.green}✓ Found ${eventResult.events.length} general posts${colors.reset}`);
        console.log(`  ${colors.green}✓ ${runningEvents.length} of these contain running keywords${colors.reset}`);
        
        totalFound += runningEvents.length;
        results[relay] = { 
          total: eventResult.events.length, 
          running: runningEvents.length, 
          error: null 
        };
        
        // Show a sample post
        if (runningEvents.length > 0) {
          const sample = runningEvents[0].content.substring(0, 100) + (runningEvents[0].content.length > 100 ? '...' : '');
          console.log(`    Sample: "${sample}"`);
        }
      } else {
        console.log(`  ${colors.yellow}⚠ No posts found${colors.reset}`);
        results[relay] = { total: 0, running: 0, error: null };
      }
    } catch (err) {
      console.log(`  ${colors.red}✗ Error: ${err.message}${colors.reset}`);
      results[relay] = { total: 0, running: 0, error: err.message };
    }
  }
  
  // Summary
  console.log(`\n${colors.magenta}===== CONTENT FILTERING SUMMARY =====${colors.reset}`);
  console.log(`\n${colors.cyan}Total running-related posts found: ${totalFound}${colors.reset}`);
  
  if (totalFound === 0) {
    console.log(`\n${colors.red}No running-related content found. This could explain your empty feed.${colors.reset}`);
    console.log(`${colors.yellow}Consider expanding your search criteria or time window.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}Running-related content IS available. If your feed is empty, the issue may be with rendering or filtering configuration.${colors.reset}`);
  }
  
  await question(`\n${colors.yellow}Press Enter to return to the main menu...${colors.reset}`);
  return results;
}

// Test filtering for non-reply posts
async function testNonReplyPosts(relays = DEFAULT_RELAYS) {
  clearScreen();
  console.log(`${colors.magenta}${colors.bold}===== NON-REPLY POSTS TEST =====${colors.reset}\n`);
  console.log(`${colors.cyan}Testing ${relays.length} relays for posts that are NOT replies...${colors.reset}\n`);
  
  const results = {};
  let totalFound = 0;
  let totalNonReplies = 0;
  
  for (const relay of relays) {
    console.log(`\n${colors.cyan}Testing ${relay}:${colors.reset}`);
    
    try {
      const eventResult = await new Promise((resolve) => {
        const ws = new WebSocket(relay);
        const foundEvents = [];
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ events: foundEvents, error: 'Timeout' });
        }, 8000);
        
        ws.on('open', () => {
          // Create a 7-day window (smaller to reduce data)
          const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
          
          // Send request for any recent posts
          const req = JSON.stringify([
            "REQ", 
            "NON_REPLY_FILTER",
            { 
              "kinds": [1], 
              "since": sevenDaysAgo,
              "limit": 20 
            }
          ]);
          
          ws.send(req);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message[0] === 'EVENT' && message[1] === "NON_REPLY_FILTER") {
              foundEvents.push(message[2]);
            } else if (message[0] === 'EOSE' && message[1] === "NON_REPLY_FILTER") {
              clearTimeout(timeout);
              ws.close();
              resolve({ events: foundEvents, error: null });
            }
          } catch (err) {
            // Ignore parsing errors
          }
        });
        
        ws.on('error', (err) => {
          clearTimeout(timeout);
          ws.close();
          resolve({ events: [], error: err.message });
        });
      });
      
      if (eventResult.error) {
        console.log(`  ${colors.red}✗ Error: ${eventResult.error}${colors.reset}`);
        results[relay] = { total: 0, nonReplies: 0, error: eventResult.error };
      } else if (eventResult.events.length > 0) {
        // Filter out events that have e tags (which are replies)
        const nonReplyEvents = eventResult.events.filter(event => 
          !event.tags || !event.tags.some(tag => tag[0] === 'e')
        );
        
        console.log(`  ${colors.green}✓ Found ${eventResult.events.length} total posts${colors.reset}`);
        console.log(`  ${colors.green}✓ ${nonReplyEvents.length} of these are NOT replies${colors.reset}`);
        
        totalFound += eventResult.events.length;
        totalNonReplies += nonReplyEvents.length;
        
        results[relay] = { 
          total: eventResult.events.length, 
          nonReplies: nonReplyEvents.length, 
          error: null 
        };
        
        // Show a sample post
        if (nonReplyEvents.length > 0) {
          const sample = nonReplyEvents[0].content.substring(0, 100) + (nonReplyEvents[0].content.length > 100 ? '...' : '');
          console.log(`    Sample: "${sample}"`);
        }
      } else {
        console.log(`  ${colors.yellow}⚠ No posts found${colors.reset}`);
        results[relay] = { total: 0, nonReplies: 0, error: null };
      }
    } catch (err) {
      console.log(`  ${colors.red}✗ Error: ${err.message}${colors.reset}`);
      results[relay] = { total: 0, nonReplies: 0, error: err.message };
    }
  }
  
  // Summary
  console.log(`\n${colors.magenta}===== NON-REPLY POSTS SUMMARY =====${colors.reset}`);
  console.log(`\n${colors.cyan}Total posts found: ${totalFound}${colors.reset}`);
  console.log(`${colors.cyan}Non-reply posts: ${totalNonReplies} (${Math.round((totalNonReplies / totalFound) * 100) || 0}%)${colors.reset}`);
  
  if (totalNonReplies === 0) {
    console.log(`\n${colors.red}No non-reply posts found. This could explain your empty feed if you're filtering out replies.${colors.reset}`);
    console.log(`${colors.yellow}Consider showing replies in your feed.${colors.reset}`);
  } else if (totalNonReplies < totalFound * 0.3) { // Less than 30% are non-replies
    console.log(`\n${colors.yellow}Only a small percentage of posts are non-replies. If you're filtering out replies, this could contribute to an empty feed.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}Non-reply posts ARE available. If your feed is empty, the issue may be with rendering or other filtering criteria.${colors.reset}`);
  }
  
  await question(`\n${colors.yellow}Press Enter to return to the main menu...${colors.reset}`);
  return results;
}

// Test custom filters
async function testCustomFilters() {
  clearScreen();
  console.log(`${colors.magenta}${colors.bold}===== CUSTOM FILTER TEST =====${colors.reset}\n`);
  
  // Get relay URL
  console.log(`${colors.cyan}Enter a relay URL to test or press Enter to use default (wss://relay.damus.io)${colors.reset}`);
  let relayUrl = await question(`${colors.yellow}Relay URL: ${colors.reset}`);
  relayUrl = relayUrl.trim() || 'wss://relay.damus.io';
  
  // Get custom filter
  console.log(`\n${colors.cyan}Enter a JSON filter object or press Enter to use default${colors.reset}`);
  console.log(`${colors.cyan}Default: { "kinds": [1], "limit": 10 }${colors.reset}`);
  const filterStr = await question(`${colors.yellow}Filter: ${colors.reset}`);
  
  let filter;
  try {
    filter = filterStr.trim() ? JSON.parse(filterStr) : { kinds: [1], limit: 10 };
  } catch (err) {
    console.log(`\n${colors.red}Invalid JSON. Using default filter.${colors.reset}`);
    filter = { kinds: [1], limit: 10 };
  }
  
  console.log(`\n${colors.cyan}Testing relay: ${relayUrl}${colors.reset}`);
  console.log(`${colors.cyan}Using filter: ${JSON.stringify(filter, null, 2)}${colors.reset}\n`);
  
  try {
    const eventResult = await new Promise((resolve) => {
      const ws = new WebSocket(relayUrl);
      const foundEvents = [];
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ events: foundEvents, error: 'Timeout' });
      }, 10000);
      
      ws.on('open', () => {
        console.log(`${colors.green}Connected to ${relayUrl}${colors.reset}`);
        
        // Send request with custom filter
        const req = JSON.stringify([
          "REQ", 
          "CUSTOM_FILTER",
          filter
        ]);
        
        ws.send(req);
        console.log(`${colors.cyan}Sent request: ${req}${colors.reset}\n`);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message[0] === 'EVENT' && message[1] === "CUSTOM_FILTER") {
            foundEvents.push(message[2]);
            console.log(`${colors.green}Received event ${foundEvents.length}${colors.reset}`);
          } else if (message[0] === 'EOSE' && message[1] === "CUSTOM_FILTER") {
            console.log(`${colors.green}End of stored events${colors.reset}`);
            clearTimeout(timeout);
            ws.close();
            resolve({ events: foundEvents, error: null });
          } else if (message[0] === 'NOTICE') {
            console.log(`${colors.yellow}Notice from relay: ${message[1]}${colors.reset}`);
          }
        } catch (err) {
          console.log(`${colors.red}Error parsing message: ${err.message}${colors.reset}`);
        }
      });
      
      ws.on('error', (err) => {
        console.log(`${colors.red}WebSocket error: ${err.message}${colors.reset}`);
        clearTimeout(timeout);
        ws.close();
        resolve({ events: [], error: err.message });
      });
    });
    
    if (eventResult.error) {
      console.log(`\n${colors.red}Error: ${eventResult.error}${colors.reset}`);
    } else if (eventResult.events.length > 0) {
      console.log(`\n${colors.magenta}===== RESULTS =====${colors.reset}`);
      console.log(`\n${colors.green}Found ${eventResult.events.length} events${colors.reset}\n`);
      
      // Show sample events
      for (let i = 0; i < Math.min(3, eventResult.events.length); i++) {
        const event = eventResult.events[i];
        console.log(`${colors.cyan}Event ${i+1}:${colors.reset}`);
        console.log(`  ID: ${event.id?.substring(0, 10)}...`);
        console.log(`  Author: ${event.pubkey?.substring(0, 10)}...`);
        console.log(`  Created: ${new Date(event.created_at * 1000).toLocaleString()}`);
        console.log(`  Tags: ${JSON.stringify(event.tags?.slice(0, 2))}${event.tags?.length > 2 ? '...' : ''}`);
        console.log(`  Content: ${event.content?.substring(0, 100)}${event.content?.length > 100 ? '...' : ''}\n`);
      }
    } else {
      console.log(`\n${colors.yellow}No events found matching your filter.${colors.reset}`);
    }
  } catch (err) {
    console.log(`\n${colors.red}Error: ${err.message}${colors.reset}`);
  }
  
  await question(`\n${colors.yellow}Press Enter to return to the main menu...${colors.reset}`);
}

// Generate fix recommendations based on test results
async function generateFixRecommendations() {
  clearScreen();
  console.log(`${colors.magenta}${colors.bold}===== FIX RECOMMENDATIONS =====${colors.reset}\n`);
  console.log(`${colors.cyan}Running diagnostic tests to generate recommendations...${colors.reset}\n`);
  
  // Quick relay connectivity test
  console.log(`${colors.cyan}Testing relay connectivity...${colors.reset}`);
  let relayResults = {};
  let connectedCount = 0;
  
  for (const relay of DEFAULT_RELAYS) {
    process.stdout.write(`  ${relay}: `);
    
    try {
      const connected = await new Promise((resolve) => {
        const ws = new WebSocket(relay);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          ws.close();
          resolve(false);
        });
      });
      
      if (connected) {
        console.log(`${colors.green}✓${colors.reset}`);
        relayResults[relay] = true;
        connectedCount++;
      } else {
        console.log(`${colors.red}✗${colors.reset}`);
        relayResults[relay] = false;
      }
    } catch (err) {
      console.log(`${colors.red}✗${colors.reset}`);
      relayResults[relay] = false;
    }
  }
  
  // Quick hashtag test on connected relays
  console.log(`\n${colors.cyan}Testing hashtag availability...${colors.reset}`);
  const connectedRelays = Object.keys(relayResults).filter(relay => relayResults[relay]);
  
  if (connectedRelays.length === 0) {
    console.log(`  ${colors.red}No connected relays to test${colors.reset}`);
  }
  
  let hashtagResults = {};
  let hashtagsFound = 0;
  
  for (const relay of connectedRelays.slice(0, 2)) { // Test only first 2 connected relays for speed
    hashtagResults[relay] = {};
    let foundOnThisRelay = false;
    
    for (const hashtag of DEFAULT_HASHTAGS.slice(0, 3)) { // Test only first 3 hashtags for speed
      process.stdout.write(`  Testing ${relay} with #${hashtag}: `);
      
      try {
        const events = await new Promise((resolve) => {
          const ws = new WebSocket(relay);
          const foundEvents = [];
          
          const timeout = setTimeout(() => {
            ws.close();
            resolve({ events: foundEvents, error: 'Timeout' });
          }, 5000);
          
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
                foundEvents.push(message[2]);
              } else if (message[0] === 'EOSE' && message[1] === `HASHTAG_${hashtag}`) {
                clearTimeout(timeout);
                ws.close();
                resolve({ events: foundEvents, error: null });
              }
            } catch (err) {
              // Ignore parsing errors
            }
          });
          
          ws.on('error', (err) => {
            clearTimeout(timeout);
            ws.close();
            resolve({ events: [], error: err.message });
          });
        });
        
        if (events.error) {
          console.log(`${colors.red}✗ Error${colors.reset}`);
          hashtagResults[relay][hashtag] = { count: 0, error: events.error };
        } else if (events.events.length > 0) {
          console.log(`${colors.green}✓ ${events.events.length} posts${colors.reset}`);
          hashtagResults[relay][hashtag] = { count: events.events.length, error: null };
          hashtagsFound += events.events.length;
          foundOnThisRelay = true;
        } else {
          console.log(`${colors.yellow}⚠ None${colors.reset}`);
          hashtagResults[relay][hashtag] = { count: 0, error: null };
        }
      } catch (err) {
        console.log(`${colors.red}✗ Error${colors.reset}`);
        hashtagResults[relay][hashtag] = { count: 0, error: err.message };
      }
    }
    
    if (!foundOnThisRelay) {
      // Quick test for general posts
      process.stdout.write(`  Testing ${relay} for any posts: `);
      
      try {
        const events = await new Promise((resolve) => {
          const ws = new WebSocket(relay);
          const foundEvents = [];
          
          const timeout = setTimeout(() => {
            ws.close();
            resolve({ events: foundEvents, error: 'Timeout' });
          }, 5000);
          
          ws.on('open', () => {
            const req = JSON.stringify([
              "REQ", 
              "GENERAL",
              { 
                "kinds": [1], 
                "limit": 5 
              }
            ]);
            
            ws.send(req);
          });
          
          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              if (message[0] === 'EVENT' && message[1] === "GENERAL") {
                foundEvents.push(message[2]);
              } else if (message[0] === 'EOSE' && message[1] === "GENERAL") {
                clearTimeout(timeout);
                ws.close();
                resolve({ events: foundEvents, error: null });
              }
            } catch (err) {
              // Ignore parsing errors
            }
          });
          
          ws.on('error', (err) => {
            clearTimeout(timeout);
            ws.close();
            resolve({ events: [], error: err.message });
          });
        });
        
        if (events.error) {
          console.log(`${colors.red}✗ Error${colors.reset}`);
        } else if (events.events.length > 0) {
          console.log(`${colors.green}✓ ${events.events.length} posts${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠ None${colors.reset}`);
        }
      } catch (err) {
        console.log(`${colors.red}✗ Error${colors.reset}`);
      }
    }
  }
  
  // Generate recommendations
  console.log(`\n${colors.magenta}===== DIAGNOSTIC RESULTS =====${colors.reset}\n`);
  
  if (connectedCount === 0) {
    console.log(`${colors.red}CRITICAL: No relay connections available.${colors.reset}`);
    console.log(`${colors.yellow}Recommendations:${colors.reset}`);
    console.log(`1. Check your internet connection and firewall settings`);
    console.log(`2. Try different relays in your configuration`);
    console.log(`3. Ensure your app initializes Nostr connections properly`);
  } else if (hashtagsFound === 0) {
    console.log(`${colors.yellow}ISSUE: No running-related hashtags found.${colors.reset}`);
    console.log(`${colors.green}Recommendations:${colors.reset}`);
    console.log(`1. Implement content-based filtering as a fallback:`);
    console.log(`   - First try hashtag filtering`);
    console.log(`   - If no results, fetch general posts and filter by content`);
    console.log(`\n2. Edit src/utils/nostr.js to use this implementation:`);
    
    const sampleCode = `
export const fetchRunningPosts = async (limit = 10, since = undefined) => {
  try {
    // Try hashtag-based filtering first
    const defaultSince = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const sinceTimestamp = since ? Math.floor(since / 1000) : defaultSince;
    
    console.log("Fetching running posts with hashtags...");
    const hashtagFilter = {
      kinds: [1],
      limit: limit || 10,
      "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon", "jog"],
      since: sinceTimestamp
    };
    
    const events = await ndk.fetchEvents(hashtagFilter);
    let eventArray = Array.from(events);
    
    // If hashtag search found results, return them
    if (eventArray.length > 0) {
      console.log(\`Found \${eventArray.length} posts with hashtags\`);
      return eventArray;
    }
    
    // Fallback to content-based filtering
    console.log("No hashtag results, trying content-based filtering...");
    const contentFilter = {
      kinds: [1],
      limit: (limit || 10) * 3, // Get more to filter client-side
      since: sinceTimestamp
    };
    
    const contentEvents = await ndk.fetchEvents(contentFilter);
    const allEvents = Array.from(contentEvents);
    
    // Filter for running content client-side
    const runningKeywords = ["running", "run", "runner", "5k", "10k", "marathon", "jog"];
    const runningEvents = allEvents.filter(event => {
      const content = event.content.toLowerCase();
      return runningKeywords.some(keyword => content.includes(keyword));
    }).slice(0, limit);
    
    console.log(\`Found \${runningEvents.length} posts via content filtering\`);
    return runningEvents;
  } catch (error) {
    console.error("Error fetching running posts:", error);
    return [];
  }
};`;
    
    console.log(`${colors.cyan}${sampleCode}${colors.reset}`);
  } else {
    console.log(`${colors.green}GOOD NEWS: Running-related hashtags are available.${colors.reset}`);
    console.log(`${colors.yellow}The issue may be in the rendering or UI component of your app.${colors.reset}`);
    console.log(`${colors.green}Recommendations:${colors.reset}`);
    console.log(`1. Check the PostList component to ensure posts are being rendered`);
    console.log(`2. Add debug logging in your RunClub component to see if posts array is populated`);
    console.log(`3. Make sure CSS styles in RunClub.css are not hiding posts with display:none`);
  }
  
  await question(`\n${colors.yellow}Press Enter to return to the main menu...${colors.reset}`);
}

// Main function
async function main() {
  let running = true;
  
  while (running) {
    const choice = await showMainMenu();
    
    switch (choice) {
      case '1':
        await testRelayConnections();
        break;
      case '2':
        await testHashtagFiltering();
        break;
      case '3':
        await testContentFiltering();
        break;
      case '4':
        await testNonReplyPosts();
        break;
      case '5':
        await testCustomFilters();
        break;
      case '6':
        await generateFixRecommendations();
        break;
      case '7':
        running = false;
        break;
      default:
        console.log(`\n${colors.red}Invalid choice. Please enter a number between 1 and 7.${colors.reset}`);
        await question(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
    }
  }
  
  rl.close();
  console.log(`\n${colors.green}Thanks for using the Nostr Debugging Tool!${colors.reset}`);
}

// Handle errors and start the program
process.on('unhandledRejection', (err) => {
  console.error(`${colors.red}Unhandled rejection:${colors.reset}`, err);
});

// Start the program
try {
  main();
} catch (err) {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
} 