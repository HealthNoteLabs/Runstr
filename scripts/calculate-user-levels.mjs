import NDK from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import readline from "readline";

// --- Configuration ---
const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol", 
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
  "wss://purplepag.es",
  "wss://relay.nostr.info"
];

const FETCH_TIMEOUT_MS = 20000; // 20-second timeout for comprehensive collection

// XP and Level calculation functions (from useNostrRunStats.js)
function calculateWorkoutXP(distanceInMiles) {
  // Removed minimum distance threshold - all movements count for competitions
  // if (distanceInMiles < 1) return 0; // Below qualifying threshold
  const baseXP = 10;
  const distanceBonus = Math.floor(distanceInMiles - 1) * 5;
  return baseXP + distanceBonus;
}

function getXPRequiredForLevel(level) {
  if (level <= 10) {
    return level * 100;
  }
  const baseXP = 1000; // XP for level 10
  const levelsAbove10 = level - 10;
  return baseXP + (levelsAbove10 * 150) + (levelsAbove10 * (levelsAbove10 - 1) * 25);
}

function calculateLevelFromXP(totalXP) {
  let level = 1;
  while (getXPRequiredForLevel(level + 1) <= totalXP) {
    level++;
  }
  return level;
}

// -------------------

const ndk = new NDK({
  explicitRelayUrls: RELAYS,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper to fetch all workout events
async function fetchAllWorkoutEvents(ndkInstance) {
  return new Promise((resolve) => {
    const collected = new Map();

    const sub = ndkInstance.subscribe(
      {
        kinds: [1301],
        // No 'since' to get all historical events
      },
      { closeOnEose: false }
    );

    const done = () => {
      try { sub.stop(); } catch (_) {}
      resolve(new Set(collected.values()));
    };

    // Extended timeout for comprehensive collection
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

// Parse distance from event tags and convert to miles
function getDistanceInMiles(event) {
  const distTag = event.tags?.find(t => t[0] === 'distance');
  if (!distTag) return 0;
  
  const value = parseFloat(distTag[1]);
  const unit = distTag[2] || 'km';
  
  if (isNaN(value)) return 0;
  
  // Convert to miles
  return unit === 'km' ? value * 0.621371 : value;
}

// Calculate user levels from all their events
function calculateUserLevels(events) {
  const userStats = new Map();
  
  // Group events by pubkey
  for (const event of events) {
    if (!userStats.has(event.pubkey)) {
      userStats.set(event.pubkey, {
        events: [],
        totalXP: 0,
        qualifyingWorkouts: 0,
        totalWorkouts: 0
      });
    }
    userStats.get(event.pubkey).events.push(event);
  }

  const userLevels = [];

  for (const [pubkey, stats] of userStats) {
    let totalXP = 0;
    let qualifyingWorkouts = 0;
    
    for (const event of stats.events) {
      const distanceInMiles = getDistanceInMiles(event);
      const xp = calculateWorkoutXP(distanceInMiles);
      
      if (xp > 0) {
        totalXP += xp;
        qualifyingWorkouts++;
      }
    }
    
    const level = calculateLevelFromXP(totalXP);
    const xpForCurrentLevel = level > 1 ? getXPRequiredForLevel(level) : 0;
    const xpForNextLevel = getXPRequiredForLevel(level + 1);
    const xpProgress = totalXP - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - totalXP;
    
    const npub = nip19.npubEncode(pubkey);
    
    userLevels.push({
      npub,
      pubkey,
      level,
      totalXP,
      qualifyingWorkouts,
      totalWorkouts: stats.events.length,
      xpProgress,
      xpNeeded,
      xpForNextLevel: xpForNextLevel - xpForCurrentLevel // XP needed for next level (relative)
    });
  }

  // Sort by level (highest first), then by XP
  return userLevels.sort((a, b) => {
    if (a.level !== b.level) return b.level - a.level;
    return b.totalXP - a.totalXP;
  });
}

// Display results
function displayResults(userLevels) {
  console.log("\n" + "=".repeat(80));
  console.log("🏆 RUNSTR USER LEVELS - ALL TIME RANKINGS");
  console.log("=".repeat(80));
  
  if (userLevels.length === 0) {
    console.log("❌ No users with workout events found.");
    return;
  }
  
  const totalUsers = userLevels.length;
  const totalQualifyingWorkouts = userLevels.reduce((sum, user) => sum + user.qualifyingWorkouts, 0);
  const avgLevel = (userLevels.reduce((sum, user) => sum + user.level, 0) / totalUsers).toFixed(1);
  const maxLevel = Math.max(...userLevels.map(u => u.level));
  
  console.log(`📊 Summary:`);
  console.log(`   • Total Users: ${totalUsers}`);
  console.log(`   • Total Qualifying Workouts: ${totalQualifyingWorkouts}`);
  console.log(`   • Average Level: ${avgLevel}`);
  console.log(`   • Highest Level: ${maxLevel}`);
  console.log("");
  
  // Top users table
  console.log("🥇 TOP USERS BY LEVEL:");
  console.log("─".repeat(80));
  console.log("Rank | Level |    XP | Workouts | Progress | Next Level | User");
  console.log("─".repeat(80));
  
  userLevels.slice(0, 20).forEach((user, index) => {
    const rank = (index + 1).toString().padStart(4);
    const level = user.level.toString().padStart(5);
    const xp = user.totalXP.toString().padStart(5);
    const workouts = user.qualifyingWorkouts.toString().padStart(8);
    const progress = `${user.xpProgress}/${user.xpForNextLevel}`.padStart(8);
    const needed = user.xpNeeded.toString().padStart(10);
    const npubShort = user.npub.substring(0, 16) + "...";
    
    console.log(`${rank} | ${level} | ${xp} | ${workouts} | ${progress} | ${needed} | ${npubShort}`);
  });
  
  if (userLevels.length > 20) {
    console.log(`... and ${userLevels.length - 20} more users`);
  }
  
  // Level distribution
  console.log("\n📈 LEVEL DISTRIBUTION:");
  console.log("─".repeat(40));
  const levelCounts = {};
  userLevels.forEach(user => {
    levelCounts[user.level] = (levelCounts[user.level] || 0) + 1;
  });
  
  Object.keys(levelCounts)
    .sort((a, b) => parseInt(b) - parseInt(a))
    .forEach(level => {
      const count = levelCounts[level];
      const percentage = ((count / totalUsers) * 100).toFixed(1);
      const bar = "█".repeat(Math.ceil(count / totalUsers * 20));
      console.log(`Level ${level.padStart(2)}: ${count.toString().padStart(3)} users (${percentage}%) ${bar}`);
    });
    
  console.log("\n💾 COMPLETE USER LIST (Copy-paste ready):");
  console.log("─".repeat(80));
  userLevels.forEach(user => {
    console.log(`${user.npub}: Level ${user.level} (${user.totalXP} XP, ${user.qualifyingWorkouts} workouts)`);
  });
  
  console.log("\n🔑 HEX FORMAT USER LIST (Copy-paste ready):");
  console.log("─".repeat(80));
  userLevels.forEach(user => {
    console.log(`${user.pubkey}: Level ${user.level} (${user.totalXP} XP, ${user.qualifyingWorkouts} workouts)`);
  });
  
  console.log("\n" + "=".repeat(80));
}

async function main() {
  console.log("🔄 Connecting to Nostr relays...");
  await ndk.connect();
  console.log(`✅ Connected to ${RELAYS.length} relays.`);

  console.log(`\n🔍 Fetching ALL workout events (this may take a while)...`);
  
  let events = await fetchAllWorkoutEvents(ndk);
  console.log(`📥 Fetched ${events.size} total kind:1301 events`);

  // Convert to array (no RUNSTR filtering - matches app behavior)
  const allWorkoutEvents = Array.from(events);
  console.log(`✅ Processing ${allWorkoutEvents.length} workout events from all sources`);

  if (allWorkoutEvents.length === 0) {
    console.log("❌ No workout events found.");
    rl.close();
    return;
  }

  // Calculate user levels
  const userLevels = calculateUserLevels(allWorkoutEvents);
  
  // Display results
  displayResults(userLevels);

  rl.close();
}

main().catch(console.error); 