import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

// Create a new NDK instance
const ndk = new NDK({
  explicitRelayUrls: [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band',
    'wss://relay.snort.social',
    'wss://eden.nostr.land',
    'wss://relay.current.fyi'
  ]
});

// Storage for subscriptions
const activeSubscriptions = new Set();

/**
 * Initialize the Nostr client - connect to relays
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Connect to relays with timeout
    const connectPromise = ndk.connect();
    
    // Add a timeout to the connect promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 8000);
    });
    
    // Race the promises to handle timeouts
    await Promise.race([connectPromise, timeoutPromise]);
    
    // Log relay status after connection
    const relayStatus = {};
    for (const url of ndk.explicitRelayUrls) {
      try {
        const relay = ndk.pool.getRelay(url);
        relayStatus[url] = relay.status;
      } catch (err) {
        relayStatus[url] = `error: ${err.message}`;
      }
    }
    
    console.log('NDK relay status:', relayStatus);
    
    // Check if we have at least one connected relay
    const connectedRelays = Object.values(relayStatus).filter(
      status => status === 'connected' || status === 1 || status === '1'
    );
    
    if (connectedRelays.length === 0) {
      console.warn('No relays connected successfully');
      return false;
    }
    
    console.log(`Connected to ${connectedRelays.length} NDK relays`);
    return true;
  } catch (error) {
    console.error('Error initializing Nostr:', error);
    return false;
  }
};

/**
 * Fetch events from Nostr
 * @param {Object} filter - Nostr filter
 * @returns {Promise<Set>} Set of events
 */
export const fetchEvents = async (filter) => {
  try {
    // Log what we're fetching - helpful for debugging
    console.log('Fetching events with filter:', filter);
    
    // Set safe defaults
    if (!filter.limit) {
      filter.limit = 30;
    }
    
    // Make sure we're connected to relays
    const connected = await initializeNostr();
    if (!connected) {
      console.warn('Failed to connect to relays, trying again...');
      await initializeNostr(); // One retry
    }
    
    // Add optional until parameter to ensure we get recent posts
    if (!filter.until && !filter.since) {
      filter.until = Math.floor(Date.now() / 1000);
    }
    
    // Fetch events using NDK with timeout
    const fetchPromise = ndk.fetchEvents(filter);
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve(new Set()), 10000);
    });
    
    const events = await Promise.race([fetchPromise, timeoutPromise]);
    
    // Log event count with event kinds breakdown for debugging
    const eventsArray = Array.from(events);
    const eventTypes = eventsArray.reduce((acc, event) => {
      acc[event.kind] = (acc[event.kind] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`Fetched ${events.size} events for filter:`, filter);
    if (events.size > 0) {
      console.log('Event kinds breakdown:', eventTypes);
    }
    
    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    return new Set();
  }
};

/**
 * Get running posts - matches the working implementation
 * @param {number} limit - max posts to fetch
 * @param {number} since - timestamp to fetch posts since
 * @returns {Promise<Array>} Array of running posts
 */
export const fetchRunningPosts = async (limit = 10, since = undefined) => {
  try {
    // Convert "since" from milliseconds to Unix timestamp if needed
    const sinceTimestamp = since ? Math.floor(since / 1000) : undefined;
    const untilTimestamp = Math.floor(Date.now() / 1000); // Ensure recent posts
    
    console.log('Fetching running posts with hashtags...');
    
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
    
    // Add until parameter to ensure we get recent posts
    filter.until = untilTimestamp;
    
    // Try to fetch events with hashtags
    const events = await fetchEvents(filter);
    console.log(`Fetched ${events.size} running posts with hashtags`);
    
    // If we got no results with hashtags and this is a first page request
    if (events.size === 0 && !since) {
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
      
      const alternateEvents = await fetchEvents(alternateFilter);
      console.log(`Fetched ${alternateEvents.size} posts with alternate tag approach`);
      
      if (alternateEvents.size > 0) {
        return Array.from(alternateEvents);
      }
    }
    
    return Array.from(events);
  } catch (error) {
    console.error('Error fetching running posts with hashtags:', error);
    return [];
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
    
    // Create NDK Event and publish
    const ndkEvent = new NDKEvent(ndk, signedEvent);
    await ndkEvent.publish();
    
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
export const searchRunningContent = async (limit = 50, hours = 168) => {
  try {
    // Get recent notes within the time window
    const since = Math.floor(Date.now() / 1000) - (hours * 60 * 60);
    const until = Math.floor(Date.now() / 1000); // Ensure we get most recent
    
    // Try multiple approaches to find running-related content
    
    // First attempt: direct content search with broader timeframe
    const filter = {
      kinds: [1],
      limit: Math.min(limit * 3, 100), // Fetch more to filter
      since,
      until
    };
    
    console.log('Fallback content search - attempting to fetch generic kind 1 notes');
    const events = await fetchEvents(filter);
    console.log(`Fetched ${events.size} generic kind 1 notes for content filtering`);
    
    if (events.size === 0) {
      // If we got zero events, try with different relays or parameters
      console.log('No events found, trying with extended time window');
      
      // Try with longer timeframe
      const extendedFilter = {
        kinds: [1],
        limit: Math.min(limit * 2, 100),
        since: Math.floor(Date.now() / 1000) - (hours * 2 * 60 * 60) // Double the time window
      };
      
      const extendedEvents = await fetchEvents(extendedFilter);
      
      if (extendedEvents.size === 0) {
        return []; // Still no events, give up
      }
      
      return filterRunningContent(extendedEvents, limit);
    }
    
    return filterRunningContent(events, limit);
  } catch (error) {
    console.error('Error in searchRunningContent:', error);
    return [];
  }
};

/**
 * Helper to filter events for running-related content
 */
const filterRunningContent = (events, limit) => {
  // Filter for running-related content - using SAME keywords as working implementation
  const runningKeywords = [
    'running', 'run', 'runner', 'runstr', '5k', '10k', 'marathon', 'jog', 'jogging',
    'track', 'race', 'miles', 'km', 'fitness', 'training'
  ];
  
  const filteredEvents = Array.from(events).filter(event => {
    if (!event.content) return false;
    const lowerContent = event.content.toLowerCase();
    return runningKeywords.some(keyword => lowerContent.includes(keyword));
  });
  
  console.log(`Found ${filteredEvents.length} running-related posts through content filtering`);
  
  // Return only up to the limit, newest first
  return filteredEvents
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
};

/**
 * Handle app going to background
 */
export const handleAppBackground = () => {
  // Close all active subscriptions
  for (const sub of activeSubscriptions) {
    sub.close();
  }
  activeSubscriptions.clear();
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
    for (const url of ndk.explicitRelayUrls) {
      try {
        const relay = ndk.pool.getRelay(url);
        results.relayStatus[url] = relay.status;
      } catch (err) {
        results.relayStatus[url] = `error: ${err.message}`;
      }
    }
    
    // Test general event retrieval (any posts)
    const generalEvents = await fetchEvents({
      kinds: [1],
      limit: 20
    });
    
    results.generalEvents = generalEvents.size;
    
    // Test running posts using the EXACT same filter as working implementation
    if (generalEvents.size > 0) {
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

export { ndk };
