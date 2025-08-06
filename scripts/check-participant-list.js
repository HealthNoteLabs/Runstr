#!/usr/bin/env node

/**
 * RUNSTR Season Pass Participant List Checker
 * 
 * This script queries the official RUNSTR Season 1 participant list from Nostr
 * and displays the count and npubs of all participants.
 */

import { nip19 } from 'nostr-tools';
import WebSocket from 'ws';

// Configuration
const ADMIN_PUBKEY = 'f241654d23b2aede8275dedd1eba1791e292d9ee0d887752e68a404debc888cc';
const PARTICIPANT_LIST_D_TAG = 'runstr-season-1-participants';
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

/**
 * Query participant list from a relay using WebSocket
 */
async function queryParticipantList(relayUrl) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Querying ${relayUrl}...`);
    
    const ws = new WebSocket(relayUrl);
    const events = [];
    let subscriptionId = 'participant-list-' + Math.random().toString(36).substring(7);
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Query timeout'));
    }, 15000);
    
    ws.on('open', () => {
      console.log(`✅ Connected to ${relayUrl}`);
      
      // Send subscription request
      const filter = {
        kinds: [30000],
        authors: [ADMIN_PUBKEY],
        '#d': [PARTICIPANT_LIST_D_TAG]
      };
      
      ws.send(JSON.stringify(['REQ', subscriptionId, filter]));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message[0] === 'EVENT' && message[1] === subscriptionId) {
          events.push(message[2]);
        } else if (message[0] === 'EOSE' && message[1] === subscriptionId) {
          clearTimeout(timeout);
          ws.close();
          console.log(`   Found ${events.length} list event(s)`);
          resolve(events);
        }
      } catch (error) {
        console.log(`   Parse error: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${error.message}`));
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
      if (events.length === 0) {
        resolve(events); // Return empty array instead of error
      }
    });
  });
}

/**
 * Extract participants from event
 */
function extractParticipants(event) {
  return event.tags
    .filter(tag => tag[0] === 'p' && tag[1])
    .map(tag => tag[1]);
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
  return new Date(timestamp * 1000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

/**
 * Main execution
 */
async function main() {
  console.log('🏃 RUNSTR Season 1 Participant List Checker\n');
  console.log(`📋 Looking for list: ${PARTICIPANT_LIST_D_TAG}`);
  console.log(`👑 Admin pubkey: ${ADMIN_PUBKEY}`);
  console.log(`🌐 Checking ${RELAYS.length} relays...\n`);
  
  let allEvents = [];
  
  // Query each relay
  for (const relayUrl of RELAYS) {
    try {
      const events = await queryParticipantList(relayUrl);
      allEvents.push(...events);
    } catch (error) {
      console.log(`   ❌ Query failed for ${relayUrl}: ${error.message}`);
    }
  }
  
  if (allEvents.length === 0) {
    console.log('\n❌ No participant list found on any relay');
    console.log('🤔 This could mean:');
    console.log('   • The list hasn\'t been published yet');
    console.log('   • The relays don\'t have the event');
    console.log('   • There\'s a network issue');
    return;
  }
  
  // Find the most recent event
  const latestEvent = allEvents.sort((a, b) => b.created_at - a.created_at)[0];
  
  console.log('\n📊 PARTICIPANT LIST RESULTS');
  console.log('============================');
  console.log(`📅 List created: ${formatTimestamp(latestEvent.created_at)}`);
  console.log(`🆔 Event ID: ${latestEvent.id}`);
  console.log(`📝 Content: ${latestEvent.content || '(no content)'}`);
  
  // Extract participants
  const participants = extractParticipants(latestEvent);
  const uniqueParticipants = [...new Set(participants)];
  
  console.log(`\n👥 PARTICIPANT COUNT: ${uniqueParticipants.length}`);
  
  if (participants.length !== uniqueParticipants.length) {
    console.log(`⚠️  Note: Found ${participants.length - uniqueParticipants.length} duplicate(s), showing unique participants only`);
  }
  
  if (uniqueParticipants.length > 0) {
    console.log('\n📋 PARTICIPANT LIST (npubs):');
    console.log('============================');
    
    uniqueParticipants.forEach((pubkey, index) => {
      try {
        const npub = nip19.npubEncode(pubkey);
        console.log(`${String(index + 1).padStart(3)}: ${npub}`);
      } catch (error) {
        console.log(`${String(index + 1).padStart(3)}: ${pubkey} (invalid - couldn't convert to npub)`);
      }
    });
    
    console.log('\n📋 PARTICIPANT LIST (hex pubkeys):');
    console.log('==================================');
    uniqueParticipants.forEach((pubkey, index) => {
      console.log(`${String(index + 1).padStart(3)}: ${pubkey}`);
    });
  }
  
  // Show some stats
  console.log('\n📈 STATISTICS');
  console.log('=============');
  console.log(`Total events found: ${allEvents.length}`);
  console.log(`Latest event from: ${formatTimestamp(latestEvent.created_at)}`);
  console.log(`Total p tags in event: ${latestEvent.tags.filter(t => t[0] === 'p').length}`);
  console.log(`Unique participants: ${uniqueParticipants.length}`);
  console.log(`Event size: ${JSON.stringify(latestEvent).length} bytes`);
  
  console.log('\n✅ Done!');
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});