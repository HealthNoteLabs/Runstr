const WebSocket = require('ws');

console.log('======================================');
console.log('    NIP29 GROUP DISCOVERY TEST');
console.log('======================================\n');

console.log('Connecting to relay.damus.io...\n');

// Connect to a reliable relay
const socket = new WebSocket('wss://relay.damus.io');
let foundGroups = false;

// NIP-29 group creation event kind
const GROUP_CREATION = 80;

// Set up event handlers
socket.on('open', () => {
  console.log('Connected to relay.damus.io\n');
  
  // Create a subscription for NIP29 group creation events
  const subId = `sub-${Math.floor(Math.random() * 1000000)}`;
  const request = JSON.stringify([
    "REQ", 
    subId,
    {
      "kinds": [GROUP_CREATION],
      "limit": 5
    }
  ]);
  
  // Send the request
  socket.send(request);
  console.log('Sent subscription request for NIP29 groups (kind 80)...\n');
  
  // Set a timeout to close the connection after 10 seconds
  setTimeout(() => {
    if (!foundGroups) {
      console.log('No groups received after timeout\n');
    }
    
    console.log('Closing connection...');
    socket.close();
  }, 10000);
});

// Handle messages from the relay
socket.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    // Check if this is an EVENT message
    if (message[0] === 'EVENT' && message[2]) {
      const event = message[2];
      foundGroups = true;
      
      console.log(`\n✓ Found a NIP29 group: ${event.id}\n`);
      
      try {
        // Parse group metadata from content
        const content = JSON.parse(event.content);
        console.log(`Group name: ${content.name || 'Unnamed'}`);
        console.log(`Description: ${content.about || 'No description'}`);
        console.log(`Created: ${new Date(event.created_at * 1000).toLocaleString()}`);
      } catch (err) {
        console.log(`Could not parse group metadata: ${err.message}`);
      }
    }
    
    // Check for EOSE (End of Stored Events) message
    if (message[0] === 'EOSE') {
      console.log('Received end of stored events signal\n');
      
      if (!foundGroups) {
        console.log('No NIP29 groups found on this relay');
      }
    }
  } catch (error) {
    console.error(`Error processing message: ${error.message}`);
  }
});

// Handle errors
socket.on('error', (error) => {
  console.error(`WebSocket error: ${error.message}`);
});

// Handle connection close
socket.on('close', () => {
  console.log('\n======================================');
  console.log('          CHECK COMPLETE');
  console.log('======================================');
  
  if (!foundGroups) {
    console.log('\nNo NIP29 groups were found. Possible reasons:');
    console.log('1. Network connectivity issues');
    console.log('2. The relay may not support NIP29');
    console.log('3. NIP29 groups may not exist on this relay');
    console.log('\nTo enable NIP29 in your browser app:');
    console.log('1. Open browser console (F12)');
    console.log('2. Run: localStorage.setItem("nostr_groups_enabled", "true")');
    console.log('3. Refresh the page');
  } else {
    console.log('\nNIP29 groups were found on the relay!');
    console.log('If you still cannot see groups in your app:');
    console.log('1. Ensure the feature flag is set: localStorage.setItem("nostr_groups_enabled", "true")');
    console.log('2. Check that your app is connecting to relays that support NIP29');
    console.log('3. Verify app authentication is working correctly');
  }
}); 