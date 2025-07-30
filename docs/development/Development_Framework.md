# Development Framework

## Architecture Overview

**RUNSTR** is built using a **React + Capacitor** hybrid mobile application architecture, combining web technologies with native mobile capabilities for Android deployment.

## Technology Stack

### Frontend Framework
- **React 18.3.1** - Modern React with hooks and functional components
- **TypeScript** - Type safety and enhanced developer experience
- **Vite 5.4.10** - Fast build tool and development server
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Framer Motion 12.9.4** - Animation library for smooth UI transitions

### Mobile Framework
- **Capacitor 7.0.1** - Cross-platform native runtime
- **Android Platform** - Currently Android-only deployment
- **Native Android Components** - Custom native code for platform-specific functionality

### Build System
- **Vite** - Modern build tool with HMR and optimized bundling
- **ESBuild** - Fast JavaScript bundler and minifier
- **Terser** - JavaScript minification for production builds
- **PostCSS + Autoprefixer** - CSS processing and vendor prefixing

### Key Dependencies
- **@nostr-dev-kit/ndk 2.13.0** - Nostr protocol implementation
- **nostr-tools 2.12.0** - Nostr utilities and cryptographic functions
- **@getalby/bitcoin-connect 3.6.3** - Bitcoin/Lightning wallet integration
- **@capacitor-community/background-geolocation 1.2.20** - GPS tracking
- **@capacitor-community/keep-awake 7.0.0** - Prevent device sleep
- **React Router Dom 6.27.0** - Navigation and routing

## Architecture Characteristics

### Hybrid App Structure
- **Web Layer**: React application built with Vite
- **Native Container**: Capacitor WebView wrapper for Android
- **Bridge Layer**: JavaScript-to-native communication via Capacitor plugins
- **Distribution**: Standard Android APK through app stores

### Key Architectural Decisions

#### 1. Capacitor Over React Native
- **Reasoning**: Leverages existing web development skills
- **Benefits**: Single codebase for web and mobile, familiar React patterns
- **Trade-offs**: Performance not as optimal as native, but sufficient for app requirements

#### 2. Background Geolocation Strategy
- **Primary**: Capacitor Community Background Geolocation plugin
- **Fallback**: Browser Geolocation API for development/testing
- **Advanced Filtering**: Kalman filtering and accuracy thresholds
- **Foreground Service**: Ensures GPS tracking continues in background

#### 3. State Management
- **Approach**: React Context + Hooks pattern
- **Services**: Dedicated service classes (RunTracker, RunDataService)
- **Persistence**: LocalStorage and IndexedDB for data persistence

#### 4. Nostr Integration
- **Primary Library**: NDK (Nostr Development Kit) for event handling
- **Fallback**: nostr-tools for lower-level operations
- **Architecture**: Event-driven with reactive patterns

## Development Workflow

### Build Process
1. **Development**: `npm run dev` - Vite dev server with HMR
2. **Build**: `npm run build` - Production build with optimization
3. **Android Build**: `npm run build:android` - Build + Capacitor sync
4. **Android Deploy**: `npm run android` - Open in Android Studio

### Code Organization
```
src/
├── components/     # Reusable UI components
├── contexts/       # React Context providers
├── hooks/          # Custom React hooks
├── services/       # Business logic and API services
├── utils/          # Utility functions and helpers
├── pages/          # Route components
└── assets/         # Static assets and styles
```

### Testing Strategy
- **Unit Tests**: Vitest for component and utility testing
- **Manual Testing**: Dedicated test configuration with Vite
- **Device Testing**: Android Studio emulator and physical devices

## Platform-Specific Considerations

### Android Optimizations
- **Foreground Service**: For continuous GPS tracking
- **Battery Optimization**: Wake lock management
- **Permissions**: Location, background location, wake lock
- **Legacy Bridge**: Capacitor legacy bridge enabled for compatibility

### Target Devices
- **Primary**: GrapheneOS (privacy-focused Android)
- **Secondary**: Standard Android devices
- **Minimum**: Android API level compatible with Capacitor 7.x

## Performance Optimizations

### Bundle Optimization
- **Code Splitting**: Vendor chunks separated from app code
- **Lazy Loading**: Route-based code splitting
- **Tree Shaking**: Unused code elimination
- **Minification**: Terser for JavaScript, CSS optimization

### Runtime Performance
- **GPS Filtering**: Kalman filtering for accuracy
- **Event Debouncing**: Reduced update frequency for UI
- **Memory Management**: Proper cleanup of listeners and intervals
- **Battery Optimization**: Efficient background processing

## Security Considerations

### Data Protection
- **Local Storage**: Sensitive data encrypted locally
- **Nostr Keys**: Secure key management and storage
- **Network**: HTTPS for all external communications
- **Privacy**: Minimal data collection, user-controlled sharing

### Platform Security
- **Permissions**: Principle of least privilege
- **Foreground Service**: Transparent user notification
- **Code Obfuscation**: Production builds minified and optimized

## Deployment Strategy

### Build Artifacts
- **Web Bundle**: Optimized for WebView consumption
- **Android APK**: Standard Android package format
- **Source Maps**: Disabled in production for security

### Distribution Channels
- **Primary**: Direct APK distribution
- **Secondary**: F-Droid and alternative app stores
- **Future**: Zapstore (Bitcoin-native app store)

## Development Tools

### Required Tools
- **Node.js**: JavaScript runtime
- **npm**: Package management
- **Android Studio**: Native Android development
- **Capacitor CLI**: Hybrid app development

### Recommended Tools
- **VS Code**: Primary development environment
- **Android Emulator**: Device testing
- **Chrome DevTools**: Web debugging
- **Flipper**: React Native debugging (when needed)

## Future Architectural Considerations

### Scalability
- **Modular Architecture**: Component-based design allows easy extension
- **Plugin System**: Capacitor plugins for new native features
- **Service Workers**: Potential for offline functionality enhancement

### Cross-Platform Expansion
- **iOS Support**: Capacitor natively supports iOS with minimal changes
- **Web App**: Could be deployed as PWA with service worker
- **Desktop**: Potential Electron wrapper for desktop platforms

## Privacy-Focused OS Compatibility Analysis

### GrapheneOS/Calyx OS Considerations

**Current Geolocation Implementation:**
The app uses `@capacitor-community/background-geolocation` which implements sophisticated GPS tracking with:
- Kalman filtering for accuracy improvement
- Haversine formula for distance calculations
- Foreground service for background operation
- Multiple accuracy thresholds and filtering mechanisms

**Compatibility Assessment:**
- ✅ **Generally Compatible**: GrapheneOS and Calyx OS are Android-based and support standard location services
- ✅ **Permission Model**: Privacy-focused ROMs still support location permissions when explicitly granted
- ⚠️ **Potential Issues**:
  - Background location restrictions may be more aggressive
  - Battery optimization could be more stringent
  - Foreground service notifications might be more prominent
  - Location accuracy could be reduced if using alternative location providers

**Mitigation Strategies:**
- Current implementation already includes robust fallback mechanisms
- Foreground service ensures tracking continues even with restricted background policies
- Multiple accuracy filtering layers compensate for potential precision loss
- User education about permission requirements specific to privacy-focused ROMs

**Recommendation:** The current implementation should work well on GrapheneOS/Calyx OS, with users needing to explicitly grant location permissions and potentially whitelist the app from battery optimization.

## iOS Expansion Feasibility

### Technical Viability
**Ease of Implementation:** ⭐⭐⭐⭐☆ (4/5 - Relatively Easy)

**Advantages of Capacitor Architecture:**
- ✅ **Cross-Platform Ready**: Capacitor natively supports iOS
- ✅ **Shared Codebase**: 95%+ of React code would work unchanged
- ✅ **Plugin Ecosystem**: Most Capacitor plugins have iOS equivalents
- ✅ **Development Tools**: Same development workflow and tools

**Required Changes:**
1. **Platform Configuration**: Add iOS to Capacitor config
2. **iOS-Specific Permissions**: Update Info.plist for location permissions
3. **Background Modes**: Configure iOS background location capabilities
4. **UI/UX Adjustments**: iOS-specific design patterns and safe areas
5. **Plugin Compatibility**: Verify all plugins work on iOS

**Challenges:**
- ⚠️ **Background Location**: iOS has stricter background execution policies
- ⚠️ **App Store Review**: More stringent approval process
- ⚠️ **Battery Management**: iOS handles background apps differently
- ⚠️ **Development Environment**: Requires macOS and Xcode

**Estimated Development Effort:**
- **Core App**: 1-2 weeks (configuration and testing)
- **UI Polish**: 1-2 weeks (iOS-specific adjustments)
- **Testing & Debugging**: 2-3 weeks (device testing and optimization)
- **App Store Submission**: 1-2 weeks (approval process)

**Recommendation:** iOS expansion is technically feasible and would leverage the existing hybrid architecture effectively. The main investment would be in iOS-specific testing and App Store compliance rather than code rewriting.

## Technical Debt and Limitations

### Current Limitations
- **Android Only**: No iOS version currently planned (but technically feasible)
- **Background Restrictions**: Dependent on Android background policies
- **WebView Performance**: Not as fast as native implementations
- **Battery Usage**: GPS tracking impacts battery life
- **Privacy OS Edge Cases**: Potential compatibility variations on heavily modified Android ROMs

### Maintenance Considerations
- **Capacitor Updates**: Regular updates for security and features
- **React Version**: Staying current with React ecosystem
- **Plugin Maintenance**: Community plugins may need alternatives
- **Android Target SDK**: Regular updates for Play Store compliance
- **iOS Preparation**: Consider iOS development environment setup for future expansion 