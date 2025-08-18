import { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { Platform } from '../utils/react-native-shim.js';
import AmberAuth from '../services/AmberAuth.js';
// Import nostr-tools implementation for fallback
import { createAndPublishEvent as publishWithNostrTools } from './nostrClient.js';
import { getFastestRelays, directFetchRunningPosts } from './feedFetcher.js';
import { encryptContentNip44 } from './nip44.js';
import { getEventTargetId, chunkArray } from './eventHelpers.js';
import { v4 as uuidv4 } from 'uuid'; // Import uuid

// Import the NDK singleton
import { ndk, ndkReadyPromise } from '../lib/ndkSingleton.js'; // Adjusted path

// Storage for subscriptions
const activeSubscriptions = new Set();

/**
 * Fetch events from Nostr
 * @param {Object} filter - Nostr filter
 * @param {Object} fetchOpts - Additional fetch options
 * @returns {Promise<Set<NDKEvent>>} Set of events
 */
// Default timeout (ms) for one-shot fetches where UI is waiting
const DEFAULT_FETCH_TIMEOUT = 8000; // 8 s – enough for fast relays, short enough for UX

export const fetchEvents = async (filter, fetchOpts = {}) => {
  // Split out timeout so we can still forward other NDK opts untouched
  const { timeout = DEFAULT_FETCH_TIMEOUT, ...ndkOpts } = fetchOpts;

  try {
    const ndkReady = await ndkReadyPromise;
    if (!ndkReady) {
      console.warn('[nostr.js] NDK not ready – no relays connected. Aborting fetch.');
      return new Set();
    }

    console.log('[nostr.js] Fetching events with filter:', filter, 'using singleton NDK');
    if (!filter.limit) {
      filter.limit = 30;
    }

    // Race the real fetch against a timeout so a single silent relay can’t block
    const ndkFetchPromise = ndk.fetchEvents(filter, ndkOpts);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => {
      console.warn(`[nostr.js] fetchEvents timeout (${timeout} ms) for filter`, filter);
      resolve(new Set());
    }, timeout));

    const events = await Promise.race([ndkFetchPromise, timeoutPromise]);

    console.log(`[nostr.js] fetchEvents resolved with ${events.size} events for filter:`, filter);
    return events;
  } catch (error) {
    console.error('[nostr.js] Error fetching events:', error);
    return new Set();
  }
};

/**
 * Convenience helper to fetch a single kind-0 profile for a pubkey. Returns parsed profile object or null.
 * Only used by rewardService for quick lud16/lud06 lookup.
 * @param {string} pubkey Hex pubkey to fetch profile for
 */
export const getProfile = async (pubkey) => {
  if (!pubkey) return null;
  try {
    const events = await fetchEvents({ kinds: [0], authors: [pubkey], limit: 1 }, { timeout: 7000 });
    if (events && events.size > 0) {
      const ev = Array.from(events)[0];
      let parsed = {};
      if (typeof ev.content === 'string' && ev.content.trim().startsWith('{')) {
        try { parsed = JSON.parse(ev.content); } catch (_) { parsed = {}; }
      }
      // fallback to tags
      const tagLookup = (key) => ev.tags?.find(t => t[0] === key)?.[1];
      return {
        name: parsed.name || parsed.display_name,
        lud16: parsed.lud16 || tagLookup('lud16'),
        lud06: parsed.lud06 || tagLookup('lud06'),
        picture: parsed.picture,
        about: parsed.about
      };
    }
  } catch (err) {
    console.error('[nostr.js] getProfile error', err);
  }
  return null;
};

/**
 * Fetch recent running posts from Nostr using Kind 1301 (Workout Records)
 * @param {number} limit - Maximum number of posts to fetch
 * @param {number} since - Timestamp to fetch posts since
 * @param {Array} fallbackWindows - Time windows for cascading fetch
 * @param {string} filterSource - Optional filter for specific app source ('RUNSTR' for RUNSTR-only posts)
 * @returns {Promise<Array<NDKEvent>>} Array of running posts
 */
export const fetchRunningPosts = async (limit = 7, since = undefined, fallbackWindows = [2 * 3600, 24 * 3600, 14 * 24 * 3600], filterSource = null) => {
  // Helper function to check if event matches RUNSTR's exact publishing signature
  const isDefinitelyRunstrWorkout = (event) => {
    if (!filterSource || filterSource.toUpperCase() !== 'RUNSTR') {
      return true; // No filtering applied
    }
    
    // RUNSTR signature requirements based on createWorkoutEvent
    const hasRequiredTags = {
      source: false,
      client: false,
      workoutId: false,
      title: false,
      exercise: false,
      distance: false,
      duration: false
    };
    
    // Check each tag for RUNSTR's signature
    for (const tag of event.tags || []) {
      switch (tag[0]) {
        case 'source':
          if (tag[1]?.toUpperCase() === 'RUNSTR') {
            hasRequiredTags.source = true;
          }
          break;
        case 'client':
          if (tag[1]?.toLowerCase() === 'runstr') {
            hasRequiredTags.client = true;
          }
          break;
        case 'd':
          // RUNSTR uses workout UUIDs in d tag
          if (tag[1] && typeof tag[1] === 'string' && tag[1].length > 0) {
            hasRequiredTags.workoutId = true;
          }
          break;
        case 'title':
          // RUNSTR always includes title tag
          if (tag[1] && typeof tag[1] === 'string' && tag[1].length > 0) {
            hasRequiredTags.title = true;
          }
          break;
        case 'exercise':
          // RUNSTR uses 'exercise' tag with values: 'run', 'walk', 'cycle'
          if (tag[1]) {
            const activity = tag[1].toLowerCase();
            if (['run', 'walk', 'cycle', 'running', 'cycling', 'walking', 'jogging'].includes(activity)) {
              hasRequiredTags.exercise = true;
            }
          }
          break;
        case 'distance':
          // RUNSTR always includes distance with value and unit
          if (tag[1] && tag[2]) {
            hasRequiredTags.distance = true;
          }
          break;
        case 'duration':
          // RUNSTR always includes duration
          if (tag[1] && typeof tag[1] === 'string' && tag[1].length > 0) {
            hasRequiredTags.duration = true;
          }
          break;
      }
    }
    
    // Must have RUNSTR source identification (source OR client)
    const hasRunstrIdentification = hasRequiredTags.source || hasRequiredTags.client;
    
    // Must have core RUNSTR workout structure
    const hasRunstrStructure = hasRequiredTags.workoutId && 
                              hasRequiredTags.title && 
                              hasRequiredTags.exercise && 
                              hasRequiredTags.distance && 
                              hasRequiredTags.duration;
    
    const isRunstrWorkout = hasRunstrIdentification && hasRunstrStructure;
    
    // Debug logging for rejected events
    if (!isRunstrWorkout && (hasRequiredTags.source || hasRequiredTags.client)) {
      console.log('[nostr.js] Event has RUNSTR tags but missing signature:', {
        hasRunstrIdentification,
        hasRunstrStructure,
        missing: Object.entries(hasRequiredTags).filter(([key, value]) => !value).map(([key]) => key)
      });
    }
    
    return isRunstrWorkout;
  };

  // If caller provided an explicit since timestamp we just run single window with old logic
  const runSingleWindow = async (sinceArg) => {
    try {
      const defaultSince = Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60;
      const sinceTimestamp = sinceArg ? Math.floor(sinceArg / 1000) : defaultSince;
      console.log(`[nostr.js] Fetching Kind 1301 Workout Records from ${new Date(sinceTimestamp * 1000).toLocaleString()}${filterSource ? ` (filtering for ${filterSource})` : ''}`);
      
      const uniqueEvents = new Map();
      let receivedEvents = false;
      
      return await new Promise((resolve) => {
        const maxTimeout = setTimeout(async () => {
          console.log(`[nostr.js] Timeout (6s) reached with ${uniqueEvents.size} Kind 1301 events collected`);
          let eventArray = Array.from(uniqueEvents.values());
          
          // Apply RUNSTR signature filtering (includes both source and structure validation)
          if (filterSource) {
            const beforeFilter = eventArray.length;
            eventArray = eventArray.filter(isDefinitelyRunstrWorkout);
            console.log(`[nostr.js] RUNSTR signature filtering: ${beforeFilter} → ${eventArray.length} events`);
          }
          
          eventArray = eventArray
            .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
            .slice(0, limit);

          // Fallback removed for Phase 1 simplification with Kind 1301
          // if (eventArray.length === 0) {
          //   console.log('[nostr.js] Falling back to directFetchRunningPosts due to empty result set.');
          //   try {
          //     eventArray = await directFetchRunningPosts(limit, 7, 5000);
          //   } catch (fallbackErr) {
          //     console.warn('[nostr.js] directFetchRunningPosts fallback failed:', fallbackErr);
          //   }
          // }
          resolve(eventArray);
        }, 6000);
        
        const fastRelays = getFastestRelays(3);
        const relaySet = NDKRelaySet.fromRelayUrls(fastRelays, ndk);
        const sub = ndk.subscribe({
          kinds: [1301], // Changed to Kind 1301
          limit: limit * 3, // Fetch more to allow for client-side filtering
          // "#t": ["runstr"], // Removed hashtag filter, will filter client-side for activity_type
          since: sinceTimestamp
        }, { closeOnEose: false, relaySet });
        
        const relayPerformance = {};
        sub.on('event', (event) => {
          const relay = event.relay?.url || 'unknown';
          if (!relayPerformance[relay]) {
            relayPerformance[relay] = { count: 0, startTime: Date.now() };
          }
          relayPerformance[relay].count++;
          receivedEvents = true;
          uniqueEvents.set(event.id, event);
          
          // Apply comprehensive RUNSTR signature filtering
          const validEvents = Array.from(uniqueEvents.values())
            .filter(isDefinitelyRunstrWorkout);
          
          if (uniqueEvents.size >= limit && validEvents.length >= limit) {
            setTimeout(() => {
              clearTimeout(maxTimeout);
              try {
                const storedMetrics = JSON.parse(localStorage.getItem('relayPerformance') || '{}');
                Object.entries(relayPerformance).forEach(([relayUrl, metrics]) => {
                  const responseTime = metrics.count > 0 ? (Date.now() - metrics.startTime) : 0;
                  storedMetrics[relayUrl] = storedMetrics[relayUrl] || { count: 0, totalTime: 0, lastUpdated: Date.now() };
                  storedMetrics[relayUrl].count += metrics.count;
                  storedMetrics[relayUrl].totalTime += responseTime;
                  storedMetrics[relayUrl].lastUpdated = Date.now();
                });
                localStorage.setItem('relayPerformance', JSON.stringify(storedMetrics));
              } catch (err) {
                console.warn('[nostr.js] Could not save relay performance data', err);
              }
              const eventArray = validEvents
                .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
                .slice(0, limit);
              console.log(`[nostr.js] Resolved early with ${eventArray.length} RUNSTR workout events`);
              sub.stop();
              resolve(eventArray);
            }, 1000);
          }
        });
        
        sub.on('eose', () => {
          // Apply comprehensive RUNSTR signature filtering
          let filteredEvents = Array.from(uniqueEvents.values())
              .filter(isDefinitelyRunstrWorkout);

          if (receivedEvents && filteredEvents.length > 0 && sub.started && (Date.now() - sub.started > 3000)) {
            clearTimeout(maxTimeout);
            console.log(`[nostr.js] EOSE received with ${filteredEvents.length} RUNSTR workout events collected`);
            const eventArray = filteredEvents
              .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
              .slice(0, limit);
            sub.stop();
            resolve(eventArray);
          }
        });
      });
    } catch (error) {
      console.error('[nostr.js] Error fetching Kind 1301 events:', error);
      return [];
    }
  };

  if (since !== undefined) {
    // Legacy single-window behaviour remains
    return await runSingleWindow(since);
  }

  // Cascading windows logic
  const collected = new Map();
  for (const secondsAgo of fallbackWindows) {
    const sinceTimestampMs = Date.now() - secondsAgo * 1000;
    const batch = await runSingleWindow(sinceTimestampMs);
    batch.forEach(ev => collected.set(ev.id, ev));
    if (collected.size >= limit) break;
  }

  return Array.from(collected.values()).sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, limit);
};

/**
 * Load all supplementary data for posts in parallel
 * @param {Array} posts - Array of posts or post IDs to load data for
 * @param {string} [type] - Optional type of data to load (ignored but kept for compatibility)
 * @returns {Promise<Object>} Object containing all supplementary data
 */
export const loadSupplementaryData = async (posts, type) => {
  if (!posts || posts.length === 0) return {
    profileEvents: new Set(),
    comments: new Set(),
    likes: new Set(),
    reposts: new Set(),
    zapReceipts: new Set()
  };
  
  // Handle case where a single postId is passed instead of an array of posts
  if (typeof posts === 'string') {
    posts = [{ id: posts }];
    console.log('Warning: loadSupplementaryData called with string instead of post array');
  }
  
  // Handle case where an array of postIds is passed
  if (Array.isArray(posts) && typeof posts[0] === 'string') {
    posts = posts.map(id => ({ id }));
    console.log('Warning: loadSupplementaryData called with array of strings');
  }
  
  // Extract all post IDs
  const postIds = posts.map(post => post.id);
  
  // Extract unique author public keys (if available)
  const authors = [...new Set(posts.map(p => (p.pubkey || (p.author && p.author.pubkey))).filter(Boolean))];
  
  // Helper to run chunked fetch for event kinds referencing many ids
  const chunkedFetch = async (kind, ids) => {
    console.log(`[nostr.js chunkedFetch kind ${kind}] Starting for ${ids.length} IDs...`);
    const chunks = chunkArray(ids, 150);
    // Use Promise.allSettled to ensure all chunks attempt to fetch even if one fails/times out.
    // Add a timeout to individual chunk fetches as a safeguard.
    const CHUNK_FETCH_TIMEOUT = 7000; // 7 seconds for each chunk
    const settledResults = await Promise.allSettled(
      chunks.map(slice => 
        fetchEvents({ kinds: [kind], '#e': slice }, { timeout: CHUNK_FETCH_TIMEOUT })
      )
    );

    const successfulResults = settledResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    // Merge into single Set
    const mergedSet = successfulResults.reduce((acc, set) => {
      for (const ev of set) acc.add(ev);
      return acc;
    }, new Set());
    console.log(`[nostr.js chunkedFetch kind ${kind}] Completed. Fetched ${mergedSet.size} total events.`);
    return mergedSet;
  };

  // Run all queries in parallel using Promise.allSettled so that one failure
  // doesn't break the entire supplementary data pipeline
  const [profileRes, commentsRes, likesRes, repostsRes, zapRes] = await Promise.allSettled([
    // Profile information (only if we have author public keys)
    authors.length > 0 ? (() => {
      console.log('[nostr.js loadSupplementaryData] Fetching profiles...');
      // Query all connected relays so we don't miss profiles that live only on slower relays
      return fetchEvents(
        { kinds: [0], authors, limit: authors.length },
        { timeout: 15000 }
      ).then(res => { console.log('[nostr.js loadSupplementaryData] Profiles fetched (all relays).'); return res; });
    })() : Promise.resolve(new Set()),
    // Comments
    (() => { console.log('[nostr.js loadSupplementaryData] Fetching comments...'); return chunkedFetch(1, postIds).then(res => { console.log('[nostr.js loadSupplementaryData] Comments fetched.'); return res; }); })(),
    // Likes
    (() => { console.log('[nostr.js loadSupplementaryData] Fetching likes...'); return chunkedFetch(7, postIds).then(res => { console.log('[nostr.js loadSupplementaryData] Likes fetched.'); return res; }); })(),
    // Reposts
    (() => { console.log('[nostr.js loadSupplementaryData] Fetching reposts...'); return chunkedFetch(6, postIds).then(res => { console.log('[nostr.js loadSupplementaryData] Reposts fetched.'); return res; }); })(),
    // Zap receipts
    (() => { console.log('[nostr.js loadSupplementaryData] Fetching zaps...'); return chunkedFetch(9735, postIds).then(res => { console.log('[nostr.js loadSupplementaryData] Zaps fetched.'); return res; }); })()
  ]);
  
  // Prefer fast-relay profile query, but if it comes back empty try again against _all_ connected relays.
  let profileEvents = profileRes.status === 'fulfilled' ? profileRes.value : new Set();

  if (profileEvents.size === 0 && authors.length > 0) {
    try {
      const fallbackProfiles = await fetchEvents(
        { kinds: [0], authors, limit: authors.length },
        { timeout: 15000 }
      );
      if (fallbackProfiles && fallbackProfiles.size > 0) {
        profileEvents = fallbackProfiles;
      }
    } catch (err) {
      console.warn('[nostr.js] profile fallback fetch failed', err);
    }
  }
  const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : new Set();
  const likes = likesRes.status === 'fulfilled' ? likesRes.value : new Set();
  const reposts = repostsRes.status === 'fulfilled' ? repostsRes.value : new Set();
  const zapReceipts = zapRes.status === 'fulfilled' ? zapRes.value : new Set();
  
  const result = { profileEvents, comments, likes, reposts, zapReceipts };
  
  // If called with a single post ID and 'comments' type, structure the result
  // to be compatible with the expected format in handleCommentClick
  if (type === 'comments' && postIds.length === 1) {
    result[postIds[0]] = Array.from(comments);
  }
  
  return result;
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
        // First try strict JSON parse (spec-compliant)
        if (typeof profile.content === 'string' && profile.content.trim().startsWith('{')) {
          try {
            parsedProfile = JSON.parse(profile.content);
          } catch (err) {
            console.warn(`Profile JSON parse failed for ${profile.pubkey}`, err);
          }
        }

        // If JSON parse failed or produced no useful fields, fall back to tag lookup
        if (!parsedProfile || Object.keys(parsedProfile).length === 0) {
          const tagValue = (key) => profile.tags?.find(t => t[0] === key)?.[1];
          parsedProfile = {
            name: tagValue('name'),
            display_name: tagValue('display_name'),
            picture: tagValue('picture'),
            nip05: tagValue('nip05'),
            lud16: tagValue('lud16'),
            lud06: tagValue('lud06'),
            website: tagValue('website'),
            banner: tagValue('banner')
          };
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
    
    // Fallback: fetch any still-missing profiles from public aggregator API
    const allAuthors = [...new Set(posts.map(p => p.pubkey || (p.author && p.author.pubkey)).filter(Boolean))];
    const missingAuthors = allAuthors.filter(pk => !profileMap.has(pk));
    if (missingAuthors.length > 0) {
      try {
        const { fetchProfilesFromAggregator } = await import('./profileAggregator.js');
        const aggProfiles = await fetchProfilesFromAggregator(missingAuthors);
        aggProfiles.forEach((profile, pk) => profileMap.set(pk, profile));
      } catch (aggErr) {
        console.warn('Aggregator profile fetch failed', aggErr);
      }
    }
    
    // Count likes and reposts per post
    const likesByPost = new Map();
    const repostsByPost = new Map();
    const zapsByPost = new Map();
    
    // Process likes
    Array.from(likes).forEach(like => {
      const postId = getEventTargetId(like);
      if (!postId) return;
      if (!likesByPost.has(postId)) {
        likesByPost.set(postId, new Set());
      }
      likesByPost.get(postId).add(like.id);
    });
    
    // Process reposts
    Array.from(reposts).forEach(repost => {
      const postId = getEventTargetId(repost);
      if (!postId) return;
      if (!repostsByPost.has(postId)) {
        repostsByPost.set(postId, new Set());
      }
      repostsByPost.get(postId).add(repost.id);
    });
    
    // Process zap receipts
    Array.from(zapReceipts).forEach(zapReceipt => {
      try {
        const postId = getEventTargetId(zapReceipt);
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
            zapsByPost.set(postId, { ids: new Set(), amount: 0 });
          }
          const postZaps = zapsByPost.get(postId);
          if (!postZaps.ids.has(zapReceipt.id)) {
            postZaps.ids.add(zapReceipt.id);
            postZaps.amount += zapAmount;
          }
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
        const hasProfile = profileMap.has(authorPubkey);
        const profile = hasProfile ? profileMap.get(authorPubkey) : {
          name: 'Loading...',
          picture: undefined,
          lud16: undefined,
          lud06: undefined
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
      const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
      return content.match(urlRegex) || [];
    };
    
    // Process posts with all the data
    const processedPosts = posts.map(post => {
      if (!post || !post.pubkey) {
        console.warn('Received invalid post data', post);
        return null;
      }
      
      // Get author's profile with robust fallback
      const authorPubkey = post.pubkey || (post.author && post.author.pubkey) || '';
      const hasProfile = profileMap.has(authorPubkey);
      const profile = hasProfile ? profileMap.get(authorPubkey) : {
        name: 'Loading...',
        picture: undefined,
        lud16: undefined,
        lud06: undefined
      };
      
      // Extract images once during processing
      const images = extractImagesFromContent(post.content || '');
      
      // Get post interactions with safe defaults
      const postZaps = zapsByPost.get(post.id) || { ids: new Set(), amount: 0 };
      const postLikes = likesByPost.get(post.id) || new Set();
      const postReposts = repostsByPost.get(post.id) || new Set();
      const postComments = commentsByPost.get(post.id) || [];

      // Kind 1301 specific processing (similar to lightweightProcessPosts)
      let workoutTitle = post.title; // If already processed by lightweightProcessPosts
      let metrics = post.metrics || []; // If already processed
      const eventKind = post.kind || 1; // Default to 1 if not present, but should be 1301 now
      const allTags = post.tags || [];

      if (eventKind === 1301 && (!workoutTitle || metrics.length === 0)) {
        const workoutTitleTagOld = allTags.find(tag => tag[0] === 'title');
        workoutTitle = workoutTitleTagOld ? workoutTitleTagOld[1] : 'Workout Record';

        // Remove distance from metrics to avoid duplication with content text
        // const distanceTag = allTags.find(tag => tag[0] === 'distance');
        // if (distanceTag && distanceTag[1] && !metrics.find(m => m.label === "Distance")) {
        //   metrics.push({
        //     label: "Distance",
        //     value: distanceTag[1],
        //     unit: distanceTag[2] || '',
        //   });
        // }

        const durationTag = allTags.find(tag => tag[0] === 'duration');
        if (durationTag && durationTag[1] && !metrics.find(m => m.label === "Duration")) {
          metrics.push({
            label: "Duration",
            value: durationTag[1],
            unit: durationTag[2] || '',
          });
        }
        // Add more detailed NIP-101e exercise tag parsing if necessary here
        // For now, keeping it consistent with lightweightProcessPosts
        const exerciseTag = allTags.find(tag => tag[0] === 'exercise');
        if (exerciseTag && exerciseTag.length >= 3) {
          if (exerciseTag[2] && exerciseTag[3] && metrics.length < 3) {
            if (!metrics.find(m => m.label.toLowerCase() === exerciseTag[3].toLowerCase())) { 
                metrics.push({ label: exerciseTag[3], value: exerciseTag[2], unit: ''});
            }
          }
          if (exerciseTag[4] && exerciseTag[5] && metrics.length < 3) {
            if (!metrics.find(m => m.label.toLowerCase() === exerciseTag[5].toLowerCase())) { 
                metrics.push({ label: exerciseTag[5], value: exerciseTag[4], unit: ''});
            }
          }
           if (exerciseTag[6] && exerciseTag[7] && metrics.length < 3) {
             if (!metrics.find(m => m.label.toLowerCase() === exerciseTag[7].toLowerCase())) {
                metrics.push({ label: exerciseTag[7], value: exerciseTag[6], unit: ''});
              }
          }
        }
      }
      
      return {
        id: post.id || `post-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        kind: eventKind, // Ensure kind is passed through
        title: eventKind === 1301 ? workoutTitle : undefined, // Title only for kind 1301
        content: post.content || '',
        created_at: post.created_at || Math.floor(Date.now() / 1000),
        author: {
          pubkey: authorPubkey,
          profile: profile,
          lud16: profile.lud16,
          lud06: profile.lud06
        },
        metrics: eventKind === 1301 ? metrics : [], // Metrics only for kind 1301
        tags: allTags, // Pass through all tags
        comments: postComments,
        showComments: false, // This is UI state, might be better managed in the component/hook
        likes: postLikes.size,
        reposts: postReposts.size,
        zaps: postZaps.ids.size,
        zapAmount: postZaps.amount,
        images: images,
        needsProfile: !hasProfile
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
 * @param {Object} relaySet - Optional relay set for publishing
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<{success: boolean, error: string|null}>} Result of publish attempt
 */
const publishWithRetry = async (ndkEvent, relaySet = null, maxRetries = 3, delay = 2000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Publishing to NDK relays - attempt ${attempt}/${maxRetries}...`);
      
      // Ensure we're connected before publishing
      await ndkReadyPromise;
      
      // Publish the event
      if (relaySet) {
        await ndkEvent.publish({ relaySet });
      } else {
        await ndkEvent.publish();
      }
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
 * @param {Object} opts - Additional options for the event
 * @returns {Promise<Object>} Published event
 */
export const createAndPublishEvent = async (eventTemplate, pubkeyOverride = null, opts = {}) => {
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
    
    // Determine encryption preference (default false to avoid breaking existing flows)
    const shouldEncrypt = !!opts.encrypt;
    let recipientPubkey = opts.recipientPubkey || null; // if null we will fill with user's pubkey once known
    
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
        
        // Encrypt content if requested (encrypt-to-self by default)
        let processedTemplate = { ...eventTemplate };
        if (shouldEncrypt) {
          if (!recipientPubkey) recipientPubkey = pubkey;
          const { cipherText, nip44Tags } = await encryptContentNip44(
            String(processedTemplate.content),
            recipientPubkey
          );
          processedTemplate = {
            ...processedTemplate,
            content: cipherText,
            tags: [...(processedTemplate.tags || []), ...nip44Tags]
          };
        }
        
        // Create the event with user's pubkey
        const event = {
          ...processedTemplate,
          pubkey,
          created_at: Math.floor(Date.now() / 1000)
        };
        
        // Sign using Amber - this is now properly async with timeout handling
        try {
          signedEvent = await AmberAuth.signEvent(event);
          publishResult.signMethod = 'amber';
          
          // Validate that we got a properly signed event
          if (!signedEvent || !signedEvent.sig || !signedEvent.id) {
            throw new Error('Amber signing failed - invalid signed event returned');
          }
        } catch (amberError) {
          console.error('Amber signing failed:', amberError);
          // Provide specific error messages based on the error type
          if (amberError.message.includes('timeout')) {
            throw new Error('Amber signing timed out. Please ensure Amber is running and try again.');
          } else if (amberError.message.includes('not found')) {
            throw new Error('Amber app not found. Please install Amber from https://github.com/greenart7c3/Amber');
          } else if (amberError.message.includes('cancelled')) {
            throw new Error('Signing was cancelled by user.');
          } else {
            throw new Error(`Amber signing failed: ${amberError.message}`);
          }
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
      
      // Encrypt content if requested (encrypt-to-self by default)
      let processedTemplate = { ...eventTemplate };
      if (shouldEncrypt) {
        if (!recipientPubkey) recipientPubkey = pubkey;
        const { cipherText, nip44Tags } = await encryptContentNip44(
          String(processedTemplate.content),
          recipientPubkey
        );
        processedTemplate = {
          ...processedTemplate,
          content: cipherText,
          tags: [...(processedTemplate.tags || []), ...nip44Tags]
        };
      }
      
      // Create the event with user's pubkey
      const event = {
        ...processedTemplate,
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
      await ndkReadyPromise;
      
      // Create relay set that excludes relays which block this kind
      let relaySet = null;
      if (opts.relays && Array.isArray(opts.relays)) {
        relaySet = NDKRelaySet.fromRelayUrls(opts.relays, ndk);
      } else {
        try {
          const allRelays = Array.from(ndk.pool.relays.values()).map(r => r.url);
          const filtered = allRelays.filter(url => {
            if (url.includes('purplepag.es')) {
              // Purple Pages only allows kinds 0,3,10002
              return [0, 3, 10002].includes(signedEvent.kind);
            }
            return true;
          });
          if (filtered.length > 0 && filtered.length < allRelays.length) {
            relaySet = NDKRelaySet.fromRelayUrls(filtered, ndk);
          }
        } catch (filterErr) {
          console.warn('Relay filtering failed:', filterErr);
        }
      }
      
      // Create NDK Event and publish with retry
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      const ndkResult = await publishWithRetry(ndkEvent, relaySet);
      
      if (ndkResult.success) {
        publishResult.success = true;
        publishResult.method = 'ndk';
        return { ...signedEvent, ...publishResult };
      }
      // If NDK failed AND a specific relay list was provided, do NOT fallback.
      // Throw an error indicating failure to publish to the specified relays.
      if (opts.relays && Array.isArray(opts.relays) && opts.relays.length > 0) {
        const specificRelayMessage = `Failed to publish to the specified relay(s): ${opts.relays.join(', ')}. Please check the relay URL and ensure the relay is running and accepting connections.`;
        console.error('[nostr.js] NDK publishing failed for specific relays:', specificRelayMessage, ndkResult.error);
        
        // For user-friendly error handling, include more context
        const enhancedError = new Error(specificRelayMessage);
        enhancedError.relayUrls = opts.relays;
        enhancedError.originalError = ndkResult.error;
        throw enhancedError;
      }
    } catch (ndkError) {
      console.error('Error in NDK publishing:', ndkError);
      // If a specific relay list was provided, and an error occurred within the NDK block (e.g., NDK not ready)
      // we should also prevent fallback and re-throw or throw a specific error.
      if (opts.relays && Array.isArray(opts.relays) && opts.relays.length > 0) {
        const specificRelayMessage = `Error publishing to the specified relay(s): ${opts.relays.join(', ')}. ${ndkError.message}`;
        console.error('[nostr.js] NDK error for specific relays:', specificRelayMessage);
        
        // For user-friendly error handling, include more context
        const enhancedError = new Error(specificRelayMessage);
        enhancedError.relayUrls = opts.relays;
        enhancedError.originalError = ndkError;
        throw enhancedError;
      }
      // Otherwise, if no specific relays, allow progression to fallback.
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
      
      // Provide specific error messages based on the failure type
      if (fallbackError.message.includes('network') || fallbackError.message.includes('timeout')) {
        throw new Error('Publishing failed due to network issues. Please check your internet connection and try again.');
      } else if (fallbackError.message.includes('relay') || fallbackError.message.includes('connection')) {
        throw new Error('Could not connect to Nostr relays. Please try again in a moment.');
      } else if (fallbackError.message.includes('sign')) {
        throw new Error('Event signing failed. Please ensure Amber is working properly and try again.');
      } else {
        throw new Error(`Publishing failed: ${fallbackError.message}. Please try again.`);
      }
    }
    
    return { ...signedEvent, ...publishResult };
  } catch (error) {
    console.error('Error in createAndPublishEvent:', error);
    
    // Enhance error message if it's not already user-friendly
    if (error.message && (
      error.message.includes('Amber') || 
      error.message.includes('timeout') || 
      error.message.includes('network') ||
      error.message.includes('relay') ||
      error.message.includes('Publishing failed')
    )) {
      // Already has a user-friendly message, pass it through
      throw error;
    } else {
      // Generic error, provide helpful guidance
      throw new Error('Failed to publish to Nostr. Please check your connection and ensure Amber is working properly, then try again.');
    }
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
      await ndkReadyPromise;
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

/**
 * Create a NIP-101e kind 1301 workout event from run data
 * @param {Object} run - Run data containing distance, duration, elevation, activityType, date, notes
 * @param {string} distanceUnit - The unit of distance measurement ('km' or 'mi')
 * @param {Object} [options] - Optional parameters
 * @param {Object} [options.teamAssociation] - Optional team to associate with the workout
 * @param {string} [options.teamAssociation.teamCaptainPubkey]
 * @param {string} [options.teamAssociation.teamUUID]
 * @param {string} [options.teamAssociation.relayHint]
 * @param {string} [options.teamAssociation.teamName] - Human-readable team name
 * @param {Array} [options.challengeUUIDs] - Array of challenge UUIDs
 * @param {Array} [options.challengeNames] - Array of challenge names corresponding to UUIDs
 * @param {string} [options.userPubkey] - User's public key for team member identification
 * @returns {Object} Event template for a kind 1301 event
 */
export const createWorkoutEvent = (run, distanceUnit, options = {}) => {
  if (!run) {
    throw new Error('No run data provided');
  }

  const { teamAssociation, challengeUUIDs, challengeNames, userPubkey } = options;
  const workoutUUID = uuidv4(); // Unique ID for this workout record

  const activity = (run.activityType || 'run').toLowerCase();
  const activityVerb = activity === 'walk' ? 'walk' : (activity === 'cycle' ? 'cycle' : 'run');
  const activityEmoji = activity === 'walk' ? '🚶‍♀️' : (activity === 'cycle' ? '🚴' : '🏃‍♂️');
  const primaryHashtag = activity === 'walk' ? 'Walking' : (activity === 'cycle' ? 'Cycling' : 'Running');

  const distanceValue = distanceUnit === 'km' 
    ? (run.distance / 1000).toFixed(2) 
    : (run.distance / 1609.344).toFixed(2);
  
  const hours = Math.floor(run.duration / 3600);
  const minutes = Math.floor((run.duration % 3600) / 60);
  const seconds = Math.floor(run.duration % 60);
  const durationFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  let elevationTags = [];
  if (run.elevation && run.elevation.gain) {
    const elevationUnit = distanceUnit === 'km' ? 'm' : 'ft';
    const elevationValue = distanceUnit === 'km' 
      ? run.elevation.gain 
      : Math.round(run.elevation.gain * 3.28084);
    elevationTags = [['elevation_gain', elevationValue.toString(), elevationUnit]];
  }

  const runDate = new Date(run.date);
  // Remove title completely to avoid duplication with date badge
  const workoutTitle = run.title || '';

  // Enhanced content generation following NIP-101e community linking
  let contentParts = [];
  
  // Start with user notes or default activity description - restore distance to content
  const baseContent = run.notes || `Completed a ${distanceValue}${distanceUnit} ${activityVerb}. ${activityEmoji}`;
  contentParts.push(baseContent);
  
  // Add team association if present
  if (teamAssociation && teamAssociation.teamName) {
    contentParts.push(`Team: ${teamAssociation.teamName}`);
  } else if (teamAssociation && teamAssociation.teamUUID) {
    contentParts.push(`Team: ${teamAssociation.teamUUID.slice(0, 8)}`);
  }
  
  // Add challenge associations if present
  if (Array.isArray(challengeNames) && challengeNames.length > 0) {
    const challengeList = challengeNames.join(', ');
    const challengeText = challengeNames.length === 1 ? 'Challenge' : 'Challenges';
    contentParts.push(`${challengeText}: ${challengeList}`);
  } else if (Array.isArray(challengeUUIDs) && challengeUUIDs.length > 0) {
    const challengeList = challengeUUIDs.map(uuid => uuid.slice(0, 8)).join(', ');
    const challengeText = challengeUUIDs.length === 1 ? 'Challenge' : 'Challenges';
    contentParts.push(`${challengeText}: ${challengeList}`);
  }

  const tags = [
    ["d", workoutUUID], // NIP-101e unique workout ID
    ["title", workoutTitle],
    // ['workout', runName], // Older tag, replaced by title and d
    ['exercise', activityVerb], // Simplified exercise tag, can be expanded per NIP-101e exercise template linking
    ['distance', distanceValue, distanceUnit],
    ['duration', durationFormatted],
    ...elevationTags,
    ['source', 'RUNSTR'], // Keep source
    ['client', 'Runstr', 'vCurrentAppVersion'], // Standard client tag, replace vCurrentAppVersion
    ['t', primaryHashtag],
    // Add other NIP-101e suggested tags if data is available:
    // ["type", "cardio"], (activityVerb already covers this somewhat)
    // ["start", Math.floor(run.startTimeEpochMs / 1000).toString()], (if run.startTimeEpochMs is available)
    // ["end", Math.floor(run.endTimeEpochMs / 1000).toString()], (if run.endTimeEpochMs is available)
    // ["gps_polyline", run.polyline || ""], (if available)
    // ["device", run.deviceInfo || "Runstr Mobile App"], (if available)
  ];

  // Enhanced NIP-101e team association tags
  if (teamAssociation && teamAssociation.teamUUID) {
    const { teamCaptainPubkey, teamUUID, relayHint = '', teamName = '' } = teamAssociation;
    const aTag = `33404:${teamCaptainPubkey || ''}:${teamUUID}`;
    
    // NIP-101e format: ["team", "33404:<pubkey>:<uuid>", "<relay>", "<team-name>"]
    const teamTag = ["team", aTag];
    if (relayHint) teamTag.push(relayHint);
    if (teamName) teamTag.push(teamName);
    tags.push(teamTag);
    
    // Add discoverable hashtag for efficient team feed queries
    tags.push(["t", `team:${teamUUID}`]);
    
    // Add direct UUID tag for efficient team filtering
    tags.push(["team_uuid", teamUUID]);
    
    // Add team member identification for verification
    if (userPubkey) {
      tags.push(["team_member", userPubkey]);
    }
  }

  // Enhanced NIP-101e challenge tags
  if (Array.isArray(challengeUUIDs)) {
    challengeUUIDs.forEach((uuid, index) => {
      if (uuid && typeof uuid === 'string') {
        // Add hashtag for discovery (keep existing approach)
        tags.push(["t", `challenge:${uuid}`]);
        
        // Add direct UUID tag for efficient challenge filtering
        tags.push(["challenge_uuid", uuid]);
        
        // Add challenge name if available
        const challengeName = challengeNames && challengeNames[index] ? challengeNames[index] : '';
        if (challengeName) {
          tags.push(["challenge_name", uuid, challengeName]);
        }
      }
    });
  }

  // Add event tags for simplified team events system
  try {
    // Get active events for the workout date using localStorage directly to avoid imports
    const workoutDate = new Date(run.date);
    const dateString = workoutDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Read joined events from localStorage
    const joinedEventsJson = localStorage.getItem('runstr_joined_events');
    if (joinedEventsJson) {
      const joinedEvents = JSON.parse(joinedEventsJson);
      const activeEvents = Object.values(joinedEvents)
        .filter((event) => event.eventDate === dateString)
        .map((event) => ({
          eventId: event.eventId,
          eventName: event.eventName
        }));
      
      if (activeEvents.length > 0) {
        console.log(`[createWorkoutEvent] Adding tags for ${activeEvents.length} active events on ${dateString}`);
        
        // Add event tags and content
        activeEvents.forEach(({ eventId, eventName }) => {
          // Add event identifier tag for leaderboard queries
          tags.push(["event", eventId, eventName]);
          
          // Add hashtag for discovery
          tags.push(["t", `event:${eventId}`]);
          
          // Add event to content
          contentParts.push(`Event: ${eventName}`);
        });
        
        console.log(`[createWorkoutEvent] Added event tags:`, activeEvents);
      }
    }
  } catch (eventError) {
    // Don't fail workout publishing if event tagging fails
    console.warn('[createWorkoutEvent] Failed to add event tags:', eventError);
  }

  return {
    kind: 1301,
    content: contentParts.join(' • '), // Join content parts with bullet separator
    tags: tags,
    // created_at will be set by createAndPublishEvent or the signing process
  };
};

export { ndk };
