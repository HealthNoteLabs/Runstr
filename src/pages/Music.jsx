import { useEffect, useMemo, useRef, useState, useContext } from 'react';
import {
  fetchLibraryPlaylists,
  fetchTop40,
  fetchTrendingHipHop,
  fetchTrendingRock
} from '../utils/wavlake';
import { PlaylistSection } from '../components/PlaylistSection';
import { MusicPlayer } from '../components/MusicPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSettings } from '../contexts/SettingsContext';
import { NostrContext } from '../contexts/NostrContext';
import { getAllTracks, getTracksFromServer, DEFAULT_SERVERS, setDebugCallback } from '../lib/blossom';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export function Music() {
  const hasMounted = useRef(false);
  const { loadPlaylist, currentTrack } = useAudioPlayer();
  const { blossomEndpoint } = useSettings();
  const { publicKey, ndk } = useContext(NostrContext);

  const [pubkey, setPubkey] = useState(null);

  const [top40, setTop40] = useState();
  const [trendingRockPlaylist, setTrendingRockPlaylist] = useState();
  const [trendingHipHopPlaylist, setTrendingHipHopPlaylist] = useState();

  const [libraryPlaylists, setLibraryPlaylists] = useState();
  
  // Blossom-related state
  const [blossomTracks, setBlossomTracks] = useState([]);
  const [blossomLoading, setBlossomLoading] = useState(false);
  const [blossomError, setBlossomError] = useState(null);
  
  // Debug logging state - TEMPORARY FOR DEBUGGING
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  
  const addDebugLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, { timestamp, message, type }]);
  };
  
  const clearDebugLogs = () => {
    setDebugLogs([]);
  };
  
  // Set up debug callback for blossom.js
  useEffect(() => {
    setDebugCallback(addDebugLog);
    return () => setDebugCallback(null);
  }, []);

  useEffect(() => {
    window.nostr
      .getPublicKey()
      .then((pk) => {
        setPubkey(pk);
      })
      .catch((err) => {
        console.error(err);
      });

    const handleAuthEvent = (event) => {
      if (event.detail.type === 'login') {
        setPubkey(event.detail.pubkey);
      }

      if (event.detail.type === 'logout') {
        setPubkey(null);
      }
    };

    document.addEventListener('nlAuth', handleAuthEvent);

    return () => {
      document.removeEventListener('nlAuth', handleAuthEvent);
    };
  }, []);

  useEffect(() => {
    if (hasMounted.current) return;

    hasMounted.current = true;

    fetchTop40()
      .then((playlist) => {
        setTop40(playlist);
      })
      .catch((err) => {
        console.error('top40 error: ', err);
      });

    fetchTrendingRock()
      .then((playlist) => {
        setTrendingRockPlaylist(playlist);
      })
      .catch((err) => {
        console.error('trending rock error: ', err);
      });

    fetchTrendingHipHop()
      .then((playlist) => {
        setTrendingHipHopPlaylist(playlist);
      })
      .catch((err) => {
        console.error('trending hiphop error: ', err);
      });
  }, []);

  useEffect(() => {
    if (pubkey) {
      fetchLibraryPlaylists(pubkey)
        .then((playlists) => {
          setLibraryPlaylists(playlists);
          console.log('library playlists :>> ', playlists);
        })
        .catch((err) => {
          console.error('error fetching library playlists', err);
        });
    } else {
      setLibraryPlaylists();
    }
  }, [pubkey]);

  // Load Blossom tracks when server URL is available
  useEffect(() => {
    const loadBlossomTracks = async () => {
      if (!pubkey) {
        addDebugLog('❌ No pubkey available - user may not be logged in', 'error');
        return;
      }
      
      setBlossomLoading(true);
      setBlossomError(null);
      clearDebugLogs();
      
      addDebugLog(`🔑 Using pubkey: ${pubkey.substring(0, 8)}...${pubkey.substring(-8)}`, 'info');
      addDebugLog(`🌐 Blossom endpoint setting: ${blossomEndpoint || 'Search All Servers'}`, 'info');
      
      // Check if authentication is available (NDK signer, window.nostr, or stored keys)
      try {
        const hasNdkSigner = !!(ndk && ndk.signer);
        const hasWindowNostr = !!(window && window.nostr && window.nostr.signEvent);
        const hasStoredKey = !!(localStorage.getItem('runstr_privkey') || localStorage.getItem('nostr-key'));
        
        const authAvailable = hasNdkSigner || hasWindowNostr || hasStoredKey;
        addDebugLog(`🔐 Authentication available: ${authAvailable ? 'Yes' : 'No (authentication will fail!)'}`, authAvailable ? 'success' : 'error');
        
        if (hasNdkSigner) {
          addDebugLog('✅ NDK signer available (Amber or private key)', 'success');
        } else if (hasWindowNostr) {
          addDebugLog('✅ Browser extension signer available', 'success');
        } else if (hasStoredKey) {
          addDebugLog('✅ Stored private key available', 'success');
        } else {
          addDebugLog('⚠️ No authentication method found - Blossom servers require authentication', 'error');
          addDebugLog('💡 Try logging in with Amber, browser extension, or private key', 'info');
        }
      } catch (authError) {
        addDebugLog(`❌ Error checking authentication: ${authError.message}`, 'error');
        addDebugLog('⚠️ No authentication method available - Blossom servers require authentication', 'error');
      }

      try {
        let tracks = [];
        
        if (blossomEndpoint && blossomEndpoint !== '') {
          // Load tracks from specific server
          addDebugLog(`🎯 Loading tracks from specific server: ${blossomEndpoint}`, 'info');
          tracks = await getTracksFromServer(blossomEndpoint, pubkey);
          addDebugLog(`📊 Server returned ${tracks.length} tracks`, tracks.length > 0 ? 'success' : 'warning');
        } else {
          // Load tracks from all default servers
          addDebugLog('🌍 Loading tracks from all default servers', 'info');
          tracks = await getAllTracks(DEFAULT_SERVERS, pubkey);
          addDebugLog(`📊 All servers returned ${tracks.length} total tracks`, tracks.length > 0 ? 'success' : 'warning');
        }
        
        setBlossomTracks(tracks);
        addDebugLog(`✅ Final result: ${tracks.length} tracks loaded into UI`, 'success');
        
        // Log some sample tracks for debugging
        if (tracks.length > 0) {
          tracks.slice(0, 3).forEach((track, i) => {
            addDebugLog(`🎵 Sample track ${i + 1}: "${track.title}" from ${track.server}`, 'info');
          });
        }
        
      } catch (error) {
        console.error('[Music] Error loading tracks:', error);
        const errorMsg = `Error loading tracks: ${error.message}`;
        setBlossomError(errorMsg);
        addDebugLog(`❌ ${errorMsg}`, 'error');
        setBlossomTracks([]);
      } finally {
        setBlossomLoading(false);
      }
    };

    loadBlossomTracks();
  }, [blossomEndpoint, pubkey]);

  const handleSelectPlaylist = (playlistId) => {
    loadPlaylist(playlistId);
  };

  const handleSelectBlossomLibrary = () => {
    // Create a virtual playlist for Blossom tracks
    const blossomPlaylist = {
      id: 'blossom',
      title: 'My Blossom Library',
      tracks: blossomTracks
    };
    
    // Load the Blossom playlist using the new signature
    loadPlaylist('blossom', blossomPlaylist);
  };

  const trendingPlaylists = useMemo(
    () =>
      [top40, trendingRockPlaylist, trendingHipHopPlaylist].filter(
        (pl) => pl !== undefined
      ),
    [top40, trendingRockPlaylist, trendingHipHopPlaylist]
  );

  const userPlaylists = useMemo(() => {
    const playlists = [];
    if (libraryPlaylists) playlists.push(...libraryPlaylists);

    return playlists;
  }, [libraryPlaylists]);

  // Create a virtual playlist object for Blossom library with server-specific naming
  const blossomPlaylistDisplay = useMemo(() => {
    if (blossomTracks.length === 0) return [];
    
    // Extract server name from endpoint for dynamic naming
    const getServerDisplayName = (endpoint) => {
      if (!endpoint || endpoint === '') return 'Blossom';
      
      const url = endpoint.toLowerCase();
      if (url.includes('blossom.band')) return 'Blossom.Band';
      if (url.includes('satellite.earth')) return 'Satellite.Earth';
      if (url.includes('primal.net')) return 'Primal Blossom';
      if (url.includes('nostrcheck.me')) return 'NostrCheck';
      if (url.includes('nostpic.com')) return 'Nostpic';
      if (url.includes('void.cat')) return 'Void.Cat';
      
      // Extract domain name as fallback
      try {
        const domain = new URL(endpoint).hostname;
        return domain.charAt(0).toUpperCase() + domain.slice(1);
      } catch {
        return 'Blossom';
      }
    };
    
    const serverName = getServerDisplayName(blossomEndpoint);
    const playlistTitle = blossomEndpoint && blossomEndpoint !== '' 
      ? `${serverName} Playlist`
      : 'Blossom Music Library';
    
    const description = `${blossomTracks.length} tracks`;
    
    return [{
      id: 'blossom',
      title: playlistTitle,
      description: description,
      tracks: blossomTracks
    }];
  }, [blossomEndpoint, blossomTracks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Music</h1>
        
        {/* DEBUG PANEL - TEMPORARY FOR DEBUGGING */}
        {showDebugLogs && (
          <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-600">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-yellow-400">🔧 Debug Logs (Temporary)</h3>
              <div className="space-x-2">
                <button 
                  onClick={clearDebugLogs}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                >
                  Clear
                </button>
                <button 
                  onClick={() => setShowDebugLogs(false)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto bg-gray-900 rounded p-3 font-mono text-sm">
              {debugLogs.length === 0 ? (
                <div className="text-gray-400">No logs yet...</div>
              ) : (
                debugLogs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`mb-1 ${
                      log.type === 'error' ? 'text-red-400' : 
                      log.type === 'success' ? 'text-green-400' : 
                      log.type === 'warning' ? 'text-yellow-400' : 
                      'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {!showDebugLogs && (
          <div className="mb-4">
            <button 
              onClick={() => setShowDebugLogs(true)}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-sm"
            >
              🔧 Show Debug Logs
            </button>
          </div>
        )}

        {currentTrack && <MusicPlayer />}

        <PlaylistSection
          title="Trending"
          playlists={trendingPlaylists}
          handlePlaylistClick={handleSelectPlaylist}
        />
        
        {/* Blossom Library Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-left">Blossom Music Library</h2>
          {blossomLoading && (
            <div className="text-gray-400 text-left mb-4">
              {blossomEndpoint && blossomEndpoint !== '' 
                ? `Loading tracks from ${blossomEndpoint}...`
                : 'Searching for audio tracks across Blossom servers...'
              }
            </div>
          )}
          {blossomError && (
            <div className="text-red-400 text-left mb-4">
              Error loading tracks: {blossomError}
            </div>
          )}
          {!blossomLoading && !blossomError && blossomTracks.length === 0 && (
            <div className="text-gray-400 text-left mb-4">
              {blossomEndpoint && blossomEndpoint !== '' 
                ? `No audio files found on ${blossomEndpoint}.`
                : 'No audio files found on Blossom servers. Try uploading some audio files to your Blossom server or check the console for detailed logs.'
              }
            </div>
          )}
          {blossomPlaylistDisplay.length > 0 && (
            <PlaylistSection
              title=""
              playlists={blossomPlaylistDisplay}
              handlePlaylistClick={handleSelectBlossomLibrary}
            />
          )}
        </div>
        
        <PlaylistSection
          title="Library"
          playlists={userPlaylists}
          handlePlaylistClick={handleSelectPlaylist}
        />
      </div>
    </div>
  );
}
