#!/usr/bin/env node

/**
 * Test Script for Badge Calculation Logic
 * 
 * This script tests the badge calculation logic with mock data
 * to ensure it works correctly before running on real Nostr data.
 */

import { LEVEL_SYSTEM, BADGE_TIERS } from './calculate-weekly-badges.mjs';

// Mock workout events for testing
const createMockEvent = (pubkey, distance, unit = 'km', createdAt = null) => ({
  pubkey,
  created_at: createdAt || Math.floor(Date.now() / 1000),
  tags: [
    ['distance', distance.toString(), unit]
  ]
});

// Test data: users with different workout patterns
const mockUsers = {
  'user1_beginner': [
    createMockEvent('user1', 2.0, 'km'),  // 10 XP (below 1 mile)
    createMockEvent('user1', 3.2, 'km'),  // 10 XP (1.98 miles)
    createMockEvent('user1', 1.8, 'km'),  // 10 XP (1.11 miles)
  ],
  'user2_intermediate': [
    createMockEvent('user2', 5.0, 'km'),  // 20 XP (3.1 miles)
    createMockEvent('user2', 10.0, 'km'), // 35 XP (6.2 miles)
    createMockEvent('user2', 8.0, 'km'),  // 25 XP (4.97 miles)
    createMockEvent('user2', 6.4, 'km'),  // 20 XP (3.98 miles)
    createMockEvent('user2', 3.2, 'km'),  // 10 XP (1.98 miles)
  ],
  'user3_advanced': [
    ...Array.from({length: 20}, (_, i) => createMockEvent('user3', 8.0, 'km')), // 20 * 25 XP = 500 XP
    ...Array.from({length: 15}, (_, i) => createMockEvent('user3', 16.0, 'km')), // 15 * 55 XP = 825 XP
    createMockEvent('user3', 42.2, 'km'), // Marathon: 145 XP
  ]
};

function calculateMockStats(events) {
  let totalXP = 0;
  let qualifyingWorkouts = 0;

  events.forEach(event => {
    const distTag = event.tags?.find(t => t[0] === 'distance');
    if (distTag) {
      const val = parseFloat(distTag[1]);
      const unit = distTag[2] || 'km';
      
      const distanceInMiles = unit === 'km' ? (val * 0.621371) : val;
      const workoutXP = LEVEL_SYSTEM.calculateWorkoutXP(distanceInMiles);
      
      if (workoutXP > 0) {
        totalXP += workoutXP;
        qualifyingWorkouts++;
      }
    }
  });

  const currentLevel = LEVEL_SYSTEM.calculateLevelFromXP(totalXP);
  
  return {
    totalXP,
    currentLevel,
    qualifyingWorkouts,
    totalWorkouts: events.length
  };
}

function testBadgeCalculation() {
  console.log('🧪 Testing Badge Calculation Logic\n');
  console.log('=' .repeat(50));
  
  // Test each mock user
  Object.entries(mockUsers).forEach(([userId, events]) => {
    const stats = calculateMockStats(events);
    
    console.log(`\n👤 ${userId.toUpperCase()}`);
    console.log(`   Workouts: ${stats.totalWorkouts}`);
    console.log(`   Qualifying Workouts: ${stats.qualifyingWorkouts}`);
    console.log(`   Total XP: ${stats.totalXP}`);
    console.log(`   Current Level: ${stats.currentLevel}`);
    
    // Check which badges this user would earn
    const earnedBadges = [];
    for (const [threshold, badgeInfo] of Object.entries(BADGE_TIERS)) {
      if (stats.currentLevel >= parseInt(threshold)) {
        earnedBadges.push(`Level ${threshold}: ${badgeInfo.name}`);
      }
    }
    
    if (earnedBadges.length > 0) {
      console.log(`   Eligible Badges: ${earnedBadges.join(', ')}`);
    } else {
      console.log(`   Eligible Badges: None yet`);
    }
  });
  
  // Test level progression scenarios
  console.log('\n\n🎯 Testing Level Progression Scenarios');
  console.log('=' .repeat(50));
  
  const testScenarios = [
    { description: 'New user, first run', previousLevel: 0, currentLevel: 1 },
    { description: 'User reaches Bronze (Level 5)', previousLevel: 4, currentLevel: 5 },
    { description: 'User reaches Silver (Level 10)', previousLevel: 9, currentLevel: 10 },
    { description: 'User jumps multiple levels', previousLevel: 8, currentLevel: 12 },
    { description: 'User reaches high level', previousLevel: 24, currentLevel: 25 }
  ];
  
  testScenarios.forEach((scenario, index) => {
    console.log(`\n${index + 1}. ${scenario.description}`);
    console.log(`   Progress: Level ${scenario.previousLevel} → ${scenario.currentLevel}`);
    
    const earnedBadges = [];
    for (const [threshold, badgeInfo] of Object.entries(BADGE_TIERS)) {
      const thresholdNum = parseInt(threshold);
      if (scenario.currentLevel >= thresholdNum && scenario.previousLevel < thresholdNum) {
        earnedBadges.push(`${badgeInfo.name} (Level ${threshold})`);
      }
    }
    
    if (earnedBadges.length > 0) {
      console.log(`   New Badges: ${earnedBadges.join(', ')}`);
    } else {
      console.log(`   New Badges: None`);
    }
  });
  
  // Test XP calculation edge cases
  console.log('\n\n🔬 Testing XP Calculation Edge Cases');
  console.log('=' .repeat(50));
  
  const distanceTests = [
    { distance: 0.5, unit: 'mi', expected: 0 },     // Below threshold
    { distance: 0.9, unit: 'mi', expected: 0 },     // Below threshold
    { distance: 1.0, unit: 'mi', expected: 10 },    // Exactly 1 mile
    { distance: 1.1, unit: 'mi', expected: 10 },    // Just over 1 mile
    { distance: 2.0, unit: 'mi', expected: 15 },    // 2 miles
    { distance: 5.0, unit: 'mi', expected: 30 },    // 5 miles
    { distance: 1.6, unit: 'km', expected: 0 },     // 1 km = 0.62 miles (below threshold)
    { distance: 2.0, unit: 'km', expected: 10 },    // 2 km = 1.24 miles
    { distance: 5.0, unit: 'km', expected: 20 },    // 5 km = 3.1 miles
    { distance: 10.0, unit: 'km', expected: 35 }    // 10 km = 6.2 miles
  ];
  
  distanceTests.forEach((test, index) => {
    const distanceInMiles = test.unit === 'km' ? (test.distance * 0.621371) : test.distance;
    const actualXP = LEVEL_SYSTEM.calculateWorkoutXP(distanceInMiles);
    const passed = actualXP === test.expected;
    
    console.log(`${index + 1}. ${test.distance} ${test.unit} → ${actualXP} XP ${passed ? '✅' : '❌'}`);
    if (!passed) {
      console.log(`   Expected: ${test.expected} XP`);
    }
  });
  
  console.log('\n🎉 Badge calculation testing completed!');
  console.log('\nNext steps:');
  console.log('1. Review the test results above');
  console.log('2. If everything looks correct, run: node scripts/calculate-weekly-badges.mjs --dry-run');
  console.log('3. Test with real data using the dry-run flag first');
}

// Run tests
testBadgeCalculation();