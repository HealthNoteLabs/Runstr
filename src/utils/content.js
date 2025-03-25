// Extract image URLs from content
export const extractImagesFromContent = (content) => {
  const imageRegex = /(https?:\/\/[^\s<>"]+?\.(?:png|gif|jpg|jpeg))/gi;
  const matches = content.match(imageRegex) || [];
  return [...new Set(matches)]; // Remove duplicates
};

// Format split times in content
export const formatSplitTimesInContent = (content) => {
  // Split time pattern: 1:30, 2:45, etc.
  const splitTimeRegex = /(\d+):(\d{2})/g;
  
  return content.replace(splitTimeRegex, (match, minutes, seconds) => {
    const totalSeconds = parseInt(minutes) * 60 + parseInt(seconds);
    const pace = (totalSeconds / 1000).toFixed(2); // Convert to pace per km
    
    return `${match} (${pace} min/km)`;
  });
}; 