# CSS Refactoring Plan for RUNSTR App

## Current State

The App.css file is currently 5,000+ lines long, mixing various component styles, global styles, and utility classes. This makes maintenance difficult and negatively impacts performance since all styles are loaded regardless of which components are actually being used.

## Objective

Refactor the CSS architecture to:

1. Improve maintainability
2. Optimize performance
3. Follow component-based design principles
4. Leverage Tailwind CSS effectively

## Implementation Plan

### Phase 1: Global Styles and Variables (Already Completed)

✅ Move CSS variables, reset styles, and global styles to `index.css`.

### Phase 2: Component-Specific Styles (In Progress)

✅ Created RunTracker.css for the RunTracker component

#### Components to refactor next (in order of priority based on file size):

1. **Post.jsx (468 lines)**
   - Create `src/components/Post.css`
   - Move all Post-specific styles, including comments section, posts list, etc.

2. **NostrPublisher.jsx (211 lines)**
   - Create `src/components/NostrPublisher.css` 
   - Move modal, form, and publisher-specific styles

3. **TeamDetail.jsx (897 lines)**
   - Create `src/pages/TeamDetail.css`
   - Move team-related styles, chat styles, and team-specific layout

4. **RunHistory.jsx (553 lines)**
   - Create `src/pages/RunHistory.css`
   - Move history list, stats grid, and history item styles

5. **GroupDiscoveryScreen.jsx (463 lines)**
   - Create `src/components/GroupDiscoveryScreen.css`
   - Move team discovery, grid, and card styles

6. **MenuBar.jsx (197 lines)**
   - Create `src/components/MenuBar.css`
   - Move navigation, menu, and settings modal styles

### Phase 3: Shared Component Modules

Create reusable style modules for common components:

1. **`src/styles/components/buttons.css`**
   - Primary, secondary, and tertiary button styles
   - Action buttons (delete, share, etc.)

2. **`src/styles/components/cards.css`**
   - Common card styles
   - Card layouts and variations

3. **`src/styles/components/modals.css`**
   - Common modal styles
   - Different modal variants

4. **`src/styles/components/forms.css`**
   - Input fields, textareas
   - Form layouts and organization

### Phase 4: Tailwind Integration Strategy

1. **Leverage Tailwind for Layouts and Simple Styling**
   - Use Tailwind classes for common layout patterns, margins, and padding
   - Keep custom CSS for complex styling and animations

2. **Consider PostCSS Integration**
   - Set up proper Tailwind integration via PostCSS
   - Replace CDN implementation with proper build-time integration

3. **Create Tailwind Theme**
   - Define custom colors, spacing, and other theme variables
   - Ensure consistency with existing design system

### Phase 5: Cleanup

1. **Remove App.css**
   - Once all component styles are extracted, remove App.css
   - Ensure no missing styles in the refactoring

2. **Update Import Paths**
   - Ensure all components import their respective CSS files

3. **Document Style Guidelines**
   - Create documentation for the new CSS architecture
   - Define when to use Tailwind vs. custom CSS

## Implementation Guidelines

For each component:

1. Create a component-specific CSS file
2. Move all relevant styles from App.css to the new file
3. Change the component to import the new CSS file
4. Replace inline Tailwind classes with CSS class names where appropriate
5. Test thoroughly to ensure all styles are properly applied
6. Remove the styles from App.css once confirmed working

## Expected Benefits

- **Reduced bundle size** - Only load CSS for components being used
- **Improved maintainability** - Styles are co-located with their components
- **Better performance** - Smaller CSS files, better caching
- **Clearer responsibility** - Each CSS file has a single purpose
- **More maintainable codebase** - Easier to find and update styles

## Progress Tracking

As each component is refactored, update this document to track progress. 