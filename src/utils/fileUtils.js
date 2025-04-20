/**
 * Convert a file to base64 string
 * @param {File} file - File object to convert
 * @returns {Promise<string>} Base64 string representation of the file
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result;
      resolve(result);
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Read an image file and return data URL and dimensions
 * @param {File} file - Image file to process
 * @returns {Promise<{dataUrl: string, width: number, height: number}>} Image data
 */
export const getImageData = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      resolve({
        dataUrl: url,
        width: img.width,
        height: img.height
      });
      
      // Clean up the object URL
      URL.revokeObjectURL(url);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};

/**
 * Compress an image file to reduce size
 * @param {File} file - Image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width of compressed image
 * @param {number} options.maxHeight - Maximum height of compressed image
 * @param {number} options.quality - JPEG quality (0-1)
 * @returns {Promise<Blob>} Compressed image blob
 */
export const compressImage = (file, options = {}) => {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = Math.round(width * (maxHeight / height));
        height = maxHeight;
      }
      
      // Create canvas for resizing
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      // Draw resized image
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to compress image'));
        }
      }, 'image/jpeg', quality);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };
    
    img.src = url;
  });
}; 