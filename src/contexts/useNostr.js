import { useContext } from 'react';
import { NostrContext } from './NostrContext';

export const useNostr = () => {
  try {
    const context = useContext(NostrContext);
    console.log("useNostr hook called, context:", !!context, "publicKey:", context?.publicKey);
    
    if (context === undefined) {
      console.warn("useNostr: NostrContext is undefined, you might not be inside a NostrProvider");
      // Return a minimal fallback object to prevent errors in components
      return { publicKey: null, isNostrReady: false };
    }
    
    return context;
  } catch (error) {
    console.error("useNostr hook error:", error);
    // Return fallback to prevent app crashes
    return { publicKey: null, isNostrReady: false };
  }
}; 