#!/bin/bash

echo "==============================================="
echo "    RUNSTR AUG 3-15, 2025 REPORTS"
echo "==============================================="
echo ""
echo "This will run all three scripts for the Aug 3-15, 2025 period:"
echo "1. Weekly Rewards Calculator"
echo "2. Level Achievements Calculator"
echo "3. Newsletter Generator"
echo ""
echo "Please wait while we fetch data from Nostr..."
echo ""

cd "$(dirname "$0")"

echo "Installing dependencies if needed..."
npm install --silent

echo ""
echo "==============================================="
echo "[1/3] CALCULATING REWARDS (AUG 3-15)"
echo "==============================================="
echo ""
node calculate-weekly-rewards.js

echo ""
echo "==============================================="
echo "[2/3] CALCULATING LEVEL ACHIEVEMENTS (AUG 3-15)"
echo "==============================================="
echo ""
node calculate-level-achievements.js

echo ""
echo "==============================================="
echo "[3/3] GENERATING NEWSLETTER (AUG 3-15)"
echo "==============================================="
echo ""
node generate-newsletter.js

echo ""
echo "==============================================="
echo "AUG 3-15, 2025 REPORTS COMPLETE!"
echo "==============================================="
echo ""
echo "Your outputs are ready:"
echo "1. Rewards calculation (above)"
echo "2. Level achievements data (above)"
echo "3. Newsletter file saved as newsletter-aug3-15-2025.txt"
echo ""
echo "Next steps:"
echo "1. Copy payment list and process zaps"
echo "2. Post level achievements on social media"
echo "3. Use newsletter content for period update"
echo "==============================================="
echo ""