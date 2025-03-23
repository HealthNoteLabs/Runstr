import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchEvents, subscribe } from '../utils/nostr';

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const activeSubscription = useRef(null);
  const timeoutRef = useRef(null);

  // Simple processing of post data
  const processPostData = useCallback(async (newPosts) => {
    try {
      if (!newPosts || newPosts.length === 0) {
        return [];
      }

      console.log('Processing post data:', newPosts.length, 'posts');
      
      // Get unique authors
      const authors = [...new Set(newPosts.map((post) => post.pubkey))];
      
      // Fetch author profiles in a single request
      const profileEvents = await fetchEvents({
        kinds: [0],
        authors: authors,
        limit: authors.length
      });

      // Create a map of author profiles
      const profileMap = new Map(
        profileEvents.map((profile) => {
          try {
            return [profile.pubkey, JSON.parse(profile.content)];
          } catch (err) {
            console.error('Error parsing profile:', err);
            return [profile.pubkey, {}];
          }
        })
      );

      // Format posts with author profiles
      return newPosts
        .map((post) => {
          const profile = profileMap.get(post.pubkey) || {};
          
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
            comments: [],
            showComments: false,
            likes: 0,
            reposts: 0,
            zaps: 0,
            zapAmount: 0,
            hasFullData: false
          };
        })
        .sort((a, b) => b.created_at - a.created_at);
    } catch (err) {
      console.error('Error processing post data:', err);
      // Fallback to basic processing
      return newPosts.map(post => ({
        id: post.id,
        content: post.content,
        created_at: post.created_at,
        author: {
          pubkey: post.pubkey,
          profile: {}
        },
        comments: [],
        showComments: false,
        likes: 0,
        reposts: 0,
        zaps: 0,
        zapAmount: 0,
        hasFullData: false
      })).sort((a, b) => b.created_at - a.created_at);
    }
  }, []);

  // Load supplementary data (likes, reposts, etc.)
  const loadSupplementaryData = useCallback(async (postId) => {
    if (loadedSupplementaryData.has(postId)) {
      return;
    }

    console.log('Loading supplementary data for post:', postId);
    setLoadedSupplementaryData(prev => new Set([...prev, postId]));

    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    
    const post = posts[postIndex];
    
    try {
      // Fetch comments, likes and reposts
      const [comments, likes, reposts] = await Promise.all([
        fetchEvents({
          kinds: [1],
          '#e': [postId],
          limit: 20
        }),
        fetchEvents({
          kinds: [7],
          '#e': [postId],
          limit: 50
        }),
        fetchEvents({
          kinds: [6],
          '#e': [postId],
          limit: 30
        })
      ]);

      // Get comment author profiles
      const commentAuthors = [...new Set(comments.map(c => c.pubkey))];
      const commentProfiles = commentAuthors.length > 0 ? 
        await fetchEvents({
          kinds: [0],
          authors: commentAuthors,
          limit: commentAuthors.length
        }) : [];

      // Create profile map
      const profileMap = new Map(
        commentProfiles.map((profile) => {
          try {
            return [profile.pubkey, JSON.parse(profile.content)];
          } catch (err) {
            console.error('Error parsing profile:', err);
            return [profile.pubkey, {}];
          }
        })
      );

      // Process comments
      const processedComments = comments
        .map((comment) => {
          const profile = profileMap.get(comment.pubkey) || {};
          return {
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            author: {
              pubkey: comment.pubkey,
              profile: profile
            }
          };
        })
        .sort((a, b) => a.created_at - b.created_at);

      // Update post with supplementary data
      const updatedPost = {
        ...post,
        comments: processedComments,
        likes: likes.length,
        reposts: reposts.length,
        hasFullData: true
      };

      setPosts(currentPosts => {
        const newPosts = [...currentPosts];
        newPosts[postIndex] = updatedPost;
        return newPosts;
      });
    } catch (error) {
      console.error('Error loading supplementary data:', error);
      // Don't set error state for supplementary data
    }
  }, [posts, loadedSupplementaryData]);

  // Fetch running-related posts
  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      console.log('Starting RunClub feed subscription');
      setLoading(true);
      setError(null);
      
      // Clean up any existing subscription
      if (activeSubscription.current) {
        console.log('Cleaning up previous subscription');
        activeSubscription.current.stop();
        activeSubscription.current = null;
      }
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Set time window - last 30 days for first page, longer for older pages
      const timeWindow = page > 1 ? (page * 30 * 24 * 60 * 60) : (30 * 24 * 60 * 60);
      const since = Math.floor(Date.now() / 1000) - timeWindow;
      
      console.log('Creating subscription for running posts since', new Date(since * 1000).toISOString());
      
      // First try direct fetch with broader tags for initial load
      try {
        console.log('Attempting direct fetch first...');
        
        const directEvents = await fetchEvents({
          kinds: [1],
          since,
          "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon"],
          limit: 40
        });
        
        if (directEvents && directEvents.length > 0) {
          console.log(`Direct fetch successful, got ${directEvents.length} posts`);
          const processedPosts = await processPostData(directEvents);
          setPosts(processedPosts);
          setLoading(false);
          
          // Continue with subscription for real-time updates
        } else {
          console.log('Direct fetch returned no events, trying broader search...');
        }
      } catch (error) {
        console.warn('Direct fetch failed:', error);
        // Continue with subscription approach
      }
      
      // Collect events
      const runEventsCollector = [];
      
      // Create subscription for running-related posts
      const subscription = subscribe({
        kinds: [1],
        since,
        "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon", "jog", "jogging", "fitness", "workout", "training", "strava", "race"],
        limit: 50
      });
      
      activeSubscription.current = subscription;
      
      subscription.on('event', (event) => {
        runEventsCollector.push(event);
      });
      
      subscription.on('eose', async () => {
        console.log(`End of stored events received, got ${runEventsCollector.length} running posts`);
        
        if (runEventsCollector.length === 0) {
          // If no posts found with tags, try a broader search with content filtering
          console.log('No tagged running posts found, trying content search');
          setError(null);
          
          try {
            const broadEvents = await fetchEvents({
              kinds: [1],
              since,
              limit: 100
            });
            
            // Filter for running-related content
            const runningTerms = ['run', 'running', 'marathon', 'jog', '5k', '10k', 'strava', 'workout', 'training'];
            const filteredEvents = broadEvents.filter(event => {
              const content = event.content.toLowerCase();
              return runningTerms.some(term => content.includes(term));
            });
            
            if (filteredEvents.length > 0) {
              console.log(`Found ${filteredEvents.length} running-related posts by content`);
              const processedPosts = await processPostData(filteredEvents);
              setPosts(processedPosts);
              setLoading(false);
              return;
            } else {
              setError('No running posts found. Please try again later.');
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error('Error in broad search:', error);
            setError('Failed to load posts. Please try again.');
            setLoading(false);
            return;
          }
        }
        
        // Process collected events
        const processedPosts = await processPostData(runEventsCollector);
        
        // Update hasMore based on number of posts received
        if (runEventsCollector.length < 30) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (page === 1) {
          setPosts(processedPosts);
        } else {
          setPosts(prevPosts => {
            // Filter out duplicates
            const existingIds = new Set(prevPosts.map(p => p.id));
            const newUniqueEvents = processedPosts.filter(p => !existingIds.has(p.id));
            return [...prevPosts, ...newUniqueEvents];
          });
        }
        
        setLoading(false);
      });
      
      // Set timeout for subscription
      timeoutRef.current = setTimeout(() => {
        if (activeSubscription.current) {
          console.log('Subscription timeout reached');
          activeSubscription.current.stop();
          
          if (runEventsCollector.length > 0) {
            // Process what we have
            processPostData(runEventsCollector).then(processedPosts => {
              setPosts(processedPosts);
              setLoading(false);
            });
          } else {
            // Attempt one final direct fetch without tags
            fetchEvents({
              kinds: [1],
              since,
              limit: 50
            }).then(directEvents => {
              if (directEvents && directEvents.length > 0) {
                // Filter for running-related content
                const runningTerms = ['run', 'running', 'marathon', 'jog', '5k', '10k', 'strava', 'workout', 'training'];
                const filteredEvents = directEvents.filter(event => {
                  const content = event.content.toLowerCase();
                  return runningTerms.some(term => content.includes(term));
                });
                
                if (filteredEvents.length > 0) {
                  processPostData(filteredEvents).then(processedPosts => {
                    setPosts(processedPosts);
                    setLoading(false);
                  });
                  return;
                }
              }
              
              setError('Timed out waiting for posts. Please try again.');
              setLoading(false);
            }).catch(() => {
              setError('Timed out waiting for posts. Please try again.');
              setLoading(false);
            });
          }
        }
      }, 20000);
      
    } catch (err) {
      console.error('Error fetching running posts:', err);
      setError(`Failed to load posts. Please try again.`);
      setLoading(false);
    }
  }, [page, processPostData]);

  // Load more posts
  const loadMorePosts = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  // Initialize
  useEffect(() => {
    fetchRunPostsViaSubscription();
    
    return () => {
      // Clean up on unmount
      if (activeSubscription.current) {
        activeSubscription.current.stop();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchRunPostsViaSubscription, page]);
  
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
    hasMore,
    setPage,
    fetchRunPostsViaSubscription,
    loadedSupplementaryData
  };
}; 