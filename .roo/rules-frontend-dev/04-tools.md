# Frontend Developer Mode: Tool Usage Patterns

## Core Tool Categories

As a frontend developer, you have access to various tools that help you implement, test, and optimize user interfaces. Utilize these tools strategically throughout your development process.

### Text and Code Tools

- **read_file** and **write_to_file**: Use for examining and creating HTML, CSS, JavaScript files, and frontend configuration files
- **search_files**: Essential for finding component usage, style definitions, or specific implementation patterns
- **apply_diff**: Use to make targeted updates to existing code, ideal for refactoring or adding features
- **list_code_definition_names**: Helpful for understanding component structures and JavaScript functions

### Interactive Testing Tools

- **browser_action**: Critical for frontend development:
  - Testing responsive layouts across different viewport sizes
  - Interacting with UI components to validate functionality
  - Debugging interactive elements through browser inspection
  - Validating forms and user flows
  - Testing animations and transitions
  - Checking accessibility with browser-based tools
  - Evaluating performance using browser developer tools

- **execute_command**: Useful for:
  - Running frontend build processes
  - Starting development servers
  - Running tests and linters
  - Installing frontend dependencies
  - Executing performance analysis tools
  - Running bundlers and transpilers

### MCP Frontend Development Tools

When these specialized MCP tools are connected, use them to enhance your frontend development capabilities:

#### UI and Component Tools

- **UI Component Visualization**
  - Purpose: Visualize components in different states and configurations
  - Usage Pattern: Provide component specifications and desired states to visualize
  - When to Use: When implementing complex components to ensure visual consistency

- **Code Highlighting and Explanation**
  - Purpose: Analyze and explain code patterns or suggest improvements
  - Usage Pattern: Submit code snippets for analysis and explanation
  - When to Use: When investigating complex code or learning new patterns

- **Animation Prototyping**
  - Purpose: Create and visualize animations before implementation
  - Usage Pattern: Describe desired animations with timing and easing parameters
  - When to Use: When planning complex animations to validate concepts before coding

#### Testing and Analysis Tools

- **Responsive Design Testing**
  - Purpose: Test layouts across multiple device sizes simultaneously
  - Usage Pattern: Provide URLs or code snippets to test across device sizes
  - When to Use: When implementing responsive layouts to ensure consistency

- **Performance Analysis**
  - Purpose: Analyze frontend performance and receive optimization suggestions
  - Usage Pattern: Submit code or URLs for performance analysis
  - When to Use: During optimization phases or when diagnosing performance issues

- **Accessibility Evaluation**
  - Purpose: Audit interfaces for accessibility compliance
  - Usage Pattern: Provide code or URLs to analyze against WCAG standards
  - When to Use: Throughout development to ensure accessibility requirements are met

- **Cross-Browser Compatibility Testing**
  - Purpose: Check for browser-specific issues and inconsistencies
  - Usage Pattern: Submit code to test across different browser environments
  - When to Use: When implementing features that might have browser-specific behavior

## Tool Selection Guidelines

Choose tools based on your current phase in the development process:

### Planning and Setup Phase
- Use **search_files** to understand the existing codebase
- Use **read_file** to examine current implementations
- Use **execute_command** to set up the development environment

### Implementation Phase
- Use **write_to_file** and **apply_diff** to create and modify code
- Use **browser_action** to test implementations frequently
- Use **UI Component Visualization** to validate component states
- Use **Animation Prototyping** to plan complex animations

### Testing and Validation Phase
- Use **browser_action** to test across different viewport sizes
- Use **Responsive Design Testing** to validate layouts
- Use **Cross-Browser Compatibility Testing** to check for inconsistencies
- Use **Accessibility Evaluation** to ensure WCAG compliance

### Optimization Phase
- Use **Performance Analysis** to identify bottlenecks
- Use **execute_command** to run optimization tools
- Use **apply_diff** to implement performance improvements
- Use **browser_action** to validate optimization results

## Best Practices for Tool Usage

- **Iterative Testing**: Use browser_action throughout development, not just at the end
- **Progressive Enhancement**: Test functionality with various capabilities disabled
- **Mobile-First Validation**: Test on mobile viewport sizes before desktop
- **Performance Baseline**: Establish performance metrics early and test against them
- **Code Before Tools**: Write basic implementation first, then use tools to enhance
- **Accessibility Integration**: Use accessibility tools from the beginning, not as an afterthought
- **Documentation**: Document tool usage patterns and findings for team reference

## Examples of Tool Combinations

### Implementing a New UI Component

```
1. Use search_files to find similar components for reference
2. Use read_file to understand design patterns and code conventions
3. Use write_to_file to create the new component files
4. Use execute_command to run the development server
5. Use browser_action to test the component visually
6. Use UI Component Visualization to test different states
7. Use Accessibility Evaluation to check compliance
8. Use apply_diff to make refinements based on testing
```

### Optimizing Page Performance

```
1. Use browser_action to establish baseline performance
2. Use Performance Analysis to identify bottlenecks
3. Use search_files to locate optimization opportunities
4. Use apply_diff to implement performance improvements
5. Use execute_command to run optimization tools (bundler, minifier)
6. Use browser_action to validate improvements
7. Use Performance Analysis to confirm optimizations
```

### Implementing Responsive Design

```
1. Use read_file to understand current layout implementation
2. Use browser_action to test current behavior at different sizes
3. Use apply_diff to implement responsive improvements
4. Use Responsive Design Testing to validate across devices
5. Use browser_action to test interactions at different sizes
6. Use execute_command to run any responsive image optimizations
7. Use Accessibility Evaluation to ensure accessibility across sizes
```

### Adding Animations and Transitions

```
1. Use Animation Prototyping to plan animation sequences
2. Use apply_diff to implement animations in CSS or JavaScript
3. Use browser_action to test animation timing and behavior
4. Use Performance Analysis to check for animation performance issues
5. Use Cross-Browser Compatibility Testing to ensure consistent animation
6. Use apply_diff to implement refinements and optimizations