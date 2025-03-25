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
export const fetchRunningPosts = async (limit = 10, since = undefined) => {
  const pool = initializeNostr();

  try {
    // Convert "since" from milliseconds to Unix timestamp if needed
    const sinceTimestamp = since ? Math.floor(since / 1000) : undefined;
    const untilTimestamp = Math.floor(Date.now() / 1000); // Ensure recent posts
    
    console.log('Fetching running posts with hashtags...');
    
    // Use EXACT SAME filter structure and tags as the working implementation
    const filter = {
      kinds: [1], // Regular posts
      limit,
      "#t": ["running", "run", "runstr"]  // Focus on core running tags
    };
    
    // Add since parameter if provided (for pagination)
    if (sinceTimestamp) {
      filter.since = sinceTimestamp;
    }
    
    // Add until parameter to ensure we get recent posts
    filter.until = untilTimestamp;
    
    // Try to fetch events with hashtags
    const fetchedEvents = await pool.list(RELAYS, [filter]);
    console.log(`Fetched ${fetchedEvents.length} running posts with hashtags`);
    
    // If we got no results with hashtags and this is a first page request
    if (fetchedEvents.length === 0 && !since) {
      // As a fallback, try an alternate tag approach
      console.log('No posts found with hashtags, trying alternate tag approach...');
      
      const alternateFilter = {
        kinds: [1],
        limit,
        until: untilTimestamp,
        "#t": ["running", "run"] // Try with fewer tags
      };
      
      if (sinceTimestamp) {
        alternateFilter.since = sinceTimestamp;
      }
      
      const alternateEvents = await pool.list(RELAYS, [alternateFilter]);
      console.log(`Fetched ${alternateEvents.length} posts with alternate tag approach`);
      
      if (alternateEvents.length > 0) {
        return alternateEvents;
      }
    }
    
    return fetchedEvents;
  } catch (error) {
    console.error('Error fetching running posts with hashtags:', error);
    return [];
  } finally {
    await pool.close(RELAYS);
  }
};

/**
 * Load all supplementary data for posts in parallel
 * @param {Array} posts - Array of posts to load data for
 * @returns {Promise<Object>} Object containing all supplementary data
 */
export const loadSupplementaryData = async (posts) => {
  if (!posts || posts.length === 0) return {
    profileEvents: new Set(),
    comments: new Set(),
    likes: new Set(),
    reposts: new Set(),
    zapReceipts: new Set()
  };
  
  const pool = initializeNostr();
  
  try {
    // Extract all post IDs
    const postIds = posts.map(post => post.id);
    // Extract unique author public keys
    const authors = [...new Set(posts.map(post => post.pubkey))];
    
    // Run all queries in parallel
    const [profileEvents, comments, likes, reposts, zapReceipts] = await Promise.all([
      // Profile information
      pool.list(RELAYS, [{
        kinds: [0],
        authors
      }]),
      
      // Comments
      pool.list(RELAYS, [{
        kinds: [1],
        '#e': postIds
      }]),
      
      // Likes
      pool.list(RELAYS, [{
        kinds: [7],
        '#e': postIds
      }]),
      
      // Reposts
      pool.list(RELAYS, [{
        kinds: [6],
        '#e': postIds
      }]),
      
      // Zap receipts
      pool.list(RELAYS, [{
        kinds: [9735],
        '#e': postIds
      }])
    ]);
    
    return {
      profileEvents: new Set(profileEvents),
      comments: new Set(comments),
      likes: new Set(likes),
      reposts: new Set(reposts),
      zapReceipts: new Set(zapReceipts)
    };
  } finally {
    await pool.close(RELAYS);
  }
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
      Array.from(profileEvents).map((profile) => {
        try {
          return [profile.pubkey, JSON.parse(profile.content)];
        } catch (err) {
          console.error('Error parsing profile:', err);
          return [profile.pubkey, {}];
        }
      })
    );
    
    // Count likes and reposts per post
    const likesByPost = new Map();
    const repostsByPost = new Map();
    const zapsByPost = new Map();
    
    // Process likes
    Array.from(likes).forEach(like => {
      const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
      if (postId) {
        if (!likesByPost.has(postId)) {
          likesByPost.set(postId, 0);
        }
        likesByPost.set(postId, likesByPost.get(postId) + 1);
      }
    });
    
    // Process reposts
    Array.from(reposts).forEach(repost => {
      const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
      if (postId) {
        if (!repostsByPost.has(postId)) {
          repostsByPost.set(postId, 0);
        }
        repostsByPost.set(postId, repostsByPost.get(postId) + 1);
      }
    });
    
    // Process zap receipts
    Array.from(zapReceipts).forEach(zapReceipt => {
      try {
        const postId = zapReceipt.tags.find(tag => tag[0] === 'e')?.[1];
        if (postId) {
          // Get the zap amount from the bolt11 or amount tag
          let zapAmount = 0;
          
          // First check for a direct amount tag
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
    Array.from(comments).forEach((comment) => {
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
    
    // Publish using nostr-tools
    const pool = initializeNostr();
    await pool.publish(RELAYS, signedEvent);
    await pool.close(RELAYS);
    
    return signedEvent;
  } catch (error) {
    console.error('Error publishing event:', error);
    throw error;
  }
};

/**
 * Search notes by content for running-related terms
 * This is a fallback when hashtag search fails
 */
export const searchRunningContent = async (hours = 168) => {
  const pool = initializeNostr();
  const events = [];

  try {
    // Get recent notes within the time window
    const since = Math.floor(Date.now() / 1000) - (hours * 60 * 60);
    
    // Try multiple approaches to find running-related content
    
    // First attempt: direct content search with broader timeframe
    const filter = {
      kinds: [1],
      since,
      limit: 50,
      '#t': ['running', 'runstr', 'run']
    };

    // Subscribe to all relays
    const sub = pool.sub(RELAYS, [filter]);

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

// Handle app lifecycle events
export const handleAppLifecycle = async (event) => {
  // This will be implemented later when we add authentication
  console.log('App lifecycle event:', event);
};
