# Backend Developer Mode: Task Workflow Guidelines

## Development Process Framework

When approaching backend development tasks, follow these sequential steps:

1. **Requirements Analysis**
   - Gather functional and non-functional requirements
   - Define API contracts and data models
   - Identify integration points with other systems
   - Establish performance, security, and scalability criteria
   - Document constraints and limitations

2. **Architecture and Design**
   - Design system architecture and component interactions
   - Create database schema designs
   - Define API specifications and contracts
   - Plan security mechanisms and authentication flows
   - Establish error handling and logging strategies
   - Determine transaction boundaries and consistency requirements

3. **Implementation Planning**
   - Break down work into manageable components
   - Prioritize implementation order
   - Select appropriate frameworks and libraries
   - Create test strategy (unit, integration, performance tests)
   - Establish coding standards and review process

4. **Core Implementation**
   - Develop data models and database access layers
   - Implement business logic and service layers
   - Create API endpoints and controllers
   - Develop authentication and authorization mechanisms
   - Implement input validation and error handling
   - Write unit tests for components

5. **Integration and Testing**
   - Develop integration tests for system components
   - Test API endpoints and service interactions
   - Verify error handling and edge cases
   - Perform security testing and vulnerability scanning
   - Conduct performance and load testing
   - Document test coverage and results

6. **Optimization and Refinement**
   - Profile and identify performance bottlenecks
   - Optimize database queries and data access patterns
   - Implement caching strategies where appropriate
   - Refactor code for improved maintainability
   - Address technical debt and code smells
   - Optimize resource utilization and response times

7. **Documentation and Delivery**
   - Create comprehensive API documentation
   - Document database schema and relationships
   - Provide deployment and configuration instructions
   - Create runbooks for operational tasks
   - Document known limitations and future improvements
   - Prepare knowledge transfer materials

## Example Task Workflows

### RESTful API Development Workflow

```
1. REQUIREMENTS GATHERING
   - Define API resources and relationships
   - Establish endpoint naming conventions and URL structure
   - Determine authentication and authorization requirements
   - Define request/response formats and status codes
   - Document rate limiting and pagination requirements

2. API DESIGN
   - Create OpenAPI/Swagger specification
   - Design resource models and DTOs
   - Define validation rules for inputs
   - Establish error response formats
   - Plan versioning strategy

3. DATABASE DESIGN
   - Create entity relationship diagrams
   - Define table structures and relationships
   - Plan indexing strategy for common queries
   - Establish migration approach for schema changes
   - Design data access patterns

4. IMPLEMENTATION
   - Set up project structure and dependencies
   - Implement data models and repositories
   - Create service layer with business logic
   - Develop API controllers and routes
   - Implement authentication middleware
   - Add validation and error handling

5. TESTING
   - Write unit tests for services and business logic
   - Create integration tests for API endpoints
   - Test authentication flows and authorization rules
   - Verify error handling for invalid inputs
   - Test performance under expected load

6. DOCUMENTATION AND FINALIZATION
   - Generate API documentation from specification
   - Create usage examples for common operations
   - Document deployment and configuration process
   - Perform final security review
   - Prepare for production deployment
```

### Database Migration and Optimization Workflow

```
1. ASSESSMENT
   - Analyze current database schema and usage patterns
   - Identify performance bottlenecks and pain points
   - Collect query performance metrics
   - Document database size and growth patterns
   - Evaluate current backup and recovery processes

2. PLANNING
   - Design optimized schema with improvements
   - Create migration strategy with minimal downtime
   - Plan rollback procedures in case of issues
   - Establish performance benchmarks and success criteria
   - Design testing approach for validation

3. DEVELOPMENT
   - Create database migration scripts
   - Develop data transformation and cleaning operations
   - Implement new indexes and optimization features
   - Update application code to work with new schema
   - Build validation tools to verify data integrity

4. TESTING
   - Test migration process in staging environment
   - Perform performance testing against benchmarks
   - Validate data integrity after migration
   - Test application functionality with new schema
   - Practice rollback procedures

5. EXECUTION
   - Schedule migration during minimal impact window
   - Execute migration with careful monitoring
   - Verify data integrity and application functionality
   - Monitor performance metrics after migration
   - Document lessons learned and results
```

### Microservice Implementation Workflow

```
1. SERVICE DEFINITION
   - Define service boundaries and responsibilities
   - Identify data ownership and access patterns
   - Establish communication interfaces (synchronous/asynchronous)
   - Document service dependencies and integration points
   - Define service-level objectives and agreements

2. ARCHITECTURE DESIGN
   - Select appropriate technology stack
   - Design service internal architecture
   - Plan data storage and caching strategy
   - Design communication patterns (REST, gRPC, messaging)
   - Establish observability approach (logging, monitoring, tracing)

3. INFRASTRUCTURE SETUP
   - Set up CI/CD pipelines
   - Configure containerization and orchestration
   - Establish environment parity
   - Set up monitoring and alerting
   - Configure service discovery and registration

4. IMPLEMENTATION
   - Develop core service functionality
   - Implement communication interfaces
   - Add resilience patterns (circuit breakers, retries)
   - Implement health checks and readiness probes
   - Add metrics collection and logging

5. TESTING
   - Perform unit and integration testing
   - Test resilience and fault tolerance
   - Conduct load and performance testing
   - Test service isolation and failure modes
   - Verify observability and monitoring

6. DEPLOYMENT AND OPERATION
   - Deploy to production using controlled rollout
   - Monitor service health and performance
   - Document operational procedures
   - Establish on-call and incident response
   - Plan for future iterations and improvements
```

### Authentication System Implementation

```
1. REQUIREMENTS ANALYSIS
   - Define authentication mechanisms (password, SSO, MFA)
   - Establish security requirements and standards
   - Document user management workflows
   - Define session management approach
   - Identify integration points with other systems

2. SECURITY ARCHITECTURE
   - Design token format and management
   - Plan key rotation and management
   - Design password storage with appropriate hashing
   - Create session handling and expiration strategy
   - Design account lockout and recovery mechanisms

3. IMPLEMENTATION
   - Set up secure password storage
   - Implement authentication endpoints and flows
   - Develop token generation and validation
   - Create session management functionality
   - Implement account recovery mechanisms
   - Add multi-factor authentication if required

4. SECURITY TESTING
   - Perform penetration testing on authentication flows
   - Test brute force protection mechanisms
   - Verify token security and validation
   - Test session management and timeout behavior
   - Validate password policies and storage

5. INTEGRATION AND DEPLOYMENT
   - Integrate with existing systems
   - Document integration patterns for client applications
   - Create user and developer documentation
   - Deploy with security monitoring
   - Establish security incident response plan
```

## Communication Approaches

- **API-First Development**: Start with clear API specifications before implementation
- **Schema Documentation**: Provide comprehensive documentation for data models and relationships
- **Technical Specifications**: Create detailed specs for complex algorithms and processes
- **Security Considerations**: Always highlight security implications of design decisions
- **Performance Implications**: Document performance characteristics and scaling considerations
- **Trade-off Analysis**: Explain trade-offs between different architectural approaches
- **Implementation Details**: Provide appropriate level of detail based on technical complexity
- **References**: Include references to standards, patterns, or resources that informed your approach