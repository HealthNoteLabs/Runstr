import { useState, useCallback } from 'react';

/**
 * Custom hook for managing user profile data
 * Optimized for Android
 */
export const useRunProfile = () => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Load user profile from local storage with default values
  const [userProfile, setUserProfile] = useState(() => {
    const storedProfile = localStorage.getItem('userProfile');
    return storedProfile
      ? JSON.parse(storedProfile)
      : {
          weight: 70, // default weight in kg
          heightFeet: 5, // default height in feet
          heightInches: 7, // default height in inches
          heightCm: 170, // store equivalent in cm for calculations
          gender: 'male', // default gender
          age: 30, // default age
          fitnessLevel: 'intermediate' // default fitness level
        };
  });

  /**
   * Update a specific profile field
   */
  const handleProfileChange = useCallback((field, value) => {
    setUserProfile((prev) => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // If feet or inches are updated, also update the cm value
      if (field === 'heightFeet' || field === 'heightInches') {
        const feet = field === 'heightFeet' ? value : prev.heightFeet;
        const inches = field === 'heightInches' ? value : prev.heightInches;
        updated.heightCm = Math.round((feet * 30.48) + (inches * 2.54));
      }
      
      return updated;
    });
  }, []);

  /**
   * Save profile to local storage
   */
  const handleProfileSubmit = useCallback(() => {
    // Convert feet and inches to cm for storage and calculations
    const heightCm = (userProfile.heightFeet * 30.48) + (userProfile.heightInches * 2.54);
    
    const updatedProfile = {
      ...userProfile,
      heightCm: Math.round(heightCm)
    };
    
    // Save to local storage for persistence
    localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
    setUserProfile(updatedProfile);
    setShowProfileModal(false);
  }, [userProfile]);

  return {
    userProfile,
    setUserProfile,
    showProfileModal,
    setShowProfileModal,
    handleProfileChange,
    handleProfileSubmit
  };
}; 