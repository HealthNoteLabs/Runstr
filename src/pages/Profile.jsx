import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRunProfile } from '../hooks/useRunProfile';

export const Profile = () => {
  const navigate = useNavigate();
  
  // Get user profile from custom hook
  const { 
    userProfile: profile,
    handleProfileChange, 
    handleProfileSubmit: saveProfile
  } = useRunProfile();

  // Custom submit handler that navigates back after saving
  const handleProfileSubmit = () => {
    saveProfile();
    navigate('/history'); // Navigate back to RunHistory after saving
  };

  return (
    <div className="profile-page">
      <h2 className="text-2xl font-bold mb-6">User Profile</h2>
      <p className="text-gray-400 mb-6">Update your profile for accurate calorie calculations</p>
      
      <div className="form-container">
        <div className="form-group">
          <label htmlFor="weight">Weight (kg)</label>
          <input
            id="weight"
            type="number"
            value={profile.weight}
            onChange={(e) => handleProfileChange('weight', Number(e.target.value))}
          />
        </div>
        
        <div className="form-group height-inputs">
          <label>Height</label>
          <div className="height-fields">
            <div className="height-field">
              <input
                id="heightFeet"
                type="number"
                min="0"
                max="8"
                value={profile.heightFeet}
                onChange={(e) => handleProfileChange('heightFeet', Number(e.target.value))}
              />
              <label htmlFor="heightFeet">ft</label>
            </div>
            <div className="height-field">
              <input
                id="heightInches"
                type="number"
                min="0"
                max="11"
                value={profile.heightInches}
                onChange={(e) => handleProfileChange('heightInches', Number(e.target.value))}
              />
              <label htmlFor="heightInches">in</label>
            </div>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            value={profile.gender}
            onChange={(e) => handleProfileChange('gender', e.target.value)}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="age">Age</label>
          <input
            id="age"
            type="number"
            value={profile.age}
            onChange={(e) => handleProfileChange('age', Number(e.target.value))}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="fitnessLevel">Fitness Level</label>
          <select
            id="fitnessLevel"
            value={profile.fitnessLevel}
            onChange={(e) => handleProfileChange('fitnessLevel', e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        
        <div className="form-buttons">
          <button 
            className="save-button"
            onClick={handleProfileSubmit}
          >
            Save Profile
          </button>
          <button 
            className="cancel-button"
            onClick={() => navigate('/history')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}; 