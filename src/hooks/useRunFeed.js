import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  initializeNostr, 
  fetchRunningPosts, 
  loadSupplementaryData, 
  processPostsWithData,
  searchRunningContent
} from '../utils/nostr';

// Global state for caching posts across component instances
const globalState = {
  allPosts: [],
  lastFetchTime: 0,
  isInitialized: false,
  activeSubscription: null,
};

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData] = useState(new Set());
  const [displayLimit, setDisplayLimit] = useState(7); // For pagination
  const [allPosts, setAllPosts] = useState(globalState.allPosts || []); // Use global cache
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Track pagination loading state
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(globalState.isInitialized);
  const subscriptionRef = useRef(null);
  const backgroundFetchTimeRef = useRef(null);

  // Initialize Nostr as soon as the hook is used, even if component isn't visible
  useEffect(() => {
    const initNostr = async () => {
      // Only initialize once
      if (!globalState.isInitialized) {
        await initializeNostr();
        globalState.isInitialized = true;
      }
    };
    
    initNostr();
  }, []);

  // Setup background fetch for auto-refresh
  const setupBackgroundFetch = useCallback(() => {
    // Clear any existing timer
    if (timeoutRef.current) {
      clearInterval(timeoutRef.current);
    }
    
    // Set up periodic background fetch (every 60 seconds)
    timeoutRef.current = setInterval(async () => {
      try {
        // Only fetch if last fetch was > 30 seconds ago to avoid redundant fetches
        const now = Date.now();
        if (backgroundFetchTimeRef.current && now - backgroundFetchTimeRef.current < 30000) {
          console.log('Skipping background fetch, too soon since last fetch');
          return;
        }
        
        backgroundFetchTimeRef.current = now;
        console.log('Background fetch: checking for new posts...');
        
        // Fetch latest posts
        const limit = 10; // Smaller limit for background fetch
        const runPostsArray = await fetchRunningPosts(limit);
        
        if (runPostsArray.length === 0) {
          console.log('No new posts found in background fetch');
          return;
        }
        
        // Check if we already have these posts
        const existingIds = new Set(globalState.allPosts.map(p => p.id));
        const newPosts = runPostsArray.filter(p => !existingIds.has(p.id));
        
        if (newPosts.length === 0) {
          console.log('All posts from background fetch already in feed');
          return;
        }
        
        console.log(`Found ${newPosts.length} new posts in background fetch`);
        
        // Load supplementary data efficiently
        const supplementaryData = await loadSupplementaryData(newPosts);
        
        // Process posts with all the data
        const processedPosts = await processPostsWithData(newPosts, supplementaryData);
        
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
    }, 60000); // Check every minute
    
    // Store reference to cleanup
    subscriptionRef.current = timeoutRef.current;
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [displayLimit]);

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

  // Main function to fetch run posts - optimized version
  const fetchRunPostsViaSubscription = useCallback(async (isRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Initialize Nostr first
      await initializeNostr();

      // Check if we have cached posts that are recent enough (less than 5 minutes old)
      const now = Date.now();
      const isCacheValid = !isRefresh && 
                           globalState.allPosts.length > 0 && 
                           (now - globalState.lastFetchTime < 5 * 60 * 1000);
      
      if (isCacheValid) {
        console.log('Using cached posts from global state');
        setAllPosts(globalState.allPosts);
        setPosts(globalState.allPosts.slice(0, displayLimit));
        setLoading(false);
        
        // Still update in the background for freshness
        setupBackgroundFetch();
        return;
      }

      // Set timestamp for paginated loading
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
      const limit = 20; // Default batch size
      
      console.log(`Fetching posts with page ${page}, since ${since ? new Date(since).toISOString() : 'now'}`);

      // Fetch posts with running hashtags - use optimized function that now focuses on #runstr
      const runPostsArray = await fetchRunningPosts(limit, since);
      
      console.log(`Fetched ${runPostsArray.length} running posts`);
      
      // If we got no results with tags, try a content search as fallback
      if (runPostsArray.length === 0 && page === 1) {
        console.log('No tagged running posts found, trying content search');
        const contentPosts = await searchRunningContent(limit, 72); // 72 hours
        
        if (contentPosts.length > 0) {
          console.log(`Found ${contentPosts.length} posts through content search`);
          
          // Load supplementary data in parallel for all posts
          const supplementaryData = await loadSupplementaryData(contentPosts);
          
          // Process posts with all the data
          const processedPosts = await processPostsWithData(contentPosts, supplementaryData);
          
          // Update global cache
          globalState.allPosts = processedPosts;
          globalState.lastFetchTime = now;
          
          // Update state with all processed posts, but only display up to the limit
          setAllPosts(processedPosts);
          setPosts(processedPosts.slice(0, displayLimit));
          
          // Update user interactions
          updateUserInteractions(supplementaryData);
          
          setHasMore(contentPosts.length >= limit);
          setLoading(false);
          initialLoadRef.current = true;
          
          // Set up background fetch
          setupBackgroundFetch();
          return;
        }
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
      
      // Update global cache
      if (isRefresh || page === 1) {
        globalState.allPosts = processedPosts;
      } else {
        // For pagination, append new posts, removing duplicates
        const existingIds = new Set(globalState.allPosts.map(p => p.id));
        const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
        globalState.allPosts = [...globalState.allPosts, ...newPosts];
      }
      
      globalState.lastFetchTime = now;
      
      // Update state with processed posts
      if (isRefresh || page === 1) {
        setAllPosts(processedPosts);
        setPosts(processedPosts.slice(0, displayLimit)); // Only display up to the limit
      } else {
        // For pagination, append new posts, removing duplicates
        setAllPosts(prevPosts => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
          const mergedPosts = [...prevPosts, ...newPosts];
          return mergedPosts;
        });
        
        // Update displayed posts
        setPosts(prevPosts => {
          const allPostsCombined = [...prevPosts, ...processedPosts];
          const uniquePosts = [];
          const seen = new Set();
          
          // Remove duplicates
          allPostsCombined.forEach(post => {
            if (!seen.has(post.id)) {
              seen.add(post.id);
              uniquePosts.push(post);
            }
          });
          
          return uniquePosts.slice(0, displayLimit); // Only display up to the limit
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
      setIsFetchingMore(false);
    }
  }, [page, displayLimit, updateUserInteractions, setupBackgroundFetch]);

  // Refresh feed function
  const refreshFeed = useCallback(() => {
    // Reset page to 1 and refetch
    setPage(1);
    return fetchRunPostsViaSubscription(true);
  }, [fetchRunPostsViaSubscription]);

  // Load more posts function - increases the display limit
  const loadMorePosts = useCallback(() => {
    if (isFetchingMore) return; // Prevent multiple simultaneous loads
    
    // If we've already loaded all available posts but there might be more on the server
    if (allPosts.length <= displayLimit + 7 && hasMore) {
      setIsFetchingMore(true);
      setPage(prevPage => prevPage + 1);
    } else {
      // Otherwise just show more of what we already have
      setDisplayLimit(prevLimit => prevLimit + 7); // Increase display limit by 7
    }
  }, [allPosts.length, displayLimit, hasMore, isFetchingMore]);

  // Check if we can load more posts
  const canLoadMore = useCallback(() => {
    return (allPosts.length > displayLimit) || // Either we have more posts loaded than we're showing
           (hasMore && !isFetchingMore);       // Or there are more posts on the server and we're not currently fetching
  }, [allPosts.length, displayLimit, hasMore, isFetchingMore]);

  // Initial load
  useEffect(() => {
    if (!initialLoadRef.current) {
      fetchRunPostsViaSubscription();
    }
    
    // Cleanup function when component unmounts
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [fetchRunPostsViaSubscription]);

  // Effect for page changes (load more data when page changes)
  useEffect(() => {
    if (page > 1) {
      fetchRunPostsViaSubscription();
    }
  }, [page, fetchRunPostsViaSubscription]);

  // Update displayed posts when displayLimit changes
  useEffect(() => {
    if (allPosts.length > 0) {
      setPosts(allPosts.slice(0, displayLimit));
    }
  }, [displayLimit, allPosts]);

  // Handle clicking on comments icon
  const handleCommentClick = useCallback((postId) => {
    setPosts(currentPosts => {
      return currentPosts.map(post => {
        if (post.id === postId) {
          return { ...post, showComments: !post.showComments };
        }
        return post;
      });
    });
  }, []);

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
    refreshFeed,
    loadedSupplementaryData,
    canLoadMore,
    handleCommentClick,
    isFetchingMore
  };
}; 