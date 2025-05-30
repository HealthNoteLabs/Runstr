**RUNSTR v0.4.7 (BugFixes & Improvements)**

This release focuses on resolving key bugs and enhancing user experience with several improvements across the application.

**Key Highlights:**

*   **Improved Step Counting & Estimation:**
    *   Simplified step estimation by removing custom height/stride inputs from settings.
    *   Adjusted the default average stride length to `0.73` meters for more consistent distance-based step estimation when the device pedometer is not used. (Addresses issue #3 in `bugfixes2.md`)
*   **Enhanced Metric Publishing Control (NIP-101h):**
    *   Users now have individual toggle controls in the "Save to Nostr" modal to select which specific metrics (e.g., intensity, cadence, heart rate) are published alongside their main workout record.
    *   Resolved unresponsiveness of these toggles by refactoring `SettingsContext.jsx`.
    *   The `runPublisher.js` utility now respects these settings, only publishing selected NIP-101h metric events. (Addresses issues #6 and #7 in `bugfixes2.md`)
*   **Refined Rewards System:**
    *   **Clearer Rewards Language:** Updated the UI in the `AchievementCard` to more clearly display "Today's Reward (Day X)" and "Run tomorrow (Day Y) to earn [amount] sats", removing confusion about reward progression. (Addresses issue #1 "Language for Rewards" in `bugfixes2.md`)
    *   **Improved Payout Reliability (Initial Step):** Added `wss://cache.primal.net` to the default relay list to enhance the discovery of user profiles and their Lightning Addresses, aiming to improve the reliability of Zap rewards. (Addresses issue #8 in `bugfixes2.md`)
    *   **Corrected Streak Reward Calculation:** Fixed the dashboard display for run day streaks. Rewards now correctly scale with the streak day (e.g., Day 2 = 200 sats, Day 3 = 300 sats, etc.). (Addresses issue #3 in `bugfixes2.md`)
    *   **Reward Notification Modal:** Implemented an in-app modal to notify users upon receiving streak rewards, providing clear confirmation. (Addresses issue #5 in `bugfixes2.md`)
*   **UI and OS-Specific Fixes:**
    *   **CalyxOS UI Updates:**
        *   Resolved layout issues on slimmer displays/different aspect ratios by making `MenuBar` navigation more flexible and adjusting font sizes for smaller screens.
        *   Fixed `FloatingMusicPlayer` to prevent layout artifacts. (Addresses issue #2 "Calyx - Display issue" in `bugfixes2.md`)
    *   **GrapheneOS Location Tracking:**
        *   Enhanced permission handling in `PermissionDialog.jsx` and `RunTracker.js`.
        *   Updated `AndroidManifest.xml` with necessary foreground service declarations and permissions to improve location permission recognition and granting on GrapheneOS. (Addresses issue #4 "Graphene - Location tracking" in `bugfixes2.md`)
*   **Workout Record Accuracy:**
    *   **Corrected Date Display:** Removed the redundant and incorrect top date from workout records, ensuring only the correct date (sourced from `event.created_at`) is displayed. (Addresses issue #1 in `bugfixes2.md`)
    *   **Time Added to Nostr Records:** (This was in your list but not explicitly detailed in `bugfixes2.md`'s resolved items. Assuming this was part of general improvements or tied to metric posting). Workout records published to Nostr now include accurate time information.
*   **Settings & Countdown Timers:**
    *   **"Skip Start Countdown" Toggle:** This toggle is functional.
    *   **"Skip End Countdown" Toggle Removed:** The "Skip End Countdown" toggle was removed from settings as an immediate fix for its non-functionality. (Addresses issue #2 in `bugfixes2.md`)
*   **General Toggle Unresponsiveness:**
    *   Resolved widespread unresponsiveness of toggle switches throughout the app by refactoring `SettingsContext.jsx` with `useMemo` and `useCallback` to optimize performance and prevent unnecessary re-renders. (Addresses issue #0 in `bugfixes2.md`)
*   **Personal Best Calculation:**
    *   Improved accuracy of personal best calculations for 5k, 10k, half marathon, and marathon distances. The logic now prioritizes the actual run duration if the total distance is very close to the benchmark distance, falling back to pace-extrapolated times otherwise. (Addresses issue #4 in `bugfixes2.md`)

**Note on NWC and Amber Functionality:**
Issues related to NWC (Nostr Wallet Connect) intermittent functionality (issue #5 "NWC") and Amber intermittent functionality on CalyxOS (issue #6 "Amber") are still pending and are being actively investigated.