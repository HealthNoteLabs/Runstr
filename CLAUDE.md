# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Working Branch

**IMPORTANT: Current Active Branch is `feed-0.6.0-20250728-205524-branch`**

- **Working Branch**: `feed-0.6.0-20250728-205524-branch` 
- **Base Tag**: `feed-0.6.0-20250728-205524`
- **Repository**: HealthNoteLabs/Runstr

**DO NOT USE THE DEVELOPMENT BRANCH** - It is broken and should be avoided.

All new development, features, and bug fixes should be based on `feed-0.6.0-20250728-205524-branch`. This branch is based on a tested and working APK build.

When pushing changes:
- Push to: `feed-0.6.0-20250728-205524-branch`
- This branch generates working APK builds through GitHub Actions
- All commits should be pushed to this branch for testing and releases

## Common Development Commands

### Building and Development
- `npm run dev` - Start development server with Vite
- `npm run build` - Build for production
- `npm run build:android` - Build and sync with Android
- `npm run preview` - Preview production build locally

### Testing
- `npm test` - Run all tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:manual` - Start test server manually

### Code Quality
- `npm run lint` - Run ESLint on codebase
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is properly formatted

### Android Development
- `npm run android` - Open Android Studio
- `npx cap sync android` - Sync web assets to Android
- `npx cap open android` - Open Android project

### Testing & Debugging
- `npm run debug` - Run Nostr debugging script
- `npm run diagnose-feed` - Diagnose feed issues
- `npm run test:nip29` - Test NIP-29 (group) functionality

## Architecture Overview

### Technology Stack
- **Frontend**: React 18 with Vite build system
- **Mobile**: Capacitor for Android deployment
- **Styling**: TailwindCSS with custom design system
- **Protocol**: Nostr (Notes and Other Stuff Transmitted by Relays)
- **State Management**: React Context API
- **Routing**: React Router DOM
- **Testing**: Vitest with Testing Library

### Core Architecture Patterns

#### Nostr Integration
- **NDK Singleton**: Uses `src/lib/ndkSingleton.ts` for single NDK instance across app
- **NostrContext**: Central context at `src/contexts/NostrContext.jsx` managing authentication and relay connections
- **Signer Support**: Supports NIP-07 browser extensions, Amber (Android), and private key storage
- **Relay Management**: Configurable relays in `src/config/relays.js`

#### Context Providers Hierarchy
The app uses a nested context provider structure in App.jsx:
```
NostrProvider
  └── AuthProvider
      └── AudioPlayerProvider
          └── SettingsProvider
              └── ActivityModeProvider
                  └── RunTrackerProvider
                      └── TeamsProvider
                          └── TeamChallengeProvider
                              └── WalletProvider
```

#### Run Tracking System
- **RunTracker Service**: Core GPS tracking logic in `src/services/RunTracker.js`
- **Background Geolocation**: Uses Capacitor plugin for continuous location tracking
- **Data Persistence**: RunDataService handles local storage and Nostr publishing
- **Activity Types**: Supports running, walking, cycling modes

#### Teams & Challenges
- **NIP-29 Groups**: Uses Nostr groups protocol for team functionality
- **Team Challenges**: Built on team infrastructure with competitive elements
- **Local Team Chat**: Real-time messaging within teams

#### Wallet Integration
- **NWC (Nostr Wallet Connect)**: Primary wallet integration
- **Lightning**: Support for Lightning addresses and payments
- **Ecash**: NIP-60 based ecash wallet integration (experimental)

### Key Services

#### Feed Management
- **Feed Fetcher**: `src/utils/feedFetcher.js` - Optimized post retrieval
- **Feed Processor**: `src/utils/feedProcessor.js` - Post processing and enrichment
- **Feed Cache**: `src/utils/feedCache.js` - Caching system for performance

#### Profile & Social
- **Profile Aggregator**: `src/utils/profileAggregator.js` - User profile management
- **Name Resolution**: `src/services/nameResolver.js` - NIP-05 identifier resolution
- **Activity Feed**: Aggregates running activities across the network

#### Rewards & Gamification
- **Achievement System**: Badge-based achievements for running milestones
- **Level System**: XP-based progression system
- **Streak Rewards**: Daily/weekly running streak tracking
- **Season Pass**: Subscription-based premium features

### File Structure Conventions

#### Components
- **UI Components**: `src/components/ui/` - Reusable design system components
- **Feature Components**: `src/components/` - Feature-specific components
- **Page Components**: `src/pages/` - Route-level page components
- **Modal Components**: `src/components/modals/` - Modal dialogs

#### Services
- **Core Services**: `src/services/` - Business logic and external integrations
- **Wallet Services**: `src/services/wallet/` - Payment and wallet functionality
- **Nostr Services**: `src/services/nostr/` - Nostr protocol specific services

#### Utilities
- **Core Utils**: `src/utils/` - Pure utility functions
- **Formatters**: `src/utils/formatters.js` - Data formatting utilities
- **Calculations**: `src/utils/runCalculations.js` - Running metrics calculations

### Development Guidelines

#### Production-Safe Development
- **Minimal Changes Only**: Focus on small, precise improvements that don't disrupt existing functionality
- **No Mock Data**: Never add mock/dummy data or testing artifacts to production code
- **Avoid Code Duplication**: Reuse existing patterns and utilities rather than creating new ones
- **Conservative Approach**: Prefer configuration changes, UI tweaks, and small feature enhancements
- **No Sweeping Refactors**: Avoid large architectural changes that could break the collaborative open-source project
- **Test Existing Flows**: Ensure changes don't break current user workflows or integrations

#### Safety-First Development Principles

**CRITICAL: Always prioritize not breaking existing functionality over adding new features.**

##### Pre-Change Safety Checks (Always Before Making Any Change)
1. **Read First**: Always read the existing file completely before editing
2. **Test Commands Work**: Verify `npm run test`, `npm run lint`, `npm run build` work before starting
3. **Check Dependencies**: Look for existing imports/functions before creating new ones
4. **Understand Context**: Read related files to understand how the code fits together
5. **Clean Git Status**: Ensure current branch has clean git status

##### Change Implementation Rules
1. **One Thing at a Time**: Make one focused change per session
2. **Preserve Existing Logic**: Never delete existing logic unless explicitly required
3. **Follow Existing Patterns**: Copy patterns from similar existing code in the codebase
4. **Add, Don't Replace**: Add new functionality alongside existing, don't replace
5. **Maintain Interfaces**: Keep function signatures and export names unchanged

##### Mandatory Validation Steps (After Every Change)
1. **Run Tests**: `npm run test` - Must pass before proceeding
2. **Check Lint**: `npm run lint` - Must have zero errors/warnings  
3. **Verify Build**: `npm run build` - Must complete successfully
4. **Test in Browser**: `npm run dev` - Verify app loads and basic functionality works
5. **Git Diff Review**: Check exactly what changed before committing

##### Red Flags - Stop Immediately If You See These
- Build errors after your changes
- Test failures that weren't there before
- Lint errors in files you touched
- Console errors in browser that are new
- App won't start or loads blank page
- Any file showing as deleted in git diff unexpectedly

##### Safe Rollback Protocol
If anything breaks:
1. **Stop immediately** - Don't try to "fix forward"
2. **Git stash changes**: `git stash` to save work
3. **Verify app works**: Test that reverting fixes the issue
4. **Analyze the problem**: Understand what went wrong
5. **Apply minimal fix**: Make smallest possible change to achieve goal

##### High-Risk Areas (Extra Caution Required)
- `/src/lib/ndkSingleton.js` - Core Nostr connection
- `/src/contexts/` - App-wide state management  
- `/src/services/RunTracker.js` - GPS tracking core
- `/src/utils/nostr.js` - Nostr publishing
- `/package.json` - Dependencies and scripts
- Any file imported by many others

##### Safety Questions Before Every Change
1. "Could this break existing users' data or workflows?"
2. "Am I changing a core system that other features depend on?"
3. "Is there a simpler way that touches fewer files?"
4. "What's the worst case scenario if this goes wrong?"
5. "Can I test this change in isolation?"

#### Simplicity & Anti-Over-Engineering Principles
- **KISS Principle**: Keep It Simple, Stupid - Always choose the simplest solution that works
- **No Premature Optimization**: Don't add complexity for hypothetical future needs
- **Edit Don't Create**: Always prefer editing existing files over creating new ones
- **Single Purpose**: Each function/component should do one thing well
- **Avoid Abstractions**: Don't create abstract layers unless you have 3+ concrete use cases
- **Use Existing Patterns**: Follow established patterns in the codebase rather than inventing new ones
- **Question Complexity**: If a solution feels complex, step back and find a simpler approach
- **No Over-Engineering**: Resist the urge to build "flexible" or "extensible" solutions unless explicitly required
- **Direct Solutions**: Solve the specific problem at hand, not a generalized version of it
- **Readable Code**: Prefer explicit, clear code over clever or terse solutions

#### Nostr Event Handling
- All Nostr events should use the NDK singleton instance
- Check `ndkReady` state before publishing events
- Handle signer availability gracefully (read-only mode when no signer)
- Use proper event kinds: kind 31923 for runs, kind 9802 for team events

#### Mobile Considerations
- Android-first development approach
- Capacitor plugins for native functionality
- Background processing for GPS tracking
- Battery optimization handling

#### Performance Optimization
- Lazy loading for route components in AppRoutes.jsx
- Feed caching with 30-minute default TTL
- Chunk splitting in Vite config for better loading
- Image optimization for icons and assets

#### Error Handling
- Global error boundary with ErrorFallback component
- Nostr connection error recovery
- Graceful degradation when services unavailable
- Toast notifications for user feedback

### Testing Strategy
- Unit tests for utility functions and calculations
- Integration tests for Nostr functionality
- Component tests for UI elements
- Manual testing scripts for complex workflows

### Configuration Files
- `vite.config.js` - Build configuration with proxy settings for Wavlake API
- `capacitor.config.json` - Mobile app configuration
- `tailwind.config.js` - Design system configuration
- `tsconfig.json` - TypeScript configuration for mixed JS/TS codebase

## Recent Updates

### Kind 1 Notes Enhancement & Team Display (2025-01-29)
**Issue**: Manual posting from dashboard didn't show workout summary like auto-posting did.

**Problem**: 
- Manual "Share to Nostr" button posted plain text without workout details
- No team display in app banner
- Inconsistent user experience between posting methods

**Solution**: Modified components to:
1. **`src/components/RunTracker.jsx`**: Enhanced `handlePostToNostr` to generate workout summaries with team info
2. **`src/components/ActivityModeBanner.jsx`**: Added team display at top of banner

**Features Added**:
- Manual posts now include complete workout summaries (duration, distance, pace/steps/speed, calories, elevation)
- Team name displayed prominently at top of posts when user belongs to a team
- Team name shown in app banner above activity mode buttons
- Content is read-only in modal to prevent editing of generated summaries
- Graceful fallbacks when no team is assigned

**Result**: Both manual and auto posting now show identical workout summaries with team integration.

## Claude Learning System

**IMPORTANT: This repository includes an automated learning system that helps Claude avoid repeating mistakes.**

### How It Works
- **Automatic Detection**: Git hooks scan commit messages for mistake patterns (`fix`, `revert`, `undo`, `broke`, etc.)
- **Mistake Logging**: Detected mistakes are logged to `.claude-learning.json` with context and solutions
- **Documentation Updates**: CLAUDE.md is automatically updated with learned lessons and prevention strategies
- **Pattern Recognition**: Common mistake patterns are identified and highlighted for future avoidance

### Setup (One-time)
```bash
# Install the learning system git hooks
bash .githooks/install.sh
```

### Manual Commands
```bash
# Log a mistake manually with solution and prevention
node scripts/claude-learning-system.js log "Broke build by updating wrong dependency" --solution "Reverted and tested in branch" --prevention "Always test dependency updates in separate branch"

# Scan recent commits for mistakes
node scripts/claude-learning-system.js scan --days 7

# Update CLAUDE.md with recent lessons
node scripts/claude-learning-system.js update
```

### Current Learning Insights
*This section will be automatically populated as mistakes are detected and logged.*

### Key Learning: Avoid Over-Engineering
**Most Important Lesson**: The biggest mistakes in this codebase come from over-engineering simple problems.

**Common Over-Engineering Patterns to Avoid:**
- Creating new files when editing existing ones would work
- Building "flexible" systems for single-use cases  
- Adding abstraction layers without concrete need
- Implementing complex state management for simple data
- Creating utilities that are only used once
- Building for hypothetical future requirements

**Simple Solution Checklist:**
1. Can I edit an existing file instead of creating a new one? ✅
2. Does this solve the actual problem without extra features? ✅  
3. Can someone else understand this in 30 seconds? ✅
4. Am I following existing patterns in the codebase? ✅
5. Would a junior developer choose this approach? ✅

**Remember**: Simple, direct solutions that work are always better than complex, "elegant" solutions that might work.

## Agent System Usage

**IMPORTANT: Use the agent system in `src/agents/` for major functionality**

The app has an agent-based architecture. Select agents based on context:

- **Teams context** → TeamsAgent (team operations, chat)
- **Activity/Run context** → DashboardAgent (GPS, tracking, publishing)  
- **Profile/Stats context** → ProfileAgent (user data, achievements)
- **Settings context** → SettingsAgent (preferences, configuration)
- **Other agents**: LeagueAgent, MusicAgent, NavigationAgent, CoreServicesAgent

### Quick Usage
```javascript
import { agentManager } from './src/agents';
await agentManager.initialize();
const response = await agentManager.sendMessage('Teams', 'team.list', {});
```

Each agent has a memory file in `src/agents/memory/` - check it for known issues and best practices.

## Version Information

**IMPORTANT: Current Active Version is v0.6.0 based on feed-0.6.0-20250728-205524**

When building for Android, the app will use version 0.6.0 (versionCode: 6) with the latest enhancements.