#!/bin/bash

# Install Claude Learning System Git Hooks

echo "Installing Claude Learning System Git Hooks..."

# Set git hooks path to our custom directory
git config core.hooksPath .githooks

# Make sure all hooks are executable
chmod +x .githooks/*

echo "✅ Git hooks installed successfully!"
echo ""
echo "The learning system will now:"
echo "  - Automatically detect mistake-fixing commits"
echo "  - Log mistakes to .claude-learning.json"
echo "  - Update CLAUDE.md periodically with lessons learned"
echo ""
echo "Manual commands:"
echo "  node scripts/claude-learning-system.js log \"Description\" --solution \"Fix\" --prevention \"Prevention\""
echo "  node scripts/claude-learning-system.js scan --days 7"
echo "  node scripts/claude-learning-system.js update"