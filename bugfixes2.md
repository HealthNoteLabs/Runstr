# Bug Fixes (Batch 2)

This document tracks the progress of fixing a series of identified bugs. We will address them in order of estimated complexity, from easiest to hardest.

## 1. Language for Rewards - Is confusing

*   **Description:** The description and UI for the rewards does not accurately portray what is happening. It says "next reward2/3 days" and "300 sats in 1 day". Users find this confusing.
*   **Suggestion:** Clean up the language. Maybe in the second box, show 7 boxes and a highlighted box for each streak day accomplished, with the amount of rewards on top of each box representing the reward for that streak. Accurately show how much they received and how much they will receive. For example, "Earn 300 sats for day 3" and "Earn 400 sats for day 4".
*   **Status:** Completed
*   **Solution Decided:** 
    *   Keep only the top box showing "Current Streak" with flame icon and number of days
    *   Remove the reward information box entirely
    *   Show a notification popup when the streak increments displaying the reward amount (100 sats for day 1, 200 for day 2, etc.)
    *   The notification appears regardless of whether sats are actually sent
*   **Progress:**
    *   [x] Analyze current UI and reward logic.
    *   [x] Propose new UI mockups/text.
    *   [x] Implement UI changes.
    *   [x] Implement logic changes for displaying reward progression.
    *   [x] Test thoroughly.
*   **Details/Notes:**
    *   Focus on clarity and accurate representation of the reward system.
    *   Notification shows: "🎉 Streak reward: [amount] sats for day [X]!"
*   **Implementation Details:**
    *   Modified `src/components/AchievementCard.jsx` to remove the reward display box, keeping only the streak counter
    *   Updated `src/utils/streakUtils.ts` to always show notification when streak increments:
        *   Shows notification immediately when reward is earned
        *   Updates lastRewardedDay even without payment destination to prevent duplicate notifications
        *   Still attempts actual payment if destination exists
    *   Cleaned up unused CSS styles in `src/assets/styles/achievements.css`
    *   The system now:
        *   Shows only the current streak count
        *   Displays a popup notification when the streak changes
        *   Shows the correct reward amount based on the day (100 sats × day number)

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

## 3. Step Counter - Count Accuracy

*   **Description:** Multiple users report that the step counter is significantly inaccurate, undercounting by as much as 40%. For example, a user walked 7211 steps, but the app showed 4495.
*   **Status:** In Progress
*   **Progress:**
    *   [x] Research step counting mechanisms on Android (SensorManager, step detector vs. step counter sensors).
    *   [x] Review current step counting implementation in Runstr.
    *   [x] Investigate potential issues: sensor batching, power-saving modes affecting sensor readings, algorithm sensitivity.
    *   [x] Identify root cause: App uses fixed stride length (0.762m) for all users
    *   [x] Implement height-based stride length calculation
    *   [x] Add user settings for height and custom stride length
    *   [ ] Test with different devices and walking patterns.
    *   [ ] Consider implementing actual step sensor integration (future enhancement)
*   **Details/Notes:**
    *   Root cause identified: The app doesn't use actual step sensors, it estimates steps by dividing GPS distance by a fixed stride length (0.762m)
    *   This is problematic because stride length varies by height, speed, and individual differences
    *   For shorter users or those with shorter strides, this significantly undercounts steps
*   **Implementation Details:**
    *   Modified `RunTracker.js` to support customizable stride length
    *   Added height-based stride length estimation using formula: Height (inches) × 0.414
    *   Added settings UI in `MenuBar.jsx` for users to input:
        *   Their height (cm) for automatic stride length calculation
        *   OR a custom stride length (meters) for precise step counting
    *   Updated `RunHistory.jsx` to use the same customizable stride length
    *   Users can now get more accurate step counts based on their personal measurements
*   **Future Enhancements:**
    *   Consider integrating Android's TYPE_STEP_COUNTER sensor for actual step detection
    *   Add automatic stride length calibration based on user's walking data
    *   Support different stride lengths for walking vs running

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
    *   [x] Fix duplicate permission modals and mobile-specific issues
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
        *   **Fixed mobile-specific display issues:**
            *   Button text now shows "Connect with Amber" on Android when Amber is available
            *   Removed browser extension option from mobile devices
            *   Properly handles Android devices without Amber installed
    *   Improved `RunTracker.js` with:
        *   Unique session IDs for each tracking session
        *   Enhanced error handling and permission checking
        *   Permission error events that UI can listen to
        *   More detailed configuration for background location
    *   Updated `AndroidManifest.xml` with:
        *   Foreground service declaration with location type
        *   Additional permissions: FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, POST_NOTIFICATIONS
        *   Hardware feature declarations for location and GPS
    *   **Fixed duplicate permission modal issue:**
        *   Disabled auto-authentication in NostrProvider when connection is invalid
        *   PermissionDialog now handles all permission flows in one place
        *   Prevents multiple permission requests from firing simultaneously
    *   These changes should help GrapheneOS properly recognize and grant location permissions

## 5. NWC (Nostr Wallet Connect) - Intermittent functionality

*   **Description:** NWC connection is reportedly being lost when the user leaves and returns to the wallet page. Zaps are also reported to hardly work.
*   **Status:** Completed
*   **Progress:**
    *   [x] Review NWC connection management logic (initial connection, re-connection, session persistence).
    *   [x] Investigate state management around the NWC connection. Is it being cleared unintentionally?
    *   [x] Examine the zap sending flow: event creation, signing, relay submission, error handling.
    *   [x] Add detailed logging around NWC connection states and zap attempts.
    *   [x] Test extensively, focusing on app lifecycle events (backgrounding, resuming) and network changes.
*   **Details/Notes:**
    *   Intermittent issues can be hard to debug; focus on robust error handling and state management.
    *   Check if there are any known issues with the NWC relays being used or the NWC library itself.
*   **Implementation Details:**
    *   **AlbyWallet Service Improvements:**
        *   Reduced connection check interval from 2 minutes to 30 seconds for better responsiveness
        *   Improved connection check throttling from 30s to 5s for faster detection
        *   Enhanced error detection to identify WebSocket, network, and timeout errors
        *   Added continuous monitoring that doesn't stop after max reconnection attempts
        *   Improved reconnection logic with multiple attempts and better error recovery
    *   **WalletPersistenceService Enhancements:**
        *   Added proper reconnection attempts using both auth URL and connection string
        *   Improved connection monitoring interval to 30 seconds
        *   Added network online/offline event listeners for better connection management
        *   Enhanced window focus and visibility change handlers with delays for network stabilization
        *   Improved ensureConnected method to handle various connection scenarios
        *   Added connection verification before all wallet operations
    *   **NWC UI Integration:**
        *   Added NWC wallet connection directly in the Settings modal
        *   Users can now connect/disconnect wallet without navigating to separate page
        *   Real-time connection status display
        *   Clear error messages for connection failures
    *   **Zap Flow Improvements:**
        *   Added retry logic (3 attempts) for wallet reconnection
        *   Added retry logic (3 attempts) for payment processing
        *   Enhanced error detection for connection-related issues
        *   Automatic wallet reconnection on connection errors during zaps
        *   Better logging throughout the zap process
        *   Graceful fallback from direct zap to manual LNURL flow
    *   **Connection Stability:**
        *   Wallet now attempts to reconnect automatically when connection is lost
        *   Connection state is properly synchronized across all components
        *   Network connectivity changes are properly handled
        *   App lifecycle events (background/foreground) trigger connection checks

## 6. Amber - Intermittent functionality on Calyx

*   **Description:** Multiple users on CalyxOS report unstable Amber connection. They had to remove the connection in Amber, log out of Runstr, delete the remembered profile, and re-establish the connection for posting to work. Some received a "no connection to key store" message.
*   **Status:** Completed
*   **Progress:**
    *   [x] Review Amber integration logic, particularly how connection state is managed and how signing requests are handled.
    *   [x] Investigate the "no connection to key store" message. Is this from Runstr, Amber, or CalyxOS?
    *   [x] Research any specific CalyxOS restrictions or behaviors related to inter-app communication or background services that might affect Amber.
    *   [x] Test the full lifecycle: connect Amber, post, background app, return, post again.
    *   [x] Add robust logging around Amber interactions.
*   **Details/Notes:**
    *   The need to fully reset the connection points to potential state corruption or stale connection data.
    *   This involves interaction between Runstr, the Amber app, and CalyxOS, adding layers of complexity.
*   **Implementation Details:**
    *   Added connection state management to track Amber connection validity
    *   Implemented automatic connection restoration on app launch
    *   Added connection validity checks with 5-minute timeout for idle connections
    *   Implemented request tracking with unique IDs to match callbacks correctly
    *   Added timeout handling for authentication (60s) and signing (30s)
    *   Implemented retry logic for signing operations (2 attempts)
    *   Added error-specific handling for permissions and connection issues
    *   Improved deep link handling to process errors and connection states
    *   Added connection status display in the permission dialog
    *   Implemented periodic connection validity checks (every 30 seconds)
    *   Added disconnect functionality to properly reset connection state
    *   Better error messages for users when connection issues occur 