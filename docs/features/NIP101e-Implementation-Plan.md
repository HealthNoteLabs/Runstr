# NIP101e Implementation Plan: Runstr Community Features

This document outlines the plan, goals, ideas, and progress for implementing enhanced NIP-101e based community features in Runstr.

## Overall Vision

Transition Runstr from a generic Kind 1 feed and NIP29-based teams to a specialized system built around an enhanced NIP-101e for fitness communities. This involves:
*   Revamped Feed: Display Kind 1301 (Workout Records) for running.
*   New Team Structure: Utilize new kinds for Fitness Challenges (33403), Fitness Teams (33404), and Fitness Events (33405). Kind 1301 will tag these for association.
*   Monetization & Community: Introduce subscription fees for teams, with shared revenue for captains, and team-based chat rooms.
*   Relay Strategy: Heavily utilize reliable public relays for fetching data.

## Core Kinds (Proposed NIP-101e Enhancements)

*   **Kind 1301 - Workout Record (Enhanced):**
    *   Content: User's notes about the workout.
    *   Tags:
        *   `["d", "<workout-uuid>"]`
        *   `["title", "Workout Title"]`
        *   `["exercise", "33401:<pubkey>:<exercise-uuid>", "<relay>", "<sets/distance>", "<reps/duration>", "<weight/pace>"]` (example, adjust as per NIP-101e)
        *   `["activity_type", "running"]` (Or other activities. Crucial for feed filtering)
        *   `["challenge", "33403:<pubkey>:<challenge-uuid>", "<relay>"]` (Link to a challenge)
        *   `["team", "33404:<pubkey>:<team-uuid>", "<relay>"]` (Link to a team)
        *   `["event", "33405:<pubkey>:<event-uuid>", "<relay>"]` (Link to an event)
        *   Other NIP-101e relevant tags (accuracy, client, gps_polyline, device, etc.)

*   **Kind 33403 - Fitness Challenge:**
    *   Content: Description of the challenge.
    *   Tags: `["d", "<challenge-uuid>"]`, `["name", "Challenge Name"]`, `["start", "<timestamp>"]`, `["end", "<timestamp>"]`, `["goal_type", "distance_total"]`, `["goal_value", "100", "miles"]`, `["activity_types", "running"]`, `["public", "true"]`, `["t", "challenge"]`

*   **Kind 33404 - Fitness Team:**
    *   Content: Description of the team.
    *   Tags: `["d", "<team-uuid>"]`, `["name", "Team Name"]`, `["type", "running_club"]`, `["captain", "<pubkey>"]`, `["member", "<pubkey>"]` (repeat for each member), `["public", "true"]`, `["t", "team"]`, `["nip29_group_id", "<nip29_chat_group_id>"]` (For linking to NIP29 chat)

*   **Kind 33405 - Fitness Event:**
    *   Content: Description of the event.
    *   Tags: `["d", "<event-uuid>"]`, `["name", "Event Name"]`, `["date", "<timestamp>"]`, `["location", "Location String"]`, `["t", "event"]`

## Refined Phased Rollout Plan

**Phase 1: Kind 1301 Running Feed**
*   **Goal:** Replace the current feed with a list of Kind 1301 running-related workout records.
*   **Tasks:**
    *   Modify feed service to fetch `{"kinds": [1301]}` from reliable public relays.
    *   Implement client-side filtering to identify "running" activities (e.g., based on `["activity_type", "running"]` tag or other content heuristics).
    *   Adapt feed item UI to display Kind 1301 content appropriately.
    *   Maintain zapping functionality.
    *   Investigate and decide on a consistent internal tagging convention for identifying "running" activities within Kind 1301 to aid filtering.
*   **Implementation Options:**
    *   **Option 1.A (Recommended): Simple Kind 1301 Fetch & Client-Side Display Filter**
        *   Pros: Fastest to MVP, leverages existing feed infrastructure.
        *   Cons: Client-side filtering might become less performant with high volumes of non-running Kind 1301s.
    *   **Option 1.B: Relay-Assisted Filtering for Running**
        *   Pros: More efficient fetching.
        *   Cons: Depends on relay capabilities for specific tag indexing or widespread adoption of a precise "running workout" tag. Likely premature.

**Phase 2: Basic Team Structure & Display**
*   **Goal:** Allow users to see a list of Fitness Teams (Kind 33404) and view a basic team page with a tab structure.
*   **Tasks:**
    *   Create a "Teams" page that lists all discovered Kind 33404 events. Fetch from reliable public relays.
        *   Discovery: Initially a simple, unfiltered list. Search/filter TBD later.
    *   Team events should display basic info like team name.
    *   Implement navigation from the team list to a team-specific detail page.
    *   The team detail page should have placeholders for the 5 tabs:
        1.  Team Workout Records (Kind 1301s tagged with this team's ID)
        2.  Chatroom (NIP29)
        3.  Challenges (Kind 33403s associated with this team)
        4.  Current Members (List of pubkeys from `member` tags)
        5.  Events (Kind 33405s associated with this team)
*   **Implementation Options:**
    *   **Option 2.A (Recommended Start): Fetch All Kind 33404, Basic Display**
        *   Pros: Straightforward, quickly gets visual structure.
        *   Cons: Team detail page initially non-functional.
    *   **Option 2.B: Fetch Kind 33404 & Link to NIP29 (Early Integration for Chat Placeholder)**
        *   Pros: Prepares for chat, provides tangible NIP29 link.
        *   Cons: Requires deciding on `nip29_group_id` tagging earlier. Best integrated as part of Phase 3.

**Phase 3: Admin & Membership Management**
*   **Goal:** Enable team creation, captain admin controls, and basic membership logic. Integrate NIP29 for chat.
*   **Tasks:**
    *   Develop an admin section for team captains:
        *   Create/Edit Kind 33404 Fitness Team details.
        *   Upon Kind 33404 creation, automatically create a corresponding NIP29 group and store its ID (e.g., in a `["nip29_group_id", "<id>"]` tag on the Kind 33404 event).
        *   Create Kind 33403 Fitness Challenges (associated with their team).
        *   Create Kind 33405 Fitness Events (associated with their team).
    *   Implement team joining/leaving logic. (Monetization aspects TBD later or in parallel).
    *   Update Kind 33404 event with `member` tags upon joining.
    *   Basic display of members on the "Current Members" tab.

**Phase 4: Full Tab Functionality & Monetization**
*   **Goal:** Make all team tabs fully functional and implement monetization.
*   **Tasks:**
    *   **Team Workout Records Tab:** Fetch and display Kind 1301 events tagged with the current team's ID.
    *   **Chatroom Tab:** Implement full NIP29 chat interface, using the linked NIP29 group ID.
    *   **Challenges Tab:** Display challenges created by the team captain, allow users to "participate" (which would mean their future Kind 1301s can be tagged with the challenge ID).
    *   **Events Tab:** Display events created by the team captain, allow users to "RSVP" or "participate."
    *   Implement monetization:
        *   5k sats to create a team.
        *   1k sats/month to join a team.
        *   Mechanism for captains to receive a portion of joining fees. (Requires Lightning integration and payment verification).
    *   Leaderboards and progress tracking features.

## Open Questions & Considerations

*   **NIP Formalization:** How to best propose these new Kinds (33403, 33404, 33405) or extensions to NIP-101e to the wider Nostr community?
*   **Relay Support:** What are the indexing capabilities of target relays for tag-based queries on these new kinds?
*   **Monetization Details:** Precise mechanism for payment verification and payouts for captains.
*   **Scalability:** For NIP29 chats in large teams.
*   **Privacy:** Granular controls for private teams/challenges/events and data sharing.
*   **Data Aggregation for Stats:** Client-side vs. relay-side for things like leaderboard calculations.

## Success Metrics (Initial)

*   Users can view a feed of Kind 1301 running activities.
*   Users can view a list of Kind 33404 Fitness Teams.
*   Captains can create teams and associated NIP29 chats.
*   Users can join teams.
*   Basic chat functionality is operational within teams.

## Failure Scenarios & Mitigation

*   **Low Adoption of New Kinds:** If other clients/users don't adopt these kinds, the ecosystem might remain small.
    *   Mitigation: Clear documentation, outreach, and ensuring Runstr provides compelling use cases.
*   **Relay Performance Issues:** If relays struggle with queries for new kinds/tags.
    *   Mitigation: Work with relay operators, optimize query patterns, potentially run a dedicated relay for Runstr community features if necessary.
*   **Complexity of Monetization:** Payment verification and payouts can be hard.
    *   Mitigation: Start with simpler models, potentially manual verification initially, iterate based on feasibility.

## Progress Log

*   **[Date]** - Initial brainstorming and planning document created.
*   **[Date]** - Refined phased rollout based on feedback. Added NIP29 integration for chat. Clarified relay strategy and initial discovery mechanisms.

---
This document will be updated as the project progresses. 