import { nip98 } from 'nostr-tools';

// todo: move this to env variables
const WAVLAKE_CATALOG_API_BASE_URL = 'https://catalog.wavlake.com/v1';
const WAVLAKE_API_BASE_URL = 'https://wavlake.com/api/v1';

// Constants for playlist types
export const PLAYLIST = 'playlist';
export const TOP_40 = 'top-40';
export const TRENDING_ROCK_PLAYLIST_ID = 'trending-rock';
export const TRENDING_HIPHOP_PLAYLIST_ID = 'trending-hiphop';
export const LIKED = 'liked';

/**
 * Base fetch function with headers and error handling
 */
const fetchWithHeaders = async (endpoint, options = {}) => {
  try {
    const url = `${WAVLAKE_API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

/**
 * Fetch trending tracks filtered by genre
 */
export const fetchTrendingPlaylistByGenre = async (genre) => {
  try {
    const data = await fetchWithHeaders(
      `/content/rankings?sort=sats&days=7&genre=${genre}&limit=40`
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return [];
  }
};

export const fetchTrendingRock = async () => {
  const playlist = await fetchTrendingPlaylistByGenre('rock');

  return { id: TRENDING_ROCK_PLAYLIST_ID, title: 'Rock', tracks: playlist };
};

export const fetchTrendingHipHop = async () => {
  const playlist = await fetchTrendingPlaylistByGenre('hip-hop');

  return {
    id: TRENDING_HIPHOP_PLAYLIST_ID,
    title: 'Hip-Hop',
    tracks: playlist
  };
};

/**
 * Fetch Top 40 tracks
 */
export const fetchTop40 = async () => {
  try {
    const data = await fetchWithHeaders(
      `/content/rankings?sort=sats&days=7&limit=40`
    );
    const tracks = Array.isArray(data) ? data : [];
    return { id: TOP_40, title: 'Top 40', tracks };
  } catch (error) {
    console.error('Error fetching top40:', error);
    throw error;
  }
};

/**
 * Get track metadata by ID
 */
export const getTrackById = async (trackId) => {
  try {
    const data = await fetchWithHeaders(`/content/track/${trackId}`);
    return data;
  } catch (error) {
    console.error('Error fetching track:', error);
    throw error;
  }
};

/**
 * Get stream URL for a track
 */
export const getTrackStreamUrl = (trackId) => {
  if (!trackId) return null;
  return `/api/v1/stream/track/${trackId}`;
};

/**
 * Search for content
 */
export const searchContent = async (term) => {
  try {
    const data = await fetchWithHeaders(
      `/content/search?term=${encodeURIComponent(term)}`
    );
    return data;
  } catch (error) {
    console.error('Error searching content:', error);
    throw error;
  }
};

export const fetchLibraryPlaylists = async (pubkey) => {
  return fetch(`${WAVLAKE_CATALOG_API_BASE_URL}/playlists/user/${pubkey}`)
    .then((res) => res.json())
    .then((res) => res.data);
};

/**
 * Get liked playlist using NIP-98 auth and NIP-88 format
 */
export const fetchLikedPlaylist = async () => {
  const url = `${WAVLAKE_CATALOG_API_BASE_URL}/library/tracks`;

  try {
    // Ensure Nostr is connected before trying to fetch liked tracks
    if (!window.nostr) {
      throw new Error('Nostr extension not found. Please log in first to access your liked tracks.');
    }

    // Get the signature for authentication
    const authToken = await nip98.getToken(
      url,
      'get',
      (event) => window.nostr.signEvent(event),
      true
    ).catch(err => {
      console.error('Error getting Nostr signature:', err);
      throw new Error('Failed to authenticate with Nostr: ' + (err.message || 'Unknown error'));
    });

    // Fetch the liked tracks
    const res = await fetch(url, {
      headers: {
        Authorization: authToken
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch liked tracks: ${res.status} ${res.statusText}`);
    }

    const jsonResponse = await res.json();
    if (!jsonResponse.data || !jsonResponse.data.tracks) {
      throw new Error('Invalid response format from server');
    }

    const tracks = jsonResponse.data.tracks;

    // Ensure each track has required fields
    const validatedTracks = tracks.map(track => {
      // Add default mediaUrl if missing
      if (!track.mediaUrl && track.id) {
        track.mediaUrl = `${WAVLAKE_API_BASE_URL}/stream/track/${track.id}`;
      }
      return track;
    });

    return {
      id: LIKED,
      title: 'Liked',
      tracks: validatedTracks,
      isPrivate: true
    };
  } catch (error) {
    console.error('Error fetching liked playlist:', error);
    throw error;
  }
};

export const fetchPlaylistById = async (playlistId) => {
  try {
    const response = await fetch(
      `${WAVLAKE_API_BASE_URL}/content/playlist/${playlistId}`
    );
    
    if (!response.ok) {
      const error = new Error(`Failed to fetch playlist: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }
    
    const data = await response.json();
    
    // Ensure the playlist has the expected structure
    if (!data.tracks || !Array.isArray(data.tracks)) {
      throw new Error('Invalid playlist data format');
    }
    
    // Add missing mediaUrls if needed
    const tracksWithUrls = data.tracks.map(track => {
      if (!track.mediaUrl && track.id) {
        track.mediaUrl = `${WAVLAKE_API_BASE_URL}/stream/track/${track.id}`;
      }
      return track;
    });
    
    return { 
      id: playlistId, 
      ...data, 
      tracks: tracksWithUrls 
    };
  } catch (error) {
    console.error(`Error fetching playlist ${playlistId}:`, error);
    throw error;
  }
};

export const fetchPlaylist = async (playlistId) => {
  console.log(`Fetching playlist: ${playlistId}`);
  
  try {
    switch (playlistId) {
      case TOP_40:
        return fetchTop40();
      case TRENDING_ROCK_PLAYLIST_ID:
        return fetchTrendingRock();
      case TRENDING_HIPHOP_PLAYLIST_ID:
        return fetchTrendingHipHop();
      case LIKED:
        return fetchLikedPlaylist();
      default:
        return fetchPlaylistById(playlistId);
    }
  } catch (error) {
    console.error(`Error in fetchPlaylist for ${playlistId}:`, error);
    throw error;
  }
};
