import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  fetchRunningPosts, 
  loadSupplementaryData, 
  processPostsWithData
} from '../utils/nostr';
import { awaitNDKReady, ndk } from '../lib/ndkSingleton';
import { lightweightProcessPosts, mergeProcessedPosts } from '../utils/feedProcessor';
import { NDKRelaySet } from '@nostr-dev-kit/ndk';
import { getFastestRelays } from '../utils/feedFetcher';
import { startFeed, subscribeFeed, getFeed } from '../lib/feedManager';
import { getEventTargetId } from '../utils/eventHelpers';
import { useProfileCache } from '../hooks/useProfileCache.js';
import { ensureRelays } from '../utils/relays.js';
import { useActivityMode } from '../contexts/ActivityModeContext';

// Global state for caching posts across component instances
const globalState = {
  allPosts: [],
  lastFetchTime: 0,
  isInitialized: false,
  activeSubscription: null,
  lastFilterSource: null, // Track what filter was used for cache
  lastActivityMode: null, // Track what activity mode was used for cache
  cacheVersion: '1.1.0', // Version to track cache compatibility
};

// Check and clear incompatible cache on startup
const checkCacheVersion = () => {
  try {
    const storedVersion = localStorage.getItem('runstr_cache_version');
    if (storedVersion !== globalState.cacheVersion) {
      console.log(`[useRunFeed] Cache version mismatch (${storedVersion} → ${globalState.cacheVersion}), clearing cache`);
      globalState.allPosts = [];
      globalState.lastFetchTime = 0;
      globalState.lastFilterSource = null;
      globalState.lastActivityMode = null;
      localStorage.setItem('runstr_cache_version', globalState.cacheVersion);
      // Also clear any related localStorage items
      localStorage.removeItem('runstr_league_leaderboard');
      localStorage.removeItem('relayPerformance');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[useRunFeed] Cache version check failed:', err);
    return false;
  }
};

export const useRunFeed = (filterSource = null) => {
  // Get activity mode for filtering
  const { mode: activityMode } = useActivityMode();
  
  // Prefer central manager; hydrate immediately
  const [posts, setPosts] = useState(() => getFeed());
  const [loading, setLoading] = useState(getFeed().length === 0);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const [displayLimit, setDisplayLimit] = useState(7); // New state for display limit
  const [allPosts, setAllPosts] = useState(globalState.allPosts || []); // Use global cache
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(globalState.isInitialized);
  const subscriptionRef = useRef(null);
  const fetchedProfilesRef = useRef(new Set());
  const reactionSubRef = useRef(null);
  const reactionSetsRef = useRef({ likes: new Map(), reposts: new Map(), zaps: new Map(), comments: new Map() });

  // Re-use the shared profile cache that already works in ChatRoom
  const { fetchProfiles } = useProfileCache();

  // Ensure NDK as soon as the hook is used
  useEffect(() => {
    const initNostr = async () => {
      // Check and clear incompatible cache first
      checkCacheVersion();
      
      // Only initialize once
      if (!globalState.isInitialized) {
        await awaitNDKReady();
        globalState.isInitialized = true;
      }
    };
    
    initNostr();
  }, []);

  // Background fetch for new posts
  const setupBackgroundFetch = useCallback(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up a recurring fetch every 60 seconds
    timeoutRef.current = setInterval(async () => {
      console.log('Background fetch: Checking for new posts');
      
      try {
        // Only fetch posts that are newer than our most recent post
        const newestPostTime = globalState.allPosts.length > 0 
          ? Math.max(...globalState.allPosts.map(p => p.created_at)) * 1000
          : undefined;
          
        // Only fetch if we haven't fetched in the last 30 seconds
        const now = Date.now();
        if (now - globalState.lastFetchTime < 30000) {
          console.log('Skipping background fetch, last fetch was too recent');
          return;
        }
        
        globalState.lastFetchTime = now;
        
        // Fetch new posts
        const limit = 10; // Fetch just a few new posts
        const runPostsArray = await fetchRunningPosts(limit, newestPostTime, filterSource);
        
        if (runPostsArray.length === 0) {
          console.log('No new posts found in background fetch');
          return;
        }
        
        console.log(`Background fetch: Found ${runPostsArray.length} new posts`);
        
        // Load supplementary data in parallel
        const supplementaryData = await loadSupplementaryData(runPostsArray);
        
        // Process posts with all the data
        const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
        
        // Update global cache with new posts
        if (processedPosts.length > 0) {
          // Remove duplicates and merge with existing posts
          const existingIds = new Set(globalState.allPosts.map(p => p.id));
          const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
          
          if (newPosts.length > 0) {
            globalState.allPosts = [...newPosts, ...globalState.allPosts];
            
            // Update local state if component is mounted
            setAllPosts(prevPosts => {
              const mergedPosts = [...newPosts, ...prevPosts];
              return mergedPosts;
            });
            
            // Update displayed posts
            setPosts(prevPosts => {
              // Create merged array with new posts at the top
              const mergedPosts = [...newPosts, ...prevPosts];
              
              // Only display up to the display limit
              return mergedPosts.slice(0, displayLimit);
            });
            
            // Update user interactions
            updateUserInteractions(supplementaryData);
          }
        }
      } catch (error) {
        console.error('Error in background fetch:', error);
        // Don't set error state - this is a background operation
      }
    }, 60000);
    
    // Store reference to cleanup
    subscriptionRef.current = timeoutRef.current;
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [displayLimit, filterSource]);

  // Extract user interactions logic to reuse
  const updateUserInteractions = useCallback((supplementaryData) => {
    const newUserLikes = new Set([...userLikes]);
    const newUserReposts = new Set([...userReposts]);
    
    supplementaryData.likes?.forEach(like => {
      try {
        if (window.nostr && like.pubkey === window.nostr.getPublicKey()) {
          const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
          if (postId) newUserLikes.add(postId);
        }
      } catch (err) {
        console.error('Error processing user likes:', err);
      }
    });
    
    supplementaryData.reposts?.forEach(repost => {
      try {
        if (window.nostr && repost.pubkey === window.nostr.getPublicKey()) {
          const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
          if (postId) newUserReposts.add(postId);
        }
      } catch (err) {
        console.error('Error processing user reposts:', err);
      }
    });
    
    setUserLikes(newUserLikes);
    setUserReposts(newUserReposts);
  }, [userLikes, userReposts]);

  // Helper function to apply RUNSTR filtering to posts (same logic as in nostr.js)
  const applyRunstrFilter = useCallback((posts, filterSourceToUse) => {
    if (!filterSourceToUse || filterSourceToUse.toUpperCase() !== 'RUNSTR') {
      return posts; // No filtering applied
    }

    return posts.filter(event => {
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
            // RUNSTR uses 'exercise' tag for running/cycling/walking
            if (tag[1]) {
              const activity = tag[1].toLowerCase();
              if (['running', 'cycling', 'walking', 'jogging'].includes(activity)) {
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
      
      // Add activity mode filter (same logic as useLeagueLeaderboard)
      if (isRunstrWorkout && activityMode) {
        const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
        const eventActivityType = exerciseTag?.[1]?.toLowerCase();
        
        // Skip events that don't match current activity mode
        if (!eventActivityType || eventActivityType !== activityMode) {
          return false;
        }
      }
      
      // Debug logging for rejected events
      if (!isRunstrWorkout && (hasRequiredTags.source || hasRequiredTags.client)) {
        console.log('[useRunFeed] Event has RUNSTR tags but missing signature:', {
          eventId: event.id,
          hasRunstrIdentification,
          hasRunstrStructure,
          missing: Object.entries(hasRequiredTags).filter(([key, value]) => !value).map(([key]) => key)
        });
      }
      
      return isRunstrWorkout;
    });
  }, [activityMode]);

  // Clear cache if filter source has changed
  useEffect(() => {
    if (globalState.lastFilterSource !== null && globalState.lastFilterSource !== filterSource) {
      console.log(`[useRunFeed] Filter source changed from '${globalState.lastFilterSource}' to '${filterSource}', clearing cache`);
      globalState.allPosts = [];
      globalState.lastFetchTime = 0;
      setAllPosts([]);
      setPosts([]);
    }
    globalState.lastFilterSource = filterSource;
  }, [filterSource]);

  // Clear cache when activity mode changes (similar to leaderboard)
  useEffect(() => {
    if (globalState.lastActivityMode !== null && globalState.lastActivityMode !== activityMode) {
      console.log(`[useRunFeed] Activity mode changed from '${globalState.lastActivityMode}' to '${activityMode}', clearing cache`);
      globalState.allPosts = [];
      globalState.lastFetchTime = 0;
      setAllPosts([]);
      setPosts([]);
    }
    globalState.lastActivityMode = activityMode;
  }, [activityMode]);

  // Auto-detect and clear potentially unfiltered cache
  useEffect(() => {
    const detectAndClearUnfilteredCache = () => {
      // If we're using RUNSTR filter and have cached posts, check if any are likely non-RUNSTR
      if (filterSource === 'RUNSTR' && globalState.allPosts.length > 0) {
        const suspiciousPosts = globalState.allPosts.filter(post => {
          // Check for posts that might be from other apps (like POWR strength workouts)
          const exerciseTag = post.tags?.find(tag => tag[0] === 'exercise');
          const hasStrengthActivity = exerciseTag && exerciseTag[1]?.toLowerCase().includes('strength');
          
          // Check for posts without RUNSTR identification
          const hasRunstrSource = post.tags?.some(tag => 
            (tag[0] === 'source' && tag[1]?.toUpperCase() === 'RUNSTR') ||
            (tag[0] === 'client' && tag[1]?.toLowerCase() === 'runstr')
          );
          
          return hasStrengthActivity || !hasRunstrSource;
        });
        
        if (suspiciousPosts.length > 0) {
          console.log(`[useRunFeed] Detected ${suspiciousPosts.length} potentially unfiltered posts in cache, clearing automatically`);
          globalState.allPosts = [];
          globalState.lastFetchTime = 0;
          globalState.lastFilterSource = null;
          setAllPosts([]);
          setPosts([]);
          return true; // Cache was cleared
        }
      }
      return false; // No cache clearing needed
    };

    // Run detection on mount if we have a filter
    if (filterSource) {
      detectAndClearUnfilteredCache();
    }
  }, []); // Run once on mount

  // Main function to fetch run posts
  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Ensure NDK ready first
      await awaitNDKReady();

      // Check if we have cached posts that are recent enough (less than 5 minutes old)
      const now = Date.now();
      const isCacheValid = globalState.allPosts.length > 0 && 
                        (now - globalState.lastFetchTime < 5 * 60 * 1000) &&
                        globalState.lastFilterSource === filterSource; // Ensure cache matches current filter
                        
      if (isCacheValid) {
        console.log('[useRunFeed] Using cached posts from global state');
        
        // Apply filtering to cached data as safety measure
        const filteredCachedPosts = applyRunstrFilter(globalState.allPosts, filterSource);
        
        if (filteredCachedPosts.length !== globalState.allPosts.length) {
          console.log(`[useRunFeed] Filtered cached data: ${globalState.allPosts.length} → ${filteredCachedPosts.length} posts`);
          // Update cache with filtered data
          globalState.allPosts = filteredCachedPosts;
        }
        
        setAllPosts(filteredCachedPosts);
        setPosts(filteredCachedPosts.slice(0, displayLimit));
        setLoading(false);
        
        // Still update in the background for freshness
        setupBackgroundFetch();
        return;
      }

      // Set timestamp for paginated loading
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
      const limit = 21; // Load 21 posts initially (3 pages worth)

      // Fetch posts with running hashtags
      const runPostsArray = await fetchRunningPosts(limit, since, filterSource);
      
      console.log(`[useRunFeed] Fetched ${runPostsArray.length} running posts (filterSource: ${filterSource})`);
      
      // QUICK-DISPLAY PHASE ─────────────────────────────────────────
      // Show minimally processed posts immediately (with filtering applied)
      if (runPostsArray.length > 0 && allPosts.length === 0) {
        const quickPosts = lightweightProcessPosts(runPostsArray, filterSource);
        setAllPosts(quickPosts);
        setPosts(quickPosts.slice(0, displayLimit));
        setLoading(false);
      }
      
      // If we didn't get enough posts, there may not be more to load
      if (runPostsArray.length < limit) {
        setHasMore(false);
      }
      
      // Skip processing if we didn't get any posts
      if (runPostsArray.length === 0) {
        if (page === 1) {
          setPosts([]);
          setAllPosts([]);
          setError('No running posts found. Try again later.');
        }
        setLoading(false);
        return;
      }
      
      // Load supplementary data in parallel for all posts
      const supplementaryData = await loadSupplementaryData(runPostsArray);
      
      // Process posts with all the data
      const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
      
      // Apply final filtering to processed posts
      const finalFilteredPosts = applyRunstrFilter(processedPosts, filterSource);
      
      if (finalFilteredPosts.length !== processedPosts.length) {
        console.log(`[useRunFeed] Filtered processed posts: ${processedPosts.length} → ${finalFilteredPosts.length} posts`);
      }
      
      // Merge with quick posts (if any) so we keep order
      const finalPosts = mergeProcessedPosts(
        allPosts.length ? allPosts : lightweightProcessPosts(runPostsArray, filterSource), 
        finalFilteredPosts
      );
      
      // Update global cache
      globalState.allPosts = finalPosts;
      globalState.lastFetchTime = now;
      globalState.lastFilterSource = filterSource;
      
      // Update state with processed posts
      if (page === 1) {
        setAllPosts(finalPosts);
        setPosts(finalPosts.slice(0, displayLimit)); // Only display up to the limit
      } else {
        // For pagination, append new posts, removing duplicates
        setAllPosts(prevPosts => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newPosts = finalPosts.filter(p => !existingIds.has(p.id));
          const mergedPosts = [...prevPosts, ...newPosts];
          
          // Apply filtering to merged posts
          const filteredMergedPosts = applyRunstrFilter(mergedPosts, filterSource);
          
          // Update global cache
          globalState.allPosts = filteredMergedPosts;
          
          return filteredMergedPosts;
        });
        // Update displayed posts
        setPosts(prevPosts => {
          const allPostsCombined = [...prevPosts, ...finalPosts];
          const uniquePosts = [];
          const seen = new Set();
          
          // Remove duplicates
          allPostsCombined.forEach(post => {
            if (!seen.has(post.id)) {
              seen.add(post.id);
              uniquePosts.push(post);
            }
          });
          
          // Apply filtering to unique posts
          const filteredUniquePosts = applyRunstrFilter(uniquePosts, filterSource);
          
          return filteredUniquePosts.slice(0, displayLimit); // Only display up to the limit
        });
      }
      
      // Update user interactions
      updateUserInteractions(supplementaryData);
      
      initialLoadRef.current = true;
      
      // Set up background fetch
      setupBackgroundFetch();
    } catch (err) {
      console.error('Error fetching running posts:', err);
      setError(`Failed to load posts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [page, displayLimit, updateUserInteractions, setupBackgroundFetch, filterSource, applyRunstrFilter]);

  // Load more posts function - increases the display limit
  const loadMorePosts = useCallback(() => {
    setDisplayLimit(prevLimit => prevLimit + 7); // Increase display limit by 7
  }, []);

  // Check if we can load more posts
  const canLoadMore = useCallback(() => {
    return allPosts.length > displayLimit;
  }, [allPosts.length, displayLimit]);

  // Load next page of posts from the network
  const loadNextPage = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  // Force clear cache and refresh - useful for debugging or manual refresh
  const clearCacheAndRefresh = useCallback(() => {
    console.log('[useRunFeed] Manually clearing cache and forcing refresh');
    globalState.allPosts = [];
    globalState.lastFetchTime = 0;
    globalState.lastFilterSource = null;
    setAllPosts([]);
    setPosts([]);
    setPage(1);
    setDisplayLimit(7);
    setLoading(true);
    fetchRunPostsViaSubscription();
  }, [fetchRunPostsViaSubscription]);

  // Initial load / remount logic
  useEffect(() => {
    const runFirstLoad = async () => {
      // If we already have posts cached globally, hydrate state immediately
      if (globalState.allPosts && globalState.allPosts.length > 0) {
        setAllPosts(globalState.allPosts);
        setPosts(globalState.allPosts.slice(0, displayLimit));
        setLoading(false);

        // Kick off a silent background refresh so content stays fresh
        setupBackgroundFetch();
      }

      // Only re-fetch from the network if we haven't fetched yet this session
      if (!initialLoadRef.current) {
        await fetchRunPostsViaSubscription();
      }
    };

    runFirstLoad();

    // Cleanup when component unmounts
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [fetchRunPostsViaSubscription, displayLimit, setupBackgroundFetch]);

  // Update displayed posts when displayLimit changes
  useEffect(() => {
    if (allPosts.length > 0) {
      setPosts(allPosts.slice(0, displayLimit));
    }
    
    // If we're showing all available posts but there might be more on the server
    if (allPosts.length <= displayLimit && hasMore && !loading) {
      loadNextPage();
    }
  }, [displayLimit, allPosts, hasMore, loading, loadNextPage]);

  // Handle comment click to toggle comment visibility
  const handleCommentClick = async (postId) => {
    setPosts(prevPosts => {
      return prevPosts.map(post => {
        if (post.id === postId) {
          // If comments aren't loaded yet, load them first
          if (!post.commentsLoaded) {
            // This would be implemented to fetch comments from Nostr
            console.log('Loading comments for post', postId);
            
            // In a real implementation, you would fetch comments here
            loadSupplementaryData([postId], 'comments')
              .then(commentData => {
                // Mark this post as having had its supplementary data loaded
                setLoadedSupplementaryData(prev => new Set([...prev, postId]));
                
                // Update posts with the loaded comments
                setPosts(latestPosts => {
                  return latestPosts.map(p => {
                    if (p.id === postId) {
                      // Get comments from the response
                      let postComments = [];
                      
                      // Check both formats of response for backward compatibility
                      if (commentData[postId]) {
                        // New format with postId keys
                        postComments = commentData[postId];
                      } else if (commentData.comments && commentData.comments.size > 0) {
                        // Original format with Set of comments
                        const commentsArray = Array.from(commentData.comments);
                        
                        // Process comments into the expected format
                        postComments = commentsArray
                          .filter(comment => {
                            // Filter for comments that are replies to this post
                            const eTag = comment.tags?.find(tag => tag[0] === 'e');
                            return eTag && eTag[1] === postId;
                          })
                          .map(comment => ({
                            id: comment.id || `comment-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                            content: comment.content || '',
                            created_at: comment.created_at || Math.floor(Date.now() / 1000),
                            author: {
                              pubkey: comment.pubkey || '',
                              profile: {
                                name: 'Anonymous',
                                picture: undefined
                              }
                            }
                          }));
                      }
                      
                      // Mark comments as loaded and add fetched comments
                      return { 
                        ...p, 
                        commentsLoaded: true,
                        // Use the processed comments, or fallback to existing comments
                        comments: postComments.length > 0 ? postComments : p.comments || []
                      };
                    }
                    return p;
                  });
                });
              })
              .catch(error => {
                console.error('Error loading comments:', error);
                // Even if comments fail to load, mark as loaded to prevent infinite retries
                setPosts(latestPosts => {
                  return latestPosts.map(p => {
                    if (p.id === postId) {
                      return { 
                        ...p, 
                        commentsLoaded: true,
                        comments: p.comments || [] 
                      };
                    }
                    return p;
                  });
                });
              });
          }
          
          // Toggle comment visibility
          return { ...post, showComments: !post.showComments };
        }
        return post;
      });
    });
    
    // Return a promise that resolves when comments are loaded
    return new Promise(resolve => {
      // In a real implementation, this would resolve when comments are fetched
      setTimeout(resolve, 1500);
    });
  };

  /**
   * Auto-enrich feed posts with author profiles using the same
   * useProfileCache mechanism that already works in ChatRoom.
   * Falls back to the previous HTTP aggregator later in the pipeline,
   * so this change only adds a faster, relay-based path.
   */
  useEffect(() => {
    // Collect pubkeys still unresolved
    const unresolved = posts
      .filter(p => p?.author?.pubkey && (!p.author.profile?.name || p.author.profile.name === 'Loading…'))
      .map(p => p.author.pubkey)
      .filter(pk => !fetchedProfilesRef.current.has(pk));

    if (unresolved.length === 0) return;

    unresolved.forEach(pk => fetchedProfilesRef.current.add(pk));

    const run = async () => {
      try {
        await ensureRelays([]); // Ensure sockets ready
        const profiles = await fetchProfiles(unresolved);

        if (profiles.size === 0) return;

        setPosts(prev => prev.map(p => {
          const prof = profiles.get(p.author?.pubkey);
          return prof ? { ...p, author: { ...p.author, profile: { ...p.author.profile, ...prof }, needsProfile: false } } : p;
        }));

        // Keep global cache in sync so other feeds/components benefit
        globalState.allPosts = globalState.allPosts.map(p => {
          const prof = profiles.get(p.author?.pubkey);
          return prof ? { ...p, author: { ...p.author, profile: { ...p.author.profile, ...prof }, needsProfile: false } } : p;
        });
      } catch (err) {
        console.warn('Feed profile enrichment (relay path) failed', err);
      }
    };

    run();
  }, [posts, fetchProfiles]);

  // --- Central Feed Manager integration ----
  useEffect(() => {
    // Ensure the manager is running (no-op if already started)
    startFeed();
    // Subscribe for updates
    const unsub = subscribeFeed((newPosts) => {
      setPosts(newPosts);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Add effect after posts state updates
  useEffect(() => {
    if (posts.length === 0) return;
    // Start reaction subscription once
    if (reactionSubRef.current) return;
    const ids = posts.map(p => p.id);
    try {
      const sub = ndk.subscribe({ kinds: [7,6,9735,1], '#e': ids, since: Math.floor(Date.now()/1000) - 14*24*3600 }, { closeOnEose:false });
      reactionSubRef.current = sub;
      sub.on('event', (ev) => {
        const postId = getEventTargetId(ev);
        if (!postId) return;
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          // duplicate check
          switch(ev.kind){
            case 7: {
              let set = reactionSetsRef.current.likes.get(postId);
              if(!set){ set=new Set(); reactionSetsRef.current.likes.set(postId,set);} 
              if(set.has(ev.id)) return p;
              set.add(ev.id);
              return { ...p, likes: (p.likes||0)+1 };
            }
            case 6: {
              let set = reactionSetsRef.current.reposts.get(postId);
              if(!set){ set=new Set(); reactionSetsRef.current.reposts.set(postId,set);} 
              if(set.has(ev.id)) return p;
              set.add(ev.id);
              return { ...p, reposts: (p.reposts||0)+1 };
            }
            case 9735:{
              let store = reactionSetsRef.current.zaps.get(postId);
              if(!store){ store={ids:new Set(), amount:0}; reactionSetsRef.current.zaps.set(postId,store);} 
              if(store.ids.has(ev.id)) return p;
              store.ids.add(ev.id);
              // amount parse
              let amount=0;
              const amtTag = ev.tags.find(t=>t[0]==='amount');
              if(amtTag && amtTag[1]){ const val=parseInt(amtTag[1],10); if(!isNaN(val)) amount = val/1000; }
              store.amount += amount;
              return { ...p, zaps: (p.zaps||0)+1, zapAmount: (p.zapAmount||0)+amount };
            }
            case 1: {
              // comment
              let set = reactionSetsRef.current.comments.get(postId);
              if(!set){ set=new Set(); reactionSetsRef.current.comments.set(postId,set);} 
              if(set.has(ev.id)) return p;
              set.add(ev.id);
              const newComment = { id: ev.id, content: ev.content, created_at: ev.created_at, author:{pubkey: ev.pubkey, profile:{}} };
              return { ...p, comments: [...p.comments, newComment] };
            }
            default: return p;
          }
        }));
      });
    }catch(err){ console.warn('Reaction subscription failed', err);} 
    return () => { if(reactionSubRef.current){reactionSubRef.current.stop(); reactionSubRef.current=null;} };
  }, [posts]);

  return {
    posts,
    setPosts,
    loading,
    error,
    userLikes,
    setUserLikes,
    userReposts,
    setUserReposts,
    loadSupplementaryData,
    loadMorePosts,
    fetchRunPostsViaSubscription,
    loadedSupplementaryData,
    canLoadMore,
    handleCommentClick,
    clearCacheAndRefresh
  };
};

export default useRunFeed; 