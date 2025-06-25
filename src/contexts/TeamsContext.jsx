import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';

// Create context
export const TeamsContext = createContext();

// Custom hook for using Teams context
export const useTeams = () => {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error('useTeams must be used within a TeamsProvider');
  }
  return context;
};

export const TeamsProvider = ({ children }) => {
  // Get Nostr context state - This is now the source of truth
  const { 
      publicKey: nostrPublicKey, 
      canReadData, // Use this for read operations instead of isInitialized
      ndk // Use the NDK instance from NostrContext
  } = useContext(NostrContext);
  
  // State for Nostr groups fetched via NDK
  const [myNostrGroups, setMyNostrGroups] = useState([]);
  const [loadingNostrGroups, setLoadingNostrGroups] = useState(false);
  
  // General state
  const [error, setError] = useState(null);

  // Fetch groups using NDK when NostrContext is ready
  useEffect(() => {
    const fetchNdkGroups = async () => {
      // Only require NDK connection for reading team data, not user pubkey
      if (!canReadData) {
        console.log('TeamsContext: NDK not ready for data reading, clearing groups.');
        setMyNostrGroups([]);
        return;
      }

      // For user-specific operations (like fetching "my" groups), check for pubkey
      if (!nostrPublicKey) {
        console.log('TeamsContext: No user pubkey available for user-specific groups, setting empty array.');
        setMyNostrGroups([]);
        return;
      }

      console.log('TeamsContext: NDK ready for data reading, fetching user groups for pubkey:', nostrPublicKey);
      setLoadingNostrGroups(true);
      setError(null);
      
      try {
        // TODO: Replace with NDK-based group list fetching (e.g., Kind 30001)
        // This likely involves ndk.fetchEvents(...) with appropriate filters
        // For now, just log and set empty array
        console.warn('TeamsContext: NDK Group list fetching (Kind 30001) not implemented yet.');
        // Example placeholder:
        // const filter = { kinds: [30001], authors: [nostrPublicKey], '#d': ['groups'] };
        // const listEvent = await ndk.fetchEvent(filter);
        // if (listEvent) { 
        //    const groupTags = listEvent.tags.filter(t => t[0] === 'a' && t[1]?.startsWith('39000:')); 
        //    setMyNostrGroups(groupTags); // Store the raw tags or fetch metadata
        // } else { setMyNostrGroups([]); }
        setMyNostrGroups([]); // Placeholder

      } catch (err) {
        console.error('TeamsContext: Error fetching NDK groups:', err);
        setError('Failed to fetch Nostr groups using NDK.');
        setMyNostrGroups([]);
      } finally {
        setLoadingNostrGroups(false);
      }
    };

    fetchNdkGroups();
    // Depend on the readiness flags from NostrContext
  }, [nostrPublicKey, canReadData]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context value - provide NDK-based state
  const value = {
    myNostrGroups, // Will be populated by NDK fetch
    loadingNostrGroups,
    error,
    clearError,
    canReadData // Pass down the flag from NostrContext
  };

  return (
    <TeamsContext.Provider value={value}>
      {children}
    </TeamsContext.Provider>
  );
};

TeamsProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 