#!/usr/bin/env node

/**
 * RUNSTR Weekly Newsletter Generator
 * Combines rewards and level achievements data to create a formatted newsletter
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
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

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

// Get current week number
function getWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// Get date range for the week
function getWeekDateRange() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  
  return {
    start: weekAgo.toLocaleDateString(),
    end: now.toLocaleDateString()
  };
}

// Helper function to fetch events via subscribe with timeout
async function fetchWeeklyWorkoutEvents(ndkInstance, sinceTimestamp) {
  return new Promise((resolve) => {
    const collected = new Map();

    const sub = ndkInstance.subscribe(
      {
        kinds: [1301],
        since: sinceTimestamp,
      },
      { closeOnEose: false }
    );

    const done = () => {
      try { sub.stop(); } catch (_) {}
      resolve(new Set(collected.values()));
    };

    // Safety timeout
    const timeoutId = setTimeout(done, 30000);

    sub.on("event", (ev) => {
      collected.set(ev.id, ev);
    });

    sub.on("eose", () => {
      clearTimeout(timeoutId);
      done();
    });
  });
}

// Fetch weekly data (using NDK like the rewards script)
async function fetchWeeklyData() {
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });
  
  const sinceTimestamp = Math.floor(Date.now() / 1000) - WEEK_IN_SECONDS;
  
  console.log(`${colors.blue}🔄 Connecting to Nostr relays...${colors.reset}`);
  
  try {
    await ndk.connect();
    console.log(`${colors.green}✅ Connected to ${RELAYS.length} relays.${colors.reset}`);
    
    console.log(`${colors.blue}🔍 Fetching workout events from the last 7 days...${colors.reset}`);
    
    let events = await fetchWeeklyWorkoutEvents(ndk, sinceTimestamp);
    
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

// Calculate summary statistics
function calculateSummaryStats(events) {
  const userWorkouts = new Map();
  let totalDistance = 0;
  let totalWorkouts = events.length;
  
  events.forEach(event => {
    const pubkey = event.pubkey;
    const npub = nip19.npubEncode(pubkey);
    
    if (!userWorkouts.has(npub)) {
      userWorkouts.set(npub, 0);
    }
    userWorkouts.set(npub, userWorkouts.get(npub) + 1);
    
    // Try to extract distance (simplified)
    const content = event.content || '';
    const distanceMatch = content.match(/(\d+\.?\d*)\s*(?:miles?|mi|km)/i);
    if (distanceMatch) {
      let distance = parseFloat(distanceMatch[1]);
      if (content.toLowerCase().includes('km')) {
        distance *= 0.621371; // Convert km to miles
      }
      totalDistance += distance;
    } else {
      totalDistance += 1.5; // Default assumption
    }
  });
  
  const activeUsers = userWorkouts.size;
  const averageDistance = totalDistance / totalWorkouts;
  
  return {
    activeUsers,
    totalWorkouts,
    totalDistance: Math.round(totalDistance),
    averageDistance: Math.round(averageDistance * 10) / 10,
    topUsers: Array.from(userWorkouts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([npub, count]) => ({ npub: npub.substring(0, 20) + '...', workouts: count }))
  };
}

// Generate newsletter content
function generateNewsletter(weeklyStats) {
  const weekNumber = getWeekNumber();
  const dateRange = getWeekDateRange();
  
  let newsletter = '';
  
  // Header
  newsletter += `🏃‍♂️ RUNSTR Weekly Update #${weekNumber} 🏃‍♀️\n\n`;
  newsletter += `"Every mile begins with a single step. Every PR begins with showing up." 💪\n\n`;
  
  // Weekly Stats Recap
  newsletter += `🏃‍♂️💰 WEEKLY STATS RECAP\n`;
  newsletter += `════════════════════════════════\n`;
  newsletter += `💸 Total workouts: ${weeklyStats.totalWorkouts}\n`;
  newsletter += `👥 Active runners: ${weeklyStats.activeUsers}\n`;
  newsletter += `🏃 Total distance: ${weeklyStats.totalDistance} miles\n`;
  newsletter += `📊 Average distance: ${weeklyStats.averageDistance} miles\n`;
  newsletter += `📅 Week: ${dateRange.start} to ${dateRange.end}\n\n`;
  
  // Top Performers
  if (weeklyStats.topUsers.length > 0) {
    newsletter += `🏆 TOP PERFORMERS\n`;
    newsletter += `═══════════════════════════════\n`;
    weeklyStats.topUsers.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      newsletter += `${medal} ${user.npub}: ${user.workouts} workouts\n`;
    });
    newsletter += `\n`;
  }
  
  // Weekly Rewards Section
  newsletter += `💰 WEEKLY REWARDS\n`;
  newsletter += `════════════════════════════════\n`;
  newsletter += `🎯 Reward System:\n`;
  newsletter += `• 1 run: 20 sats\n`;
  newsletter += `• 2 runs: 40 sats (total 60)\n`;
  newsletter += `• 3 runs: 60 sats (total 120)\n`;
  newsletter += `• 4 runs: 80 sats (total 200)\n`;
  newsletter += `• 5 runs: 100 sats (total 300)\n`;
  newsletter += `• 6 runs: 120 sats (total 420)\n`;
  newsletter += `• 7 runs: 140 sats (total 560)\n`;
  newsletter += `\n`;
  newsletter += `🏅 Level Bonuses:\n`;
  newsletter += `• Level 1: +50 weekly base reward\n`;
  newsletter += `• Level 2: +5 sats per streak day\n`;
  newsletter += `\n`;
  newsletter += `💡 Tag your runs with RUNSTR to earn weekly rewards!\n`;
  newsletter += `Run the rewards calculator for detailed payouts.\n\n`;
  
  // Level Achievements Placeholder
  newsletter += `🏆 WEEKLY LEVEL ACHIEVEMENTS\n`;
  newsletter += `═══════════════════════════════\n`;
  newsletter += `🎉 Check level achievements with the level calculator!\n`;
  newsletter += `Run the level achievements script for detailed results.\n\n`;
  
  // Project Update
  newsletter += `📢 PROJECT UPDATE\n`;
  newsletter += `═════════════════\n`;
  newsletter += `RUNSTR continues to grow as the premier Bitcoin-native fitness app! We're building the future of decentralized fitness tracking with Nostr integration, Lightning rewards, and a thriving community of runners. Our open-source approach ensures your data stays yours while connecting you with like-minded athletes worldwide. 🌍⚡\n\n`;
  
  // Get the App
  newsletter += `📱 GET THE APP\n`;
  newsletter += `══════════════\n`;
  newsletter += `Download RUNSTR for Android/CalyxOS/GrapheneOS:\n`;
  newsletter += `🏪 Zap.Store (recommended)\n`;
  newsletter += `💻 GitHub Releases\n`;
  newsletter += `📖 Visit runstr.club for the latest blog updates\n\n`;
  
  // Support Section
  newsletter += `❤️ SUPPORT RUNSTR\n`;
  newsletter += `═════════════════\n`;
  newsletter += `Help us build the future of Bitcoin fitness!\n`;
  newsletter += `💰 Donate: https://geyser.fund/project/runstr?hero=runstr\n`;
  newsletter += `🔗 Share: Tell your running friends about RUNSTR\n`;
  newsletter += `🧪 Test: Try new features and report bugs\n\n`;
  
  // Hashtags
  newsletter += `#RUNSTR #cyclestr #walkstr #Bitcoin #Lightning #Nostr #Fitness #Running #OpenSource #Decentralized\n`;
  
  return newsletter;
}

// Save newsletter to file
function saveNewsletter(content) {
  const weekNumber = getWeekNumber();
  const filename = `scripts/newsletter-week-${weekNumber}.txt`;
  
  try {
    fs.writeFileSync(filename, content);
    console.log(`${colors.green}✅ Newsletter saved to: ${filename}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Could not save newsletter:${colors.reset}`, error.message);
  }
}

// Main execution
async function main() {
  console.log(`${colors.magenta}${colors.bold}📰 RUNSTR Weekly Newsletter Generator${colors.reset}\n`);
  
  // Fetch weekly data
  const events = await fetchWeeklyData();
  
  if (events.length === 0) {
    console.log(`${colors.yellow}⚠ No RUNSTR workout events found for this week${colors.reset}`);
    console.log(`${colors.cyan}📄 Generating newsletter with placeholder data...${colors.reset}`);
  }
  
  // Calculate summary statistics
  const weeklyStats = calculateSummaryStats(events);
  
  // Generate newsletter
  const newsletter = generateNewsletter(weeklyStats);
  
  // Display newsletter
  console.log(`${colors.cyan}📄 Generated Newsletter:${colors.reset}`);
  console.log('═'.repeat(80));
  console.log(newsletter);
  console.log('═'.repeat(80));
  
  // Save to file
  saveNewsletter(newsletter);
  
  console.log(`${colors.blue}💡 Pro tip: Run the rewards and level achievement scripts for detailed data!${colors.reset}`);
  console.log(`${colors.blue}   1. node scripts/calculate-weekly-rewards.js${colors.reset}`);
  console.log(`${colors.blue}   2. node scripts/calculate-level-achievements.js${colors.reset}`);
  console.log(`${colors.blue}   3. Copy specific sections into your newsletter!${colors.reset}`);
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}❌ Script error:${colors.reset}`, error);
  process.exit(1);
}); 