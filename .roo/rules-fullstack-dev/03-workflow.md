# Full Stack Developer Mode: Task Workflow Guidelines

## Development Process Framework

When approaching full stack development tasks, follow these sequential steps:

1. **Requirements Analysis**
   - Understand business requirements and user needs
   - Identify data flow and interactions across the entire stack
   - Define API contracts and data models
   - Establish cross-cutting concerns (authentication, logging, etc.)
   - Define performance, security, and scalability requirements
   - Document technical constraints across all layers

2. **Architecture Design**
   - Design comprehensive system architecture
   - Define data models and database schema
   - Plan API endpoints and service interfaces
   - Design frontend components and user interfaces
   - Establish state management approach across layers
   - Plan authentication and authorization flows
   - Define deployment and infrastructure requirements

3. **Implementation Planning**
   - Break down work into logical components across the stack
   - Plan development sequence with appropriate dependencies
   - Establish testing strategy for all application layers
   - Select appropriate frameworks and libraries
   - Define coding standards and patterns for consistency
   - Create development environment setup

4. **Backend Foundation**
   - Implement database schema and migrations
   - Create core data models and repositories
   - Develop essential services and business logic
   - Implement API endpoints with proper validation
   - Set up authentication and authorization
   - Implement error handling and logging

5. **Frontend Implementation**
   - Create UI component structure
   - Implement responsive layouts
   - Connect to backend APIs
   - Develop state management
   - Implement user authentication flows
   - Create form validation and error handling

6. **Integration and Testing**
   - Ensure consistent data handling across layers
   - Test end-to-end user flows
   - Validate API contracts
   - Verify authentication and authorization
   - Test error scenarios and edge cases
   - Perform cross-browser and responsive testing

7. **Optimization and Enhancement**
   - Profile and optimize performance across the stack
   - Implement caching strategies
   - Optimize database queries and data access
   - Enhance frontend performance and responsiveness
   - Improve error handling and user feedback
   - Address security vulnerabilities

8. **Deployment and Documentation**
   - Create deployment pipeline for all components
   - Document API endpoints and data models
   - Provide system architecture documentation
   - Create operation and maintenance guides
   - Document known limitations and future improvements
   - Implement monitoring and logging

## Example Task Workflows

### Full Stack Web Application Development

```
1. REQUIREMENTS GATHERING
   - Define core user stories and application features
   - Identify data entities and relationships
   - Determine authentication and authorization requirements
   - Define API needs and frontend-backend interactions
   - Establish technology stack and constraints
   - Document non-functional requirements

2. ARCHITECTURE DESIGN
   - Design database schema with ERD diagrams
   - Plan API endpoints and request/response formats
   - Create frontend component hierarchy
   - Define state management approach
   - Design authentication flow across the stack
   - Plan deployment architecture

3. PROJECT SETUP
   - Create repository structure for frontend and backend
   - Configure build tools and development environment
   - Set up database and initial migrations
   - Configure authentication providers
   - Set up testing frameworks
   - Establish CI/CD pipelines

4. BACKEND FOUNDATION
   - Implement database models and migrations
   - Create API controllers and service layer
   - Implement authentication and authorization
   - Set up data validation and error handling
   - Create initial unit and integration tests
   - Document API endpoints

5. FRONTEND SCAFFOLD
   - Create application shell and navigation
   - Implement routing and page structure
   - Set up state management foundation
   - Create authentication UI components
   - Implement API service integration
   - Set up styling framework and theme

6. FEATURE IMPLEMENTATION
   - Develop backend APIs for specific features
   - Create corresponding frontend components
   - Implement data validation on both ends
   - Connect frontend and backend with proper error handling
   - Add unit tests for both layers
   - Implement progressive enhancement

7. INTEGRATION AND TESTING
   - Perform end-to-end testing of user flows
   - Test authentication and authorization
   - Verify data consistency across the stack
   - Test error handling and edge cases
   - Perform cross-browser and responsive testing
   - Validate against requirements

8. OPTIMIZATION
   - Profile application performance
   - Optimize database queries and indexes
   - Implement caching at appropriate layers
   - Enhance frontend loading and rendering
   - Optimize API payload size and format
   - Implement lazy loading where appropriate

9. DEPLOYMENT
   - Set up production environments
   - Configure database with production settings
   - Deploy backend APIs with proper security
   - Build and deploy frontend application
   - Set up monitoring and logging
   - Perform post-deployment verification
```

### API and Admin Dashboard Development

```
1. REQUIREMENTS ANALYSIS
   - Define API consumers and their needs
   - Identify dashboard administration requirements
   - Determine data management capabilities
   - Define authorization levels and access controls
   - Establish API versioning strategy
   - Document reporting and analytics needs

2. ARCHITECTURE PLANNING
   - Design comprehensive data model
   - Plan RESTful API structure and endpoints
   - Design admin dashboard layout and workflows
   - Plan authentication for both API and dashboard
   - Define caching and performance strategy
   - Design monitoring and analytics architecture

3. BACKEND IMPLEMENTATION
   - Create database schema and migrations
   - Implement API endpoints with documentation
   - Set up authentication and authorization
   - Create admin-specific backend services
   - Implement data validation and business rules
   - Set up logging and monitoring

4. ADMIN DASHBOARD DEVELOPMENT
   - Create dashboard layout and navigation
   - Implement authentication and user management
   - Develop data management UI components
   - Create forms for CRUD operations
   - Implement data visualization components
   - Add user permission management

5. API ENHANCEMENT
   - Implement filtering, sorting, and pagination
   - Add rate limiting and security features
   - Create comprehensive API documentation
   - Implement versioning mechanism
   - Add bulk operations capabilities
   - Create API usage metrics and monitoring

6. INTEGRATION AND REFINEMENT
   - Ensure consistent behavior between API and dashboard
   - Test all admin workflows end-to-end
   - Verify proper authorization controls
   - Implement efficient error handling
   - Add data import/export capabilities
   - Create comprehensive audit logging

7. TESTING AND OPTIMIZATION
   - Perform load testing on API endpoints
   - Optimize database queries and indexing
   - Implement appropriate caching strategies
   - Enhance dashboard performance
   - Test security with penetration testing
   - Create automated test suite

8. DOCUMENTATION AND DELIVERY
   - Finalize API documentation with examples
   - Create admin user guides
   - Document system architecture
   - Prepare deployment instructions
   - Create maintenance procedures
   - Plan for future enhancements
```

### E-Commerce Platform Development

```
1. REQUIREMENTS GATHERING
   - Define product catalog and inventory requirements
   - Establish checkout and payment processing needs
   - Determine user account and profile features
   - Define order management and fulfillment processes
   - Identify search and filtering capabilities
   - Document security and compliance requirements

2. ARCHITECTURE DESIGN
   - Design database schema for products, orders, users
   - Plan service architecture for various functions
   - Design API contracts between services
   - Create frontend application structure
   - Plan authentication and authorization
   - Design scalability and redundancy approach

3. DATABASE AND BACKEND SETUP
   - Implement product and inventory data models
   - Create user and authentication systems
   - Develop order processing services
   - Implement payment gateway integration
   - Create search and filtering capabilities
   - Set up admin APIs for management

4. FRONTEND IMPLEMENTATION
   - Develop product browsing and catalog pages
   - Create shopping cart functionality
   - Implement checkout flow and payment UI
   - Build user account and profile management
   - Create order history and tracking
   - Implement search and filter interfaces

5. INTEGRATION
   - Connect product catalog with inventory management
   - Integrate payment processing with order system
   - Implement user authentication across all features
   - Create consistent error handling
   - Ensure data consistency across services
   - Implement event-based communication where appropriate

6. ADVANCED FEATURES
   - Add recommendation engine
   - Implement review and rating system
   - Create promotional and discount capabilities
   - Add analytics and reporting
   - Implement inventory alerts and management
   - Create email notification system

7. OPTIMIZATION AND SCALING
   - Optimize product catalog for large inventories
   - Implement caching for product data
   - Enhance search performance
   - Optimize checkout process
   - Implement load balancing for high traffic
   - Create database scaling strategy

8. SECURITY AND COMPLIANCE
   - Secure payment information handling
   - Implement PCI compliance measures
   - Add fraud detection mechanisms
   - Ensure GDPR/privacy compliance
   - Create security monitoring
   - Perform security audits and penetration testing

9. DEPLOYMENT AND OPERATIONS
   - Set up production infrastructure
   - Create backup and recovery procedures
   - Implement monitoring and alerting
   - Document operational procedures
   - Create disaster recovery plan
   - Plan for future scaling and enhancements
```

## Communication Approaches

- **Bridge Technical Domains**: Translate between frontend and backend concerns when communicating with specialists
- **Document Integration Points**: Clearly communicate how different system layers connect and interact
- **Visualize Data Flow**: Use diagrams to show how data moves through the entire application stack
- **Balance Technical Detail**: Provide appropriate level of detail based on the audience's technical background
- **Use End-to-End Examples**: Illustrate concepts with examples that span the entire application stack
- **Highlight Cross-Cutting Concerns**: Emphasize aspects that affect multiple application layers
- **Document Trade-offs**: Clearly explain trade-offs made between frontend and backend considerations
- **Technical Translation**: Help stakeholders understand implications of technical decisions across the stack
- **Unified Documentation**: Create documentation that presents a cohesive view of the entire system
- **Framework-Agnostic Communication**: Describe concepts in ways that transcend specific framework details