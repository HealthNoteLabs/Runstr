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

const FETCH_TIMEOUT_MS = 20000; // 20-second timeout
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days

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

// Helper to fetch workout events
async function fetchWorkoutEvents(ndkInstance, since = null) {
  return new Promise((resolve) => {
    const collected = new Map();

    const sub = ndkInstance.subscribe(
      {
        kinds: [1301],
        since: since || undefined,
      },
      { closeOnEose: false }
    );

    const done = () => {
      try { sub.stop(); } catch (_) {}
      resolve(new Set(collected.values()));
    };

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

// Calculate XP and level for a set of events
function calculateXPAndLevel(events) {
  let totalXP = 0;
  let qualifyingWorkouts = 0;
  
  for (const event of events) {
    const distanceInMiles = getDistanceInMiles(event);
    const xp = calculateWorkoutXP(distanceInMiles);
    
    if (xp > 0) {
      totalXP += xp;
      qualifyingWorkouts++;
    }
  }
  
  const level = calculateLevelFromXP(totalXP);
  return { totalXP, level, qualifyingWorkouts };
}

// Calculate weekly level achievements
function calculateWeeklyLevelAchievements(allEvents, weeklyEvents, weekStartTime) {
  const userProgress = new Map();
  
  // Group all events by pubkey
  const allEventsByUser = new Map();
  for (const event of allEvents) {
    if (!allEventsByUser.has(event.pubkey)) {
      allEventsByUser.set(event.pubkey, []);
    }
    allEventsByUser.get(event.pubkey).push(event);
  }
  
  // Group weekly events by pubkey
  const weeklyEventsByUser = new Map();
  for (const event of weeklyEvents) {
    if (!weeklyEventsByUser.has(event.pubkey)) {
      weeklyEventsByUser.set(event.pubkey, []);
    }
    weeklyEventsByUser.get(event.pubkey).push(event);
  }
  
  // Calculate level changes for users who had activity this week
  for (const [pubkey, weekEvents] of weeklyEventsByUser) {
    const allUserEvents = allEventsByUser.get(pubkey) || [];
    
    // Events before this week (all events minus this week's events)
    const beforeWeekEvents = allUserEvents.filter(event => event.created_at < weekStartTime);
    
    // Calculate levels before and after this week
    const beforeWeek = calculateXPAndLevel(beforeWeekEvents);
    const afterWeek = calculateXPAndLevel(allUserEvents);
    const thisWeek = calculateXPAndLevel(weekEvents);
    
    // Check if level increased
    if (afterWeek.level > beforeWeek.level) {
      const npub = nip19.npubEncode(pubkey);
      
      userProgress.set(pubkey, {
        npub,
        pubkey,
        levelBefore: beforeWeek.level,
        levelAfter: afterWeek.level,
        levelsGained: afterWeek.level - beforeWeek.level,
        xpBefore: beforeWeek.totalXP,
        xpAfter: afterWeek.totalXP,
        xpGained: afterWeek.totalXP - beforeWeek.totalXP,
        weeklyWorkouts: thisWeek.qualifyingWorkouts,
        weeklyXP: thisWeek.totalXP,
        weeklyEvents: weekEvents.map(e => ({
          date: new Date(e.created_at * 1000).toLocaleDateString(),
          distance: getDistanceInMiles(e).toFixed(2),
          xp: calculateWorkoutXP(getDistanceInMiles(e))
        }))
      });
    }
  }
  
  // Sort by levels gained (highest first), then by final level
  return Array.from(userProgress.values()).sort((a, b) => {
    if (a.levelsGained !== b.levelsGained) return b.levelsGained - a.levelsGained;
    return b.levelAfter - a.levelAfter;
  });
}

// Display results
function displayResults(achievements, weeklyUsers, weekStartTime, weekEndTime) {
  const startDate = new Date(weekStartTime * 1000).toLocaleDateString();
  const endDate = new Date(weekEndTime * 1000).toLocaleDateString();
  
  console.log("\n" + "=".repeat(80));
  console.log("🎉 RUNSTR WEEKLY LEVEL ACHIEVEMENTS");
  console.log("=".repeat(80));
  console.log(`📅 Period: ${startDate} to ${endDate}`);
  console.log("");
  
  if (achievements.length === 0) {
    console.log("❌ No users achieved new levels this week.");
    
    if (weeklyUsers > 0) {
      console.log(`📊 ${weeklyUsers} users had workouts this week but didn't level up.`);
    } else {
      console.log("📊 No workout activity detected this week.");
    }
    return;
  }
  
  // Summary stats
  const totalLevelsGained = achievements.reduce((sum, user) => sum + user.levelsGained, 0);
  const totalXPGained = achievements.reduce((sum, user) => sum + user.xpGained, 0);
  const avgLevelsGained = (totalLevelsGained / achievements.length).toFixed(1);
  const maxLevelAchieved = Math.max(...achievements.map(u => u.levelAfter));
  
  console.log(`🏆 ACHIEVEMENT SUMMARY:`);
  console.log(`   • Users who leveled up: ${achievements.length}`);
  console.log(`   • Total levels gained: ${totalLevelsGained}`);
  console.log(`   • Total XP gained: ${totalXPGained}`);
  console.log(`   • Average levels gained: ${avgLevelsGained}`);
  console.log(`   • Highest level achieved: ${maxLevelAchieved}`);
  console.log(`   • Total active users this week: ${weeklyUsers}`);
  console.log("");
  
  // Level achievement table
  console.log("🎖️ USERS WHO LEVELED UP:");
  console.log("─".repeat(85));
  console.log("User                 | Before | After | Gained |   XP | Workouts | Weekly XP");
  console.log("─".repeat(85));
  
  achievements.forEach(user => {
    const npubShort = user.npub.substring(0, 16) + "...";
    const before = user.levelBefore.toString().padStart(6);
    const after = user.levelAfter.toString().padStart(5);
    const gained = `+${user.levelsGained}`.padStart(6);
    const xpGained = `+${user.xpGained}`.padStart(4);
    const workouts = user.weeklyWorkouts.toString().padStart(8);
    const weeklyXP = `+${user.weeklyXP}`.padStart(9);
    
    console.log(`${npubShort} | ${before} | ${after} | ${gained} | ${xpGained} | ${workouts} | ${weeklyXP}`);
  });
  
  // Detailed breakdown
  console.log("\n📋 DETAILED ACHIEVEMENT BREAKDOWN:");
  console.log("─".repeat(80));
  
  achievements.forEach((user, index) => {
    console.log(`\n${index + 1}. ${user.npub.substring(0, 20)}...`);
    console.log(`   🎯 Level Progress: ${user.levelBefore} → ${user.levelAfter} (+${user.levelsGained})`);
    console.log(`   ⭐ XP Progress: ${user.xpBefore} → ${user.xpAfter} (+${user.xpGained})`);
    console.log(`   🏃 This Week: ${user.weeklyWorkouts} workouts, ${user.weeklyXP} XP`);
    console.log(`   📅 Workout Details:`);
    
    user.weeklyEvents.forEach(workout => {
      console.log(`      • ${workout.date}: ${workout.distance}mi (+${workout.xp} XP)`);
    });
  });
  
  console.log("\n🎁 LEVEL ACHIEVEMENT REWARDS (Copy-paste ready):");
  console.log("─".repeat(80));
  achievements.forEach(user => {
    const rewardMultiplier = user.levelsGained; // Customize reward logic here
    const baseSats = 500; // Base reward per level gained
    const totalReward = baseSats * rewardMultiplier;
    
    console.log(`${user.npub}: Level ${user.levelBefore}→${user.levelAfter} (+${user.levelsGained}) = ${totalReward} sats`);
  });
  
  console.log("\n🔑 HEX FORMAT REWARDS (Copy-paste ready):");
  console.log("─".repeat(80));
  achievements.forEach(user => {
    const rewardMultiplier = user.levelsGained; // Customize reward logic here
    const baseSats = 500; // Base reward per level gained
    const totalReward = baseSats * rewardMultiplier;
    
    console.log(`${user.pubkey}: Level ${user.levelBefore}→${user.levelAfter} (+${user.levelsGained}) = ${totalReward} sats`);
  });
  
  console.log("\n" + "=".repeat(80));
}

async function main() {
  console.log("🔄 Connecting to Nostr relays...");
  await ndk.connect();
  console.log(`✅ Connected to ${RELAYS.length} relays.`);

  // Calculate time boundaries
  const now = Math.floor(Date.now() / 1000);
  const weekStartTime = now - WEEK_IN_SECONDS;
  
  console.log(`\n🔍 Fetching workout events...`);
  console.log(`📅 Analyzing period: ${new Date(weekStartTime * 1000).toLocaleDateString()} to ${new Date(now * 1000).toLocaleDateString()}`);
  
  // Fetch all events (for before/after comparison)
  console.log("\n📥 Fetching all historical events...");
  let allEvents = await fetchWorkoutEvents(ndk);
  console.log(`✅ Fetched ${allEvents.size} total kind:1301 events`);
  
  // Convert to array (no filtering - matches app behavior)
  const allWorkoutEvents = Array.from(allEvents);
  console.log(`✅ Processing ${allWorkoutEvents.length} workout events from all sources`);
  
  // Get this week's events
  const weeklyWorkoutEvents = allWorkoutEvents.filter(event => event.created_at >= weekStartTime);
  console.log(`✅ Found ${weeklyWorkoutEvents.length} events from this week`);
  
  // Count unique users this week
  const weeklyUsers = new Set(weeklyWorkoutEvents.map(e => e.pubkey)).size;
  console.log(`👥 ${weeklyUsers} unique users had workouts this week`);

  if (allWorkoutEvents.length === 0) {
    console.log("❌ No workout events found.");
    rl.close();
    return;
  }

  // Calculate level achievements
  const achievements = calculateWeeklyLevelAchievements(
    allWorkoutEvents, 
    weeklyWorkoutEvents, 
    weekStartTime
  );
  
  // Display results
  displayResults(achievements, weeklyUsers, weekStartTime, now);

  rl.close();
}

main().catch(console.error); 