\
────────────────────────────────────────
FEATURE BRAINSTORM: NOSTR STATS & PRIVACY ENHANCEMENTS
────────────────────────────────────────

**I. HIGH-LEVEL CONCEPTS**

1.  **Two Main User-Facing Stats Areas:**
    *   **Stats Page (Existing):** Remains the primary hub for visual data exploration with graphs and trends (e.g., distance, calories, weight over time). Data source can be toggled (see below).
    *   **Nostr Stats Page (New):** Accessible via a button/link from the main "Stats Page". This page will display a simple, chronological list of raw Nostr events (NIP-101e workouts, NIP-101h health metrics) published by the user. It serves as a log and a control panel for re-publishing or exporting.

2.  **Data Sources & Scope:**
    *   **Local Storage:** Data recorded and stored directly on the user's device (including GPX files for runs).
    *   **Nostr Aggregated:** Data queried from Nostr relays. This includes both publicly readable events and events with NIP-44 encrypted content (if the user's keys are available for decryption).
    *   **Event Kinds in Scope:**
        *   NIP-101e: `kind: 1301` (Workout Records)
        *   NIP-101h: `kind: 1351-1357` (Weight, Height, Age, Gender, Fitness Level, Workout Intensity, Calories Expended). Designed to be extensible for future NIP-101h kinds (e.g., `1358-1399`, `2357` for Calories Consumed).

3.  **Publication & Privacy Modes:**
    *   **Public Save:** Event content is plaintext and publicly readable on relays.
    *   **Private Save (NIP-44):** Event `content` is encrypted using NIP-44 before publishing. Tags remain public. Only the user (or anyone they share the decryption key with, though for self-notes it's primarily for their own retrieval) can decrypt and read the content. Encryption uses the user's private key and their own public key to derive a shared secret for symmetric encryption, as per NIP-44. ([Reference: NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md))
    *   **Blossom Server Export:** User-selected NIP-101h/e data can be exported as CSV or JSON and sent to a user-configured Blossom server. Endpoints for Blossom servers are at the root of their domain (e.g., `https://your-blossom.server/upload`).

4.  **User Control over Privacy (Granular & Persistent):**
    *   Users will set a persistent "Public" or "Private (NIP-44)" preference for each *type* of metric (e.g., Weight: Public/Private; Workout Calories: Public/Private).
    *   These preferences will be configured in relevant UI sections (e.g., Profile page for health metrics, Save Run Extras modal for workout-derived metrics).
    *   Once set, these preferences are used automatically for new publications, without further prompting.

5.  **Re-Publishing & Data Management from Nostr Stats Page:**
    *   Each listed event will have options to "Re-publish" (allowing a switch between Public/Private for that specific past event) or "Delete Local Cached Copy".
    *   Bulk selection for re-publishing or local deletion.

6.  **Data Cleanup:**
    *   "Erase Local Data": Option on the Stats page (or settings) to delete all locally stored health metrics, workout history (including on-device GPX files), and cached Nostr data. This action will *not* delete data from Nostr relays.

**II. USER FLOWS & WIREFRAME CONCEPTS**

1.  **Stats Page (Existing - Enhanced):**
    *   **Header Controls:**
        *   Dropdown: Data Source: `[Aggregated Nostr Data ▾]` (options: "Aggregated Nostr Data", "Local Device Data"). Default to "Aggregated Nostr Data".
        *   Dropdown: Time Range: `[All-Time ▾]` (options: "All-Time", "Last Year", "Last Quarter", "Last Month", "Last Week").
    *   **Content:** Graphs and trend visualizations (using current charting library) for key metrics, reflecting the selected data source and time range.
    *   **Navigation Link:** Button/Link: `[View Raw Nostr Event Log] ▶` (navigates to the new "Nostr Stats Page").

2.  **Nostr Stats Page (New):**
    *   **Header Controls:**
        *   Button: `[Refresh from Relays]`
        *   Button/Dropdown: `[Select Actions ▾]` (for bulk operations like "Re-publish Selected as Public", "Re-publish Selected as Private", "Delete Local Cache for Selected").
    *   **Event List (Simple, Chronological):**
        *   Each row displays: `Kind Icon | Kind Number | Date | Brief Summary (e.g., "Run 5km", "Weight: 70kg", "Calories: 350kcal")`.
        *   Tap a row: Opens a modal showing the full JSON of the event.
        *   Row-level kebab menu (`...`):
            *   `Re-publish as Public`
            *   `Re-publish as Private (NIP-44)`
            *   `Delete Local Cached Copy` (if applicable)
    *   **Footer Controls:**
        *   Section: "Export to Blossom Server"
            *   Selector for data types/kinds to include.
            *   Buttons: `[Export as CSV]`, `[Export as JSON]` (triggers download/upload flow).

3.  **Setting Privacy Preferences:**
    *   **Profile Page (`Profile.jsx`):** For each NIP-101h health metric input (Weight, Height, etc.), include a small toggle/segmented control: `(o) Public | (•) Private (Encrypted)`.
    *   **Save Run Extras Modal (`SaveRunExtrasModal.jsx`):** Similar toggles for Workout Intensity and Calories Expended.
    *   These preferences are saved in user settings and applied by default to new events.

**III. TECHNICAL ARCHITECTURE & IMPLEMENTATION NOTES**

1.  **`StatsContext` (or similar state management):**
    *   Manages `currentDataSource` ("local" | "nostr"), `selectedTimeRange`.
    *   Holds processed data: `displayedStats`, `healthMetricsLog`, `workoutsLog`.
    *   Exposes functions: `refreshData()`, `setDataSource()`, `setTimeRange()`.

2.  **`NostrStatsService`:**
    *   `fetchUserEvents(pubkey, kinds[], since?, until?)`: Queries configured relays for events matching user's pubkey and specified kinds.
    *   Handles NIP-44 decryption for events that appear to be encrypted. Uses `window.nostr.nip44.decrypt()`.
    *   Caches fetched events to IndexedDB to speed up subsequent loads and provide offline access to previously synced data.

3.  **Publishing & Encryption Logic (`nostrHealth.js`, `nostr.js`):**
    *   Event creation functions will check the user's privacy preference for that metric type.
    *   If "Private (NIP-44)", the `content` field is encrypted using `window.nostr.nip44.encrypt(userPubkey, contentToEncrypt)` before the event is finalized and signed. The recipient pubkey for NIP-44 encryption is the user's own pubkey.
    *   `createAndPublishEvent` remains the core function for sending events to relays.

4.  **Re-publishing Logic:**
    *   Retrieves the original event.
    *   If re-publishing as "Private": Encrypts the original `content` using NIP-44.
    *   If re-publishing as "Public": Ensures `content` is plaintext.
    *   Creates a *new* event. Optionally, tag the new event as replacing the old one `["e", <old_event_id>, <relay_url>, "replace"]`.

5.  **Blossom Export Utility:**
    *   `metricsToCsv(metricsArray)` and `metricsToJson(metricsArray)` functions.
    *   `uploadToBlossom(dataBlob, format)`: Uses `fetch` to POST to the user's configured Blossom server URL (root domain based).

6.  **Local Data Erasure:**
    *   Function to clear relevant IndexedDB tables.
    *   Function to iterate and delete on-device GPX files.
    *   Requires prominent user confirmation.

7.  **UI Components:**
    *   `MetricPrivacyToggle`.
    *   `NostrEventListItem`.
    *   `EventJsonModal`.
    *   `BlossomExportForm`.

8.  **Charting:** Continue using the current charting library.

**IV. KEY DECISIONS & CONSIDERATIONS**

*   **NIP-44 Tagging:** Consider a non-standard tag like `["content-encryption", "nip44"]` to quickly identify encrypted events.
*   **Key Management for NIP-44:** Relies on secure private key management by the environment (e.g., browser extension).
*   **Blossom Server Authentication:** Details TBD if Blossom spec requires auth.
*   **Error Handling:** Robust error handling for network, encryption/decryption, and publishing.
*   **Performance:** Consider pagination/virtualization for long Nostr event lists.

**V. BACKLOG / EPIC BREAKDOWN (Illustrative)**

*   **Epic 1: Core Nostr Stats Read & Display**
    *   Task: Implement `NostrStatsService` (fetch, NIP-44 decrypt, cache).
    *   Task: Create `Nostr Stats Page` UI.
    *   Task: Implement "Refresh from Relays".
*   **Epic 2: Granular Privacy Controls & NIP-44 Publishing**
    *   Task: Add `MetricPrivacyToggle` UI.
    *   Task: Integrate toggles into Profile & Modals, save preferences.
    *   Task: Update event creation for NIP-44 encryption based on preferences.
*   **Epic 3: Re-publishing and Local Data Management**
    *   Task: Implement re-publish (Public/Private).
    *   Task: Add "Delete Local Cached Copy".
    *   Task: Implement "Erase All Local Data" (including GPX).
*   **Epic 4: Blossom Server Export**
    *   Task: Create CSV/JSON export utilities.
    *   Task: UI for Blossom export initiation.
    *   Task: Implement `uploadToBlossom`.
*   **Epic 5: Stats Page Enhancements**
    *   Task: Integrate Data Source & Time Range filters into Stats Page.
    *   Task: Ensure graphs reflect selected source/range.

**VI. OPEN QUESTIONS & CONFIRMATIONS**
*   Blossom export endpoint: Root domain. *Auth mechanism for Blossom TBD.*
*   Erase local data & GPX: Confirmed GPX files included.
*   NIP-44 Encryption: Confirmed for "Private Save" using user's own keys.
*   Consent for encryption: Handled by persistent, granular privacy preferences.
*   Charting library: Keep current.

## Simplified Implementation Plan (V3) - NIP-101e Exclusive

*This updated plan reflects the decision to focus exclusively on Nostr for all stats aggregation, removing the dual-source complexity. This is the simplest, most direct path to a Nostr-native experience.*

### Core Principles
- **Nostr is the Source of Truth:** All aggregated stats, charts, and historical data displayed on the "Stats" page are derived *only* from `kind: 1301` events on Nostr.
- **Local Storage is a Staging Area:** The "Run History" page shows runs stored on the device. It's a place to view local-only runs and manage their publication status (e.g., "Published", "Unpublished", "Failed"). It is NOT used for stat aggregation.
- **NIP-101e is Exclusive:** All NIP-101h event creation related to workout publishing will be removed.

### Phase 1: Streamline Data Publishing

*(Goal: Ensure every workout publishes a clean, single `kind: 1301` event with all necessary data, and prevent duplicates.)*

**Step 1.1: Enhance `kind: 1301` Tags for Rich UI**
*   **Action:** Add denormalized team/challenge names to `kind: 1301` tags during creation.
*   **File to Modify:** `src/utils/nostr.js` (in `createWorkoutEvent`).
*   **Logic:** When creating a `kind: 1301` event, add the human-readable name as the 4th element in the `team` or `challenge` tag.
    *   Example: `["team", "<a-tag>", "<relay-hint>", "RUNSTR Team"]`

**Step 1.2: Prevent Duplicate Publishing**
*   **Action:** Use a `nostrEventId` flag in the local run object to prevent re-publishing.
*   **Files to Modify:** `src/pages/RunHistory.jsx`, `src/components/RunHistoryCard.tsx`.
*   **Logic:** Before publishing, check if `run.nostrEventId` exists. If so, disable the publish button. If not, publish and then save the new event ID to the local run object.

**Step 1.3: Remove All NIP-101h Publishing from Workouts**
*   **Action:** Drastically simplify the publishing flow to *only* handle `kind: 1301`.
*   **File to Modify:** `src/utils/runPublisher.js`.
*   **Logic:** Remove all code related to `buildIntensityEvent`, `buildCalorieEvent`, `buildDistanceEvent`, etc. The entire function should be reduced to creating and publishing a single `kind: 1301` event.

### Phase 2: Implement Nostr-Native Stats

*(Goal: Replace the stats page with a new version that sources its data exclusively from Nostr.)*

**Step 2.1: Create `useNostrRunStats` Hook**
*   **Action:** Build a reusable hook to handle fetching and aggregating stats from `kind: 1301` events.
*   **File to Create:** `src/hooks/useNostrRunStats.js`.
*   **Logic:**
    -   Fetch all `kind: 1301` events for the current user.
    -   Parse tags from each event (`distance`, `duration`, `created_at`, etc.).
    -   Perform aggregation (totals, averages, personal bests).
    -   Return loading state, error state, and the final aggregated stats object.

**Step 2.2: Build the New Stats Page**
*   **Action:** Replace the content of the main stats page to display the data from the new hook.
*   **File to Modify:** `src/pages/StatsPage.jsx` (or equivalent).
*   **Logic:**
    -   Remove all logic related to fetching local runs.
    -   Integrate the `useNostrRunStats` hook.
    -   Connect the data from the hook to your charts and display components. This page will now reflect the user's global, published activity.

### Phase 3: Final UI Polish

*(Goal: Update the UI to reflect the new data structure and publishing flow.)*

**Step 3.1: Enhance Workout Card UI**
*   **Action:** Display team and challenge info on the `RunHistory` cards.
*   **File to Modify:** `src/components/RunHistoryCard.tsx`.
*   **Logic:**
    -   When rendering a card, check its Nostr event tags.
    -   If a `team` or `challenge` tag exists, display the name from the 4th element of the tag. E.g., `<strong>Team:</strong> RUNSTR Team`.

**Step 3.2: Implement Auto-Post Setting**
*   **Action:** Add a setting to make publishing seamless.
*   **Files to Modify:** `src/contexts/SettingsContext.jsx`, `src/pages/SettingsPage.jsx`, `src/components/RunTracker.jsx`.
*   **Logic:**
    -   Add `autoPostToNostr: false` to settings.
    -   Add a UI toggle for the user.
    -   In `RunTracker.jsx`, when a run stops, check this setting and trigger the publish flow if enabled.

**Step 3.3: Deprecate `NostrStatsPage.jsx`**
*   **Action:** The page is now redundant.
*   **File to Delete:** `src/pages/NostrStatsPage.jsx`.
*   **Cleanup:** Remove any routes/links pointing to the old page.

Let's proceed with this plan, starting with Phase 1. Shall we begin with Step 1.1? 