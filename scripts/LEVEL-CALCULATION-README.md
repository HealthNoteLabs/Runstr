# RUNSTR Level Calculation Scripts

This directory contains scripts to calculate user levels and track weekly level achievements based on **ALL** workout events (NIP-101e kind 1301) from any source, matching the behavior of the RUNSTR app.

## 📊 Available Scripts

### 1. User Levels Script (`calculate-user-levels.mjs`)
**Purpose**: Calculate all-time user levels for users based on their total Nostr workout activity

**Features**:
- Fetches all historical workout events (kind 1301) from Nostr relays
- Counts ALL workout events for each user (RUNSTR, Strava imports, other apps, manual posts)
- Calculates total XP and current level for each user
- Displays ranked leaderboard with detailed statistics
- Shows level distribution across all users
- Outputs copy-paste ready user list with levels
- **Matches RUNSTR app level calculation exactly**

**Usage**:
```bash
# Node.js
cd scripts
node calculate-user-levels.mjs

# Windows batch file
cd scripts
calculate-user-levels.bat
```

### 2. Weekly Level Achievements Script (`calculate-weekly-level-achievements.mjs`)
**Purpose**: Identify users who achieved new levels in the past 7 days based on total workout activity

**Features**:
- Compares user levels before/after the current week
- Counts ALL workout events (not just RUNSTR-tagged)
- Identifies users who leveled up during the week
- Shows detailed breakdown of weekly workouts and XP gained
- Calculates suggested reward amounts for level achievements
- Outputs copy-paste ready reward list
- **Matches RUNSTR app level calculation exactly**

**Usage**:
```bash
# Node.js
cd scripts
node calculate-weekly-level-achievements.mjs

# Windows batch file
cd scripts
calculate-weekly-level-achievements.bat
```

## 🎮 Level System Mechanics

### XP Calculation
- **No Distance Threshold**: ALL workouts count for XP (matches app behavior)
- **Base XP**: 10 XP for any workout
- **Distance Bonus**: +5 XP per additional mile beyond the first mile
- **Formula**: `XP = 10 + (Math.floor(distanceInMiles - 1) * 5)`

### Level Progression
- **Levels 1-10**: 100 XP per level (100, 200, 300, ..., 1000)
- **Levels 11+**: More complex scaling formula

### Examples
- 0.5 mile walk = 10 XP (5 XP bonus, but minimum 10 XP)
- 1.0 mile run = 10 XP
- 2.5 mile run = 10 + (1 * 5) = 15 XP  
- 5.2 mile run = 10 + (4 * 5) = 30 XP
- 10.0 mile run = 10 + (9 * 5) = 55 XP

## 📈 Output Formats

### User Levels Script Output

```
🏆 RUNSTR USER LEVELS - ALL TIME RANKINGS
================================================================================
📊 Summary:
   • Total Users: 45
   • Total Qualifying Workouts: 423
   • Average Level: 3.2
   • Highest Level: 12

🥇 TOP USERS BY LEVEL:
──────────────────────────────────────────────────────────────────────────────
Rank | Level |    XP | Workouts | Progress | Next Level | User
──────────────────────────────────────────────────────────────────────────────
   1 |    12 |  1250 |       45 |   250/300 |         50 | npub1abc123...
   2 |    10 |  1000 |       38 |   0/150    |        150 | npub1def456...
   3 |     8 |   800 |       29 |   0/100    |        100 | npub1ghi789...

📈 LEVEL DISTRIBUTION:
────────────────────────────────────────────
Level 12:   1 users (2.2%) █
Level 10:   2 users (4.4%) ██
Level  8:   3 users (6.7%) ███
Level  5:   8 users (17.8%) ████████████████████

💾 COMPLETE USER LIST (Copy-paste ready):
──────────────────────────────────────────────────────────────────────────────
npub1abc123...: Level 12 (1250 XP, 45 workouts)
npub1def456...: Level 10 (1000 XP, 38 workouts)
```

### Weekly Level Achievements Output

```
🎉 RUNSTR WEEKLY LEVEL ACHIEVEMENTS
================================================================================
📅 Period: 1/13/2025 to 1/20/2025

🏆 ACHIEVEMENT SUMMARY:
   • Users who leveled up: 3
   • Total levels gained: 4
   • Total XP gained: 125
   • Average levels gained: 1.3
   • Highest level achieved: 8
   • Total active users this week: 12

🎖️ USERS WHO LEVELED UP:
─────────────────────────────────────────────────────────────────────────────────
User                 | Before | After | Gained |   XP | Workouts | Weekly XP
─────────────────────────────────────────────────────────────────────────────────
npub1abc123...       |      6 |     8 |     +2 |  +65 |        3 |       +65
npub1def456...       |      4 |     5 |     +1 |  +35 |        2 |       +35
npub1ghi789...       |      2 |     3 |     +1 |  +25 |        1 |       +25

🎁 LEVEL ACHIEVEMENT REWARDS (Copy-paste ready):
──────────────────────────────────────────────────────────────────────────────
npub1abc123...: Level 6→8 (+2) = 1000 sats
npub1def456...: Level 4→5 (+1) = 500 sats
npub1ghi789...: Level 2→3 (+1) = 500 sats
```

## ⚙️ Configuration

### Relay Configuration
Both scripts connect to these Nostr relays:
- wss://relay.damus.io
- wss://nos.lol
- wss://relay.primal.net
- wss://relay.nostr.band
- wss://purplepag.es
- wss://relay.nostr.info

### Event Inclusion
Scripts count **ALL** kind 1301 workout events, including:
- ✅ RUNSTR app workouts
- ✅ Strava imports to Nostr
- ✅ Other Nostr fitness apps
- ✅ Manual workout posts
- ✅ Any valid kind 1301 event with distance tags

### Timeouts
- **Fetch Timeout**: 20 seconds for comprehensive event collection
- **Week Definition**: Rolling 7-day period (last 168 hours)

## 🔧 Dependencies

Ensure you have the required dependencies installed in the scripts directory:

```json
{
  "@nostr-dev-kit/ndk": "^2.12.2",
  "nostr-tools": "^1.14.0",
  "ws": "^8.14.2"
}
```

Install with:
```bash
cd scripts
npm install
```

## 🎯 Use Cases

### Weekly Awards
1. Run `calculate-weekly-level-achievements.mjs` every Monday
2. Copy the "Level Achievement Rewards" section
3. Manually zap users who leveled up during the week
4. Base reward: 500 sats per level gained (customizable)

### Community Recognition
1. Run `calculate-user-levels.mjs` monthly for community updates
2. Share top performers and level distribution stats
3. Recognize milestone achievements (Level 10, Level 15, etc.)

### Analytics & Growth Tracking
- Monitor community engagement through active user counts
- Track level progression over time
- Identify top performers for special recognition
- Analyze workout patterns and XP distribution

## 🚀 Performance Notes

- **All-time levels script**: May take 20-30 seconds due to comprehensive historical data fetching
- **Weekly achievements script**: Faster execution (~10-15 seconds) with focused time range
- **Relay reliability**: Multiple relays ensure comprehensive event coverage
- **Deduplication**: Automatic handling of duplicate events across relays

## 📝 Customization

### Reward Amounts
Edit the reward calculation in `calculate-weekly-level-achievements.mjs`:
```javascript
const baseSats = 500; // Base reward per level gained
const totalReward = baseSats * rewardMultiplier;
```

### Display Limits
Modify the top users display count:
```javascript
userLevels.slice(0, 20).forEach((user, index) => {
// Change 20 to desired number of top users
```

### Time Periods
Adjust the week definition:
```javascript
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days
// Change to different period as needed
```

## 🎯 Accuracy Note

These scripts now **exactly match** the RUNSTR app's level calculation by:
- Counting ALL workout events from any source
- Using the same XP calculation formula
- Applying the same level progression system
- Including all workouts regardless of distance

This ensures that user levels displayed in awards match what users see in their RUNSTR app profile. 