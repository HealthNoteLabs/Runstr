import { useState, useEffect, useCallback } from 'react';
import {
  NostrTeamEvent,
  fetchPublicTeams, 
  getTeamName,
  getTeamDescription,
  getTeamCaptain,
  getTeamUUID,
  KIND_FITNESS_TEAM 
} from '../services/nostr/NostrTeamsService';
import { useNostr } from './useNostr'; 

export interface ProcessedNip101Team {
  id: string; 
  nip101eKind: number; 
  name: string;
  description: string;
  captainPubkey: string;
  teamUUID: string;
  isPublic: boolean; 
  originalEvent: NostrTeamEvent;
}

export const useNip101TeamsFeed = () => {
  const [teams, setTeams] = useState<ProcessedNip101Team[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { ndk: ndkFromContext, ndkReady, ndkError: ndkErrorFromContext } = useNostr();

  const processFetchedTeams = (fetchedTeams: NostrTeamEvent[]): ProcessedNip101Team[] => {
    return fetchedTeams.map(event => ({
      id: event.id,
      nip101eKind: event.kind,
      name: getTeamName(event),
      description: getTeamDescription(event),
      captainPubkey: getTeamCaptain(event),
      teamUUID: getTeamUUID(event) || '', 
      isPublic: event.tags.some(tag => tag[0] === 'public' && tag[1] === 'true'), 
      originalEvent: event,
    })).filter(team => team.teamUUID && team.captainPubkey); 
  };

  const loadTeams = useCallback(async (ndkInstance: any) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("useNip101TeamsFeed: Fetching public NIP-101e teams...");
      const fetchedEvents = await fetchPublicTeams(ndkInstance); 
      const processed = processFetchedTeams(fetchedEvents);
      setTeams(processed);
      if (processed.length === 0) {
        console.log("useNip101TeamsFeed: No public NIP-101e teams found.");
      }
    } catch (err: any) {
      console.error("useNip101TeamsFeed: Error fetching teams:", err);
      setError(err.message || "Failed to load NIP-101e teams feed.");
    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    let isMounted = true;

    const initializeAndFetch = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      setTeams([]);

      console.log("useNip101TeamsFeed: Checking NDK readiness...");
      
      if (!ndkReady) {
        console.log("useNip101TeamsFeed: NDK not ready, waiting for context to be ready...");
        setError("Connecting to Nostr relays...");
        setIsLoading(false);
        return;
      }

      if (ndkReady && ndkFromContext) {
        if (isMounted) {
           console.log("useNip101TeamsFeed: NDK is ready. Loading teams.");
           loadTeams(ndkFromContext);
        }
      } else {
        console.warn("useNip101TeamsFeed: NDK not ready after all checks or NDK instance missing.");
        if (isMounted) {
          setError(ndkErrorFromContext || "Could not connect to Nostr relays for teams feed.");
          setIsLoading(false);
        }
      }
    };

    initializeAndFetch();
    
    return () => {
      isMounted = false;
    };
  }, [ndkFromContext, ndkReady, ndkErrorFromContext, loadTeams]);

  return { teams, isLoading, error, refetchTeams: () => loadTeams(ndkFromContext) };
}; 