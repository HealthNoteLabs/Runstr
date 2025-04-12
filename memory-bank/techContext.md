# Technical Context

## Core Technologies

### Frontend
- **React**: JavaScript UI library for building the user interface
- **React Router**: For application routing and navigation
- **Vite**: Build tool and development server
- **JSX/TSX**: XML-like syntax extension for JavaScript/TypeScript

### Nostr Protocol
- **NDK** (Nostr Development Kit): Library for interacting with Nostr
- **WebSocket**: For real-time communication with Nostr relays
- **nostr-tools**: Utilities for working with Nostr protocol

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **CSS Modules**: For component-scoped styling where needed
- **Responsive Design Principles**: UI adapts to different device sizes

### State Management
- **React Context API**: For managing global application state
- **Custom Hooks**: For reusable stateful logic

### Data Persistence
- **Local Storage**: For saving user preferences and authentication state
- **IndexedDB** (possibly): For caching larger datasets locally

### Audio
- **Web Audio API**: For audio processing and playback
- **MediaSession API**: For media controls integration

### Performance Optimization
- **Code Splitting**: Via React.lazy and Suspense
- **Dynamic Imports**: For on-demand loading of components
- **Memoization**: React.memo and useMemo for component optimization

## Development Setup

### Required Tools
- **Node.js**: JavaScript runtime
- **npm/yarn**: Package managers
- **Git**: Version control

### Development Workflow
- **Vite Dev Server**: Local development environment
- **ESLint**: JavaScript linting
- **Prettier**: Code formatting
- **Testing Framework**: (Likely Jest or Vitest)

## Technical Constraints

### Browser Compatibility
- Focus on modern browsers with WebSocket and modern JavaScript support
- Progressive enhancement for older browsers where possible

### Performance Targets
- Initial load under 3 seconds on standard connections
- Smooth animations (60fps)
- Responsive to user input within 100ms

### Security Considerations
- Key management for Nostr
- Secure local storage practices
- Input validation

## Dependencies

### Core Dependencies
- react
- react-dom
- react-router-dom
- @nostr/ndk (or similar Nostr libraries)
- tailwindcss

### Development Dependencies
- vite
- eslint
- prettier
- vitest (or jest)
- typescript (if used)

## Deployment
- Static site hosting
- CDN for assets
- CI/CD pipeline (details to be determined) 