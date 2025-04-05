import { useState, useCallback } from 'react';
import { wavlakeApi } from '../services/wavlakeApi';

export function useWavlakeLibrary(npub) {
  const [trendingTracks, setTrendingTracks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTrendingTracks = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await wavlakeApi.getTrendingTracks({ npub });
      setTrendingTracks(data.tracks);
    } catch (err) {
      setError('Failed to load trending tracks');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [npub]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsLoading(true);
      const data = await wavlakeApi.searchTracks(searchQuery);
      setSearchResults(data.tracks);
    } catch (err) {
      setError('Failed to search tracks');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    trendingTracks,
    searchQuery,
    setSearchQuery,
    searchResults,
    isLoading,
    error,
    loadTrendingTracks,
    handleSearch
  };
}
