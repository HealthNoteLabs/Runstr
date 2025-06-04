# RUNSTR App Challenge Ideas

This document outlines brainstormed challenge ideas for the RUNSTR application, designed to engage users across different activity types and leverage Kind 1301 workout records.

## Challenge Concept 0: RUNSTR Season 1 - Attack of the Anons (User Inspired)

*   **Theme:** Survival, skill, and identity verification against a playful antagonist.
*   **Narrative:** "Anonymous bots are swarming RUNSTR, trying to dilute the achievements of true athletes! Survive the 'Bot Filter' by proving your skill and identity. Only verified humans who meet the challenge will prevail!"
*   **Core Mechanics (adaptable per activity):**
    *   Achieve specific performance benchmarks consistently.
    *   Maintain a regular activity schedule over a set duration (e.g., 4 weeks).
*   **Data Used:** Kind 1301 workout records (`distance`, `duration` to verify performance and frequency).
*   **Participation Criteria (Examples):**
    *   NIP-05 verified (to "prove you're not a bot").
    *   Zap an entry fee (e.g., 2000 sats to a designated RUNSTR npub) "to fund the anti-bot defenses."
*   **Rewards (Examples):**
    *   "Anon Survivor" (or "Verified Human") Nostr Badge (NIP-58).
    *   Public shoutout on a "Verified Survivors" list.

### Activity Mode Breakdowns:

#### 1. Attack of the Anons (Run Mode)
*   **Performance Goal:** Complete 5km runs, each under 30 minutes.
*   **Consistency Goal:** Log 3 such qualifying runs per week for 4 consecutive weeks.

#### 2. Attack of the Anons (Cycle Mode)
*   **Performance Goal:** Complete cycle rides of at least 20km with an average speed greater than 25km/h.
*   **Consistency Goal:** Log 2 such qualifying rides per week for 4 consecutive weeks.

#### 3. Attack of the Anons (Walk Mode)
*   **Performance Goal:** Complete walks of at least 7km with an average pace faster than 9:00 minutes per kilometer.
*   **Consistency Goal:** Log 3 such qualifying walks per week for 4 consecutive weeks.

---

## Challenge Concept 1: The Mileage Monarch / Kilometre King

*   **Theme:** Endurance, dedication, and achieving significant cumulative distance.
*   **Narrative:** "The roads and trails stretch endlessly, calling for a true sovereign of distance. Ascend the throne by amassing mileage and prove your reign over the long haul. Who will be crowned the Mileage Monarch (or Kilometre King) this month?"
*   **Core Mechanics (adaptable per activity):**
    *   **Primary Goal:** Achieve the highest cumulative distance in a specific activity type over a defined period (e.g., 1 calendar month).
    *   **Secondary Goal (Qualifier):** Must log a minimum number of activities (e.g., 10 activities) during the period to qualify for the leaderboard.
*   **Data Used:** Kind 1301 workout records (sum of `distance` for all valid activities, count of activities).
*   **Participation Criteria (Examples):**
    *   Open to all users.
    *   Optional: Small zap (e.g., 100 sats) to enter the official leaderboard.
*   **Rewards (Examples):**
    *   "Mileage Monarch" / "Kilometre King" Nostr Badge for the winner in each activity category.
    *   Badges for top 3 or top 10 finishers.
    *   A portion of collected entry zaps as a prize for the winner(s).
    *   Featured profile/story on RUNSTR community channels.

### Activity Mode Breakdowns:

#### 1. Mileage Monarch (Run Mode)
*   **Goal:** Highest total running distance in one month.
*   **Qualifier:** Minimum 12 runs logged in the month.

#### 2. Mileage Monarch (Cycle Mode)
*   **Goal:** Highest total cycling distance in one month.
*   **Qualifier:** Minimum 8 rides logged in the month.

#### 3. Mileage Monarch (Walk Mode)
*   **Goal:** Highest total walking distance in one month.
*   **Qualifier:** Minimum 15 walks logged in the month.

---

## Challenge Concept 2: The Elevation Conqueror

*   **Theme:** Conquering vertical challenges and celebrating uphill battles.
*   **Narrative:** "The mountains and hills whisper challenges to those who dare to ascend. Answer their call! Accumulate elevation gain and etch your name among the legends who conquer the vertical realm."
*   **Core Mechanics (adaptable per activity, if elevation is tracked):**
    *   **Primary Goal:** Achieve the highest cumulative elevation gain in a specific activity type over a set period (e.g., 4 weeks).
    *   **Secondary Goal (Consistency):** Log activities on at least 3 different days each week during the challenge period.
*   **Data Used:** Kind 1301 workout records (sum of `elevation_gain` if available, or relies on users having devices/integrations that provide this in their workout notes/tags for manual verification if not a direct field).
    *   *Note: Kind 1301 doesn't have a standard `elevation_gain` field. This challenge might require parsing it from `content` or specific tags if users include it, or linking to platforms like Strava if that's an option.*
*   **Participation Criteria (Examples):**
    *   User must opt-in to the challenge.
    *   If relying on manual/note parsing, clear instructions on how to record elevation.
*   **Rewards (Examples):**
    *   "Elevation Conqueror" Nostr Badge.
    *   Tiered badges for different total elevation milestones (e.g., Bronze: 1000m, Silver: 2500m, Gold: 5000m total gain).
    *   Virtual "King/Queen of the Mountain" status for the week/month.

### Activity Mode Breakdowns:

#### 1. Elevation Conqueror (Run Mode)
*   **Goal:** Highest total running elevation gain in 4 weeks.
*   **Milestones:** Bronze (1000m), Silver (2500m), Gold (5000m).

#### 2. Elevation Conqueror (Cycle Mode)
*   **Goal:** Highest total cycling elevation gain in 4 weeks.
*   **Milestones:** Bronze (2000m), Silver (5000m), Gold (10000m).

#### 3. Elevation Conqueror (Walk/Hike Mode)
*   **Goal:** Highest total walking/hiking elevation gain in 4 weeks.
*   **Milestones:** Bronze (1500m), Silver (3000m), Gold (6000m).

---

## Challenge Concept 3: The Streak Sentinel / Consistency Crusader

*   **Theme:** Celebrating consistency and the power of daily (or regular) habits.
*   **Narrative:** "The path to greatness is paved with consistent effort. Become a Streak Sentinel by maintaining an unbroken chain of activity. Guard your streak, for it is a testament to your unwavering dedication!"
*   **Core Mechanics (adaptable per activity):**
    *   **Primary Goal:** Achieve the longest continuous streak of days with at least one qualifying activity logged.
    *   **Secondary Goal (Minimum effort per activity):** Each activity in the streak must meet a minimum duration or distance.
*   **Data Used:** Kind 1301 workout records (timestamps to determine consecutive days, `duration`/`distance` for minimum effort).
*   **Participation Criteria (Examples):**
    *   Open to all.
    *   Users can join the "Streak Board" at any time and their current streak is tracked.
*   **Rewards (Examples):**
    *   Nostr Badges for reaching streak milestones (e.g., 7-day, 14-day, 30-day, 60-day Sentinel).
    *   "Consistency Crusader" badge for the longest streak at the end of a "season" (e.g., 3 months).
    *   Sats rewards for hitting significant milestones.

### Activity Mode Breakdowns:

#### 1. Streak Sentinel (Run Mode)
*   **Streak:** Longest number of consecutive days with a run.
*   **Min Effort:** Each run at least 20 minutes OR 2km.

#### 2. Streak Sentinel (Cycle Mode)
*   **Streak:** Longest number of consecutive days with a cycle ride.
*   **Min Effort:** Each ride at least 30 minutes OR 10km.

#### 3. Streak Sentinel (Walk Mode)
*   **Streak:** Longest number of consecutive days with a walk.
*   **Min Effort:** Each walk at least 30 minutes OR 3km.

---