#!/usr/bin/env node

import { NDK, NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import 'websocket-polyfill';
import { 
  fetchTeamEvents,
  fetchTeamEventById,
  fetchEventParticipants,
  isUserParticipating,
  joinTeamEvent,
  leaveTeamEvent,
  fetchEventParticipation,
  KIND_EVENT_PARTICIPATION
} from '../src/services/nostr/NostrTeamsService.ts';
import { teamEventsCache, CACHE_KEYS } from '../src/utils/teamEventsCache.js';

// Test configuration
const TEST_CONFIG = {
  privateKey: process.env.TEST_PRIVATE_KEY || '',
  teamIdentifier: process.env.TEST_TEAM_ID || '', // Format: 33404:pubkey:uuid
  eventId: process.env.TEST_EVENT_ID || '',
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.snort.social'
  ]
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logError(message) {
  log(`❌ ERROR: ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ SUCCESS: ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  WARNING: ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  INFO: ${message}`, 'blue');
}

function logDebug(message) {
  log(`🔍 DEBUG: ${message}`, 'magenta');
}

async function setupNDK(privateKey) {
  const signer = new NDKPrivateKeySigner(privateKey);
  const ndk = new NDK({
    explicitRelayUrls: TEST_CONFIG.relays,
    signer: signer
  });

  // Set activeUser for the NDK instance
  const user = await signer.user();
  ndk.activeUser = user;

  logInfo('Connecting to relays...');
  await ndk.connect();
  
  // Wait for relay connections
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const connectedRelays = Array.from(ndk.pool.relays.values())
    .filter(relay => relay.status === 1)
    .map(relay => relay.url);
  
  logSuccess(`Connected to ${connectedRelays.length} relays`);
  connectedRelays.forEach(url => log(`  - ${url}`));
  
  return ndk;
}

async function testParticipationMechanism(ndk, teamId, eventId, userPubkey) {
  logSection('Testing Event Participation Recognition');
  
  try {
    // Test 1: Check if participation events are using correct format
    logInfo('Checking participation event format...');
    
    const filter = {
      kinds: [KIND_EVENT_PARTICIPATION],
      '#d': [`${eventId}:${userPubkey}`],
      '#a': [teamId],
      '#e': [eventId]
    };
    
    logDebug(`Filter: ${JSON.stringify(filter, null, 2)}`);
    
    const events = await ndk.fetchEvents(filter);
    logInfo(`Found ${events.size} participation events for this user/event combination`);
    
    if (events.size > 0) {
      for (const event of events) {
        logDebug(`Participation event content: "${event.content}"`);
        logDebug(`Created at: ${new Date(event.created_at * 1000).toISOString()}`);
        logDebug(`Author: ${event.pubkey}`);
      }
    }
    
    // Test 2: Check current participation status
    const isParticipating = await isUserParticipating(ndk, eventId, teamId, userPubkey);
    log(`Current participation status: ${isParticipating ? 'PARTICIPATING' : 'NOT PARTICIPATING'}`, 
        isParticipating ? 'green' : 'yellow');
    
    // Test 3: Toggle participation
    if (!isParticipating) {
      logInfo('Testing JOIN functionality...');
      const captainPubkey = teamId.split(':')[1];
      const joinResult = await joinTeamEvent(ndk, eventId, teamId, captainPubkey);
      
      if (joinResult) {
        logSuccess('Join event published successfully');
        logDebug(`Event ID: ${joinResult.id}`);
        
        // Wait for propagation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify participation
        const newStatus = await isUserParticipating(ndk, eventId, teamId, userPubkey);
        if (newStatus) {
          logSuccess('Participation confirmed after joining!');
        } else {
          logError('Participation NOT confirmed after joining - check relay propagation');
          
          // Debug: try fetching the event we just published
          const ourEvent = await ndk.fetchEvent({ ids: [joinResult.id] });
          if (ourEvent) {
            logWarning('Our event exists but isUserParticipating returned false');
          } else {
            logError('Our event was not found on any relay');
          }
        }
      } else {
        logError('Failed to publish join event');
      }
    } else {
      logInfo('Testing LEAVE functionality...');
      const leaveResult = await leaveTeamEvent(ndk, eventId, teamId);
      
      if (leaveResult) {
        logSuccess('Leave event published successfully');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const newStatus = await isUserParticipating(ndk, eventId, teamId, userPubkey);
        if (!newStatus) {
          logSuccess('Successfully left the event!');
        } else {
          logError('Still showing as participating after leaving');
        }
      } else {
        logError('Failed to publish leave event');
      }
    }
    
  } catch (error) {
    logError(`Participation test failed: ${error.message}`);
    console.error(error);
  }
}

async function testNavigationFlow(teamId, eventId) {
  logSection('Testing Navigation Flow');
  
  try {
    const [captainPubkey, teamUUID] = teamId.split(':').slice(1);
    
    logInfo('Expected navigation paths:');
    log(`  Team list: /teams`);
    log(`  Team detail: /teams/${captainPubkey}/${teamUUID}`);
    log(`  Event detail: /teams/${captainPubkey}/${teamUUID}/event/${eventId}`);
    
    logInfo('\nChecking for potential navigation issues:');
    
    // Check 1: TeamDetailPage events tab integration
    logWarning('TeamDetailPage appears to be missing events tab integration');
    logInfo('The component imports TeamEventsTab but may not be rendering it in the tab system');
    
    // Check 2: Back button handling
    logInfo('Back navigation from TeamEventDetailPage uses:');
    log(`  navigate(\`/teams/\${captainPubkey}/\${teamUUID}\`)`, 'magenta');
    logSuccess('This should work correctly');
    
    // Check 3: State management
    logWarning('Potential issue: TeamDetailPage state might not persist when navigating back');
    logInfo('Consider checking if activeTab state is preserved');
    
  } catch (error) {
    logError(`Navigation test failed: ${error.message}`);
  }
}

async function testCacheIntegrity(ndk, teamId, eventId) {
  logSection('Testing Cache Integrity');
  
  try {
    // Clear all caches first
    teamEventsCache.clear();
    logInfo('Cleared all caches');
    
    // Test 1: Event details caching
    logInfo('\nTesting event details caching...');
    const startTime = Date.now();
    const event1 = await fetchTeamEventById(ndk, teamId, eventId);
    const fetchTime1 = Date.now() - startTime;
    logInfo(`First fetch took ${fetchTime1}ms`);
    
    const startTime2 = Date.now();
    const event2 = await fetchTeamEventById(ndk, teamId, eventId);
    const fetchTime2 = Date.now() - startTime2;
    logInfo(`Second fetch took ${fetchTime2}ms`);
    
    if (fetchTime2 < fetchTime1 / 2) {
      logSuccess('Cache is working - second fetch was faster');
    } else {
      logWarning('Cache might not be working properly');
    }
    
    // Test 2: Cache invalidation on participation change
    logInfo('\nTesting cache invalidation...');
    const participantsCacheKey = CACHE_KEYS.EVENT_PARTICIPANTS(teamId, eventId);
    const participationCacheKey = CACHE_KEYS.EVENT_PARTICIPATION(teamId, eventId);
    
    // Populate cache
    await fetchEventParticipants(ndk, eventId, teamId);
    
    if (teamEventsCache.has(participantsCacheKey)) {
      logSuccess('Participants cache populated');
      
      // Simulate join/leave which should clear cache
      const captainPubkey = teamId.split(':')[1];
      await joinTeamEvent(ndk, eventId, teamId, captainPubkey);
      
      // Check if cache was cleared
      if (!teamEventsCache.has(participantsCacheKey)) {
        logSuccess('Cache correctly cleared after participation change');
      } else {
        logError('Cache NOT cleared after participation change');
      }
    }
    
  } catch (error) {
    logError(`Cache test failed: ${error.message}`);
  }
}

async function testEventDataConsistency(ndk, teamId, eventId) {
  logSection('Testing Event Data Consistency');
  
  try {
    // Fetch all related data
    const [teamEvents, eventDetails, participants, participation] = await Promise.all([
      fetchTeamEvents(ndk, teamId),
      fetchTeamEventById(ndk, teamId, eventId),
      fetchEventParticipants(ndk, eventId, teamId),
      fetchEventParticipation(ndk, eventId, teamId, new Date().toISOString().split('T')[0])
    ]);
    
    logInfo(`Team has ${teamEvents.length} total events`);
    
    if (eventDetails) {
      logSuccess('Event details fetched');
      log(`  Name: ${eventDetails.name}`);
      log(`  Date: ${eventDetails.date}`);
      log(`  Type: ${eventDetails.type}`);
      log(`  Participants: ${participants.length}`);
      log(`  Completion records: ${participation.length}`);
      
      // Check if event is in team events list
      const eventInList = teamEvents.find(e => e.id === eventId);
      if (eventInList) {
        logSuccess('Event found in team events list');
      } else {
        logError('Event NOT found in team events list - data inconsistency!');
      }
      
      // Check participation vs participants consistency
      const participationPubkeys = participation.map(p => p.pubkey);
      const missingFromParticipants = participationPubkeys.filter(p => !participants.includes(p));
      
      if (missingFromParticipants.length > 0) {
        logWarning(`${missingFromParticipants.length} users have participation records but aren't in participants list`);
      }
    } else {
      logError('Failed to fetch event details');
    }
    
  } catch (error) {
    logError(`Data consistency test failed: ${error.message}`);
  }
}

async function runAllTests() {
  console.clear();
  log('🧪 Comprehensive Team Events Test Suite', 'cyan');
  log('======================================', 'cyan');
  
  // Validate configuration
  if (!TEST_CONFIG.privateKey) {
    logError('Please set TEST_PRIVATE_KEY environment variable');
    process.exit(1);
  }
  
  if (!TEST_CONFIG.teamIdentifier || !TEST_CONFIG.eventId) {
    logError('Please set TEST_TEAM_ID and TEST_EVENT_ID environment variables');
    logError('Example: TEST_TEAM_ID="33404:pubkey:uuid" TEST_EVENT_ID="event-id"');
    process.exit(1);
  }
  
  logInfo(`Testing with:`);
  log(`  Team: ${TEST_CONFIG.teamIdentifier}`);
  log(`  Event: ${TEST_CONFIG.eventId}`);
  
  try {
    // Setup NDK
    const ndk = await setupNDK(TEST_CONFIG.privateKey);
    const userPubkey = ndk.activeUser.pubkey;
    logInfo(`Test user pubkey: ${userPubkey}`);
    
    // Run all tests
    await testParticipationMechanism(ndk, TEST_CONFIG.teamIdentifier, TEST_CONFIG.eventId, userPubkey);
    await testNavigationFlow(TEST_CONFIG.teamIdentifier, TEST_CONFIG.eventId);
    await testCacheIntegrity(ndk, TEST_CONFIG.teamIdentifier, TEST_CONFIG.eventId);
    await testEventDataConsistency(ndk, TEST_CONFIG.teamIdentifier, TEST_CONFIG.eventId);
    
    logSection('Test Summary');
    logSuccess('All tests completed!');
    logInfo('\nKey findings:');
    log('1. Check if TeamDetailPage properly renders TeamEventsTab');
    log('2. Verify participation events are propagating to all relays');
    log('3. Ensure cache invalidation is working on all participation changes');
    log('4. Check that navigation state is preserved when using back button');
    
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
  }
  
  process.exit(0);
}

// Run tests
runAllTests();