import { useState, useCallback } from 'react';
import { createAndPublishEvent } from '../utils/nostr';

export const usePostInteractions = ({
  setPosts,
  setUserLikes,
  setUserReposts,
  loadSupplementaryData,
  loadedSupplementaryData,
  defaultZapAmount
}) => {
  const [commentText, setCommentText] = useState('');
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [commentImages, setCommentImages] = useState([]);

  const handleCommentClick = useCallback((postId) => {
    // Make sure we have post's comments loaded
    if (!loadedSupplementaryData.has(postId)) {
      loadSupplementaryData(postId);
    }
    
    // Toggle comment visibility
    setPosts(currentPosts => 
      currentPosts.map(post => 
        post.id === postId ? { ...post, showComments: !post.showComments } : post
      )
    );
    
    // Set this as the active post for commenting
    setActiveCommentPost(postId);
    
    // Reset comment images if the active post changes
    if (activeCommentPost !== postId) {
      setCommentImages([]);
    }
  }, [loadSupplementaryData, loadedSupplementaryData, setPosts, activeCommentPost]);

  const handleLike = useCallback(async (post) => {
    if (!window.nostr) {
      alert('Please login to like posts');
      return;
    }

    try {
      // Create like event (kind 7)
      const likeEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        content: '+',
        tags: [
          ['e', post.id],
          ['p', post.author.pubkey]
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign and publish
      const signedEvent = await window.nostr.signEvent(likeEvent);
      await createAndPublishEvent(signedEvent);

      // Update UI optimistically
      setUserLikes(prev => {
        const newLikes = new Set(prev);
        newLikes.add(post.id);
        return newLikes;
      });

      setPosts(currentPosts => 
        currentPosts.map(p => 
          p.id === post.id ? { ...p, likes: p.likes + 1 } : p
        )
      );

      console.log('Post liked successfully');
    } catch (error) {
      console.error('Error liking post:', error);
      alert('Failed to like post: ' + error.message);
    }
  }, [setUserLikes, setPosts]);

  const handleRepost = useCallback(async (post) => {
    if (!window.nostr) {
      alert('Please login to repost');
      return;
    }

    try {
      // Create repost event (kind 6)
      const repostEvent = {
        kind: 6,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['e', post.id, '', 'mention'],
          ['p', post.author.pubkey]
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign and publish
      const signedEvent = await window.nostr.signEvent(repostEvent);
      await createAndPublishEvent(signedEvent);

      // Update UI optimistically
      setUserReposts(prev => {
        const newReposts = new Set(prev);
        newReposts.add(post.id);
        return newReposts;
      });

      setPosts(currentPosts => 
        currentPosts.map(p => 
          p.id === post.id ? { ...p, reposts: p.reposts + 1 } : p
        )
      );

      console.log('Post reposted successfully');
    } catch (error) {
      console.error('Error reposting:', error);
      alert('Failed to repost: ' + error.message);
    }
  }, [setUserReposts, setPosts]);

  const handleZap = useCallback(async (post, wallet) => {
    if (!window.nostr) {
      alert('Please login to send zaps');
      return;
    }

    if (!wallet) {
      alert('Please connect a Bitcoin wallet to send zaps');
      return;
    }

    try {
      // Check if author has Lightning address
      if (!post.author.lud16 && !post.author.lud06) {
        alert('This user has not set up their Lightning address');
        return;
      }

      // Create zap request
      const zapEvent = {
        kind: 9734, // Zap request
        created_at: Math.floor(Date.now() / 1000),
        content: 'Zap for your run! ⚡️',
        tags: [
          ['p', post.author.pubkey],
          ['e', post.id],
          ['amount', (defaultZapAmount * 1000).toString()], // millisats
        ],
        pubkey: await window.nostr.getPublicKey()
      };
      
      // Sign the event
      const signedEvent = await window.nostr.signEvent(zapEvent);
      
      // Parse Lightning address
      let zapEndpoint;
      const lnurl = post.author.lud16 || post.author.lud06;
      
      if (lnurl.includes('@')) {
        // Handle Lightning address (lud16)
        const [username, domain] = lnurl.split('@');
        zapEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
      } else {
        // Handle raw LNURL (lud06)
        zapEndpoint = lnurl;
      }
      
      // Get LNURL-pay metadata
      const response = await fetch(zapEndpoint);
      const lnurlPayData = await response.json();
      
      if (!lnurlPayData.callback) {
        throw new Error('Invalid LNURL-pay response');
      }
      
      // Construct callback URL
      const callbackUrl = new URL(lnurlPayData.callback);
      callbackUrl.searchParams.append('amount', defaultZapAmount * 1000);
      callbackUrl.searchParams.append('nostr', JSON.stringify(signedEvent));
      
      if (lnurlPayData.commentAllowed) {
        callbackUrl.searchParams.append('comment', 'Zap for your run! ⚡️');
      }
      
      // Get invoice
      const invoiceResponse = await fetch(callbackUrl);
      const invoiceData = await invoiceResponse.json();
      
      if (!invoiceData.pr) {
        throw new Error('Invalid LNURL-pay response');
      }
      
      // Pay invoice using wallet
      await wallet.makePayment(invoiceData.pr);
      
      // Update UI optimistically
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              zaps: (p.zaps || 0) + 1,
              zapAmount: (p.zapAmount || 0) + defaultZapAmount
            };
          }
          return p;
        })
      );
      
      alert('Zap sent successfully! ⚡️');
    } catch (error) {
      console.error('Error sending zap:', error);
      alert('Failed to send zap: ' + error.message);
    }
  }, [defaultZapAmount, setPosts]);

  /**
   * Convert image file to base64 string for posting
   * @param {File} file - Image file to convert
   * @returns {Promise<string>} Base64 encoded image
   */
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  /**
   * Handle adding an image to a comment
   * @param {File} file - The selected image file
   * @param {string} url - The object URL for the image preview
   */
  const handleAddCommentImage = useCallback((file, url) => {
    setCommentImages(prev => [...prev, { file, url }]);
  }, []);

  /**
   * Handle removing an image from a comment
   * @param {number} index - Index of the image to remove
   */
  const handleRemoveCommentImage = useCallback((index) => {
    setCommentImages(prev => {
      const newImages = [...prev];
      // Release the object URL to prevent memory leaks
      URL.revokeObjectURL(newImages[index].url);
      newImages.splice(index, 1);
      return newImages;
    });
  }, []);

  const handleComment = useCallback(async (postId) => {
    if ((!commentText.trim() && commentImages.length === 0) || !window.nostr) {
      alert('Please login and enter a comment or add an image');
      return;
    }

    try {
      // Process images if any
      const imageTags = [];
      
      if (commentImages.length > 0) {
        // Process each selected image
        for (let i = 0; i < commentImages.length; i++) {
          try {
            // Convert image to base64
            const base64Image = await fileToBase64(commentImages[i].file);
            
            // Add image tag
            imageTags.push(['image', base64Image]);
          } catch (error) {
            console.error('Error processing image:', error);
          }
        }
      }

      // Create comment event with images
      const commentEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: commentText,
        tags: [
          ['e', postId, '', 'reply'],
          ['k', '1'],
          ...imageTags
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign the event
      const signedEvent = await window.nostr.signEvent(commentEvent);
      await createAndPublishEvent(signedEvent);

      // Create a simple profile for immediate UI update
      const userProfile = { name: 'You' };

      // Add comment to UI right away
      setPosts(currentPosts =>
        currentPosts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              comments: [
                ...post.comments,
                {
                  id: signedEvent.id,
                  content: commentText,
                  created_at: Math.floor(Date.now() / 1000),
                  author: {
                    pubkey: signedEvent.pubkey,
                    profile: userProfile
                  },
                  // Add images to the comment for display
                  images: commentImages.length > 0 ? 
                    commentImages.map(img => img.url) : 
                    []
                }
              ]
            };
          }
          return post;
        })
      );

      // Clean up image URLs
      commentImages.forEach(image => {
        URL.revokeObjectURL(image.url);
      });

      // Clear comment text and images
      setCommentText('');
      setCommentImages([]);
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment: ' + error.message);
    }
  }, [commentText, setPosts, commentImages]);

  return {
    commentText,
    setCommentText,
    commentImages,
    handleAddCommentImage,
    handleRemoveCommentImage,
    handleCommentClick,
    handleLike,
    handleRepost,
    handleZap,
    handleComment,
    activeCommentPost
  };
}; 