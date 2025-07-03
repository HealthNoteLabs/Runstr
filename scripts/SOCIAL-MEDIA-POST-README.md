# RUNSTR Weekly Social Media Post Generator

## Overview
This script automatically generates a comprehensive weekly social media post for RUNSTR.

## Features
- Weekly rewards recap (payouts, active runners, streaks)
- Level achievements (users who leveled up)
- Project updates and app information
- Support links and hashtags

## Usage

### Windows
```bash
generate-weekly-social-post.bat
```

### Linux/Mac
```bash
node generate-weekly-social-post.mjs
```

## Output
- Console display of the complete post
- Saves to `weekly-social-post-YYYY-MM-DD.txt`
- Ready to copy-paste to social media

## Requirements
- Node.js
- NPM packages: @nostr-dev-kit/ndk, nostr-tools

## Best Practice
Run weekly (Sunday evening or Monday morning) for previous week's data.

## What the Script Does

1. **Fetches Data**: Connects to Nostr relays and fetches workout events from the past week
2. **Calculates Rewards**: Determines who earned sats for workouts and streaks
3. **Calculates Achievements**: Identifies users who leveled up this week
4. **Generates Post**: Creates a formatted social media post with all the data
5. **Saves Output**: Saves the post to a text file with today's date

## Post Structure

The generated post includes:

### Header
- Week number and motivational quote

### Weekly Rewards Recap 🏃‍♂️💰
- Total sats paid out
- Number of active runners
- Top 3 streak achievers
- Total workouts completed
- Call to action for tagging runs

### Weekly Level Achievements 🏆
- Number of users who leveled up
- Top 5 level gainers with before/after levels
- Summary if more than 5 users leveled up

### Project Update 📢
- General information about RUNSTR's mission and growth
- Focus on Bitcoin-native fitness and decentralization

### App Information 📱
- Download sources (Zap.Store, GitHub)
- Supported platforms (Android/CalyxOS/GrapheneOS)
- Blog link (runstr.club)

### Support Section ❤️
- Geyser fund donation link
- Ways to contribute (sharing, testing, feedback)

### Hashtags
- #RUNSTR #cyclestr #walkstr #Bitcoin #Lightning #Nostr #Fitness #Running #OpenSource #Decentralized

## Configuration

The script uses the same configuration as other RUNSTR scripts:
- **Relays**: Standard Nostr relays for data fetching
- **Rewards**: 50 sats per workout, 50 sats per streak day
- **Level System**: Based on 10 XP per workout with predefined thresholds

## Dependencies

Make sure you have the required packages installed:
```bash
npm install @nostr-dev-kit/ndk nostr-tools
```

## Timing

Best run weekly (typically Sunday evening or Monday morning) to capture the previous week's activity and prepare for social media posting.

## Usage Tips

1. **Copy-Paste Ready**: The output is formatted for direct use on social media platforms
2. **Customizable**: Edit the `generateSocialMediaPost()` function to adjust formatting or content
3. **Backup**: The text file serves as a backup and revision history
4. **Platform Adaptation**: You may need to adjust character limits for different platforms (Twitter vs Nostr vs LinkedIn)

## Troubleshooting

- **No events found**: Check relay connectivity and date range
- **Level calculation errors**: Ensure historical data is available
- **Missing dependencies**: Run `npm install` in the scripts directory
- **Permission errors**: Ensure write permissions for saving the output file 