#!/usr/bin/env node

/**
 * RUNSTR Subscription Management Script
 * 
 * This script helps administrators manage monthly subscriptions by:
 * 1. Querying all Kind 33407 subscription receipt events
 * 2. Categorizing subscribers by tier (member/captain)
 * 3. Generating and updating NIP-51 subscription lists
 * 4. Publishing updated lists to Nostr relays
 * 
 * Usage:
 *   node scripts/manage-subscriptions.js              # Process current month
 *   node scripts/manage-subscriptions.js --month 02   # Process specific month
 *   node scripts/manage-subscriptions.js --year 2025  # Process specific year
 *   node scripts/manage-subscriptions.js --dry-run    # Preview without publishing
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import NDK, { NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const ADMIN_PUBKEY = 'f241654d23b2aede8275dedd1eba1791e292d9ee0d887752e68a404debc888cc';
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social'
];

// Command line arguments
const args = process.argv.slice(2);
const flags = {
  month: args.find(arg => arg.startsWith('--month'))?.split('=')[1] || null,
  year: args.find(arg => arg.startsWith('--year'))?.split('=')[1] || null,
  dryRun: args.includes('--dry-run'),
  help: args.includes('--help') || args.includes('-h')
};

/**
 * Display help information
 */
function showHelp() {
  console.log(`
RUNSTR Subscription Management Script

This script processes subscription receipt events (Kind 33407) and manages
NIP-51 subscription lists for RUNSTR monthly subscriptions.

USAGE:
  node scripts/manage-subscriptions.js [OPTIONS]

OPTIONS:
  --month=MM     Process specific month (01-12, default: current month)
  --year=YYYY    Process specific year (default: current year)
  --dry-run      Preview changes without publishing to Nostr
  --help, -h     Show this help message

EXAMPLES:
  node scripts/manage-subscriptions.js
  node scripts/manage-subscriptions.js --month=02 --year=2025
  node scripts/manage-subscriptions.js --dry-run

PREREQUISITES:
  - Set NOSTR_PRIVATE_KEY environment variable with admin private key
  - Or use NIP-07 browser extension for signing (if running in browser context)

The script will:
1. Query for all Kind 33407 subscription receipt events for the target month
2. Categorize subscribers into member and captain tiers
3. Generate NIP-51 lists for each tier
4. Publish updated lists to configured relays (unless --dry-run is used)
`);
}

/**
 * Get current or specified month-year
 */
function getTargetMonthYear() {
  const now = new Date();
  const month = flags.month || String(now.getMonth() + 1).padStart(2, '0');
  const year = flags.year || now.getFullYear();
  
  // Validate month
  if (!/^(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Invalid month. Must be 01-12');
  }
  
  // Validate year
  if (!/^\d{4}$/.test(year.toString())) {
    throw new Error('Invalid year. Must be a 4-digit year');
  }
  
  return `${month}-${year}`;
}

/**
 * Initialize NDK with admin credentials
 */
async function initializeNDK() {
  console.log('🔗 Initializing NDK connection...');
  
  const ndk = new NDK({
    explicitRelayUrls: RELAYS
  });

  // Try to get admin signer
  let signer;
  const privateKey = process.env.NOSTR_PRIVATE_KEY;
  
  if (privateKey) {
    console.log('🔐 Using private key from environment variable');
    signer = new NDKPrivateKeySigner(privateKey);
  } else if (typeof window !== 'undefined' && window.nostr) {
    console.log('🌐 Using NIP-07 browser extension');
    signer = new NDKNip07Signer();
  } else {
    throw new Error('No signing method available. Set NOSTR_PRIVATE_KEY environment variable or use NIP-07 extension');
  }

  ndk.signer = signer;
  
  // Connect to relays
  await ndk.connect();
  console.log(`✅ Connected to ${ndk.pool.connectedRelays().length} relays`);
  
  return ndk;
}

/**
 * Fetch all subscription receipt events for the target month
 */
async function fetchSubscriptionEvents(ndk, monthYear) {
  console.log(`📥 Fetching subscription events for ${monthYear}...`);
  
  const dTag = `runstr-subscription-${monthYear}`;
  
  try {
    const events = await ndk.fetchEvents({
      kinds: [33407], // Subscription receipt events
      '#d': [dTag]
    });

    const eventArray = Array.from(events);
    console.log(`📋 Found ${eventArray.length} subscription events for ${monthYear}`);
    
    return eventArray;
  } catch (error) {
    console.error('❌ Error fetching subscription events:', error);
    throw error;
  }
}

/**
 * Process and categorize subscription events
 */
function processSubscriptionEvents(events) {
  console.log('🔍 Processing and categorizing subscription events...');
  
  const members = [];
  const captains = [];
  const processedEvents = [];
  
  for (const event of events) {
    try {
      // Extract tier and purchaser from tags
      const tierTag = event.tags.find(tag => tag[0] === 'tier');
      const purchaserTag = event.tags.find(tag => tag[0] === 'purchaser');
      const amountTag = event.tags.find(tag => tag[0] === 'amount');
      const purchaseDateTag = event.tags.find(tag => tag[0] === 'purchase_date');
      
      if (!tierTag || !purchaserTag) {
        console.warn(`⚠️  Skipping event ${event.id}: missing tier or purchaser tag`);
        continue;
      }
      
      const tier = tierTag[1];
      const purchaserNpub = purchaserTag[1];
      const amount = amountTag ? parseInt(amountTag[1]) : 0;
      const purchaseDate = purchaseDateTag ? new Date(parseInt(purchaseDateTag[1]) * 1000) : null;
      
      // Convert npub to hex pubkey
      let pubkey;
      try {
        if (purchaserNpub.startsWith('npub')) {
          const decoded = nip19.decode(purchaserNpub);
          pubkey = decoded.data;
        } else {
          pubkey = purchaserNpub; // Assume it's already hex
        }
      } catch (decodeError) {
        console.warn(`⚠️  Skipping event ${event.id}: invalid purchaser format`);
        continue;
      }
      
      // Validate tier and amount
      const expectedAmount = tier === 'captain' ? 10000 : 5000;
      if (amount !== expectedAmount) {
        console.warn(`⚠️  Amount mismatch for ${pubkey.substring(0, 16)}...: expected ${expectedAmount}, got ${amount}`);
      }
      
      // Categorize by tier
      if (tier === 'captain') {
        captains.push(pubkey);
      } else if (tier === 'member') {
        members.push(pubkey);
      } else {
        console.warn(`⚠️  Unknown tier "${tier}" for event ${event.id}`);
        continue;
      }
      
      processedEvents.push({
        id: event.id,
        pubkey,
        tier,
        amount,
        purchaseDate,
        eventDate: new Date(event.created_at * 1000)
      });
      
    } catch (error) {
      console.warn(`⚠️  Error processing event ${event.id}:`, error.message);
    }
  }
  
  // Remove duplicates (in case of multiple events from same user)
  const uniqueMembers = [...new Set(members)];
  const uniqueCaptains = [...new Set(captains)];
  
  console.log(`📊 Processing complete:`);
  console.log(`   • Members: ${uniqueMembers.length} (${members.length - uniqueMembers.length} duplicates removed)`);
  console.log(`   • Captains: ${uniqueCaptains.length} (${captains.length - uniqueCaptains.length} duplicates removed)`);
  console.log(`   • Total processed events: ${processedEvents.length}`);
  
  return {
    members: uniqueMembers,
    captains: uniqueCaptains,
    processedEvents
  };
}

/**
 * Create NIP-51 list event
 */
function createListEvent(listType, pubkeys, monthYear) {
  const dTag = `runstr-${listType}-${monthYear}`;
  const title = `RUNSTR ${listType.charAt(0).toUpperCase() + listType.slice(1)} Subscribers - ${monthYear}`;
  
  const tags = [
    ['d', dTag],
    ['name', title],
    ['description', `Active ${listType} tier subscribers for RUNSTR - ${monthYear}`],
    ['client', 'runstr'],
    ['client_version', '1.0.0']
  ];
  
  // Add pubkey tags
  for (const pubkey of pubkeys) {
    tags.push(['p', pubkey]);
  }
  
  return {
    kind: 30000, // NIP-51 list
    content: `Active RUNSTR ${listType} subscribers for ${monthYear}`,
    tags,
    created_at: Math.floor(Date.now() / 1000)
  };
}

/**
 * Publish subscription lists to Nostr
 */
async function publishLists(ndk, members, captains, monthYear) {
  console.log('📤 Publishing subscription lists to Nostr...');
  
  const results = [];
  
  // Create and publish member list
  if (members.length > 0) {
    try {
      const memberListEvent = createListEvent('members', members, monthYear);
      const ndkEvent = new ndk.Event(memberListEvent);
      await ndkEvent.publish();
      console.log(`✅ Published member list: ${members.length} subscribers`);
      results.push({ type: 'members', count: members.length, success: true });
    } catch (error) {
      console.error('❌ Failed to publish member list:', error);
      results.push({ type: 'members', count: members.length, success: false, error });
    }
  } else {
    console.log('ℹ️  No members to publish');
    results.push({ type: 'members', count: 0, success: true });
  }
  
  // Create and publish captain list
  if (captains.length > 0) {
    try {
      const captainListEvent = createListEvent('captains', captains, monthYear);
      const ndkEvent = new ndk.Event(captainListEvent);
      await ndkEvent.publish();
      console.log(`✅ Published captain list: ${captains.length} subscribers`);
      results.push({ type: 'captains', count: captains.length, success: true });
    } catch (error) {
      console.error('❌ Failed to publish captain list:', error);
      results.push({ type: 'captains', count: captains.length, success: false, error });
    }
  } else {
    console.log('ℹ️  No captains to publish');
    results.push({ type: 'captains', count: 0, success: true });
  }
  
  return results;
}

/**
 * Display detailed results
 */
function displayResults(members, captains, processedEvents, publishResults) {
  console.log('\n📈 SUBSCRIPTION MANAGEMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log(`\n📊 Subscriber Counts:`);
  console.log(`   Members:  ${members.length.toString().padStart(3)} subscribers`);
  console.log(`   Captains: ${captains.length.toString().padStart(3)} subscribers`);
  console.log(`   Total:    ${(members.length + captains.length).toString().padStart(3)} subscribers`);
  
  if (processedEvents.length > 0) {
    console.log(`\n📅 Event Analysis:`);
    console.log(`   Total events processed: ${processedEvents.length}`);
    
    const dateRange = processedEvents.reduce((range, event) => {
      const date = event.purchaseDate || event.eventDate;
      if (!range.earliest || date < range.earliest) range.earliest = date;
      if (!range.latest || date > range.latest) range.latest = date;
      return range;
    }, { earliest: null, latest: null });
    
    if (dateRange.earliest && dateRange.latest) {
      console.log(`   Date range: ${dateRange.earliest.toISOString().split('T')[0]} to ${dateRange.latest.toISOString().split('T')[0]}`);
    }
    
    const totalRevenue = processedEvents.reduce((sum, event) => sum + event.amount, 0);
    console.log(`   Total revenue: ${totalRevenue.toLocaleString()} sats`);
  }
  
  if (publishResults) {
    console.log(`\n📤 Publishing Results:`);
    for (const result of publishResults) {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.type}: ${result.count} subscribers ${result.success ? 'published' : 'failed'}`);
      if (!result.success && result.error) {
        console.log(`      Error: ${result.error.message}`);
      }
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Show help if requested
    if (flags.help) {
      showHelp();
      return;
    }
    
    console.log('🚀 RUNSTR Subscription Management Script');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Get target month-year
    const monthYear = getTargetMonthYear();
    console.log(`📅 Target period: ${monthYear}`);
    
    if (flags.dryRun) {
      console.log('🧪 DRY RUN MODE - No changes will be published');
    }
    
    // Initialize NDK
    const ndk = await initializeNDK();
    
    // Fetch subscription events
    const events = await fetchSubscriptionEvents(ndk, monthYear);
    
    if (events.length === 0) {
      console.log(`ℹ️  No subscription events found for ${monthYear}`);
      console.log('   This might be normal if:');
      console.log('   • No subscriptions were purchased this month');
      console.log('   • Events haven\'t been published yet');
      console.log('   • Relays don\'t have the events cached');
      return;
    }
    
    // Process events
    const { members, captains, processedEvents } = processSubscriptionEvents(events);
    
    let publishResults = null;
    
    // Publish lists (unless dry run)
    if (!flags.dryRun) {
      publishResults = await publishLists(ndk, members, captains, monthYear);
    } else {
      console.log('🧪 DRY RUN: Skipping publication to Nostr');
    }
    
    // Display results
    displayResults(members, captains, processedEvents, publishResults);
    
    console.log('✅ Script completed successfully');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();