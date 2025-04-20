import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Component for managing image selection, preview, and removal
 */
export const ImageManager = ({ 
  images, 
  onImageSelected, 
  onImageRemoved,
  maxImages = 4
}) => {
  const [isLoading, setIsLoading] = useState(false);
  
  /**
   * Handle image selection from file input
   */
  const handleImageSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      setIsLoading(true);
      
      try {
        const file = e.target.files[0];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file');
          return;
        }
        
        // Create URL for preview
        const url = URL.createObjectURL(file);
        
        // Call the callback with the file and URL
        onImageSelected(file, url);
      } catch (error) {
        console.error('Error processing image:', error);
        alert('Error processing image');
      } finally {
        setIsLoading(false);
        // Reset input value to allow selecting the same file again
        e.target.value = '';
      }
    }
  };
  
  return (
    <div className="image-manager">
      {/* Image previews */}
      <div className="image-previews">
        {images.map((image, index) => (
          <div key={index} className="image-preview">
            <img src={image.url} alt={`Selected ${index}`} />
            <button 
              onClick={() => onImageRemoved(index)}
              className="remove-image-btn"
              aria-label="Remove image"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      
      {/* Image selection button */}
      {images.length < maxImages && (
        <div className="image-selector">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            id="image-input"
            className="hidden-input"
            disabled={isLoading}
          />
          <label htmlFor="image-input" className="image-select-btn">
            {isLoading ? 'Loading...' : 'Add Image'}
          </label>
        </div>
      )}
    </div>
  );
};

ImageManager.propTypes = {
  images: PropTypes.arrayOf(
    PropTypes.shape({
      file: PropTypes.object.isRequired,
      url: PropTypes.string.isRequired,
    })
  ).isRequired,
  onImageSelected: PropTypes.func.isRequired,
  onImageRemoved: PropTypes.func.isRequired,
  maxImages: PropTypes.number
}; 