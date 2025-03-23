import { SimplePool } from 'nostr-tools';

// Create a pool with reasonable timeouts
const pool = new SimplePool();

// Core set of reliable relays
const relays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://eden.nostr.land',
  'wss://relay.current.fyi'
];

/**
 * Fetch running-related posts from Nostr relays
 * @param {number} limit - Maximum number of posts to return
 * @param {number} since - Timestamp to fetch posts since (in ms)
 * @returns {Promise<Array>} Array of running posts
 */
export const fetchRunningPosts = async (limit = 20, since = undefined) => {
  try {
    // Convert timestamp if provided, otherwise use last 7 days
    const sinceTimestamp = since 
      ? Math.floor(since / 1000) 
      : Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    
    // Define filter for running-related content
    const filter = {
      kinds: [1], // Regular posts
      limit,
      "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon", "jog", "jogging"],
      since: sinceTimestamp
    };
    
    // Fetch events from the pool of relays
    console.log('Fetching running posts with filter:', filter);
    const events = await pool.list(relays, [filter], { timeout: 8000 });
    console.log(`Found ${events.length} running posts`);
    
    // Sort by created_at, newest first
    return events.sort((a, b) => b.created_at - a.created_at);
  } catch (error) {
    console.error('Error fetching running posts:', error);
    return [];
  }
};

/**
 * Initialize Nostr connections
 * @returns {Promise<boolean>} Success status
 */
export const initNostr = async () => {
  try {
    // Ensure we have connections to relays
    relays.forEach(relay => pool.ensureRelay(relay));
    return true;
  } catch (error) {
    console.error('Error initializing Nostr:', error);
    return false;
  }
};

/**
 * Process posts to add author profile information
 * @param {Array} posts - Raw posts from fetchRunningPosts
 * @returns {Promise<Array>} Processed posts with author profiles
 */
export const processPostsWithProfiles = async (posts) => {
  if (!posts || posts.length === 0) return [];
  
  try {
    // Extract unique author public keys
    const authors = [...new Set(posts.map(post => post.pubkey))];
    
    // Fetch profiles for authors
    const profileEvents = await pool.list(relays, [{
      kinds: [0],
      authors
    }], { timeout: 5000 });
    
    // Create a profile map
    const profileMap = new Map(
      profileEvents.map((profile) => {
        try {
          return [profile.pubkey, JSON.parse(profile.content)];
        } catch (err) {
          console.error('Error parsing profile:', err);
          return [profile.pubkey, {}];
        }
      })
    );
    
    // Process posts with profile info
    return posts.map(post => ({
      id: post.id,
      content: post.content,
      created_at: post.created_at,
      author: {
        pubkey: post.pubkey,
        profile: profileMap.get(post.pubkey) || {}
      }
    }));
  } catch (error) {
    console.error('Error processing posts with profiles:', error);
    return posts.map(post => ({
      id: post.id,
      content: post.content,
      created_at: post.created_at,
      author: {
        pubkey: post.pubkey,
        profile: {}
      }
    }));
  }
};

// Clean up resources when app goes to background
export const cleanup = () => {
  pool.close(relays);
};

// Export core functions and objects
export { pool, relays }; 