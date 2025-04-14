# Full Stack Developer Mode: Development Principles and Best Practices

## Layer Integration Principles

### Unified Architecture
- Design systems with consistent patterns across all layers
- Establish clear boundaries between application tiers
- Use compatible technologies throughout the stack
- Create cohesive domain models shared between frontend and backend
- Implement consistent naming conventions across all components

### API Contract Design
- Design APIs based on frontend consumption patterns
- Maintain backward compatibility when evolving APIs
- Implement consistent response formats and error handling
- Use appropriate data transfer objects (DTOs) to decouple layers
- Document APIs comprehensively for full stack understanding
- Create clear versioning strategies for evolving interfaces

### Data Flow Management
- Establish unidirectional data flow patterns where possible
- Design efficient data transformation between layers
- Minimize redundant data processing across the stack
- Implement consistent validation at appropriate layers
- Cache effectively at multiple levels of the stack
- Optimize serialization and transport formats

## Full Stack Security Principles

### Defense in Depth
- Implement security controls at every layer of the application
- Apply the principle of least privilege throughout the system
- Validate input at all trust boundaries, not just the edge
- Implement proper authentication and authorization at all levels
- Protect against common vulnerabilities at each layer
- Ensure secure data handling throughout the application lifecycle

### Authentication & Authorization
- Implement authentication that works securely across the stack
- Design consistent authorization models for all application layers
- Apply appropriate token-based authentication mechanisms
- Protect sensitive operations at both client and server
- Implement secure session management
- Create defense mechanisms against credential theft and session hijacking

### Data Protection
- Encrypt sensitive data both in transit and at rest
- Implement proper key management across the application
- Apply appropriate data masking for sensitive information
- Follow secure coding practices in all application layers
- Ensure secure API key and secret management
- Implement appropriate access controls at all data touchpoints

## Full Stack Performance Optimization

### End-to-End Performance
- Profile and optimize the entire request lifecycle
- Identify and eliminate bottlenecks across all layers
- Balance processing load between client and server appropriately
- Implement effective caching strategies at multiple levels
- Optimize data transfer between application layers
- Monitor performance metrics across the entire stack

### Frontend-Backend Optimization
- Optimize API payload size and format for frontend consumption
- Design backend responses to minimize frontend processing
- Implement pagination and data windowing for large datasets
- Use appropriate data fetching strategies (eager vs. lazy loading)
- Balance between server-side and client-side rendering
- Optimize database queries based on UI access patterns

### Resource Utilization
- Balance computational load across application tiers
- Implement appropriate connection pooling and resource management
- Optimize memory usage throughout the application
- Design for efficient scaling of all application components
- Implement graceful degradation under heavy load
- Consider infrastructure costs in architectural decisions

## Full Stack Architecture Patterns

### Service-Oriented Approaches
- Design services around business capabilities
- Create appropriate service boundaries with clear contracts
- Implement effective service discovery and communication
- Balance between monolithic and microservice architectures
- Design for independent scaling of application components
- Consider deployment complexity when designing service architecture

### State Management
- Design consistent state management across client and server
- Implement appropriate local and distributed caching
- Consider session state handling and user context
- Design for statelessness where appropriate
- Implement effective data synchronization between layers
- Balance between optimistic and pessimistic concurrency control

### Scalability Patterns
- Design systems that can scale horizontally at all layers
- Implement appropriate database sharding and partitioning
- Design for stateless services to enable easier scaling
- Consider eventual consistency models where appropriate
- Implement effective load balancing strategies
- Design for geographic distribution when needed

## Full Stack Testing Strategies

### Comprehensive Testing
- Implement unit testing at all application layers
- Create integration tests for layer interfaces
- Design end-to-end tests for critical user journeys
- Implement API contract testing between frontend and backend
- Test both functional and non-functional requirements
- Create automated regression test suites

### Test Optimization
- Balance test coverage across different application layers
- Use appropriate mocking strategies for isolation
- Implement testing in CI/CD pipelines
- Create test data management strategies
- Design for testability in all application components
- Implement appropriate test environments that mirror production

### Quality Assurance
- Establish code quality metrics for all application layers
- Implement consistent code review processes
- Use static analysis tools for both frontend and backend
- Create performance benchmarks and test against them
- Validate security through penetration testing
- Test for accessibility throughout the application

## Developer Experience and Maintainability

### Consistent Development Patterns
- Establish coding standards that work across all layers
- Create unified documentation approaches
- Implement consistent error handling and logging
- Design for debuggability throughout the stack
- Use compatible libraries and frameworks where possible
- Create patterns for common cross-cutting concerns

### Maintainability
- Design for appropriate modularity across the stack
- Implement careful dependency management
- Balance technical debt across application layers
- Create migration strategies for evolving all parts of the system
- Design with appropriate abstractions at all levels
- Implement feature toggles and canary deployments

### Team Collaboration
- Design systems that enable parallel development
- Create clear interfaces between specialized team roles
- Implement effective version control workflows
- Design architecture that aligns with team structure
- Establish effective knowledge sharing between specialists
- Create processes for cross-layer problem resolution