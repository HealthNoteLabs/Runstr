import { useState, useContext } from 'react';
import { TeamsContext } from '../contexts/TeamsContext';
import { NostrContext } from '../contexts/NostrContext';

/**
 * TeamSettings component for configuring club options
 */
export const TeamSettings = () => {
  const { 
    nostrIntegrationEnabled, 
    toggleNostrIntegration,
    error
  } = useContext(TeamsContext);
  
  const { publicKey, requestNostrPermissions } = useContext(NostrContext);
  
  const [isTogglingNostr, setIsTogglingNostr] = useState(false);
  
  /**
   * Handle toggling Nostr integration
   */
  const handleToggleNostr = async () => {
    try {
      setIsTogglingNostr(true);
      
      // If enabling and we don't have Nostr permissions, request them
      if (!nostrIntegrationEnabled && !publicKey) {
        const success = await requestNostrPermissions();
        if (!success) {
          throw new Error('Nostr permissions are required for integration');
        }
      }
      
      // Toggle the integration
      toggleNostrIntegration(!nostrIntegrationEnabled);
    } catch (error) {
      console.error('Error toggling Nostr integration:', error);
    } finally {
      setIsTogglingNostr(false);
    }
  };
  
  return (
    <div className="team-settings p-4 bg-gray-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Club Settings</h2>
      
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      
      <div className="space-y-4">
        {/* Nostr Integration Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
          <div>
            <h3 className="font-medium">Nostr Integration</h3>
            <p className="text-sm text-gray-400">
              {nostrIntegrationEnabled 
                ? 'Clubs are synchronized with Nostr NIP29 groups' 
                : 'Clubs are centralized only'}
            </p>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={nostrIntegrationEnabled}
              onChange={handleToggleNostr}
              disabled={isTogglingNostr}
              className="sr-only peer"
            />
            <div className={`w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600`}></div>
          </label>
        </div>
        
        {/* Nostr Status */}
        <div className="p-3 bg-gray-700/50 rounded-lg">
          <h3 className="font-medium">Nostr Authentication</h3>
          <p className="text-sm text-gray-400 mt-1">
            {publicKey 
              ? 'Connected with Nostr' 
              : 'Not connected with Nostr'}
          </p>
          
          {!publicKey && (
            <button
              onClick={requestNostrPermissions}
              className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md"
            >
              Connect Nostr
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>
          Enabling Nostr integration allows your clubs to interoperate with other 
          Nostr clients using NIP29 groups. This provides decentralized access to your clubs.
        </p>
      </div>
    </div>
  );
}; 