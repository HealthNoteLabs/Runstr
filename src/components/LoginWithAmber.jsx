import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { NostrContext } from '../contexts/NostrContext';
import AmberAuth from '../services/AmberAuth';

const LoginWithAmber = () => {
  const { requestNostrPermissions, isAmberAvailable } = useContext(NostrContext);
  const [isLoading, setIsLoading] = useState(false);
  const [amberInstalled, setAmberInstalled] = useState(false);

  // Check if Amber is installed
  useEffect(() => {
    const checkAmber = async () => {
      if (Platform.OS === 'android') {
        const installed = await AmberAuth.isAmberInstalled();
        setAmberInstalled(installed);
      }
    };
    
    checkAmber();
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await requestNostrPermissions();
    } catch (error) {
      console.error('Error logging in with Amber:', error);
    }
    setIsLoading(false);
  };

  // Only show the button on Android and if Amber is installed
  if (Platform.OS !== 'android' || !amberInstalled) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.button}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Connecting...' : 'Login with Amber'}
        </Text>
      </TouchableOpacity>
      
      <Text style={styles.subtitle}>
        Securely login using the Amber app
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#ee9614', // Amber color
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 8,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  subtitle: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
  }
});

export default LoginWithAmber; 