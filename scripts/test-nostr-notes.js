import { SimplePool } from 'nostr-tools/pool';
import WebSocket from 'ws';

// Set up WebSocket implementation for Node.js
const pool = new SimplePool({
  ws: WebSocket
});

// List of reliable relays
const relays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://purplepag.es',
  'wss://nostr.bitcoiner.social',
  'wss://nostr.fmt.wiz.biz',
  'wss://nostr.zebedee.cloud',
  'wss://eden.nostr.land',
  'wss://relay.current.fyi'
];

async function fetchNotes(limit = 10) {
  console.log('Fetching notes from Nostr relays...');
  console.log('Connecting to relays:', relays.join(', '));
  
  try {
    // Create a filter for text notes (kind 1)
    const filter = {
      kinds: [1],
      limit: limit,
      since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60) // Last 30 days
    };
    
    console.log('Using filter:', JSON.stringify(filter, null, 2));
    console.log('Waiting for events (timeout: 30s)...\n');
    
    // Create a promise to collect events
    const events = await new Promise((resolve) => {
      const collectedEvents = [];
      let eoseCount = 0;
      
      const sub = pool.subscribeMany(
        relays,
        [filter],
        {
          onevent(event) {
            console.log(`Received event from relay (total: ${collectedEvents.length + 1})`);
            collectedEvents.push(event);
            if (collectedEvents.length >= limit) {
              console.log('Reached event limit, closing subscription');
              sub.close();
              resolve(collectedEvents);
            }
          },
          oneose() {
            eoseCount++;
            console.log(`Received EOSE from relay (${eoseCount}/${relays.length})`);
            if (eoseCount === relays.length) {
              console.log('Received EOSE from all relays, closing subscription');
              sub.close();
              resolve(collectedEvents);
            }
          }
        }
      );
      
      // Set up a timeout
      setTimeout(() => {
        console.log('Timeout reached, closing subscription');
        sub.close();
        resolve(collectedEvents);
      }, 30000); // 30 second timeout
    });
    
    if (events.length === 0) {
      console.log('No notes found in the last 30 days.');
      return;
    }
    
    console.log(`\nFound ${events.length} notes:\n`);
    
    // Display each note
    events.forEach((event, index) => {
      console.log(`Note ${index + 1}:`);
      console.log('ID:', event.id);
      console.log('Author:', event.pubkey);
      console.log('Created:', new Date(event.created_at * 1000).toLocaleString());
      console.log('Content:', event.content);
      if (event.tags && event.tags.length > 0) {
        console.log('Tags:', event.tags);
      }
      console.log('---\n');
    });
    
  } catch (error) {
    console.error('Error fetching notes:', error);
  } finally {
    // Clean up pool connections
    pool.close(relays);
  }
}

// Run the test continuously
async function runContinuousTest() {
  while (true) {
    await fetchNotes(5);
    console.log('\nWaiting 30 seconds before next fetch...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

// Start the continuous test
runContinuousTest().catch(console.error); 