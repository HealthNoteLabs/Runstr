/**
 * Extracts image URLs from post content
 * @param {string} content - The post content text
 * @returns {Array} Array of image URLs
 */
export const extractImagesFromContent = (content) => {
  if (!content) return [];
  const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif))/gi;
  return content.match(urlRegex) || [];
};

/**
 * Formats split times in post content to a consistent format
 * @param {string} content - The post content text
 * @returns {string} Formatted content with standardized split times
 */
export const formatSplitTimesInContent = (content) => {
  if (!content) return '';
  
  const lines = content.split('\n');
  
  const formattedLines = lines.map(line => {
    // Match patterns like "Mile 1: 8:16" or "KM 5: 5:30" or "400m 1: 85" etc.
    const splitRegex = /(mile|km|m|k|lap|split|interval)\s*(\d+):\s*(\d+:?\d*)/i;
    const match = line.match(splitRegex);
    
    if (match) {
      const unit = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      const wholeNumber = match[2];
      const time = match[3];
      
      // Format the time consistently
      let formattedTime = time;
      
      if (time.includes(':')) {
        // Already in MM:SS format, check if needs padding
        const parts = time.split(':');
        if (parts[1] && parts[1].length === 1) {
          const minutes = parts[0];
          const seconds = parseInt(parts[1]);
          formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      } else if (!isNaN(parseInt(time))) {
        // Handle single large number with no colon
        const timeNumber = parseInt(time);
        if (timeNumber > 1000) {
          // Try to convert a number like 8816 to 8:16
          const minutes = Math.floor((timeNumber % 10000) / 100);
          const seconds = timeNumber % 100;
          formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
          // For smaller numbers, assume it's just seconds
          const minutes = Math.floor(timeNumber / 60);
          const seconds = timeNumber % 60;
          formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      }
      
      return `${unit} ${wholeNumber}: ${formattedTime}`;
    }
    
    return line;
  });
  
  return formattedLines.join('\n');
}; 