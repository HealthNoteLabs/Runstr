# RUNSTR Weekly Rewards Calculation Script

This script calculates weekly rewards for RUNSTR users based on their kind 1301 workout events from the last 7 days.

## Features

- **Queries multiple Nostr relays** for comprehensive event collection
- **Filters for RUNSTR events** using source/client tags
- **Calculates streaks** based on consecutive workout days
- **Computes rewards** using: 50 sats per workout + 50 sats per consecutive streak day
- **Outputs detailed breakdown** with payment-ready npub list

## Usage

### Option 1: Run with Node.js
```bash
cd scripts
node calculate-weekly-rewards.mjs
```

### Option 2: Run with batch file (Windows)
```bash
cd scripts
calculate-rewards.bat
```

## Output Sections

The script provides several output sections:

### 1. Summary Statistics
- Time period covered
- Total users found
- Total payout amount
- Reward rates

### 2. Reward Breakdown Table
- Each user's workout count, streak days, and reward breakdown
- Sorted by total reward amount (highest first)

### 3. Payment List (Copy-Paste Ready)
- Simple format: `npub...: X sats`
- Perfect for manual payment processing

### 4. Detailed Breakdown
- Full user analysis with workout dates
- Shows exactly which days each user worked out
- Helpful for verification and dispute resolution

## Reward Calculation Logic

For each user:
- **Workout Reward**: `workout_count × 50 sats`
- **Streak Reward**: `consecutive_days × 50 sats`
- **Total Reward**: `workout_reward + streak_reward`

### Streak Calculation
- Counts consecutive days with workouts within the 7-day period
- A user with workouts on Mon, Tue, Wed gets a 3-day streak
- A user with workouts on Mon, Wed, Fri gets a 1-day streak (broken by Tue gap)

## Example Output

```
🏃 RUNSTR WEEKLY REWARDS CALCULATION
================================================================================
📅 Period: 1/13/2025 to 1/20/2025
💰 Rate: 50 sats per workout + 50 sats per streak day
👥 Total users: 15
💸 Total payout: 2,350 sats
================================================================================

📊 REWARD BREAKDOWN:
------------------------------------------------------------------------------------------------------------------------
NPUB                                                             WORKOUTS  STREAK  WORKOUT SATS  STREAK SATS TOTAL SATS
------------------------------------------------------------------------------------------------------------------------
npub1xyz...abc                                                   5         5       250           250         500
npub1def...ghi                                                   3         3       150           150         300
...

💰 PAYMENT LIST (copy-paste ready):
--------------------------------------------------------------------------------
npub1xyz...abc: 500 sats
npub1def...ghi: 300 sats
...
```

## Configuration

You can modify these constants in the script:
- `SATS_PER_WORKOUT`: Reward per individual workout (default: 50)
- `SATS_PER_STREAK_DAY`: Reward per consecutive day (default: 50)
- `RELAYS`: List of Nostr relays to query
- `FETCH_TIMEOUT_MS`: How long to wait for relay responses (default: 15 seconds)

## Dependencies

The script uses the existing dependencies in the scripts package.json:
- `@nostr-dev-kit/ndk`
- `nostr-tools`

## Troubleshooting

### No events found
- Check if relays are responding
- Verify users are tagging events with RUNSTR source/client tags
- Confirm events are kind 1301

### Incomplete data
- Increase `FETCH_TIMEOUT_MS` for slower relays
- Add more relays to the `RELAYS` array
- Run the script multiple times and compare results

## Weekly Workflow

1. Run script every Friday: `calculate-rewards.bat`
2. Review the detailed breakdown for accuracy
3. Copy the payment list section
4. Process manual payments to each npub
5. Keep output for record-keeping 