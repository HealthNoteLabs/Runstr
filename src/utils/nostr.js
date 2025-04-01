import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';
// Import nostr-tools implementation for fallback
import { createAndPublishEvent as publishWithNostrTools } from './nostrClient';
import { formatTime, displayDistance } from './formatters';
import { encodePolyline } from './runCalculations';

// Optimized relay list based on testing results
export const RELAYS = [
  'wss://relay.damus.io',    // Most reliable for running content
  'wss://nos.lol',           // Good secondary option  // Has unique running content
  'wss://nostr.wine',        // Additional reliable relay
  'wss://eden.nostr.land',   // Additional reliable relay
  'wss://e.nos.lol',         // Additional reliable relay
  'wss://relay.snort.social', // Backup relay
  'wss://feeds.nostr.band/running',
  'wss://feeds.nostr.band/popular',
  'wss://feeds.nostr.band/memes',
  'wss://purplerelay.com',
  'wss://nostr.bitcoiner.social',
];

// Create a new NDK instance with optimized relay configuration
const ndk = new NDK({
  explicitRelayUrls: RELAYS
});

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
    // Connect to relays
    await ndk.connect();
    console.log('Connected to NDK relays');
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
    
    // Fetch events using NDK
    const events = await ndk.fetchEvents(filter);
    console.log(`Fetched ${events.size} events for filter:`, filter);
    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    return new Set();
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
    // If no custom "since" provided, use 30 days (not 90 days)
    const defaultSince = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const sinceTimestamp = since ? Math.floor(since / 1000) : defaultSince;
    
    console.log(`Fetching running posts from ${new Date(sinceTimestamp * 1000).toLocaleString()}`);
    
    // Standardized hashtag list across the app - ensure "runstr" has high priority
    const runningTags = ["runstr", "running", "run", "runner", "5k", "10k", "marathon", "jog"];
    
    // Try fetching posts with multiple approaches in parallel for better performance
    const promises = [
      // Approach 1: Direct hashtag filtering - fastest but might miss some
      ndk.fetchEvents({
        kinds: [1], // Regular posts
        limit: limit,
        "#t": runningTags,
        since: sinceTimestamp
      }),
      
      // Approach 2: Fetch posts with more specific "runstr" tag - highest relevance
      ndk.fetchEvents({
        kinds: [1],
        limit: limit,
        "#t": ["runstr"],
        since: sinceTimestamp
      }),
      
      // Approach 3: Use content filtering with a higher limit - slower but more comprehensive
      ndk.fetchEvents({
        kinds: [1],
        limit: limit * 3, // Get more to filter client-side
        since: sinceTimestamp
      }).then(events => {
        const allEvents = Array.from(events);
        // Filter for running content client-side
        return allEvents.filter(event => {
          const content = event.content.toLowerCase();
          return runningTags.some(keyword => 
            content.includes(keyword) || 
            content.includes(`#${keyword}`) || 
            event.tags.some(tag => tag[0] === 't' && runningTags.includes(tag[1].toLowerCase()))
          );
        }).slice(0, limit);
      })
    ];
    
    // Wait for all approaches to complete and combine results
    const results = await Promise.all(promises);
    
    // Combine all events, removing duplicates
    const uniqueEvents = new Map();
    let totalFound = 0;
    
    results.forEach(eventSet => {
      if (!eventSet) return;
      
      const events = Array.isArray(eventSet) ? eventSet : Array.from(eventSet);
      totalFound += events.length;
      
      events.forEach(event => {
        if (event && event.id && !uniqueEvents.has(event.id)) {
          uniqueEvents.set(event.id, event);
        }
      });
    });
    
    console.log(`Found ${totalFound} total posts across all methods, ${uniqueEvents.size} unique`);
    
    // Convert to array and sort by created_at (newest first)
    const eventArray = Array.from(uniqueEvents.values())
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, limit);
    
    // If we got results, return them
    if (eventArray.length > 0) {
      return eventArray;
    }
    
    // No results found, try one last fallback with very basic filter
    console.log("No results from optimized approaches, using emergency fallback...");
    const simpleFilter = {
      kinds: [1],
      limit: limit || 10
    };
    
    const events = await ndk.fetchEvents(simpleFilter);
    const fallbackArray = Array.from(events);
    console.log(`Emergency fallback retrieved ${fallbackArray.length} general posts`);
    
    return fallbackArray;
  } catch (error) {
    console.error('Error fetching running posts:', error);
    
    // Try a more general filter as fallback if all else fails
    console.log('Attempting fallback with simplified filter...');
    try {
      const simpleFilter = {
        kinds: [1],
        limit: limit || 10
      };
      
      const events = await ndk.fetchEvents(simpleFilter);
      const eventArray = Array.from(events);
      console.log(`Emergency fallback retrieved ${eventArray.length} general posts`);
      
      return eventArray;
    } catch (err) {
      console.error('Fallback also failed:', err);
      return [];
    }
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

export { ndk };

/**
 * Format split data for NIP-101e
 * @param {Object} split - Split data object
 * @param {number} index - Split index
 * @param {string} preferredUnit - User's preferred distance unit
 * @returns {Array} Formatted split tag
 */
const formatSplitTag = (split, index, preferredUnit) => {
  const distance = preferredUnit === 'miles' ? 1609.34 : 1000; // 1 mile or 1 km in meters
  const unitLabel = preferredUnit === 'miles' ? 'mi' : 'm';
  
  // Format: ["split", index, distance, unit, time, optional heart rate, "bpm"]
  const splitTag = ["split", index.toString(), distance.toString(), unitLabel, formatTime(split.splitTime)];
  
  // Add heart rate data if available
  if (split.heartRate) {
    splitTag.push(Math.round(split.heartRate).toString());
    splitTag.push("bpm");
  }
  
  return splitTag;
};

/**
 * Format pace for Nostr (MM:SS format)
 * @param {number} pace - Pace in seconds per unit
 * @returns {string} Formatted pace string
 */
const formatPaceForNostr = (pace) => {
  const minutes = Math.floor(pace / 60);
  const seconds = Math.floor(pace % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Format raw distance value based on preferred unit
 * @param {number} distance - Distance in miles
 * @param {string} unit - Preferred unit
 * @returns {number} Distance in preferred unit
 */
const formatDistanceRaw = (distance, unit) => {
  if (unit === 'miles') {
    return distance;
  } else {
    return distance * 1.60934; // Convert miles to km
  }
};

/**
 * Create a NIP-101e compliant workout record event
 * @param {Object} runData - Run data object
 * @param {string} userNotes - Optional user notes
 * @returns {Object} Nostr event object
 */
export const createWorkoutRecordEvent = (runData, userNotes = "") => {
  // Generate a unique identifier for this workout
  const workoutId = crypto.randomUUID();
  
  // Calculate start and end timestamps
  const endTime = Math.floor(runData.endTime.getTime() / 1000);
  const startTime = Math.floor(runData.startTime.getTime() / 1000);
  
  // Format duration in seconds
  const durationSeconds = Math.floor(runData.duration / 1000);
  
  // Format pace as MM:SS string
  const paceString = formatPaceForNostr(runData.pace);
  
  // Encode GPS data as polyline if available
  const polylineData = runData.route ? encodePolyline(runData.route) : "";
  
  // Format elevation gain in meters
  const elevationGain = runData.elevation ? Math.round(runData.elevation.gain) : 0;
  
  // Get user's public key
  const pubkey = localStorage.getItem('userPublicKey');
  if (!pubkey) {
    throw new Error('No public key available. Please log in first.');
  }
  
  // Build the base event
  const event = {
    kind: 1301,
    content: userNotes || `Completed a ${displayDistance(runData.distance, runData.preferredUnit)} run.`,
    created_at: endTime,
    tags: [
      ["d", workoutId],
      ["title", `${displayDistance(runData.distance, runData.preferredUnit)} Run`],
      ["type", "cardio"],
      ["start", startTime.toString()],
      ["end", endTime.toString()],
      // Main exercise data with distance, duration, pace, route, elevation
      ["exercise", `33401:${pubkey}:running`, "", 
        formatDistanceRaw(runData.distance, runData.preferredUnit).toString(), 
        durationSeconds.toString(), 
        paceString,
        polylineData,
        elevationGain.toString()
      ],
      ["completed", "true"],
      ["t", "running"]
    ]
  };
  
  return event;
};