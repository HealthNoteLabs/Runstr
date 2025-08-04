/**
 * Payment Verification Service
 * Handles payment verification and lightning address testing for subscriber rewards
 */

import { sendRewardZap } from './rewardService';
import enhancedSubscriptionService from './enhancedSubscriptionService';

interface VerificationResult {
  success: boolean;
  error?: string;
  lightningAddress?: string;
  verified: boolean;
}

interface PaymentTestResult {
  success: boolean;
  error?: string;
  actualPaymentMade?: boolean;
}

/**
 * Storage keys for failed lightning addresses
 */
const FAILED_ADDRESSES_KEY = 'failedLightningAddresses';
const VERIFIED_ADDRESSES_KEY = 'verifiedLightningAddresses';

/**
 * Get failed lightning addresses from storage
 */
const getFailedAddresses = (): string[] => {
  try {
    const stored = localStorage.getItem(FAILED_ADDRESSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[PaymentVerification] Error loading failed addresses:', error);
    return [];
  }
};

/**
 * Store failed lightning address
 */
const storeFailedAddress = (address: string): void => {
  try {
    const failed = getFailedAddresses();
    if (!failed.includes(address)) {
      failed.push(address);
      localStorage.setItem(FAILED_ADDRESSES_KEY, JSON.stringify(failed));
      console.log('[PaymentVerification] Stored failed address:', address);
    }
  } catch (error) {
    console.error('[PaymentVerification] Error storing failed address:', error);
  }
};

/**
 * Get verified lightning addresses from storage
 */
const getVerifiedAddresses = (): string[] => {
  try {
    const stored = localStorage.getItem(VERIFIED_ADDRESSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[PaymentVerification] Error loading verified addresses:', error);
    return [];
  }
};

/**
 * Store verified lightning address
 */
const storeVerifiedAddress = (address: string): void => {
  try {
    const verified = getVerifiedAddresses();
    if (!verified.includes(address)) {
      verified.push(address);
      localStorage.setItem(VERIFIED_ADDRESSES_KEY, JSON.stringify(verified));
      console.log('[PaymentVerification] Stored verified address:', address);
    }
  } catch (error) {
    console.error('[PaymentVerification] Error storing verified address:', error);
  }
};

/**
 * Test payment with 1 sat to verify lightning address works
 */
const testPayment = async (
  recipientPubkey: string, 
  lightningAddress: string
): Promise<PaymentTestResult> => {
  console.log(`[PaymentVerification] Testing payment to ${lightningAddress} for ${recipientPubkey}`);

  try {
    const result = await sendRewardZap(
      recipientPubkey,
      1, // 1 sat test payment
      'RUNSTR payment verification test',
      'payment_verification',
      lightningAddress
    );

    if (result.success) {
      console.log('[PaymentVerification] Test payment successful');
      storeVerifiedAddress(lightningAddress);
      return { success: true, actualPaymentMade: true };
    } else {
      console.warn('[PaymentVerification] Test payment failed:', result.error);
      storeFailedAddress(lightningAddress);
      return { 
        success: false, 
        error: result.error || 'Test payment failed',
        actualPaymentMade: false 
      };
    }
  } catch (error: any) {
    console.error('[PaymentVerification] Test payment threw error:', error);
    storeFailedAddress(lightningAddress);
    return { 
      success: false, 
      error: error.message || 'Test payment exception',
      actualPaymentMade: false 
    };
  }
};

/**
 * Verify payment destination for a subscriber
 * Checks lightning address and tests with 1 sat payment if needed
 */
export const verifyPaymentDestination = async (
  userPubkey: string, 
  fallbackLightningAddress?: string
): Promise<VerificationResult> => {
  console.log(`[PaymentVerification] Verifying payment destination for ${userPubkey.substring(0, 16)}...`);

  // Check subscription status first
  const subscriptionTier = await enhancedSubscriptionService.getSubscriptionTier(userPubkey);
  if (!subscriptionTier) {
    return {
      success: false,
      error: 'User is not a subscriber',
      verified: false
    };
  }

  // Get lightning address from multiple sources
  let lightningAddress = fallbackLightningAddress;
  
  // Try stored lightning address
  if (!lightningAddress) {
    lightningAddress = localStorage.getItem('lightningAddress');
  }

  // Try subscriber-specific stored address
  if (!lightningAddress) {
    lightningAddress = localStorage.getItem(`subscriberLightningAddress_${userPubkey}`);
  }

  if (!lightningAddress) {
    return {
      success: false,
      error: 'No lightning address available',
      verified: false
    };
  }

  // Check if address has previously failed
  const failedAddresses = getFailedAddresses();
  if (failedAddresses.includes(lightningAddress)) {
    console.warn('[PaymentVerification] Address previously failed:', lightningAddress);
    return {
      success: false,
      error: 'Lightning address previously failed verification',
      lightningAddress,
      verified: false
    };
  }

  // Check if address has been verified recently
  const verifiedAddresses = getVerifiedAddresses();
  if (verifiedAddresses.includes(lightningAddress)) {
    console.log('[PaymentVerification] Address already verified:', lightningAddress);
    return {
      success: true,
      lightningAddress,
      verified: true
    };
  }

  // Test payment with 1 sat
  console.log('[PaymentVerification] Testing payment with 1 sat...');
  const testResult = await testPayment(userPubkey, lightningAddress);

  if (testResult.success) {
    return {
      success: true,
      lightningAddress,
      verified: true
    };
  } else {
    return {
      success: false,
      error: `Payment test failed: ${testResult.error}`,
      lightningAddress,
      verified: false
    };
  }
};

/**
 * Store lightning address for a specific subscriber
 */
export const storeSubscriberLightningAddress = (
  userPubkey: string, 
  lightningAddress: string
): void => {
  try {
    localStorage.setItem(`subscriberLightningAddress_${userPubkey}`, lightningAddress);
    console.log(`[PaymentVerification] Stored lightning address for subscriber ${userPubkey.substring(0, 16)}`);
  } catch (error) {
    console.error('[PaymentVerification] Error storing subscriber lightning address:', error);
  }
};

/**
 * Get stored lightning address for a specific subscriber
 */
export const getSubscriberLightningAddress = (userPubkey: string): string | null => {
  try {
    return localStorage.getItem(`subscriberLightningAddress_${userPubkey}`);
  } catch (error) {
    console.error('[PaymentVerification] Error getting subscriber lightning address:', error);
    return null;
  }
};

/**
 * Clear verification cache (for admin use)
 */
export const clearVerificationCache = (): void => {
  try {
    localStorage.removeItem(FAILED_ADDRESSES_KEY);
    localStorage.removeItem(VERIFIED_ADDRESSES_KEY);
    console.log('[PaymentVerification] Cleared verification cache');
  } catch (error) {
    console.error('[PaymentVerification] Error clearing cache:', error);
  }
};

/**
 * Get admin report of failed addresses
 */
export const getFailedAddressesReport = (): { failed: string[], verified: string[] } => {
  return {
    failed: getFailedAddresses(),
    verified: getVerifiedAddresses()
  };
};

export default {
  verifyPaymentDestination,
  storeSubscriberLightningAddress,
  getSubscriberLightningAddress,
  clearVerificationCache,
  getFailedAddressesReport
};