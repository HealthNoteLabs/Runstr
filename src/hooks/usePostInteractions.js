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

  const handleCommentClick = useCallback((postId) => {
    // Make sure we have post's comments loaded
    if (!loadedSupplementaryData.has(postId)) {
      try {
        // Updated call to loadSupplementaryData with proper parameters
        loadSupplementaryData([postId], 'comments');
      } catch (error) {
        console.error('Error loading supplementary data:', error);
      }
    }
    
    // Toggle comment visibility
    setPosts(currentPosts => 
      currentPosts.map(post => 
        post.id === postId ? { ...post, showComments: !post.showComments } : post
      )
    );
    
    // Set this as the active post for commenting
    setActiveCommentPost(postId);
  }, [loadSupplementaryData, loadedSupplementaryData, setPosts]);

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
      // More robust wallet connection check with reconnection attempt
      if (wallet.checkConnection) {
        console.log('[ZapFlow] Checking wallet connection before zapping');
        const isConnected = await wallet.checkConnection();
        
        if (!isConnected && wallet.ensureConnected) {
          console.log('[ZapFlow] Connection lost, attempting to reconnect wallet');
          // Try to reconnect before failing
          const reconnected = await wallet.ensureConnected();
          if (!reconnected) {
            alert('Wallet connection lost. Please reconnect your wallet in the NWC tab.');
            return;
          }
          console.log('[ZapFlow] Wallet successfully reconnected');
        }
      }

      // Check if author has Lightning address
      if (!post.author.lud16 && !post.author.lud06) {
        alert('This user has not set up their Lightning address');
        return;
      }

      // Log which zap method we're using
      console.log('[ZapFlow] Starting zap process for post:', post.id);
      
      // First, try to use the wallet's built-in generateZapInvoice if it supports that method
      if (wallet.generateZapInvoice) {
        try {
          console.log('[ZapFlow] Wallet supports direct zap method, using wallet.generateZapInvoice');
          
          // If the wallet supports direct zapping, use that
          const invoice = await wallet.generateZapInvoice(post.author.pubkey, defaultZapAmount, 'Zap for your run! ⚡️');
          console.log('[ZapFlow] Successfully generated zap invoice:', invoice.substring(0, 30) + '...');
          
          // Pay the invoice
          await wallet.makePayment(invoice);
          
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
          return; // Exit early as we've successfully sent the zap
        } catch (zapError) {
          // If direct zap fails, log error and fall back to manual LNURL flow
          console.error('[ZapFlow] Direct zap method failed, falling back to LNURL flow:', zapError);
        }
      }
      
      // Fallback to manual LNURL flow
      console.log('[ZapFlow] Using manual LNURL-pay flow');
      
      // Create zap request
      const zapEvent = {
        kind: 9734, // Zap request
        created_at: Math.floor(Date.now() / 1000),
        content: 'Zap for your run! ⚡️',
        tags: [
          ['p', post.author.pubkey],
          ['e', post.id],
          ['amount', (defaultZapAmount * 1000).toString()], // millisats
          // Add multiple relay hints to increase success rate
          ['relays', 'wss://relay.damus.io'],
          ['relays', 'wss://nos.lol'],
          ['relays', 'wss://relay.nostr.band']
        ],
        pubkey: await window.nostr.getPublicKey()
      };
      
      // Sign the event
      const signedEvent = await window.nostr.signEvent(zapEvent);
      console.log('[ZapFlow] Created and signed zap request event');
      
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
      
      console.log('[ZapFlow] Using zap endpoint:', zapEndpoint);
      
      // Get LNURL-pay metadata with timeout handling
      const metadataAbortController = new AbortController();
      const metadataTimeoutId = setTimeout(() => metadataAbortController.abort(), 10000);
      
      try {
        // Fetch with timeout
        const response = await fetch(zapEndpoint, { 
          signal: metadataAbortController.signal 
        });
        clearTimeout(metadataTimeoutId);
        
        if (!response.ok) {
          throw new Error(`Payment endpoint error: ${response.status} ${response.statusText}`);
        }
        
        // Parse response with error handling
        let lnurlPayData;
        try {
          lnurlPayData = await response.json();
          console.log('[ZapFlow] Received LNURL-pay metadata:', lnurlPayData);
        } catch (error) {
          console.error('[ZapFlow] Failed to parse LNURL-pay metadata:', error);
          throw new Error('Invalid response from payment server. Please try again.');
        }
        
        if (!lnurlPayData.callback) {
          console.error('[ZapFlow] Invalid LNURL-pay response - missing callback URL:', lnurlPayData);
          throw new Error('Invalid LNURL-pay response: missing callback URL');
        }
        
        // Construct callback URL
        const callbackUrl = new URL(lnurlPayData.callback);
        callbackUrl.searchParams.append('amount', defaultZapAmount * 1000);
        
        // Try to keep the Nostr event small to avoid URL size limits
        // Some LNURL-pay servers have trouble with large nostr events
        try {
          // Ensure essential tags are included in the compacted event
          // According to NIP-57, we need: p, relays, amount, lnurl (and optionally e)
          const compactEvent = {
            ...signedEvent,
            tags: signedEvent.tags.filter(tag => 
              ['p', 'e', 'amount', 'relays', 'lnurl'].includes(tag[0])
            )
          };
          
          const nostrParam = JSON.stringify(compactEvent);
          callbackUrl.searchParams.append('nostr', encodeURIComponent(nostrParam));
          console.log('[ZapFlow] Added compacted nostr event to callback URL');
          
          // Add lnurl parameter if we have it (required by NIP-57)
          if (lnurl) {
            callbackUrl.searchParams.append('lnurl', lnurl);
            console.log('[ZapFlow] Added lnurl parameter to callback URL');
          }
        } catch (jsonError) {
          console.error('[ZapFlow] Error preparing nostr event for callback:', jsonError);
          // If JSON.stringify fails, still try to proceed without the nostr param
        }
        
        if (lnurlPayData.commentAllowed) {
          callbackUrl.searchParams.append('comment', 'Zap for your run! ⚡️');
        }
        
        // Log the full callback URL for debugging (truncated for security)
        const callbackUrlString = callbackUrl.toString();
        console.log('[ZapFlow] Callback URL (truncated):', 
          callbackUrlString.substring(0, Math.min(100, callbackUrlString.length)) + 
          (callbackUrlString.length > 100 ? '...' : '')
        );
        
        // Get invoice with timeout
        const invoiceAbortController = new AbortController();
        const invoiceTimeoutId = setTimeout(() => invoiceAbortController.abort(), 10000);
        
        try {
          const invoiceResponse = await fetch(callbackUrl, {
            signal: invoiceAbortController.signal
          });
          clearTimeout(invoiceTimeoutId);
          
          if (!invoiceResponse.ok) {
            throw new Error(`Invoice request failed: ${invoiceResponse.status} ${invoiceResponse.statusText}`);
          }
          
          // Parse invoice data with error handling
          let invoiceData;
          try {
            invoiceData = await invoiceResponse.json();
            console.log('[ZapFlow] Received invoice data:', invoiceData);
          } catch (error) {
            console.error('[ZapFlow] Failed to parse invoice response:', error);
            throw new Error('Failed to parse invoice response. Please try again.');
          }
          
          if (!invoiceData.pr) {
            console.error('[ZapFlow] Invalid LNURL-pay response - missing payment request:', invoiceData);
            throw new Error('Invalid LNURL-pay response: missing payment request');
          }
          
          // Pay invoice using wallet
          console.log('[ZapFlow] Paying invoice with wallet...');
          await wallet.makePayment(invoiceData.pr);
          console.log('[ZapFlow] Payment successful!');
          
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
          if (error.name === 'AbortError') {
            throw new Error('Invoice request timed out. Please try again.');
          }
          throw error;
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('Payment endpoint timed out. Please try again.');
        }
        throw error;
      }
    } catch (error) {
      console.error('Error sending zap:', error);
      alert('Failed to send zap: ' + (error.message || 'Unknown error'));
    }
  }, [defaultZapAmount, setPosts]);

  const handleComment = useCallback(async (postId) => {
    if (!commentText.trim() || !window.nostr) {
      alert('Please login and enter a comment');
      return;
    }

    try {
      const commentEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: commentText,
        tags: [
          ['e', postId, '', 'reply'],
          ['k', '1']
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
                  }
                }
              ]
            };
          }
          return post;
        })
      );

      // Clear comment text
      setCommentText('');
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment: ' + error.message);
    }
  }, [commentText, setPosts]);

  return {
    commentText,
    setCommentText,
    handleCommentClick,
    handleLike,
    handleRepost,
    handleZap,
    handleComment,
    activeCommentPost
  };
}; 