import NDK from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import fs from "fs";

// --- Configuration ---
const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol", 
  "wss://relay.primal.net",
  "wss://relay.nostr.band"
];

const RUNSTR_SOURCE_TAG = "RUNSTR";
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 10000; // 10 second timeout

// Reward rates
const SATS_PER_WORKOUT = 50;
const SATS_PER_STREAK_DAY = 50;

// Level system constants
const BASE_XP = 10;
const XP_LEVELS = [
  0, 50, 125, 225, 350, 500, 675, 875, 1100, 1350, 1625, 1925, 2250, 2600, 2975, 3375,
  3800, 4250, 4725, 5225, 5750, 6300, 6875, 7475, 8100, 8750, 9425, 10125, 10850, 11600
];

function calculateLevel(totalXp) {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= XP_LEVELS[i]) {
      return i + 1;
    }
  }
  return 1;
}

function isRunstrEvent(event) {
  const tags = event.tags || [];
  return tags.some(tag => 
    (tag[0] === 'r' && tag[1] === RUNSTR_SOURCE_TAG) ||
    (tag[0] === 'client' && tag[1] === RUNSTR_SOURCE_TAG)
  );
}

function formatDisplayName(npub) {
  if (!npub) return "Unknown";
  return npub.substring(0, 12) + "...";
}

async function fetchEvents(startTime, endTime, description = "events") {
  console.log(`🔍 Fetching ${description}...`);
  
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
    enableOutboxModel: false
  });

  try {
    console.log("📡 Connecting to relays...");
    await Promise.race([
      ndk.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
    ]);
    
    console.log(`📡 Connected successfully`);

    const filter = {
      kinds: [1301],
      since: startTime,
      until: endTime,
    };

    console.log(`⏰ Time range: ${new Date(startTime * 1000).toLocaleDateString()} to ${new Date(endTime * 1000).toLocaleDateString()}`);

    const eventsPromise = ndk.fetchEvents(filter, { 
      groupable: false,
      closeOnEose: true
    });

    const events = await Promise.race([
      eventsPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), FETCH_TIMEOUT_MS))
    ]);

    console.log(`✅ Fetched ${events.size} ${description}`);
    return Array.from(events);
  } catch (error) {
    console.error(`❌ Error fetching ${description}: ${error.message}`);
    return [];
  }
}

function calculateWeeklyRewards(events) {
  const runstrEvents = events.filter(isRunstrEvent);
  console.log(`🔍 Processing ${runstrEvents.length} RUNSTR events for rewards`);
  
  const userWorkouts = new Map();

  // Process each event
  runstrEvents.forEach(event => {
    try {
      const npub = nip19.npubEncode(event.pubkey);
      const eventDate = new Date(event.created_at * 1000);
      const dateKey = eventDate.toISOString().split('T')[0];

      if (!userWorkouts.has(npub)) {
        userWorkouts.set(npub, new Set());
      }
      userWorkouts.get(npub).add(dateKey);
    } catch (error) {
      console.warn(`⚠️ Error processing event: ${error.message}`);
    }
  });

  // Calculate rewards for each user
  const rewards = [];
  for (const [npub, workoutDates] of userWorkouts.entries()) {
    const sortedDates = Array.from(workoutDates).sort();
    const workoutCount = sortedDates.length;
    
    // Calculate consecutive streak
    let maxStreak = 0;
    let currentStreak = 1;
    
    if (sortedDates.length > 0) {
      maxStreak = 1;
      
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]);
        const currentDate = new Date(sortedDates[i]);
        const diffDays = (currentDate - prevDate) / (1000 * 60 * 60 * 24);
        
        if (diffDays === 1) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
      }
    }

    const workoutReward = workoutCount * SATS_PER_WORKOUT;
    const streakReward = maxStreak * SATS_PER_STREAK_DAY;
    const totalReward = workoutReward + streakReward;

    if (totalReward > 0) {
      rewards.push({
        npub,
        workoutCount,
        streakDays: maxStreak,
        workoutReward,
        streakReward,
        totalReward,
        workoutDates: sortedDates
      });
    }
  }

  console.log(`💰 Calculated rewards for ${rewards.length} users`);
  return rewards.sort((a, b) => b.totalReward - a.totalReward);
}

function calculateLevelAchievements(weeklyEvents, allEvents) {
  console.log(`🏆 Calculating level achievements from ${allEvents.length} total events`);
  
  // Calculate all-time user levels
  const userWorkouts = new Map();
  
  allEvents.forEach(event => {
    try {
      const npub = nip19.npubEncode(event.pubkey);
      if (!userWorkouts.has(npub)) {
        userWorkouts.set(npub, []);
      }
      userWorkouts.get(npub).push(event);
    } catch (error) {
      console.warn(`⚠️ Error processing event: ${error.message}`);
    }
  });

  // Calculate levels before this week
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - WEEK_IN_SECONDS;
  
  const weeklyUserWorkouts = new Map();
  weeklyEvents.forEach(event => {
    try {
      const npub = nip19.npubEncode(event.pubkey);
      if (!weeklyUserWorkouts.has(npub)) {
        weeklyUserWorkouts.set(npub, []);
      }
      weeklyUserWorkouts.get(npub).push(event);
    } catch (error) {
      console.warn(`⚠️ Error processing event: ${error.message}`);
    }
  });

  const levelAchievements = [];

  for (const [npub, allWorkouts] of userWorkouts.entries()) {
    const weeklyWorkouts = weeklyUserWorkouts.get(npub) || [];
    
    if (weeklyWorkouts.length === 0) continue;

    // Calculate total XP and level before this week
    const preWeekWorkouts = allWorkouts.filter(event => event.created_at < startTime);
    const preWeekXp = preWeekWorkouts.length * BASE_XP;
    const preWeekLevel = calculateLevel(preWeekXp);

    // Calculate total XP and level after this week
    const totalXp = allWorkouts.length * BASE_XP;
    const currentLevel = calculateLevel(totalXp);

    if (currentLevel > preWeekLevel) {
      const levelsGained = currentLevel - preWeekLevel;
      const weeklyXp = weeklyWorkouts.length * BASE_XP;

      levelAchievements.push({
        npub,
        preWeekLevel,
        currentLevel,
        levelsGained,
        weeklyWorkouts: weeklyWorkouts.length,
        weeklyXp,
        totalXp
      });
    }
  }

  console.log(`🏆 Found ${levelAchievements.length} users who leveled up`);
  return levelAchievements.sort((a, b) => b.levelsGained - a.levelsGained);
}

function generateSocialMediaPost(rewardsData, levelData, startDate, endDate) {
  const totalPayout = rewardsData.reduce((sum, user) => sum + user.totalReward, 0);
  const totalUsers = rewardsData.length;
  const topStreaks = rewardsData.slice(0, 3).filter(user => user.streakDays > 1);
  
  const today = new Date();
  const weekNumber = Math.ceil(((today - new Date(today.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
  
  let post = `🏃‍♂️ RUNSTR Weekly Update #${weekNumber} 🏃‍♀️\n\n`;
  post += `"Every mile begins with a single step. Every PR begins with showing up." 💪\n\n`;
  
  // Weekly Rewards Recap
  post += `🏃‍♂️💰 WEEKLY REWARDS RECAP\n`;
  post += `════════════════════════════════\n`;
  post += `💸 Total payout: ${totalPayout.toLocaleString()} sats\n`;
  post += `👥 Active runners: ${totalUsers}\n`;
  
  if (topStreaks.length > 0) {
    post += `🔥 Top streak achievers:\n`;
    topStreaks.forEach((user, index) => {
      post += `   ${index + 1}. ${formatDisplayName(user.npub)} - ${user.streakDays} day streak!\n`;
    });
  }
  
  const totalWorkouts = rewardsData.reduce((sum, user) => sum + user.workoutCount, 0);
  post += `📊 Community: ${totalWorkouts} workouts completed this week\n`;
  post += `📅 Week: ${startDate} to ${endDate}\n`;
  post += `\n💡 Tag your runs with RUNSTR to earn weekly rewards!\n\n`;

  // Weekly Level Achievements
  if (levelData.length > 0) {
    post += `🏆 WEEKLY LEVEL ACHIEVEMENTS\n`;
    post += `═══════════════════════════════\n`;
    post += `🎉 ${levelData.length} runners leveled up this week!\n\n`;
    
    levelData.slice(0, 5).forEach(user => {
      post += `🎖️ ${formatDisplayName(user.npub)}: Level ${user.preWeekLevel} → ${user.currentLevel} (+${user.levelsGained})\n`;
    });
    
    if (levelData.length > 5) {
      post += `   ... and ${levelData.length - 5} more achieved new levels!\n`;
    }
    post += `\n`;
  }

  // Project Update
  post += `📢 PROJECT UPDATE\n`;
  post += `═════════════════\n`;
  post += `RUNSTR continues to grow as the premier Bitcoin-native fitness app! We're building the future of decentralized fitness tracking with Nostr integration, Lightning rewards, and a thriving community of runners. Our open-source approach ensures your data stays yours while connecting you with like-minded athletes worldwide. 🌍⚡\n\n`;

  // App Info
  post += `📱 GET THE APP\n`;
  post += `══════════════\n`;
  post += `Download RUNSTR for Android/CalyxOS/GrapheneOS:\n`;
  post += `🏪 Zap.Store (recommended)\n`;
  post += `💻 GitHub Releases\n`;
  post += `📖 Visit runstr.club for the latest blog updates\n\n`;

  // Support
  post += `❤️ SUPPORT RUNSTR\n`;
  post += `═════════════════\n`;
  post += `Help us build the future of Bitcoin fitness!\n`;
  post += `💰 Donate: https://geyser.fund/project/runstr?hero=runstr\n`;
  post += `🔗 Share: Tell your running friends about RUNSTR\n`;
  post += `🧪 Test: Try new features and report bugs\n\n`;

  // Hashtags
  post += `#RUNSTR #cyclestr #walkstr #Bitcoin #Lightning #Nostr #Fitness #Running #OpenSource #Decentralized`;

  return post;
}

async function main() {
  try {
    console.log("🚀 Generating RUNSTR Weekly Social Media Post...\n");

    // Calculate date range for this week (last 7 days)
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - WEEK_IN_SECONDS;
    
    const startDate = new Date(startTime * 1000).toLocaleDateString();
    const endDate = new Date(endTime * 1000).toLocaleDateString();
    
    console.log(`📅 Processing week: ${startDate} to ${endDate}\n`);

    // Fetch weekly events
    console.log("1. Fetching weekly workout events...");
    const weeklyEvents = await fetchEvents(startTime, endTime, "weekly events");
    
    // For level calculations, fetch last 2 months instead of all history
    console.log("\n2. Fetching recent events for level calculations...");
    const twoMonthsAgo = endTime - (60 * 24 * 60 * 60); // 60 days ago
    const allEvents = await fetchEvents(twoMonthsAgo, endTime, "recent events (2 months)");

    console.log("\n3. Calculating weekly rewards...");
    const rewardsData = calculateWeeklyRewards(weeklyEvents);

    console.log("\n4. Calculating level achievements...");
    const levelData = calculateLevelAchievements(weeklyEvents, allEvents);

    console.log("\n5. Generating social media post...");
    const socialPost = generateSocialMediaPost(rewardsData, levelData, startDate, endDate);

    // Save to file
    const today = new Date();
    const filename = `weekly-social-post-${today.toISOString().split('T')[0]}.txt`;
    fs.writeFileSync(filename, socialPost);

    console.log("\n" + "=".repeat(80));
    console.log("📱 RUNSTR WEEKLY SOCIAL MEDIA POST");
    console.log("=".repeat(80));
    console.log(socialPost);
    console.log("=".repeat(80));
    console.log(`\n✅ Social media post saved to: ${filename}`);
    console.log("📋 Copy and paste the content above to your social media platforms!");

    // Summary
    console.log("\n📊 SUMMARY:");
    console.log(`  • Weekly events fetched: ${weeklyEvents.length}`);
    console.log(`  • Historical events fetched: ${allEvents.length}`);
    console.log(`  • Users with rewards: ${rewardsData.length}`);
    console.log(`  • Users who leveled up: ${levelData.length}`);
    console.log(`  • Total payout: ${rewardsData.reduce((sum, user) => sum + user.totalReward, 0)} sats`);

  } catch (error) {
    console.error("❌ Error generating social media post:", error);
    process.exit(1);
  }
}

// Run the script
main(); 