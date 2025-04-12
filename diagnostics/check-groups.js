/**
 * Simple NIP29 Group Discovery Test
 * 
 * This script tests direct discovery of NIP29 groups without app dependencies
 */

// Use native WebSocket for Node
const WebSocket = require('ws');
global.WebSocket = WebSocket;

// For direct querying of relays
const fetch = require('node-fetch');

// NIP-29 event kinds
const GROUP_CREATION = 80;

// Relays to check
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://relay.0xchat.com'
];

/**
 * Make a direct HTTP request to a well-known NIP29 list endpoint
 */
async function checkWellKnownLists() {
  try {
    console.log('Checking wellknown.nostr.com for NIP29 groups list...\n');
    
    const response = await fetch('https://api.nostr.watch/groups');
    
    if (response.ok) {
      const groups = await response.json();
      
      if (groups && groups.length > 0) {
        console.log(`✓ Found ${groups.length} groups via nostr.watch API\n`);
        
        // Display sample groups
        console.log('Sample groups:');
        for (const group of groups.slice(0, 5)) {
          console.log(`- ${group.name || 'Unnamed'} (${group.id?.substring(0, 10) || 'No ID'}...)`);
        }
        console.log('');
        return true;
      } else {
        console.log('No groups found via API\n');
      }
    } else {
      console.log(`API request failed: ${response.status} ${response.statusText}\n`);
    }
  } catch (error) {
    console.error(`Error checking API: ${error.message}\n`);
  }
  return false;
}

/**
 * Manual check using a WebSocket connection to one reliable relay
 */
async function manualRelayCheck() {
  console.log('Performing manual WebSocket check on relay.damus.io...\n');
  
  return new Promise((resolve) => {
    try {
      // Connect to a reliable relay
      const socket = new WebSocket('wss://relay.damus.io');
      let found = false;
      
      socket.onopen = () => {
        console.log('Connected to relay.damus.io\n');
        
        // Create a subscription for NIP29 group creation events
        const subId = `sub-${Math.random().toString(36).substring(2, 10)}`;
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
        console.log('Sent subscription request for NIP29 groups\n');
        
        // Set a timeout to close the connection after 10 seconds
        setTimeout(() => {
          if (!found) {
            console.log('No groups received after timeout.\n');
          }
          socket.close();
          resolve(found);
        }, 10000);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle EVENT messages from the subscription
          if (data[0] === 'EVENT' && data[1] === subId && data[2]) {
            const eventData = data[2];
            found = true;
            
            console.log(`✓ Found a NIP29 group: ${eventData.id}\n`);
            
            try {
              const content = JSON.parse(eventData.content);
              console.log(`Group name: ${content.name || 'Unnamed'}`);
              if (content.about) console.log(`Description: ${content.about}`);
            } catch {
              console.log('Could not parse group metadata');
            }
          }
          
          // Handle EOSE (End of Stored Events) message
          if (data[0] === 'EOSE' && data[1] === subId) {
            console.log('Received end of stored events signal\n');
          }
        } catch (error) {
          console.error(`Error processing message: ${error.message}`);
        }
      };
      
      socket.onerror = (error) => {
        console.error(`WebSocket error: ${error.message}\n`);
        resolve(false);
      };
      
      socket.onclose = () => {
        console.log('Connection closed\n');
        resolve(found);
      };
    } catch (error) {
      console.error(`Setup error: ${error.message}\n`);
      resolve(false);
    }
  });
}

/**
 * Run all checks for NIP29 groups
 */
async function findGroups() {
  console.log('======================================');
  console.log('    NIP29 GROUP DISCOVERY TEST');
  console.log('======================================\n');
  
  // First try the API endpoint
  const foundViaAPI = await checkWellKnownLists();
  
  // If API check failed, try manual relay connection
  if (!foundViaAPI) {
    const foundViaRelay = await manualRelayCheck();
    
    if (!foundViaRelay) {
      console.log('\n❌ No NIP29 groups found via any method.\n');
      console.log('Possible reasons:');
      console.log('1. Network connectivity issues');
      console.log('2. Relays may be temporarily down');
      console.log('3. NIP29 groups may not exist on the checked relays');
    }
  }
  
  console.log('======================================');
  console.log('          CHECK COMPLETE');
  console.log('======================================');
}

// Run the test
findGroups().catch(error => {
  console.error('Unhandled error:', error);
}); 