import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRunProfile } from '../hooks/useRunProfile';
import { publishHealthProfile } from '../utils/nostrHealth';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import '../assets/styles/profile.css';

export const Profile = () => {
  const navigate = useNavigate();
  
  // State for Nostr publishing
  const [isPublishing, setIsPublishing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Get user profile from custom hook
  const { 
    userProfile: profile,
    handleProfileChange, 
    handleProfileSubmit: saveProfile,
    unitPreferences,
    handleUnitChange
  } = useRunProfile();

  const { isHealthEncryptionEnabled } = useSettings();

  // Custom submit handler that navigates back after saving
  const handleProfileSubmit = () => {
    saveProfile();
    navigate('/history'); // Navigate back to RunHistory after saving
  };

  // Show confirmation dialog before publishing
  const handlePublishRequest = () => {
    setShowConfirmation(true);
  };

  // Cancel publishing
  const handleCancel = () => {
    setShowConfirmation(false);
  };

  // Handle publishing health profile to Nostr after confirmation
  const handlePublishToNostr = async () => {
    setShowConfirmation(false);
    setIsPublishing(true);
    
    try {
      // Publish health profile to Nostr
      const result = await publishHealthProfile(profile, unitPreferences, { encrypt: isHealthEncryptionEnabled() });
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Health profile published to Nostr! (${result.published}/${result.totalMetrics} metrics)`);
      } else {
        alert(`Health profile published to Nostr! (${result.published}/${result.totalMetrics} metrics)`);
      }
    } catch (error) {
      console.error('Error publishing health profile to Nostr:', error);
      
      // Show error message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to publish profile: ' + error.message);
      } else {
        alert('Failed to publish profile: ' + error.message);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="profile-page">
              <h2 className="page-title mb-6">User Profile</h2>
              <p className="secondary-text mb-6">Update your profile for accurate calorie calculations</p>
      
      <div className="form-container">
        <div className="form-group">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="weight">Weight</label>
            <ButtonGroup
              value={unitPreferences.weight}
              onValueChange={(value) => handleUnitChange('weight', value)}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' }
              ]}
              size="sm"
            />
          </div>
          <input
            id="weight"
            type="number"
            value={profile.weight}
            onChange={(e) => handleProfileChange('weight', e.target.value)}
            placeholder={unitPreferences.weight === 'kg' ? "Weight in kg" : "Weight in lb"}
          />
        </div>
        
        <div className="form-group height-inputs">
          <div className="flex justify-between items-center mb-2">
            <label>Height</label>
            <ButtonGroup
              value={unitPreferences.height}
              onValueChange={(value) => handleUnitChange('height', value)}
              options={[
                { value: 'metric', label: 'cm' },
                { value: 'imperial', label: 'ft/in' }
              ]}
              size="sm"
            />
          </div>
          
          {unitPreferences.height === 'metric' ? (
            // Metric height input (cm)
            <div className="height-field">
              <input
                id="heightCm"
                type="number"
                value={profile.heightCm}
                onChange={(e) => handleProfileChange('heightCm', e.target.value)}
                placeholder="Height in cm"
              />
              <label htmlFor="heightCm">cm</label>
            </div>
          ) : (
            // Imperial height input (feet/inches)
            <div className="height-fields">
              <div className="height-field">
                <input
                  id="heightFeet"
                  type="number"
                  min="0"
                  max="8"
                  value={profile.heightFeet}
                  onChange={(e) => handleProfileChange('heightFeet', e.target.value)}
                  placeholder="ft"
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
                  onChange={(e) => handleProfileChange('heightInches', e.target.value)}
                  placeholder="in"
                />
                <label htmlFor="heightInches">in</label>
              </div>
            </div>
          )}
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
            <option value="non-binary">Non-binary</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="age">Age</label>
          <input
            id="age"
            type="number"
            value={profile.age}
            onChange={(e) => handleProfileChange('age', e.target.value)}
            placeholder="Age in years"
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
          <Button 
            onClick={handleProfileSubmit}
            variant="default"
            size="default"
          >
            Save Profile
          </Button>
          <Button 
            onClick={handlePublishRequest}
            disabled={isPublishing}
            variant="secondary"
            size="default"
          >
            {isPublishing ? 'Publishing...' : 'Save Health Profile to Nostr'}
          </Button>
          <Button 
            onClick={() => navigate('/history')}
            variant="outline"
            size="default"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <h3 className="dialog-title">Publish Health Profile</h3>
            
            <div className="dialog-content">
              <p>You are about to publish your health profile data to Nostr. Please consider:</p>
              
              <ul className="privacy-list">
                <li>
                  <strong>Public Data:</strong> This health information will be published to public relays 
                  and can be accessed by anyone.
                </li>
                <li>
                  <strong>Permanent Record:</strong> While individual relays may delete data, once published, 
                  it may be stored indefinitely on some relays.
                </li>
                <li>
                  <strong>Separate Events:</strong> Each health metric (weight, height, age, etc.) will be 
                  published as a separate event, allowing selective access by other applications.
                </li>
                <li>
                  <strong>Identifiable Information:</strong> This data will be linked to your Nostr public key.
                </li>
              </ul>
              
              <p className="privacy-question">
                Are you sure you want to publish your health profile to Nostr?
              </p>
            </div>
            
            <div className="dialog-buttons">
              <Button 
                onClick={handleCancel}
                variant="outline"
                size="default"
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePublishToNostr}
                variant="default"
                size="default"
              >
                Publish
              </Button>
            </div>
          </div>
        </div>
      )}

      {/*
      <div className="profile-section bitcoin-history-section">
        <BitcoinTransactionHistory />
      </div>
      */
      }
    </div>
  );
}; 