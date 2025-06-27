/**
 * Feed post processing utility for RUNSTR
 * Provides lightweight processing methods for faster initial display
 * without sacrificing existing rich functionality
 */

/**
 * Lightweight post processor for initial fast display
 * Creates minimal post objects with placeholders for supplementary data
 * @param {Array} posts - Raw post events from Nostr
 * @param {string} filterSource - Optional filter for specific app source ('RUNSTR' for RUNSTR-only posts)
 * @param {string} activityMode - Optional activity mode filter ('running', 'cycling', 'walking')
 * @returns {Array} Minimally processed posts ready for display
 */
export const lightweightProcessPosts = (posts, filterSource = null, activityMode = null) => {
  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  // Apply RUNSTR filtering if specified
  let filteredPosts = posts;
  if (filterSource && filterSource.toUpperCase() === 'RUNSTR') {
    filteredPosts = posts.filter(event => {
      // RUNSTR signature requirements based on createWorkoutEvent
      const hasRequiredTags = {
        source: false,
        client: false,
        workoutId: false,
        title: false,
        exercise: false,
        distance: false,
        duration: false
      };
      
      // Check each tag for RUNSTR's signature
      for (const tag of event.tags || []) {
        switch (tag[0]) {
          case 'source':
            if (tag[1]?.toUpperCase() === 'RUNSTR') {
              hasRequiredTags.source = true;
            }
            break;
          case 'client':
            if (tag[1]?.toLowerCase() === 'runstr') {
              hasRequiredTags.client = true;
            }
            break;
          case 'd':
            if (tag[1] && typeof tag[1] === 'string' && tag[1].length > 0) {
              hasRequiredTags.workoutId = true;
            }
            break;
          case 'title':
            if (tag[1] && typeof tag[1] === 'string' && tag[1].length > 0) {
              hasRequiredTags.title = true;
            }
            break;
          case 'exercise':
            if (tag[1]) {
              const activity = tag[1].toLowerCase();
              if (['running', 'cycling', 'walking', 'jogging'].includes(activity)) {
                hasRequiredTags.exercise = true;
              }
            }
            break;
          case 'distance':
            if (tag[1] && tag[2]) {
              hasRequiredTags.distance = true;
            }
            break;
          case 'duration':
            if (tag[1] && typeof tag[1] === 'string' && tag[1].length > 0) {
              hasRequiredTags.duration = true;
            }
            break;
        }
      }
      
      // Must have RUNSTR source identification (source OR client)
      const hasRunstrIdentification = hasRequiredTags.source || hasRequiredTags.client;
      
      // Must have core RUNSTR workout structure
      const hasRunstrStructure = hasRequiredTags.workoutId && 
                                hasRequiredTags.title && 
                                hasRequiredTags.exercise && 
                                hasRequiredTags.distance && 
                                hasRequiredTags.duration;
      
      const isRunstrWorkout = hasRunstrIdentification && hasRunstrStructure;
      
      // Add activity mode filter (same logic as useRunFeed)
      if (isRunstrWorkout && activityMode) {
        const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
        const eventActivityType = exerciseTag?.[1]?.toLowerCase();
        
        // More lenient activity matching - include variations
        const activityMatches = {
          'run': ['run', 'running', 'jog', 'jogging'],     // Handle both 'run' and 'running'
          'cycle': ['cycle', 'cycling', 'bike', 'biking'], // Handle both 'cycle' and 'cycling'  
          'walk': ['walk', 'walking', 'hike', 'hiking']    // Handle both 'walk' and 'walking'
        };
        
        const acceptedActivities = activityMatches[activityMode] || [activityMode];
        
        // Skip events that don't match current activity mode
        if (eventActivityType && !acceptedActivities.includes(eventActivityType)) {
          return false;
        }
        
        // If no exercise tag but is RUNSTR workout, allow it through (fallback)
        // No need to log here as this is lightweight processing
      }
      
      // Debug logging for rejected events in lightweight processor
      if (!isRunstrWorkout && (hasRequiredTags.source || hasRequiredTags.client)) {
        console.log('[feedProcessor] Event has RUNSTR tags but missing signature:', {
          eventId: event.id,
          hasRunstrIdentification,
          hasRunstrStructure,
          missing: Object.entries(hasRequiredTags).filter(([key, value]) => !value).map(([key]) => key)
        });
      }
      
      return isRunstrWorkout;
    });
    
    if (filteredPosts.length !== posts.length) {
      console.log(`[feedProcessor] Filtered posts in lightweight processor: ${posts.length} → ${filteredPosts.length} posts`);
    }
  }
  
  // Extract just the essential data for display
  return filteredPosts.map(post => {
    const workoutTitleTag = post.tags?.find(tag => tag[0] === 'title');
    const workoutTitle = workoutTitleTag ? workoutTitleTag[1] : 'Workout Record';

    const metrics = [];
    const distanceTag = post.tags?.find(tag => tag[0] === 'distance');
    if (distanceTag && distanceTag[1]) {
      metrics.push({
        label: "Distance",
        value: distanceTag[1],
        unit: distanceTag[2] || '',
        // icon: <TrendingUp className="h-3 w-3" /> // Placeholder, requires import
      });
    }

    const durationTag = post.tags?.find(tag => tag[0] === 'duration');
    if (durationTag && durationTag[1]) {
      metrics.push({
        label: "Duration",
        value: durationTag[1],
        unit: durationTag[2] || '',
        // icon: <Timer className="h-3 w-3" /> // Placeholder, requires import
      });
    }
    
    // Potentially parse NIP-101e exercise tag for more detailed metrics
    // Example: ["exercise", "running", "10", "km", "00:55:00", "05:30 min/km"]
    const exerciseTag = post.tags?.find(tag => tag[0] === 'exercise');
    if (exerciseTag && exerciseTag.length >= 3) {
      // Assuming structure: ["exercise", type, val1, unit1, val2, unit2, ...]
      // This is a simplified example; more robust parsing would be needed for NIP-101e
      if (exerciseTag[2] && exerciseTag[3] && metrics.length < 3) { // Add if not already from distance/duration specific tags
          if (!metrics.find(m => m.label.toLowerCase() === exerciseTag[0])) { // crude check to avoid duplicate distance
            metrics.push({ label: exerciseTag[3], value: exerciseTag[2], unit: '', /* icon: ... */ });
          }
      }
      if (exerciseTag[4] && exerciseTag[5] && metrics.length < 3) {
         if (!metrics.find(m => m.label.toLowerCase() === exerciseTag[0])) { // crude check to avoid duplicate duration
            metrics.push({ label: exerciseTag[5], value: exerciseTag[4], unit: '', /* icon: ... */ });
          }
      }
       if (exerciseTag[6] && exerciseTag[7] && metrics.length < 3) {
            metrics.push({ label: exerciseTag[7], value: exerciseTag[6], unit: '', /* icon: ... */ });
      }
    }


    return {
      id: post.id || `post-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      kind: post.kind, // Pass through the event kind
      title: workoutTitle, // Add workout title
      content: post.content || '',
      created_at: post.created_at || Math.floor(Date.now() / 1000),
      pubkey: post.pubkey || '',
      author: {
        pubkey: post.pubkey || '',
        profile: { 
          name: undefined,
          picture: undefined
        }
      },
      metrics: metrics, // Add extracted metrics
      tags: post.tags || [], // Pass through all tags for potential use later
      // Basic placeholders for UI that will be filled in later
      comments: [],
      showComments: false,
      commentsLoaded: false,
      likes: 0,
      reposts: 0,
      zaps: 0,
      zapAmount: 0,
      images: extractImagesFromContent(post.content || ''), // May be less relevant for Kind 1301
      _needsEnrichment: true, // Flag for background enhancement
      needsProfile: true // Explicitly mark that we still need to fetch author profile
    }
  }).sort((a, b) => b.created_at - a.created_at);
};

/**
 * Extract image URLs from post content
 * @param {string} content - Post content
 * @returns {Array} Array of image URLs
 */
const extractImagesFromContent = (content) => {
  if (!content) return [];
  
  // Simple regex to find image URLs in content
  const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
  return content.match(urlRegex) || [];
};

/**
 * Merge basic posts with fully processed ones
 * Replaces basic data with enriched data while preserving post order
 * @param {Array} basicPosts - Posts with basic processing
 * @param {Array} fullyProcessedPosts - Posts with complete supplementary data
 * @returns {Array} Merged posts array
 */
export const mergeProcessedPosts = (basicPosts, fullyProcessedPosts) => {
  if (!fullyProcessedPosts || !Array.isArray(fullyProcessedPosts) || fullyProcessedPosts.length === 0) {
    return basicPosts;
  }
  
  if (!basicPosts || !Array.isArray(basicPosts) || basicPosts.length === 0) {
    return fullyProcessedPosts;
  }
  
  // Create map for quick lookup by ID
  const processedMap = new Map(
    fullyProcessedPosts.map(post => [post.id, post])
  );
  
  // Replace basic posts with processed ones where available
  return basicPosts.map(post => 
    processedMap.has(post.id) ? processedMap.get(post.id) : post
  );
};

/**
 * Update individual post with enriched data
 * @param {Object} basicPost - Basic post object
 * @param {Object} enrichedData - Enriched data for the post
 * @returns {Object} Updated post
 */
export const enrichPost = (basicPost, enrichedData) => {
  if (!basicPost || !enrichedData) return basicPost;
  
  // Return merged data, keeping the original post's ID and content
  return {
    ...basicPost,
    ...enrichedData,
    id: basicPost.id, // Ensure ID is preserved
    content: basicPost.content, // Ensure content is preserved
    _needsEnrichment: false
  };
}; 