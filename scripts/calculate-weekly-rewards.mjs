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

const RUNSTR_SOURCE_TAG = "RUNSTR";
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 15000; // 15-second timeout for thorough collection

// Reward rates
const SATS_PER_WORKOUT = 50;
const SATS_PER_STREAK_DAY = 50;

// -------------------

const ndk = new NDK({
  explicitRelayUrls: RELAYS,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper to fetch events via subscribe with timeout
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

// Helper to check if event is from RUNSTR
function isRunstrEvent(event) {
  return event.tags.some(
    (t) =>
      (t[0] === "source" && t[1]?.toUpperCase() === RUNSTR_SOURCE_TAG) ||
      (t[0] === "client" && t[1]?.toLowerCase() === "runstr")
  );
}

// Helper to get date string from timestamp (YYYY-MM-DD)
function getDateString(timestamp) {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

// Calculate streaks for a user's workout events
function calculateUserStreak(userEvents) {
  if (userEvents.length === 0) return 0;

  // Sort events by date (oldest first)
  const sortedEvents = userEvents.sort((a, b) => a.created_at - b.created_at);
  
  // Get unique workout dates
  const workoutDates = [...new Set(sortedEvents.map(event => getDateString(event.created_at)))];
  workoutDates.sort();

  if (workoutDates.length === 0) return 0;
  if (workoutDates.length === 1) return 1;

  // Calculate consecutive days from the most recent date
  let streak = 1;
  const latestDate = workoutDates[workoutDates.length - 1];
  
  for (let i = workoutDates.length - 2; i >= 0; i--) {
    const currentDate = new Date(workoutDates[i]);
    const nextDate = new Date(workoutDates[i + 1]);
    const dayDiff = (nextDate - currentDate) / (1000 * 60 * 60 * 24);
    
    if (dayDiff === 1) {
      streak++;
    } else {
      break; // Streak is broken
    }
  }

  return streak;
}

// Calculate rewards for all users
function calculateRewards(events) {
  const userWorkouts = new Map();
  
  // Group events by pubkey
  for (const event of events) {
    if (!userWorkouts.has(event.pubkey)) {
      userWorkouts.set(event.pubkey, []);
    }
    userWorkouts.get(event.pubkey).push(event);
  }

  const rewards = [];

  for (const [pubkey, workouts] of userWorkouts) {
    const workoutCount = workouts.length;
    const streakDays = calculateUserStreak(workouts);
    
    const workoutReward = workoutCount * SATS_PER_WORKOUT;
    const streakReward = streakDays * SATS_PER_STREAK_DAY;
    const totalReward = workoutReward + streakReward;

    const npub = nip19.npubEncode(pubkey);
    
    rewards.push({
      npub,
      pubkey,
      workoutCount,
      streakDays,
      workoutReward,
      streakReward,
      totalReward,
      workouts: workouts.map(w => ({
        date: getDateString(w.created_at),
        content: (w.content || "").substring(0, 100) + (w.content?.length > 100 ? "..." : "")
      }))
    });
  }

  // Sort by total reward (highest first)
  return rewards.sort((a, b) => b.totalReward - a.totalReward);
}

// Format and display results
function displayResults(rewards, startDate, endDate) {
  console.log("\n" + "=".repeat(80));
  console.log("🏃 RUNSTR WEEKLY REWARDS CALCULATION");
  console.log("=".repeat(80));
  console.log(`📅 Period: ${startDate} to ${endDate}`);
  console.log(`💰 Rate: ${SATS_PER_WORKOUT} sats per workout + ${SATS_PER_STREAK_DAY} sats per streak day`);
  console.log(`👥 Total users: ${rewards.length}`);
  
  const totalPayout = rewards.reduce((sum, user) => sum + user.totalReward, 0);
  console.log(`💸 Total payout: ${totalPayout.toLocaleString()} sats`);
  console.log("=".repeat(80));

  if (rewards.length === 0) {
    console.log("❌ No RUNSTR workout events found for this period.");
    return;
  }

  console.log("\n📊 REWARD BREAKDOWN:");
  console.log("-".repeat(120));
  console.log("NPUB".padEnd(65) + "WORKOUTS".padEnd(10) + "STREAK".padEnd(8) + "WORKOUT SATS".padEnd(13) + "STREAK SATS".padEnd(12) + "TOTAL SATS");
  console.log("-".repeat(120));

  for (const user of rewards) {
    const npubShort = user.npub.substring(0, 63) + "...";
    console.log(
      npubShort.padEnd(65) +
      user.workoutCount.toString().padEnd(10) +
      user.streakDays.toString().padEnd(8) +
      user.workoutReward.toString().padEnd(13) +
      user.streakReward.toString().padEnd(12) +
      user.totalReward.toString()
    );
  }

  console.log("-".repeat(120));
  console.log(`TOTAL:`.padEnd(91) + totalPayout.toString());

  // Show payment list
  console.log("\n💰 PAYMENT LIST (copy-paste ready):");
  console.log("-".repeat(80));
  for (const user of rewards) {
    if (user.totalReward > 0) {
      console.log(`${user.npub}: ${user.totalReward} sats`);
    }
  }

  // Show detailed breakdown
  console.log("\n📋 DETAILED BREAKDOWN:");
  console.log("-".repeat(80));
  for (const user of rewards) {
    console.log(`\n👤 ${user.npub}`);
    console.log(`   📊 ${user.workoutCount} workouts, ${user.streakDays}-day streak`);
    console.log(`   💰 ${user.workoutReward} (workouts) + ${user.streakReward} (streak) = ${user.totalReward} sats`);
    console.log(`   📅 Workout dates:`);
    const dates = [...new Set(user.workouts.map(w => w.date))].sort();
    console.log(`      ${dates.join(", ")}`);
  }
}

async function main() {
  console.log("🔄 Connecting to Nostr relays...");
  await ndk.connect();
  console.log(`✅ Connected to ${RELAYS.length} relays.`);

  const since = Math.floor(Date.now() / 1000) - WEEK_IN_SECONDS;
  const startDate = new Date(since * 1000).toLocaleDateString();
  const endDate = new Date().toLocaleDateString();

  console.log(`\n🔍 Fetching workout events from the last 7 days...`);
  console.log(`📅 Time range: ${startDate} to ${endDate}`);
  
  let events = await fetchWeeklyWorkoutEvents(ndk, since);
  console.log(`📥 Fetched ${events.size} total kind:1301 events`);

  // Filter for RUNSTR events
  const runstrEvents = Array.from(events).filter(isRunstrEvent);
  console.log(`✅ Found ${runstrEvents.length} RUNSTR workout events`);

  if (runstrEvents.length === 0) {
    console.log("❌ No RUNSTR workout events found for this period.");
    rl.close();
    return;
  }

  // Calculate rewards
  const rewards = calculateRewards(runstrEvents);
  
  // Display results
  displayResults(rewards, startDate, endDate);

  rl.close();
}

main().catch(console.error); 