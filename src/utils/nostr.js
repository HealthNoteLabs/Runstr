import { SimplePool, getEventHash } from 'nostr-tools';
import { createAndPublishEvent as publishWithNostrTools } from './nostrClient';

// Initialize relay pool
const pool = new SimplePool();

// List of relays to connect to
export const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.current.fyi',
  'wss://nos.lol',
  'wss://relay.snort.social'
];

// Storage for subscriptions
const activeSubscriptions = new Set();

// Track connection status
let isConnected = false;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize the Nostr client - connect to relays
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Ensure we're connected to the relays
    for (const relay of RELAYS) {
      try {
        await pool.ensureRelay(relay);
      } catch (error) {
        console.warn(`Failed to connect to relay: ${relay}`, error);
      }
    }
    
    console.log('Connected to Nostr relays');
    isConnected = true;
    lastConnectionCheck = Date.now();
    return true;
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
        await initializeNostr();
      } else {
        console.log(`Connected to ${connectionStatus.connectedRelays.length} relays`);
        isConnected = true;
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      // Attempt to reconnect
      try {
        await initializeNostr();
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
 * Fetch events from Nostr network
 * @param {Object} filter - Nostr filter
 * @param {number} limit - Maximum number of events to fetch
 * @returns {Promise<Array>} - Array of events
 */
export const fetchEvents = async (filter, limit = 50) => {
  try {
    const events = await pool.list(RELAYS, [{ ...filter, limit }]);
    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

/**
 * Fetch running posts from Nostr relays
 * @param {number} limit - Maximum number of posts to fetch
 * @param {number} since - Timestamp to fetch posts since
 * @returns {Promise<Array>} Array of running posts
 */
export const fetchRunningPosts = async (limit = 7, since = undefined) => {
  try {
    // If no custom "since" provided, use 30 days
    const defaultSince = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const sinceTimestamp = since ? Math.floor(since / 1000) : defaultSince;
    
    console.log("Fetching running posts with hashtags...");
    const hashtagFilter = {
      kinds: [1],
      limit: limit || 10,
      "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon", "jog"],
      since: sinceTimestamp
    };
    
    const events = await pool.list(RELAYS, [hashtagFilter]);
    
    // If hashtag search found results, return them
    if (events && events.length > 0) {
      console.log(`Found ${events.length} posts with hashtags`);
      return events;
    }
    
    // Fallback to content-based filtering
    console.log("No hashtag results, trying content-based filtering...");
    const contentFilter = {
      kinds: [1],
      limit: (limit || 10) * 3, // Get more to filter client-side
      since: sinceTimestamp
    };
    
    const allEvents = await pool.list(RELAYS, [contentFilter]);
    
    // Filter for running content client-side
    const runningKeywords = ["running", "run", "runner", "5k", "10k", "marathon", "jog"];
    const runningEvents = allEvents.filter(event => {
      const content = event.content.toLowerCase();
      return runningKeywords.some(keyword => content.includes(keyword));
    }).slice(0, limit);
    
    console.log(`Found ${runningEvents.length} posts via content filtering`);
    return runningEvents;
  } catch (error) {
    console.error("Error fetching running posts:", error);
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
 * Create and publish an event to Nostr network
 * @param {Object} eventTemplate - Event template with kind, content, tags
 * @returns {Promise<Object>} - The published event
 */
export const createAndPublishEvent = async (eventTemplate) => {
  try {
    // Check if running in Android environment with window.Android
    if (window.Android && window.Android.getNostrPrivateKey) {
      // Get private key from Android and use the nostrClient implementation
      console.log('Using Android environment for event publishing');
      return await publishWithNostrTools(eventTemplate);
    } else {
      // Use NIP-07 browser extension if available
      if (window.nostr) {
        // Get public key from extension
        const pubkey = await window.nostr.getPublicKey();
        
        // Create a complete event
        const event = {
          ...eventTemplate,
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          id: ''
        };
        
        // Calculate event hash
        event.id = getEventHash(event);
        
        // Sign with extension
        const signedEvent = await window.nostr.signEvent(event);
        
        // Publish the event
        await pool.publish(RELAYS, signedEvent);
        return signedEvent;
      } else {
        throw new Error('No Nostr signing method available');
      }
    }
  } catch (error) {
    console.error('Error publishing to Nostr:', error);
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
  pool.close(RELAYS);
};

/**
 * Diagnostic function that tests connection to relays
 */
export const diagnoseConnection = async () => {
  try {
    console.log('Starting connection diagnostics...');
    
    // Get connected relays from the pool
    const connectedRelays = Object.keys(pool.getRelayStatuses())
      .filter(url => pool.getRelayStatuses()[url] === 1);
    
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
    const generalEvents = await pool.list(RELAYS, [simpleFilter]);
    console.log(`Retrieved ${generalEvents.length} general events`);
    
    // Test if we can fetch running-related events
    const runningFilter = {
      kinds: [1],
      "#t": ["running", "run", "runner", "runstr"],
      limit: 5
    };
    
    console.log('Testing relay connectivity with running filter...');
    const runningEvents = await pool.list(RELAYS, [runningFilter]);
    console.log(`Retrieved ${runningEvents.length} running events`);
    
    return {
      connectedRelays,
      generalEvents: generalEvents.length,
      runningEvents: runningEvents.length
    };
  } catch (error) {
    console.error('Diagnostic error:', error);
    return { 
      error: error.message,
      connectedRelays: []
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

  // Format splits if available
  let splitTags = [];
  if (run.splits && run.splits.length > 0) {
    // Add a summary tag for the number of splits
    splitTags.push(['splits_count', run.splits.length.toString()]);
    
    // Add individual split tags
    run.splits.forEach((split, index) => {
      // Calculate individual split time rather than using cumulative time
      const prevSplitTime = index > 0 ? run.splits[index - 1].time : 0;
      const splitTime = split.time - prevSplitTime;
      
      // Format the split time in minutes:seconds
      const splitMinutes = Math.floor(splitTime / 60);
      const splitSeconds = Math.floor(splitTime % 60);
      const formattedTime = `${splitMinutes.toString().padStart(2, '0')}:${splitSeconds.toString().padStart(2, '0')}`;
      
      // Add the split tag: ['split', '1', '05:32', '1 km']
      splitTags.push([
        'split', 
        (index + 1).toString(), 
        formattedTime, 
        `1 ${distanceUnit}`
      ]);
    });
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
      ...elevationTags,
      ...splitTags
    ]
  };
};

/**
 * Test connection to Nostr relays and report results
 * @returns {Promise<Object>} Connection test results
 */
export const testRelayConnections = async () => {
  try {
    // Initialize Nostr if not already done
    await initializeNostr();
    
    const results = {
      connectedCount: 0,
      totalCount: RELAYS.length,
      relayStatus: {}
    };
    
    // Try to fetch a small number of any events to check connectivity
    const testEvents = await pool.list(RELAYS, [{
      kinds: [1],
      limit: 3
    }]);
    
    // Get the connection statuses
    const relayStatuses = pool.getRelayStatuses();
    
    // Map relays to their status
    RELAYS.forEach(relayUrl => {
      const status = relayStatuses[relayUrl];
      
      if (status === 1) {
        results.connectedCount++;
        results.relayStatus[relayUrl] = 'Connected';
      } else if (status === 0) {
        results.relayStatus[relayUrl] = 'Connecting';
      } else {
        results.relayStatus[relayUrl] = 'Not connected';
      }
    });
    
    // If we got events, but don't have any connected relays, something is still working
    if (testEvents.length > 0 && results.connectedCount === 0) {
      results.connectedCount = 1;
      results.relayStatus['unknown'] = 'Connected (via fallback)';
    }
    
    return results;
  } catch (error) {
    console.error('Error testing relay connections:', error);
    
    return {
      connectedCount: 0,
      totalCount: RELAYS.length,
      relayStatus: {
        error: error.message
      }
    };
  }
};

/**
 * Get the number of connected relays
 * @returns {number} Number of connected relays
 */
export const getConnectedRelaysCount = () => {
  return pool.getConnectedRelayCount();
};
