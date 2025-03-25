import { SimplePool } from 'nostr-tools';

// List of working relays
export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nostr.bitcoiner.social',
  'wss://nostr.mom'
];

// Initialize Nostr pool
export const initializeNostr = () => {
  return new SimplePool();
};

// Fetch running posts from relays
export const fetchRunningPosts = async (since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)) => {
  const pool = initializeNostr();
  const events = [];

  try {
    // Subscribe to running events with hashtags
    const subscription = [
      'REQ',
      'running-posts',
      {
        kinds: [1],
        since,
        limit: 50,
        '#t': ['running', 'runstr', 'run']
      }
    ];

    // Subscribe to all relays
    const sub = pool.sub(RELAYS, [subscription[2]]);

    // Collect events for 10 seconds
    await new Promise((resolve) => {
      sub.on('event', (event) => {
        events.push({
          id: event.id,
          pubkey: event.pubkey,
          content: event.content,
          created_at: event.created_at,
          created_at_iso: new Date(event.created_at * 1000).toISOString(),
          tags: event.tags
        });
      });

      setTimeout(() => {
        sub.unsub();
        resolve();
      }, 10000);
    });

    // Sort events by timestamp (newest first)
    events.sort((a, b) => b.created_at - a.created_at);

    // Remove duplicates
    return Array.from(new Map(events.map(event => [event.id, event])).values());
  } catch (error) {
    console.error('Error fetching running posts:', error);
    throw error;
  } finally {
    // Clean up connections
    await pool.close(RELAYS);
  }
};

// Load supplementary data for posts (likes, reposts, etc.)
export const loadSupplementaryData = async (posts) => {
  // This will be implemented later when we add authentication
  return posts;
};

// Handle app lifecycle events
export const handleAppLifecycle = async (event) => {
  // This will be implemented later when we add authentication
  console.log('App lifecycle event:', event);
};
