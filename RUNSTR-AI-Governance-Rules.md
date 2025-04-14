# RUNSTR AI Governance Rules

## Introduction

This document establishes governance rules for AI-assisted development in the RUNSTR project, focusing on minimizing AI mistakes and hallucinations while maintaining development velocity. These rules are designed to be practical and implementable without significantly slowing down the development process.

## 1. Risk-Based Classification System

### 1.1 Code Area Risk Classification

| Risk Level | Description | Example Areas |
|------------|-------------|---------------|
| **Critical** | Core functionality where errors directly impact data integrity | GPS tracking algorithms, distance calculation, activity data processing |
| **High** | Features that affect user experience or data presentation | Splits calculation, pace estimation, elevation data processing |
| **Medium** | UI components and non-critical features | Dashboard displays, history views, team features |
| **Low** | Documentation, styling, and non-functional elements | Comments, CSS, readme files |

### 1.2 AI Usage Guidelines by Risk Level

| Risk Level | AI Usage Guidelines | Verification Requirements |
|------------|---------------------|---------------------------|
| **Critical** | Use AI only for initial drafts; heavy human oversight | Comprehensive manual review + specialized testing |
| **High** | AI can generate implementation with guidance | Manual review + relevant test cases |
| **Medium** | AI can generate full implementations | Spot checking + basic testing |
| **Low** | AI can be used with minimal restrictions | Basic review for correctness |

## 2. Verification Protocols

### 2.1 Critical Area Verification Protocol

For GPS tracking, distance calculation, and activity data processing:

1. **Isolated Function Testing**: Validate AI-generated functions with known test cases in isolation
2. **Integration Verification**: Test function behavior in the context of the full system
3. **Edge Case Matrices**: Test with predefined matrices of edge cases specific to the RUNSTR domain
4. **Manual Code Review Checklist**:
   - [ ] Algorithm logic matches requirements
   - [ ] Edge cases are handled correctly
   - [ ] Data transformation preserves integrity
   - [ ] No unnecessary performance impacts
   - [ ] Consistent with existing architecture

### 2.2 High Area Verification Protocol

For features that affect user experience or data presentation:

1. **Requirement Alignment Check**: Verify AI-generated code meets the feature requirements
2. **API Usage Verification**: Ensure correct usage of internal and external APIs
3. **Basic Edge Case Testing**: Verify behavior in common edge cases
4. **Manual Review Checklist**:
   - [ ] Feature requirements are fully implemented
   - [ ] UI/UX is consistent with design standards
   - [ ] Common edge cases are handled

### 2.3 Verification Efficiency Techniques

To maintain development velocity:

1. **Pre-implemented Test Fixtures**: Maintain a library of test fixtures for common critical components
2. **Automated Comparison**: Develop tools to compare AI output against known patterns
3. **Parallel Verification**: Conduct verification in parallel with next development steps
4. **Verification Templates**: Use standardized templates to speed up the verification process

## 3. Implementation Requirements

### 3.1 Requirements for Critical Areas

When implementing changes to GPS tracking or activity data processing:

```javascript
// EXAMPLE: GPS Data Processing Implementation Requirements
// 1. Must validate inputs (demonstrated below)
// 2. Must handle GPS signal loss gracefully
// 3. Must preserve data precision 
// 4. Must include explicit error handling
// 5. Must avoid performance degradation

function processGPSData(coordinates) {
  // Input validation
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    logError('Invalid GPS data format');
    return fallbackProcessing(coordinates);
  }
  
  // Signal loss detection
  const gapsDetected = detectGaps(coordinates);
  if (gapsDetected) {
    coordinates = handleGPSGaps(coordinates);
  }
  
  // Precision preservation (example of what AI might miss)
  // BAD: const distance = Math.round(calculateDistance(coordinates));
  // GOOD: Preserve precision for internal calculations
  const distance = calculateDistance(coordinates);
  
  // Only round for display, not for storage
  return {
    rawDistance: distance,
    displayDistance: formatDistanceForDisplay(distance),
    coordinates: coordinates,
    gapsProcessed: gapsDetected
  };
}
```

### 3.2 Testing Requirements for Critical Areas

```javascript
// EXAMPLE: Test Requirements for Distance Calculation

// 1. Must test with real-world GPS data samples
// 2. Must include edge cases (GPS drift, signal loss, etc.)
// 3. Must verify precision maintenance
// 4. Must test performance with large datasets

describe('Distance Calculation', () => {
  // Standard cases
  test('Calculates correct distance for straight path', () => {
    const straightPath = loadTestFixture('straight-path.json');
    expect(calculateDistance(straightPath)).toBeCloseTo(5.0, 4);
  });
  
  // Edge cases that AI might miss
  test('Handles GPS drift correctly', () => {
    const driftPath = loadTestFixture('gps-drift.json');
    expect(calculateDistance(driftPath)).toBeCloseTo(3.2, 4);
  });
  
  test('Maintains accuracy with GPS signal loss', () => {
    const gapPath = loadTestFixture('signal-gap.json');
    expect(calculateDistance(gapPath)).toBeCloseTo(2.7, 4);
  });
  
  // Performance test
  test('Processes large datasets efficiently', () => {
    const largePath = generateLargePath(10000);
    const startTime = performance.now();
    calculateDistance(largePath);
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(200); // Max 200ms
  });
});
```

## 4. Human Oversight Mechanisms

### 4.1 Tiered Review System

| Code Area Risk Level | Primary Reviewer | Secondary Reviewer | Review Depth |
|----------------------|------------------|-------------------|--------------|
| Critical | Original developer | Domain expert | Line-by-line |
| High | Original developer | Team lead or peer | Component-level |
| Medium | Original developer | Automated checks + spot review | Key sections |
| Low | Automated checks | None required | Automated only |

### 4.2 Review Efficiency Guidelines

To maintain development velocity:

1. **Review Preparation**: Annotate AI-generated code with rationale before review
2. **Focused Reviews**: Focus intensive reviews only on critical functions
3. **Review Checklists**: Use standardized checklists tailored to area risk level
4. **Incremental Reviews**: Review complex changes incrementally rather than all at once

## 5. Edge Case Handling Procedures

### 5.1 Critical System Edge Cases Registry

Maintain a registry of known edge cases for GPS and activity tracking:

| Edge Case | Description | Test Fixture | Verification Method |
|-----------|-------------|--------------|---------------------|
| GPS Signal Loss | Temporary loss of coordinates during tracking | signal-loss.json | Automated test + visual inspection |
| GPS Drift | Coordinate instability while stationary | drift-pattern.json | Automated test |
| Elevation Anomalies | Sudden changes in elevation data | elevation-spike.json | Visualization + automated detection |
| Device Sleep | App backgrounded during activity tracking | sleep-mode.json | Manual testing with device |

### 5.2 Edge Case Test Generation

```javascript
// EXAMPLE: Edge Case Generator for GPS Data

function generateEdgeCaseTests(baseCoordinates) {
  return {
    signalLoss: insertSignalGaps(baseCoordinates, [0.2, 0.5, 0.8]),
    drift: addRandomDrift(baseCoordinates, 0.00005),
    elevationSpikes: addElevationAnomalies(baseCoordinates, [100, -100]),
    speedAnomalies: addSpeedVariation(baseCoordinates, [0, 2.5, 0])
  };
}

// Usage in tests
const baseRoute = loadSampleRoute('standard-5k.json');
const edgeCases = generateEdgeCaseTests(baseRoute);

// Test AI-implemented functions against all edge cases
Object.entries(edgeCases).forEach(([caseName, testData]) => {
  test(`Distance calculation handles ${caseName} correctly`, () => {
    // Test implementation here
  });
});
```

## 6. Output Consistency Checks

### 6.1 Code Pattern Consistency

```javascript
// EXAMPLE: Consistency Check for Activity Data Processing

const activityDataPatterns = {
  // Define expected patterns for activity data processing
  dataTransformation: /\.map\(.*\)\.filter\(.*\)/,
  errorHandling: /try\s*{.*}\s*catch\s*{.*}/,
  nullChecking: /if\s*\(\s*!.*\s*\)/
};

function checkCodePatternConsistency(code, patterns) {
  const inconsistencies = [];
  
  Object.entries(patterns).forEach(([patternName, regex]) => {
    if (!regex.test(code)) {
      inconsistencies.push(`Missing ${patternName} pattern`);
    }
  });
  
  return {
    consistent: inconsistencies.length === 0,
    issues: inconsistencies
  };
}

// Usage in review process
const newImplementation = getAIGeneratedCode();
const consistencyCheck = checkCodePatternConsistency(
  newImplementation, 
  activityDataPatterns
);

if (!consistencyCheck.consistent) {
  console.warn('AI generated code has consistency issues:', 
    consistencyCheck.issues);
}
```

### 6.2 Automated Output Validation

For routine validation of AI-generated code:

1. **Linting Integration**: Configure linters to flag common AI error patterns
2. **Static Analysis**: Use static analysis tools focused on domain-specific issues
3. **Output Diffs**: Compare AI outputs against known good implementations

## 7. Knowledge Boundary Recognition

### 7.1 AI Knowledge Boundary Definition

Define clear boundaries for AI tools in the RUNSTR domain:

| Domain Area | AI Knowledge Boundary | Verification Approach |
|-------------|----------------------|------------------------|
| GPS Algorithms | Base algorithm understanding only | Expert review of algorithm implementation |
| Distance Calculation | Standard formulas only | Verify against known-good implementations |
| Data Processing | General patterns only | Test with RUNSTR-specific data fixtures |
| Nostr Protocol | Basic understanding only | Verify against protocol specifications |

### 7.2 Knowledge Boundary Verification Checklist

When AI generates code that approaches knowledge boundaries:

- [ ] Is the implementation based on general knowledge or RUNSTR-specific knowledge?
- [ ] Does the implementation make assumptions about the data model?
- [ ] Are there domain-specific edge cases not considered?
- [ ] Does the implementation match RUNSTR's existing patterns?

## 8. Factual Verification Workflows

### 8.1 Cross-Reference System

For verifying AI-generated code against known facts:

1. **Documentation Cross-Reference**: Verify against official documentation
2. **Existing Implementation Cross-Reference**: Compare with existing code patterns
3. **Test Case Cross-Reference**: Verify behavior matches existing test cases

### 8.2 Automated Fact Checking

Example of automated verification for distance calculation:

```javascript
// EXAMPLE: Automated fact checking for distance calculation algorithms

const knownDistances = {
  'straight_line_5points': 1.5,
  'curve_10points': 2.3,
  'complex_path_20points': 4.7
};

function verifyDistanceCalculation(implementationUnderTest) {
  const verificationResults = {};
  
  Object.entries(knownDistances).forEach(([testName, expectedDistance]) => {
    const testPath = loadTestFixture(`${testName}.json`);
    const calculatedDistance = implementationUnderTest(testPath);
    
    verificationResults[testName] = {
      expected: expectedDistance,
      actual: calculatedDistance,
      passed: Math.abs(calculatedDistance - expectedDistance) < 0.001
    };
  });
  
  return verificationResults;
}

// Usage
const aiImplementation = require('./ai-distance-calculation.js');
const verificationResults = verifyDistanceCalculation(aiImplementation.calculateDistance);

console.log('Verification results:', verificationResults);
```

## 9. Uncertainty Management

### 9.1 Confidence Levels for AI-Generated Code

Define confidence levels for AI implementations:

| Confidence Level | Criteria | Required Action |
|------------------|----------|----------------|
| High | Matches existing patterns, passes all tests | Standard review |
| Medium | Minor variations from patterns, passes tests | Detailed review |
| Low | Significant deviations, or novel approach | Expert review + extensive testing |
| Uncertain | Contains comments indicating uncertainty or uses non-standard approaches | Rewrite or get expert input |

### 9.2 Explicit Uncertainty Handling

Guidelines for handling uncertain AI outputs:

1. Flag uncertain sections with `// VERIFY:` comments
2. Document assumptions that need verification
3. Provide alternative implementations for verification
4. Always fall back to simpler, well-understood implementations when uncertainty is high

## 10. Fallback Mechanisms

### 10.1 Critical Function Fallbacks

For core tracking functionality:

```javascript
// EXAMPLE: Fallback mechanism for GPS processing

// Primary implementation (potentially AI-generated)
function calculateDistance(coordinates) {
  try {
    // Complex, potentially AI-generated algorithm
    return enhancedDistanceCalculation(coordinates);
  } catch (error) {
    // Log the failure for analysis
    logAIImplementationFailure(error, 'distance_calculation');
    
    // Fall back to the verified, simpler implementation
    return fallbackDistanceCalculation(coordinates);
  }
}

// Verified fallback implementation
function fallbackDistanceCalculation(coordinates) {
  // Simple, well-tested algorithm
  let distance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    distance += haversineDistance(
      coordinates[i-1].latitude, 
      coordinates[i-1].longitude,
      coordinates[i].latitude, 
      coordinates[i].longitude
    );
  }
  return distance;
}
```

### 10.2 Progressive Enhancement Pattern

For implementing new features with AI:

1. Start with minimal, verified base functionality
2. Add AI-generated enhancements incrementally
3. Maintain ability to disable enhancements if issues are discovered
4. Include feature flags for quick rollback

## 11. Regular Auditing Cycles

### 11.1 Audit Schedule by Risk Level

| Risk Level | Audit Frequency | Depth | Responsible Party |
|------------|----------------|-------|-------------------|
| Critical | Bi-weekly | Comprehensive | Technical lead + domain expert |
| High | Monthly | Key components | Technical lead |
| Medium | Quarterly | Sample-based | Developer team |
| Low | Bi-annually | Automated checks | Automated system |

### 11.2 Practical Audit Process

To maintain development velocity:

1. **Incremental Audits**: Audit small portions regularly instead of large reviews
2. **Automated Pre-Audit**: Use tools to identify risk areas before manual review
3. **Issue-Triggered Audits**: Conduct targeted audits when issues are reported
4. **Combined Audits**: Combine audits with regular code reviews

## 12. Evaluation Criteria for AI Models

### 12.1 Model Evaluation Matrix

| Criterion | Description | Measurement Method |
|-----------|-------------|-------------------|
| Code Correctness | Functional correctness of generated code | Error rate in test suite |
| Pattern Adherence | Consistency with RUNSTR patterns | Pattern adherence score |
| Edge Case Handling | Effective handling of domain edge cases | Edge case test pass rate |
| Documentation Quality | Clarity and completeness of comments | Documentation coverage score |
| Code Efficiency | Performance characteristics | Benchmark comparison |

### 12.2 Model Selection Framework

Decision tree for choosing appropriate AI tools for different tasks:

```
if (task_area == "critical") {
  if (task_complexity == "high") {
    return "human_implementation_with_ai_assistance";
  } else {
    return "ai_implementation_with_expert_review";
  }
} else if (task_area == "high") {
  if (ai_confidence_score > 0.8) {
    return "ai_implementation_with_standard_review";
  } else {
    return "ai_implementation_with_detailed_review";
  }
} else {
  return "standard_ai_implementation";
}
```

## 13. Testing Frameworks

### 13.1 AI-Generated Code Specific Tests

Extended test requirements for AI-generated code in critical areas:

1. **Boundary Value Tests**: Test at and beyond expected input boundaries
2. **Metamorphic Testing**: Test with transformed inputs that should produce predictable output transformations
3. **Chaos Testing**: Introduce randomness to inputs to verify robustness
4. **Performance Degradation Testing**: Verify performance across varying input sizes

### 13.2 Testing Framework Implementation

```javascript
// EXAMPLE: Extended test framework for AI-generated tracking code

class AICodeTestSuite {
  constructor(implementationUnderTest) {
    this.implementation = implementationUnderTest;
    this.testFixtures = loadTestFixtures();
  }
  
  runStandardTests() {
    // Run standard functional tests
  }
  
  runBoundaryTests() {
    // Test with boundary values
    const emptyPath = [];
    const singlePointPath = [{ lat: 0, lng: 0 }];
    const veryLongPath = this.generateLongPath(10000);
    
    // Run implementation with each boundary case
    // and verify results
  }
  
  runMetamorphicTests() {
    // Test with transformations that should have predictable effects
    const basePath = this.testFixtures.standardPath;
    
    // Test with reverse path (should be same distance)
    const reversePath = [...basePath].reverse();
    
    // Test with scaled path (should scale distance proportionally)
    const scaledPath = this.scalePath(basePath, 2.0);
    
    // Run tests and verify results match expectations
  }
  
  runChaosTests() {
    // Introduce controlled randomness
    for (let i = 0; i < 100; i++) {
      const randomizedPath = this.addRandomNoise(
        this.testFixtures.standardPath,
        0.00001 // Small noise that shouldn't significantly affect results
      );
      
      // Verify results remain within acceptable bounds
    }
  }
  
  runPerformanceTests() {
    // Test with increasing path sizes
    [10, 100, 1000, 10000].forEach(size => {
      const path = this.generatePath(size);
      
      const startTime = performance.now();
      this.implementation(path);
      const endTime = performance.now();
      
      console.log(`Size ${size}: ${endTime - startTime}ms`);
      // Verify performance scales acceptably
    });
  }
}

// Usage
const aiDistanceCalculation = require('./ai-implementation.js');
const testSuite = new AICodeTestSuite(aiDistanceCalculation);

testSuite.runStandardTests();
testSuite.runBoundaryTests();
testSuite.runMetamorphicTests();
testSuite.runChaosTests();
testSuite.runPerformanceTests();
```

## 14. Documentation Standards

### 14.1 AI-Generated Code Documentation Requirements

Documentation requirements specifically for AI-generated code:

1. **Source Attribution**: Note which parts were AI-generated
2. **Reasoning Documentation**: Document why certain approaches were chosen
3. **Assumption Documentation**: Explicitly state all assumptions
4. **Verification Notes**: Document how the code was verified
5. **Edge Case Documentation**: Document handled edge cases

### 14.2 Documentation Template

```javascript
/**
 * RUNSTR GPS Data Processor
 * 
 * @description Processes raw GPS data for activity tracking
 * @source Core algorithm AI-assisted, modified for RUNSTR requirements
 * 
 * @assumptions
 * - Input coordinates are in [latitude, longitude] format
 * - Coordinates are chronologically ordered
 * - Sampling rate is relatively consistent
 * 
 * @verification
 * - Verified against known test routes (straight, curved, complex)
 * - Tested with signal loss simulation
 * - Performance verified with 10,000+ point routes
 * 
 * @edge_cases
 * - Handles GPS signal loss by interpolation
 * - Filters GPS drift using threshold-based detection
 * - Handles crossing the international date line
 * 
 * @modification_history
 * - 2025-03-15: Initial AI-generated implementation
 * - 2025-03-16: Modified for RUNSTR data format
 * - 2025-03-18: Added edge case handling for GPS drift
 */

function processGPSData(coordinates) {
  // Implementation
}
```

## 15. Incident Response Procedures

### 15.1 AI Error Classification

| Error Type | Description | Response Priority |
|------------|-------------|-------------------|
| Data Integrity Error | Incorrect processing of activity data | Critical |
| Algorithm Error | Flawed implementation of tracking algorithms | Critical |
| Edge Case Failure | Failure to handle specific edge cases | High |
| Performance Issue | Inefficient implementation affecting user experience | Medium |
| Style Inconsistency | Deviations from code style or patterns | Low |

### 15.2 Response Protocol Template

For critical areas (GPS tracking, distance calculation):

1. **Immediate Mitigation**: Deploy fallback implementation
2. **Root Cause Analysis**: Determine how the error passed verification
3. **Fix Implementation**: Develop and verify fix
4. **Verification Enhancement**: Update verification procedures to catch similar issues
5. **Documentation**: Document the incident and resolution

### 15.3 Learning Integration

Process for integrating learnings from incidents:

1. Update edge case registry with new case
2. Add new test case to test suite
3. Update AI guidance documentation
4. Schedule focused review of similar components

## 16. Evolution Through Feedback Loops

### 16.1 Governance Evolution Process

Process for evolving governance rules based on effectiveness:

1. **Metric Collection**: Track key metrics (error rates, verification time)
2. **Periodic Review**: Quarterly review of governance effectiveness
3. **Adaptation**: Adjust rules based on observed patterns and metrics
4. **Focused Enhancements**: Enhance rules for areas with recurring issues

### 16.2 Feedback Collection Mechanisms

Practical methods to collect feedback without disrupting workflow:

1. **Integrated Feedback**: Collect feedback during normal code reviews
2. **Quick Templates**: Use simple templates for reporting AI-related issues
3. **Automated Detection**: Use static analysis to identify potential AI errors
4. **Time Tracking**: Measure time spent on verification vs. development

## 17. Metrics for Measuring Effectiveness

### 17.1 Key Performance Indicators

| Metric | Description | Target | Collection Method |
|--------|-------------|--------|-------------------|
| AI Error Rate | % of AI-generated code requiring correction | <5% | Code review tracking |
| Critical Error Prevention | % of critical errors caught before deployment | 100% | Issue tracking |
| Verification Time | Time spent on verification as % of development | <20% | Time tracking |
| Test Coverage | Test coverage for AI-generated code | >90% | Automated test metrics |
| User-Reported Issues | Issues related to AI-generated components | Decreasing trend | Issue tracking |

### 17.2 Metric Visualization Dashboard

Example dashboard elements for tracking AI governance effectiveness:

1. **Error Trend Chart**: Track AI error rates over time
2. **Verification Efficiency**: Track verification time vs. development time
3. **Risk Area Comparison**: Compare error rates across risk areas
4. **Governance Rule Effectiveness**: Track which rules catch the most issues

## 18. Practical Implementation Workflow

### 18.1 Developer Workflow Integration

1. **Planning Phase**: Mark components by risk level in task planning
2. **Development Phase**:
   - Use AI with appropriate constraints based on risk level
   - Document assumptions and decisions
   - Apply verification checklist corresponding to risk level
3. **Review Phase**:
   - Conduct appropriate level of review based on risk level
   - Use automated tools to identify potential issues
4. **Testing Phase**:
   - Apply the appropriate testing suite based on risk level
   - Document verification results
5. **Deployment Phase**:
   - Include verification status in deployment notes
   - Monitor deployed components based on risk level

### 18.2 Quick Reference Guides

Quick reference for developers working with AI on different risk levels:

#### Critical Components Quick Guide

1. Use AI only for initial draft or partial implementation
2. Explicitly document all assumptions
3. Run complete verification suite before review
4. Require expert review of full implementation
5. Include comprehensive edge case tests

#### Medium Risk Quick Guide

1. AI can implement full feature with guidance
2. Document main decision points
3. Run standard test suite
4. Peer review key sections
5. Test common edge cases

## 19. Conclusion

These governance rules provide a practical framework for minimizing AI mistakes and hallucinations in the RUNSTR development process while maintaining development velocity. By applying different levels of verification based on code criticality, the team can focus intense scrutiny on the most important components like GPS tracking and activity data processing, while allowing more flexible approaches for less critical areas.

The rules should be reviewed quarterly and adjusted based on observed effectiveness and changing AI capabilities.

## Appendices

### Appendix A: Verification Checklists by Component

| Component | Verification Checklist |
|-----------|------------------------|
| Distance Calculation | [Link to specific checklist] |
| GPS Data Processing | [Link to specific checklist] |
| Activity Data Storage | [Link to specific checklist] |
| UI Components | [Link to specific checklist] |

### Appendix B: Common AI Error Patterns

| Pattern | Description | Detection Method |
|---------|-------------|------------------|
| Incomplete Edge Cases | Missing handling for specific edge cases | Edge case test suite |
| Over-optimization | Premature optimization causing bugs | Performance/correctness comparison |
| Framework Misuse | Incorrect usage of framework features | Static analysis |
| Domain Misunderstanding | Incorrect assumptions about domain | Domain-specific tests |

### Appendix C: Tool-Specific Guidelines

| AI Tool | Best Use Cases | Limitations | Verification Focus |
|---------|----------------|-------------|---------------------|
| GitHub Copilot | Boilerplate, standard patterns | Domain-specific logic | Logic verification |
| ChatGPT | Architecture advice, complex logic | Up-to-date information | Fact checking |
| Custom AI Tools | [Description] | [Limitations] | [Verification approach] |