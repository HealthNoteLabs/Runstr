// Define the Track interface
export interface Track {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  artistId: string;
  duration: number;
  mediaUrl: string;
}

export const getLikedTracks = async (pubkey: string): Promise<Track[]> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/likes/${pubkey}`
    );

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.artist_name,
      artwork: track.artwork,
      artistId: track.artist_id,
      duration: track.duration,
      // Add mediaUrl field for audio playback
      mediaUrl: `${process.env.NEXT_PUBLIC_API_URL}/v1/stream/track/${track.id}`
    }));
  } catch (error) {
    console.error("Failed to fetch liked tracks:", error);
    return [];
  }
}; 