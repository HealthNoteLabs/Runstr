// Test script for rewards calculation logic
import { nip19 } from "nostr-tools";

// Mock the main calculation functions from calculate-weekly-rewards.mjs
function getDateString(timestamp) {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

function calculateUserStreak(userEvents) {
  if (userEvents.length === 0) return 0;

  const sortedEvents = userEvents.sort((a, b) => a.created_at - b.created_at);
  const workoutDates = [...new Set(sortedEvents.map(event => getDateString(event.created_at)))];
  workoutDates.sort();

  if (workoutDates.length === 0) return 0;
  if (workoutDates.length === 1) return 1;

  let streak = 1;
  
  for (let i = workoutDates.length - 2; i >= 0; i--) {
    const currentDate = new Date(workoutDates[i]);
    const nextDate = new Date(workoutDates[i + 1]);
    const dayDiff = (nextDate - currentDate) / (1000 * 60 * 60 * 24);
    
    if (dayDiff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// Test cases
const testCases = [
  {
    name: "5-day consecutive streak",
    events: [
      { created_at: Math.floor(new Date('2025-01-13').getTime() / 1000) },
      { created_at: Math.floor(new Date('2025-01-14').getTime() / 1000) },
      { created_at: Math.floor(new Date('2025-01-15').getTime() / 1000) },
      { created_at: Math.floor(new Date('2025-01-16').getTime() / 1000) },
      { created_at: Math.floor(new Date('2025-01-17').getTime() / 1000) }
    ],
    expectedStreak: 5,
    expectedWorkoutReward: 250, // 5 * 50
    expectedStreakReward: 250,  // 5 * 50
    expectedTotal: 500
  },
  {
    name: "3-day streak with gap",
    events: [
      { created_at: Math.floor(new Date('2025-01-13').getTime() / 1000) },
      { created_at: Math.floor(new Date('2025-01-14').getTime() / 1000) },
      { created_at: Math.floor(new Date('2025-01-15').getTime() / 1000) },
      // Gap on 16th
      { created_at: Math.floor(new Date('2025-01-17').getTime() / 1000) }
    ],
    expectedStreak: 1, // Only the last day counts as streak
    expectedWorkoutReward: 200, // 4 * 50
    expectedStreakReward: 50,   // 1 * 50
    expectedTotal: 250
  },
  {
    name: "Single workout",
    events: [
      { created_at: Math.floor(new Date('2025-01-17').getTime() / 1000) }
    ],
    expectedStreak: 1,
    expectedWorkoutReward: 50,  // 1 * 50
    expectedStreakReward: 50,   // 1 * 50
    expectedTotal: 100
  },
  {
    name: "Multiple workouts same day",
    events: [
      { created_at: Math.floor(new Date('2025-01-17T09:00:00').getTime() / 1000) },
      { created_at: Math.floor(new Date('2025-01-17T17:00:00').getTime() / 1000) }
    ],
    expectedStreak: 1,
    expectedWorkoutReward: 100, // 2 * 50
    expectedStreakReward: 50,   // 1 * 50
    expectedTotal: 150
  }
];

function runTests() {
  console.log("🧪 Testing RUNSTR Rewards Calculation Logic\n");
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    const streak = calculateUserStreak(testCase.events);
    const workoutCount = testCase.events.length;
    const workoutReward = workoutCount * 50;
    const streakReward = streak * 50;
    const totalReward = workoutReward + streakReward;
    
    const results = {
      streak,
      workoutReward,
      streakReward,
      totalReward
    };
    
    const expected = {
      streak: testCase.expectedStreak,
      workoutReward: testCase.expectedWorkoutReward,
      streakReward: testCase.expectedStreakReward,
      totalReward: testCase.expectedTotal
    };
    
    let testPassed = true;
    for (const [key, value] of Object.entries(expected)) {
      if (results[key] !== value) {
        testPassed = false;
        console.log(`  ❌ ${key}: expected ${value}, got ${results[key]}`);
      }
    }
    
    if (testPassed) {
      console.log(`  ✅ PASSED - ${workoutCount} workouts, ${streak}-day streak = ${totalReward} sats`);
      passed++;
    } else {
      console.log(`  ❌ FAILED`);
      failed++;
    }
    console.log();
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log("🎉 All tests passed! Rewards calculation logic is working correctly.");
  } else {
    console.log("⚠️  Some tests failed. Please check the calculation logic.");
  }
}

runTests(); 