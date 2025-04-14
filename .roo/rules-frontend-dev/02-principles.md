# Frontend Developer Mode: Development Principles and Best Practices

## Cross-Browser and Cross-Device Compatibility

### Cross-Browser Compatibility
- Test across major browsers (Chrome, Firefox, Safari, Edge)
- Use feature detection instead of browser detection
- Implement graceful degradation for unsupported features
- Utilize appropriate polyfills and fallbacks
- Validate HTML, CSS, and JavaScript to avoid syntax errors
- Consider browser-specific quirks and rendering differences

### Cross-Device Compatibility
- Test on multiple device types (desktop, tablet, mobile, etc.)
- Consider touch interfaces vs mouse/keyboard interactions
- Optimize for various screen sizes and resolutions
- Test on low-powered devices to ensure performance
- Consider network conditions and offline functionality
- Account for device-specific features and limitations

## Responsive Design Principles

### Fluid Layouts
- Use relative units (%, em, rem, vh, vw) instead of fixed pixels
- Implement flexible grid systems for layout
- Design for content priority rather than exact positioning
- Use CSS flexbox and grid for robust layouts

### Breakpoints and Media Queries
- Design for mobile-first, then enhance for larger screens
- Choose breakpoints based on content needs, not specific devices
- Test layouts at various widths between breakpoints
- Use logical breakpoints that support your design system

### Responsive Assets
- Implement responsive images with srcset and sizes
- Optimize media for different viewport sizes
- Consider lazy loading for off-screen content
- Use SVGs where possible for resolution independence

## Accessibility Standards (WCAG)

### Semantic HTML
- Use appropriate HTML elements for their intended purpose
- Provide meaningful structure with proper heading hierarchy
- Use landmarks and ARIA roles to define page regions
- Ensure form elements have proper labels and associations

### Keyboard Navigation
- Ensure all interactive elements are keyboard accessible
- Implement logical tab order for navigation
- Provide visible focus states for interactive elements
- Create skip links for main content

### Screen Reader Compatibility
- Add descriptive alt text for images
- Provide ARIA labels for non-standard controls
- Ensure dynamic content changes are announced
- Test with screen readers like VoiceOver, NVDA, or JAWS

### Color and Contrast
- Maintain minimum contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Never use color alone to convey information
- Consider color blindness and visual impairments
- Test with color blindness simulators

## Performance Optimization

### Asset Optimization
- Minimize and compress CSS, JavaScript, and HTML
- Optimize images and use appropriate formats (WebP, SVG, etc.)
- Implement code splitting and lazy loading
- Use efficient caching strategies

### Rendering Performance
- Minimize layout thrashing and repaints
- Optimize JavaScript execution and avoid blocking the main thread
- Implement efficient animations using requestAnimationFrame or CSS
- Utilize web workers for intensive computations

### Loading Performance
- Prioritize critical rendering path resources
- Implement progressive enhancement
- Use preload, prefetch, and preconnect for resource hints
- Optimize for Core Web Vitals (LCP, FID, CLS)

### Metrics and Measurement
- Monitor Time to Interactive (TTI) and First Contentful Paint (FCP)
- Track user-centric performance metrics
- Establish performance budgets
- Use tools like Lighthouse, WebPageTest, and Chrome DevTools

## Component-Based Architecture

### Component Design
- Build modular, reusable components
- Follow single responsibility principle
- Create self-contained components with clean interfaces
- Document component APIs and usage patterns

### Component Hierarchy
- Establish clear parent-child relationships
- Create logical component composition patterns
- Balance component granularity (not too small, not too large)
- Implement consistent patterns for component communication

### Maintainability
- Follow consistent naming conventions
- Separate concerns (presentation, logic, state)
- Create test-friendly component structures
- Document component behaviors and edge cases

### Reusability
- Design for customization and extensibility
- Avoid excessive props or complex interfaces
- Create abstract components for shared behaviors
- Maintain a component library or design system

## State Management

### State Organization
- Differentiate between application, component, and local state
- Centralize shared state for consistency
- Keep component state as minimal as possible
- Define clear ownership of state

### Data Flow
- Implement unidirectional data flow
- Avoid prop drilling with appropriate context providers
- Create predictable state mutations
- Document state dependencies and side effects

### State Persistence
- Handle state persistence consistently (localStorage, sessionStorage, etc.)
- Implement proper state rehydration on page load
- Consider offline state management where appropriate
- Maintain user preferences and settings consistently

### Performance Considerations
- Minimize unnecessary re-renders
- Use memoization for expensive computations
- Implement efficient state updates
- Profile and optimize state changes for performance