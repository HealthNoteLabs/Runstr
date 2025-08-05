import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { Platform } from './react-native-shim.js';

/**
 * Camera utility service for taking photos and uploading to nostr.build
 */

/**
 * Check if camera is available on the current platform
 * @returns {boolean} True if camera is available
 */
export const isCameraAvailable = () => {
  return Platform.OS === 'android' || (typeof navigator !== 'undefined' && navigator.mediaDevices);
};

/**
 * Request camera permissions
 * @returns {Promise<boolean>} True if permission granted
 */
export const requestCameraPermission = async () => {
  try {
    if (Platform.OS === 'android') {
      // On Android with Capacitor, permissions are handled automatically when camera is used
      return true;
    } else {
      // On web, check for media devices access
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Stop the stream immediately as we only wanted to check permission
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch (error) {
          console.warn('Camera permission denied or not available:', error);
          return false;
        }
      }
      return false;
    }
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return false;
  }
};

/**
 * Take a photo using the device camera
 * @param {Object} options - Camera options
 * @param {number} options.quality - Image quality from 0-100 (default: 80)
 * @param {number} options.width - Maximum width in pixels (default: 1024)  
 * @param {number} options.height - Maximum height in pixels (default: 1024)
 * @returns {Promise<{dataUrl: string, webPath?: string}>} Photo data
 */
export const takePhoto = async (options = {}) => {
  const {
    quality = 80,
    width = 1024,
    height = 1024
  } = options;

  try {
    // Check if camera is available
    if (!isCameraAvailable()) {
      throw new Error('Camera is not available on this device');
    }

    // Request permission first
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      throw new Error('Camera permission is required to take photos');
    }

    // Take the photo using Capacitor Camera
    const photo = await Camera.getPhoto({
      quality,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear,
      width,
      height,
      correctOrientation: true,
      saveToGallery: false // Don't save to gallery automatically
    });

    if (!photo.dataUrl) {
      throw new Error('Failed to capture photo data');
    }

    console.log('Photo captured successfully');
    return {
      dataUrl: photo.dataUrl,
      webPath: photo.webPath,
      format: photo.format || 'jpeg'
    };

  } catch (error) {
    console.error('Error taking photo:', error);
    throw new Error(`Camera error: ${error.message}`);
  }
};

/**
 * Upload image to nostr.build
 * @param {string} dataUrl - Base64 data URL of the image
 * @param {string} filename - Optional filename for the upload
 * @returns {Promise<string>} URL of uploaded image
 */
export const uploadImageToNostrBuild = async (dataUrl, filename = 'workout-photo.jpg') => {
  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create form data for upload
    const formData = new FormData();
    formData.append('file', blob, filename);

    console.log('Uploading image to nostr.build...');

    // Upload to nostr.build
    const uploadResponse = await fetch('https://nostr.build/api/v2/upload/files', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const result = await uploadResponse.json();
    
    if (result.status === 'success' && result.data && result.data[0] && result.data[0].url) {
      const imageUrl = result.data[0].url;
      console.log('Image uploaded successfully:', imageUrl);
      return imageUrl;
    } else {
      throw new Error('Invalid response from nostr.build');
    }

  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};

/**
 * Take photo and upload to nostr.build in one step
 * @param {Object} cameraOptions - Camera options (see takePhoto)
 * @param {string} filename - Optional filename for upload
 * @returns {Promise<{imageUrl: string, dataUrl: string}>} Upload result
 */
export const captureAndUploadPhoto = async (cameraOptions = {}, filename) => {
  try {
    // Take the photo
    const photo = await takePhoto(cameraOptions);
    
    // Upload to nostr.build
    const imageUrl = await uploadImageToNostrBuild(photo.dataUrl, filename);
    
    return {
      imageUrl,
      dataUrl: photo.dataUrl,
      format: photo.format
    };

  } catch (error) {
    console.error('Error in captureAndUploadPhoto:', error);
    throw error;
  }
};

/**
 * Compress image data URL to reduce file size
 * @param {string} dataUrl - Original data URL
 * @param {number} quality - Compression quality 0-1 (default: 0.8)
 * @param {number} maxWidth - Maximum width (default: 1024)
 * @param {number} maxHeight - Maximum height (default: 1024)
 * @returns {Promise<string>} Compressed data URL
 */
export const compressImage = async (dataUrl, quality = 0.8, maxWidth = 1024, maxHeight = 1024) => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        // Set canvas size and draw compressed image
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Get compressed data URL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };

      img.src = dataUrl;
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get error message user-friendly error message for camera errors
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
export const getCameraErrorMessage = (error) => {
  const message = error.message || error.toString();
  
  if (message.includes('permission') || message.includes('Permission')) {
    return 'Camera permission is required. Please allow camera access in your device settings.';
  }
  
  if (message.includes('not available') || message.includes('not supported')) {
    return 'Camera is not available on this device.';
  }
  
  if (message.includes('User cancelled') || message.includes('cancelled')) {
    return 'Photo capture was cancelled.';
  }
  
  if (message.includes('Upload failed') || message.includes('upload')) {
    return 'Failed to upload photo. Please check your internet connection and try again.';
  }
  
  return 'Failed to take photo. Please try again.';
};