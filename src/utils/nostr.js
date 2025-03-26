import { SimplePool, finalizeEvent, verifyEvent } from 'nostr-tools';

// Create a simple pool with reasonable timeouts
const pool = new SimplePool({
  eoseSubTimeout: 10_000,
  getTimeout: 15_000,
  connectTimeout: 8_000
});

// Focus on a smaller set of the most reliable relays
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nostr.bitcoiner.social',
  'wss://nostr.mom'
];

// Storage for subscriptions
const activeSubscriptions = new Set();

/**
 * Initialize the Nostr client - connect to relays
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Test connection to relays
    const connectedRelays = [];
    
    for (const relay of RELAYS) {
      try {
        const conn = pool.ensureRelay(relay);
        if (conn) {
          connectedRelays.push(relay);
        }
      } catch (error) {
        console.warn(`Failed to connect to relay: ${relay}`, error);
      }
    }
    
    console.log(`Connected to ${connectedRelays.length}/${RELAYS.length} relays`);
    return connectedRelays.length > 0;
  } catch (error) {
    console.error('Error initializing Nostr:', error);
    return false;
  }
};

/**
 * Fetch running posts from Nostr
 * @param {number} limit - Maximum number of posts to fetch
 * @param {number} since - Unix timestamp to fetch posts since
 * @returns {Promise<Array>} Array of running posts
 */
export const fetchRunningPosts = async (limit = 50, since = undefined) => {
  try {
    // Calculate timestamp for 1 week ago if not provided
    const oneWeekAgo = since || Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    
    // Create filter for running posts
    const filter = {
      kinds: [1],
      since: oneWeekAgo,
      limit,
      '#t': ['running', 'runstr', 'run']
    };
    
    console.log('Fetching running posts with filter:', filter);
    
    // Fetch events using nostr-tools
    const events = await pool.list(RELAYS, [filter]);
    
    // Sort events by timestamp (newest first)
    events.sort((a, b) => b.created_at - a.created_at);
    
    // Remove duplicates based on event ID
    const uniqueEvents = Array.from(new Map(events.map(event => [event.id, event])).values());
    
    console.log(`Fetched ${uniqueEvents.length} unique running posts`);
    return uniqueEvents;
  } catch (error) {
    console.error('Error fetching running posts:', error);
    return [];
  }
};

/**
 * Search for running content in posts
 * @param {number} limit - Maximum number of posts to fetch
 * @param {number} hours - Hours to look back
 * @returns {Promise<Array>} Array of posts mentioning running
 */
export const searchRunningContent = async (limit = 50, hours = 72) => {
  try {
    const since = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
    
    const filter = {
      kinds: [1],
      since,
      limit
    };
    
    console.log('Searching for running content with filter:', filter);
    
    const events = await pool.list(RELAYS, [filter]);
    
    // Filter for posts mentioning running
    const runningPosts = events.filter(event => {
      const content = event.content.toLowerCase();
      return content.includes('running') || 
             content.includes('run') || 
             content.includes('runner') ||
             content.includes('ran');
    });
    
    console.log(`Found ${runningPosts.length} posts mentioning running`);
    return runningPosts;
  } catch (error) {
    console.error('Error searching running content:', error);
    return [];
  }
};

/**
 * Load supplementary data for posts (likes, reposts, etc.)
 * @param {Array} posts - Array of posts to load data for
 * @returns {Promise<Object>} Object containing supplementary data
 */
export const loadSupplementaryData = async (posts) => {
  try {
    const postIds = posts.map(post => post.id);
    
    // Fetch likes and reposts
    const [likes, reposts] = await Promise.all([
      pool.list(RELAYS, [{
        kinds: [7],
        '#e': postIds
      }]),
      pool.list(RELAYS, [{
        kinds: [6],
        '#e': postIds
      }])
    ]);
    
    return {
      likes,
      reposts
    };
  } catch (error) {
    console.error('Error loading supplementary data:', error);
    return {
      likes: [],
      reposts: []
    };
  }
};

/**
 * Process posts with supplementary data
 * @param {Array} posts - Array of posts to process
 * @param {Object} supplementaryData - Supplementary data for the posts
 * @returns {Promise<Array>} Processed posts
 */
export const processPostsWithData = async (posts, supplementaryData) => {
  try {
    const { likes, reposts } = supplementaryData;
    
    // Create maps for faster lookups
    const likesMap = new Map(likes.map(like => {
      const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
      return [postId, like];
    }));
    
    const repostsMap = new Map(reposts.map(repost => {
      const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
      return [postId, repost];
    }));
    
    // Process each post
    return posts.map(post => ({
      ...post,
      likes: likesMap.get(post.id) || null,
      reposts: repostsMap.get(post.id) || null,
      created_at_iso: new Date(post.created_at * 1000).toISOString()
    }));
  } catch (error) {
    console.error('Error processing posts with data:', error);
    return posts;
  }
};

/**
 * Create and publish an event
 * @param {Object} eventTemplate - Event template 
 * @returns {Promise<Object>} Published event
 */
export const createAndPublishEvent = async (eventTemplate) => {
  try {
    if (!window.nostr) {
      throw new Error('Nostr extension not available');
    }
    
    // Get the public key from nostr extension
    const pubkey = await window.nostr.getPublicKey();
    
    // Create the event with user's pubkey
    const event = {
      ...eventTemplate,
      pubkey,
      created_at: Math.floor(Date.now() / 1000)
    };
    
    // Sign the event using the browser extension
    const signedEvent = await window.nostr.signEvent(event);
    
    // Verify the signature
    const valid = verifyEvent(signedEvent);
    if (!valid) {
      throw new Error('Event signature verification failed');
    }
    
    // Publish the event to all relays
    await pool.publish(RELAYS, signedEvent);
    
    return signedEvent;
  } catch (error) {
    console.error('Error publishing event:', error);
    throw error;
  }
};

/**
 * Handle app background state
 */
export const handleAppBackground = () => {
  // Close all active subscriptions
  for (const sub of activeSubscriptions) {
    sub.close();
  }
  activeSubscriptions.clear();
  
  // Close all relay connections
  pool.close(RELAYS);
};

/**
 * Diagnostic function that tests connection to relays
 */
export const diagnoseConnection = async () => {
  const results = {
    relayStatus: {},
    generalEvents: 0,
    runningEvents: 0,
    error: null,
    success: false
  };
  
  try {
    // Initialize
    await initializeNostr();
    
    // Check each relay status
    for (const url of RELAYS) {
      try {
        const relay = pool.getRelay(url);
        results.relayStatus[url] = relay.status;
      } catch (err) {
        results.relayStatus[url] = `error: ${err.message}`;
      }
    }
    
    // Test general event retrieval (any posts)
    const generalEvents = await pool.list(RELAYS, [{
      kinds: [1],
      limit: 20
    }]);
    
    results.generalEvents = generalEvents.length;
    
    // Test running posts
    if (generalEvents.length > 0) {
      const runningEvents = await fetchRunningPosts(20);
      results.runningEvents = runningEvents.length;
    }
    
    results.success = results.generalEvents > 0;
    return results;
  } catch (err) {
    results.error = err.message;
    return results;
  }
};
