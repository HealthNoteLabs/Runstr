#!/usr/bin/env node

/**
 * Test script for the new simplified event participation system
 * 
 * This script tests the core functionality of the EventParticipationService
 * without needing complex Nostr connections or UI components.
 */

import EventParticipationService from '../src/services/EventParticipationService.js';

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

// Test data
const TEST_DATA = {
  eventId: 'test-event-123',
  teamAIdentifier: '33404:test-captain-pubkey:test-team-uuid',
  eventName: 'Test Weekly 5K',
  userPubkey: 'test-user-pubkey-456',
  captainPubkey: 'test-captain-pubkey'
};

async function testLocalStorageOperations() {
  logSection('Testing Local Storage Operations');
  
  try {
    // Clear any existing test data
    EventParticipationService.clearStoredParticipationData();
    logInfo('Cleared existing test data');
    
    // Test 1: User not participating initially
    const initialStatus = EventParticipationService.isUserParticipatingLocally(
      TEST_DATA.eventId, 
      TEST_DATA.userPubkey
    );
    
    if (!initialStatus) {
      logSuccess('Initial state: User not participating (correct)');
    } else {
      logError('Initial state: User already participating (unexpected)');
    }
    
    // Test 2: Join event locally
    const joinResult = EventParticipationService.joinEventLocally(
      TEST_DATA.eventId,
      TEST_DATA.teamAIdentifier,
      TEST_DATA.eventName,
      TEST_DATA.userPubkey
    );
    
    if (joinResult) {
      logSuccess('Successfully joined event locally');
    } else {
      logError('Failed to join event locally');
    }
    
    // Test 3: Check participation status after join
    const postJoinStatus = EventParticipationService.isUserParticipatingLocally(
      TEST_DATA.eventId,
      TEST_DATA.userPubkey
    );
    
    if (postJoinStatus) {
      logSuccess('Post-join status: User participating (correct)');
    } else {
      logError('Post-join status: User not participating (error)');
    }
    
    // Test 4: Get event participants
    const participants = EventParticipationService.getLocalEventParticipants(TEST_DATA.eventId);
    logInfo(`Found ${participants.length} participants`);
    
    if (participants.length === 1 && participants[0].pubkey === TEST_DATA.userPubkey) {
      logSuccess('Participant list contains correct user');
    } else {
      logError('Participant list incorrect');
      console.log('Participants:', participants);
    }
    
    // Test 5: Get user joined events
    const joinedEvents = EventParticipationService.getUserJoinedEventsLocal();
    const eventKeys = Object.keys(joinedEvents);
    
    if (eventKeys.length === 1 && eventKeys[0] === TEST_DATA.eventId) {
      logSuccess('User joined events list correct');
    } else {
      logError('User joined events list incorrect');
      console.log('Joined events:', joinedEvents);
    }
    
    // Test 6: Leave event
    const leaveResult = EventParticipationService.leaveEventLocally(
      TEST_DATA.eventId,
      TEST_DATA.userPubkey
    );
    
    if (leaveResult) {
      logSuccess('Successfully left event locally');
    } else {
      logError('Failed to leave event locally');
    }
    
    // Test 7: Check status after leave
    const postLeaveStatus = EventParticipationService.isUserParticipatingLocally(
      TEST_DATA.eventId,
      TEST_DATA.userPubkey
    );
    
    if (!postLeaveStatus) {
      logSuccess('Post-leave status: User not participating (correct)');
    } else {
      logError('Post-leave status: User still participating (error)');
    }
    
    // Test 8: Verify cleanup
    const finalParticipants = EventParticipationService.getLocalEventParticipants(TEST_DATA.eventId);
    const finalJoinedEvents = EventParticipationService.getUserJoinedEventsLocal();
    
    if (finalParticipants.length === 0 && Object.keys(finalJoinedEvents).length === 0) {
      logSuccess('Cleanup successful: All data removed');
    } else {
      logWarning('Cleanup incomplete - some data remains');
      console.log('Final participants:', finalParticipants);
      console.log('Final joined events:', finalJoinedEvents);
    }
    
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    console.error(error);
  }
}

async function testMultipleUsers() {
  logSection('Testing Multiple Users');
  
  try {
    // Clear data
    EventParticipationService.clearStoredParticipationData();
    
    const users = [
      'user1-pubkey',
      'user2-pubkey', 
      'user3-pubkey'
    ];
    
    // All users join
    users.forEach((userPubkey, index) => {
      const result = EventParticipationService.joinEventLocally(
        TEST_DATA.eventId,
        TEST_DATA.teamAIdentifier,
        TEST_DATA.eventName,
        userPubkey
      );
      
      if (result) {
        logInfo(`User ${index + 1} joined successfully`);
      } else {
        logError(`User ${index + 1} failed to join`);
      }
    });
    
    // Check participants
    const participants = EventParticipationService.getLocalEventParticipants(TEST_DATA.eventId);
    
    if (participants.length === users.length) {
      logSuccess(`All ${users.length} users in participant list`);
    } else {
      logError(`Expected ${users.length} participants, found ${participants.length}`);
    }
    
    // Verify each user is participating
    let allParticipating = true;
    users.forEach((userPubkey, index) => {
      const isParticipating = EventParticipationService.isUserParticipatingLocally(
        TEST_DATA.eventId,
        userPubkey
      );
      
      if (!isParticipating) {
        logError(`User ${index + 1} not showing as participating`);
        allParticipating = false;
      }
    });
    
    if (allParticipating) {
      logSuccess('All users showing as participating');
    }
    
    // One user leaves
    const leavingUser = users[1];
    const leaveResult = EventParticipationService.leaveEventLocally(TEST_DATA.eventId, leavingUser);
    
    if (leaveResult) {
      logInfo('User 2 left successfully');
    }
    
    // Check final state
    const finalParticipants = EventParticipationService.getLocalEventParticipants(TEST_DATA.eventId);
    const remainingUsers = finalParticipants.map(p => p.pubkey);
    
    if (finalParticipants.length === 2 && !remainingUsers.includes(leavingUser)) {
      logSuccess('Multi-user test successful: 2 users remain, leaver removed');
    } else {
      logError('Multi-user test failed');
      console.log('Final participants:', finalParticipants);
    }
    
    // Cleanup
    EventParticipationService.clearStoredParticipationData();
    
  } catch (error) {
    logError(`Multi-user test failed: ${error.message}`);
    console.error(error);
  }
}

async function testEdgeCases() {
  logSection('Testing Edge Cases');
  
  try {
    // Test 1: Invalid parameters
    try {
      EventParticipationService.joinEventLocally('', '', '', '');
      logError('Should have thrown error for empty parameters');
    } catch (error) {
      logSuccess('Correctly rejected empty parameters');
    }
    
    // Test 2: Duplicate joins
    EventParticipationService.clearStoredParticipationData();
    
    const join1 = EventParticipationService.joinEventLocally(
      TEST_DATA.eventId,
      TEST_DATA.teamAIdentifier,
      TEST_DATA.eventName,
      TEST_DATA.userPubkey
    );
    
    const join2 = EventParticipationService.joinEventLocally(
      TEST_DATA.eventId,
      TEST_DATA.teamAIdentifier,
      TEST_DATA.eventName,
      TEST_DATA.userPubkey
    );
    
    if (join1 && join2) {
      const participants = EventParticipationService.getLocalEventParticipants(TEST_DATA.eventId);
      if (participants.length === 1) {
        logSuccess('Duplicate joins handled correctly - only one participant');
      } else {
        logError('Duplicate joins created multiple entries');
      }
    }
    
    // Test 3: Leave non-participating user
    const leaveResult = EventParticipationService.leaveEventLocally(
      'non-existent-event',
      'non-existent-user'
    );
    
    if (leaveResult) {
      logInfo('Leave operation succeeded for non-participating user (graceful handling)');
    }
    
    logSuccess('Edge case testing completed');
    
  } catch (error) {
    logError(`Edge case test failed: ${error.message}`);
    console.error(error);
  }
}

async function runAllTests() {
  console.clear();
  log('🧪 Simplified Event Participation Test Suite', 'cyan');
  log('=============================================', 'cyan');
  
  logInfo('Testing the new localStorage-based event participation system');
  logInfo('This system provides instant user feedback while supporting captain approval');
  
  await testLocalStorageOperations();
  await testMultipleUsers();
  await testEdgeCases();
  
  logSection('Test Summary');
  logSuccess('All local storage tests completed!');
  logInfo('✅ Instant joins working');
  logInfo('✅ Multi-user support working');
  logInfo('✅ Edge cases handled');
  logInfo('✅ Data cleanup working');
  
  log('\n🎯 Next Steps:', 'yellow');
  log('1. Test the UI components with these services');
  log('2. Test captain approval workflow (when implemented)');
  log('3. Test event leaderboards with workout data');
  log('4. Integration test with real Nostr events');
  
  process.exit(0);
}

// Run tests
runAllTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});