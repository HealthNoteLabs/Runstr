// Test script specifically for RUNSTR group
import { SimplePool, nip19 } from 'nostr-tools';
import NDK from '@nostr-dev-kit/ndk';
import process from 'process';

// RUNSTR club naddr
const RUNSTR_CLUB_NADDR = 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es';

// Relays to check
const RELAYS = [
  'wss://groups.0xchat.com',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social'
];

/**
 * Extract the group information from naddr
 */
function parseRunstrGroup() {
  console.log('📦 Parsing RUNSTR group naddr...');
  
  try {
    const { data } = nip19.decode(RUNSTR_CLUB_NADDR);
    console.log('Group info:', data);
    return data;
  } catch (error) {
    console.error('❌ Error parsing naddr:', error);
    return null;
  }
}

/**
 * Fetch group messages using nostr-tools
 */
async function fetchMessagesWithNostrTools(groupInfo) {
  console.log('\n🔍 Fetching RUNSTR group messages using nostr-tools...');
  
  try {
    const pool = new SimplePool();
    
    // Filter for group messages
    const filter = {
      kinds: [39001, 1], // Group messages + regular notes with h tag
      '#h': [groupInfo.identifier], // Group identifier in 'h' tag
      limit: 20
    };
    
    console.log('Using filter:', filter);
    console.log('Checking relays:', RELAYS);
    
    // Fetch messages
    const events = await pool.list(RELAYS, [filter], { timeout: 15000 });
    
    if (events && events.length > 0) {
      console.log(`✅ Success! Found ${events.length} messages.`);
      console.log('\nLatest messages:');
      
      // Sort by created_at in descending order (newest first)
      const sortedEvents = [...events].sort((a, b) => b.created_at - a.created_at);
      
      // Display the 5 most recent messages
      sortedEvents.slice(0, 5).forEach((event, index) => {
        console.log(`\n--- Message ${index + 1} ---`);
        console.log(`Author: ${event.pubkey.slice(0, 8)}...`);
        console.log(`Content: ${event.content}`);
        console.log(`Date: ${new Date(event.created_at * 1000).toLocaleString()}`);
        console.log(`Tags: ${JSON.stringify(event.tags)}`);
      });
    } else {
      console.log('⚠️ No messages found.');
    }
    
    // Clean up
    pool.close(RELAYS);
    
    return events || [];
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    return [];
  }
}

/**
 * Fetch group messages using NDK
 */
async function fetchMessagesWithNDK(groupInfo) {
  console.log('\n🔄 Fetching RUNSTR group messages using NDK...');
  
  try {
    // Create NDK instance
    const ndk = new NDK({
      explicitRelayUrls: RELAYS
    });
    
    // Connect to relays
    await ndk.connect();
    console.log('Connected to NDK relays');
    
    // Filter for group messages
    const filter = {
      kinds: [39001, 1], // Group messages + regular notes with h tag
      '#h': [groupInfo.identifier], // Group identifier in 'h' tag
      limit: 20
    };
    
    console.log('Using filter:', filter);
    
    // Fetch messages
    const events = await ndk.fetchEvents(filter);
    const eventsArray = Array.from(events);
    
    if (eventsArray.length > 0) {
      console.log(`✅ Success! Found ${eventsArray.length} messages.`);
      console.log('\nLatest messages:');
      
      // Sort by created_at in descending order (newest first)
      const sortedEvents = [...eventsArray].sort((a, b) => b.created_at - a.created_at);
      
      // Display the 5 most recent messages
      sortedEvents.slice(0, 5).forEach((event, index) => {
        const rawEvent = event.rawEvent();
        console.log(`\n--- Message ${index + 1} ---`);
        console.log(`Author: ${rawEvent.pubkey.slice(0, 8)}...`);
        console.log(`Content: ${rawEvent.content}`);
        console.log(`Date: ${new Date(rawEvent.created_at * 1000).toLocaleString()}`);
        console.log(`Tags: ${JSON.stringify(rawEvent.tags)}`);
      });
    } else {
      console.log('⚠️ No messages found.');
    }
    
    return eventsArray;
  } catch (error) {
    console.error('❌ Error fetching messages with NDK:', error);
    return [];
  }
}

/**
 * Check for group members
 */
async function checkGroupMembers(groupInfo) {
  console.log('\n👥 Checking for group members...');
  
  try {
    const pool = new SimplePool();
    
    // Filter for membership events
    const membershipFilter = {
      kinds: [9000], // put-user events
      '#h': [groupInfo.identifier]
    };
    
    // Fetch membership events
    const memberEvents = await pool.list(RELAYS, [membershipFilter], { timeout: 10000 });
    
    if (memberEvents && memberEvents.length > 0) {
      console.log(`✅ Found ${memberEvents.length} membership events`);
      
      // Extract unique member pubkeys
      const memberPubkeys = new Set();
      memberEvents.forEach(event => {
        event.tags.forEach(tag => {
          if (tag[0] === 'p' && tag[1]) {
            memberPubkeys.add(tag[1]);
          }
        });
      });
      
      console.log(`Group has at least ${memberPubkeys.size} members`);
    } else {
      console.log('⚠️ No explicit membership events found');
      
      // Alternative: look for users who have posted messages
      const messageAuthorsFilter = {
        kinds: [39001, 1],
        '#h': [groupInfo.identifier]
      };
      
      const messageEvents = await pool.list(RELAYS, [messageAuthorsFilter], { timeout: 10000 });
      
      if (messageEvents && messageEvents.length > 0) {
        // Extract unique authors
        const authors = new Set(messageEvents.map(event => event.pubkey));
        console.log(`✅ Found ${authors.size} users who have posted messages to the group`);
      } else {
        console.log('⚠️ No group messages found either');
      }
    }
    
    // Clean up
    pool.close(RELAYS);
  } catch (error) {
    console.error('❌ Error checking group members:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🏃‍♂️ RUNSTR GROUP TEST 🏃‍♀️\n');
  
  // Parse group info
  const groupInfo = parseRunstrGroup();
  if (!groupInfo) {
    console.error('Failed to parse group info. Exiting...');
    process.exit(1);
  }
  
  // Fetch messages with nostr-tools
  const messages = await fetchMessagesWithNostrTools(groupInfo);
  
  // Fetch messages with NDK
  const ndkMessages = await fetchMessagesWithNDK(groupInfo);
  
  // Check membership
  await checkGroupMembers(groupInfo);
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`Messages found with nostr-tools: ${messages.length}`);
  console.log(`Messages found with NDK: ${ndkMessages.length}`);
  
  if (messages.length > 0 || ndkMessages.length > 0) {
    console.log('\n✅ Success! RUNSTR group messages were found.');
    console.log('Your app should be able to display these messages.');
    console.log('Make sure your app is using the correct tag format (#h) and message kinds (1 and 39001).');
  } else {
    console.log('\n⚠️ No messages found with either library.');
    console.log('Possible issues:');
    console.log('1. The RUNSTR group might be empty or inactive');
    console.log('2. The relays being used might not have the group messages');
    console.log('3. There might be connectivity issues with the relays');
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 