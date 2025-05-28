import { useState, useCallback, useRef } from 'react';
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
  const [zappingPostId, setZappingPostId] = useState(null);
  const [zapProgress, setZapProgress] = useState('');

  // Track likes that are being published so rapid double-taps don't send twice
  const inFlightLikes = useRef(new Set());

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
    // Guard: avoid duplicate publishes
    if (inFlightLikes.current.has(post.id)) return;

    if (!window.nostr) {
      alert('Please login to like posts');
      return;
    }

    inFlightLikes.current.add(post.id);

    try {
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

      const signedEvent = await window.nostr.signEvent(likeEvent);
      await createAndPublishEvent(signedEvent);

      // Fetch fresh like data so UI updates once relays acknowledge
      if (loadSupplementaryData) {
        loadSupplementaryData([post.id], 'likes');
      }
    } catch (error) {
      console.error('Like failed:', error);
    } finally {
      inFlightLikes.current.delete(post.id);
    }
  }, [loadSupplementaryData]);

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

      // Refresh repost data so UI reflects confirmed state
      if (loadSupplementaryData) {
        loadSupplementaryData([post.id], 'reposts');
      }

      console.log('Post reposted successfully');
    } catch (error) {
      console.error('Error reposting:', error);
      console.warn('Repost failed (silenced):', error.message);
    }
  }, [loadSupplementaryData]);

  const handleZap = useCallback(async (post, wallet) => {
    if (!window.nostr) {
      alert('Please login to send zaps');
      return;
    }

    if (!wallet) {
      alert('Please connect a Bitcoin wallet to send zaps');
      return;
    }

    // Set zapping state
    setZappingPostId(post.id);
    setZapProgress('Checking wallet connection...');

    try {
      // More robust wallet connection check with reconnection attempt
      if (wallet.checkConnection) {
        console.log('[ZapFlow] Checking wallet connection before zapping');
        const isConnected = await wallet.checkConnection();
        
        if (!isConnected && wallet.ensureConnected) {
          console.log('[ZapFlow] Connection lost, attempting to reconnect wallet');
          setZapProgress('Reconnecting wallet...');
          // Try to reconnect before failing - with retry logic
          let reconnected = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`[ZapFlow] Reconnection attempt ${attempt}/3`);
            setZapProgress(`Reconnecting wallet (attempt ${attempt}/3)...`);
            try {
              reconnected = await wallet.ensureConnected();
              if (reconnected) {
                console.log('[ZapFlow] Wallet successfully reconnected');
                break;
              }
            } catch (reconnectError) {
              console.error(`[ZapFlow] Reconnection attempt ${attempt} failed:`, reconnectError);
            }
            // Wait a bit between attempts
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          if (!reconnected) {
            alert('Wallet connection lost. Please reconnect your wallet in Settings or the NWC tab.');
            return;
          }
        }
      }

      setZapProgress('Preparing zap...');

      // Determine recipient LNURL / lightning address from their Nostr profile
      let lnurl = post.author.lud16 || post.author.lud06 || null;

      // Fallback: derive LNURL-pay endpoint from verified nip05, if present
      if (!lnurl && post.author?.profile?.nip05 && post.author.profile.nip05.includes('@')) {
        const [name, domain] = post.author.profile.nip05.split('@');
        if (name && domain) {
          lnurl = `${name}@${domain}`; // keep address form; later code converts if needed
        }
      }

      if (!lnurl) {
        alert('This user has not set up their Lightning address');
        return;
      }

      // Log which zap method we're using
      console.log('[ZapFlow] Starting zap process for post:', post.id);
      console.log('[ZapFlow] Target Lightning address:', lnurl);
      
      // First, try to use the wallet's built-in generateZapInvoice if it supports that method
      if (wallet.generateZapInvoice) {
        try {
          console.log('[ZapFlow] Wallet supports direct zap method, using wallet.generateZapInvoice');
          setZapProgress('Creating zap invoice...');
          
          // If the wallet supports direct zapping, use that
          const invoice = await wallet.generateZapInvoice(post.author.pubkey, defaultZapAmount, 'Zap for your run! ⚡️');
          console.log('[ZapFlow] Successfully generated zap invoice:', invoice.substring(0, 30) + '...');
          
          setZapProgress('Sending payment...');
          
          // Pay the invoice with retry logic
          let paymentSuccess = false;
          let lastPaymentError = null;
          
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              console.log(`[ZapFlow] Payment attempt ${attempt}/3`);
              if (attempt > 1) setZapProgress(`Retrying payment (attempt ${attempt}/3)...`);
              await wallet.makePayment(invoice);
              paymentSuccess = true;
              console.log('[ZapFlow] Payment successful!');
              break;
            } catch (paymentError) {
              console.error(`[ZapFlow] Payment attempt ${attempt} failed:`, paymentError);
              lastPaymentError = paymentError;
              
              // If it's a connection error, try to reconnect
              if (paymentError.message && (
                paymentError.message.includes('connection') ||
                paymentError.message.includes('timeout') ||
                paymentError.message.includes('WebSocket')
              )) {
                console.log('[ZapFlow] Connection error detected, attempting to reconnect wallet');
                setZapProgress('Reconnecting wallet...');
                try {
                  const reconnected = await wallet.ensureConnected();
                  if (!reconnected) {
                    throw new Error('Failed to reconnect wallet');
                  }
                } catch (reconnectError) {
                  console.error('[ZapFlow] Reconnection failed:', reconnectError);
                }
              }
              
              // Wait between attempts
              if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          if (!paymentSuccess) {
            throw lastPaymentError || new Error('Payment failed after 3 attempts');
          }
          
          // Trigger fresh zap data load so UI updates
          if (loadSupplementaryData) {
            loadSupplementaryData([post.id], 'zaps');
          }
          
          alert('Zap sent successfully! ⚡️');
          return; // Exit early as we've successfully sent the zap
        } catch (zapError) {
          // If direct zap fails, log error and fall back to manual LNURL flow
          console.error('[ZapFlow] Direct zap method failed, falling back to LNURL flow:', zapError);
          
          // If it's a specific error about zaps not being supported, show a helpful message
          if (zapError.message && (
            zapError.message.includes('422') ||
            zapError.message.includes('not support zaps') ||
            zapError.message.includes('permission')
          )) {
            console.warn('[ZapFlow] Wallet does not support zaps, falling back to manual LNURL flow');
          }
        }
      }
      
      // Fallback to manual LNURL flow
      console.log('[ZapFlow] Using manual LNURL-pay flow');

      // Create zap request event (kind 9734) according to NIP-57
      const zapEvent = {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        content: 'Zap for your run! ⚡️',
        tags: [
          ['p', post.author.pubkey],
          ['e', post.id],
          ['amount', (defaultZapAmount * 1000).toString()], // millisats
          // relay hints – improves probability relays see the zap receipt
          ['relays', 'wss://relay.damus.io'],
          ['relays', 'wss://nos.lol'],
          ['relays', 'wss://relay.nostr.band']
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign the zap request with the browser/Amber signer
      const signedEvent = await window.nostr.signEvent(zapEvent);
      console.log('[ZapFlow] Created and signed zap request event');
      
      // Prepare LNURL endpoint from the lnurl / lightning address we resolved above
      let zapEndpoint;
      if (lnurl.includes('@')) {
        // Handle Lightning address (lud16)
        const [username, domain] = lnurl.split('@');
        zapEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
      } else {
        // Treat value as raw LNURL (bech32 or full URL)
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
          
          // Trigger fresh zap data load so UI updates
          if (loadSupplementaryData) {
            loadSupplementaryData([post.id], 'zaps');
          }
          
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
      console.warn('Zap failed (silenced):', error.message);
      
      // Show user-friendly error message based on error type
      let errorMessage = 'Failed to send zap. ';
      if (error.message) {
        if (error.message.includes('timeout')) {
          errorMessage += 'Request timed out. Please try again.';
        } else if (error.message.includes('connection')) {
          errorMessage += 'Connection lost. Please check your wallet connection.';
        } else if (error.message.includes('Lightning address')) {
          errorMessage += error.message;
        } else if (error.message.includes('422') || error.message.includes('permission')) {
          errorMessage += 'Your wallet may not support zaps. Try reconnecting with different permissions.';
        } else {
          errorMessage += error.message;
        }
      }
      
      alert(errorMessage);
    } finally {
      // Clean up zapping state
      setZappingPostId(null);
      setZapProgress('');
    }
  }, [defaultZapAmount, loadSupplementaryData]);

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

      // Fetch fresh comments so UI syncs with relay truth
      if (loadSupplementaryData) {
        loadSupplementaryData([postId], 'comments');
      }

      // Clear comment text
      setCommentText('');
    } catch (error) {
      console.error('Error posting comment:', error);
      console.warn('Comment failed (silenced):', error.message);
    }
  }, [commentText, loadSupplementaryData]);

  return {
    commentText,
    setCommentText,
    handleCommentClick,
    handleLike,
    handleRepost,
    handleZap,
    handleComment,
    activeCommentPost,
    zappingPostId,
    zapProgress
  };
}; 