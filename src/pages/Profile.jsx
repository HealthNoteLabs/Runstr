import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRunProfile } from '../hooks/useRunProfile';
import { publishHealthProfile } from '../utils/nostrHealth';
import { useSettings } from '../contexts/SettingsContext';
import { useNostr } from '../hooks/useNostr';
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import SubscriptionModal from '../components/modals/SubscriptionModal';
import enhancedSubscriptionService from '../services/enhancedSubscriptionService';
import '../assets/styles/profile.css';

export const Profile = () => {
  const navigate = useNavigate();
  const { publicKey } = useNostr();
  
  // State for Nostr publishing
  const [isPublishing, setIsPublishing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // State for subscription
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState(null);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  
  // Get user profile from custom hook
  const { 
    userProfile: profile,
    handleProfileChange, 
    handleProfileSubmit: saveProfile,
    unitPreferences,
    handleUnitChange
  } = useRunProfile();

  const { isHealthEncryptionEnabled } = useSettings();

  // Load subscription status when component mounts
  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      if (!publicKey) {
        setIsLoadingSubscription(false);
        return;
      }

      try {
        const tier = await enhancedSubscriptionService.getSubscriptionTier(publicKey);
        const counts = await enhancedSubscriptionService.getSubscriberCountByTier();
        setSubscriptionTier(tier);
        setSubscriberCount(counts.total);
      } catch (error) {
        console.error('Error loading subscription status:', error);
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    loadSubscriptionStatus();
  }, [publicKey]);

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

  // Handle successful subscription
  const handleSubscriptionSuccess = async () => {
    // Reload subscription status
    if (publicKey) {
      try {
        const tier = await enhancedSubscriptionService.getSubscriptionTier(publicKey, true); // Force refresh
        const counts = await enhancedSubscriptionService.getSubscriberCountByTier(true);
        setSubscriptionTier(tier);
        setSubscriberCount(counts.total);
      } catch (error) {
        console.error('Error reloading subscription status:', error);
      }
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

      {/* Subscription Section */}
      <div className="form-container" style={{ marginTop: '2rem' }}>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Premium Subscription</h3>
        
        {isLoadingSubscription ? (
          <div className="text-center py-4">
            <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-text-secondary text-sm mt-2">Loading subscription status...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptionTier ? (
              // User has active subscription
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-800">
                    {subscriptionTier === 'captain' ? 'Captain' : 'Member'} Subscription Active ⭐
                  </h4>
                  <span className="text-xs text-green-600 px-2 py-1 bg-green-100 rounded-full">
                    Premium
                  </span>
                </div>
                <p className="text-sm text-green-700 mb-3">
                  You're enjoying {subscriptionTier === 'captain' ? 'captain privileges and ' : ''}automatic daily rewards!
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-600">
                    Join {subscriberCount} other premium subscribers
                  </span>
                  <Button 
                    onClick={() => setShowSubscriptionModal(true)}
                    variant="outline"
                    size="sm"
                    className="text-green-700 border-green-300 hover:bg-green-100"
                  >
                    Manage Subscription
                  </Button>
                </div>
              </div>
            ) : (
              // User doesn't have subscription
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-yellow-800 mb-1">
                      Unlock Premium Features ⭐
                    </h4>
                    <p className="text-sm text-yellow-700 mb-2">
                      Get automatic daily rewards for completing streaks!
                    </p>
                    <div className="text-xs text-yellow-600 space-y-1">
                      <div className="flex items-center">
                        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-2"></span>
                        Member: 5,000 sats/month • Daily rewards + team access
                      </div>
                      <div className="flex items-center">
                        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-2"></span>
                        Captain: 10,000 sats/month • Create teams + prize events
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowSubscriptionModal(true)}
                    variant="default"
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    disabled={!publicKey}
                  >
                    Subscribe
                  </Button>
                </div>
                {subscriberCount > 0 && (
                  <p className="text-xs text-yellow-600 mt-2">
                    {subscriberCount} runners are already earning rewards
                  </p>
                )}
                {!publicKey && (
                  <p className="text-xs text-red-600 mt-2">
                    Connect your Nostr account to subscribe
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subscription Modal */}
      <SubscriptionModal 
        open={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscriptionSuccess={handleSubscriptionSuccess}
      />

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