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