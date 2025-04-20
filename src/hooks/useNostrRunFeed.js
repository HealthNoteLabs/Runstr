import { useState, useEffect } from 'react';
import { fetchEvents, subscribeToEvents } from '../utils/nostr';
import { RUNNING_FOCUSED_RELAYS } from '../config/relays';

/**
 * Hook to fetch and subscribe to run feed from Nostr
 * @param {string[]} tags - Tags to filter posts by
 * @param {number} limit - Maximum number of posts to fetch
 * @returns {Object} - Posts, loading state, and error
 */
export const useNostrRunFeed = (tags = ['Runstr', 'Running'], limit = 20) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    
    // Initial fetch of existing posts
    const fetchPosts = async () => {
      try {
        const events = await fetchEvents({
          kinds: [1], // Text note kind
          '#t': tags,  // Tag filter
          limit
        });
        
        // Sort by created_at, newest first
        const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
        setPosts(sortedEvents);
      } catch (err) {
        console.error('Error fetching run feed:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPosts();
    
    // Subscribe to new posts
    const subscription = subscribeToEvents({
      kinds: [1],
      '#t': tags,
      since: Math.floor(Date.now() / 1000) // Subscribe only to new events
    }, (event) => {
      // Add new event to posts array (if not already there)
      setPosts(prevPosts => {
        if (prevPosts.some(p => p.id === event.id)) return prevPosts;
        return [event, ...prevPosts].sort((a, b) => b.created_at - a.created_at);
      });
    });
    
    return () => {
      // Clean up subscription
      subscription.unsubscribe();
    };
  }, [tags.join(), limit]); // Dependency array includes stringified tags and limit
  
  /**
   * Refresh posts from the Nostr network
   */
  const refreshPosts = async () => {
    setLoading(true);
    
    try {
      const events = await fetchEvents({
        kinds: [1],
        '#t': tags,
        limit
      }, RUNNING_FOCUSED_RELAYS);
      
      // Sort by created_at, newest first
      const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
      setPosts(sortedEvents);
    } catch (err) {
      console.error('Error refreshing run feed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  
  return { 
    posts, 
    loading, 
    error,
    refreshPosts
  };
}; 