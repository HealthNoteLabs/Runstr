import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import NIP29Bridge from '../services/NIP29Bridge';

// Initialize the bridge
const nip29Bridge = new NIP29Bridge();

const GroupDiscoveryScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState(null);
  const [featuredGroups, setFeaturedGroups] = useState([]);
  const [runningGroups, setRunningGroups] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize the bridge if needed
  useEffect(() => {
    const initializeBridge = async () => {
      if (!isInitialized) {
        await nip29Bridge.initialize();
        setIsInitialized(true);
        
        // Load featured groups after initialization
        loadFeaturedGroups();
      }
    };
    
    initializeBridge();
  }, [isInitialized]);

  // Load featured running groups (including specific search for Messi Run Club)
  const loadFeaturedGroups = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Try to find Messi Run Club as a featured group
      const messiGroup = await nip29Bridge.findGroupByExactName('Messi Run Club');
      let featured = [];
      
      if (messiGroup) {
        featured.push(messiGroup);
      }
      
      // Get other running groups
      const runGroups = await nip29Bridge.discoverRunningGroups(10);
      
      // Filter out the Messi Run Club if we already have it
      if (messiGroup) {
        const filteredGroups = runGroups.filter(group => group.id !== messiGroup.id);
        featured = [...featured, ...filteredGroups];
      } else {
        featured = runGroups;
      }
      
      setFeaturedGroups(featured);
      
      // If we're on the featured tab, update the displayed groups
      if (activeTab === 'featured') {
        setGroups(featured);
      }
    } catch (error) {
      console.error('Error loading featured groups:', error);
      setError('Failed to load featured groups. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load all running-related groups
  const loadAllRunningGroups = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const allGroups = await nip29Bridge.discoverRunningGroups(50);
      setRunningGroups(allGroups);
      
      // Update displayed groups if on the "all" tab
      if (activeTab === 'all') {
        setGroups(allGroups);
      }
    } catch (error) {
      console.error('Error loading all running groups:', error);
      setError('Failed to load running groups. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Search for groups by name
  const searchGroups = async () => {
    if (!searchQuery.trim()) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await nip29Bridge.searchGroupsByName(searchQuery, 20);
      setGroups(results);
    } catch (error) {
      console.error('Error searching for groups:', error);
      setError('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Join a group
  const joinGroup = async (group) => {
    setIsLoading(true);
    
    try {
      // Create club data from the group metadata
      const clubData = {
        id: `nostr_${Date.now()}`,
        name: group.metadata.name,
        description: group.metadata.about,
        picture: group.metadata.picture,
        isExternal: true,
        source: 'nostr'
      };
      
      // Join the group
      const result = await nip29Bridge.joinExistingGroup(group.id, clubData);
      
      if (result.success) {
        // Navigate to the club details screen or show success message
        alert(`Successfully joined ${group.metadata.name}!`);
        
        // Optional: navigate to the club screen
        if (navigation && navigation.navigate) {
          navigation.navigate('ClubDetails', { clubId: result.clubId });
        }
      } else {
        setError(`Failed to join group: ${result.error}`);
      }
    } catch (error) {
      console.error('Error joining group:', error);
      setError('Failed to join group. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Switch tabs
  const switchTab = (tab) => {
    setActiveTab(tab);
    setError(null);
    
    if (tab === 'featured') {
      setGroups(featuredGroups);
      if (featuredGroups.length === 0) {
        loadFeaturedGroups();
      }
    } else if (tab === 'all') {
      if (runningGroups.length === 0) {
        loadAllRunningGroups();
      } else {
        setGroups(runningGroups);
      }
    } else if (tab === 'search') {
      setGroups([]);
    }
  };

  // Render a group card
  const renderGroupCard = ({ item }) => {
    return (
      <View style={styles.groupCard}>
        <View style={styles.groupHeader}>
          {item.metadata.picture ? (
            <Image 
              source={{ uri: item.metadata.picture }} 
              style={styles.groupAvatar} 
              defaultSource={require('../assets/default-group-icon.png')}
            />
          ) : (
            <View style={styles.defaultAvatar}>
              <Text style={styles.defaultAvatarText}>
                {item.metadata.name ? item.metadata.name.charAt(0).toUpperCase() : 'G'}
              </Text>
            </View>
          )}
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{item.metadata.name || 'Unnamed Group'}</Text>
            <Text style={styles.groupTimestamp}>
              Created: {new Date(item.created_at * 1000).toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        <Text style={styles.groupDescription} numberOfLines={3}>
          {item.metadata.about || 'No description available'}
        </Text>
        
        <TouchableOpacity 
          style={styles.joinButton}
          onPress={() => joinGroup(item)}
          disabled={isLoading}
        >
          <Text style={styles.joinButtonText}>Join Group</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover Running Clubs</Text>
      </View>
      
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'featured' && styles.activeTab]}
          onPress={() => switchTab('featured')}
        >
          <Text style={[styles.tabText, activeTab === 'featured' && styles.activeTabText]}>
            Featured
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => switchTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All Running Clubs
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => switchTab('search')}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Search
          </Text>
        </TouchableOpacity>
      </View>
      
      {activeTab === 'search' && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for running clubs..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchGroups}
          />
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={searchGroups}
            disabled={!searchQuery.trim() || isLoading}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Searching the Nostr network...</Text>
        </View>
      ) : (
        <>
          {groups.length === 0 && !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'search' 
                  ? 'Enter a search term to find groups' 
                  : 'No running clubs found'}
              </Text>
              {activeTab !== 'search' && (
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={activeTab === 'featured' ? loadFeaturedGroups : loadAllRunningGroups}
                >
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={groups}
              renderItem={renderGroupCard}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.groupsList}
              showsVerticalScrollIndicator={false}
              refreshing={isLoading}
              onRefresh={activeTab === 'featured' 
                ? loadFeaturedGroups 
                : activeTab === 'all' 
                ? loadAllRunningGroups 
                : null}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#4a90e2'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white'
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white'
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center'
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4a90e2'
  },
  tabText: {
    fontSize: 14,
    color: '#666'
  },
  activeTabText: {
    color: '#4a90e2',
    fontWeight: 'bold'
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8
  },
  searchButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  groupsList: {
    padding: 12
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  groupHeader: {
    flexDirection: 'row',
    marginBottom: 12
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0'
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center'
  },
  defaultAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold'
  },
  groupInfo: {
    marginLeft: 12,
    flex: 1,
    justifyContent: 'center'
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  groupTimestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  groupDescription: {
    fontSize: 14,
    color: '#444',
    marginBottom: 16,
    lineHeight: 20
  },
  joinButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  joinButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16
  },
  refreshButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    margin: 12
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center'
  }
});

export default GroupDiscoveryScreen; 