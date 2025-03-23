import { SimplePool, finalizeEvent, verifyEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

// Create a pool with optimal timeouts
const pool = new SimplePool({
  eoseSubTimeout: 10_000,
  getTimeout: 12_000,
  connectTimeout: 8_000
});

// Use the EXACT same relays as the working implementation
// A focused set of reliable relays is better than trying too many
const relays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://eden.nostr.land',
  'wss://relay.current.fyi'
];

// Storage for keys
let cachedKeyPair = null;
const activeSubscriptions = new Set();

/**
 * Initialize the Nostr client - simpler version
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Ensure we have active connections to relays
    const connectedRelays = [];
    for (const relay of relays) {
      try {
        const conn = pool.ensureRelay(relay);
        if (conn) {
          connectedRelays.push(relay);
        }
      } catch (error) {
        console.warn(`Failed to connect to relay: ${relay}`, error);
      }
    }
    
    console.log(`Connected to ${connectedRelays.length}/${relays.length} relays`);
    return connectedRelays.length > 0;
  } catch (error) {
    console.error('Error initializing Nostr:', error);
    return false;
  }
};

/**
 * Simple NDK-like fetchEvents function for Nostr
 * @param {Object} filter - Nostr filter
 * @returns {Promise<Array>} Array of events
 */
export const fetchEvents = async (filter) => {
  try {
    // Log what we're fetching - helpful for debugging
    console.log('Fetching events with filter:', filter);
    
    // Set safe defaults like the working implementation
    if (!filter.limit) {
      filter.limit = 30;
    }
    
    // Fetch events using the pool
    const events = await pool.list(relays, [filter], { timeout: 12000 });
    console.log(`Fetched ${events.length} events for filter:`, filter);
    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

/**
 * Get running posts - uses SAME tags as working implementation
 * @param {number} limit - max posts to fetch
 * @param {number} since - timestamp to fetch posts since
 * @returns {Promise<Array>} Array of running posts
 */
export const fetchRunningPosts = async (limit = 10, since = undefined) => {
  // Convert "since" from milliseconds to Unix timestamp if needed
  const sinceTimestamp = since ? Math.floor(since / 1000) : undefined;
  
  // Use EXACT SAME filter structure and tags as the working implementation
  const filter = {
    kinds: [1], // Regular posts
    limit,
    "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon", "jog"]
  };
  
  // Add since parameter if provided (for pagination)
  if (sinceTimestamp) {
    filter.since = sinceTimestamp;
  }
  
  return await fetchEvents(filter);
};

/**
 * Load all supplementary data for posts in parallel
 * (Like in the working implementation)
 * @param {Array} posts - Array of posts to load data for
 * @returns {Promise<Object>} Object containing all supplementary data
 */
export const loadSupplementaryData = async (posts) => {
  if (!posts || posts.length === 0) return {};
  
  // Extract all post IDs
  const postIds = posts.map(post => post.id);
  // Extract unique author public keys
  const authors = [...new Set(posts.map(post => post.pubkey))];
  
  // Run all queries in parallel like in the working implementation
  const [profileEvents, comments, likes, reposts, zapReceipts] = await Promise.all([
    // Profile information
    fetchEvents({
      kinds: [0],
      authors
    }),
    
    // Comments
    fetchEvents({
      kinds: [1],
      '#e': postIds
    }),
    
    // Likes
    fetchEvents({
      kinds: [7],
      '#e': postIds
    }),
    
    // Reposts
    fetchEvents({
      kinds: [6],
      '#e': postIds
    }),
    
    // Zap receipts
    fetchEvents({
      kinds: [9735],
      '#e': postIds
    })
  ]);
  
  return {
    profileEvents,
    comments,
    likes,
    reposts,
    zapReceipts
  };
};

/**
 * Process posts with supplementary data
 * @param {Array} posts - Array of posts to process
 * @param {Object} supplementaryData - Supplementary data for posts
 * @returns {Array} Processed posts with all metadata
 */
export const processPostsWithData = async (posts, supplementaryData) => {
  try {
    if (!posts || posts.length === 0) {
      return [];
    }
    
    const { profileEvents, comments, likes, reposts, zapReceipts } = supplementaryData;
    
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
    
    // Get current user's pubkey if available
    let userPubkey = '';
    try {
      if (window.nostr) {
        userPubkey = await window.nostr.getPublicKey();
      }
    } catch (err) {
      console.error('Error getting user pubkey:', err);
    }
    
    // Count likes and reposts per post
    const likesByPost = new Map();
    const repostsByPost = new Map();
    const userLikes = new Set();
    const userReposts = new Set();
    const zapsByPost = new Map();
    
    // Process likes
    likes.forEach(like => {
      const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
      if (postId) {
        if (!likesByPost.has(postId)) {
          likesByPost.set(postId, 0);
        }
        likesByPost.set(postId, likesByPost.get(postId) + 1);
        
        // Check if current user liked this post
        if (like.pubkey === userPubkey) {
          userLikes.add(postId);
        }
      }
    });
    
    // Process reposts
    reposts.forEach(repost => {
      const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
      if (postId) {
        if (!repostsByPost.has(postId)) {
          repostsByPost.set(postId, 0);
        }
        repostsByPost.set(postId, repostsByPost.get(postId) + 1);
        
        // Check if current user reposted this post
        if (repost.pubkey === userPubkey) {
          userReposts.add(postId);
        }
      }
    });
    
    // Process zap receipts
    zapReceipts.forEach(zapReceipt => {
      try {
        const postId = zapReceipt.tags.find(tag => tag[0] === 'e')?.[1];
        if (postId) {
          // Get the zap amount from the bolt11 or amount tag
          let zapAmount = 0;
          
          // Check for a direct amount tag
          const amountTag = zapReceipt.tags.find(tag => tag[0] === 'amount');
          if (amountTag && amountTag[1]) {
            // Amount is in millisatoshis, convert to sats
            zapAmount = parseInt(amountTag[1], 10) / 1000;
          } else {
            // If no amount tag, count as 1 zap
            zapAmount = 1;
          }
          
          // Add to post's total zaps
          if (!zapsByPost.has(postId)) {
            zapsByPost.set(postId, { count: 0, amount: 0 });
          }
          const postZaps = zapsByPost.get(postId);
          postZaps.count += 1;
          postZaps.amount += zapAmount;
          zapsByPost.set(postId, postZaps);
        }
      } catch (err) {
        console.error('Error processing zap receipt:', err);
      }
    });
    
    // Group comments by their parent post
    const commentsByPost = new Map();
    comments.forEach((comment) => {
      const parentId = comment.tags.find((tag) => tag[0] === 'e')?.[1];
      if (parentId) {
        if (!commentsByPost.has(parentId)) {
          commentsByPost.set(parentId, []);
        }
        const profile = profileMap.get(comment.pubkey) || {};
        commentsByPost.get(parentId).push({
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          author: {
            pubkey: comment.pubkey,
            profile: profile
          }
        });
      }
    });
    
    // Process posts with all the data
    const processedPosts = posts.map(post => {
      const profile = profileMap.get(post.pubkey) || {};
      const postZaps = zapsByPost.get(post.id) || { count: 0, amount: 0 };
      
      return {
        id: post.id,
        content: post.content,
        created_at: post.created_at,
        author: {
          pubkey: post.pubkey,
          profile: profile,
          lud16: profile.lud16,
          lud06: profile.lud06
        },
        comments: commentsByPost.get(post.id) || [],
        showComments: false,
        likes: likesByPost.get(post.id) || 0,
        reposts: repostsByPost.get(post.id) || 0,
        zaps: postZaps.count,
        zapAmount: postZaps.amount
      };
    });
    
    // Sort by created_at, newest first
    return processedPosts.sort((a, b) => b.created_at - a.created_at);
  } catch (error) {
    console.error('Error processing posts:', error);
    return posts;
  }
};

/**
 * Handle app going to background
 */
export const handleAppBackground = () => {
  // Close all active subscriptions
  for (const sub of activeSubscriptions) {
    sub.stop();
  }
  activeSubscriptions.clear();
  
  // Close connections to relays
  pool.close(relays);
};

/**
 * Create and publish an event
 * @param {Object} eventTemplate - Event template 
 * @returns {Promise<Object>} Published event
 */
export const createAndPublishEvent = async (eventTemplate) => {
  try {
    if (!cachedKeyPair) {
      cachedKeyPair = generateKeyPair();
    }
    
    // Sign the event
    const signedEvent = finalizeEvent(eventTemplate, cachedKeyPair.privateKey);
    
    // Verify the event signature
    const verified = verifyEvent(signedEvent);
    if (!verified) {
      throw new Error('Event verification failed');
    }
    
    // Publish to relays
    await pool.publish(relays, signedEvent, { timeout: 8000 });
    return signedEvent;
  } catch (error) {
    console.error('Error publishing event:', error);
    throw error;
  }
};

/**
 * Diagnostic function that works similar to the previous implementation
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
    for (const relay of relays) {
      try {
        const conn = pool.ensureRelay(relay);
        results.relayStatus[relay] = conn ? 'connected' : 'failed';
      } catch (err) {
        results.relayStatus[relay] = `error: ${err.message}`;
      }
    }
    
    // Test general event retrieval (any posts)
    const generalEvents = await fetchEvents({
      kinds: [1],
      limit: 20
    });
    
    results.generalEvents = generalEvents.length;
    
    // Test running posts using the EXACT same filter as working implementation
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

/**
 * Search notes by content for running-related terms
 * This is a fallback when hashtag search fails
 */
export const searchRunningContent = async (limit = 50, hours = 168) => {
  // Get recent notes
  const filter = {
    kinds: [1],
    limit: limit,
    since: Math.floor(Date.now() / 1000) - (hours * 60 * 60)
  };
  
  const events = await fetchEvents(filter);
  
  // Filter for running-related content - using SAME keywords as working implementation
  const runningKeywords = [
    'running', 'run', 'runner', '5k', '10k', 'marathon', 'jog', 'jogging'
  ];
  
  return events.filter(event => {
    const lowerContent = event.content.toLowerCase();
    return runningKeywords.some(keyword => lowerContent.includes(keyword));
  });
};

/**
 * Generate and store a key pair
 * @returns {Object} Object containing public and private keys
 */
export const generateKeyPair = () => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  cachedKeyPair = { privateKey: sk, publicKey: pk };
  return cachedKeyPair;
};

export { pool, relays };
