#!/usr/bin/env node

/**
 * RUNSTR Level Achievements Tracking Script
 * Queries kind:1301 workout events and calculates level progression
 * Based on XP system: 10 XP base + 5 XP per additional mile
 */

import NDK from "@nostr-dev-kit/ndk";
import { nip19 } from 'nostr-tools';
import fs from 'fs';

// Configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const RUNSTR_IDENTIFIERS = ['RUNSTR', 'runstr'];
const FETCH_TIMEOUT_MS = 30000;

// Custom date range: August 3-15, 2025
const START_DATE = new Date('2025-08-03T00:00:00Z');
const END_DATE = new Date('2025-08-15T23:59:59Z');
const PERIOD_DAYS = Math.ceil((END_DATE - START_DATE) / (1000 * 60 * 60 * 24));

// XP Configuration (from level_system.md)
const XP_CONFIG = {
  BASE_XP: 10,
  DISTANCE_BONUS: 5,
  QUALIFYING_DISTANCE: 1.0, // 1+ mile
  LEVEL_XP_FORMULA: {
    getXPRequired: (level) => {
      if (level <= 10) {
        return level * 100;
      }
      const baseXP = 1000;
      const levelsAbove10 = level - 10;
      return baseXP + (levelsAbove10 * 150) + (levelsAbove10 * (levelsAbove10 - 1) * 25);
    }
  }
};

// Data persistence file
const DATA_FILE = 'scripts/level-tracking-data.json';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Helper function to calculate XP from a workout
function calculateWorkoutXP(distance) {
  if (distance < XP_CONFIG.QUALIFYING_DISTANCE) {
    return 0;
  }
  
  const baseMiles = 1;
  const additionalMiles = Math.floor(distance - baseMiles);
  
  return XP_CONFIG.BASE_XP + (additionalMiles * XP_CONFIG.DISTANCE_BONUS);
}

// Helper function to calculate level from total XP
function calculateLevel(totalXP) {
  if (totalXP === 0) return 0;
  
  for (let level = 1; level <= 100; level++) {
    const requiredXP = XP_CONFIG.LEVEL_XP_FORMULA.getXPRequired(level);
    if (totalXP < requiredXP) {
      return level - 1;
    }
  }
  
  return 100; // Cap at level 100
}

// Helper function to extract distance from event content
function extractDistance(event) {
  const content = event.content || '';
  
  // Look for distance tag first
  const distanceTag = event.tags.find(tag => tag[0] === 'distance');
  if (distanceTag && distanceTag[1]) {
    const distance = parseFloat(distanceTag[1]);
    if (!isNaN(distance)) {
      return distance;
    }
  }
  
  // Parse from content as fallback
  const distanceRegex = /(?:distance|ran|walked|cycled)[\s:]*(\d+\.?\d*)\s*(?:miles?|mi|km|kilometers?)/i;
  const match = content.match(distanceRegex);
  
  if (match) {
    const distance = parseFloat(match[1]);
    if (!isNaN(distance)) {
      // Convert km to miles if needed
      if (content.toLowerCase().includes('km') || content.toLowerCase().includes('kilometer')) {
        return distance * 0.621371;
      }
      return distance;
    }
  }
  
  // Default fallback for qualifying workouts
  return 1.5; // Assume 1.5 miles for workouts without clear distance
}

// Load previous tracking data
function loadTrackingData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return data;
    }
  } catch (error) {
    console.warn(`${colors.yellow}⚠ Could not load tracking data:${colors.reset}`, error.message);
  }
  
  return { users: {}, lastUpdate: null };
}

// Save tracking data
function saveTrackingData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`${colors.red}❌ Could not save tracking data:${colors.reset}`, error.message);
  }
}

// Helper function to fetch events via subscribe with timeout
async function fetchWorkoutEvents(ndkInstance, sinceTimestamp, untilTimestamp) {
  return new Promise((resolve) => {
    const collected = new Map();

    const sub = ndkInstance.subscribe(
      {
        kinds: [1301],
        since: sinceTimestamp,
        until: untilTimestamp,
      },
      { closeOnEose: false }
    );

    const done = () => {
      try { sub.stop(); } catch (_) {}
      resolve(new Set(collected.values()));
    };

    // Safety timeout
    const timeoutId = setTimeout(done, FETCH_TIMEOUT_MS);

    sub.on("event", (ev) => {
      collected.set(ev.id, ev);
    });

    sub.on("eose", () => {
      clearTimeout(timeoutId);
      done();
    });
  });
}

// Fetch all workout events for the specified period
async function fetchAllWorkouts() {
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });
  
  const sinceTimestamp = Math.floor(START_DATE.getTime() / 1000);
  const untilTimestamp = Math.floor(END_DATE.getTime() / 1000);
  
  console.log(`${colors.blue}🔄 Connecting to Nostr relays...${colors.reset}`);
  console.log(`${colors.cyan}📅 Fetching events for Aug 3-15, 2025 (${PERIOD_DAYS} days)${colors.reset}`);
  
  try {
    await ndk.connect();
    console.log(`${colors.green}✅ Connected to ${RELAYS.length} relays.${colors.reset}`);
    
    let events = await fetchWorkoutEvents(ndk, sinceTimestamp, untilTimestamp);
    
    console.log(`${colors.cyan}📥 Fetched ${events.size} total kind:1301 events${colors.reset}`);
    
    // Filter for RUNSTR events
    const runstrEvents = Array.from(events).filter(event => 
      event.tags.some(tag => 
        (tag[0] === 'client' && RUNSTR_IDENTIFIERS.some(id => tag[1]?.toLowerCase().includes(id.toLowerCase()))) ||
        (tag[0] === 'source' && RUNSTR_IDENTIFIERS.some(id => tag[1]?.toLowerCase().includes(id.toLowerCase())))
      )
    );
    
    console.log(`${colors.green}✅ Found ${runstrEvents.length} RUNSTR workout events${colors.reset}`);
    
    return runstrEvents;
  } catch (error) {
    console.error(`${colors.red}❌ Error fetching events:${colors.reset}`, error);
    return [];
  }
}

// Calculate current levels for all users
function calculateCurrentLevels(events) {
  const userWorkouts = new Map();
  
  // Group events by user
  events.forEach(event => {
    const pubkey = event.pubkey;
    const npub = nip19.npubEncode(pubkey);
    
    if (!userWorkouts.has(npub)) {
      userWorkouts.set(npub, []);
    }
    
    userWorkouts.get(npub).push({
      timestamp: event.created_at,
      distance: extractDistance(event),
      event
    });
  });
  
  // Calculate XP and levels for each user
  const userLevels = new Map();
  
  for (const [npub, workouts] of userWorkouts) {
    let totalXP = 0;
    let qualifyingWorkouts = 0;
    
    workouts.forEach(workout => {
      const xp = calculateWorkoutXP(workout.distance);
      totalXP += xp;
      if (xp > 0) qualifyingWorkouts++;
    });
    
    const currentLevel = calculateLevel(totalXP);
    
    userLevels.set(npub, {
      npub,
      totalXP,
      currentLevel,
      qualifyingWorkouts,
      totalWorkouts: workouts.length
    });
  }
  
  return userLevels;
}

// Calculate level achievements for the period
function calculateWeeklyAchievements(currentLevels, previousData) {
  const weeklyAchievements = [];
  const currentTime = Date.now();
  const periodAgo = START_DATE.getTime();
  
  let totalLevelsGained = 0;
  let totalXPGained = 0;
  let highestLevel = 0;
  
  for (const [npub, current] of currentLevels) {
    const previous = previousData.users[npub] || { level: 0, totalXP: 0 };
    
    if (current.currentLevel > previous.level) {
      const levelsGained = current.currentLevel - previous.level;
      const xpGained = current.totalXP - previous.totalXP;
      
      weeklyAchievements.push({
        npub,
        truncatedNpub: npub.substring(0, 63) + '...',
        previousLevel: previous.level,
        currentLevel: current.currentLevel,
        levelsGained,
        xpGained,
        totalXP: current.totalXP
      });
      
      totalLevelsGained += levelsGained;
      totalXPGained += xpGained;
    }
    
    if (current.currentLevel > highestLevel) {
      highestLevel = current.currentLevel;
    }
  }
  
  // Sort by levels gained (descending)
  weeklyAchievements.sort((a, b) => b.levelsGained - a.levelsGained);
  
  return {
    achievements: weeklyAchievements,
    totalLevelsGained,
    totalXPGained,
    highestLevel,
    activeUsers: currentLevels.size
  };
}

// Generate formatted output
function generateOutput(achievementsData) {
  const { achievements, totalLevelsGained, totalXPGained, highestLevel, activeUsers } = achievementsData;
  
  console.log('\n' + '═'.repeat(80));
  console.log(`${colors.magenta}${colors.bold}🏆 LEVEL ACHIEVEMENTS (AUG 3-15, 2025)${colors.reset}`);
  console.log('═'.repeat(80));
  console.log(`${colors.cyan}📅 Period: ${START_DATE.toLocaleDateString()} to ${END_DATE.toLocaleDateString()}${colors.reset}`);
  console.log(`${colors.cyan}📊 Days covered: ${PERIOD_DAYS} days${colors.reset}`);
  console.log(`${colors.cyan}   • Users who leveled up: ${achievements.length}${colors.reset}`);
  console.log(`${colors.cyan}   • Total levels gained: ${totalLevelsGained}${colors.reset}`);
  console.log(`${colors.cyan}   • Total XP gained: ${totalXPGained.toLocaleString()}${colors.reset}`);
  console.log(`${colors.cyan}   • Average levels gained: ${achievements.length > 0 ? (totalLevelsGained / achievements.length).toFixed(1) : 0}${colors.reset}`);
  console.log(`${colors.cyan}   • Highest level achieved: ${highestLevel}${colors.reset}`);
  console.log(`${colors.cyan}   • Total active users this period: ${activeUsers}${colors.reset}`);
  
  if (achievements.length === 0) {
    console.log(`\n${colors.yellow}⚠ No users leveled up this period${colors.reset}`);
    return;
  }
  
  console.log('\n' + `${colors.bold}🎖️ LEVEL UP ACHIEVEMENTS:${colors.reset}`);
  console.log('-'.repeat(80));
  
  achievements.forEach(achievement => {
    console.log(`${colors.green}🎖️ ${achievement.truncatedNpub}${colors.reset}`);
    console.log(`   Level ${achievement.previousLevel} → ${achievement.currentLevel} (+${achievement.levelsGained})`);
    console.log(`   Gained ${achievement.xpGained.toLocaleString()} XP (Total: ${achievement.totalXP.toLocaleString()} XP)`);
    console.log('');
  });
  
  // NPUB list for easy copying
  console.log(`${colors.bold}📋 NPUB LIST (copy-paste ready):${colors.reset}`);
  console.log('-'.repeat(80));
  
  achievements.forEach(achievement => {
    console.log(`${achievement.npub}: Level ${achievement.previousLevel} → ${achievement.currentLevel} (+${achievement.levelsGained})`);
  });
  
  console.log(`\n${colors.green}✅ Level achievements calculation complete!${colors.reset}`);
}

// Update tracking data
function updateTrackingData(currentLevels) {
  const data = {
    users: {},
    lastUpdate: new Date().toISOString()
  };
  
  for (const [npub, levelData] of currentLevels) {
    data.users[npub] = {
      level: levelData.currentLevel,
      totalXP: levelData.totalXP,
      qualifyingWorkouts: levelData.qualifyingWorkouts,
      totalWorkouts: levelData.totalWorkouts
    };
  }
  
  saveTrackingData(data);
  return data;
}

// Main execution
async function main() {
  console.log(`${colors.magenta}${colors.bold}🏆 RUNSTR Level Achievements Calculator (Aug 3-15, 2025)${colors.reset}\n`);
  
  // Load previous tracking data
  const previousData = loadTrackingData();
  
  // Fetch all workout events
  const events = await fetchAllWorkouts();
  
  if (events.length === 0) {
    console.log(`${colors.yellow}⚠ No RUNSTR workout events found for this period${colors.reset}`);
    return;
  }
  
  // Calculate current levels for all users
  const currentLevels = calculateCurrentLevels(events);
  
  // Calculate weekly achievements
  const achievementsData = calculateWeeklyAchievements(currentLevels, previousData);
  
  // Generate output
  generateOutput(achievementsData);
  
  // Update tracking data for next week
  updateTrackingData(currentLevels);
  
  console.log(`${colors.blue}💾 Tracking data updated for next week${colors.reset}`);
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}❌ Script error:${colors.reset}`, error);
  process.exit(1);
}); 