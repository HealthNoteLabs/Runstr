# RUNSTR Weekly Badge Calculation System

## Overview

This system automatically identifies users who have achieved new level milestones and should be awarded badges based on their 1301 workout event progression.

## How It Works

1. **Fetches Data**: Retrieves all kind 1301 workout events from Nostr relays
2. **Calculates Levels**: Uses your existing XP formula to determine each user's current level
3. **Tracks Progress**: Compares current levels against previously stored levels
4. **Identifies Recipients**: Finds users who crossed badge tier thresholds
5. **Outputs Results**: Provides a list of npubs and badges to award

## Level System

### XP Calculation
- **Qualifying Threshold**: 1+ mile distance requirement
- **Base XP**: 10 XP for any qualifying workout (1+ mile)  
- **Distance Bonus**: +5 XP per additional mile beyond the first mile
- **Formula**: `XP = 10 + (Math.floor(distanceInMiles - 1) * 5)`

### Level Progression
- **Levels 1-10**: 100 XP per level (100, 200, 300, etc.)
- **Level 11+**: Complex progression with increasing requirements

### Badge Tiers (Level 1-21)
- **Level 1**: First Steps - Your fitness journey begins!
- **Level 2**: Getting Started - Building momentum
- **Level 3**: Early Achiever - Consistency pays off
- **Level 4**: Steady Runner - Finding your rhythm
- **Level 5**: Bronze Runner - First major milestone!
- **Level 6**: Committed Athlete - Dedication showing
- **Level 7**: Weekly Warrior - Regular training habit
- **Level 8**: Distance Destroyer - Crushing those miles
- **Level 9**: Almost Elite - Approaching greatness
- **Level 10**: Silver Athlete - Elite achievement unlocked!
- **Level 11**: Double Digits - Into elite territory
- **Level 12**: Dozen Master - A full year of dedication
- **Level 13**: Lucky Thirteen - Pushing boundaries
- **Level 14**: Fortnight Fighter - Unstoppable force
- **Level 15**: Gold Champion - Championship caliber!
- **Level 16**: Sweet Sixteen - Peak performance zone
- **Level 17**: Magnificent Seventeen - Legendary status
- **Level 18**: Endurance Expert - Master of distance
- **Level 19**: Penultimate Power - Almost at the peak
- **Level 20**: Platinum Legend - Ultimate achievement!
- **Level 21**: Beyond Limits - Transcendent runner!

## Usage

### Basic Usage
```bash
# Weekly badge calculation (finds new level progressions)
node scripts/calculate-weekly-badges.mjs

# Dry run (preview only - no data changes)
node scripts/calculate-weekly-badges.mjs --dry-run

# Only check events since a specific date
node scripts/calculate-weekly-badges.mjs --since=2024-01-01

# RETROACTIVE CATCHUP - Award existing users all their badges (Level 1 to current)
node scripts/calculate-weekly-badges.mjs --catchup

# Preview catchup awards
node scripts/calculate-weekly-badges.mjs --catchup --dry-run
```

### Retroactive Badge Catchup
Use the `--catchup` flag to award ALL existing users their badges from Level 1 up to their current level. This is perfect for:

- **Initial badge deployment**: Award all existing users their earned badges
- **New badge system**: If you've updated badge tiers or descriptions
- **Data recovery**: If badge tracking data was lost

**Important**: Catchup mode awards EVERY badge from Level 1 to current level for each user. A Level 10 user would receive 10 badges (Levels 1-10). Only run this when you intend to award retroactive badges.

### Setting Up Cron Job (Weekly)
```bash
# Edit your crontab
crontab -e

# Add this line to run every Sunday at 9 AM
0 9 * * 0 cd /path/to/runstr && node scripts/calculate-weekly-badges.mjs
```

### Manual Badge Distribution Process

#### For Initial Setup (Retroactive Badges)
1. **Test catchup mode first**:
   ```bash
   node scripts/calculate-weekly-badges.mjs --catchup --dry-run
   ```

2. **Run catchup to award existing users**:
   ```bash
   node scripts/calculate-weekly-badges.mjs --catchup
   ```

3. **Review the catchup file**:
   ```bash
   cat scripts/badge-catchup-YYYY-MM-DD.json
   ```

#### For Weekly Badge Awards
1. **Test weekly run**:
   ```bash
   node scripts/calculate-weekly-badges.mjs --dry-run
   ```

2. **Run weekly calculation**:
   ```bash
   node scripts/calculate-weekly-badges.mjs
   ```

3. **Review the weekly file**:
   ```bash
   cat scripts/badge-recipients-YYYY-MM-DD.json
   ```

4. **Send badges** using your preferred method (Lightning, Cashu, etc.)

## Output Files

### `badge-tracking.json`
Stores user level progression data between runs:
```json
{
  "users": {
    "npub1xyz...": {
      "totalXP": 850,
      "currentLevel": 12,
      "qualifyingWorkouts": 47,
      "totalDistanceKm": 125.3,
      "lastWorkoutDate": "2024-01-15"
    }
  },
  "lastRun": "2024-01-20T09:00:00.000Z"
}
```

### `badge-recipients-YYYY-MM-DD.json`
Weekly output of badge recipients:
```json
[
  {
    "npub": "npub1xyz...",
    "previousLevel": 9,
    "currentLevel": 12,
    "totalXP": 1150,
    "qualifyingWorkouts": 52,
    "badges": [
      {
        "threshold": 10,
        "name": "Silver Athlete",
        "description": "Reached Level 10"
      }
    ]
  }
]
```

## Customization

### Adding New Badge Tiers
Edit the `BADGE_TIERS` object in `calculate-weekly-badges.mjs`:
```javascript
const BADGE_TIERS = {
  5: { name: "Bronze Runner", description: "Reached Level 5" },
  10: { name: "Silver Athlete", description: "Reached Level 10" },
  50: { name: "Ultra Legend", description: "Reached Level 50" }, // New tier
  // Add more tiers as needed
};
```

### Changing Relays
Modify the `DEFAULT_RELAYS` array or use environment variables to specify different relays.

### Adjusting XP Formula
The XP calculation matches your existing level system. If you modify the level system, update the `LEVEL_SYSTEM` object accordingly.

## Error Handling

The script includes comprehensive error handling for:
- Network failures when fetching events
- Malformed event data
- File system errors
- Missing environment variables

## Performance Considerations

- **Event Limit**: Currently set to 5000 events per fetch
- **Memory Usage**: Processes all events in memory
- **Network**: Fetches from multiple relays simultaneously

For large datasets, consider:
- Increasing the event limit
- Adding pagination
- Using time-based filtering (`--since` flag)

## Integration with Existing Systems

### With Reward System
The badge recipients JSON can be integrated with your existing reward calculation scripts:

```javascript
import { badgeRecipients } from './badge-recipients-2024-01-20.json';

// Process badge rewards
badgeRecipients.forEach(recipient => {
  // Send badge reward using your existing reward system
  sendBadgeReward(recipient.npub, recipient.badges);
});
```

### With UI Display
Badge data can be imported into your React components:

```javascript
// Display user's current level and badges
const userLevel = badgeData.users[userPubkey]?.currentLevel || 1;
const userXP = badgeData.users[userPubkey]?.totalXP || 0;
```

## Testing

### Test with Dry Run
Always test with `--dry-run` first to ensure the script works correctly:

```bash
node scripts/calculate-weekly-badges.mjs --dry-run
```

### Validate Against Known Users
Check the output against users you know should receive badges to validate the logic.

## Security Considerations

- **File Permissions**: Ensure badge tracking files have appropriate permissions
- **Access Control**: Limit who can run the badge calculation script
- **Data Validation**: The script validates all event data before processing

## Troubleshooting

### Common Issues

1. **No Events Found**
   - Check relay connectivity
   - Verify date ranges with `--since` flag
   - Confirm 1301 events exist in the specified time period

2. **Wrong Badge Calculations**
   - Verify the BADGE_TIERS configuration
   - Check that the level calculation matches your UI
   - Review the badge-tracking.json file for data consistency

3. **File Permission Errors**
   - Ensure the script has write permissions to the scripts directory
   - Check that the badge-tracking.json file isn't locked by another process

### Debug Mode
Add console logs or use Node.js debugging tools to trace execution:

```bash
node --inspect scripts/calculate-weekly-badges.mjs --dry-run
```

## Future Enhancements

Potential improvements to consider:

1. **Email Notifications**: Automatically notify administrators of new badge recipients
2. **Webhook Integration**: Send results to external systems
3. **Database Storage**: Store tracking data in a database instead of JSON files
4. **API Endpoint**: Create a web service for badge calculation
5. **Advanced Filtering**: Add more sophisticated event filtering options
6. **Batch Processing**: Handle very large datasets more efficiently