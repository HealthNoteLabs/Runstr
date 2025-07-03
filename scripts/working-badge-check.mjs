#!/usr/bin/env node

/**
 * Working Badge Check Script
 * 
 * Based on the successful fetch-weekly-workouts.mjs pattern
 * This fetches 1301 workout events and calculates badges needed
 * 
 * Usage: node scripts/working-badge-check.mjs
 */

import NDK from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

// Configuration
const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol", 
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
  "wss://relay.snort.social"
];

const FETCH_TIMEOUT_MS = 15000; // 15-second timeout
const SIX_MONTHS_IN_SECONDS = 6 * 30 * 24 * 60 * 60; // 6 months of history

// Badge tier definitions (Level 1-21)
const BADGE_TIERS = {
  1: { name: "First Steps", description: "Reached Level 1 - Your fitness journey begins!" },
  2: { name: "Getting Started", description: "Reached Level 2 - Building momentum" },
  3: { name: "Early Achiever", description: "Reached Level 3 - Consistency pays off" },
  4: { name: "Steady Runner", description: "Reached Level 4 - Finding your rhythm" },
  5: { name: "Bronze Runner", description: "Reached Level 5 - First major milestone!" },
  6: { name: "Committed Athlete", description: "Reached Level 6 - Dedication showing" },
  7: { name: "Weekly Warrior", description: "Reached Level 7 - Regular training habit" },
  8: { name: "Distance Destroyer", description: "Reached Level 8 - Crushing those miles" },
  9: { name: "Almost Elite", description: "Reached Level 9 - Approaching greatness" },
  10: { name: "Silver Athlete", description: "Reached Level 10 - Elite achievement unlocked!" },
  11: { name: "Double Digits", description: "Reached Level 11 - Into elite territory" },
  12: { name: "Dozen Master", description: "Reached Level 12 - A full year of dedication" },
  13: { name: "Lucky Thirteen", description: "Reached Level 13 - Pushing boundaries" },
  14: { name: "Fortnight Fighter", description: "Reached Level 14 - Unstoppable force" },
  15: { name: "Gold Champion", description: "Reached Level 15 - Championship caliber!" },
  16: { name: "Sweet Sixteen", description: "Reached Level 16 - Peak performance zone" },
  17: { name: "Magnificent Seventeen", description: "Reached Level 17 - Legendary status" },
  18: { name: "Endurance Expert", description: "Reached Level 18 - Master of distance" },
  19: { name: "Penultimate Power", description: "Reached Level 19 - Almost at the peak" },
  20: { name: "Platinum Legend", description: "Reached Level 20 - Ultimate achievement!" },
  21: { name: "Beyond Limits", description: "Reached Level 21 - Transcendent runner!" }
};

// Level system functions
const calculateWorkoutXP = (distanceInMiles) => {
  if (distanceInMiles < 1) return 0; // Below qualifying threshold
  const baseXP = 10;
  const distanceBonus = Math.floor(distanceInMiles - 1) * 5;
  return baseXP + distanceBonus;
};

const getXPRequiredForLevel = (level) => {
  if (level <= 10) {
    return level * 100;
  }
  const baseXP = 1000; // XP for level 10
  const levelsAbove10 = level - 10;
  return baseXP + (levelsAbove10 * 150) + (levelsAbove10 * (levelsAbove10 - 1) * 25);
};

const calculateLevelFromXP = (totalXP) => {
  let level = 1;
  while (getXPRequiredForLevel(level + 1) <= totalXP) {
    level++;
  }
  return level;
};

async function fetchAllWorkoutEvents(ndkInstance, sinceTimestamp) {
  console.log('Fetching workout events from relays...');
  
  return new Promise((resolve) => {
    const collected = new Map();
    const relayResponses = new Map();

    const sub = ndkInstance.subscribe(
      {
        kinds: [1301],
        since: sinceTimestamp,
      },
      { closeOnEose: false }
    );

    const done = () => {
      try { 
        sub.stop(); 
      } catch (_) {}
      
      console.log(`\n📡 Relay Performance Summary:`);
      Array.from(relayResponses.entries())
        .sort(([,a], [,b]) => b.count - a.count)
        .forEach(([relay, stats]) => {
          console.log(`  ${relay}: ${stats.count} events`);
        });
      
      resolve(new Set(collected.values()));
    };

    // Safety timeout
    const timeoutId = setTimeout(() => {
      console.log(`\n⏱️  Timeout reached (${FETCH_TIMEOUT_MS}ms), processing collected events...`);
      done();
    }, FETCH_TIMEOUT_MS);

    sub.on("event", (ev) => {
      collected.set(ev.id, ev);
      
      // Track relay performance
      const relay = ev.relay?.url || 'unknown';
      if (!relayResponses.has(relay)) {
        relayResponses.set(relay, { count: 0 });
      }
      relayResponses.get(relay).count++;
      
      // Show progress
      if (collected.size % 50 === 0) {
        process.stdout.write(`\r📥 Collected ${collected.size} events...`);
      }
    });

    sub.on("eose", () => {
      clearTimeout(timeoutId);
      console.log(`\n✅ End of stream reached, collected ${collected.size} total events`);
      done();
    });
  });
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
        const workoutXP = calculateWorkoutXP(distanceInMiles);
        
        if (workoutXP > 0) {
          totalXP += workoutXP;
          qualifyingWorkouts++;
        }
      }
    }
  });

  const currentLevel = calculateLevelFromXP(totalXP);
  
  return {
    totalXP,
    currentLevel,
    qualifyingWorkouts,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    totalWorkouts: events.length
  };
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

async function main() {
  try {
    console.log('🏃‍♂️ RUNSTR Badge Check (Working Version)\n');
    console.log('=' .repeat(50));
    
    // Initialize NDK
    const ndk = new NDK({
      explicitRelayUrls: RELAYS,
    });

    console.log(`🔗 Connecting to ${RELAYS.length} relays...`);
    await ndk.connect();
    console.log('✅ Connected to relays');

    // Fetch events from the last 6 months
    const since = Math.floor(Date.now() / 1000) - SIX_MONTHS_IN_SECONDS;
    console.log(`📅 Fetching events since ${new Date(since * 1000).toLocaleDateString()}`);
    
    const events = await fetchAllWorkoutEvents(ndk, since);
    
    if (events.size === 0) {
      console.log('\n⚠️  No workout events found. This could mean:');
      console.log('- No 1301 events in the time period');
      console.log('- Relay connectivity issues');
      console.log('- Network problems');
      return;
    }

    console.log(`\n🔍 Processing ${events.size} workout events...`);
    
    // Group events by author and calculate stats
    const userEvents = groupEventsByAuthor(Array.from(events));
    const userStats = [];
    
    for (const [author, authorEvents] of Object.entries(userEvents)) {
      const stats = calculateUserStats(authorEvents);
      if (stats.currentLevel > 0) {  // Only include users with qualifying workouts
        userStats.push({
          npub: author,
          npubShort: nip19.npubEncode(author),
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
    
    console.log(`\n🎯 BADGE RECIPIENTS ANALYSIS`);
    console.log('=' .repeat(80));
    console.log(`Found ${userStats.length} users with qualifying workouts (≥1 mile)`);
    
    if (userStats.length === 0) {
      console.log('\nNo users found with qualifying workouts.');
      console.log('This might indicate the 1-mile threshold is too high,');
      console.log('or that users haven\'t published many long workouts yet.');
      return;
    }
    
    // Show top users
    console.log('\n📊 TOP USERS BY LEVEL:\n');
    userStats.slice(0, 20).forEach((user, index) => {
      const rank = index + 1;
      const npubDisplay = `${user.npubShort.slice(0, 16)}...${user.npubShort.slice(-8)}`;
      
      // Get highest badge for this level
      const availableBadges = Object.entries(BADGE_TIERS)
        .filter(([level, _]) => user.currentLevel >= parseInt(level))
        .map(([level, badge]) => ({ level: parseInt(level), ...badge }));
      
      const highestBadge = availableBadges.length > 0 
        ? availableBadges[availableBadges.length - 1]
        : { name: "No Badge Yet", level: 0 };
      
      console.log(`${rank.toString().padStart(2)}. Level ${user.currentLevel.toString().padStart(2)} | ${npubDisplay}`);
      console.log(`    📈 ${user.totalXP.toString().padStart(4)} XP | 🏃 ${user.qualifyingWorkouts.toString().padStart(2)} workouts | 📏 ${user.totalDistanceKm}km`);
      console.log(`    🏆 ${highestBadge.name}`);
      
      if (availableBadges.length > 0) {
        console.log(`    🎖️  Catchup: ${availableBadges.length} badge${availableBadges.length !== 1 ? 's' : ''} (Levels 1-${user.currentLevel})`);
      }
      console.log('');
    });
    
    // Summary statistics
    console.log('📈 CATCHUP SUMMARY');
    console.log('=' .repeat(50));
    
    const totalBadgesNeeded = userStats.reduce((sum, user) => sum + user.currentLevel, 0);
    const highestLevel = Math.max(...userStats.map(u => u.currentLevel));
    const avgLevel = (userStats.reduce((sum, u) => sum + u.currentLevel, 0) / userStats.length).toFixed(1);
    
    console.log(`👥 Total users needing badges: ${userStats.length}`);
    console.log(`🏆 Total badges to award: ${totalBadgesNeeded}`);
    console.log(`🥇 Highest level achieved: ${highestLevel} (${BADGE_TIERS[highestLevel]?.name || 'Unknown'})`);
    console.log(`📊 Average level: ${avgLevel}`);
    
    // Level distribution
    console.log('\n📊 USERS BY LEVEL:');
    const levelCounts = {};
    for (let i = 1; i <= 21; i++) {
      levelCounts[i] = userStats.filter(u => u.currentLevel === i).length;
    }
    
    Object.entries(levelCounts)
      .filter(([_, count]) => count > 0)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .forEach(([level, count]) => {
        const badge = BADGE_TIERS[level];
        console.log(`  Level ${level.padStart(2)}: ${count.toString().padStart(2)} user${count !== 1 ? 's' : ''} - ${badge.name}`);
      });
    
    // Special callouts
    if (userStats.some(u => u.currentLevel >= 4)) {
      const level4Users = userStats.filter(u => u.currentLevel === 4);
      console.log(`\n🎯 LEVEL 4 USERS (as requested):`);
      level4Users.forEach(user => {
        console.log(`  • ${user.npubShort} - ${user.totalXP} XP, ${user.qualifyingWorkouts} workouts`);
      });
    }
    
    console.log('\n✅ BADGE CHECK COMPLETE!');
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Review the users and levels above');
    console.log('2. Run full catchup: node scripts/calculate-weekly-badges.mjs --catchup --dry-run');
    console.log('3. Award badges: node scripts/calculate-weekly-badges.mjs --catchup');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n🔧 Try checking:');
    console.log('- Internet connection');
    console.log('- Relay availability');
    console.log('- NDK dependencies');
    process.exit(1);
  }
}

main();