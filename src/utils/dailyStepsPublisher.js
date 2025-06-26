import { ndk } from '../lib/ndkSingleton';
import { NostrEvent } from '@nostr-dev-kit/ndk';
import { getTodayKey } from './dailyStepStorage';

/**
 * Create a NIP101e (kind 1301) event for daily step count
 * @param {Object} stepData - Step data object
 * @param {number} stepData.steps - Total steps for the day
 * @param {number} stepData.goal - Daily step goal
 * @param {string} stepData.date - Date in YYYY-MM-DD format
 * @param {Object} options - Publishing options
 * @returns {Object} Nostr event
 */
export const createDailyStepsEvent = (stepData, options = {}) => {
  const { steps, goal, date } = stepData;
  const {
    includeProgress = true,
    includeGoal = true,
    customTags = []
  } = options;

  // Build tags array for NIP101e workout event
  const tags = [
    ['t', 'dailysteps'], // General hashtag
    ['t', 'steps'],      // Activity type
    ['t', 'walking'],    // Related activity
    ['activity', 'daily-steps'], // Activity type tag
    ['date', date],      // Date tag
    ['steps', steps.toString()], // Step count
    ['source', 'runstr'] // App identifier
  ];

  // Add goal if requested
  if (includeGoal && goal) {
    tags.push(['goal', goal.toString()]);
  }

  // Add progress percentage if requested
  if (includeProgress && goal) {
    const progress = Math.round((steps / goal) * 100);
    tags.push(['progress', progress.toString()]);
  }

  // Add custom tags
  if (customTags.length > 0) {
    tags.push(...customTags);
  }

  // Create human-readable content
  const progressText = goal ? ` (${Math.round((steps / goal) * 100)}% of ${goal.toLocaleString()} goal)` : '';
  const content = `Daily Steps: ${steps.toLocaleString()} steps${progressText} on ${date} 🚶‍♀️`;

  // Create the event object
  const eventData = {
    kind: 1301, // NIP101e workout event kind
    created_at: Math.floor(Date.now() / 1000),
    content,
    tags
  };

  return eventData;
};

/**
 * Publish daily steps to Nostr as a NIP101e event
 * @param {Object} stepData - Step data object
 * @param {Object} options - Publishing options
 * @returns {Promise<Object>} Publishing result
 */
export const publishDailySteps = async (stepData, options = {}) => {
  try {
    // Ensure NDK is ready
    if (!ndk) {
      throw new Error('NDK not initialized');
    }

    // Wait for NDK to be ready
    await ndk.connect();

    if (!ndk.signer) {
      throw new Error('No signer available. Please connect your Nostr account.');
    }

    // Create the event
    const eventData = createDailyStepsEvent(stepData, options);
    const ndkEvent = new NostrEvent(ndk, eventData);

    // Sign the event
    await ndkEvent.sign();

    // Publish to relays
    const relayResults = await ndkEvent.publish();

    // Convert relay results to a more readable format
    const publishResults = {
      success: true,
      eventId: ndkEvent.id,
      event: ndkEvent,
      relayResults: Array.from(relayResults).map(relay => ({
        url: relay.url,
        status: 'published' // NDK doesn't provide detailed status in the set
      })),
      timestamp: new Date().toISOString()
    };

    console.log('Daily steps published successfully:', publishResults);
    return publishResults;

  } catch (error) {
    console.error('Error publishing daily steps:', error);
    
    const errorResult = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };

    return errorResult;
  }
};

/**
 * Publish current daily steps (convenience function)
 * @param {Object} options - Publishing options
 * @returns {Promise<Object>} Publishing result
 */
export const publishCurrentDailySteps = async (options = {}) => {
  try {
    // Import here to avoid circular dependencies
    const { dailyStepCounter } = await import('../services/DailyStepCounterService');
    
    // Get current step data
    const stepData = dailyStepCounter.getDailySteps();
    
    if (stepData.steps === 0) {
      throw new Error('No steps to publish today');
    }

    return await publishDailySteps(stepData, options);
  } catch (error) {
    console.error('Error publishing current daily steps:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Publish a milestone achievement
 * @param {Object} milestoneData - Milestone data from the service
 * @param {Object} options - Publishing options
 * @returns {Promise<Object>} Publishing result
 */
export const publishStepMilestone = async (milestoneData, options = {}) => {
  try {
    const { milestone, steps, goal, date } = milestoneData;
    
    // Create step data with milestone context
    const stepData = { steps, goal, date };
    
    // Add milestone-specific tags
    const milestoneOptions = {
      ...options,
      customTags: [
        ['milestone', milestone.toString()],
        ['achievement', 'step-milestone'],
        ...(options.customTags || [])
      ]
    };

    return await publishDailySteps(stepData, milestoneOptions);
  } catch (error) {
    console.error('Error publishing step milestone:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get publishing history for daily steps (last N days)
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of published step events
 */
export const getDailyStepsPublishHistory = async (days = 7) => {
  try {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }

    await ndk.connect();

    const user = ndk.getUser();
    if (!user || !user.pubkey) {
      throw new Error('User not available');
    }

    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    const since = now - (days * 24 * 60 * 60);

    // Create filter for daily step events
    const filter = {
      kinds: [1301], // NIP101e workout events
      authors: [user.pubkey],
      since,
      '#activity': ['daily-steps']
    };

    // Fetch events
    const events = await ndk.fetchEvents(filter);
    
    // Process and sort events
    const stepEvents = Array.from(events)
      .filter(event => {
        // Additional filtering to ensure these are daily step events
        const activityTag = event.tags.find(tag => tag[0] === 'activity' && tag[1] === 'daily-steps');
        const stepsTag = event.tags.find(tag => tag[0] === 'steps');
        return activityTag && stepsTag;
      })
      .map(event => {
        // Extract data from tags
        const stepsTag = event.tags.find(tag => tag[0] === 'steps');
        const goalTag = event.tags.find(tag => tag[0] === 'goal');
        const dateTag = event.tags.find(tag => tag[0] === 'date');
        const progressTag = event.tags.find(tag => tag[0] === 'progress');
        const milestoneTag = event.tags.find(tag => tag[0] === 'milestone');

        return {
          id: event.id,
          steps: stepsTag ? parseInt(stepsTag[1], 10) : 0,
          goal: goalTag ? parseInt(goalTag[1], 10) : null,
          date: dateTag ? dateTag[1] : null,
          progress: progressTag ? parseInt(progressTag[1], 10) : null,
          milestone: milestoneTag ? parseInt(milestoneTag[1], 10) : null,
          content: event.content,
          createdAt: event.created_at,
          event
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Most recent first

    return stepEvents;
  } catch (error) {
    console.error('Error fetching daily steps publish history:', error);
    return [];
  }
}; 