# Backend Developer Mode: Development Principles and Best Practices

## SOLID Principles

### Single Responsibility Principle
- Each class or module should have one and only one reason to change
- Separate concerns by functionality and domain context
- Avoid "god" classes that handle too many responsibilities
- Focus on cohesive functionality in each component

### Open/Closed Principle
- Software entities should be open for extension but closed for modification
- Use abstractions and polymorphism to allow new functionality without changing existing code
- Design with inheritance and interfaces to create extensible systems
- Favor composition over inheritance when appropriate

### Liskov Substitution Principle
- Subtypes must be substitutable for their base types without altering program correctness
- Respect contracts established by base classes and interfaces
- Ensure inherited methods maintain expected behavior
- Avoid violating parent class invariants in subclasses

### Interface Segregation Principle
- Clients should not be forced to depend on interfaces they do not use
- Create focused, specific interfaces rather than large, general-purpose ones
- Design role-based interfaces that align with client needs
- Split large interfaces into smaller, more specific ones

### Dependency Inversion Principle
- High-level modules should not depend on low-level modules; both should depend on abstractions
- Abstractions should not depend on details; details should depend on abstractions
- Use dependency injection to provide required dependencies
- Create clear boundaries between system layers through interfaces

## Security Principles

- **Defense in Depth**: Implement multiple layers of security controls
- **Principle of Least Privilege**: Grant minimal access rights required for functionality
- **Input Validation**: Validate all input data for format, type, range, and content
- **Output Encoding**: Encode output to prevent injection attacks
- **Secure Authentication**: Implement robust authentication mechanisms with proper password handling
- **Authorization Controls**: Enforce proper authorization checks on all resources
- **Data Protection**: Encrypt sensitive data at rest and in transit
- **Rate Limiting**: Protect against abuse and DoS attacks
- **Error Handling**: Avoid leaking sensitive information in error messages
- **Regular Updates**: Keep dependencies and libraries updated to patch vulnerabilities
- **Security Testing**: Perform regular security assessments and penetration testing

## Scalability Guidelines

- **Horizontal Scaling**: Design for adding more instances rather than bigger instances
- **Statelessness**: Minimize server-side state to enable easier scaling
- **Distributed Caching**: Implement caching strategies to reduce database load
- **Asynchronous Processing**: Use message queues for background processing
- **Database Sharding**: Partition data across multiple database instances
- **Load Balancing**: Distribute traffic evenly across service instances
- **Microservices**: Consider decomposing complex systems into focused services
- **Circuit Breakers**: Implement failure handling to prevent cascading failures
- **Auto-scaling**: Design systems to automatically scale based on demand
- **Resource Pooling**: Efficiently manage connection pools to databases and services

## Performance Optimization

- **Efficient Algorithms**: Choose appropriate algorithms with optimal time/space complexity
- **Database Indexing**: Create proper indexes for query patterns
- **Query Optimization**: Analyze and optimize database queries for performance
- **Caching Strategies**: Implement multi-level caching (memory, distributed, CDN)
- **Connection Pooling**: Reuse expensive resource connections
- **Bulk Operations**: Use batch processing for multiple similar operations
- **Lazy Loading**: Load resources only when needed
- **Resource Compression**: Compress data for transmission and storage
- **Pagination**: Implement pagination for large datasets
- **Optimized Data Formats**: Use efficient data formats for transmission
- **Profiling**: Regularly profile code to identify bottlenecks

## Database Design Principles

- **Normalization**: Design normalized schemas to reduce redundancy and improve integrity
- **Denormalization**: Strategically denormalize when performance requirements demand it
- **Indexing Strategy**: Create indexes based on query patterns and performance needs
- **Relationship Modeling**: Properly define entity relationships (one-to-one, one-to-many, many-to-many)
- **Constraints**: Implement appropriate constraints to maintain data integrity
- **Transaction Management**: Use transactions to maintain consistency
- **Query Optimization**: Design schemas that support efficient queries
- **Data Types**: Select appropriate data types for columns to optimize storage and performance
- **Schema Evolution**: Plan for schema changes and database migrations
- **Backup and Recovery**: Design with data recovery capabilities in mind

## API Design Best Practices

- **RESTful Principles**: Follow REST conventions when appropriate
- **Resource-Oriented Design**: Model APIs around resources, not actions
- **Versioning**: Implement API versioning to manage changes
- **Consistent Naming**: Use consistent naming conventions for endpoints and parameters
- **Proper HTTP Methods**: Use appropriate HTTP methods (GET, POST, PUT, DELETE, etc.)
- **Status Codes**: Use standard HTTP status codes correctly
- **Pagination**: Implement pagination for collection endpoints
- **Filtering and Sorting**: Support filtering and sorting of resource collections
- **Comprehensive Documentation**: Document all endpoints, parameters, and responses
- **API Rate Limiting**: Implement rate limiting to prevent abuse
- **HATEOAS**: Consider hypermedia links for resource discovery
- **Content Negotiation**: Support multiple response formats when needed

## Error Handling and Validation

- **Comprehensive Validation**: Validate all input at the API boundary
- **Consistent Error Responses**: Standardize error response format
- **Appropriate Detail Level**: Balance between helpful errors and security concerns
- **Transactional Integrity**: Ensure operations maintain database consistency
- **Graceful Degradation**: Handle partial failures appropriately
- **Retry Mechanisms**: Implement retry logic for transient failures
- **Circuit Breakers**: Prevent cascading failures in distributed systems
- **Logging**: Log errors with appropriate context for troubleshooting
- **Monitoring**: Track error rates and patterns through monitoring
- **User Feedback**: Provide actionable error messages for client applications

## System Architecture Considerations

- **Layered Architecture**: Organize code into logical layers (presentation, business, data)
- **Separation of Concerns**: Separate different aspects of the application
- **Service Boundaries**: Define clear service boundaries based on business domains
- **Communication Patterns**: Choose appropriate communication patterns (sync/async)
- **State Management**: Determine where and how to manage application state
- **Event-Driven Architecture**: Consider event-driven approaches for loose coupling
- **Infrastructure as Code**: Define infrastructure through code for reproducibility
- **Observability**: Design for logging, monitoring, and tracing
- **Fault Tolerance**: Build systems that can withstand partial failures
- **Deployment Strategies**: Plan for zero-downtime deployments