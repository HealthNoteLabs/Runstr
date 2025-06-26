import React, { useState, useCallback } from 'react';
import { useDailySteps } from '../hooks/useDailySteps';
import { publishCurrentDailySteps, publishStepMilestone } from '../utils/dailyStepsPublisher';
import appToast from '../utils/toast';

export const DailyStepsProgressBanner = () => {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { 
    steps, 
    goal, 
    progress, 
    isEnabled, 
    isRunning, 
    isPausedForSpeed,
    milestones,
    dismissMilestone,
    clearMilestones
  } = useDailySteps();

  // Handle banner click - show quick actions
  const handleBannerClick = useCallback(() => {
    setShowQuickActions(!showQuickActions);
  }, [showQuickActions]);

  // Handle publish to Nostr with real NIP101e publishing
  const handlePublishToNostr = useCallback(async () => {
    if (isPublishing) return;
    
    setIsPublishing(true);
    
    try {
      const result = await publishCurrentDailySteps({
        includeProgress: true,
        includeGoal: true
      });

      if (result.success) {
        appToast.success(`Daily steps published to Nostr! Event ID: ${result.eventId.slice(0, 8)}...`);
        console.log('Published daily steps:', result);
      } else {
        appToast.error(`Failed to publish: ${result.error}`);
        console.error('Publishing failed:', result);
      }
    } catch (error) {
      appToast.error(`Publishing error: ${error.message}`);
      console.error('Publishing error:', error);
    } finally {
      setIsPublishing(false);
      setShowQuickActions(false);
    }
  }, [isPublishing]);

  // Handle milestone publishing
  const handlePublishMilestone = useCallback(async (milestoneData) => {
    if (isPublishing) return;
    
    setIsPublishing(true);
    
    try {
      const result = await publishStepMilestone(milestoneData);

      if (result.success) {
        appToast.success(`Milestone published! ${milestoneData.milestone.toLocaleString()} steps achievement shared 🎉`);
        dismissMilestone(milestoneData.id);
      } else {
        appToast.error(`Failed to publish milestone: ${result.error}`);
      }
    } catch (error) {
      appToast.error(`Milestone publishing error: ${error.message}`);
      console.error('Milestone publishing error:', error);
    } finally {
      setIsPublishing(false);
    }
  }, [isPublishing, dismissMilestone]);

  // Handle milestone dismissal
  const handleDismissMilestone = useCallback((milestoneId) => {
    dismissMilestone(milestoneId);
  }, [dismissMilestone]);

  // Don't render if daily step counter is not enabled
  if (!isEnabled) {
    return null;
  }

  // Determine progress state for styling
  const getProgressState = () => {
    if (progress >= 100) return 'completed';
    if (progress >= 80) return 'near-completion';
    if (progress >= 50) return 'halfway';
    return 'starting';
  };

  const progressState = getProgressState();
  
  // Format step count with commas
  const formatSteps = (stepCount) => {
    return stepCount.toLocaleString();
  };

  // Get progress bar color based on state
  const getProgressBarColor = () => {
    switch (progressState) {
      case 'completed': return 'bg-green-500';
      case 'near-completion': return 'bg-yellow-500';
      case 'halfway': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  // Show active milestone if available
  const activeMilestone = milestones.length > 0 ? milestones[milestones.length - 1] : null;

  return (
    <div className="w-full bg-bg-secondary border-b border-border-secondary">
      {/* Main Banner */}
      <div 
        className="px-4 py-3 cursor-pointer hover:bg-bg-tertiary transition-colors duration-200"
        onClick={handleBannerClick}
      >
        <div className="flex items-center justify-between">
          {/* Step Count and Progress */}
          <div className="flex items-center space-x-3">
            <span className="text-lg">🚶‍♀️</span>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-text-primary">
                  {formatSteps(steps)} / {formatSteps(goal)} steps
                </span>
                {isPausedForSpeed && (
                  <span className="text-xs text-yellow-500 bg-yellow-100 px-2 py-1 rounded">
                    ⏸️ Paused
                  </span>
                )}
                {progressState === 'completed' && (
                  <span className="text-xs text-green-500">🎉 Goal reached!</span>
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="mt-1 w-full max-w-[200px] h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${getProgressBarColor()}`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-xs text-text-secondary">
              {Math.round(progress)}%
            </span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${showQuickActions ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      {showQuickActions && (
        <div className="px-4 py-3 bg-bg-tertiary border-t border-border-secondary">
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              Daily Progress: {formatSteps(steps)} steps
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handlePublishToNostr}
                disabled={isPublishing || steps === 0}
                className="px-3 py-1 text-xs bg-primary hover:bg-primary-hover disabled:bg-gray-400 disabled:cursor-not-allowed text-text-primary rounded-md transition-colors duration-200"
              >
                {isPublishing ? 'Publishing...' : 'Share Progress'}
              </button>
              <button
                onClick={() => setShowQuickActions(false)}
                className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-primary text-text-secondary rounded-md transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Celebration */}
      {activeMilestone && (
        <div className="px-4 py-2 bg-green-50 border-t border-green-200 dark:bg-green-900 dark:border-green-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🎉</span>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Milestone reached: {formatSteps(activeMilestone.milestone)} steps!
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePublishMilestone(activeMilestone)}
                disabled={isPublishing}
                className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-md transition-colors duration-200"
              >
                {isPublishing ? 'Sharing...' : 'Share'}
              </button>
              <button
                onClick={() => handleDismissMilestone(activeMilestone.id)}
                className="px-2 py-1 text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 