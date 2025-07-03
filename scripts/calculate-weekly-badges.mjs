#!/usr/bin/env node

/**
 * Weekly Badge Awarding Script
 * 
 * This script:
 * 1. Fetches all 1301 workout events from specified relays
 * 2. Groups events by author (npub) 
 * 3. Calculates current XP and level for each user
 * 4. Compares against stored previous levels
 * 5. Identifies users who have achieved new level milestones
 * 6. Outputs badge recommendations
 * 
 * Usage: node scripts/calculate-weekly-badges.mjs [--dry-run] [--since=YYYY-MM-DD] [--catchup]
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import Nostr utilities from your existing codebase
import { fetchEvents } from '../src/utils/nostr.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BADGE_DATA_FILE = join(__dirname, 'badge-tracking.json');

// Level system constants (matching your existing system)
const LEVEL_SYSTEM = {
  calculateWorkoutXP: (distanceInMiles) => {
    if (distanceInMiles < 1) return 0; // Below qualifying threshold
    const baseXP = 10;
    const distanceBonus = Math.floor(distanceInMiles - 1) * 5;
    return baseXP + distanceBonus;
  },

  getXPRequiredForLevel: (level) => {
    if (level <= 10) {
      return level * 100;
    }
    const baseXP = 1000; // XP for level 10
    const levelsAbove10 = level - 10;
    return baseXP + (levelsAbove10 * 150) + (levelsAbove10 * (levelsAbove10 - 1) * 25);
  },

  calculateLevelFromXP: (totalXP) => {
    let level = 1;
    while (LEVEL_SYSTEM.getXPRequiredForLevel(level + 1) <= totalXP) {
      level++;
    }
    return level;
  }
};

// Badge tier definitions - Level 1-21 badges
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

// Default relays to fetch from
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol', 
  'wss://relay.snort.social'
];

async function loadBadgeTrackingData() {
  if (!existsSync(BADGE_DATA_FILE)) {
    return { users: {}, lastRun: null };
  }
  
  try {
    const data = readFileSync(BADGE_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading badge tracking data:', error);
    return { users: {}, lastRun: null };
  }
}

function saveBadgeTrackingData(data) {
  try {
    writeFileSync(BADGE_DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`Badge tracking data saved to ${BADGE_DATA_FILE}`);
  } catch (error) {
    console.error('Error saving badge tracking data:', error);
  }
}

function calculateUserStats(events) {
  let totalXP = 0;
  let qualifyingWorkouts = 0;
  let totalDistanceKm = 0;
  let lastWorkoutDate = null;

  events.forEach(event => {
    // Parse distance tag: ["distance", "5.00", "km"] OR ["distance", "3.10", "mi"]
    const distTag = event.tags?.find(t => t[0] === 'distance');
    
    if (distTag) {
      const val = parseFloat(distTag[1]);
      const unit = distTag[2] || 'km';
      
      if (!isNaN(val)) {
        // Convert to km for consistency
        const distanceKm = unit === 'km' ? val : (val * 1.609344);
        totalDistanceKm += distanceKm;

        // Calculate XP (convert km to miles for XP calculation)
        const distanceInMiles = unit === 'km' ? (val * 0.621371) : val;
        const workoutXP = LEVEL_SYSTEM.calculateWorkoutXP(distanceInMiles);
        
        if (workoutXP > 0) {
          totalXP += workoutXP;
          qualifyingWorkouts++;
        }
      }
    }

    // Track most recent workout
    const workoutDate = new Date(event.created_at * 1000);
    if (!lastWorkoutDate || workoutDate > lastWorkoutDate) {
      lastWorkoutDate = workoutDate;
    }
  });

  const currentLevel = LEVEL_SYSTEM.calculateLevelFromXP(totalXP);
  
  return {
    totalXP,
    currentLevel,
    qualifyingWorkouts,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    lastWorkoutDate: lastWorkoutDate?.toISOString().split('T')[0],
    totalWorkouts: events.length
  };
}

async function fetchAllWorkoutEvents(sinceDate = null) {
  console.log('Fetching 1301 workout events from relays...');
  
  const filter = {
    kinds: [1301],
    limit: 5000 // Adjust based on your needs
  };

  // Add time filter if specified
  if (sinceDate) {
    filter.since = Math.floor(new Date(sinceDate).getTime() / 1000);
    console.log(`Fetching events since ${sinceDate}`);
  }

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

function findNewBadgeRecipients(currentData, previousData, isCatchupMode = false) {
  const badgeRecipients = [];
  
  for (const [npub, userData] of Object.entries(currentData)) {
    const previousLevel = previousData[npub]?.currentLevel || 0;
    const currentLevel = userData.currentLevel;
    
    // Skip users with no qualifying workouts
    if (currentLevel === 0) continue;
    
    let earnedBadges = [];
    
    if (isCatchupMode) {
      // Catchup mode: Award all badges from level 1 to current level
      for (const [levelThreshold, badgeInfo] of Object.entries(BADGE_TIERS)) {
        const threshold = parseInt(levelThreshold);
        if (currentLevel >= threshold) {
          earnedBadges.push({
            threshold,
            ...badgeInfo
          });
        }
      }
    } else {
      // Normal mode: Only award badges for newly reached levels
      for (const [levelThreshold, badgeInfo] of Object.entries(BADGE_TIERS)) {
        const threshold = parseInt(levelThreshold);
        if (currentLevel >= threshold && previousLevel < threshold) {
          earnedBadges.push({
            threshold,
            ...badgeInfo
          });
        }
      }
    }
    
    if (earnedBadges.length > 0) {
      badgeRecipients.push({
        npub,
        previousLevel,
        currentLevel,
        totalXP: userData.totalXP,
        qualifyingWorkouts: userData.qualifyingWorkouts,
        badges: earnedBadges
      });
    }
  }
  
  return badgeRecipients.sort((a, b) => b.currentLevel - a.currentLevel);
}

function displayResults(badgeRecipients, isDryRun = false, isCatchupMode = false) {
  console.log('\n' + '='.repeat(60));
  const modeText = isCatchupMode ? 'RETROACTIVE BADGE CATCHUP' : 'WEEKLY BADGE RECOMMENDATIONS';
  console.log(`${isDryRun ? 'DRY RUN - ' : ''}${modeText}`);
  console.log('='.repeat(60));
  
  if (badgeRecipients.length === 0) {
    console.log('🎉 No new badges to award this week!');
    return;
  }
  
  console.log(`Found ${badgeRecipients.length} users eligible for new badges:\n`);
  
  badgeRecipients.forEach((recipient, index) => {
    console.log(`${index + 1}. NPUB: ${recipient.npub}`);
    console.log(`   Level Progress: ${recipient.previousLevel} → ${recipient.currentLevel}`);
    console.log(`   Total XP: ${recipient.totalXP}`);
    console.log(`   Qualifying Workouts: ${recipient.qualifyingWorkouts}`);
    
    if (isCatchupMode && recipient.badges.length > 5) {
      // Show summary for catchup mode with many badges
      console.log(`   Badges to Award: ${recipient.badges.length} badges (Levels 1-${recipient.currentLevel})`);
      console.log(`   Highest Badge: 🏆 ${recipient.badges[recipient.badges.length - 1].name} (Level ${recipient.currentLevel})`);
    } else {
      // Show individual badges for normal mode or few badges
      console.log(`   ${isCatchupMode ? 'Badges to Award:' : 'New Badges:'}`);
      recipient.badges.forEach(badge => {
        console.log(`     🏆 ${badge.name} (Level ${badge.threshold}): ${badge.description}`);
      });
    }
    console.log('');
  });
  
  // Summary
  const totalBadges = badgeRecipients.reduce((sum, r) => sum + r.badges.length, 0);
  console.log(`Total badges to award: ${totalBadges}`);
  console.log(`Users affected: ${badgeRecipients.length}`);
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isCatchupMode = args.includes('--catchup');
  const sinceArg = args.find(arg => arg.startsWith('--since='));
  const sinceDate = sinceArg ? sinceArg.split('=')[1] : null;

  try {
    const modeText = isCatchupMode ? 'Retroactive Badge Catchup' : 'Weekly Badge Calculator';
    console.log(`🏃‍♂️ RUNSTR ${modeText} Starting...\n`);
    
    // Load previous badge tracking data
    const badgeData = await loadBadgeTrackingData();
    console.log(`Previous run: ${badgeData.lastRun || 'Never'}`);
    console.log(`Tracking ${Object.keys(badgeData.users).length} users\n`);
    
    if (isCatchupMode) {
      console.log('🔄 CATCHUP MODE: Will award ALL badges from Level 1 to current level for each user');
      console.log('   This is typically used once to award retroactive badges to existing users.\n');
    }
    
    // Fetch all workout events
    const events = await fetchAllWorkoutEvents(sinceDate);
    
    if (events.length === 0) {
      console.log('No workout events found. Exiting.');
      return;
    }
    
    // Group events by author and calculate stats
    console.log('Calculating user statistics...');
    const userEvents = groupEventsByAuthor(events);
    const currentUserData = {};
    
    for (const [author, authorEvents] of Object.entries(userEvents)) {
      currentUserData[author] = calculateUserStats(authorEvents);
    }
    
    console.log(`Processed ${Object.keys(currentUserData).length} unique users\n`);
    
    // Find users who earned new badges
    const badgeRecipients = findNewBadgeRecipients(currentUserData, badgeData.users, isCatchupMode);
    
    // Display results
    displayResults(badgeRecipients, isDryRun, isCatchupMode);
    
    // Save updated tracking data (unless dry run)
    if (!isDryRun) {
      const updatedBadgeData = {
        users: currentUserData,
        lastRun: new Date().toISOString(),
        previousRun: badgeData.lastRun
      };
      saveBadgeTrackingData(updatedBadgeData);
    }
    
    // Export badge recipients for external processing if needed
    if (badgeRecipients.length > 0 && !isDryRun) {
      const filePrefix = isCatchupMode ? 'badge-catchup' : 'badge-recipients';
      const outputFile = join(__dirname, `${filePrefix}-${new Date().toISOString().split('T')[0]}.json`);
      writeFileSync(outputFile, JSON.stringify(badgeRecipients, null, 2));
      console.log(`\n📄 Badge recipients exported to: ${outputFile}`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, LEVEL_SYSTEM, BADGE_TIERS };