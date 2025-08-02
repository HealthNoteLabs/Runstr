# Claude Learning System

An automated system that helps Claude Code learn from mistakes and avoid repeating them in the future.

## Overview

The Claude Learning System automatically:
- Detects mistake-fixing commits through git hooks
- Logs mistakes with context, solutions, and prevention strategies  
- Updates CLAUDE.md with learned lessons and common patterns
- Provides CLI tools for manual mistake logging and analysis

## Quick Setup

```bash
# Install the learning system (one-time setup)
npm run claude:setup
```

This installs git hooks that automatically detect and log mistakes when you commit fixes.

## Usage

### Automatic Detection
The system automatically detects commits with these patterns:
- `fix`, `revert`, `undo`, `broke`, `broken`, `error`, `mistake`, `wrong`, `restore`

When detected, mistakes are logged to `.claude-learning.json` and CLAUDE.md is updated periodically.

### Manual Logging
```bash
# Log a mistake with full context
npm run claude:log "Description of what went wrong" --solution "How it was fixed" --prevention "How to prevent it"

# Example
npm run claude:log "Broke build by updating wrong dependency" --solution "Reverted and tested in branch" --prevention "Always test dependency updates in separate branch"
```

### Analysis Commands
```bash
# Scan recent commits for missed mistakes
npm run claude:scan -- --days 7

# Update CLAUDE.md with recent lessons
npm run claude:update
```

## How It Works

### 1. Detection Phase
- **Git Hook**: Post-commit hook scans commit messages for mistake patterns
- **Pattern Matching**: Uses regex to identify fix/revert type commits
- **Context Capture**: Records git hash, branch, timestamp, and commit message

### 2. Logging Phase
- **Structured Storage**: Mistakes stored in `.claude-learning.json`
- **Categorization**: Automatic categorization (git-commit, build-error, etc.)
- **Context Preservation**: Full context including git metadata

### 3. Learning Phase
- **Pattern Analysis**: Identifies common mistake categories
- **Documentation Update**: Automatically updates CLAUDE.md
- **Prevention Guidance**: Generates specific prevention strategies

## Data Structure

Mistakes are logged with this structure:
```json
{
  "timestamp": "2025-01-29T10:30:00.000Z",
  "type": "git-commit",
  "description": "fix: resolve team event loading issue",
  "context": {
    "gitHash": "abc123...",
    "autoDetected": true
  },
  "solution": "Added null check for team data",
  "prevention": "Always validate data before processing",
  "branch": "main"
}
```

## Learning Outputs

### CLAUDE.md Updates
The system automatically adds a "Learned Lessons & Mistake Prevention" section to CLAUDE.md with:
- Recent mistakes grouped by category
- Common patterns to avoid
- Prevention strategies
- Reference commands

### Categories
- **Git & Version Control**: Branch management, merge conflicts
- **Build & Compilation**: Dependency issues, build failures
- **Testing Issues**: Test failures, coverage problems
- **File Operations**: Path errors, permission issues
- **Dependencies & Packages**: Version conflicts, compatibility
- **Manual Observations**: User-reported issues

## Files Created

- `scripts/claude-learning-system.js` - Main learning system
- `.githooks/post-commit` - Git hook for automatic detection
- `.githooks/install.sh` - Hook installation script
- `.claude-learning.json` - Mistake log (auto-created)

## Benefits

1. **Reduced Repeated Mistakes**: Claude learns from past errors
2. **Better Documentation**: CLAUDE.md stays current with real issues
3. **Pattern Recognition**: Identifies systemic problems
4. **Team Learning**: Shared knowledge across all Claude interactions
5. **Historical Context**: Maintains history of what's been tried

## Privacy & Security

- Only commit messages and public git metadata are captured
- No sensitive code or personal information is logged
- All data stays local in your repository
- You control what gets committed to version control

## Customization

Edit `scripts/claude-learning-system.js` to:
- Add custom mistake patterns
- Modify categorization logic
- Change update frequency
- Customize documentation format

The system is designed to be lightweight and non-intrusive while providing maximum learning value.