#!/usr/bin/env node

/**
 * Quick Badge Test Script
 * 
 * This script fetches a small number of recent 1301 workout events 
 * to test the badge calculation logic without timing out.
 * 
 * Usage: node scripts/quick-badge-test.mjs
 */

import 'dotenv/config';
import { LEVEL_SYSTEM, BADGE_TIERS } from './calculate-weekly-badges.mjs';
import { fetchEvents } from '../src/utils/nostr.js';

async function fetchRecentWorkoutEvents() {
  console.log('Fetching recent 1301 workout events (limited)...');
  
  const filter = {
    kinds: [1301],
    limit: 50  // Small limit for testing
  };

  try {
    console.log('Attempting to fetch events...');
    const events = await fetchEvents(filter);
    const eventArray = Array.from(events).map(e => e.rawEvent ? e.rawEvent() : e);
    console.log(`✅ Successfully fetched ${eventArray.length} workout events`);
    return eventArray;
  } catch (error) {
    console.error('❌ Error fetching events:', error);
    throw error;
  }
}

function groupEventsByAuthor(events) {
  const userEvents = {};
  
  events.forEach(event => {
    const author = event.pubkey;
    if (!userEvents[author]) {
      userEvents[author] = [];
    }
    userEvents[author].push(event);
  });

  return userEvents;
}

function calculateUserStats(events) {
  let totalXP = 0;
  let qualifyingWorkouts = 0;
  let totalDistanceKm = 0;

  events.forEach(event => {
    const distTag = event.tags?.find(t => t[0] === 'distance');
    
    if (distTag) {
      const val = parseFloat(distTag[1]);
      const unit = distTag[2] || 'km';
      
      if (!isNaN(val)) {
        const distanceKm = unit === 'km' ? val : (val * 1.609344);
        totalDistanceKm += distanceKm;

        const distanceInMiles = unit === 'km' ? (val * 0.621371) : val;
        const workoutXP = LEVEL_SYSTEM.calculateWorkoutXP(distanceInMiles);
        
        if (workoutXP > 0) {
          totalXP += workoutXP;
          qualifyingWorkouts++;
        }
      }
    }
  });

  const currentLevel = LEVEL_SYSTEM.calculateLevelFromXP(totalXP);
  
  return {
    totalXP,
    currentLevel,
    qualifyingWorkouts,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    totalWorkouts: events.length
  };
}

async function main() {
  try {
    console.log('🏃‍♂️ RUNSTR Quick Badge Test\n');
    console.log('=' .repeat(50));
    
    // Fetch recent workout events
    const events = await fetchRecentWorkoutEvents();
    
    if (events.length === 0) {
      console.log('⚠️  No workout events found in recent data.');
      console.log('This could mean:');
      console.log('- Relay connection issues');
      console.log('- No recent 1301 events published');
      console.log('- Network timeout');
      return;
    }
    
    // Group events by author and calculate stats
    console.log('\nProcessing events by author...');
    const userEvents = groupEventsByAuthor(events);
    const userStats = [];
    
    for (const [author, authorEvents] of Object.entries(userEvents)) {
      const stats = calculateUserStats(authorEvents);
      if (stats.currentLevel > 0) {  // Only include users with qualifying workouts
        userStats.push({
          npub: author,
          ...stats
        });
      }
    }
    
    // Sort by level (highest first), then by XP
    userStats.sort((a, b) => {
      if (b.currentLevel !== a.currentLevel) {
        return b.currentLevel - a.currentLevel;
      }
      return b.totalXP - a.totalXP;
    });
    
    console.log(`\n📊 FOUND ${userStats.length} USERS WITH QUALIFYING WORKOUTS`);
    console.log('=' .repeat(70));
    
    if (userStats.length === 0) {
      console.log('No users found with qualifying workouts (≥1 mile distance)');
      console.log('\nDEBUG: Sample events found:');
      events.slice(0, 3).forEach((event, i) => {
        console.log(`\nEvent ${i + 1}:`);
        console.log(`  Author: ${event.pubkey}`);
        console.log(`  Tags:`, event.tags?.slice(0, 5) || 'No tags');
      });
      return;
    }
    
    userStats.forEach((user, index) => {
      const rank = index + 1;
      const npubShort = `${user.npub.slice(0, 12)}...${user.npub.slice(-8)}`;
      
      // Get badges for this level
      const earnedBadges = [];
      for (const [threshold, badgeInfo] of Object.entries(BADGE_TIERS)) {
        if (user.currentLevel >= parseInt(threshold)) {
          earnedBadges.push({ level: parseInt(threshold), name: badgeInfo.name });
        }
      }
      
      const highestBadge = earnedBadges.length > 0 
        ? earnedBadges[earnedBadges.length - 1]
        : { name: "No Badge Yet", level: 0 };
      
      console.log(`${rank.toString().padStart(2)}. Level ${user.currentLevel.toString().padStart(2)} | ${npubShort}`);
      console.log(`    XP: ${user.totalXP.toString().padStart(4)} | Workouts: ${user.qualifyingWorkouts.toString().padStart(2)} | Distance: ${user.totalDistanceKm}km`);
      console.log(`    🏆 Highest Badge: ${highestBadge.name}`);
      
      if (earnedBadges.length > 0) {
        console.log(`    📊 Would receive ${earnedBadges.length} badge${earnedBadges.length !== 1 ? 's' : ''} in catchup (Levels 1-${user.currentLevel})`);
      }
      console.log('');
    });
    
    // Summary for catchup
    console.log('🎯 CATCHUP BADGE SUMMARY');
    console.log('=' .repeat(50));
    const totalBadgesNeeded = userStats.reduce((sum, user) => sum + user.currentLevel, 0);
    console.log(`Total users needing badges: ${userStats.length}`);
    console.log(`Total badges to award in catchup: ${totalBadgesNeeded}`);
    console.log(`Highest level found: ${Math.max(...userStats.map(u => u.currentLevel))}`);
    
    // Users by level breakdown
    console.log('\nUsers by Level:');
    const levelCounts = {};
    userStats.forEach(user => {
      levelCounts[user.currentLevel] = (levelCounts[user.currentLevel] || 0) + 1;
    });
    
    Object.entries(levelCounts)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .forEach(([level, count]) => {
        const badge = BADGE_TIERS[level];
        console.log(`  Level ${level.padStart(2)}: ${count} user${count !== 1 ? 's' : ''} - ${badge?.name || 'Unknown Badge'}`);
      });
    
    console.log('\n✅ TEST SUCCESSFUL!');
    console.log('\nNext step: Run the full catchup with all events:');
    console.log('  node scripts/calculate-weekly-badges.mjs --catchup --dry-run');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Provide troubleshooting help
    console.log('\n🔧 TROUBLESHOOTING TIPS:');
    console.log('1. Check your internet connection');
    console.log('2. Verify Nostr relays are accessible');
    console.log('3. Try again in a few minutes (relay issues)');
    console.log('4. Check if the NDK singleton is properly configured');
    
    process.exit(1);
  }
}

// Run the test
main();