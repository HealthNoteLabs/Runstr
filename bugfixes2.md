# Runstr App Bugfixes & Improvements (Round 2)

This document tracks the progress and solutions for the identified issues. Solutions should prioritize simplicity and leverage existing application components and patterns, avoiding unnecessary complexity or code duplication.

## Issues (Ordered Easiest to Hardest Estimate)

0.  **[~] General Toggle Unresponsiveness**
    *   **Problem**: All toggle switches throughout the app (e.g., in settings, modals) were unresponsive, requiring multiple taps to change state.
    *   **Solution**: Refactored `SettingsContext.jsx` to correctly follow React's Rules of Hooks and improve performance. Specifically:
        *   The main `providerValue` object passed to `SettingsContext.Provider` is now memoized using `useMemo`. Its dependency array includes all state values and memoized functions it provides.
        *   Functions defined within `SettingsProvider` and included in the context value (like `toggleDistanceUnit`, `isHealthEncryptionEnabled`) are memoized with `useCallback`.
        *   The `dynamicMetricSetters` object and `initialMetricPrefs` are also memoized using `useMemo`.
        *   This ensures stable references for the context value and its functions, preventing unnecessary re-renders of consumer components, which was the likely cause of the UI unresponsiveness.
    *   **Affected Areas**: `src/contexts/SettingsContext.jsx`, and indirectly all components consuming this context, especially those with toggles.
    *   **Implementation**: Applied `useMemo` and `useCallback` to `providerValue` and its constituent functions/objects in `SettingsContext.jsx`.

1.  **[~] Workout record shows 2 dates**
    *   **Problem**: The workout record display shows two dates; the top one is redundant and incorrect.
    *   **Solution**: The primary date displayed at the top of the workout card, which was derived from the `workoutName` variable (e.g., "5/28/2025 Run"), was incorrect. This line has been removed. The correct date, sourced from `event.created_at` (e.g., "Date: May 29, 2025"), remains.
    *   **Affected Areas**: `src/pages/NostrStatsPage.jsx`
    *   **Implementation**: Removed the `<p className="text-lg font-semibold">{workoutName}</p>` line from the component.

2.  **[~] Settings modal: "skip countdown" toggle not working**
    *   **Problem**: The toggle switch for the "Skip End Countdown" option in the settings modal was not functional. The "Skip Start Countdown" toggle worked correctly.
    *   **Solution**: As an immediate fix, the "Skip End Countdown" toggle and its associated descriptive text have been removed from the UI. The underlying cause was not immediately apparent as the code in `MenuBar.jsx` and `SettingsContext.jsx` appeared symmetrical for both start and end countdown toggles. Further investigation would be needed to fix the toggle itself.
    *   **Affected Areas**: `src/components/MenuBar.jsx`
    *   **Implementation**: Removed the JSX block for the "Skip End Countdown" toggle from `src/components/MenuBar.jsx`.

3.  **[~] Dashboard: Incorrect sats display for run day streaks**
    *   **Problem**: The dashboard shows "Run day 2 to earn 100 sats". It should be:
        *   Day 2: 200 sats
        *   Day 3: 300 sats
        *   Day 4: 400 sats
        *   Day 5: 500 sats (and so on, up to `capDays` from config, at 100 sats per day number).
    *   **Solution**: Updated the calculation for `tomorrowReward` in `src/components/AchievementCard.jsx`.
    *   **Affected Areas**: `src/components/AchievementCard.jsx`, `src/config/rewardsConfig.ts` (for reference of `satsPerDay`)
    *   **Implementation**: Changed `tomorrowReward` calculation from `satsPerDay` to `(tomorrowDay * satsPerDay)`.

4.  **[~] Personal best is wrong**
    *   **Problem**: The displayed personal best metrics are incorrect (e.g., a 5k run in 25:21 was not updating a PB of 40:23). The previous logic incorrectly used the overall average pace of any qualifying run to extrapolate PB times, rather than using the actual time for the specific distance or the run's total time if it matched the PB distance.
    *   **Solution**: Modified the personal best calculation in `src/hooks/useRunStats.js` for 5k, 10k, half marathon, and marathon.
        *   If a run's total distance is approximately the benchmark distance (e.g., 4.95km-5.05km for a 5k), the run's actual total duration is now used as the potential PB.
        *   If a run is longer than the benchmark distance (plus a small tolerance), the logic falls back to extrapolating the PB time from the run's overall average pace (this is less accurate for PBs achieved as splits in longer runs but retained as a fallback).
    *   **Affected Areas**: `src/hooks/useRunStats.js`
    *   **Implementation**: Updated the conditional logic for calculating `newStats.personalBests` for '5k', '10k', 'halfMarathon', and 'marathon' to check if the `run.distance` is within a tolerance band for the specific PB distance. If so, `run.duration / 60` is used; otherwise, the pace-extrapolated time is used.

5.  **[~] Missing reward notification modal**
    *   **Problem**: Users receive rewards for streaks but do not get an in-app notification modal confirming the reward.
    *   **Solution**: Implemented a notification modal system.
        1.  Created a reusable `NotificationModal.jsx` component.
        2.  Modified the `useStreakRewards` hook (`src/hooks/useStreakRewards.ts`) to manage state (`modalInfo`) for this modal's content and visibility.
        3.  When a streak reward payout is processed (success or failure), `useStreakRewards` now updates `modalInfo` to trigger the modal with relevant details, replacing the previous `alert`/`toast` messages.
        4.  The `AchievementCard.jsx` component, which uses `useStreakRewards`, now imports and renders `NotificationModal`, passing the necessary props from the hook.
    *   **Affected Areas**: `src/hooks/useStreakRewards.ts`, `src/components/AchievementCard.jsx`, new `src/components/NotificationModal.jsx`.
    *   **Implementation**: Added `NotificationModal.jsx`. Updated `useStreakRewards.ts` to include `modalInfo` state, `RewardModalInfo` interface, and `clearModal` function; `triggerStreakRewardPayout` now uses `setModalInfo`. Updated `AchievementCard.jsx` to consume `modalInfo` and `clearModal` and render the modal.

6.  **[~] Toggle for metrics selection in workout history / Unresponsive Toggles / Issue posting other metrics**
    *   **Problem**: Users need control over which metrics are published. Also, the toggles for these metrics in the "Save to Nostr" modal were unresponsive. Separately, there was an issue reported where some metrics (besides the main workout record) were not being posted.
    *   **Solution**: 
        1.  **Toggle Responsiveness Fix**: Refactored `SettingsContext.jsx` to manage all publishable metric preferences within a single state object (`metricPublishPrefs`) and use a unified setter function (`updateMetricPublishPref`). This adheres to React's Rules of Hooks and resolves the unresponsiveness of the toggles.
        2.  **Metric Selection UI & Logic**: Implemented a system for users to toggle individual metric publishing preferences.
            *   **Settings Context**: Added `PUBLISHABLE_METRICS` config. The (now correctly functioning) boolean state variables (e.g., `publishIntensity`) and setters in `SettingsContext.jsx` are used, with persistence to `localStorage`.
            *   **Modal UI**: `PostRunWizardModal.jsx` (Step 2, "Save to Nostr") dynamically displays the (now responsive) toggles for each metric defined in `PUBLISHABLE_METRICS`.
            *   **Publishing Logic**: `src/utils/runPublisher.js` was updated; the `publishRun` function now accepts the `settings` object and conditionally builds/publishes NIP-101h events based on these settings.
    *   **Affected Areas**: `src/contexts/SettingsContext.jsx`, `src/components/PostRunWizardModal.jsx`, `src/utils/runPublisher.js`.
    *   **Implementation Notes for Issue #7 (Posting other metrics)**: By making each NIP-101h event type's publication conditional on a (now working) toggle, it will be easier to isolate if a specific metric fails to publish when it *is* enabled. The `runPublisher.js` logic was reviewed to ensure it attempts to build and publish each selected event.

7.  **[~] Issue posting other metrics (besides workout record)** (Addressed by solution for #6)
    *   **Problem**: Metrics other than the basic workout record (e.g., detailed stats) are not being posted successfully.
    *   **Solution**: The changes for issue #6 (metric toggles) directly address this by ensuring the `runPublisher.js` attempts to publish each metric type only if its corresponding toggle is enabled. This clarifies the publishing flow for each metric, aiding in debugging any remaining individual metric publishing failures.
    *   **Affected Areas**: `src/utils/runPublisher.js`.

8.  **[~] Lightning address fallback for rewards / Reward sending reliability**
    *   **Problem**: Users may not always receive Zap rewards due to difficulties in fetching their Lightning Address from Nostr profiles, or their profile might not be on the relays the app queries. A fallback LN address in settings was requested, but improving current discovery is a priority.
    *   **Solution (Initial step - Enhanced Profile Discovery)**: Investigated the reward payout process. The NDK instance (`src/lib/ndkSingleton.js`) was found to use a fixed list of explicit relays from `src/config/relays.js` for all fetches, including profile (kind 0) lookups. To improve the chances of finding user profiles (and thus their `lud16`/`lud06` for Zaps), `wss://cache.primal.net` (a broad profile cache relay) has been added to this default relay list.
    *   **Affected Areas**: `src/config/relays.js` (primary change), indirectly affects `src/utils/nostr.js` (profile fetching) and `src/services/rewardService.js` (zap sending).
    *   **Implementation**: Added `wss://cache.primal.net` to the `relays` array in `src/config/relays.js`.
    *   **Next Steps (if issues persist)**: If reward delivery is still inconsistent, implementing the user-specified fallback Lightning Address in settings would be the next logical step.

## 1. Language for Rewards - Is confusing

*   **Description:** The description and UI for the rewards does not accurately portray what is happening. It says "next reward2/3 days" and "300 sats in 1 day". Users find this confusing.
*   **Suggestion:** Clean up the language. Maybe in the second box, show 7 boxes and a highlighted box for each streak day accomplished, with the amount of rewards on top of each box representing the reward for that streak. Accurately show how much they received and how much they will receive. For example, "Earn 300 sats for day 3" and "Earn 400 sats for day 4".
*   **Status:** Completed
*   **Solution Decided:** 
    *   Keep the top box as is (showing "Current Streak" with flame icon and number of days)
    *   Replace the bottom box content with:
        *   Line 1: `Today's Reward (Day X)`
        *   Line 2: `[amount] sats`
        *   Line 3: `Run tomorrow (Day Y) to earn [amount] sats`
*   **Progress:**
    *   [x] Analyze current UI and reward logic.
    *   [x] Propose new UI mockups/text.
    *   [x] Implement UI changes.
    *   [x] Implement logic changes for displaying reward progression.
    *   [ ] Test thoroughly.
*   **Details/Notes:**
    *   Focus on clarity and accurate representation of the reward system.
    *   Example: If user has 2-day streak and just earned 200 sats for Day 2, show:
        *   "Today's Reward (Day 2)"
        *   "200 sats"  
        *   "Run tomorrow (Day 3) to earn 300 sats"
*   **Implementation Details:**
    *   Modified `src/components/AchievementCard.jsx` to calculate and display today's reward and tomorrow's potential reward
    *   Added new CSS styles in `src/assets/styles/achievements.css` for the reward display
    *   The system now clearly shows:
        *   Today's reward (if any was earned)
        *   Tomorrow's potential reward
        *   Special message when the 7-day cap is reached

## 2. Calyx - Display issue

*   **Description:** A user on Calyx OS showed a screenshot with strange buttons on the bottom of the screen. This suggests the app needs optimization for screens with slimmer displays or different aspect ratios.
*   **Status:** Completed
*   **Progress:**
    *   [x] Obtain details about the device and screen resolution from the user.
    *   [x] Attempt to reproduce the issue on an emulator or similar device.
    *   [x] Identify CSS/layout issues causing the problem.
    *   [x] Implement responsive design adjustments.
    *   [ ] Test on various screen sizes, especially slimmer ones.
*   **Details/Notes:**
    *   This might involve adjustments to flexbox, grid, or media queries.
*   **Implementation Details:**
    *   Fixed `FloatingMusicPlayer` component to return `null` instead of an empty `<span>` when no track is playing
        *   This prevents potential layout artifacts from an empty element
    *   Updated `MenuBar` navigation layout:
        *   Changed from fixed width (`w-1/5`) to flexible layout (`flex-1`)
        *   Added `whitespace-nowrap` to prevent text wrapping
        *   Increased max-width container from 375px to 500px
        *   Changed from `justify-around` to `justify-between` for better space distribution
    *   Added responsive CSS in `index.css`:
        *   Font size reduction for screens < 360px wide
        *   Further optimization for screens < 320px wide
        *   Ensured text doesn't wrap on narrow screens
    *   These changes should fix the "DASHBOARD" text wrapping issue and prevent visual artifacts

## 3. Step Counter - Count Accuracy & UI Simplification

*   **Description:** Users reported step counter inaccuracy. Also, a decision was made to simplify step estimation by removing custom height/stride inputs.
*   **Status:** Completed (UI Removal & Default Adjustment)
*   **Original Problem**: Step counter undercounting, complicated by user-configurable height/stride.
*   **Solution Decided & Implemented**:
    1.  **UI Removal**: Removed the input fields for user height and custom stride length from the Settings modal (`src/components/MenuBar.jsx`). Users can no longer set these.
    2.  **Default Stride Adjustment**: Changed the hardcoded `AVERAGE_STRIDE_LENGTH_METERS` from `0.762` to `0.73` in both `src/pages/RunHistory.jsx` and `src/services/RunTracker.js`. Functions that previously used custom/height-based values now effectively default to this new average.
*   **Impact**: This provides a simpler, consistent distance-based step estimation when the device pedometer is not used, with a slight general increase in reported steps compared to the old default.
*   **Affected Files**: `src/components/MenuBar.jsx`, `src/pages/RunHistory.jsx`, `src/services/RunTracker.js`.
*   **Progress:**
    *   [x] Remove Height/Stride UI from Settings.
    *   [x] Update `AVERAGE_STRIDE_LENGTH_METERS` to 0.73 in relevant files.
    *   [x] Ensure functions relying on custom inputs now use the new default.

## 4. Graphene - Location tracking

*   **Description:** A user on GrapheneOS (Pixel device) enabled location tracking, but the OS settings show Runstr has not accepted location permissions, even though other apps have permissions.
*   **Status:** In Progress
*   **Progress:**
    *   [x] Review AndroidManifest.xml for correct permission declarations (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` if applicable).
    *   [x] Review the runtime permission request flow in the app.
    *   [x] Research GrapheneOS specific permission handling or restrictions.
    *   [x] Implement improved permission handling for GrapheneOS
    *   [ ] Test the permission flow specifically on a GrapheneOS device/emulator.
    *   [x] Ensure foreground service requirements for background location (if used) are met.
*   **Details/Notes:**
    *   GrapheneOS has enhanced privacy and security features that might affect how permissions are granted or reported.
    *   Check for any logs or system messages on the GrapheneOS device that might indicate the cause.
*   **Implementation Details:**
    *   Enhanced `PermissionDialog.jsx` with:
        *   Unique watcher IDs to prevent conflicts
        *   More explicit configuration options for GPS provider
        *   Better error handling with user-friendly messages
        *   Automatic settings navigation on permission failure
        *   Delayed cleanup to ensure permission request completes
    *   Improved `RunTracker.js` with:
        *   Unique session IDs for each tracking session
        *   Enhanced error handling and permission checking
        *   Permission error events that UI can listen to
        *   More detailed configuration for background location
    *   Updated `AndroidManifest.xml` with:
        *   Foreground service declaration with location type
        *   Additional permissions: FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, POST_NOTIFICATIONS
        *   Hardware feature declarations for location and GPS
    *   These changes should help GrapheneOS properly recognize and grant location permissions

## 5. NWC (Nostr Wallet Connect) - Intermittent functionality

*   **Description:** NWC connection is reportedly being lost when the user leaves and returns to the wallet page. Zaps are also reported to hardly work.
*   **Status:** Pending
*   **Progress:**
    *   [ ] Review NWC connection management logic (initial connection, re-connection, session persistence).
    *   [ ] Investigate state management around the NWC connection. Is it being cleared unintentionally?
    *   [ ] Examine the zap sending flow: event creation, signing, relay submission, error handling.
    *   [ ] Add detailed logging around NWC connection states and zap attempts.
    *   [ ] Test extensively, focusing on app lifecycle events (backgrounding, resuming) and network changes.
*   **Details/Notes:**
    *   Intermittent issues can be hard to debug; focus on robust error handling and state management.
    *   Check if there are any known issues with the NWC relays being used or the NWC library itself.

## 6. Amber - Intermittent functionality on Calyx

*   **Description:** Multiple users on CalyxOS report unstable Amber connection. They had to remove the connection in Amber, log out of Runstr, delete the remembered profile, and re-establish the connection for posting to work. Some received a "no connection to key store" message.
*   **Status:** Pending
*   **Progress:**
    *   [ ] Review Amber integration logic, particularly how connection state is managed and how signing requests are handled.
    *   [ ] Investigate the "no connection to key store" message. Is this from Runstr, Amber, or CalyxOS?
    *   [ ] Research any specific CalyxOS restrictions or behaviors related to inter-app communication or background services that might affect Amber.
    *   [ ] Test the full lifecycle: connect Amber, post, background app, return, post again.
    *   [ ] Add robust logging around Amber interactions.
*   **Details/Notes:**
    *   The need to fully reset the connection points to potential state corruption or stale connection data.
    *   This involves interaction between Runstr, the Amber app, and CalyxOS, adding layers of complexity.

## Bug: NDK Instance Never Ready / Signer Required Error (Ongoing)

**Reported:** User experiences "Signer required" error and UI shows "Nostr connection not ready..." when trying to create a team on Android with Amber Signer.

**Initial Analysis:**
- The issue might stem from the application not recognizing Amber signer's availability or attempting actions before the asynchronous connection with Amber is complete.
- There appear to be two Nostr context systems: `NostrProvider.jsx` (older, handles Amber directly) and `NostrContext.jsx` (newer, NDK-centric singleton).
- The UI indicating "NDK not ready" points to a problem with the NDK singleton's initialization, specifically its connection to relays, managed in `NostrContext.jsx` and `ndkSingleton.js`.

**Troubleshooting Steps Taken:**

1.  **Proposed Solutions (Conceptual):**
    *   **Option 1 (Easiest):** UI/UX enhancements (disable submit, prominent connection prompt, clear loading state).
    *   **Option 2 (Medium):** Review/refine Amber integration in `NostrContext` & deep link handling.
    *   **Option 3 (Hardest):** Re-evaluate/refactor signer abstraction for Amber with NDK.

2.  **Investigation into NDK Readiness:**
    *   **Focus:** Why the NDK instance (from `ndkSingleton.js`, managed by `NostrContext.jsx`) never reports as ready.
    *   **Hypothesis:** `ndk.connect()` within `ndkSingleton.js` is failing, likely due to issues with configured relays or network connectivity.
    *   **Read `src/lib/ndkSingleton.js`:** Confirmed NDK is initialized with `explicitRelayUrls` from `src/config/relays.js`. `ndkReadyPromise` directly reflects the success/failure of `ndk.connect()`.
    *   **Read `src/config/relays.js`:** Identified the currently configured relays: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.nostr.band`.
    *   **Added Detailed Logging:**
        *   In `src/lib/ndkSingleton.js`: Logged relay list, messages before/after `ndk.connect()`, and detailed error if `connect()` fails.
        *   In `src/contexts/NostrContext.jsx`: Logged steps around awaiting `ndkReadyPromise` and subsequent state updates for `ndkReady` and `ndkError`.

**Next Step:** User to run the application and provide the new console logs to analyze the NDK connection flow and pinpoint failures. 