#!/usr/bin/env node

/**
 * RUNSTR Weekly Rewards Calculation Script
 * Queries kind:1301 workout events and calculates weekly rewards
 * Based on new reward system: streak multipliers + level bonuses
 */

import NDK from "@nostr-dev-kit/ndk";
import { nip19 } from 'nostr-tools';

// Configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const RUNSTR_IDENTIFIERS = ['RUNSTR', 'runstr'];
const FETCH_TIMEOUT_MS = 60000; // 60 seconds
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

// Reward configuration
const REWARD_CONFIG = {
  STREAK_MULTIPLIERS: {
    1: 20,   // 1 run: 20 sats
    2: 40,   // 2 runs: 40 sats (total 60)
    3: 60,   // 3 runs: 60 sats (total 120)
    4: 80,   // 4 runs: 80 sats (total 200)
    5: 100,  // 5 runs: 100 sats (total 300)
    6: 120,  // 6 runs: 120 sats (total 420)
    7: 140,  // 7 runs: 140 sats (total 560)
  },
  LEVEL_BONUSES: {
    1: 50,   // Level 1: +50 weekly base reward
    2: 5,    // Level 2: +5 streak reward
  }
};

// ANSI color codes for terminal output
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

// Helper function to calculate level from total workouts
function calculateLevel(totalWorkouts) {
  if (totalWorkouts === 0) return 0;
  return Math.floor(totalWorkouts / 10) + 1; // 10 workouts per level
}

// Helper function to calculate total reward
function calculateTotalReward(streakDays, level) {
  let workoutSats = 0;
  
  // Calculate cumulative streak rewards
  for (let i = 1; i <= streakDays; i++) {
    workoutSats += REWARD_CONFIG.STREAK_MULTIPLIERS[i] || 140; // Cap at 7-day reward
  }
  
  let bonusSats = 0;
  
  // Level bonuses
  if (level >= 1) {
    bonusSats += REWARD_CONFIG.LEVEL_BONUSES[1]; // Base reward
  }
  if (level >= 2) {
    bonusSats += REWARD_CONFIG.LEVEL_BONUSES[2] * streakDays; // Streak bonus
  }
  
  return { workoutSats, bonusSats, totalSats: workoutSats + bonusSats };
}

// Helper function to format date
function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString();
}

// Helper function to get date range string
function getDateRangeString(sinceTimestamp) {
  const startDate = new Date(sinceTimestamp * 1000);
  const endDate = new Date();
  
  return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
}

// Helper function to truncate npub for display
function truncateNpub(npub) {
  return npub.substring(0, 63) + '...';
}

// Helper function to fetch events via subscribe with timeout
async function fetchWeeklyWorkoutEvents(ndkInstance, sinceTimestamp, untilTimestamp) {
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

// Fetch all workout events from the last week
async function fetchWeeklyWorkouts() {
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });
  
  // Custom date range: 07-27 to 08-03 (2025)
  const startDate = new Date('2025-07-27T00:00:00Z');
  const endDate = new Date('2025-08-03T23:59:59Z');
  const sinceTimestamp = Math.floor(startDate.getTime() / 1000);
  const untilTimestamp = Math.floor(endDate.getTime() / 1000);
  
  console.log(`${colors.blue}🔄 Connecting to Nostr relays...${colors.reset}`);
  
  try {
    await ndk.connect();
    console.log(`${colors.green}✅ Connected to ${RELAYS.length} relays.${colors.reset}`);
    
    console.log(`${colors.blue}🔍 Fetching workout events from the last 7 days...${colors.reset}`);
    console.log(`${colors.cyan}📅 Time range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}${colors.reset}`);
    
    let events = await fetchWeeklyWorkoutEvents(ndk, sinceTimestamp, untilTimestamp);
    
    console.log(`${colors.cyan}📥 Fetched ${events.size} total kind:1301 events${colors.reset}`);
    
    // Filter for RUNSTR events
    const runstrEvents = Array.from(events).filter(event => 
      event.tags.some(tag => 
        (tag[0] === 'client' && RUNSTR_IDENTIFIERS.some(id => tag[1]?.toLowerCase().includes(id.toLowerCase()))) ||
        (tag[0] === 'source' && RUNSTR_IDENTIFIERS.some(id => tag[1]?.toLowerCase().includes(id.toLowerCase())))
      )
    );
    
    console.log(`${colors.green}✅ Found ${runstrEvents.length} RUNSTR workout events${colors.reset}`);
    
    return { events: runstrEvents, sinceTimestamp, dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}` };
  } catch (error) {
    console.error(`${colors.red}❌ Error fetching events:${colors.reset}`, error);
    return { events: [], sinceTimestamp, dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}` };
  }
}

// Calculate rewards for all users
function calculateRewards(events, sinceTimestamp) {
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
      date: formatDate(event.created_at),
      content: event.content,
      event
    });
  });
  
  // Calculate rewards for each user
  const userRewards = [];
  let totalPayout = 0;
  
  for (const [npub, workouts] of userWorkouts) {
    // Sort workouts by date
    workouts.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate consecutive days (streak)
    const uniqueDays = new Set(workouts.map(w => w.date));
    const streakDays = uniqueDays.size;
    
    // Calculate level (rough estimate based on workouts this week)
    const level = calculateLevel(workouts.length);
    
    // Calculate rewards
    const { workoutSats, bonusSats, totalSats } = calculateTotalReward(streakDays, level);
    
    userRewards.push({
      npub,
      truncatedNpub: truncateNpub(npub),
      workouts: workouts.length,
      streakDays,
      level,
      workoutSats,
      bonusSats,
      totalSats,
      dates: Array.from(uniqueDays).sort()
    });
    
    totalPayout += totalSats;
  }
  
  // Sort by total sats (descending)
  userRewards.sort((a, b) => b.totalSats - a.totalSats);
  
  return {
    userRewards,
    totalUsers: userRewards.length,
    totalPayout,
    dateRange: getDateRangeString(sinceTimestamp)
  };
}

// Generate formatted output
function generateOutput(rewardsData) {
  const { userRewards, totalUsers, totalPayout, dateRange } = rewardsData;
  
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.magenta}${colors.bold}🏃 RUNSTR WEEKLY REWARDS CALCULATION${colors.reset}`);
  console.log('='.repeat(80));
  console.log(`${colors.cyan}📅 Period: ${dateRange}${colors.reset}`);
  console.log(`${colors.cyan}💰 Rate: Streak multipliers + level bonuses${colors.reset}`);
  console.log(`${colors.cyan}👥 Total users: ${totalUsers}${colors.reset}`);
  console.log(`${colors.cyan}💸 Total payout: ${totalPayout.toLocaleString()} sats${colors.reset}`);
  console.log('='.repeat(80));
  
  if (userRewards.length === 0) {
    console.log(`${colors.yellow}⚠ No users found with RUNSTR workouts this week${colors.reset}`);
    return;
  }
  
  // Reward breakdown table
  console.log('\n' + `${colors.bold}📊 REWARD BREAKDOWN:${colors.reset}`);
  console.log('-'.repeat(120));
  console.log(`${colors.bold}NPUB${' '.repeat(59)} WORKOUTS  STREAK  WORKOUT SATS BONUS SATS  TOTAL SATS${colors.reset}`);
  console.log('-'.repeat(120));
  
  userRewards.forEach(user => {
    const npubPadded = user.truncatedNpub.padEnd(63);
    const workoutsPadded = user.workouts.toString().padStart(8);
    const streakPadded = user.streakDays.toString().padStart(6);
    const workoutSatsPadded = user.workoutSats.toString().padStart(12);
    const bonusSatsPadded = user.bonusSats.toString().padStart(10);
    const totalSatsPadded = user.totalSats.toString().padStart(11);
    
    console.log(`${npubPadded} ${workoutsPadded} ${streakPadded} ${workoutSatsPadded} ${bonusSatsPadded} ${totalSatsPadded}`);
  });
  
  console.log('-'.repeat(120));
  console.log(`${colors.bold}TOTAL:${' '.repeat(115)} ${totalPayout.toLocaleString()}${colors.reset}`);
  
  // Payment list
  console.log('\n' + `${colors.bold}💰 PAYMENT LIST (copy-paste ready):${colors.reset}`);
  console.log('-'.repeat(80));
  
  userRewards.forEach(user => {
    console.log(`${user.npub}: ${user.totalSats} sats`);
  });
  
  // Detailed breakdown
  console.log('\n' + `${colors.bold}📋 DETAILED BREAKDOWN:${colors.reset}`);
  console.log('-'.repeat(80));
  
  userRewards.forEach(user => {
    console.log(`\n${colors.cyan}👤 ${user.truncatedNpub}${colors.reset}`);
    console.log(`   📊 ${user.workouts} workouts, ${user.streakDays}-day streak, Level ${user.level}`);
    console.log(`   💰 ${user.workoutSats} (workouts) + ${user.bonusSats} (bonuses) = ${user.totalSats} sats`);
    console.log(`   📅 Workout dates:`);
    console.log(`      ${user.dates.join(', ')}`);
  });
  
  console.log(`\n${colors.green}✅ Rewards calculation complete!${colors.reset}`);
}

// Main execution
async function main() {
  console.log(`${colors.magenta}${colors.bold}🏃‍♂️ RUNSTR Weekly Rewards Calculator${colors.reset}\n`);
  
  const { events, sinceTimestamp, dateRange } = await fetchWeeklyWorkouts();
  
  if (events.length === 0) {
    console.log(`${colors.yellow}⚠ No RUNSTR workout events found for the last week${colors.reset}`);
    return;
  }
  
  const rewardsData = calculateRewards(events, sinceTimestamp);
  rewardsData.dateRange = dateRange;
  generateOutput(rewardsData);
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}❌ Script error:${colors.reset}`, error);
  process.exit(1);
}); 