import { Event as NostrEvent, EventTemplate } from 'nostr-tools'; // Added EventTemplate
import { v4 as uuidv4 } from 'uuid';
import NDK, { NDKEvent, NDKFilter, NDKKind, NDKSubscription, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk'; // Import NDK

// Assume an NDK instance or similar service is available for actual Nostr operations
// e.g., ndk.publish(event), ndk.fetchEvents(filter)
// These would be passed in or accessed via a context/singleton.

export const KIND_FITNESS_TEAM = 33404; // Your NIP-101e Team Kind
export const KIND_WORKOUT_RECORD = 1301; // Define Kind 1301
export const KIND_TEAM_MEMBERSHIP = 33406; // New kind: membership join event
export const KIND_TEAM_SUBSCRIPTION_RECEIPT = 33408; // Kind for subscription receipt events
export const KIND_TEAM_AUTO_REMOVE = 33407; // Kind for auto-removal (grace period exceeded)
export const KIND_EVENT_PARTICIPATION = 33409; // New kind: event participation

// NIP-29 Kinds - to be removed or repurposed if NIP-29 integration is fully removed
// export const KIND_NIP29_GROUP_METADATA = 10009;
// export const KIND_NIP29_CHAT_MESSAGE = 9; 

// New Kind for NIP-101e Native Team Chat
export const KIND_NIP101_TEAM_CHAT_MESSAGE = 133404; // Example custom kind

// New Kinds for NIP-101e Activities
export const KIND_NIP101_TEAM_EVENT = 31012; // NIP-101e Team Event
export const KIND_NIP101_TEAM_CHALLENGE = 31013; // NIP-101e Team Challenge

export interface TeamData {
  name: string;
  description: string;
  isPublic: boolean;
  image?: string; // Optional: for team picture, also used in NIP-29 group
  // other fields like location, type can be added
}

// Using NostrEvent from nostr-tools as a base for typing
export interface NostrTeamEvent extends NostrEvent {
  // We can add parsed properties if needed, e.g., parsedName, parsedDescription
  // but the base structure is an Event.
}

export interface NostrWorkoutEvent extends NostrEvent {} // Basic type for workout events

export interface EventParticipation {
  pubkey: string;
  distance: number;
  duration: number;
  pace: number;
  joined_at: number;
  completed_at?: number;
}

/**
 * Prepares a new NIP-101e Fitness Team (Kind 33404) event template.
 * The actual signing and publishing will be handled by the app's NDK/Nostr client instance.
 * The creator automatically becomes the captain and a member.
 */
export function prepareNip101eTeamEventTemplate(
  teamData: TeamData,
  creatorPubkey: string
): EventTemplate | null {
  if (!creatorPubkey) {
    console.error("Creator pubkey is required to prepare a NIP-101e team event.");
    return null;
  }

  const teamUUID = uuidv4();

  const tags = [
    ["d", teamUUID],
    ["name", teamData.name],
    ["public", teamData.isPublic.toString()],
    ["captain", creatorPubkey],
    ["member", creatorPubkey], 
    ["t", "team"],
    ["t", "running"],
    ["type", "running_club"],
  ];
  if (teamData.image) {
    tags.push(["image", teamData.image]);
  }

  const eventTemplate: EventTemplate = {
    kind: KIND_FITNESS_TEAM,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: teamData.description,
  };

  console.log("Prepared NIP-101e team creation event template (unsigned):", eventTemplate);
  return eventTemplate;
}

// --- Updated NDK-based fetch functions ---

/**
 * Fetches all public Fitness Team (Kind 33404) events using NDK.
 */
export async function fetchPublicTeams(
  ndk: NDK // Pass NDK instance
): Promise<NostrTeamEvent[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchPublicTeams.");
    return [];
  }

  const filter: NDKFilter = {
    kinds: [KIND_FITNESS_TEAM as NDKKind], // Cast to NDKKind here
    // Limit can be adjusted based on expected number of teams or pagination strategy
    // limit: 50, 
  };
  
  try {
    console.log("Fetching public teams with filter:", filter);
    // NDK's fetchEvents by default tries to get the latest replaceable events if kind is replaceable.
    // However, Kind 33404 is a generic kind, not specifically defined as replaceable in NIP-01 for all relays.
    // For teams, we'd expect one event per d-tag + pubkey. Here we fetch broadly and then filter.
    const eventsSet = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    
    const allTeamEvents: NostrTeamEvent[] = Array.from(eventsSet).map(ndkEvent => ndkEvent.rawEvent() as NostrTeamEvent);
    
    // Client-side filter for public teams and de-duplicate by unique team ID (captain + d-tag)
    const publicTeamsMap = new Map<string, NostrTeamEvent>();

    allTeamEvents.forEach(event => {
      if (isTeamPublic(event)) {
        const captain = getTeamCaptain(event); // Use pubkey as part of unique ID for the replaceable event
        const uuid = getTeamUUID(event);
        if (uuid) {
          const teamUniqueId = `${captain}:${uuid}`;
          const existingTeam = publicTeamsMap.get(teamUniqueId);
          if (!existingTeam || event.created_at > existingTeam.created_at) {
            publicTeamsMap.set(teamUniqueId, event);
          }
        }
      }
    });
    const uniquePublicTeams = Array.from(publicTeamsMap.values());
    console.log(`Fetched ${eventsSet.size} total team events, found ${uniquePublicTeams.length} unique public teams.`);
    return uniquePublicTeams;

  } catch (error) {
    console.error("Error fetching public teams with NDK:", error);
    return []; 
  }
}

/**
 * Fetches a specific Fitness Team (Kind 33404) event using NDK.
 * A team is uniquely identified by its kind, captain's pubkey, and d-tag (teamUUID).
 */
export async function fetchTeamById(
  ndk: NDK, // Pass NDK instance
  captainPubkey: string, 
  teamUUID: string
): Promise<NostrTeamEvent | null> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchTeamById.");
    return null;
  }
  if (!captainPubkey || !teamUUID) {
    console.warn("Captain pubkey or team UUID missing for fetchTeamById.");
    return null;
  }

  const filter: NDKFilter = {
    kinds: [KIND_FITNESS_TEAM as NDKKind], // Cast to NDKKind here
    authors: [captainPubkey],
    '#d': [teamUUID],
    limit: 1, // NDK should fetch the latest due to replaceable event semantics if kind is known by relays
              // or if not, it will get one based on limit, then we should sort by created_at.
  };

  try {
    console.log(`Fetching team by ID: captain=${captainPubkey}, uuid=${teamUUID}`, filter);
    // NDK usually handles fetching the latest version of a replaceable event.
    const eventsSet = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });

    if (eventsSet.size > 0) {
      // NDK fetchEvents with limit 1 for a replaceable kind (identified by authors & #d) should give the latest.
      // If multiple are returned somehow, sort to be sure.
      const eventsArray = Array.from(eventsSet).map(ndkEvent => ndkEvent.rawEvent() as NostrTeamEvent);
      eventsArray.sort((a, b) => b.created_at - a.created_at);
      console.log("Fetched team event:", eventsArray[0]);
      return eventsArray[0];
    }
    console.log("No team event found for the given ID.");
    return null;
  } catch (error) {
    console.error("Error fetching team by ID with NDK:", error);
    return null;
  }
}

/**
 * Fetches all Fitness Team (Kind 33404) events where the given user_pubkey is listed as a member.
 */
export async function fetchUserMemberTeams(
  ndk: NDK,
  userPubkey: string
): Promise<NostrTeamEvent[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchUserMemberTeams.");
    return [];
  }
  if (!userPubkey) {
    console.warn("User pubkey not provided to fetchUserMemberTeams.");
    return [];
  }

  // 1) Fetch *all* team events so we have latest metadata for each team
  const teamFilter: NDKFilter = {
    kinds: [KIND_FITNESS_TEAM as NDKKind],
  };

  // 2) Fetch membership events authored by the user (Kind 33406)
  const membershipFilter: NDKFilter = {
    kinds: [KIND_TEAM_MEMBERSHIP as NDKKind],
    authors: [userPubkey],
  };

  try {
    const [teamSet, membershipSet] = await Promise.all([
      ndk.fetchEvents(teamFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }),
      ndk.fetchEvents(membershipFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }),
    ]);

    const allTeamEvents: NostrTeamEvent[] = Array.from(teamSet).map(e => e.rawEvent() as NostrTeamEvent);
    const membershipEvents = Array.from(membershipSet);

    // Build map of latest team event keyed by captain:uuid
    const latestTeamMap = new Map<string, NostrTeamEvent>();
    allTeamEvents.sort((a, b) => b.created_at - a.created_at);
    for (const ev of allTeamEvents) {
      const id = `${getTeamCaptain(ev)}:${getTeamUUID(ev)}`;
      if (!latestTeamMap.has(id)) latestTeamMap.set(id, ev);
    }

    // Collect team identifiers from membership events
    const memberTeamIds = new Set<string>();
    for (const m of membershipEvents) {
      const aTag = m.tags.find(t => t[0] === 'a');
      if (!aTag) continue;
      const parts = aTag[1].split(':'); // 33404:cpt:uuid
      if (parts.length === 3) {
        const captain = parts[1];
        const uuid = parts[2];
        memberTeamIds.add(`${captain}:${uuid}`);
      }
    }

    // Also include teams where member tag exists directly in team event
    for (const ev of allTeamEvents) {
      if (getTeamMembers(ev).includes(userPubkey)) {
        memberTeamIds.add(`${getTeamCaptain(ev)}:${getTeamUUID(ev)}`);
      }
    }

    const result: NostrTeamEvent[] = [];
    memberTeamIds.forEach(id => {
      const ev = latestTeamMap.get(id);
      if (ev) result.push(ev);
    });

    console.log(`fetchUserMemberTeams → ${result.length} teams for user ${userPubkey}`);
    return result;
  } catch (error) {
    console.error("Error fetching user member teams:", error);
    return [];
  }
}

/**
 * Fetches Kind 1301 workout records associated with a specific team.
 * Uses enhanced querying strategy with multiple tag types for better performance.
 */
export async function fetchTeamActivityFeed(
  ndk: NDK,
  teamCaptainPubkey: string,
  teamUUID: string,
  limit: number = 20,
  since?: number,
  until?: number
): Promise<NostrWorkoutEvent[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchTeamActivityFeed.");
    return [];
  }
  if (!teamCaptainPubkey || !teamUUID) {
    console.warn("Team captain pubkey or UUID missing for fetchTeamActivityFeed.");
    return [];
  }

  // Strategy 1: Try direct UUID query first (most efficient)
  const directFilter: NDKFilter = {
    kinds: [KIND_WORKOUT_RECORD as NDKKind],
    '#team_uuid': [teamUUID], // Direct UUID tag from Phase 1
    limit: limit,
  };

  // Strategy 2: Fallback to hashtag query (backward compatibility)  
  const hashtagFilter: NDKFilter = {
    kinds: [KIND_WORKOUT_RECORD as NDKKind],
    '#t': [`team:${teamUUID}`], // Hashtag approach
    limit: limit,
  };

  if (since) {
    directFilter.since = since;
    hashtagFilter.since = since;
  }
  if (until) {
    directFilter.until = until;
    hashtagFilter.until = until;
  }

  try {
    // Try direct UUID query first
    console.log(`Fetching team activity feed with direct UUID query for team: ${teamUUID}`, directFilter);
    let eventsSet = await ndk.fetchEvents(directFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    
    // If no results, try hashtag fallback
    if (eventsSet.size === 0) {
      console.log(`No results with team_uuid tag, trying hashtag fallback for: team:${teamUUID}`);
      eventsSet = await ndk.fetchEvents(hashtagFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    }
    
    const workoutEvents: NostrWorkoutEvent[] = Array.from(eventsSet)
      .map(ndkEvent => ndkEvent.rawEvent() as NostrWorkoutEvent)
      .sort((a, b) => b.created_at - a.created_at); // Sort by newest first
    
    console.log(`Fetched ${workoutEvents.length} workout events for team ${teamUUID} (${eventsSet.size > 0 ? 'direct' : 'hashtag'} query)`);
    return workoutEvents;

  } catch (error) {
    console.error("Error fetching team activity feed with NDK:", error);
    return []; 
  }
}

/**
 * Fetches Kind 1301 workout records associated with a specific challenge.
 * Uses enhanced querying strategy with multiple tag types for better performance.
 */
export async function fetchChallengeActivityFeed(
  ndk: NDK,
  challengeUUID: string,
  limit: number = 20,
  since?: number,
  until?: number
): Promise<NostrWorkoutEvent[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchChallengeActivityFeed.");
    return [];
  }
  if (!challengeUUID) {
    console.warn("Challenge UUID missing for fetchChallengeActivityFeed.");
    return [];
  }

  // Strategy 1: Try direct UUID query first (most efficient)
  const directFilter: NDKFilter = {
    kinds: [KIND_WORKOUT_RECORD as NDKKind],
    '#challenge_uuid': [challengeUUID], // Direct UUID tag from Phase 1
    limit: limit,
  };

  // Strategy 2: Fallback to hashtag query (backward compatibility)  
  const hashtagFilter: NDKFilter = {
    kinds: [KIND_WORKOUT_RECORD as NDKKind],
    '#t': [`challenge:${challengeUUID}`], // Hashtag approach
    limit: limit,
  };

  if (since) {
    directFilter.since = since;
    hashtagFilter.since = since;
  }
  if (until) {
    directFilter.until = until;
    hashtagFilter.until = until;
  }

  try {
    // Try direct UUID query first
    console.log(`Fetching challenge activity feed with direct UUID query for challenge: ${challengeUUID}`, directFilter);
    let eventsSet = await ndk.fetchEvents(directFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    
    // If no results, try hashtag fallback
    if (eventsSet.size === 0) {
      console.log(`No results with challenge_uuid tag, trying hashtag fallback for: challenge:${challengeUUID}`);
      eventsSet = await ndk.fetchEvents(hashtagFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    }
    
    const workoutEvents: NostrWorkoutEvent[] = Array.from(eventsSet)
      .map(ndkEvent => ndkEvent.rawEvent() as NostrWorkoutEvent)
      .sort((a, b) => b.created_at - a.created_at); // Sort by newest first
    
    console.log(`Fetched ${workoutEvents.length} workout events for challenge ${challengeUUID} (${eventsSet.size > 0 ? 'direct' : 'hashtag'} query)`);
    return workoutEvents;

  } catch (error) {
    console.error("Error fetching challenge activity feed with NDK:", error);
    return []; 
  }
}

/**
 * Fetches Kind 1301 workout records from team members for verification.
 * Uses team member tag to validate team membership on workout events.
 */
export async function fetchTeamMemberWorkouts(
  ndk: NDK,
  teamMemberPubkeys: string[],
  teamUUID?: string,
  limit: number = 50,
  since?: number,
  until?: number
): Promise<NostrWorkoutEvent[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchTeamMemberWorkouts.");
    return [];
  }
  if (!teamMemberPubkeys || teamMemberPubkeys.length === 0) {
    console.warn("No team member pubkeys provided for fetchTeamMemberWorkouts.");
    return [];
  }

  // Filter by team member identification tags
  const memberFilter: NDKFilter = {
    kinds: [KIND_WORKOUT_RECORD as NDKKind],
    '#team_member': teamMemberPubkeys, // Team member verification tags from Phase 1
    limit: limit,
  };

  // Optional: Also filter by team UUID if provided
  if (teamUUID) {
    memberFilter['#team_uuid'] = [teamUUID];
  }

  if (since) memberFilter.since = since;
  if (until) memberFilter.until = until;

  try {
    console.log(`Fetching workouts for ${teamMemberPubkeys.length} team members`, memberFilter);
    const eventsSet = await ndk.fetchEvents(memberFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    
    const workoutEvents: NostrWorkoutEvent[] = Array.from(eventsSet)
      .map(ndkEvent => ndkEvent.rawEvent() as NostrWorkoutEvent)
      .sort((a, b) => b.created_at - a.created_at); // Sort by newest first
    
    console.log(`Fetched ${workoutEvents.length} workout events from team members`);
    return workoutEvents;

  } catch (error) {
    console.error("Error fetching team member workouts with NDK:", error);
    return []; 
  }
}

// --- Helper functions to parse event data ---

export function getTeamName(teamEvent: NostrTeamEvent): string {
  const nameTag = teamEvent.tags.find(tag => tag[0] === 'name');
  return nameTag ? nameTag[1] : 'Unnamed Team';
}

export function getTeamDescription(teamEvent: NostrTeamEvent): string {
  return teamEvent.content || 'No description.';
}

export function getTeamCaptain(teamEvent: NostrTeamEvent): string {
  const captainTag = teamEvent.tags.find(tag => tag[0] === 'captain');
  return captainTag ? captainTag[1] : teamEvent.pubkey;
}

export function getTeamMembers(teamEvent: NostrTeamEvent): string[] {
  return teamEvent.tags.filter(tag => tag[0] === 'member').map(tag => tag[1]);
}

export function getTeamUUID(teamEvent: NostrTeamEvent): string | undefined {
    const dTag = teamEvent.tags.find(tag => tag[0] === 'd');
    return dTag ? dTag[1] : undefined;
}

export function isTeamPublic(teamEvent: NostrTeamEvent): boolean {
    const publicTag = teamEvent.tags.find(tag => tag[0] === 'public');
    return publicTag ? publicTag[1].toLowerCase() === 'true' : false; // Default to false if tag missing
}

/**
 * Prepares an updated (unsigned) team event with a new member added.
 * This is for a replaceable Kind 33404 event.
 * @param existingTeamEvent The latest known version of the team event.
 * @param newMemberPubkey The pubkey of the member to add.
 * @returns A new NostrEvent object (template) ready for signing, or null if inputs are invalid.
 */
export function addMemberToTeamEvent(
  existingTeamEvent: NostrTeamEvent,
  newMemberPubkey: string
): EventTemplate | null {
  if (!existingTeamEvent || !newMemberPubkey) {
    console.error("Invalid arguments for addMemberToTeamEvent");
    return null;
  }

  const currentMembers = getTeamMembers(existingTeamEvent);
  if (currentMembers.includes(newMemberPubkey)) {
    console.log("Member already exists in the team, no changes made.");
    // Optionally, could return the existing event if no change, but returning null 
    // or a specific status might be better to indicate no action needed.
    // For now, let's return a new template even if member exists, caller can decide.
    // Or, more strictly, indicate no change by returning the original or null.
    // Let's assume for now we always return a new template if an update is requested,
    // even if it means re-adding an existing member (though tags shouldn't duplicate exactly).
  }

  const newTags = existingTeamEvent.tags.filter(tag => tag[0] !== 'member'); // Remove old member tags
  const updatedMembers = Array.from(new Set([...currentMembers, newMemberPubkey])); // Add new member, ensure uniqueness
  updatedMembers.forEach(member => newTags.push(["member", member]));
  
  // Ensure 'd' tag is preserved and unique
  const dTag = existingTeamEvent.tags.find(tag => tag[0] === 'd');
  if (!dTag) {
      console.error("Cannot update team event: existing event is missing 'd' tag.");
      return null;
  }
  // Filter out old dTag if present in newTags from filtering step, then add the original one back
  const finalTags = newTags.filter(tag => tag[0] !== 'd');
  finalTags.unshift(dTag); // Ensure 'd' tag is primary for replaceable event id by author+d+kind

  const updatedEventTemplate: EventTemplate = {
    kind: KIND_FITNESS_TEAM as number,
    tags: finalTags,
    content: existingTeamEvent.content, // Content usually remains the same for member changes
    created_at: Math.floor(Date.now() / 1000), // New timestamp for replaceable event
    // pubkey will be set by the signer (captain)
  };

  return updatedEventTemplate;
}

/**
 * Prepares an updated (unsigned) team event with a member removed.
 * This is for a replaceable Kind 33404 event.
 * @param existingTeamEvent The latest known version of the team event.
 * @param memberToRemovePubkey The pubkey of the member to remove.
 * @returns A new NostrEvent object (template) ready for signing, or null if inputs are invalid.
 */
export function removeMemberFromTeamEvent(
  existingTeamEvent: NostrTeamEvent,
  memberToRemovePubkey: string
): EventTemplate | null {
  if (!existingTeamEvent || !memberToRemovePubkey) {
    console.error("Invalid arguments for removeMemberFromTeamEvent");
    return null;
  }

  const currentMembers = getTeamMembers(existingTeamEvent);
  if (!currentMembers.includes(memberToRemovePubkey)) {
    console.warn("Member to remove not found in the team.");
    // Return the original event or null to indicate no change was made / possible
    return null; 
  }

  const newTags = existingTeamEvent.tags.filter(tag => 
      !(tag[0] === 'member' && tag[1] === memberToRemovePubkey)
  );

  // Ensure 'd' tag is preserved if it was filtered out (it shouldn't be by above logic)
  const dTag = existingTeamEvent.tags.find(tag => tag[0] === 'd');
  if (!dTag) {
      console.error("Cannot update team event: existing event is missing 'd' tag.");
      return null;
  }
  if (!newTags.some(tag => tag[0] === 'd' && tag[1] === dTag[1])) {
      newTags.unshift(dTag);
  }

  const updatedEventTemplate: EventTemplate = {
    kind: KIND_FITNESS_TEAM as number,
    tags: newTags,
    content: existingTeamEvent.content,
    created_at: Math.floor(Date.now() / 1000),
  };

  return updatedEventTemplate;
}

// --- NIP-101e Native Team Chat Functions ---

/**
 * Prepares an unsigned NIP-101e native team chat message (e.g., Kind 133404) event template.
 * @param teamAIdentifier The 'a' tag reference of the NIP-101e team (e.g., "33404:captain_pubkey:team_uuid").
 * @param messageContent The content of the chat message.
 * @param senderPubkey The pubkey of the user sending the message.
 * @returns An EventTemplate ready for signing, or null if inputs are invalid.
 */
export function prepareTeamChatMessage(
  teamAIdentifier: string, // e.g., "33404:captain_pubkey:team_uuid"
  messageContent: string,
  senderPubkey: string // senderPubkey is needed to be passed to NDKEvent for signing
): EventTemplate | null {
  if (!teamAIdentifier || !messageContent || !senderPubkey) {
    console.error("Missing required parameters for prepareTeamChatMessage");
    return null;
  }

  const tags = [
    ["a", teamAIdentifier], // Link to the NIP-101e team event
    // Optional: Add a specific tag for easier client-side filtering if needed, e.g., ["t", "nip101e-chat"]
  ];

  const eventTemplate: EventTemplate = {
    kind: KIND_NIP101_TEAM_CHAT_MESSAGE, // Use the new custom kind
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: messageContent,
  };
  return eventTemplate;
}

/**
 * Subscribes to NIP-101e native team chat messages for a specific team.
 * @param ndk NDK instance.
 * @param teamAIdentifier The 'a' tag reference of the NIP-101e team (e.g., "33404:captain_pubkey:team_uuid").
 * @param callback Function to call with each new chat message event.
 * @param limit Optional limit for initial fetch.
 * @returns NDKSubscription instance, or null if error.
 */
export function subscribeToTeamChatMessages(
  ndk: NDK,
  teamAIdentifier: string, 
  callback: (event: NostrEvent) => void,
  limit: number = 50 
): NDKSubscription | null {
  if (!ndk || !teamAIdentifier) {
    console.error("NDK instance or teamAIdentifier missing for subscribeToTeamChatMessages");
    return null;
  }
  
  const filter: NDKFilter = {
    kinds: [KIND_NIP101_TEAM_CHAT_MESSAGE as NDKKind],
    "#a": [teamAIdentifier], // Filter by the NIP-101e team's 'a' tag
    limit: limit,
  };
  console.log("Subscribing to NIP-101e team chat messages with filter:", filter, teamAIdentifier);

  const subscription = ndk.subscribe(filter, { closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });

  subscription.on('event', (ndkEvent: NDKEvent) => {
    callback(ndkEvent.rawEvent() as NostrEvent);
  });

  subscription.on('eose', () => {
    console.log(`EOSE received for NIP-101e team chat messages: ${teamAIdentifier}`);
  });
  
  return subscription;
}

// --- NIP-101e Team Activity Functions (Events & Challenges) ---

export interface TeamActivityDetails {
  type: 'event' | 'challenge'; // KIND_NIP101_TEAM_EVENT or KIND_NIP101_TEAM_CHALLENGE
  name: string;
  description: string;
  startTime?: number; // Unix timestamp
  endTime?: number;   // Unix timestamp
  location?: string;  // For events
  rules?: string;     // For challenges
  // Add other fields as necessary, e.g., prize for challenge, specific metrics
}

/**
 * Prepares an unsigned NIP-101e team activity event (Kind 31012 for Event, 31013 for Challenge).
 * @param teamAIdentifier The 'a' tag of the NIP-101e team (e.g., "33404:captain_pubkey:team_uuid").
 * @param activityDetails Details of the activity.
 * @param creatorPubkey Pubkey of the user creating the activity.
 * @returns An EventTemplate ready for signing, or null if inputs are invalid.
 */
export function prepareTeamActivityEvent(
  teamAIdentifier: string, // e.g., "33404:captain_pubkey:team_uuid"
  activityDetails: TeamActivityDetails,
  creatorPubkey: string
): EventTemplate | null {
  if (!teamAIdentifier || !activityDetails || !creatorPubkey) {
    console.error("Missing required parameters for prepareTeamActivityEvent");
    return null;
  }

  const kind = activityDetails.type === 'event' ? KIND_NIP101_TEAM_EVENT : KIND_NIP101_TEAM_CHALLENGE;
  
  const tags: string[][] = [
    ["a", teamAIdentifier], // Link to the NIP-101e team
    ["name", activityDetails.name],
    ["description", activityDetails.description], // NIP-101e uses 'description' tag for this
  ];

  if (activityDetails.startTime) {
    tags.push(["start", activityDetails.startTime.toString()]); // NIP-101e 'start' tag
  }
  if (activityDetails.endTime) {
    tags.push(["end", activityDetails.endTime.toString()]); // NIP-101e 'end' tag
  }
  if (activityDetails.location && activityDetails.type === 'event') {
    tags.push(["location", activityDetails.location]);
  }
  if (activityDetails.rules && activityDetails.type === 'challenge') {
    // NIP-101e doesn't specify a 'rules' tag for challenges, might go in content or a custom tag.
    // For now, let's add it as a custom tag, or it can be part of the content.
    tags.push(["rules", activityDetails.rules]); // Or put in content
  }
  // Add other relevant tags based on NIP-101e spec for events/challenges.

  const eventTemplate: EventTemplate = {
    kind: kind,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: activityDetails.description, // Or JSON.stringify(activityDetails) if more complex
  };
  return eventTemplate;
}

/**
 * Subscribes to NIP-101e team activities (Kind 31012 Events, Kind 31013 Challenges).
 * @param ndk NDK instance.
 * @param teamAIdentifier The 'a' tag of the NIP-101e team (e.g., "33404:captain_pubkey:team_uuid").
 * @param callback Function to call with each new activity event.
 * @returns NDKSubscription instance, or null if error.
 */
export function subscribeToTeamActivities(
  ndk: NDK,
  teamAIdentifier: string, // e.g., "33404:captain_pubkey:team_uuid"
  callback: (event: NostrEvent) => void
) {
  if (!ndk || !teamAIdentifier) {
    console.error("NDK instance or teamAIdentifier missing for subscribeToTeamActivities");
    return null;
  }

  const filter: NDKFilter = {
    kinds: [KIND_NIP101_TEAM_EVENT as NDKKind, KIND_NIP101_TEAM_CHALLENGE as NDKKind],
    "#a": [teamAIdentifier], // Filter by the NIP-101e team's 'a' tag
    // limit: 20, // Optional: for initial fetch
  };
  console.log("Subscribing to team activities with filter:", filter);

  const subscription = ndk.subscribe(filter, { closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });

  subscription.on('event', (ndkEvent: NDKEvent) => {
    callback(ndkEvent.rawEvent() as NostrEvent);
  });

  subscription.on('eose', () => {
    console.log(`EOSE received for team activities: ${teamAIdentifier}`);
  });
  
  return subscription;
}

// --- NIP-101e Team Membership (Join) Functions ---

/**
 * Prepare an unsigned team membership event. This represents a user joining a team.
 * Kind 33406, with an 'a' tag linking to the team and a 'member' tag = joining pubkey.
 */
export function prepareTeamMembershipEvent(
  teamAIdentifier: string, // e.g., "33404:captain_pubkey:team_uuid"
  joiningPubkey: string
): EventTemplate | null {
  if (!teamAIdentifier || !joiningPubkey) {
    console.error("Missing parameters for prepareTeamMembershipEvent");
    return null;
  }
  const tags = [
    ["a", teamAIdentifier],
    ["member", joiningPubkey],
  ];
  const eventTemplate: EventTemplate = {
    kind: KIND_TEAM_MEMBERSHIP,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "joined team", // Minimal content
  };
  return eventTemplate;
}

/**
 * Fetch membership events for a team and return unique member pubkeys.
 */
export async function fetchTeamMemberships(
  ndk: NDK,
  teamAIdentifier: string
): Promise<string[]> {
  if (!ndk || !teamAIdentifier) return [];
  const filter: NDKFilter = {
    kinds: [KIND_TEAM_MEMBERSHIP as NDKKind],
    "#a": [teamAIdentifier],
    limit: 1000,
  };
  try {
    const events = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    const members = new Set<string>();
    events.forEach(e => {
      const memberTag = e.rawEvent().tags.find(t => t[0] === "member");
      if (memberTag) members.add(memberTag[1]);
    });
    return Array.from(members);
  } catch (err) {
    console.error("Error fetching membership events", err);
    return [];
  }
}

/**
 * Prepares an unsigned subscription receipt event template (Kind 33408).
 */
export function prepareTeamSubscriptionReceiptEvent(
  teamAIdentifier: string,
  payerPubkey: string,
  amountSats: number,
  periodStart: number = Math.floor(Date.now() / 1000),
  periodEnd: number = periodStart + 60 * 60 * 24 * 30 // 30-day period
): EventTemplate | null {
  if (!teamAIdentifier || !payerPubkey || !amountSats) {
    console.error("prepareTeamSubscriptionReceiptEvent: missing params");
    return null;
  }

  const tags: string[][] = [
    ["a", teamAIdentifier],
    ["amount", amountSats.toString()],
    ["period_start", periodStart.toString()],
    ["period_end", periodEnd.toString()],
  ];

  return {
    kind: KIND_TEAM_SUBSCRIPTION_RECEIPT,
    created_at: periodStart,
    tags,
    content: "subscription_receipt",
  };
}

/**
 * Fetch subscription receipt events (Kind 33408) for a particular team (and optionally payer).
 */
export async function fetchSubscriptionReceipts(
  ndk: NDK,
  teamAIdentifier: string,
  payerPubkey?: string,
  limit: number = 50,
): Promise<NostrEvent[]> {
  if (!ndk || !teamAIdentifier) return [];
  const filter: NDKFilter = {
    kinds: [KIND_TEAM_SUBSCRIPTION_RECEIPT as NDKKind],
    "#a": [teamAIdentifier],
    limit,
  };
  if (payerPubkey) filter.authors = [payerPubkey];
  try {
    const eventsSet = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    return Array.from(eventsSet).map(e => e.rawEvent() as NostrEvent);
  } catch (e) {
    console.error("Error fetching subscription receipts", e);
    return [];
  }
}

// --- Challenge definitions & helpers ---

export interface ChallengeGoal {
  goalType: 'distance_total';
  value: number;
  unit: 'km' | 'mi';
}

export interface ChallengeDetails {
  name: string;
  description: string;
  startTime?: number; // unix seconds
  endTime?: number;
  goal: ChallengeGoal;
}

/** Prepare a Kind 31013 Fitness Challenge event */
export function prepareTeamChallengeEvent(
  teamAIdentifier: string,
  details: ChallengeDetails,
  creatorPubkey: string
): EventTemplate | null {
  if (!teamAIdentifier || !details || !creatorPubkey) return null;
  const challengeUUID = uuidv4();
  const tags: string[][] = [
    ['d', challengeUUID],
    ['a', teamAIdentifier],
    ['name', details.name],
    ['description', details.description],
    ['goal_type', details.goal.goalType],
    ['goal_value', details.goal.value.toString(), details.goal.unit],
    ['t', 'challenge'],
    ['t', `challenge:${challengeUUID}`],
  ];
  if (details.startTime) tags.push(['start', details.startTime.toString()]);
  if (details.endTime) tags.push(['end', details.endTime.toString()]);
  const eventTemplate: EventTemplate = {
    kind: KIND_NIP101_TEAM_CHALLENGE,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: details.description,
  };
  return eventTemplate;
}

/** Fetch challenges for a team */
export async function fetchTeamChallenges(ndk: NDK, teamAIdentifier: string, limit = 100) {
  if (!ndk || !teamAIdentifier) return [];
  const filter: NDKFilter = {
    kinds: [KIND_NIP101_TEAM_CHALLENGE as NDKKind],
    '#a': [teamAIdentifier],
    limit,
  };
  try {
    const set = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    return Array.from(set).map(ev => ev.rawEvent());
  } catch (err) {
    console.error('fetchTeamChallenges', err);
    return [];
  }
}

export function subscribeToTeamChallenges(
  ndk: NDK,
  teamAIdentifier: string,
  cb: (evt: NostrEvent) => void,
  limit = 50
) {
  if (!ndk || !teamAIdentifier) return null;
  const filter: NDKFilter = {
    kinds: [KIND_NIP101_TEAM_CHALLENGE as NDKKind],
    '#a': [teamAIdentifier],
    limit,
  };
  const sub = ndk.subscribe(filter, { closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
  sub.on('event', (e: NDKEvent) => cb(e.rawEvent()));
  return sub;
}

/**
 * Get team statistics based on tagged 1301 workout records
 * Uses membership events to validate team membership, but queries 1301s for activity data
 */
export async function getTeamStatistics(
  ndk: NDK,
  teamCaptainPubkey: string,
  teamUUID: string,
  timeframe?: { since?: number; until?: number }
): Promise<{
  totalDistance: number;
  totalWorkouts: number;
  averagePace: number;
  topPerformers: any[];
  recentActivity: any[];
}> {
  if (!ndk) {
    console.warn("NDK instance not provided to getTeamStatistics.");
    return { totalDistance: 0, totalWorkouts: 0, averagePace: 0, topPerformers: [], recentActivity: [] };
  }

  try {
    // 1. Get current team members from membership events
    const teamMembers = await fetchTeamMemberships(ndk, `33404:${teamCaptainPubkey}:${teamUUID}`);
    
    if (teamMembers.length === 0) {
      console.log('No team members found for statistics calculation');
      return { totalDistance: 0, totalWorkouts: 0, averagePace: 0, topPerformers: [], recentActivity: [] };
    }

    // 2. Query 1301 workout records with team tags
    const teamWorkoutFilter: NDKFilter = {
      kinds: [KIND_WORKOUT_RECORD as NDKKind],
      '#team_uuid': [teamUUID],
      limit: 500 // Increase limit for statistics
    };

    if (timeframe?.since) teamWorkoutFilter.since = timeframe.since;
    if (timeframe?.until) teamWorkoutFilter.until = timeframe.until;

    console.log(`Fetching team statistics for team ${teamUUID} with ${teamMembers.length} members`);
    const workoutEvents = await ndk.fetchEvents(teamWorkoutFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    
    const workouts = Array.from(workoutEvents).map(e => e.rawEvent() as NostrWorkoutEvent);
    
    // 3. Filter workouts to only include current team members
    const memberWorkouts = workouts.filter(workout => 
      teamMembers.includes(workout.pubkey)
    );

    console.log(`Found ${memberWorkouts.length} workouts from ${teamMembers.length} team members`);

    // 4. Calculate statistics
    let totalDistance = 0;
    let totalDuration = 0;
    const memberStats = new Map<string, { distance: number; workouts: number; duration: number }>();

    memberWorkouts.forEach(workout => {
      // Extract distance and duration from tags
      const distanceTag = workout.tags.find(t => t[0] === 'distance');
      const durationTag = workout.tags.find(t => t[0] === 'duration');
      
      if (distanceTag && distanceTag[1]) {
        const distance = parseFloat(distanceTag[1]);
        const unit = distanceTag[2] || 'km';
        
        // Normalize to kilometers
        const distanceKm = unit === 'mi' ? distance * 1.609344 : distance;
        totalDistance += distanceKm;
        
        // Track member stats
        const memberPubkey = workout.pubkey;
        if (!memberStats.has(memberPubkey)) {
          memberStats.set(memberPubkey, { distance: 0, workouts: 0, duration: 0 });
        }
        const stats = memberStats.get(memberPubkey)!;
        stats.distance += distanceKm;
        stats.workouts += 1;
        
        // Parse duration if available
        if (durationTag && durationTag[1]) {
          const durationStr = durationTag[1];
          const durationSeconds = parseDurationToSeconds(durationStr);
          totalDuration += durationSeconds;
          stats.duration += durationSeconds;
        }
      }
    });

    // 5. Calculate average pace
    const averagePace = totalDuration > 0 && totalDistance > 0 
      ? (totalDuration / 60) / totalDistance // minutes per km
      : 0;

    // 6. Generate top performers
    const topPerformers = Array.from(memberStats.entries())
      .map(([pubkey, stats]) => ({
        pubkey,
        totalDistance: stats.distance,
        totalWorkouts: stats.workouts,
        averagePace: stats.duration > 0 && stats.distance > 0 
          ? (stats.duration / 60) / stats.distance 
          : 0
      }))
      .sort((a, b) => b.totalDistance - a.totalDistance)
      .slice(0, 10);

    // 7. Get recent activity (last 20 workouts)
    const recentActivity = memberWorkouts
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 20)
      .map(workout => ({
        id: workout.id,
        pubkey: workout.pubkey,
        created_at: workout.created_at,
        distance: workout.tags.find(t => t[0] === 'distance')?.[1] || '0',
        duration: workout.tags.find(t => t[0] === 'duration')?.[1] || '0:00:00'
      }));

    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalWorkouts: memberWorkouts.length,
      averagePace: Math.round(averagePace * 100) / 100,
      topPerformers,
      recentActivity
    };

  } catch (error) {
    console.error("Error calculating team statistics:", error);
    return { totalDistance: 0, totalWorkouts: 0, averagePace: 0, topPerformers: [], recentActivity: [] };
  }
}

/**
 * Get challenge progress based on tagged 1301 workout records
 * Uses challenge definition events and membership validation
 */
export async function getChallengeProgress(
  ndk: NDK,
  challengeUUID: string,
  teamUUID?: string
): Promise<{
  challengeInfo: any;
  participants: any[];
  totalProgress: number;
  goalProgress: number;
  isComplete: boolean;
}> {
  if (!ndk) {
    console.warn("NDK instance not provided to getChallengeProgress.");
    return { challengeInfo: null, participants: [], totalProgress: 0, goalProgress: 0, isComplete: false };
  }

  try {
    // 1. Get challenge definition
    const challengeFilter: NDKFilter = {
      kinds: [KIND_NIP101_TEAM_CHALLENGE as NDKKind],
      '#d': [challengeUUID],
      limit: 1
    };

    const challengeEvents = await ndk.fetchEvents(challengeFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    const challengeEvent = Array.from(challengeEvents)[0];
    
    if (!challengeEvent) {
      console.log(`Challenge ${challengeUUID} not found`);
      return { challengeInfo: null, participants: [], totalProgress: 0, goalProgress: 0, isComplete: false };
    }

    const challengeInfo = {
      uuid: challengeUUID,
      name: challengeEvent.tags.find(t => t[0] === 'name')?.[1] || 'Unnamed Challenge',
      description: challengeEvent.content,
      startTime: parseInt(challengeEvent.tags.find(t => t[0] === 'start_time')?.[1] || '0'),
      endTime: parseInt(challengeEvent.tags.find(t => t[0] === 'end_time')?.[1] || '0'),
      goalType: challengeEvent.tags.find(t => t[0] === 'goal_type')?.[1] || 'distance_total',
      goalValue: parseFloat(challengeEvent.tags.find(t => t[0] === 'goal_value')?.[1] || '0'),
      goalUnit: challengeEvent.tags.find(t => t[0] === 'goal_unit')?.[1] || 'km'
    };

    // 2. Query 1301 workout records with challenge tags
    const challengeWorkoutFilter: NDKFilter = {
      kinds: [KIND_WORKOUT_RECORD as NDKKind],
      '#challenge_uuid': [challengeUUID],
      limit: 1000
    };

    // Filter by challenge timeframe if specified
    if (challengeInfo.startTime > 0) challengeWorkoutFilter.since = challengeInfo.startTime;
    if (challengeInfo.endTime > 0) challengeWorkoutFilter.until = challengeInfo.endTime;

    console.log(`Fetching challenge progress for challenge ${challengeUUID}`);
    const workoutEvents = await ndk.fetchEvents(challengeWorkoutFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    
    const workouts = Array.from(workoutEvents).map(e => e.rawEvent() as NostrWorkoutEvent);

    // 3. Calculate participant progress
    const participantStats = new Map<string, { distance: number; workouts: number; lastActivity: number }>();

    workouts.forEach(workout => {
      const distanceTag = workout.tags.find(t => t[0] === 'distance');
      
      if (distanceTag && distanceTag[1]) {
        const distance = parseFloat(distanceTag[1]);
        const unit = distanceTag[2] || 'km';
        
        // Normalize to challenge goal unit
        let normalizedDistance = distance;
        if (challengeInfo.goalUnit === 'km' && unit === 'mi') {
          normalizedDistance = distance * 1.609344;
        } else if (challengeInfo.goalUnit === 'mi' && unit === 'km') {
          normalizedDistance = distance / 1.609344;
        }
        
        const participantPubkey = workout.pubkey;
        if (!participantStats.has(participantPubkey)) {
          participantStats.set(participantPubkey, { distance: 0, workouts: 0, lastActivity: 0 });
        }
        
        const stats = participantStats.get(participantPubkey)!;
        stats.distance += normalizedDistance;
        stats.workouts += 1;
        stats.lastActivity = Math.max(stats.lastActivity, workout.created_at);
      }
    });

    // 4. Format participants with rankings
    const participants = Array.from(participantStats.entries())
      .map(([pubkey, stats]) => ({
        pubkey,
        distance: Math.round(stats.distance * 100) / 100,
        workouts: stats.workouts,
        lastActivity: stats.lastActivity,
        progressPercent: challengeInfo.goalValue > 0 
          ? Math.min(100, (stats.distance / challengeInfo.goalValue) * 100)
          : 0
      }))
      .sort((a, b) => b.distance - a.distance);

    // 5. Calculate total progress
    const totalProgress = participants.reduce((sum, p) => sum + p.distance, 0);
    const goalProgress = challengeInfo.goalValue > 0 
      ? Math.min(100, (totalProgress / challengeInfo.goalValue) * 100)
      : 0;
    const isComplete = goalProgress >= 100;

    return {
      challengeInfo,
      participants,
      totalProgress: Math.round(totalProgress * 100) / 100,
      goalProgress: Math.round(goalProgress * 100) / 100,
      isComplete
    };

  } catch (error) {
    console.error("Error calculating challenge progress:", error);
    return { challengeInfo: null, participants: [], totalProgress: 0, goalProgress: 0, isComplete: false };
  }
}

/**
 * Helper function to parse duration string to seconds
 */
function parseDurationToSeconds(durationStr: string): number {
  if (!durationStr) return 0;
  
  // Handle HH:MM:SS format
  const parts = durationStr.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // Handle MM:SS format
  if (parts.length === 2) {
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  
  // Handle plain seconds
  return parseInt(durationStr) || 0;
}

// Team Event specific types
export interface TeamEventDetails {
  id: string;
  teamAIdentifier: string;
  name: string;
  description?: string; // Optional event description/notes
  activity: 'run' | 'walk' | 'cycle';
  distance: number; // in km
  date: string; // YYYY-MM-DD format
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  creatorPubkey: string;
  createdAt: number;
  participantCount?: number;
}

export interface EventParticipation {
  pubkey: string;
  workoutId: string;
  duration: number; // in seconds
  distance: number; // in km
  pace: number; // min/km for run/walk, km/h for cycle
  completedAt: number;
}

/**
 * Creates a new team event (KIND_NIP101_TEAM_EVENT)
 */
export async function createTeamEvent(
  ndk: NDK,
  eventData: {
    teamAIdentifier: string;
    name: string;
    description?: string;
    activity: 'run' | 'walk' | 'cycle';
    distance: number;
    date: string;
    startTime?: string;
    endTime?: string;
    creatorPubkey: string;
  }
): Promise<string | null> {
  if (!ndk) {
    console.error("NDK instance not provided to createTeamEvent.");
    return null;
  }

  const eventId = uuidv4();
  const tags = [
    ["d", eventId],
    ["a", eventData.teamAIdentifier],
    ["name", eventData.name],
    ["activity", eventData.activity],
    ["distance", eventData.distance.toString()],
    ["date", eventData.date]
  ];

  if (eventData.description) {
    tags.push(["description", eventData.description]);
  }
  if (eventData.startTime) {
    tags.push(["start_time", eventData.startTime]);
  }
  if (eventData.endTime) {
    tags.push(["end_time", eventData.endTime]);
  }

  const eventTemplate: EventTemplate = {
    kind: KIND_NIP101_TEAM_EVENT,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: `Team event: ${eventData.name} - ${eventData.distance}km ${eventData.activity} on ${eventData.date}`
  };

  try {
    const ndkEvent = new NDKEvent(ndk, { ...eventTemplate, pubkey: eventData.creatorPubkey });
    await ndkEvent.sign();
    const publishedRelays = await ndkEvent.publish();
    
    if (publishedRelays.size > 0) {
      console.log(`Team event created successfully: ${eventId}`);
      return eventId;
    } else {
      console.error("Failed to publish team event to any relays.");
      return null;
    }
  } catch (error) {
    console.error("Error creating team event:", error);
    return null;
  }
}

/**
 * Fetches all events for a team
 */
export async function fetchTeamEvents(
  ndk: NDK,
  teamAIdentifier: string
): Promise<TeamEventDetails[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchTeamEvents.");
    return [];
  }

  const filter: NDKFilter = {
    kinds: [KIND_NIP101_TEAM_EVENT as NDKKind],
    '#a': [teamAIdentifier],
    limit: 100
  };

  try {
    const eventsSet = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    const events = Array.from(eventsSet).map(ndkEvent => {
      const rawEvent = ndkEvent.rawEvent();
      const tags = rawEvent.tags;
      
      return {
        id: tags.find(t => t[0] === 'd')?.[1] || '',
        teamAIdentifier: teamAIdentifier,
        name: tags.find(t => t[0] === 'name')?.[1] || 'Unnamed Event',
        description: tags.find(t => t[0] === 'description')?.[1],
        activity: (tags.find(t => t[0] === 'activity')?.[1] || 'run') as 'run' | 'walk' | 'cycle',
        distance: parseFloat(tags.find(t => t[0] === 'distance')?.[1] || '0'),
        date: tags.find(t => t[0] === 'date')?.[1] || '',
        startTime: tags.find(t => t[0] === 'start_time')?.[1],
        endTime: tags.find(t => t[0] === 'end_time')?.[1],
        creatorPubkey: rawEvent.pubkey,
        createdAt: rawEvent.created_at
      };
    });

    // Sort by date (newest first)
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log(`Fetched ${events.length} events for team`);
    return events;
  } catch (error) {
    console.error("Error fetching team events:", error);
    return [];
  }
}

/**
 * Fetches participation data for a specific event
 */
export async function fetchEventParticipation(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string,
  eventDate: string
): Promise<EventParticipation[]> {
  if (!ndk) {
    console.warn("NDK instance not provided to fetchEventParticipation.");
    return [];
  }

  // Parse the team identifier to get team UUID
  const teamParts = teamAIdentifier.split(':');
  const teamUUID = teamParts[teamParts.length - 1];

  // Fetch workouts for the event date with team tag
  const startOfDay = new Date(eventDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(eventDate);
  endOfDay.setHours(23, 59, 59, 999);

  const filter: NDKFilter = {
    kinds: [KIND_WORKOUT_RECORD as NDKKind],
    '#team_uuid': [teamUUID],
    since: Math.floor(startOfDay.getTime() / 1000),
    until: Math.floor(endOfDay.getTime() / 1000),
    limit: 100
  };

  try {
    const workoutsSet = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
    const participation: EventParticipation[] = [];

    Array.from(workoutsSet).forEach(ndkEvent => {
      const workout = ndkEvent.rawEvent();
      const tags = workout.tags;
      
      // Extract workout data
      const distanceTag = tags.find(t => t[0] === 'distance');
      const durationTag = tags.find(t => t[0] === 'duration');
      const activityTag = tags.find(t => t[0] === 'activity');
      
      if (distanceTag && durationTag) {
        const distance = parseFloat(distanceTag[1]);
        const durationSeconds = parseDurationToSeconds(durationTag[1]);
        const activity = activityTag?.[1] || 'run';
        
        // Calculate pace
        let pace = 0;
        if (distance > 0 && durationSeconds > 0) {
          if (activity === 'cycle') {
            // For cycling: km/h
            pace = (distance / (durationSeconds / 3600));
          } else {
            // For run/walk: min/km
            pace = (durationSeconds / 60) / distance;
          }
        }

        participation.push({
          pubkey: workout.pubkey,
          workoutId: workout.id,
          duration: durationSeconds,
          distance: distance,
          pace: pace,
          completedAt: workout.created_at
        });
      }
    });

    console.log(`Found ${participation.length} participants for event ${eventId}`);
    return participation;
  } catch (error) {
    console.error("Error fetching event participation:", error);
    return [];
  }
}

/**
 * Updates an existing team event (KIND_NIP101_TEAM_EVENT)
 */
export async function updateTeamEvent(
  ndk: NDK,
  eventData: {
    eventId: string;
    teamAIdentifier: string;
    name: string;
    description?: string;
    activity: 'run' | 'walk' | 'cycle';
    distance: number;
    date: string;
    startTime?: string;
    endTime?: string;
    creatorPubkey: string;
  }
): Promise<string | null> {
  if (!ndk) {
    console.error("NDK instance not provided to updateTeamEvent.");
    return null;
  }

  const tags = [
    ["d", eventData.eventId], // Keep same event ID to update existing event
    ["a", eventData.teamAIdentifier],
    ["name", eventData.name],
    ["activity", eventData.activity],
    ["distance", eventData.distance.toString()],
    ["date", eventData.date]
  ];

  if (eventData.description) {
    tags.push(["description", eventData.description]);
  }
  if (eventData.startTime) {
    tags.push(["start_time", eventData.startTime]);
  }
  if (eventData.endTime) {
    tags.push(["end_time", eventData.endTime]);
  }

  const eventTemplate: EventTemplate = {
    kind: KIND_NIP101_TEAM_EVENT,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: `Team event: ${eventData.name} - ${eventData.distance}km ${eventData.activity} on ${eventData.date}`
  };

  try {
    const ndkEvent = new NDKEvent(ndk, { ...eventTemplate, pubkey: eventData.creatorPubkey });
    await ndkEvent.sign();
    const publishedRelays = await ndkEvent.publish();
    
    if (publishedRelays.size > 0) {
      console.log(`Team event updated successfully: ${eventData.eventId}`);
      return eventData.eventId;
    } else {
      console.error("Failed to publish updated team event to any relays.");
      return null;
    }
  } catch (error) {
    console.error("Error updating team event:", error);
    return null;
  }
}

/**
 * Join a team event - publishes a participation event
 */
export async function joinTeamEvent(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string,
  captainPubkey: string
): Promise<NDKEvent | null> {
  const eventTemplate = {
    kind: KIND_EVENT_PARTICIPATION as NDKKind,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', eventId], // Event identifier
      ['a', teamAIdentifier], // Team identifier
      ['e', eventId], // Event reference
      ['p', captainPubkey] // Captain reference
    ],
    content: 'Joined team event'
  };

  try {
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = eventTemplate.kind;
    ndkEvent.created_at = eventTemplate.created_at;
    ndkEvent.tags = eventTemplate.tags;
    ndkEvent.content = eventTemplate.content;
    
    await ndkEvent.sign();
    const publishedRelays = await ndkEvent.publish();
    
    if (publishedRelays.size > 0) {
      console.log(`Successfully joined event: ${eventId}`);
      return ndkEvent;
    } else {
      console.error("Failed to publish event participation to any relays.");
      return null;
    }
  } catch (error) {
    console.error("Error joining team event:", error);
    return null;
  }
}

/**
 * Leave a team event - publishes a withdrawal event
 */
export async function leaveTeamEvent(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string
): Promise<boolean> {
  const eventTemplate = {
    kind: KIND_EVENT_PARTICIPATION as NDKKind,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', eventId], // Event identifier
      ['a', teamAIdentifier], // Team identifier
      ['e', eventId], // Event reference
      ['status', 'withdrawn'] // Withdrawal marker
    ],
    content: 'Left team event'
  };

  try {
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = eventTemplate.kind;
    ndkEvent.created_at = eventTemplate.created_at;
    ndkEvent.tags = eventTemplate.tags;
    ndkEvent.content = eventTemplate.content;
    
    await ndkEvent.sign();
    const publishedRelays = await ndkEvent.publish();
    
    if (publishedRelays.size > 0) {
      console.log(`Successfully left event: ${eventId}`);
      return true;
    } else {
      console.error("Failed to publish event withdrawal to any relays.");
      return false;
    }
  } catch (error) {
    console.error("Error leaving team event:", error);
    return false;
  }
}

/**
 * Fetch event participants - returns list of pubkeys who joined the event
 */
export async function fetchEventParticipants(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string
): Promise<string[]> {
  const filter: NDKFilter = {
    kinds: [KIND_EVENT_PARTICIPATION as NDKKind],
    '#d': [eventId],
    '#a': [teamAIdentifier]
  };

  try {
    const events = await ndk.fetchEvents(filter);
    const participants = new Map<string, boolean>(); // pubkey -> is active participant

    // Process participation events chronologically
    const sortedEvents = Array.from(events).sort((a, b) => a.created_at - b.created_at);
    
    for (const event of sortedEvents) {
      const pubkey = event.pubkey;
      const isWithdrawal = event.tags.some(tag => tag[0] === 'status' && tag[1] === 'withdrawn');
      
      if (isWithdrawal) {
        participants.set(pubkey, false); // Mark as withdrawn
      } else {
        participants.set(pubkey, true); // Mark as joined
      }
    }

    // Return only active participants
    return Array.from(participants.entries())
      .filter(([, isActive]) => isActive)
      .map(([pubkey]) => pubkey);

  } catch (error) {
    console.error('Error fetching event participants:', error);
    return [];
  }
}

/**
 * Check if current user is participating in an event
 */
export async function isUserParticipating(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string,
  userPubkey: string
): Promise<boolean> {
  const participants = await fetchEventParticipants(ndk, eventId, teamAIdentifier);
  return participants.includes(userPubkey);
}


/**
 * Fetch event activities - returns kind 1301 events from participants during event period
 */
export async function fetchEventActivities(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string,
  participantPubkeys: string[],
  startDate: string,
  endDate?: string
): Promise<NDKEvent[]> {
  if (participantPubkeys.length === 0) {
    return [];
  }

  // Calculate date range
  const eventStartTime = Math.floor(new Date(startDate).getTime() / 1000);
  const eventEndTime = endDate 
    ? Math.floor(new Date(endDate).getTime() / 1000)
    : Math.floor(new Date(startDate).setHours(23, 59, 59, 999) / 1000);

  const filter: NDKFilter = {
    kinds: [KIND_WORKOUT_RECORD as NDKKind],
    authors: participantPubkeys,
    since: eventStartTime,
    until: eventEndTime
    // Note: Removed '#team' filter to capture all activities during event period
    // Activities don't need to be explicitly tagged with the team to count for the event
  };

  try {
    const events = await ndk.fetchEvents(filter);
    return Array.from(events).sort((a, b) => b.created_at - a.created_at);
  } catch (error) {
    console.error('Error fetching event activities:', error);
    return [];
  }
} 