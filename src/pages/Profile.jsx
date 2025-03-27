import { useState, useEffect } from 'react';
import { useRunProfile } from '../hooks/useRunProfile';

export const Profile = () => {
  const { profile, updateProfile } = useRunProfile();
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    weight: '',
    height: '',
    age: ''
  });

  useEffect(() => {
    // Initialize form data with existing profile data
    if (profile) {
      setFormData({
        name: profile.name || '',
        bio: profile.bio || '',
        weight: profile.weight || '',
        height: profile.height || '',
        age: profile.age || ''
      });
    }
  }, [profile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Convert numerical fields
    const updatedProfile = {
      ...formData,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      height: formData.height ? parseFloat(formData.height) : null,
      age: formData.age ? parseInt(formData.age) : null
    };
    
    updateProfile(updatedProfile);
    setEditMode(false);
  };

  return (
    <div className="profile-page">
      <h1>Profile</h1>
      
      {!editMode ? (
        <div className="profile-view">
          <div className="profile-section">
            <h2>{profile?.name || 'Runner'}</h2>
            {profile?.bio && <p className="bio">{profile.bio}</p>}
          </div>
          
          <div className="profile-details">
            {profile?.weight && (
              <div className="detail-item">
                <span className="label">Weight:</span>
                <span className="value">{profile.weight} kg</span>
              </div>
            )}
            
            {profile?.height && (
              <div className="detail-item">
                <span className="label">Height:</span>
                <span className="value">{profile.height} cm</span>
              </div>
            )}
            
            {profile?.age && (
              <div className="detail-item">
                <span className="label">Age:</span>
                <span className="value">{profile.age}</span>
              </div>
            )}
          </div>
          
          <button 
            className="edit-button"
            onClick={() => setEditMode(true)}
          >
            Edit Profile
          </button>
        </div>
      ) : (
        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Your name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Tell us about yourself"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="weight">Weight (kg)</label>
            <input
              type="number"
              id="weight"
              name="weight"
              value={formData.weight}
              onChange={handleInputChange}
              placeholder="Weight in kg"
              step="0.1"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="height">Height (cm)</label>
            <input
              type="number"
              id="height"
              name="height"
              value={formData.height}
              onChange={handleInputChange}
              placeholder="Height in cm"
              step="0.1"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="age">Age</label>
            <input
              type="number"
              id="age"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              placeholder="Your age"
            />
          </div>
          
          <div className="form-actions">
            <button type="submit" className="save-button">Save</button>
            <button 
              type="button" 
              className="cancel-button"
              onClick={() => setEditMode(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}; 