import { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { Platform } from '../utils/react-native-shim.js';
import AmberAuth from '../services/AmberAuth.js';
// Import nostr-tools implementation for fallback
import { createAndPublishEvent as publishWithNostrTools } from './nostrClient.js';
import { getFastestRelays, directFetchRunningPosts } from './feedFetcher.js';
import { encryptContentNip44 } from './nip44.js';
import { getEventTargetId, chunkArray } from './eventHelpers.js';

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
export const fetchEvents = async (filter, fetchOpts = {}) => {
  // Ensure relay pool is connected before issuing query
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
    // All functions will now use the imported singleton `ndk`
    const events = await ndk.fetchEvents(filter, fetchOpts);
    console.log(`[nostr.js] Fetched ${events.size} events for filter:`, filter);
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
 * Fetch running posts from Nostr relays
 * @param {number} limit - Maximum number of posts to fetch
 * @param {number} since - Timestamp to fetch posts since
 * @returns {Promise<Array<NDKEvent>>} Array of running posts
 */
export const fetchRunningPosts = async (limit = 7, since = undefined, fallbackWindows = [2 * 3600, 24 * 3600, 14 * 24 * 3600]) => {
  // If caller provided an explicit since timestamp we just run single window with old logic
  const runSingleWindow = async (sinceArg) => {
    try {
      const defaultSince = Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60;
      const sinceTimestamp = sinceArg ? Math.floor(sinceArg / 1000) : defaultSince;
      console.log(`[nostr.js] Fetching posts with #runstr hashtag from ${new Date(sinceTimestamp * 1000).toLocaleString()}`);
      
      const uniqueEvents = new Map();
      let receivedEvents = false;
      
      return await new Promise((resolve) => {
        const maxTimeout = setTimeout(async () => {
          console.log(`[nostr.js] Timeout (6s) reached with ${uniqueEvents.size} posts collected`);
          let eventArray = Array.from(uniqueEvents.values())
            .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
            .slice(0, limit);

          // Fallback: if nothing collected, run direct fetch on fastest relays
          if (eventArray.length === 0) {
            console.log('[nostr.js] Falling back to directFetchRunningPosts due to empty result set.');
            try {
              eventArray = await directFetchRunningPosts(limit, 7, 5000);
            } catch (fallbackErr) {
              console.warn('[nostr.js] directFetchRunningPosts fallback failed:', fallbackErr);
            }
          }
          resolve(eventArray);
        }, 6000);
        
        const fastRelays = getFastestRelays(3);
        const relaySet = NDKRelaySet.fromRelayUrls(fastRelays, ndk);
        const sub = ndk.subscribe({
          kinds: [1],
          limit: limit * 2,
          "#t": ["runstr"],
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
          
          if (uniqueEvents.size >= limit) {
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
              const eventArray = Array.from(uniqueEvents.values())
                .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
                .slice(0, limit);
              console.log(`[nostr.js] Resolved early with ${eventArray.length} posts with #runstr hashtag`);
              sub.stop();
              resolve(eventArray);
            }, 1000);
          }
        });
        
        sub.on('eose', () => {
          if (receivedEvents && uniqueEvents.size > 0 && sub.started && (Date.now() - sub.started > 3000)) {
            clearTimeout(maxTimeout);
            console.log(`[nostr.js] EOSE received with ${uniqueEvents.size} posts collected`);
            const eventArray = Array.from(uniqueEvents.values())
              .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
              .slice(0, limit);
            sub.stop();
            resolve(eventArray);
          }
        });
      });
    } catch (error) {
      console.error('[nostr.js] Error fetching hashtag posts:', error);
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
        likes: postLikes.size,
        reposts: postReposts.size,
        zaps: postZaps.ids.size,
        zapAmount: postZaps.amount,
        images: images,  // Add extracted images to the post object
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
            // Try to get from Amber connection state
            const amberState = AmberAuth.getConnectionState();
            if (amberState.pubkey) {
              pubkey = amberState.pubkey;
            } else {
              throw new Error('No public key available. Please log in first.');
            }
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
        
        // Sign using Amber with retry logic
        let signAttempts = 0;
        const maxAttempts = 2;
        let lastError = null;
        
        while (signAttempts < maxAttempts) {
          try {
            console.log(`[nostr.js] Attempting to sign with Amber (attempt ${signAttempts + 1}/${maxAttempts})`);
            signedEvent = await AmberAuth.signEvent(event);
            
            if (signedEvent) {
              publishResult.signMethod = 'amber';
              break; // Success, exit retry loop
            } else {
              throw new Error('Amber signing returned null');
            }
          } catch (error) {
            lastError = error;
            signAttempts++;
            console.error(`[nostr.js] Amber signing attempt ${signAttempts} failed:`, error);
            
            // If it's a timeout and we have more attempts, wait a bit before retrying
            if (error.message === 'Signing timeout' && signAttempts < maxAttempts) {
              console.log('[nostr.js] Waiting 2 seconds before retry...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else if (error.message === 'Re-authentication failed') {
              // Don't retry if authentication failed
              break;
            }
          }
        }
        
        // If all attempts failed, throw the last error
        if (!signedEvent) {
          console.error('[nostr.js] All Amber signing attempts failed');
          throw lastError || new Error('Failed to sign event with Amber');
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
 * @param {Object} run - Run data containing distance, duration, elevation
 * @param {string} distanceUnit - The unit of distance measurement ('km' or 'mi')
 * @returns {Object} Event template for a kind 1301 event
 */
export const createWorkoutEvent = (run, distanceUnit) => {
  if (!run) {
    throw new Error('No run data provided');
  }

  const activity = (run.activityType || 'run').toLowerCase();
  const activityVerb = activity === 'walk' ? 'walk' : (activity === 'cycle' ? 'cycle' : 'run');
  const activityEmoji = activity === 'walk' ? '🚶‍♀️' : (activity === 'cycle' ? '🚴' : '🏃‍♂️');
  const primaryHashtag = activity === 'walk' ? 'Walking' : (activity === 'cycle' ? 'Cycling' : 'Running');

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
    content: `Completed a ${activityVerb} with RUNSTR! ${activityEmoji}`,
    tags: [
      ['workout', runName],
      ['exercise', activityVerb],
      ['distance', distanceValue, distanceUnit],
      ['duration', durationFormatted],
      ...elevationTags,
      ['source', 'RUNSTR'],
      ['t', primaryHashtag]
    ]
  };
};

export { ndk };
