# Strategic Plan: Terminal-Based Automated Testing for Android Nostr Client

## 1. Introduction

This document outlines the strategy for developing a suite of automated test scripts, executable from a standard terminal environment, for the Android Nostr client application. The primary focus is on rigorously verifying two core features: NIP-29 Group Moderation and the Step Counter functionality.

The core challenge lies in testing a GUI-centric mobile application without direct UI interaction, relying instead on terminal-based tools like the Android Debug Bridge (ADB) and direct communication with Nostr relays. This plan details the methodology, specific test scenarios, critical assumptions, recommended tooling, and a proposed structure for the test scripts.

## 2. Testing Methodology

Given the constraints, a hybrid **Gray-Box** and **Black-Box** testing approach is proposed:

*   **Black-Box (Nostr Interaction):** Test scripts will interact directly with Nostr relays as independent clients. They will publish NIP-29 events (simulating actions like creating groups, inviting users, setting roles) and subscribe to relays to verify that the application under test (AUT) generates the correct corresponding events (kinds, tags, content) in response to simulated actions or internal state changes.
*   **Gray-Box (ADB Interaction):** Test scripts will leverage ADB to control the application lifecycle and environment on the Android device, and to potentially query application state or trigger specific behaviors. Key uses of ADB include:
    *   **App Lifecycle:** Installing specific `.apk` builds, launching the application, forcefully stopping it, clearing application data/cache.
    *   **State Querying (Assumption-Heavy):** Attempting to read application state by examining log output (`adb logcat`), querying system properties (`adb shell dumpsys`), accessing specific files within the app's data directory (`adb shell run-as <package_name> cat ...`), or possibly triggering broadcast intents (`adb shell am broadcast`) if the app exposes specific testing hooks.
    *   **Event Simulation (Assumption-Heavy):** Triggering internal app actions where possible via ADB, such as simulating step increments (e.g., via broadcast intent, mock location data if applicable, or debug commands).
*   **Limitations:**
    *   **No UI Verification:** This approach cannot verify visual elements, layout, UI responsiveness, or user flows that depend heavily on graphical interaction. Testing is limited to underlying logic and data persistence/consistency.
    *   **Dependency on Testability:** The effectiveness of state querying and event simulation via ADB is entirely dependent on how the application is built. Lack of adequate logging or specific ADB-accessible hooks will significantly limit test coverage for internal state verification.
    *   **Indirect Verification:** Assertions will often rely on observing side effects (Nostr events, log entries, changes in queryable state) rather than direct state inspection.
*   **Handling UI-Dependent Actions:** Test scenarios will focus on the *data* and *protocol* level aspects of features. For example, instead of testing *clicking* the 'Create Group' button, the test will simulate the *Nostr event* that the button click is supposed to generate and verify its correctness on the relay. Internal app state related to the UI (e.g., "is the group screen displayed?") is out of scope unless it can be reliably inferred via ADB logs/queries.

### Testing Architecture Diagram

```mermaid
graph TD
    TR[Test Runner (Host PC: Python/JS)] -->|Nostr Lib: Publish/Subscribe| NR[Nostr Relay]
    TR -->|ADB Lib: Commands| ADB[ADB Daemon (Host PC)]
    ADB -->|ADB Protocol (USB/Network)| AD[Android Device/Emulator]

    subgraph Android Device/Emulator
        Adbd[ADB Daemon (Device)] -->|Executes Commands| Shell[Android Shell]
        Shell -->|Controls| App[AUT: Nostr Client App]
        App -->|Reads/Writes| AS[App Storage / Logs]
        App -->|Publish/Subscribe| NR
        Shell -->|Reads/Queries| AS
    end

    TR -->|Verify Events| NR
    TR -->|Query State/Logs via ADB Lib| ADB
```

## 3. Specific Test Scenarios

Tests should cover positive paths, negative paths (invalid inputs, permissions), edge cases, and boundary conditions.

### 3.1 NIP-29 Group Moderation

*(Verification through Nostr events and, where possible, ADB state queries)*

*   **Group Lifecycle:**
    *   Create a new public group (verify kind 39000 event, tags `d`, `name`, etc.).
    *   Create a new private group (verify kind 39001 event, required tags).
    *   Attempt to create a group with invalid metadata.
*   **Membership Management:**
    *   Admin invites a user (verify NIP-29 invite mechanism/event).
    *   Invited user accepts (test app's reaction to acceptance event).
    *   Admin lists members (verify NIP-29 member list accuracy via relay query).
    *   Admin kicks a user (verify kick event, check updated member list).
    *   Non-admin attempts to kick (verify failure/no event).
    *   User leaves group (verify leave event, check updated member list).
*   **Role Management:**
    *   Admin assigns 'moderator' role (verify NIP-29 role event).
    *   Admin assigns 'admin' role (verify event).
    *   New admin/moderator performs role-specific actions (e.g., moderator kicks non-admin, verify success).
    *   Lower role attempts higher-role actions (e.g., member tries to kick, verify failure).
    *   Role changes/revocations.
*   **Permission Verification:**
    *   Verify unauthorized users cannot post to restricted groups.
    *   Verify users with correct roles *can* post.
    *   Verify permissions align with group type (public vs. private).
*   **Event Validation:**
    *   Strict validation of all generated NIP-29 events (kinds 39000-39005, relevant kinds like 40-44 if applicable for group chat) for correct structure, tags (`e`, `p`, `d`, `relay`, `marker`, etc.), and content according to the spec.

### 3.2 Step Counter

*(Verification primarily through ADB state queries/logs, potentially basic app interaction simulation)*

*   **Initialization:**
    *   On fresh install (via `adb install` + `adb shell pm clear`), query initial step count (verify it's 0 or expected default).
    *   On app launch (`adb shell am start`), query step count.
*   **Increment Accuracy:**
    *   **[Critical Assumption Point]** Trigger step increments using the assumed ADB mechanism (e.g., `adb shell am broadcast -a com.example.TRIGGER_STEP`, mock location input).
    *   Trigger N steps.
    *   Query the step count via ADB/logs.
    *   Verify count = initial + N.
*   **Data Persistence:**
    *   Set a step count (via simulation).
    *   Force-stop the app (`adb shell am force-stop`).
    *   Relaunch the app.
    *   Query the step count; verify it matches the count before stopping.
    *   Clear app data (`adb shell pm clear`).
    *   Launch app; query count; verify it's reset to default.
*   **Reset Logic:**
    *   If a 'reset step count' feature exists, attempt to trigger it via ADB (if possible, e.g., via intent).
    *   Query count; verify it's reset.
*   **Boundary Conditions:**
    *   Verify behavior at 0 steps.
    *   If a known maximum exists, test behavior approaching/at the maximum (requires extensive simulation).
*   **Querying/Display:**
    *   Query step count via assumed ADB mechanism.
    *   (Optional/If Possible) Check logs for any output related to step count display/update to indirectly verify potential UI reflection of the count.
*   **Independence:**
    *   Perform NIP-29 group actions (create group, invite, etc.).
    *   Verify step count remains unaffected.
    *   Simulate step increments.
    *   Verify group memberships/status remain unaffected.

## 4. Assumptions (CRITICAL)

The feasibility of this terminal-based testing approach rests heavily on the following assumptions about the AUT and its environment:

1.  **ADB State Accessibility:** It is assumed that critical application state can be reliably queried via ADB. Potential mechanisms include:
    *   **Log Output:** The app emits distinct, machine-readable log messages (`adb logcat`) for key events like step increments, NIP-29 actions performed, state changes (e.g., "Step count updated to: X", "User Y added to group Z").
    *   **File Access:** Internal state (step count, group membership cache) is stored in files accessible via `adb shell run-as <package_name> cat <file_path>`.
    *   **Debug Intents/Receivers:** The app exposes specific broadcast intents/receivers for querying state (e.g., `adb shell am broadcast -a com.example.QUERY_STEP_COUNT`) that return data.
    *   `dumpsys`: Relevant state might be exposed via `adb shell dumpsys activity <service>` or similar system dumps.
2.  **Step Counter Simulation:** A reliable mechanism exists to trigger or simulate step counter increments via ADB. Possible methods:
    *   **Debug Intent:** `adb shell am broadcast -a com.example.SIMULATE_STEPS --ei count N`.
    *   **Mock Sensor Data:** If steps are derived from sensors, using ADB to provide mock sensor data (more complex).
    *   **Mock Location:** If steps relate to location changes, using ADB's mock location provider (`adb shell appops set <package_name> android:mock_location allow`, then providing mock GPS data).
    *   **Hidden Debug Command:** A command-line tweak or hidden setting accessible via ADB.
    *   **Direct State Write:** Ability to directly modify the stored step count via `adb shell run-as`. *(Least likely/desirable)*
3.  **Nostr Protocol Adherence:** The application's NIP-29 implementation strictly follows the standard specification, allowing interactions and verification via standard Nostr client libraries.
4.  **Test Environment:**
    *   A dedicated Android device or emulator instance is available for testing.
    *   Specific `.apk` builds are accessible for installation via `adb install`.
    *   Access to one or more Nostr relays for testing is available (either public or a private test relay).
    *   Network connectivity allows the test runner, ADB, and the AUT to communicate with Nostr relays.
5.  **ADB Setup:** ADB is correctly installed and configured on the test execution machine, and the target device is reliably connectable and authorized.

**Verification of these assumptions is the FIRST step before committing to script development.**

## 5. Recommended Tools & Languages

*   **Primary Recommendation: Python**
    *   **Language:** Python 3.x
    *   **Nostr Library:** `nostr-sdk` (highly capable, async support) or similar mature Python library.
    *   **ADB Library:** `pure-python-adb` (cross-platform pure Python implementation) or `ppadb` (wrapper around ADB server).
    *   **Test Runner:** `pytest` (feature-rich, fixtures for setup/teardown, plugins, good reporting).
    *   **Helper Libraries:** `requests` (if any REST API interaction needed), `python-dotenv` (for environment config).
    *   **Justification:** Python offers excellent libraries for network protocols (Nostr) and system interaction (ADB). `pytest` provides a robust and scalable testing framework ideal for managing setup, teardown, and complex assertions. Large community support.
*   **Alternative: JavaScript/Node.js**
    *   **Language:** Node.js (LTS version)
    *   **Nostr Library:** `nostr-tools` (standard JS library) or others like `nostr-fetch`.
    *   **ADB Library:** `adbkit` (Node.js client for ADB).
    *   **Test Runner:** `vitest` (since it appears in the project) or `jest`.
    *   **Helper Libraries:** `dotenv`.
    *   **Justification:** Aligns potentially with the application's development stack (React Native/Capacitor likely uses JS), potentially allowing future integration or reuse of utility functions. Test runners are mature.
*   **Supporting Tools:**
    *   `jq`: Command-line JSON processor, extremely useful for parsing/filtering Nostr event data or ADB JSON output.
    *   `bash`/`sh`: For orchestrating script execution, basic file operations, or simple ADB command sequences.

## 6. Test Script Structure

A modular and consistent structure is recommended:

*   **Root Directory:** `test-terminal/` (or similar, at project root)
*   **Configuration:** `test-terminal/config.json` or `.env` (Relay URLs, test user private keys, ADB device ID/target). **NEVER commit private keys.** Use environment variables or a secure loading mechanism.
*   **Utilities:** `test-terminal/utils/` (Reusable functions for ADB interaction, Nostr client setup, common assertions).
*   **Test Suites:**
    *   `test-terminal/nip29/`
        *   `test_group_creation.py` / `.test.js`
        *   `test_membership.py` / `.test.js`
        *   `test_roles.py` / `.test.js`
        *   # (Additional NIP-29 test files as needed)
    *   `test-terminal/step_counter/`
        *   `test_increment.py` / `.test.js`
        *   `test_persistence.py` / `.test.js`
        *   # (Additional step counter test files as needed)
*   **Individual Test File Template (`pytest` example):**

    ```python
    # test-terminal/nip29/test_membership.py
    import pytest
    from ..utils import nostr_client, adb_controller # Hypothetical utility modules

    @pytest.fixture(scope="module") # Setup once per module
    def test_relay():
        # Connect to test relay specified in config
        client = nostr_client.connect()
        yield client
        client.disconnect()

    @pytest.fixture(scope="function") # Setup/teardown for each test
    def app_state(adb_device_id):
        # Setup: Ensure clean app state
        adb = adb_controller.connect(adb_device_id)
        adb.clear_app_data("com.example.nostrclient")
        adb.start_app("com.example.nostrclient")
        yield adb # Pass controller to test
        # Teardown: Stop app
        adb.stop_app("com.example.nostrclient")
        adb.disconnect()

    def test_admin_invites_user(test_relay, app_state):
        # ARRANGE: Get admin/user keys, create initial group via Nostr
        admin_key = nostr_client.get_key("admin_key")
        user_key = nostr_client.get_key("test_user1")
        group_event = nostr_client.create_group(test_relay, admin_key, "Test Group Invite")
        group_id = group_event.id()

        # ACT: Admin sends invite event via Nostr library
        invite_event = nostr_client.invite_to_group(test_relay, admin_key, group_id, user_key.public_key)

        # ASSERT: Check relay for the correct invite event structure/tags
        assert invite_event is not None
        assert invite_event.kind() == 39004 # Or relevant invite kind
        # Add more specific tag/content assertions here.
        # Optional: Check app_state via ADB logs/queries if possible to see if internal state reflects invite
        # log_output = app_state.get_logcat(filter="GroupInvite")
        # assert "Invite for user X received" in log_output

    # Define other related test functions below...
    ```

## 7. Conclusion

This strategic plan provides a roadmap for developing terminal-runnable automated tests for the Android Nostr client's NIP-29 and Step Counter features. The hybrid methodology leveraging direct Nostr interaction and ADB control offers a viable path but is **highly dependent on the testability hooks and observable outputs** provided by the application. **Prioritizing the verification of the outlined assumptions is crucial before proceeding with significant script development.** This plan aims to maximize test coverage within the constraints of terminal-based execution for a mobile application.