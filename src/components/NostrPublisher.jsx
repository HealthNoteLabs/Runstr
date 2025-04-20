import { useState } from 'react';
import PropTypes from 'prop-types';
import { createAndPublishEvent } from '../utils/nostr';
import { fileToBase64 } from '../utils/fileUtils';

/**
 * Component for publishing run data to Nostr
 */
export const NostrPublisher = ({ 
  runData, 
  images = [], 
  onSuccess, 
  onError, 
  onClose 
}) => {
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState({
    stage: 'idle',
    imagesProcessed: 0,
    totalImages: images.length
  });

  /**
   * Handle publishing run data to Nostr
   */
  const handlePublish = async () => {
    if (!runData) {
      onError(new Error('No run data provided'));
      return;
    }
    
    setIsPublishing(true);
    setPublishProgress({
      stage: 'preparing',
      imagesProcessed: 0,
      totalImages: images.length
    });
    
    try {
      // Process images first if there are any
      const imageTags = [];
      
      if (images.length > 0) {
        setPublishProgress(prev => ({ ...prev, stage: 'processing-images' }));
        
        for (let i = 0; i < images.length; i++) {
          try {
            const base64Image = await fileToBase64(images[i].file);
            imageTags.push(['image', base64Image]);
            
            setPublishProgress(prev => ({ 
              ...prev, 
              imagesProcessed: i + 1 
            }));
          } catch (error) {
            console.error('Error processing image:', error);
          }
        }
      }

      setPublishProgress(prev => ({ ...prev, stage: 'creating-event' }));
      
      // Create run data content
      const formattedRunData = formatRunContent(runData);
      const fullContent = content.trim()
        ? `${formattedRunData}\n\n${content.trim()}`
        : formattedRunData;
      
      // Create event template with relevant tags
      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'Runstr'],
          ['t', 'Running'],
          ['distance', runData.distance.toString()],
          ['duration', runData.duration.toString()],
          ['pace', runData.pace.toString()],
          ...imageTags
        ],
        content: fullContent
      };

      setPublishProgress(prev => ({ ...prev, stage: 'publishing' }));
      
      // Publish to Nostr
      await createAndPublishEvent(eventTemplate);
      
      // Clean up image URLs
      images.forEach(image => URL.revokeObjectURL(image.url));
      
      // Notify success
      onSuccess();
    } catch (error) {
      console.error('Error publishing to Nostr:', error);
      onError(error);
    } finally {
      setIsPublishing(false);
      setPublishProgress({
        stage: 'idle',
        imagesProcessed: 0,
        totalImages: images.length
      });
    }
  };

  return (
    <div className="nostr-publisher">
      <h3>Share Your Run</h3>
      
      {runData && (
        <div className="run-preview">
          <div><strong>Distance:</strong> {runData.distance}</div>
          <div><strong>Duration:</strong> {runData.duration}</div>
          <div><strong>Pace:</strong> {runData.pace}</div>
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add details about your run..."
        disabled={isPublishing}
        className="content-textarea"
        rows={4}
      />
      
      {/* Display images if any */}
      {images.length > 0 && (
        <div className="selected-images">
          <h4>Selected Images ({images.length})</h4>
          <div className="image-thumbnails">
            {images.map((image, index) => (
              <div key={index} className="image-thumbnail">
                <img src={image.url} alt={`Thumbnail ${index}`} />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Display progress if publishing */}
      {isPublishing && (
        <div className="publish-progress">
          <p>
            {publishProgress.stage === 'preparing' && 'Preparing to publish...'}
            {publishProgress.stage === 'processing-images' && 
              `Processing images (${publishProgress.imagesProcessed}/${publishProgress.totalImages})...`}
            {publishProgress.stage === 'creating-event' && 'Creating post...'}
            {publishProgress.stage === 'publishing' && 'Publishing to Nostr network...'}
          </p>
        </div>
      )}
      
      <div className="publisher-actions">
        <button 
          onClick={handlePublish} 
          disabled={isPublishing}
          className="publish-button"
        >
          {isPublishing ? 'Publishing...' : 'Publish to Nostr'}
        </button>
        <button 
          onClick={onClose}
          disabled={isPublishing}
          className="cancel-button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

NostrPublisher.propTypes = {
  runData: PropTypes.shape({
    distance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    duration: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    pace: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    date: PropTypes.string,
    splits: PropTypes.array,
    elevation: PropTypes.shape({
      gain: PropTypes.number,
      loss: PropTypes.number
    })
  }),
  images: PropTypes.arrayOf(
    PropTypes.shape({
      file: PropTypes.object.isRequired,
      url: PropTypes.string.isRequired
    })
  ),
  onSuccess: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

/**
 * Format run data into human-readable content
 * @param {Object} runData - Run data to format
 * @returns {string} Formatted content
 */
const formatRunContent = (runData) => {
  if (!runData) return '';
  
  const { distance, duration, date, pace } = runData;
  const formattedDate = date ? new Date(date).toLocaleDateString() : 'today';
  
  return `🏃‍♂️ Run completed on ${formattedDate}!\n📏 Distance: ${distance}\n⏱️ Duration: ${duration}\n⚡ Pace: ${pace}`;
}; 