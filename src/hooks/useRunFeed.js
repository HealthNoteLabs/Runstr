import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { 
  initializeNostr, 
  fetchRunningPosts, 
  loadSupplementaryData, 
  processPostsWithData,
  searchRunningContent,
  fetchEvents
} from '../utils/nostr';
import { NostrContext } from '../contexts/NostrContext';
import { RUNNING_FOCUSED_RELAYS } from '../config/relays';

// Global state for caching posts across component instances
const globalState = {
  allPosts: [],
  lastFetchTime: 0,
  isInitialized: false,
  activeSubscription: null,
};

/**
 * Hook to fetch and subscribe to run feed from Nostr
 * @param {string[]} tags - Tags to filter posts by
 */
export const useRunFeed = () => {
  const { publicKey } = useContext(NostrContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // New state for pull-to-refresh
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const [displayLimit, setDisplayLimit] = useState(7); // Number of posts to display initially
  const [allPosts, setAllPosts] = useState(globalState.allPosts || []); // Use global cache
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(globalState.isInitialized);
  const loadingMoreRef = useRef(false); // Track if we're already loading more posts

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

  // Function to setup background fetches
  const setupBackgroundFetch = useCallback(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set up a background fetch every 3 minutes
    timeoutRef.current = setTimeout(() => {
      console.log('Running background fetch...');
      fetchRunPostsViaSubscription();
    }, 3 * 60 * 1000);
  }, []);

  // Extract user interactions logic to reuse
  const updateUserInteractions = useCallback((supplementaryData) => {
    const newUserLikes = new Set([...userLikes]);
    const newUserReposts = new Set([...userReposts]);
    
    if (publicKey) {
      supplementaryData.likes?.forEach(like => {
        try {
          if (like.pubkey === publicKey) {
            const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
            if (postId) newUserLikes.add(postId);
          }
        } catch (err) {
          console.error('Error processing user likes:', err);
        }
      });
      
      supplementaryData.reposts?.forEach(repost => {
        try {
          if (repost.pubkey === publicKey) {
            const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
            if (postId) newUserReposts.add(postId);
          }
        } catch (err) {
          console.error('Error processing user reposts:', err);
        }
      });
    }
    
    setUserLikes(newUserLikes);
    setUserReposts(newUserReposts);
  }, [userLikes, userReposts, publicKey]);

  // Main function to fetch run posts
  const fetchRunPostsViaSubscription = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Initialize Nostr first
      await initializeNostr();

      // For a refresh, bypass the cache
      const now = Date.now();
      const isCacheValid = !isRefresh && globalState.allPosts.length > 0 && 
                        (now - globalState.lastFetchTime < 5 * 60 * 1000);
                        
      if (isCacheValid) {
        console.log('Using cached posts from global state');
        setAllPosts(globalState.allPosts);
        setPosts(globalState.allPosts.slice(0, displayLimit));
        setLoading(false);
        setRefreshing(false);
        
        // Still update in the background for freshness
        setupBackgroundFetch();
        return;
      }

      // Set timestamp for paginated loading
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
      const limit = 21; // Load 21 posts initially (3 pages worth)

      // Fetch posts with running hashtags
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
          setRefreshing(false);
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
        setRefreshing(false);
        return;
      }
      
      // Load supplementary data in parallel for all posts
      const supplementaryData = await loadSupplementaryData(runPostsArray);
      
      // Process posts with all the data
      const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
      
      // Update global cache if this is a fresh load or refresh (not for pagination)
      if (page === 1 || isRefresh) {
        globalState.allPosts = processedPosts;
        globalState.lastFetchTime = now;
      }
      
      // Update state with processed posts
      if (page === 1 || isRefresh) {
        setAllPosts(processedPosts);
        setPosts(processedPosts.slice(0, displayLimit)); // Only display up to the limit
      } else {
        // For pagination, append new posts, removing duplicates
        setAllPosts(prevPosts => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
          const mergedPosts = [...prevPosts, ...newPosts];
          
          // Update global cache with merged posts
          if (newPosts.length > 0) {
            globalState.allPosts = mergedPosts;
          }
          
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
          
          return uniquePosts.slice(0, displayLimit + (page - 1) * 7); // Only display up to the expanded limit
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
      setRefreshing(false);
      loadingMoreRef.current = false;
    }
  }, [page, displayLimit, updateUserInteractions, setupBackgroundFetch]);

  // Load more posts by increasing the display limit
  const loadMorePosts = useCallback(() => {
    if (loadingMoreRef.current || loading || refreshing) return;
    
    // If we've already shown all cached posts and there might be more on the server
    if (allPosts.length <= displayLimit) {
      if (hasMore && !loading) {
        loadingMoreRef.current = true;
        // Load the next page from the server
        setPage(prevPage => prevPage + 1);
      }
    } else {
      // Just show more from the cache
      setDisplayLimit(prevLimit => prevLimit + 7);
    }
  }, [allPosts.length, displayLimit, hasMore, loading, refreshing]);

  // Function for pull-to-refresh
  const refreshFeed = useCallback(() => {
    if (refreshing || loading) return;
    console.log('Refreshing feed...');
    // Reset to page 1 for a fresh load
    setPage(1);
    fetchRunPostsViaSubscription(true);
  }, [fetchRunPostsViaSubscription, refreshing, loading]);

  // Check if we can load more posts
  const canLoadMore = useCallback(() => {
    return (allPosts.length > displayLimit) || hasMore;
  }, [allPosts.length, displayLimit, hasMore]);

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

  // Update displayed posts when displayLimit changes
  useEffect(() => {
    if (allPosts.length > 0) {
      setPosts(allPosts.slice(0, displayLimit));
    }
  }, [displayLimit, allPosts]);

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
                      // Mark comments as loaded and add fetched comments
                      return { 
                        ...p, 
                        commentsLoaded: true,
                        // Use the comment data from the response, or fallback to existing comments
                        comments: commentData?.[postId] || p.comments || []
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

  return {
    posts,
    setPosts,
    loading,
    refreshing,
    error,
    userLikes,
    setUserLikes,
    userReposts,
    setUserReposts,
    loadSupplementaryData,
    loadMorePosts,
    refreshFeed,
    fetchRunPostsViaSubscription,
    loadedSupplementaryData,
    canLoadMore,
    handleCommentClick
  };
}; 