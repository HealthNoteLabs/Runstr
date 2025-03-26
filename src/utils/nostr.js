import { verifyEvent } from 'nostr-tools';

// Focus on a smaller set of the most reliable relays
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nostr.bitcoiner.social',
  'wss://nostr.mom'
];

// Storage for active relay connections
const activeConnections = new Map();

/**
 * Initialize the Nostr client - connect to relays
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Test connection to relays
    const connectedRelays = [];
    
    for (const relay of RELAYS) {
      try {
        const ws = new WebSocket(relay);
        await new Promise((resolve, reject) => {
          ws.onopen = () => {
            activeConnections.set(relay, ws);
            connectedRelays.push(relay);
            console.log(`✅ Connected to ${relay}`);
            resolve();
          };
          
          ws.onerror = (error) => {
            console.warn(`❌ Failed to connect to ${relay}:`, error);
            reject(error);
          };
        });
      } catch (error) {
        console.warn(`Failed to connect to relay: ${relay}`, error);
      }
    }
    
    console.log(`Connected to ${connectedRelays.length}/${RELAYS.length} relays`);
    return connectedRelays.length > 0;
  } catch (error) {
    console.error('Error initializing Nostr:', error);
    return false;
  }
};

/**
 * Fetch running posts from Nostr
 * @param {number} limit - Maximum number of posts to fetch
 * @param {number} since - Unix timestamp to fetch posts since
 * @returns {Promise<Array>} Array of running posts
 */
export const fetchRunningPosts = async (limit = 50, since = undefined) => {
  try {
    // Calculate timestamp for 1 week ago if not provided
    const oneWeekAgo = since || Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    
    // Create filter for running posts
    const filter = {
      kinds: [1],
      since: oneWeekAgo,
      limit,
      '#t': ['running', 'runstr', 'run']
    };
    
    console.log('Fetching running posts with filter:', filter);
    
    // Create subscription message
    const subscription = [
      'REQ',
      'running-posts-subscription',
      filter
    ];
    
    // Collect events from all relays
    const events = [];
    const promises = Array.from(activeConnections.entries()).map(([relay, ws]) => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 10000); // 10 second timeout
        
        const messageHandler = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message[0] === 'EVENT' && message[2]) {
              events.push(message[2]);
            } else if (message[0] === 'EOSE' && message[1] === 'running-posts-subscription') {
              clearTimeout(timeout);
              ws.removeEventListener('message', messageHandler);
              resolve();
            }
          } catch (err) {
            console.log(`Error processing message from ${relay}:`, err);
          }
        };
        
        ws.addEventListener('message', messageHandler);
        ws.send(JSON.stringify(subscription));
      });
    });
    
    // Wait for all subscriptions to complete
    await Promise.all(promises);
    
    // Sort events by timestamp (newest first)
    events.sort((a, b) => b.created_at - a.created_at);
    
    // Remove duplicates based on event ID
    const uniqueEvents = Array.from(new Map(events.map(event => [event.id, event])).values());
    
    console.log(`Fetched ${uniqueEvents.length} unique running posts`);
    return uniqueEvents;
  } catch (error) {
    console.error('Error fetching running posts:', error);
    return [];
  }
};

/**
 * Search for running content in posts
 * @param {number} limit - Maximum number of posts to fetch
 * @param {number} hours - Hours to look back
 * @returns {Promise<Array>} Array of posts mentioning running
 */
export const searchRunningContent = async (limit = 50, hours = 72) => {
  try {
    const since = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
    
    const filter = {
      kinds: [1],
      since,
      limit
    };
    
    console.log('Searching for running content with filter:', filter);
    
    // Create subscription message
    const subscription = [
      'REQ',
      'running-content-subscription',
      filter
    ];
    
    // Collect events from all relays
    const events = [];
    const promises = Array.from(activeConnections.entries()).map(([relay, ws]) => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 10000); // 10 second timeout
        
        const messageHandler = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message[0] === 'EVENT' && message[2]) {
              const eventData = message[2];
              const content = eventData.content.toLowerCase();
              if (content.includes('running') || 
                  content.includes('run') || 
                  content.includes('runner') ||
                  content.includes('ran')) {
                events.push(eventData);
              }
            } else if (message[0] === 'EOSE' && message[1] === 'running-content-subscription') {
              clearTimeout(timeout);
              ws.removeEventListener('message', messageHandler);
              resolve();
            }
          } catch (err) {
            console.log(`Error processing message from ${relay}:`, err);
          }
        };
        
        ws.addEventListener('message', messageHandler);
        ws.send(JSON.stringify(subscription));
      });
    });
    
    // Wait for all subscriptions to complete
    await Promise.all(promises);
    
    console.log(`Found ${events.length} posts mentioning running`);
    return events;
  } catch (error) {
    console.error('Error searching running content:', error);
    return [];
  }
};

/**
 * Load supplementary data for posts (likes, reposts, etc.)
 * @param {Array} posts - Array of posts to load data for
 * @returns {Promise<Object>} Object containing supplementary data
 */
export const loadSupplementaryData = async (posts) => {
  try {
    const postIds = posts.map(post => post.id);
    
    // Create filters for likes and reposts
    const likesFilter = {
      kinds: [7],
      '#e': postIds,
      limit: 100
    };
    
    const repostsFilter = {
      kinds: [6],
      '#e': postIds,
      limit: 100
    };
    
    // Create subscription messages
    const likesSubscription = ['REQ', 'likes-subscription', likesFilter];
    const repostsSubscription = ['REQ', 'reposts-subscription', repostsFilter];
    
    // Collect events from all relays
    const likes = [];
    const reposts = [];
    
    const promises = Array.from(activeConnections.entries()).map(([relay, ws]) => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 5000); // 5 second timeout
        
        let likesEose = false;
        let repostsEose = false;
        
        const messageHandler = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message[0] === 'EVENT' && message[2]) {
              const eventData = message[2];
              if (eventData.kind === 7) {
                likes.push(eventData);
              } else if (eventData.kind === 6) {
                reposts.push(eventData);
              }
            } else if (message[0] === 'EOSE') {
              if (message[1] === 'likes-subscription') {
                likesEose = true;
              } else if (message[1] === 'reposts-subscription') {
                repostsEose = true;
              }
              
              if (likesEose && repostsEose) {
                clearTimeout(timeout);
                ws.removeEventListener('message', messageHandler);
                resolve();
              }
            }
          } catch (err) {
            console.log(`Error processing message from ${relay}:`, err);
          }
        };
        
        ws.addEventListener('message', messageHandler);
        ws.send(JSON.stringify(likesSubscription));
        ws.send(JSON.stringify(repostsSubscription));
      });
    });
    
    // Wait for all subscriptions to complete
    await Promise.all(promises);
    
    return {
      likes,
      reposts
    };
  } catch (error) {
    console.error('Error loading supplementary data:', error);
    return {
      likes: [],
      reposts: []
    };
  }
};

/**
 * Process posts with supplementary data
 * @param {Array} posts - Array of posts to process
 * @param {Object} supplementaryData - Supplementary data for the posts
 * @returns {Promise<Array>} Processed posts
 */
export const processPostsWithData = async (posts, supplementaryData) => {
  try {
    const { likes, reposts } = supplementaryData;
    
    // Create maps for faster lookups
    const likesMap = new Map(likes.map(like => {
      const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
      return [postId, like];
    }));
    
    const repostsMap = new Map(reposts.map(repost => {
      const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
      return [postId, repost];
    }));
    
    // Process each post
    return posts.map(post => ({
      ...post,
      likes: likesMap.get(post.id) || null,
      reposts: repostsMap.get(post.id) || null,
      created_at_iso: new Date(post.created_at * 1000).toISOString()
    }));
  } catch (error) {
    console.error('Error processing posts with data:', error);
    return posts;
  }
};

/**
 * Create and publish an event
 * @param {Object} eventTemplate - Event template 
 * @returns {Promise<Object>} Published event
 */
export const createAndPublishEvent = async (eventTemplate) => {
  try {
    if (!window.nostr) {
      throw new Error('Nostr extension not available');
    }
    
    // Get the public key from nostr extension
    const pubkey = await window.nostr.getPublicKey();
    
    // Create the event with user's pubkey
    const event = {
      ...eventTemplate,
      pubkey,
      created_at: Math.floor(Date.now() / 1000)
    };
    
    // Sign the event using the browser extension
    const signedEvent = await window.nostr.signEvent(event);
    
    // Verify the signature
    const valid = verifyEvent(signedEvent);
    if (!valid) {
      throw new Error('Event signature verification failed');
    }
    
    // Publish the event to all relays
    const promises = Array.from(activeConnections.entries()).map(([relay, ws]) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout publishing to ${relay}`));
        }, 5000);
        
        const messageHandler = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message[0] === 'OK' && message[1] === signedEvent.id) {
              clearTimeout(timeout);
              ws.removeEventListener('message', messageHandler);
              resolve();
            }
          } catch (err) {
            console.log(`Error processing OK message from ${relay}:`, err);
          }
        };
        
        ws.addEventListener('message', messageHandler);
        ws.send(JSON.stringify(['EVENT', signedEvent]));
      });
    });
    
    await Promise.all(promises);
    
    return signedEvent;
  } catch (error) {
    console.error('Error publishing event:', error);
    throw error;
  }
};

/**
 * Handle app background state
 */
export const handleAppBackground = () => {
  // Close all WebSocket connections
  for (const [relay, ws] of activeConnections.entries()) {
    ws.close();
    activeConnections.delete(relay);
  }
};

/**
 * Diagnostic function that tests connection to relays
 */
export const diagnoseConnection = async () => {
  const results = {
    relayStatus: {},
    events: [],
    errors: []
  };
  
  try {
    // Initialize connections
    await initializeNostr();
    
    // Test each relay status
    for (const [relay, ws] of activeConnections.entries()) {
      results.relayStatus[relay] = ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected';
    }
    
    // Test general event retrieval
    const filter = {
      kinds: [1],
      limit: 20
    };
    
    const subscription = ['REQ', 'diagnostic-subscription', filter];
    
    // Collect events from all relays
    const promises = Array.from(activeConnections.entries()).map(([relay, ws]) => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 5000);
        
        const messageHandler = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message[0] === 'EVENT' && message[2]) {
              results.events.push(message[2]);
            } else if (message[0] === 'EOSE' && message[1] === 'diagnostic-subscription') {
              clearTimeout(timeout);
              ws.removeEventListener('message', messageHandler);
              resolve();
            }
          } catch (err) {
            console.log(`Error processing message from ${relay}:`, err);
            results.errors.push(`Error processing message from ${relay}: ${err.message}`);
          }
        };
        
        ws.addEventListener('message', messageHandler);
        ws.send(JSON.stringify(subscription));
      });
    });
    
    await Promise.all(promises);
    
    return results;
  } catch (error) {
    console.error('Error during diagnosis:', error);
    results.errors.push(error.message);
    return results;
  }
};
