import React, { useState } from 'react';
import { useCaptainNotifications } from '../../hooks/useCaptainNotifications';
import { DisplayName } from '../shared/DisplayName';
import toast from 'react-hot-toast';

/**
 * CaptainNotificationsModal
 * 
 * Modal for team captains to view and manage join request notifications.
 * Shows pending join requests and allows approve/deny actions.
 */
const CaptainNotificationsModal = ({ 
  isOpen, 
  onClose, 
  captainPubkey, 
  eventId = null, 
  eventName = null,
  teamUUID = null 
}) => {
  const [processingId, setProcessingId] = useState(null);
  
  const {
    notifications,
    unreadCount,
    isCurrentUserCaptain,
    isLoading,
    error,
    approveJoinRequest,
    denyJoinRequest,
    refresh
  } = useCaptainNotifications(captainPubkey, eventId, teamUUID);

  if (!isOpen) return null;

  const handleApprove = async (notification) => {
    setProcessingId(notification.id);
    try {
      await approveJoinRequest(notification);
      toast.success(`Approved ${notification.requesterName || 'user'} to join the event!`);
    } catch (error) {
      console.error('Error approving join request:', error);
      toast.error('Failed to approve join request. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (notification) => {
    setProcessingId(notification.id);
    try {
      await denyJoinRequest(notification);
      toast.success('Join request denied');
    } catch (error) {
      console.error('Error denying join request:', error);
      toast.error('Failed to deny join request. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isCurrentUserCaptain) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-black rounded-lg max-w-md w-full border border-white">
          <div className="p-6 text-center">
            <h2 className="text-xl font-bold text-white mb-4">Access Denied</h2>
            <p className="text-gray-300 mb-4">Only team captains can view join requests.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-black rounded-lg font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white">
        <div className="p-6 border-b border-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">Join Requests</h2>
              {eventName && (
                <p className="text-gray-300 text-sm mt-1">for {eventName}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full font-bold">
                  {unreadCount}
                </span>
              )}
              <button
                onClick={refresh}
                disabled={isLoading}
                className="text-white hover:text-gray-300 transition-colors"
                title="Refresh notifications"
              >
                <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoading && notifications.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-300">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-400 mb-4">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-red-400 mb-4">Error loading notifications</p>
              <p className="text-gray-400 text-sm mb-4">{error}</p>
              <button
                onClick={refresh}
                className="px-4 py-2 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m-2 0V9a2 2 0 012-2h2m0 0V6a2 2 0 012-2h6a2 2 0 012 2v1m2 0h2a2 2 0 012 2v4m-6 0v1a2 2 0 01-2 2H9a2 2 0 01-2-2v-1m6 0h-6m6 0v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1m6 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.5" />
                </svg>
              </div>
              <p className="text-gray-300 mb-2">No join requests</p>
              <p className="text-gray-400 text-sm">
                {eventName ? 
                  `No one has requested to join "${eventName}" yet.` :
                  'No pending join requests for your events.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div key={notification.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {notification.requesterName?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <DisplayName 
                            pubkey={notification.requesterPubkey} 
                            className="font-semibold text-white"
                          />
                          <p className="text-gray-400 text-sm">wants to join</p>
                        </div>
                      </div>
                      
                      <div className="ml-13">
                        <p className="text-white font-semibold">{notification.eventName}</p>
                        <p className="text-gray-400 text-sm">
                          {new Date(notification.timestamp).toLocaleDateString()} at{' '}
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleDeny(notification)}
                        disabled={processingId === notification.id}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === notification.id ? '...' : 'Deny'}
                      </button>
                      <button
                        onClick={() => handleApprove(notification)}
                        disabled={processingId === notification.id}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === notification.id ? '...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-6 border-t border-gray-700 text-center">
            <p className="text-gray-400 text-sm">
              Approved users will be added to the official participant list.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptainNotificationsModal;