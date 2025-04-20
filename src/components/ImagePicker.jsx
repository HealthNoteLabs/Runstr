import { useState } from 'react';
import PropTypes from 'prop-types';
import { X, Camera, ImageIcon } from 'lucide-react';
import './ImagePicker.css';

/**
 * ImagePicker component allowing users to select images from camera or gallery
 * @param {Object} props 
 * @param {function} props.onImageSelected - Callback when image is selected
 * @param {function} props.onImageRemoved - Callback when image is removed
 * @param {Array} props.selectedImages - Array of currently selected images
 * @param {number} props.maxImages - Maximum number of images allowed
 * @returns {JSX.Element}
 */
const ImagePicker = ({
  onImageSelected,
  onImageRemoved,
  selectedImages = [],
  maxImages = 3
}) => {
  const [showOptions, setShowOptions] = useState(false);

  /**
   * Handles camera capture by creating a file input and setting its capture attribute
   */
  const handleCameraCapture = () => {
    setShowOptions(false);
    
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use the back camera (environment) by default
    
    // Handle file selection
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFile(e.target.files[0]);
      }
    };
    
    // Trigger file selection dialog
    input.click();
  };

  /**
   * Handles selection from gallery by creating a file input without capture attribute
   */
  const handleGallerySelect = () => {
    setShowOptions(false);
    
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // No capture attribute means it will open gallery
    
    // Handle file selection
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFile(e.target.files[0]);
      }
    };
    
    // Trigger file selection dialog
    input.click();
  };

  /**
   * Process the selected image file
   * @param {File} file 
   */
  const handleImageFile = (file) => {
    // Don't proceed if maximum images are already selected
    if (selectedImages.length >= maxImages) {
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Maximum ${maxImages} images allowed`);
      } else {
        alert(`Maximum ${maxImages} images allowed`);
      }
      return;
    }
    
    // Create a URL for the image file
    const imageUrl = URL.createObjectURL(file);
    
    // Call the callback with the file and URL
    onImageSelected(file, imageUrl);
  };

  /**
   * Remove a selected image
   * @param {number} index 
   */
  const handleRemoveImage = (index) => {
    onImageRemoved(index);
  };

  return (
    <div className="image-picker">
      {/* Selected images display */}
      {selectedImages.length > 0 && (
        <div className="selected-images">
          {selectedImages.map((image, index) => (
            <div key={index} className="image-preview-container">
              <img 
                src={image.url} 
                alt={`Selected ${index}`} 
                className="image-preview"
              />
              <button 
                className="remove-image-btn"
                onClick={() => handleRemoveImage(index)}
                aria-label="Remove image"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Image picker control */}
      {selectedImages.length < maxImages && (
        <div className="image-picker-controls">
          {showOptions ? (
            <div className="image-options">
              <button 
                onClick={handleCameraCapture}
                className="image-option-btn camera-btn"
              >
                <Camera size={18} /> Take Photo
              </button>
              <button 
                onClick={handleGallerySelect}
                className="image-option-btn gallery-btn"
              >
                <ImageIcon size={18} /> Choose from Library
              </button>
              <button 
                onClick={() => setShowOptions(false)}
                className="image-option-btn cancel-btn"
              >
                <X size={18} /> Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowOptions(true)}
              className="add-image-btn"
              aria-label="Add image"
            >
              <Camera size={18} />
              <span>Add Photo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

ImagePicker.propTypes = {
  onImageSelected: PropTypes.func.isRequired,
  onImageRemoved: PropTypes.func.isRequired,
  selectedImages: PropTypes.arrayOf(
    PropTypes.shape({
      file: PropTypes.object,
      url: PropTypes.string
    })
  ),
  maxImages: PropTypes.number
};

export default ImagePicker; 