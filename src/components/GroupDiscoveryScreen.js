import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';

// Updated hardcoded groups to include Messi Run Club
const hardcodedGroups = [
  {
    id: 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es',
    metadata: {
      name: '#RUNSTR',
      about: 'A community for runners to connect and share their experiences.',
      picture: null
    },
    created_at: 1681603200 // Example timestamp
  },
  {
    id: 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqsp4vfsnswrxve3rwdmyxgun2vnrx4jnvef5xs6rqcehxu6kgcmrvymkvvtpxuerwwp4xasn2cfhxymnxdpexsergvfhx3jnjce5vyunvg7fw59',
    metadata: {
      name: 'Messi Run Club',
      about: 'Join Messi and other runners in this exclusive running club.',
      picture: null
    },
    created_at: 1681603200 // Example timestamp
  }
];

const GroupDiscoveryScreen = ({ navigation }) => {
  const [groups, setGroups] = useState(hardcodedGroups);

  // Join a group
  const joinGroup = async (group) => {
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
      <FlatList
        data={groups}
        renderItem={renderGroupCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.groupsList}
        showsVerticalScrollIndicator={false}
      />
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
  }
});

export default GroupDiscoveryScreen;