#!/usr/bin/env node

/**
 * Show Current User Levels Script
 * 
 * This script fetches all users and shows their current levels
 * without awarding any badges. Useful for previewing who would
 * receive badges in catchup mode.
 * 
 * Usage: node scripts/show-current-levels.mjs [--top=N]
 */

import 'dotenv/config';
import { LEVEL_SYSTEM, BADGE_TIERS } from './calculate-weekly-badges.mjs';
import { fetchEvents } from '../src/utils/nostr.js';

async function fetchAllWorkoutEvents() {
  console.log('Fetching 1301 workout events from relays...');
  
  const filter = {
    kinds: [1301],
    limit: 5000
  };

  try {
    const events = await fetchEvents(filter);
    const eventArray = Array.from(events).map(e => e.rawEvent ? e.rawEvent() : e);
    console.log(`Fetched ${eventArray.length} workout events`);
    return eventArray;
  } catch (error) {
    console.error('Error fetching events:', error);
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
  const args = process.argv.slice(2);
  const topArg = args.find(arg => arg.startsWith('--top='));
  const topN = topArg ? parseInt(topArg.split('=')[1]) : null;

  try {
    console.log('🏃‍♂️ RUNSTR Current Levels Overview\n');
    console.log('=' .repeat(50));
    
    // Fetch all workout events
    const events = await fetchAllWorkoutEvents();
    
    if (events.length === 0) {
      console.log('No workout events found. Exiting.');
      return;
    }
    
    // Group events by author and calculate stats
    console.log('Calculating user statistics...');
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
    
    console.log(`\nFound ${userStats.length} users with qualifying workouts\n`);
    
    // Show top users or all users
    const usersToShow = topN ? userStats.slice(0, topN) : userStats;
    const totalUsers = userStats.length;
    
    if (topN && topN < totalUsers) {
      console.log(`📊 TOP ${topN} USERS BY LEVEL:`);
    } else {
      console.log(`📊 ALL USERS BY LEVEL:`);
    }
    console.log('=' .repeat(80));
    
    usersToShow.forEach((user, index) => {
      const rank = index + 1;
      const npubShort = `${user.npub.slice(0, 8)}...${user.npub.slice(-8)}`;
      
      // Get highest badge for this level
      const availableBadges = Object.entries(BADGE_TIERS)
        .filter(([level, _]) => user.currentLevel >= parseInt(level))
        .map(([level, badge]) => ({ level: parseInt(level), ...badge }));
      
      const highestBadge = availableBadges.length > 0 
        ? availableBadges[availableBadges.length - 1]
        : { name: "No Badge Yet", level: 0 };
      
      console.log(`${rank.toString().padStart(3)}. Level ${user.currentLevel.toString().padStart(2)} | ${npubShort} | ${user.totalXP.toString().padStart(4)} XP | ${user.qualifyingWorkouts.toString().padStart(2)} workouts`);
      console.log(`     🏆 ${highestBadge.name} | ${user.totalDistanceKm}km total`);
      
      if (user.currentLevel >= 1) {
        const badgeCount = availableBadges.length;
        console.log(`     📊 Would receive ${badgeCount} badge${badgeCount !== 1 ? 's' : ''} in catchup mode (Levels 1-${user.currentLevel})`);
      }
      console.log('');
    });
    
    // Summary statistics
    console.log('📈 SUMMARY STATISTICS');
    console.log('=' .repeat(50));
    
    const levelCounts = {};
    for (let i = 1; i <= 21; i++) {
      levelCounts[i] = userStats.filter(u => u.currentLevel === i).length;
    }
    
    console.log('Users by Level:');
    Object.entries(levelCounts)
      .filter(([_, count]) => count > 0)
      .forEach(([level, count]) => {
        const badge = BADGE_TIERS[level];
        console.log(`  Level ${level.padStart(2)}: ${count.toString().padStart(2)} user${count !== 1 ? 's' : ''} - ${badge.name}`);
      });
    
    const totalBadgesInCatchup = userStats.reduce((sum, user) => sum + user.currentLevel, 0);
    console.log(`\nTotal badges that would be awarded in catchup mode: ${totalBadgesInCatchup}`);
    console.log(`Average level: ${(userStats.reduce((sum, u) => sum + u.currentLevel, 0) / userStats.length).toFixed(1)}`);
    console.log(`Highest level: ${Math.max(...userStats.map(u => u.currentLevel))}`);
    console.log(`Total qualifying workouts across all users: ${userStats.reduce((sum, u) => sum + u.qualifyingWorkouts, 0)}`);
    
    console.log('\n🎯 NEXT STEPS');
    console.log('=' .repeat(50));
    console.log('To award badges to existing users, run:');
    console.log('  node scripts/calculate-weekly-badges.mjs --catchup --dry-run  (preview first)');
    console.log('  node scripts/calculate-weekly-badges.mjs --catchup              (award badges)');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}