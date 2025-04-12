import React, { useEffect, useState, useContext } from 'react';
import { TeamsContext } from '../contexts/TeamsContext';
import { isNIP29Enabled, enableNIP29 } from '../utils/enableNIP29';

/**
 * Component to display NIP29 status and enable/disable it
 */
const NIP29Status = () => {
  const [enabled, setEnabled] = useState(false);
  const { toggleNostrIntegration } = useContext(TeamsContext);
  
  useEffect(() => {
    // Check if NIP29 is enabled
    setEnabled(isNIP29Enabled());
  }, []);
  
  // Handle enabling/disabling NIP29
  const handleToggle = () => {
    const newStatus = !enabled;
    enableNIP29(newStatus);
    setEnabled(newStatus);
    
    // Update context if available
    if (toggleNostrIntegration) {
      toggleNostrIntegration(newStatus);
    } else {
      // Refresh the page to apply changes if context not available
      window.location.reload();
    }
  };
  
  return (
    <div className="nip29-status bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium text-white">NIP29 Groups</h3>
        <div className="flex items-center">
          <span className="mr-2 text-sm text-gray-300">
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
      
      <p className="text-sm text-gray-400">
        {enabled ? 
          'NIP29 group discovery is enabled. You can view and join Nostr groups.' : 
          'NIP29 group discovery is disabled. Enable to discover and join Nostr groups.'}
      </p>
      
      {!enabled && (
        <button 
          className="mt-2 py-1 px-3 bg-blue-600 text-white text-sm rounded"
          onClick={() => {
            enableNIP29(true);
            setEnabled(true);
            window.location.reload();
          }}
        >
          Enable NIP29 Groups
        </button>
      )}
    </div>
  );
};

export default NIP29Status; 