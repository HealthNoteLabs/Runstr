/**
 * EventNotificationService
 * 
 * Handles notifications for team event participation requests.
 * Sends notifications to team captains when users request to join events.
 */

import { NDKEvent } from '@nostr-dev-kit/ndk';

// Nostr kinds
const KIND_JOIN_REQUEST = 31001; // Custom kind for join requests
const KIND_DIRECT_MESSAGE = 4; // Standard DM kind
const KIND_FITNESS_TEAM = 33404; // NIP-101e Team Kind

/**
 * Send join request notification to team captain
 * This creates a notification event that the captain can see
 */
export async function sendJoinRequestNotification(ndk, {
  eventId,
  eventName,
  teamAIdentifier,
  captainPubkey,
  requesterPubkey,
  requesterName = null
}) {
  if (!ndk || !eventId || !captainPubkey || !requesterPubkey) {
    throw new Error('Missing required parameters for join request notification');
  }

  try {
    console.log(`[EventNotificationService] Sending join request notification for event ${eventId}`);

    // Create notification event (Kind 31001)
    const notificationEvent = new NDKEvent(ndk);
    notificationEvent.kind = KIND_JOIN_REQUEST;
    notificationEvent.tags = [
      ['d', `${eventId}:${requesterPubkey}`], // Unique identifier
      ['p', captainPubkey], // Recipient (captain)
      ['p', requesterPubkey], // Requester
      ['e', eventId], // Event reference
      ['a', teamAIdentifier], // Team reference
      ['request_type', 'event_join'],
      ['event_name', eventName || 'Team Event']
    ];
    notificationEvent.content = JSON.stringify({
      type: 'event_join_request',
      eventId,
      eventName: eventName || 'Team Event',
      requesterPubkey,
      requesterName: requesterName || 'Team Member',
      timestamp: Date.now(),
      message: `${requesterName || 'A team member'} wants to join the event "${eventName || 'Team Event'}"`
    });
    notificationEvent.created_at = Math.floor(Date.now() / 1000);

    await notificationEvent.publish();
    console.log(`[EventNotificationService] Join request notification sent to captain ${captainPubkey}`);
    
    return notificationEvent;
  } catch (error) {
    console.error('[EventNotificationService] Error sending join request notification:', error);
    throw error;
  }
}

/**
 * Send direct message notification to captain (alternative/backup method)
 */
export async function sendDirectMessageNotification(ndk, {
  eventId,
  eventName,
  captainPubkey,
  requesterName = null
}) {
  if (!ndk || !captainPubkey) {
    throw new Error('Missing required parameters for DM notification');
  }

  try {
    console.log(`[EventNotificationService] Sending DM notification to captain ${captainPubkey}`);

    const message = `🏃‍♂️ EVENT JOIN REQUEST\n\n${requesterName || 'A team member'} wants to join the event "${eventName || 'Team Event'}".\n\nOpen the Runstr app to approve or deny this request.`;

    const dmEvent = new NDKEvent(ndk);
    dmEvent.kind = KIND_DIRECT_MESSAGE;
    dmEvent.tags = [
      ['p', captainPubkey]
    ];
    dmEvent.content = message;
    dmEvent.created_at = Math.floor(Date.now() / 1000);

    // Note: DMs require encryption in a real implementation
    // This is a simplified version for demonstration
    await dmEvent.publish();
    
    console.log(`[EventNotificationService] DM notification sent to captain`);
    return dmEvent;
  } catch (error) {
    console.error('[EventNotificationService] Error sending DM notification:', error);
    throw error;
  }
}

/**
 * Get team members from a team event for targeted queries
 * Fetches the team event and extracts member pubkeys from 'member' tags
 */
async function getEventTeamMembers(ndk, captainPubkey, teamUUID) {
  if (!ndk || !captainPubkey || !teamUUID) {
    console.warn('[EventNotificationService] Missing parameters for team member lookup');
    return [];
  }

  try {
    console.log(`[EventNotificationService] Fetching team members for team ${teamUUID} by captain ${captainPubkey}`);

    // Query for the team event (Kind 33404)
    const filter = {
      kinds: [KIND_FITNESS_TEAM],
      authors: [captainPubkey],
      '#d': [teamUUID] // d-tag identifies the specific team
    };

    const events = await ndk.fetchEvents(filter);
    console.log(`[EventNotificationService] Found ${events.size} team events`);

    if (events.size === 0) {
      console.log('[EventNotificationService] No team event found, returning empty member list');
      return [];
    }

    // Get the most recent team event
    const sortedEvents = Array.from(events).sort((a, b) => b.created_at - a.created_at);
    const latestTeam = sortedEvents[0];

    // Extract team members from 'member' tags
    const members = [];
    for (const tag of latestTeam.tags) {
      if (tag[0] === 'member' && tag[1]) {
        members.push(tag[1]);
      }
    }

    console.log(`[EventNotificationService] Found ${members.length} team members:`, members);
    return members;
  } catch (error) {
    console.error('[EventNotificationService] Error fetching team members:', error);
    return [];
  }
}

/**
 * Fetch join request notifications for a captain (OPTIMIZED)
 * Uses team member targeting to query only from known team members instead of globally
 */
export async function fetchJoinRequestNotifications(ndk, captainPubkey, eventId = null, teamUUID = null) {
  if (!ndk || !captainPubkey) {
    console.warn('[EventNotificationService] Missing parameters for fetching notifications');
    return [];
  }

  try {
    console.log(`[EventNotificationService] Fetching join requests for captain ${captainPubkey}`);
    
    let useTargetedQuery = false;
    let teamMemberPubkeys = [];

    // OPTIMIZATION: Try team member targeted query first if we have team context
    if (teamUUID) {
      try {
        teamMemberPubkeys = await getEventTeamMembers(ndk, captainPubkey, teamUUID);
        if (teamMemberPubkeys.length > 0) {
          useTargetedQuery = true;
          console.log(`[EventNotificationService] Using team member targeted query with ${teamMemberPubkeys.length} members`);
        } else {
          console.log('[EventNotificationService] No team members found, falling back to global query');
        }
      } catch (teamError) {
        console.warn('[EventNotificationService] Team member lookup failed, falling back to global query:', teamError.message);
      }
    }

    // Build query filter
    const filter = {
      kinds: [KIND_JOIN_REQUEST],
      '#p': [captainPubkey],
      '#request_type': ['event_join']
    };

    // OPTIMIZATION: Use authors field for targeted query instead of global search
    if (useTargetedQuery) {
      filter.authors = teamMemberPubkeys;
      console.log('[EventNotificationService] Querying join requests from team members only');
    } else {
      console.log('[EventNotificationService] Using global join request query (fallback)');
    }

    // If specific event, filter by event ID
    if (eventId) {
      filter['#e'] = [eventId];
    }

    const events = await ndk.fetchEvents(filter);
    console.log(`[EventNotificationService] Found ${events.size} join request notifications (${useTargetedQuery ? 'targeted' : 'global'} query)`);

    const notifications = Array.from(events).map(event => {
      try {
        // Validate event structure
        if (!event || !event.id || !event.content || !Array.isArray(event.tags)) {
          console.warn('[EventNotificationService] Invalid event structure:', event?.id);
          return null;
        }
        
        // Parse and validate content
        let content;
        try {
          content = JSON.parse(event.content);
        } catch (jsonError) {
          console.warn('[EventNotificationService] Invalid JSON content in notification:', event.id);
          return null;
        }
        
        if (!content || typeof content !== 'object') {
          console.warn('[EventNotificationService] Invalid content object in notification:', event.id);
          return null;
        }
        
        // Helper function to safely extract tag values
        const getTagValue = (tagType, excludeValue = null) => {
          try {
            const tag = event.tags.find(t => 
              Array.isArray(t) && 
              t.length >= 2 && 
              t[0] === tagType && 
              t[1] && 
              t[1] !== excludeValue
            );
            return tag ? tag[1] : null;
          } catch (err) {
            console.warn(`[EventNotificationService] Error extracting ${tagType} tag:`, err);
            return null;
          }
        };
        
        // Extract and validate required fields
        const eventId = getTagValue('e');
        const requesterPubkey = getTagValue('p', captainPubkey);
        
        // Validate required fields
        if (!eventId || !requesterPubkey) {
          console.warn('[EventNotificationService] Missing required fields in notification:', {
            eventId, 
            requesterPubkey,
            notificationId: event.id
          });
          return null;
        }
        
        // Validate pubkey format (basic hex check)
        if (!/^[a-fA-F0-9]{64}$/.test(requesterPubkey)) {
          console.warn('[EventNotificationService] Invalid requester pubkey format:', requesterPubkey);
          return null;
        }
        
        // Validate timestamp
        const timestamp = content.timestamp || event.created_at * 1000;
        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);
        
        if (timestamp < oneYearAgo || timestamp > oneYearFromNow) {
          console.warn('[EventNotificationService] Notification timestamp outside reasonable bounds:', {
            timestamp: new Date(timestamp),
            notificationId: event.id
          });
        }
        
        return {
          id: event.id,
          eventId,
          eventName: getTagValue('event_name') || content.eventName || 'Unknown Event',
          requesterPubkey,
          teamAIdentifier: getTagValue('a') || content.teamAIdentifier || '',
          timestamp,
          message: content.message || 'Join request notification',
          requesterName: content.requesterName || 'Unknown User',
          rawEvent: event
        };
      } catch (parseError) {
        console.warn('[EventNotificationService] Failed to parse notification:', parseError);
        return null;
      }
    }).filter(Boolean);

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => b.timestamp - a.timestamp);

    console.log(`[EventNotificationService] Returning ${notifications.length} processed notifications`);
    return notifications;
  } catch (error) {
    console.error('[EventNotificationService] Error fetching join request notifications:', error);
    return [];
  }
}

/**
 * Mark a join request notification as processed
 */
export async function markNotificationProcessed(ndk, notificationId, action = 'processed') {
  try {
    console.log(`[EventNotificationService] Marking notification ${notificationId} as ${action}`);
    
    // In a full implementation, we might publish a "response" event
    // For now, we just log the action
    console.log(`[EventNotificationService] Notification ${notificationId} marked as ${action}`);
    
    return true;
  } catch (error) {
    console.error('[EventNotificationService] Error marking notification as processed:', error);
    return false;
  }
}

export default {
  sendJoinRequestNotification,
  sendDirectMessageNotification,
  fetchJoinRequestNotifications,
  markNotificationProcessed
};