import React from 'react';
import runDataService from '../../services/RunDataService';
import { createWorkoutEvent, createAndPublishEvent } from '../../utils/nostr';
import { displayDistance } from '../../utils/formatters';
import { Button } from "@/components/ui/button";

/**
 * A simple full-screen modal presenting the synced run summary and two buttons:
 * 1) Save Locally  2) Save & Post to Nostr.
 *
 * Props:
 * - isOpen        : boolean
 * - onClose        : () => void
 * - run            : object (already mapped Run object)
 * - distanceUnit   : 'km' | 'mi'
 * - publicKey      : string | undefined – needed for streak utils
 */
export const SyncConfirmationModal = ({ isOpen, onClose, run, distanceUnit = 'km', publicKey }) => {
  if (!isOpen || !run) return null;

  const handleSave = async (postToNostr = false) => {
    // Save the run first
    const savedRun = runDataService.saveRun(run, publicKey);

    // Optionally publish
    if (postToNostr && savedRun) {
      try {
        // Use publishRun() for consistent team/challenge association logic
        const { publishRun } = await import('../../utils/runPublisher');
        const results = await publishRun(savedRun, distanceUnit, {});
        
        // Check if the summary (kind 1301) was successfully published
        const summaryResult = results.find(r => r.kind === 1301);
        if (summaryResult && summaryResult.success && summaryResult.result?.id) {
          runDataService.updateRun(savedRun.id, { nostrWorkoutEventId: summaryResult.result.id });
        }
      } catch (err) {
        console.error('[SyncModal] Failed to publish to Nostr', err);
        if (window.Android?.showToast) {
          window.Android.showToast('Failed to post workout to Nostr');
        }
      }
    }

    if (window.Android?.showToast) {
      window.Android.showToast('Run saved successfully');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-gray-900 w-full max-w-sm rounded-lg p-6 text-white relative">
        <h3 className="subsection-heading mb-4 text-center">New Run Synced</h3>

        <div className="space-y-2 text-sm mb-6">
          <div><span className="text-gray-400">Distance:</span> {displayDistance(run.distance, distanceUnit)}</div>
          <div><span className="text-gray-400">Duration:</span> {runDataService.formatTime(run.duration)}</div>
          {run.estimatedTotalSteps != null && (
            <div><span className="text-gray-400">Steps:</span> {run.estimatedTotalSteps}</div>
          )}
        </div>

        <div className="flex flex-col space-y-3">
          <Button onClick={() => handleSave(false)} variant="default" size="default">Save Locally</Button>
          <Button onClick={() => handleSave(true)} variant="success" size="default">Save & Post to Nostr</Button>
          <Button onClick={onClose} variant="ghost" size="sm">Cancel</Button>
        </div>
      </div>
    </div>
  );
}; 