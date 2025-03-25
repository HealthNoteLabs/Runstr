// Import required modules
const { SimplePool } = await import('nostr-tools/pool');
const WebSocket = await import('ws');

// Set up WebSocket implementation for Node.js
const pool = new SimplePool({
  ws: WebSocket.default,
  eoseSubTimeout: 10_000,
  getTimeout: 15_000,
  connectTimeout: 8_000
});

// Use the project's standard relay set
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://eden.nostr.land',
  'wss://relay.current.fyi'
];

async function testRunningPosts() {
  console.log('Starting Nostr relay test...\n');
  
  const results = {
    relays: {},
    events: [],
    errors: []
  };

  // Calculate timestamp for 1 week ago
  const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

  // Test 1: Connect to relays
  console.log('Testing relay connections...');
  for (const relay of RELAYS) {
    try {
      console.log(`\nConnecting to ${relay}...`);
      const ws = new WebSocket(relay);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 8000); // 8 second timeout

        ws.on('open', () => {
          clearTimeout(timeout);
          results.relays[relay] = { status: 'connected', ws };
          console.log(`✅ Successfully connected to ${relay}`);
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          results.relays[relay] = { status: 'failed', error: error.message };
          results.errors.push(`Failed to connect to ${relay}: ${error.message}`);
          console.log(`❌ Failed to connect to ${relay}: ${error.message}`);
          reject(error);
        });
      });

      // Subscribe to running events with hashtags
      const subscription = [
        'REQ',
        'test-subscription',
        {
          kinds: [1],
          since: oneWeekAgo,
          limit: 50,
          '#t': ['running', 'runstr', 'run']  // Search for specific hashtags
        }
      ];
      
      console.log(`\nSubscribing to running events on ${relay} since ${new Date(oneWeekAgo * 1000).toISOString()}...`);
      ws.send(JSON.stringify(subscription));

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message[0] === 'EVENT' && message[2]) {
            const event = message[2];
            // Store event with its timestamp for sorting
            results.events.push({
              id: event.id,
              pubkey: event.pubkey,
              content: event.content,
              created_at: event.created_at,
              created_at_iso: new Date(event.created_at * 1000).toISOString(),
              tags: event.tags
            });
          }
        } catch (err) {
          console.log(`Error processing message: ${err.message}`);
          results.errors.push(`Error processing message from ${relay}: ${err.message}`);
        }
      });

    } catch (err) {
      results.relays[relay] = { status: 'failed', error: err.message };
      results.errors.push(`Failed to connect to ${relay}: ${err.message}`);
      console.log(`❌ Failed to connect to ${relay}: ${err.message}`);
    }
  }

  // Wait for 15 seconds to collect events (increased from 10)
  console.log('\nWaiting for events (15 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Close all connections
  for (const { ws } of Object.values(results.relays)) {
    if (ws) {
      ws.close();
    }
  }

  // Sort events by timestamp (newest first)
  results.events.sort((a, b) => b.created_at - a.created_at);

  // Remove duplicates based on event ID
  results.events = Array.from(new Map(results.events.map(event => [event.id, event])).values());

  // Print results
  console.log('\n=== Test Results ===');
  console.log('\nRelay Status:');
  Object.entries(results.relays).forEach(([relay, status]) => {
    console.log(`${relay}: ${status.status}`);
    if (status.error) {
      console.log(`  Error: ${status.error}`);
    }
  });

  console.log(`\nRunning Events Found: ${results.events.length}`);
  if (results.events.length > 0) {
    console.log('\nEvents from newest to oldest:');
    results.events.forEach((event, index) => {
      console.log(`\n${index + 1}. From: ${event.pubkey}`);
      console.log(`   At: ${event.created_at_iso}`);
      console.log(`   Content: ${event.content}`);
      console.log(`   Tags: ${JSON.stringify(event.tags)}`);
      console.log('   ' + '-'.repeat(50));
    });
  } else {
    console.log('\nNo running events found in the last week. Try:');
    console.log('1. Increasing the time window');
    console.log('2. Adding more relays');
    console.log('3. Checking if the relays have historical data');
  }

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(error => console.log(`- ${error}`));
  }
}

// Run the test
testRunningPosts().catch(console.error);