import WebSocket from 'ws';
import { initializeNostr, fetchRunningPosts, loadSupplementaryData, processPostsWithData } from '../src/utils/nostr.js';

// Create a custom WebSocket class for Node.js
class NodeWebSocket extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols);
  }
}

// Override the global WebSocket for nostr-tools
const originalWebSocket = globalThis.WebSocket;
globalThis.WebSocket = NodeWebSocket;

async function testFeed() {
  console.log('Starting feed test...');
  
  try {
    // Initialize connections
    const connected = await initializeNostr();
    if (!connected) {
      console.error('Failed to connect to relays');
      return;
    }
    
    console.log('Successfully connected to relays');
    
    // Fetch running posts
    console.log('Fetching running posts...');
    const posts = await fetchRunningPosts(20);
    
    if (posts.length === 0) {
      console.log('No running posts found');
      return;
    }
    
    console.log(`Found ${posts.length} running posts`);
    
    // Load supplementary data
    console.log('Loading supplementary data (likes, reposts)...');
    const supplementaryData = await loadSupplementaryData(posts);
    
    // Process posts with data
    console.log('Processing posts with supplementary data...');
    const processedPosts = await processPostsWithData(posts, supplementaryData);
    
    // Display results
    console.log('\nTest Results:');
    console.log('-------------');
    console.log(`Total Posts: ${processedPosts.length}`);
    console.log(`Posts with Likes: ${processedPosts.filter(p => p.likes).length}`);
    console.log(`Posts with Reposts: ${processedPosts.filter(p => p.reposts).length}`);
    
    console.log('\nMost Recent Posts:');
    console.log('------------------');
    processedPosts.slice(0, 5).forEach(post => {
      console.log(`\nPost ID: ${post.id}`);
      console.log(`Content: ${post.content}`);
      console.log(`Created: ${post.created_at_iso}`);
      console.log(`Likes: ${post.likes ? 'Yes' : 'No'}`);
      console.log(`Reposts: ${post.reposts ? 'Yes' : 'No'}`);
      console.log('Tags:', post.tags);
    });
    
  } catch (error) {
    console.error('Error during feed test:', error);
  } finally {
    // Restore original WebSocket
    globalThis.WebSocket = originalWebSocket;
  }
}

// Run the test
testFeed(); 