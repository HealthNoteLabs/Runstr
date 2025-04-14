# Frontend Developer Mode: Task Workflow Guidelines

## Development Process Framework

When approaching frontend development tasks, follow these sequential steps:

1. **Requirements Analysis**
   - Understand the design specifications and requirements
   - Clarify interactions and animations with designers
   - Identify API endpoints and data requirements
   - Define browser/device support requirements
   - Establish performance and accessibility targets

2. **Architecture Planning**
   - Plan component structure and hierarchy
   - Define state management approach
   - Establish routing and navigation patterns
   - Choose appropriate libraries and frameworks
   - Create a development strategy and timeline

3. **Setup and Scaffolding**
   - Set up development environment and tools
   - Create project structure and configurations
   - Initialize version control
   - Configure build processes and tooling
   - Set up testing infrastructure

4. **Component Development**
   - Create base layout and structure components
   - Develop reusable UI components
   - Implement responsive design patterns
   - Add CSS styling according to design specifications
   - Create animations and transitions

5. **Functionality Implementation**
   - Add interactivity with JavaScript/framework code
   - Implement form handling and validation
   - Connect to backend APIs and services
   - Manage application state and data flow
   - Handle errors and edge cases

6. **Optimization and Enhancement**
   - Optimize rendering performance
   - Implement accessibility features
   - Add progressive enhancement
   - Optimize assets and resources
   - Implement analytics and monitoring

7. **Testing and Quality Assurance**
   - Conduct unit and integration testing
   - Perform cross-browser testing
   - Test on different devices and screen sizes
   - Validate accessibility compliance
   - Ensure performance benchmarks are met

8. **Refinement and Deployment**
   - Address feedback and bug fixes
   - Document codebase and usage patterns
   - Optimize for production deployment
   - Implement CI/CD processes
   - Plan for monitoring and maintenance

## Example Task Workflows

### Single Page Application Development

```
1. ANALYSIS
   - Review design mockups and prototypes
   - Define routes and navigation structure
   - Identify API endpoints and data models
   - Determine authentication requirements
   - Establish browser support matrix

2. ARCHITECTURE
   - Design component hierarchy
   - Choose state management solution
   - Plan routing implementation
   - Define data fetching and caching strategy
   - Establish code organization pattern

3. FOUNDATION
   - Set up project using appropriate framework
   - Configure build tools and development workflow
   - Create base application structure
   - Implement routing mechanism
   - Set up state management foundation

4. COMPONENT BUILDING
   - Create layout components (header, footer, navigation)
   - Build page-specific components
   - Develop reusable UI component library
   - Implement responsive design
   - Add styling following design system

5. FUNCTIONALITY
   - Implement user authentication
   - Connect components to state management
   - Add form handling and validation
   - Integrate with backend APIs
   - Implement error handling and loading states

6. ENHANCEMENT
   - Add animations and transitions
   - Optimize bundle size and lazy loading
   - Implement client-side caching
   - Add offline support if needed
   - Ensure accessibility compliance

7. TESTING
   - Write unit tests for components
   - Test application flows and integration
   - Perform cross-browser testing
   - Validate on mobile devices
   - Run performance and accessibility audits

8. FINALIZATION
   - Fix bugs and address feedback
   - Optimize for production deployment
   - Add documentation
   - Configure analytics and monitoring
   - Prepare for release
```

### Interactive Component Library Development

```
1. PLANNING
   - Define component library scope and requirements
   - Establish design system guidelines to follow
   - Determine component API patterns
   - Plan documentation approach
   - Define testing strategy

2. SETUP
   - Configure development environment
   - Set up build and packaging tools
   - Create project structure for component library
   - Establish version control and contribution workflow
   - Set up documentation site framework

3. COMPONENT DEVELOPMENT
   - Create core design system tokens (colors, spacing, etc.)
   - Develop base components (buttons, inputs, etc.)
   - Build compound components (forms, cards, etc.)
   - Implement interactive components (dropdowns, modals, etc.)
   - Create layout components (grid, container, etc.)

4. ENHANCEMENT
   - Add accessibility features (ARIA attributes, keyboard navigation)
   - Implement theming and customization options
   - Add animations and transitions
   - Optimize for various use cases
   - Create component variants

5. DOCUMENTATION
   - Document component APIs and props
   - Create usage examples and code snippets
   - Build interactive component playground
   - Document accessibility features
   - Add visual regression tests

6. TESTING
   - Write unit tests for components
   - Create visual regression tests
   - Test accessibility compliance
   - Validate browser compatibility
   - Test bundle size and performance

7. RELEASE
   - Configure package publishing
   - Create semantic versioning strategy
   - Document migration and upgrade paths
   - Prepare release notes
   - Publish to package registry
```

### Frontend Application Optimization

```
1. ANALYSIS
   - Establish performance metrics and baselines
   - Identify critical user paths to optimize
   - Run performance audits (Lighthouse, WebPageTest)
   - Profile JavaScript execution and rendering
   - Analyze bundle size and dependencies

2. QUICK WINS
   - Optimize images and media assets
   - Enable text compression
   - Implement proper caching strategies
   - Remove unused code and dependencies
   - Fix render-blocking resources

3. JAVASCRIPT OPTIMIZATION
   - Implement code splitting and lazy loading
   - Optimize critical rendering path
   - Add tree shaking for unused code
   - Minimize third-party script impact
   - Optimize event handlers and listeners

4. RENDERING OPTIMIZATION
   - Reduce layout thrashing
   - Optimize CSS selectors and specificity
   - Implement efficient animations
   - Optimize DOM manipulation
   - Minimize layout shifts

5. ADVANCED TECHNIQUES
   - Implement service workers for caching
   - Add preloading for critical resources
   - Consider server-side rendering or static generation
   - Implement predictive prefetching
   - Optimize web fonts loading

6. TESTING AND VALIDATION
   - Measure improvements against baselines
   - Test on low-end devices and slow networks
   - Validate Core Web Vitals metrics
   - Ensure optimizations don't break functionality
   - Document optimization strategies

7. MONITORING
   - Implement real user monitoring (RUM)
   - Set up performance budgets
   - Create performance regression tests
   - Document performance best practices
   - Establish ongoing optimization process
```

## Communication Approaches

- **Seek Clarity**: Ask specific questions about design intent, interactions, and edge cases
- **Provide Options**: When implementing complex features, present multiple technical approaches with trade-offs
- **Demonstrate Progress**: Use interactive demos and previews to show implementation progress
- **Explain Technical Constraints**: Clearly communicate any technical limitations or challenges
- **Document Decisions**: Record technical decisions and implementation details for future reference
- **Reference Standards**: Support implementation choices with industry standards and best practices
- **Use Visual Aids**: Utilize screenshots, GIFs, or videos to demonstrate interactive behaviors
- **Provide Context**: Explain how frontend implementations support specific user needs or business goals