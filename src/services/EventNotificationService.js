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
 * Fetch join request notifications for a captain
 */
export async function fetchJoinRequestNotifications(ndk, captainPubkey, eventId = null) {
  if (!ndk || !captainPubkey) {
    console.warn('[EventNotificationService] Missing parameters for fetching notifications');
    return [];
  }

  try {
    console.log(`[EventNotificationService] Fetching join requests for captain ${captainPubkey}`);

    const filter = {
      kinds: [KIND_JOIN_REQUEST],
      '#p': [captainPubkey],
      '#request_type': ['event_join']
    };

    // If specific event, filter by event ID
    if (eventId) {
      filter['#e'] = [eventId];
    }

    const events = await ndk.fetchEvents(filter);
    console.log(`[EventNotificationService] Found ${events.size} join request notifications`);

    const notifications = Array.from(events).map(event => {
      try {
        const content = JSON.parse(event.content);
        return {
          id: event.id,
          eventId: event.tags.find(t => t[0] === 'e')?.[1],
          eventName: event.tags.find(t => t[0] === 'event_name')?.[1],
          requesterPubkey: event.tags.find(t => t[0] === 'p' && t[1] !== captainPubkey)?.[1],
          teamAIdentifier: event.tags.find(t => t[0] === 'a')?.[1],
          timestamp: content.timestamp || event.created_at * 1000,
          message: content.message,
          requesterName: content.requesterName,
          rawEvent: event
        };
      } catch (parseError) {
        console.warn('[EventNotificationService] Failed to parse notification content:', parseError);
        return null;
      }
    }).filter(Boolean);

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => b.timestamp - a.timestamp);

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