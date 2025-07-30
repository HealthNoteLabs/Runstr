# RUNSTR Design Consistency Project - Progress Tracker

## Project Overview
**Goal:** Transform RUNSTR from inconsistent visual styling into a cohesive, professional running app with unified design system while preserving all existing functionality.

**Timeline:** 4 weeks  
**Started:** [Current Date]  
**Designer Mode:** Simple UI Designer (Architecture-First Planning)

## Core Principles
- **Architecture-First Planning**: Analyze existing patterns before making changes
- **Incremental Improvement**: Small, focused changes building on existing patterns
- **Functionality Preservation**: Never modify props, state management, or business logic
- **Mobile-Optimized**: Design for runners in motion, outdoor conditions, one-handed operation

## Project Goals

### ✅ **Phase 1: Foundation (Week 1)**
- [ ] **Color System Unification**
  - [ ] Update CSS variables with standardized tokens
  - [ ] Modify Tailwind config for new design system
  - [ ] Remove hardcoded color values
  - [ ] Test color contrast ratios (WCAG AA compliance)

- [ ] **Typography Standardization**
  - [ ] Define consistent text scales
  - [ ] Update font weight hierarchy
  - [ ] Ensure mobile readability

- [ ] **Spacing System**
  - [ ] Standardize margin/padding patterns
  - [ ] Define consistent border radius values
  - [ ] Update shadow system

### ⏳ **Phase 2: Core Components (Week 2)**
- [ ] **Shared UI Components**
  - [ ] Standardize Button component variants
  - [ ] Update Card component styling
  - [ ] Unify Input/Form elements
  - [ ] Standardize Badge/Chip components
  - [ ] Create consistent Avatar styling

- [ ] **Navigation Components**
  - [ ] Unify MenuBar styling
  - [ ] Standardize tab navigation patterns
  - [ ] Consistent iconography usage
  - [ ] Update active/hover states

### ⏳ **Phase 3: Page Consistency (Week 3)**
- [ ] **High-Priority Pages**
  - [ ] Dashboard page standardization
  - [ ] Settings page consistency
  - [ ] RunTracker interface updates
  - [ ] MenuBar modal consistency

- [ ] **Secondary Pages**
  - [ ] Teams pages
  - [ ] Music interface
  - [ ] Profile/History pages
  - [ ] Achievement displays

### ⏳ **Phase 4: Polish & Testing (Week 4)**
- [ ] **Final Consistency Review**
  - [ ] Cross-component consistency check
  - [ ] Dark mode optimization
  - [ ] Accessibility improvements
  - [ ] Performance verification

- [ ] **Testing & Validation**
  - [ ] Mobile responsiveness testing
  - [ ] Outdoor visibility testing
  - [ ] Battery impact assessment
  - [ ] Functionality regression testing

## Current State Analysis

### ❌ **Identified Issues**
1. **Color Inconsistencies (8+ variations)**
   - `#1a222e`, `#111827`, `#0a1525`, `#0b101a` (backgrounds)
   - `#9ca3af`, `#a5adcf`, `text-gray-400` (text colors)
   - Mixed purple/indigo accent usage

2. **Styling Architecture Problems**
   - Inline styles + Tailwind classes + CSS variables
   - DashboardRunCard uses inline styles
   - MenuBar uses Tailwind classes
   - Settings page uses different approach

3. **Component Inconsistencies**
   - Different card designs across features
   - Inconsistent button styles and states
   - Modal/overlay pattern variations
   - Mixed typography approaches

## Design System Specifications

### **Color Palette (Target)**
```css
/* Core Backgrounds (Running-optimized) */
--bg-primary: #0F1419      /* Main dark background */
--bg-secondary: #1A202C    /* Card backgrounds */
--bg-tertiary: #2D3748     /* Input/form backgrounds */

/* High Contrast Text (outdoor visibility) */
--text-primary: #F7FAFC    /* Primary text */
--text-secondary: #E2E8F0  /* Secondary text */
--text-muted: #A0AEC0      /* Muted text */

/* Brand Colors */
--primary: #8B5CF6         /* Purple - brand primary */
--primary-hover: #7C3AED   /* Purple hover state */
--secondary: #3B82F6       /* Blue - secondary actions */

/* Status Colors */
--success: #48BB78         /* Distance/achievements */
--warning: #ED8936         /* Pace/performance */
--error: #F56565           /* Alerts/dangers */
--bitcoin: #F7931A         /* Bitcoin orange */
```

### **Typography Scale (Target)**
```css
--text-xs: 0.75rem     /* 12px */
--text-sm: 0.875rem    /* 14px */
--text-base: 1rem      /* 16px */
--text-lg: 1.125rem    /* 18px */
--text-xl: 1.25rem     /* 20px */
--text-2xl: 1.5rem     /* 24px */
--text-3xl: 1.875rem   /* 30px */
```

### **Spacing Scale (Target)**
```css
--spacing-1: 0.25rem   /* 4px */
--spacing-2: 0.5rem    /* 8px */
--spacing-3: 0.75rem   /* 12px */
--spacing-4: 1rem      /* 16px */
--spacing-6: 1.5rem    /* 24px */
--spacing-8: 2rem      /* 32px */
```

## Key Files to Update

### **Phase 1 Files**
- [ ] `src/assets/styles/variables.css` - Update color tokens
- [ ] `tailwind.config.js` - Update design system
- [ ] `src/assets/styles/main.css` - Global styles

### **Phase 2 Files**
- [ ] `src/components/ui/button.tsx` - Standardize buttons
- [ ] `src/components/ui/card.tsx` - Unify card styling
- [ ] `src/components/ui/badge.tsx` - Consistent badges
- [ ] `src/components/MenuBar.jsx` - Navigation consistency

### **Phase 3 Files**
- [ ] `src/components/DashboardRunCard.jsx` - Remove inline styles
- [ ] `src/pages/Settings.jsx` - Consistent form styling
- [ ] `src/components/RunTracker.jsx` - Unified interface
- [ ] `src/components/RunHistoryCard.tsx` - Consistent cards

## Success Metrics

### **Technical Metrics**
- [ ] Zero hardcoded color values in components
- [ ] All components use design tokens
- [ ] Consistent spacing scale usage
- [ ] WCAG AA contrast compliance

### **Visual Metrics**
- [ ] Professional, cohesive appearance
- [ ] Every screen feels like same app
- [ ] Improved outdoor visibility
- [ ] Consistent interaction patterns

### **Functional Metrics**
- [ ] No functionality regression
- [ ] All existing features work perfectly
- [ ] Performance maintained/improved
- [ ] Mobile experience optimized

## Progress Log

### **Week 1 - Foundation**
**Day 1:** 
- [x] Completed comprehensive design analysis
- [x] Created progress tracking document
- [ ] Starting CSS variables update
- [ ] Tailwind configuration update

**Day 2-7:** 
- [ ] Foundation implementation
- [ ] Initial testing
- [ ] Component preparation

### **Week 2 - Components**
- [ ] TBD based on Week 1 progress

### **Week 3 - Pages**
- [ ] TBD based on Week 2 progress

### **Week 4 - Polish**
- [ ] TBD based on Week 3 progress

## Notes & Decisions

### **Design Decisions Made**
1. **Dark Mode First**: RUNSTR is primarily used outdoors, dark mode reduces battery drain
2. **Purple Primary**: Maintains existing brand identity with `#8B5CF6`
3. **High Contrast**: All text meets WCAG AA standards for outdoor visibility
4. **Bitcoin Orange**: Preserved as `#F7931A` for brand consistency

### **Technical Decisions Made**
1. **CSS Variables**: Primary method for color tokens
2. **Tailwind Extensions**: Leverage existing framework with custom tokens
3. **Inline Style Removal**: Migrate all inline styles to design system
4. **Component-First**: Update shared components before pages

### **Risks & Mitigation**
- **Risk**: Breaking existing functionality
  - **Mitigation**: Only modify visual properties, never logic
- **Risk**: Performance regression
  - **Mitigation**: Minimize CSS complexity, test battery usage
- **Risk**: Inconsistent implementation
  - **Mitigation**: Clear design system documentation, step-by-step approach

---

## Next Steps
1. ✅ Complete foundation updates (CSS variables + Tailwind)
2. ⏳ Test foundation changes across key components
3. ⏳ Begin core component standardization
4. ⏳ Document any issues or required adjustments

**Last Updated:** [Current Date]  
**Status:** In Progress - Foundation Phase 