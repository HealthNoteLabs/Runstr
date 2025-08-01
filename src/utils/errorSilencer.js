// Global error silencer — prevents red error overlays / banners
 
if (typeof window !== 'undefined') {
  // Suppress unhandled promise rejection banners
  window.addEventListener('unhandledrejection', (e) => {
    e.preventDefault();
    console.warn('[silenced] Unhandled rejection:', e.reason);
  });

  // Optionally suppress uncaught errors that bubble to window
  window.addEventListener('error', (e) => {
    // Prevent default browser overlay
    e.preventDefault();
    console.warn('[silenced] Window error:', e.error || e.message);
  });
} 