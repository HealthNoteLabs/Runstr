import { useState } from 'react';
import { createAndPublishEvent } from '../utils/nostr';

/**
 * Hook for handling post interactions (likes, replies)
 * @returns {Object} Functions and state for post interactions
 */
export const usePostInteractions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Like a post by creating a reaction event
   * @param {Object} event - Nostr event to like
   * @returns {Promise<boolean>} Success status
   */
  const likePost = async (event) => {
    setLoading(true);
    setError(null);
    
    try {
      // Create a reaction event (kind 7)
      const reactionEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id], // Reference to the original event
          ['p', event.pubkey] // Reference to the author's pubkey
        ],
        content: '+' // Like reaction
      };
      
      // Publish the reaction
      await createAndPublishEvent(reactionEvent);
      
      // Show toast on Android if available
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Liked post!');
      }
      
      return true;
    } catch (err) {
      console.error('Error liking post:', err);
      setError(err);
      
      // Show error toast on Android if available
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to like post: ' + err.message);
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reply to a post
   * @param {Object} event - Nostr event to reply to
   * @param {string} content - Reply content
   * @returns {Promise<Object|boolean>} Published event or false on failure
   */
  const replyToPost = async (event, content) => {
    if (!content || content.trim() === '') {
      setError(new Error('Reply content cannot be empty'));
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create a reply event (kind 1 with e tag)
      const replyEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id, '', 'reply'], // Reference to the event we're replying to
          ['p', event.pubkey] // Reference to the author's pubkey
        ],
        content
      };
      
      // Publish the reply
      const publishedEvent = await createAndPublishEvent(replyEvent);
      
      // Show toast on Android if available
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Reply posted successfully!');
      }
      
      return publishedEvent;
    } catch (err) {
      console.error('Error replying to post:', err);
      setError(err);
      
      // Show error toast on Android if available
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to post reply: ' + err.message);
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Repost an event (boost)
   * @param {Object} event - Nostr event to repost
   * @param {string} comment - Optional comment to add
   * @returns {Promise<Object|boolean>} Published event or false on failure
   */
  const repostEvent = async (event, comment = '') => {
    setLoading(true);
    setError(null);
    
    try {
      // Create a repost event (kind 6 or kind 1 with e tag)
      const hasComment = comment && comment.trim() !== '';
      
      // If there's a comment, use kind 1 with e tag
      // Otherwise use kind 6 (repost)
      const repostEvent = hasComment ? {
        kind: 1, // Text note with reference
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id], // Reference to the event we're reposting
          ['p', event.pubkey], // Reference to the author's pubkey
          ['k', event.kind.toString()] // Kind of the referenced event
        ],
        content: comment.trim()
      } : {
        kind: 6, // Repost
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id], // Reference to the event we're reposting
          ['p', event.pubkey], // Reference to the author's pubkey
          ['k', event.kind.toString()] // Kind of the referenced event
        ],
        content: ''
      };
      
      // Publish the repost
      const publishedEvent = await createAndPublishEvent(repostEvent);
      
      // Show toast on Android if available
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Post boosted!');
      }
      
      return publishedEvent;
    } catch (err) {
      console.error('Error reposting event:', err);
      setError(err);
      
      // Show error toast on Android if available
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to boost post: ' + err.message);
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    likePost,
    replyToPost,
    repostEvent,
    loading,
    error
  };
}; 