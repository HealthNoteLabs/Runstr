import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  initializeNostr, 
  fetchRunningPosts, 
  loadSupplementaryData, 
  processPostsWithData,
  searchRunningContent
} from '../utils/nostr';

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const [displayLimit, setDisplayLimit] = useState(7); // New state for display limit
  const [allPosts, setAllPosts] = useState([]); // Store all fetched posts
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(false);

  // Main function to fetch run posts
  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Initialize Nostr first
      await initializeNostr();

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
          
          // Update state with all processed posts, but only display up to the limit
          setAllPosts(processedPosts);
          setPosts(processedPosts.slice(0, displayLimit));
          
          // Capture which posts the user has liked/reposted
          const newUserLikes = new Set();
          const newUserReposts = new Set();
          
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
          
          setHasMore(contentPosts.length >= limit);
          setLoading(false);
          initialLoadRef.current = true;
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
      
      // Update state with processed posts
      if (page === 1) {
        setAllPosts(processedPosts);
        setPosts(processedPosts.slice(0, displayLimit)); // Only display up to the limit
      } else {
        // For pagination, append new posts, removing duplicates
        setAllPosts(prevPosts => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
          return [...prevPosts, ...newPosts];
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
      
      // Capture which posts the user has liked/reposted
      const newUserLikes = new Set();
      const newUserReposts = new Set();
      
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
      
      initialLoadRef.current = true;
    } catch (err) {
      console.error('Error fetching running posts:', err);
      setError(`Failed to load posts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [page, displayLimit]);

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

  // Initial load
  useEffect(() => {
    if (!initialLoadRef.current) {
      fetchRunPostsViaSubscription();
    }
  }, [fetchRunPostsViaSubscription]);

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
    handleCommentClick
  };
}; 