# RUNSTR Mobile Refactoring: Codebase Audit

## Web-Only Code Sections

### Browser APIs
- `window.nostr` references (NIP-07 browser extension)
- `localStorage` direct usage
- `window.addEventListener('resize', ...)` handlers
- CSS media queries for desktop layouts
- Browser-specific event handlers (e.g., mouseover, keyboard)

### Component Inventory

| Component | Web-Only Features | Mobile Implementation | Refactoring Needed |
|-----------|-------------------|------------------------|-------------------|
| `RunTracker.jsx` | None (mobile optimized) | Background geolocation | Minor - Replace localStorage |
| `NostrPublisher.jsx` | NIP-07 extension support | Android window.nostr injection | Medium - Replace auth methods |
| `Post.jsx` | Hover states, desktop layout | Basic mobile support | Medium - Replace modals with sheets |
| `TeamDetail.jsx` | Desktop layout grid | Basic responsive design | High - Replace with mobile-native layout |
| `ImagePicker.jsx` | File inputs | Camera/gallery integration | Low - Already mobile optimized |
| `MenuBar.jsx` | Desktop navigation | Mobile navigation exists | Medium - Make mobile-only |
| `RunHistory.jsx` | Desktop grid layout | Mobile list view | Medium - Remove desktop views |

### Service/Utils Inventory

| Service/Util | Web Dependencies | Mobile Implementation | Refactoring Needed |
|--------------|------------------|------------------------|-------------------|
| `RunTracker.js` | None | Capacitor geolocation | Low - Already mobile focused |
| `nostr.js` | Browser extension (NIP-07) | Android API integration | High - Remove web extensions |
| `nostrPool.js` | Browser WebSockets | Mobile-compatible WebSockets | Medium - Optimize for connection stability |
| `RunDataService.js` | localStorage | None | High - Replace with Capacitor Preferences |
| `formatters.js` | None | n/a | None - Pure functions |

## Dependency Graph

### Core Dependencies
- React (UI framework)
- Capacitor (Native bridge)
- nostr-tools (Nostr client)
- @capacitor-community/background-geolocation (Location tracking)

### Web-Only Dependencies
- react-dom (Web rendering)
- All browser extensions support

### Mobile-Specific Dependencies
- @capacitor/android
- @capacitor/core
- All native plugins

## Current Mobile Implementation Analysis

### Native Capabilities
- Background geolocation tracking
- Camera/gallery access
- Native storage (partial implementation)
- Background processing (partial)

### Mobile-Optimized Features
- Run tracking core functionality
- Activity recording
- Basic offline support
- Android-specific key management

### Missing Mobile Optimizations
- Offline-first data approach
- Connection resilience
- Battery optimization
- Mobile-specific UI patterns
- Advanced background processing

## Critical Refactoring Areas

1. **State Management**
   - Replace localStorage with Capacitor Preferences
   - Implement offline data queue
   - Add connection resilience

2. **UI Components**
   - Remove desktop-specific layouts
   - Replace modals with bottom sheets
   - Optimize touch targets and interactions

3. **Authentication**
   - Replace browser extension authentication
   - Enhance native key management
   - Implement secure mobile storage

4. **Performance**
   - Optimize rendering for mobile
   - Reduce network requests
   - Improve battery usage

## Next Steps

1. Update project configuration
2. Set up mobile-specific architecture
3. Begin incremental refactoring of identified components 