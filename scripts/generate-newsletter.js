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

// Custom date range: August 3-15, 2025
const START_DATE = new Date('2025-08-03T00:00:00Z');
const END_DATE = new Date('2025-08-15T23:59:59Z');
const PERIOD_DAYS = Math.ceil((END_DATE - START_DATE) / (1000 * 60 * 60 * 24));

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

// Get date range for the period
function getDateRange() {
  return {
    start: START_DATE.toLocaleDateString(),
    end: END_DATE.toLocaleDateString()
  };
}

// Fetch data for the period (using NDK instead of SimplePool)
async function fetchWeeklyData() {
  const NDK = (await import("@nostr-dev-kit/ndk")).default;
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });
  
  const sinceTimestamp = Math.floor(START_DATE.getTime() / 1000);
  const untilTimestamp = Math.floor(END_DATE.getTime() / 1000);
  
  console.log(`${colors.blue}🔄 Fetching data for Aug 3-15, 2025...${colors.reset}`);
  
  try {
    await ndk.connect();
    
    const events = await new Promise((resolve) => {
      const collected = [];
      const sub = ndk.subscribe(
        {
          kinds: [1301],
          since: sinceTimestamp,
          until: untilTimestamp,
        },
        { closeOnEose: false }
      );
      
      const done = () => {
        try { sub.stop(); } catch (_) {}
        resolve(collected);
      };
      
      const timeoutId = setTimeout(done, 30000);
      
      sub.on("event", (ev) => {
        collected.push(ev);
      });
      
      sub.on("eose", () => {
        clearTimeout(timeoutId);
        done();
      });
    });
    
    const runstrEvents = events.filter(event => 
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
  const dateRange = getDateRange();
  
  let newsletter = '';
  
  // Header
  newsletter += `🏃‍♂️ RUNSTR Update: Aug 3-15, 2025 🏃‍♀️\n\n`;
  newsletter += `"Every mile begins with a single step. Every PR begins with showing up." 💪\n\n`;
  
  // Stats Recap
  newsletter += `🏃‍♂️💰 PERIOD STATS RECAP (${PERIOD_DAYS} DAYS)\n`;
  newsletter += `════════════════════════════════\n`;
  newsletter += `💸 Total workouts: ${weeklyStats.totalWorkouts}\n`;
  newsletter += `👥 Active runners: ${weeklyStats.activeUsers}\n`;
  newsletter += `🏃 Total distance: ${weeklyStats.totalDistance} miles\n`;
  newsletter += `📊 Average distance: ${weeklyStats.averageDistance} miles\n`;
  newsletter += `📅 Period: ${dateRange.start} to ${dateRange.end}\n\n`;
  
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
  
  // Rewards Section
  newsletter += `💰 PERIOD REWARDS (AUG 3-15)\n`;
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
  newsletter += `• Level 1: +50 base reward\n`;
  newsletter += `• Level 2: +5 sats per streak day\n`;
  newsletter += `\n`;
  newsletter += `💡 Tag your runs with RUNSTR to earn rewards!\n`;
  newsletter += `Run the rewards calculator for detailed payouts.\n\n`;
  
  // Level Achievements Placeholder
  newsletter += `🏆 LEVEL ACHIEVEMENTS (AUG 3-15)\n`;
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
  const filename = `scripts/newsletter-aug3-15-2025.txt`;
  
  try {
    fs.writeFileSync(filename, content);
    console.log(`${colors.green}✅ Newsletter saved to: ${filename}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Could not save newsletter:${colors.reset}`, error.message);
  }
}

// Main execution
async function main() {
  console.log(`${colors.magenta}${colors.bold}📰 RUNSTR Newsletter Generator (Aug 3-15, 2025)${colors.reset}\n`);
  
  // Fetch data
  const events = await fetchWeeklyData();
  
  if (events.length === 0) {
    console.log(`${colors.yellow}⚠ No RUNSTR workout events found for this period${colors.reset}`);
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