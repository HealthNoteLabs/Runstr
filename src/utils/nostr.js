import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';
// Import nostr-tools implementation for fallback and pool for health checks
import { createAndPublishEvent as publishWithNostrTools, pool } from './nostrClient';

// Separate relay lists for different features
export const FEED_RELAYS = [
  'wss://relay.damus.io',    // Most reliable for running content
  'wss://nos.lol',           // Good secondary option
  'wss://nostr.wine',        // Additional reliable relay
  'wss://relay.snort.social' // Backup relay
];

export const GROUP_RELAYS = [
  'wss://groups.0xchat.com', // Primary relay for NIP-29 groups
  'wss://relay.0xchat.com'   // Secondary relay for NIP-29 support
];

// Additional specialized relays
export const ADDITIONAL_RELAYS = [
  'wss://eden.nostr.land',   
  'wss://e.nos.lol',         
  'wss://feeds.nostr.band/running',
  'wss://feeds.nostr.band/popular',
  'wss://purplerelay.com',
  'wss://nostr.bitcoiner.social'
];

// Combined relay list for backward compatibility
export const RELAYS = [...FEED_RELAYS, ...ADDITIONAL_RELAYS, ...GROUP_RELAYS];

// Create NDK instances for different purposes
const feedNdk = new NDK({
  explicitRelayUrls: FEED_RELAYS
});

const groupNdk = new NDK({
  explicitRelayUrls: GROUP_RELAYS
});

// Main NDK instance with all relays for backward compatibility
const ndk = new NDK({
  explicitRelayUrls: RELAYS
});

// Storage for subscriptions
const activeSubscriptions = new Set();

// Track connection status
let isConnected = false;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Track relay performance data
const relayPerformance = {};

// Health check interval (10 minutes)
const HEALTH_CHECK_INTERVAL = 10 * 60 * 1000;

/**
 * Initialize the Nostr client - connect to relays
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Connect to all relay instances
    const [feedConnected, groupConnected, allConnected] = await Promise.all([
      feedNdk.connect().then(() => true).catch(() => false),
      groupNdk.connect().then(() => true).catch(() => false),
      ndk.connect().then(() => true).catch(() => false)
    ]);
    
    console.log('NDK connection status:', {
      feed: feedConnected ? 'connected' : 'failed',
      group: groupConnected ? 'connected' : 'failed',
      all: allConnected ? 'connected' : 'failed'
    });
    
    isConnected = feedConnected || groupConnected || allConnected;
    lastConnectionCheck = Date.now();
    return isConnected;
  } catch (error) {
    console.error('Error initializing Nostr:', error);
    isConnected = false;
    return false;
  }
};

/**
 * Ensure connection to relays is active
 * @returns {Promise<boolean>} Connection status
 */
export const ensureConnection = async () => {
  // Check if we're due for a connection check
  const now = Date.now();
  const timeSinceLastCheck = now - lastConnectionCheck;
  
  if (!isConnected || timeSinceLastCheck > CONNECTION_CHECK_INTERVAL) {
    console.log('Verifying relay connections...');
    
    try {
      // Check existing connections
      const connectionStatus = await diagnoseConnection();
      
      // If we have no connected relays, reconnect
      if (!connectionStatus.connectedRelays || connectionStatus.connectedRelays.length === 0) {
        console.log('No active relay connections, reconnecting...');
        await ndk.connect();
        isConnected = true;
      } else {
        console.log(`Connected to ${connectionStatus.connectedRelays.length} relays`);
        isConnected = true;
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      // Attempt to reconnect
      try {
        await ndk.connect();
        isConnected = true;
      } catch (reconnectError) {
        console.error('Failed to reconnect:', reconnectError);
        isConnected = false;
      }
    }
    
    lastConnectionCheck = now;
  }
  
  return isConnected;
};

/**
 * Fetch events with optimized relay selection
 * @param {Object} filter - Filter object
 * @param {string} type - Type of query ('feed', 'group', or 'all')
 * @returns {Promise<Set>} Set of events
 */
export const fetchEvents = async (filter, type = 'all') => {
  try {
    await ensureConnection();
    
    const startTime = Date.now();
    
    // Add a reasonable limit if none provided
    if (!filter.limit) {
      filter.limit = 50;
    }
    
    // Get optimal relays based on performance data for direct queries
    const optimalRelays = getOptimalRelays(type, 3);
    console.log(`Using optimal relays for ${type} query:`, optimalRelays);
    
    // Select the appropriate NDK instance
    const selectedNdk = 
      type === 'feed' ? feedNdk :
      type === 'group' ? groupNdk :
      ndk; // Default to all relays
    
    // Use the selected NDK instance
    const events = await selectedNdk.fetchEvents(filter);
    
    // Update performance metrics for the relay type
    const responseTime = Date.now() - startTime;
    const usedRelays = type === 'feed' ? FEED_RELAYS : 
                       type === 'group' ? GROUP_RELAYS : 
                       RELAYS;
    
    // Update metrics for all relays in the used set
    // This is an approximation since NDK doesn't tell us which relay actually responded
    usedRelays.forEach(relay => {
      updateRelayPerformance(relay, true, responseTime / usedRelays.length);
    });
    
    return events;
  } catch (error) {
    console.error(`Error fetching ${type} events:`, error);
    
    // Update performance metrics on failure
    const usedRelays = type === 'feed' ? FEED_RELAYS : 
                       type === 'group' ? GROUP_RELAYS : 
                       RELAYS;
                       
    usedRelays.forEach(relay => {
      updateRelayPerformance(relay, false, 0);
    });
    
    return new Set();
  }
};

/**
 * Fetch running posts from Nostr relays
 * @param {number} limit - Maximum number of posts to fetch
 * @param {number} since - Timestamp to fetch posts since
 * @returns {Promise<Array>} Array of running posts
 */
export const fetchRunningPosts = async (limit = 20, since = undefined) => {
  try {
    // Use 7 days instead of 30 for better performance
    const defaultSince = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const sinceTimestamp = since ? Math.floor(since / 1000) : defaultSince;
    
    console.log(`Fetching posts with #runstr hashtag from ${new Date(sinceTimestamp * 1000).toLocaleString()}`);
    
    // Focus only on #runstr for better performance
    const filter = {
      kinds: [1], // Regular posts
      limit: limit,
      "#t": ["runstr"], // Focus on just runstr hashtag
      since: sinceTimestamp
    };
    
    // Use the feed-specific NDK instance
    const events = await feedNdk.fetchEvents(filter);
    
    // Convert to array and sort by created_at (newest first)
    const eventArray = Array.from(events)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, limit);
    
    console.log(`Found ${eventArray.length} posts with #runstr hashtag`);
    
    if (eventArray.length > 0) {
      return eventArray;
    }
    
    // If no results, try with a broader time window but still focused on #runstr
    console.log("No posts found with #runstr in last 7 days, trying with 30 days window...");
    
    const extendedSince = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const extendedFilter = {
      kinds: [1],
      limit: limit,
      "#t": ["runstr"],
      since: extendedSince
    };
    
    const extendedEvents = await feedNdk.fetchEvents(extendedFilter);
    const extendedArray = Array.from(extendedEvents)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, limit);
    
    console.log(`Found ${extendedArray.length} posts with #runstr in 30 day window`);
    
    if (extendedArray.length > 0) {
      return extendedArray;
    }
    
    // Last resort: check for #running tag
    console.log("No posts found with #runstr, trying with #running hashtag as fallback...");
    
    const fallbackFilter = {
      kinds: [1],
      limit: limit,
      "#t": ["running"],
      since: extendedSince
    };
    
    const fallbackEvents = await feedNdk.fetchEvents(fallbackFilter);
    const fallbackArray = Array.from(fallbackEvents)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, limit);
    
    console.log(`Found ${fallbackArray.length} posts with #running hashtag`);
    return fallbackArray;
  } catch (error) {
    console.error('Error fetching hashtag posts:', error);
    return [];
  }
};

/**
 * Load all supplementary data for posts in parallel with caching
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
  
  try {
    // Generate a cache key based on the post IDs (first 3 characters of each ID to keep it short)
    const postFingerprint = posts
      .slice(0, 10) // Only use up to 10 posts for the fingerprint
      .map(post => post.id.substring(0, 3))
      .sort()
      .join('');
    const cacheKey = `supp_data_${postFingerprint}_${posts.length}`;
    
    // Check memory cache first (for this session)
    if (window.runstrCache && window.runstrCache[cacheKey]) {
      console.log('Using in-memory cache for supplementary data');
      const cachedData = window.runstrCache[cacheKey];
      
      // Only use cache if it's less than 5 minutes old
      if (cachedData.timestamp && (Date.now() - cachedData.timestamp < 5 * 60 * 1000)) {
        return cachedData.data;
      }
    }
    
    // Extract all post IDs and unique author public keys
    const postIds = posts.map(post => post.id);
    const authors = [...new Set(posts.map(post => post.pubkey))];
    
    console.log(`Loading supplementary data for ${postIds.length} posts from ${authors.length} authors`);
    
    // Split profiles query into batches if there are many authors
    let profileEvents = new Set();
    if (authors.length > 0) {
      if (authors.length <= 10) {
        // Small batch, use a single query
        profileEvents = await fetchEvents({
          kinds: [0],
          authors
        }, 'feed');
      } else {
        // Larger batch, split into smaller queries to avoid timeouts
        const batchSize = 10;
        const profileBatches = [];
        
        for (let i = 0; i < authors.length; i += batchSize) {
          const authorBatch = authors.slice(i, i + batchSize);
          profileBatches.push(fetchEvents({
            kinds: [0],
            authors: authorBatch
          }, 'feed'));
        }
        
        // Execute batches in parallel
        const batchResults = await Promise.all(profileBatches);
        
        // Combine results
        profileEvents = new Set([...batchResults.flatMap(set => Array.from(set))]);
      }
    }
    
    // Run interaction queries in parallel
    const [comments, likes, reposts, zapReceipts] = await Promise.all([
      // Comments - split into batches if many posts
      (postIds.length <= 10) 
        ? fetchEvents({ kinds: [1], '#e': postIds }, 'feed')
        : batchFetchEvents(postIds, [1], '#e', 10, 'feed'),
      
      // Likes
      (postIds.length <= 10)
        ? fetchEvents({ kinds: [7], '#e': postIds }, 'feed')
        : batchFetchEvents(postIds, [7], '#e', 10, 'feed'),
      
      // Reposts
      (postIds.length <= 10)
        ? fetchEvents({ kinds: [6], '#e': postIds }, 'feed')
        : batchFetchEvents(postIds, [6], '#e', 10, 'feed'),
      
      // Zap receipts
      (postIds.length <= 10)
        ? fetchEvents({ kinds: [9735], '#e': postIds }, 'feed')
        : batchFetchEvents(postIds, [9735], '#e', 10, 'feed')
    ]);
    
    // Compile the final result
    const result = {
      profileEvents,
      comments,
      likes,
      reposts,
      zapReceipts
    };
    
    // Store in memory cache
    if (typeof window !== 'undefined') {
      if (!window.runstrCache) window.runstrCache = {};
      window.runstrCache[cacheKey] = {
        data: result,
        timestamp: Date.now()
      };
      
      // Delete any cache entries older than 10 minutes
      const cacheCleanupTime = Date.now() - 10 * 60 * 1000; 
      Object.keys(window.runstrCache).forEach(key => {
        if (window.runstrCache[key].timestamp < cacheCleanupTime) {
          delete window.runstrCache[key];
        }
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error loading supplementary data:', error);
    // Return empty sets on error
    return {
      profileEvents: new Set(),
      comments: new Set(),
      likes: new Set(),
      reposts: new Set(),
      zapReceipts: new Set()
    };
  }
};

/**
 * Helper function to fetch events in batches
 * @param {Array} ids - Array of IDs to query 
 * @param {Array} kinds - Event kinds to fetch
 * @param {string} tagName - Tag name to use (e.g. '#e')
 * @param {number} batchSize - Size of each batch
 * @param {string} type - Type of query ('feed', 'group', or 'all')
 * @returns {Promise<Set>} Combined set of all fetched events
 */
const batchFetchEvents = async (ids, kinds, tagName, batchSize = 10, type = 'all') => {
  const batches = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const idBatch = ids.slice(i, i + batchSize);
    const filter = { kinds };
    filter[tagName] = idBatch;
    batches.push(fetchEvents(filter, type));
  }
  
  // Execute batches in parallel
  const batchResults = await Promise.all(batches);
  
  // Combine results
  return new Set([...batchResults.flatMap(set => Array.from(set))]);
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
    
    // Create a profile map with enhanced error handling
    const profileMap = new Map();
    
    // Process profile events with robust error handling
    if (profileEvents && profileEvents.size > 0) {
      Array.from(profileEvents).forEach((profile) => {
        if (!profile || !profile.pubkey) return;
        
        let parsedProfile = {};
        
        // Safely parse profile content
        try {
          // Make sure content is a string before parsing
          if (typeof profile.content === 'string') {
            parsedProfile = JSON.parse(profile.content);
            
            // Validate and ensure all required fields exist
            if (typeof parsedProfile !== 'object') {
              parsedProfile = {};
            }
          }
        } catch (err) {
          console.error(`Error parsing profile for ${profile.pubkey}:`, err);
          // Continue with empty profile object if parsing fails
        }
        
        // Ensure profile has all expected fields with proper fallbacks
        const normalizedProfile = {
          name: parsedProfile.name || parsedProfile.display_name || 'Anonymous Runner',
          display_name: parsedProfile.display_name || parsedProfile.name || 'Anonymous Runner',
          picture: typeof parsedProfile.picture === 'string' ? parsedProfile.picture : undefined,
          about: typeof parsedProfile.about === 'string' ? parsedProfile.about : '',
          lud06: typeof parsedProfile.lud06 === 'string' ? parsedProfile.lud06 : undefined,
          lud16: typeof parsedProfile.lud16 === 'string' ? parsedProfile.lud16 : undefined,
          nip05: typeof parsedProfile.nip05 === 'string' ? parsedProfile.nip05 : undefined,
          website: typeof parsedProfile.website === 'string' ? parsedProfile.website : undefined,
          banner: typeof parsedProfile.banner === 'string' ? parsedProfile.banner : undefined,
        };
        
        // Add to profile map
        profileMap.set(profile.pubkey, normalizedProfile);
      });
    }
    
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
            const parsedAmount = parseInt(amountTag[1], 10);
            if (!isNaN(parsedAmount)) {
              zapAmount = parsedAmount / 1000;
            }
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
      if (!comment || !comment.tags) return;
      
      const parentId = comment.tags.find((tag) => tag[0] === 'e')?.[1];
      if (parentId) {
        if (!commentsByPost.has(parentId)) {
          commentsByPost.set(parentId, []);
        }
        
        // Get profile with fallback
        const authorPubkey = comment.pubkey || '';
        const profile = profileMap.get(authorPubkey) || {
          name: 'Anonymous',
          picture: undefined
        };
        
        commentsByPost.get(parentId).push({
          id: comment.id || `comment-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          content: comment.content || '',
          created_at: comment.created_at || Math.floor(Date.now() / 1000),
          author: {
            pubkey: authorPubkey,
            profile: profile
          }
        });
      }
    });
    
    // Helper function to extract image URLs from content
    const extractImagesFromContent = (content) => {
      if (!content) return [];
      const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif))/gi;
      return content.match(urlRegex) || [];
    };
    
    // Process posts with all the data
    const processedPosts = posts.map(post => {
      if (!post || !post.pubkey) {
        console.warn('Received invalid post data', post);
        return null;
      }
      
      // Get author's profile with robust fallback
      const authorPubkey = post.pubkey || '';
      const profile = profileMap.get(authorPubkey) || {
        name: 'Anonymous Runner',
        picture: undefined,
        lud16: undefined,
        lud06: undefined
      };
      
      // Extract images once during processing
      const images = extractImagesFromContent(post.content || '');
      
      // Get post interactions with safe defaults
      const postZaps = zapsByPost.get(post.id) || { count: 0, amount: 0 };
      const postLikes = likesByPost.get(post.id) || 0;
      const postReposts = repostsByPost.get(post.id) || 0;
      const postComments = commentsByPost.get(post.id) || [];
      
      return {
        id: post.id || `post-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        content: post.content || '',
        created_at: post.created_at || Math.floor(Date.now() / 1000),
        author: {
          pubkey: authorPubkey,
          profile: profile,
          lud16: profile.lud16,
          lud06: profile.lud06
        },
        comments: postComments,
        showComments: false,
        likes: postLikes,
        reposts: postReposts,
        zaps: postZaps.count,
        zapAmount: postZaps.amount,
        images: images  // Add extracted images to the post object
      };
    });
    
    // Filter out any null posts from invalid data
    const validPosts = processedPosts.filter(post => post !== null);
    
    // Sort by created_at, newest first
    return validPosts.sort((a, b) => b.created_at - a.created_at);
  } catch (error) {
    console.error('Error processing posts:', error);
    return posts;
  }
};

/**
 * Helper function to publish an NDK event with retries
 * @param {NDKEvent} ndkEvent - The NDK event to publish
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<{success: boolean, error: string|null}>} Result of publish attempt
 */
const publishWithRetry = async (ndkEvent, maxRetries = 3, delay = 2000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Publishing to NDK relays - attempt ${attempt}/${maxRetries}...`);
      
      // Ensure we're connected before publishing
      await ensureConnection();
      
      // Publish the event
      await ndkEvent.publish();
      console.log('Successfully published with NDK');
      return { success: true, error: null };
    } catch (error) {
      console.error(`NDK publish attempt ${attempt} failed:`, error);
      if (attempt < maxRetries) {
        console.log(`Waiting ${delay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return { success: false, error: 'Failed to publish with NDK after all retry attempts' };
};

/**
 * Create and publish an event to the nostr network
 * Uses NDK with fallback to nostr-tools for reliable posting
 * @param {Object} eventTemplate - Event template 
 * @param {string|null} pubkeyOverride - Override for pubkey (optional)
 * @returns {Promise<Object>} Published event
 */
export const createAndPublishEvent = async (eventTemplate, pubkeyOverride = null) => {
  try {
    // Get publishing strategy metadata to return to caller
    const publishResult = {
      success: false,
      method: null,
      signMethod: null,
      error: null
    };

    let pubkey = pubkeyOverride;
    let signedEvent;
    
    // Use platform-specific signing
    if (Platform.OS === 'android') {
      // Check if Amber is available
      const isAmberAvailable = await AmberAuth.isAmberInstalled();
      
      if (isAmberAvailable) {
        // For Android with Amber, we use Amber for signing
        if (!pubkey) {
          // If no pubkey provided, we need to get it first
          pubkey = localStorage.getItem('userPublicKey');
          
          if (!pubkey) {
            throw new Error('No public key available. Please log in first.');
          }
        }
        
        // Create the event with user's pubkey
        const event = {
          ...eventTemplate,
          pubkey,
          created_at: Math.floor(Date.now() / 1000)
        };
        
        // Sign using Amber
        signedEvent = await AmberAuth.signEvent(event);
        publishResult.signMethod = 'amber';
        
        // If signedEvent is null, the signing is happening asynchronously
        // and we'll need to handle it via deep linking
        if (!signedEvent) {
          // In a real implementation, you would return a Promise that
          // resolves when the deep link callback is received
          return null;
        }
      }
    }
    
    // For web or if Amber is not available/failed, use window.nostr
    if (!signedEvent) {
      if (!window.nostr) {
        throw new Error('No signing method available');
      }
      
      // Get the public key from nostr extension if not provided
      if (!pubkey) {
        pubkey = await window.nostr.getPublicKey();
      }
      
      // Create the event with user's pubkey
      const event = {
        ...eventTemplate,
        pubkey,
        created_at: Math.floor(Date.now() / 1000)
      };
      
      // Sign the event using the browser extension
      signedEvent = await window.nostr.signEvent(event);
      publishResult.signMethod = 'extension';
    }
    
    // APPROACH 1: Try NDK first
    try {
      // Make sure we're connected before attempting to publish
      await ensureConnection();
      
      // Create NDK Event and publish with retry
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      const ndkResult = await publishWithRetry(ndkEvent);
      
      if (ndkResult.success) {
        publishResult.success = true;
        publishResult.method = 'ndk';
        return { ...signedEvent, ...publishResult };
      }
    } catch (ndkError) {
      console.error('Error in NDK publishing:', ndkError);
      // Continue to fallback
    }
    
    // APPROACH 2: Fallback to nostr-tools if NDK failed
    console.log('NDK publishing failed, falling back to nostr-tools...');
    try {
      // Use nostr-tools as fallback
      await publishWithNostrTools(signedEvent);
      publishResult.success = true;
      publishResult.method = 'nostr-tools';
      console.log('Successfully published with nostr-tools fallback');
    } catch (fallbackError) {
      console.error('Fallback to nostr-tools also failed:', fallbackError);
      publishResult.error = fallbackError.message;
      throw new Error(`Failed to publish with both NDK and nostr-tools: ${fallbackError.message}`);
    }
    
    return { ...signedEvent, ...publishResult };
  } catch (error) {
    console.error('Error in createAndPublishEvent:', error);
    throw error;
  }
};

/**
 * Search notes by content for running-related terms
 * This is a fallback when hashtag search fails
 */
export const searchRunningContent = async (limit = 50, hours = 168) => {
  // Get recent notes within the time window
  const since = Math.floor(Date.now() / 1000) - (hours * 60 * 60);
  
  const filter = {
    kinds: [1],
    limit: limit,
    since
  };
  
  const events = await fetchEvents(filter);
  
  // Filter for running-related content - using SAME keywords as working implementation
  const runningKeywords = [
    'running', 'run', 'runner', 'runstr', '5k', '10k', 'marathon', 'jog', 'jogging'
  ];
  
  return Array.from(events).filter(event => {
    const lowerContent = event.content.toLowerCase();
    return runningKeywords.some(keyword => lowerContent.includes(keyword));
  });
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
  try {
    console.log('Starting connection diagnostics...');
    
    // Check if NDK is initialized
    if (!ndk || !ndk.pool || !ndk.pool.relays) {
      console.log('NDK not initialized, initializing...');
      await initializeNostr();
    }
    
    // Check connected relays
    const connectedRelays = Array.from(ndk.pool.relays || [])
      .filter(r => r.status === 1)
      .map(r => r.url);
    
    console.log(`Connected to ${connectedRelays.length} relays: ${connectedRelays.join(', ')}`);
    
    if (connectedRelays.length === 0) {
      return { 
        error: 'Not connected to any relays. Check your internet connection.',
        connectedRelays: []
      };
    }
    
    // Test if we can fetch any events at all (simple test)
    const simpleFilter = {
      kinds: [1],
      limit: 5
    };
    
    console.log('Testing relay connectivity with simple filter...');
    const generalEvents = await ndk.fetchEvents(simpleFilter);
    const generalArray = Array.from(generalEvents);
    console.log(`Retrieved ${generalArray.length} general events`);
    
    // Test if we can fetch running-related events
    const runningFilter = {
      kinds: [1],
      "#t": ["running", "run", "runner", "runstr"],
      limit: 5
    };
    
    console.log('Testing relay connectivity with running filter...');
    const runningEvents = await ndk.fetchEvents(runningFilter);
    const runningArray = Array.from(runningEvents);
    console.log(`Retrieved ${runningArray.length} running events`);
    
    return {
      connectedRelays,
      generalEvents: generalArray.length,
      runningEvents: runningArray.length
    };
  } catch (error) {
    console.error('Diagnostic error:', error);
    return { 
      error: error.message,
      connectedRelays: Array.from(ndk.pool?.relays || [])
        .filter(r => r.status === 1)
        .map(r => r.url)
    };
  }
};

// Set up periodic connection check
setInterval(async () => {
  try {
    await ensureConnection();
  } catch (error) {
    console.error('Error in periodic connection check:', error);
  }
}, CONNECTION_CHECK_INTERVAL);

// Initialize connection on module load
if (typeof window !== 'undefined') {
  // Only run in browser environment
  initializeNostr().catch(err => console.error('Initial connection failed:', err));
}

/**
 * Create a NIP-101e kind 1301 workout event from run data
 * @param {Object} run - Run data containing distance, duration, elevation
 * @param {string} distanceUnit - The unit of distance measurement ('km' or 'mi')
 * @returns {Object} Event template for a kind 1301 event
 */
export const createWorkoutEvent = (run, distanceUnit) => {
  if (!run) {
    throw new Error('No run data provided');
  }

  // Format the distance
  const distanceValue = distanceUnit === 'km' 
    ? (run.distance / 1000).toFixed(2) 
    : (run.distance / 1609.344).toFixed(2);
  
  // Format the duration (in HH:MM:SS format)
  const hours = Math.floor(run.duration / 3600);
  const minutes = Math.floor((run.duration % 3600) / 60);
  const seconds = Math.floor(run.duration % 60);
  const durationFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Format the elevation gain if available
  let elevationTags = [];
  if (run.elevation && run.elevation.gain) {
    const elevationUnit = distanceUnit === 'km' ? 'm' : 'ft';
    const elevationValue = distanceUnit === 'km' 
      ? run.elevation.gain 
      : Math.round(run.elevation.gain * 3.28084); // Convert meters to feet for imperial units
    
    elevationTags = [['elevation_gain', elevationValue.toString(), elevationUnit]];
  }

  // Create the run name based on date/time
  const runDate = new Date(run.date);
  const runName = `${runDate.toLocaleDateString()} Run`;

  // Create event template with kind 1301 for workout record
  return {
    kind: 1301,
    content: "Completed a run with RUNSTR!",
    tags: [
      ['workout', runName],
      ['exercise', 'running'],
      ['distance', distanceValue, distanceUnit],
      ['duration', durationFormatted],
      ...elevationTags
    ]
  };
};

/**
 * Update relay performance metrics
 * @param {string} relay - Relay URL
 * @param {boolean} success - Whether the operation succeeded
 * @param {number} responseTime - Response time in ms
 */
const updateRelayPerformance = (relay, success, responseTime) => {
  if (!relayPerformance[relay]) {
    relayPerformance[relay] = {
      successCount: 0,
      failCount: 0,
      totalTime: 0,
      avgTime: 0,
      lastUpdated: Date.now()
    };
  }
  
  const stats = relayPerformance[relay];
  stats.lastUpdated = Date.now();
  
  if (success) {
    stats.successCount++;
    stats.totalTime += responseTime;
    stats.avgTime = stats.totalTime / stats.successCount;
  } else {
    stats.failCount++;
  }
  
  // Calculate success rate
  const total = stats.successCount + stats.failCount;
  stats.successRate = total > 0 ? stats.successCount / total : 0;
  
  // Log only on significant changes or first few updates
  if (total < 5 || total % 10 === 0) {
    console.log(`Relay ${relay} performance: ${Math.round(stats.successRate * 100)}% success, ${Math.round(stats.avgTime)}ms avg time`);
  }
};

/**
 * Get optimal relays for a specific operation
 * @param {string} operation - Operation type ('feed', 'group', or 'all')
 * @param {number} count - Number of relays to return
 * @returns {Array} Array of relay URLs
 */
const getOptimalRelays = (operation, count = 3) => {
  // Define base relay pool based on operation
  let baseRelays = [];
  switch (operation) {
    case 'feed':
      baseRelays = FEED_RELAYS;
      break;
    case 'group':
      baseRelays = GROUP_RELAYS;
      break;
    default:
      baseRelays = RELAYS;
  }
  
  // If we don't have performance data yet, return the top N relays from base list
  if (Object.keys(relayPerformance).length === 0) {
    return baseRelays.slice(0, count);
  }
  
  // Filter for relays that match the operation type
  const candidateRelays = baseRelays.filter(relay => 
    relayPerformance[relay] && relayPerformance[relay].lastUpdated > Date.now() - 30 * 60 * 1000
  );
  
  // If no candidates with performance data, use the base relays
  if (candidateRelays.length === 0) {
    return baseRelays.slice(0, count);
  }
  
  // Sort relays by performance (success rate and avg time)
  const sortedRelays = candidateRelays.sort((a, b) => {
    const statsA = relayPerformance[a];
    const statsB = relayPerformance[b];
    
    // If success rates are significantly different, prioritize that
    if (Math.abs(statsA.successRate - statsB.successRate) > 0.2) {
      return statsB.successRate - statsA.successRate;
    }
    
    // Otherwise prioritize by response time
    return statsA.avgTime - statsB.avgTime;
  });
  
  // Always include at least one relay from the base list if available
  const result = sortedRelays.slice(0, count);
  if (result.length < count && baseRelays.length > 0) {
    for (const relay of baseRelays) {
      if (!result.includes(relay)) {
        result.push(relay);
        if (result.length >= count) break;
      }
    }
  }
  
  return result;
};

/**
 * Perform a health check on relays
 */
const performRelayHealthCheck = async () => {
  console.log('Performing relay health check...');
  
  // Check each relay with a simple filter
  const testFilter = {
    kinds: [1],
    limit: 1
  };
  
  // Test all relays
  for (const relay of RELAYS) {
    try {
      const startTime = Date.now();
      // Test with a simple query to each relay
      await pool.list([relay], [testFilter], { timeout: 5000 });
      const responseTime = Date.now() - startTime;
      updateRelayPerformance(relay, true, responseTime);
    } catch (error) {
      updateRelayPerformance(relay, false, 0);
      console.warn(`Relay ${relay} failed health check:`, error.message);
    }
  }
  
  console.log('Relay health check complete');
};

// Start regular health checks
if (typeof window !== 'undefined') {
  // Initial health check after a delay
  setTimeout(() => {
    performRelayHealthCheck();
  }, 5000);
  
  // Regular health checks
  setInterval(() => {
    performRelayHealthCheck();
  }, HEALTH_CHECK_INTERVAL);
}

export { ndk };
