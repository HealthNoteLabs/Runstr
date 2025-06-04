import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext.tsx';
import { nip19 } from 'nostr-tools';

export const GroupDiscovery = () => {
  const { ndk, isInitialized: isNdkInitialized } = useContext(NostrContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !isNdkInitialized) {
      setError(!isNdkInitialized ? 'Nostr connection not ready.' : 'Enter a search term.');
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSearchResults([]);

    try {
      console.log(`GroupDiscovery: Searching for groups with query: ${searchQuery}`);
      const events = await ndk.fetchEvents({
        kinds: [39000], // Kind for NIP-29 group metadata
        search: searchQuery,
        limit: 20, // Limit results
      }, { closeOnEose: true, subTimeout: 5000, eoseTimeout: 8000 }); // Use timeouts

      console.log(`GroupDiscovery: Found ${events.size} potential groups.`);
      
      const results = [];
      events.forEach(event => {
        try {
          const metadata = JSON.parse(event.content);
          const dTag = event.tags.find(tag => tag[0] === 'd');
          const identifier = dTag ? dTag[1] : null;

          if (!identifier || !metadata.name) return; // Skip if missing core info

          // Construct naddr for linking
          const naddr = nip19.naddrEncode({
            identifier: identifier,
            pubkey: event.pubkey,
            kind: 39000,
            relays: event.tags.filter(t => t[0] === 'relay').map(t => t[1])
          });

          results.push({
            id: event.id,
            naddr: naddr,
            name: metadata.name,
            about: metadata.about || 'No description',
            picture: metadata.picture || '/default-avatar.png', // Use default avatar if missing
            pubkey: event.pubkey,
            identifier: identifier,
          });
        } catch (parseError) {
          console.warn(`GroupDiscovery: Skipping event ${event.id} due to parse error:`, parseError);
        }
      });
      
      // Sort results alphabetically by name
      results.sort((a, b) => a.name.localeCompare(b.name));

      setSearchResults(results);
      if (results.length === 0) {
        setError('No groups found matching your search.');
      }

    } catch (err) {
      console.error('GroupDiscovery: Error searching for groups:', err);
      setError(`Failed to search for groups: ${err.message}`);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container run-club-theme p-4">
      <h2 className="text-2xl font-bold mb-4 text-white">Discover Groups</h2>
      
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search group names or topics..."
          className="flex-grow p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-orange-500"
          disabled={isLoading || !isNdkInitialized}
        />
        <button 
          type="submit" 
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          disabled={isLoading || !isNdkInitialized}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className="text-red-400 mb-4">{error}</p>}
      {!isNdkInitialized && <p className="text-yellow-400 mb-4">Connecting to Nostr...</p>}

      {searchResults.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-white">Search Results</h3>
          {searchResults.map(group => (
            <Link 
              to={`/team/${encodeURIComponent(group.naddr)}`} 
              key={group.id} 
              className="block p-4 bg-gray-800 rounded hover:bg-gray-700 transition duration-150"
            >
              <div className="flex items-center space-x-3">
                <img 
                  src={group.picture} 
                  alt={group.name} 
                  className="w-12 h-12 rounded-full object-cover bg-gray-600"
                  onError={(e) => { e.target.src = '/default-avatar.png'; }}
                />
                <div>
                  <h4 className="text-lg font-medium text-white">{group.name}</h4>
                  <p className="text-sm text-gray-400 truncate">{group.about}</p>
                   <p className="text-xs text-gray-500">ID: {group.identifier}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupDiscovery; 