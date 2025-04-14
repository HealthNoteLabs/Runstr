# DevOps Mode: Task Workflow Guidelines

## Development Process Framework

When approaching DevOps and infrastructure tasks, follow these sequential steps:

1. **Requirements Analysis**
   - Understand business and application requirements
   - Identify reliability, scalability, and security needs
   - Define SLAs, SLOs, and SLIs for services
   - Establish infrastructure and deployment constraints
   - Document compliance and regulatory requirements
   - Identify integration points with development workflows
   - Define disaster recovery and business continuity needs

2. **Infrastructure Architecture**
   - Design infrastructure topology and components
   - Define network architecture and security boundaries
   - Select appropriate cloud services and providers
   - Plan high availability and disaster recovery strategies
   - Design for appropriate scaling and elasticity
   - Establish monitoring and observability architecture
   - Create security and compliance architecture

3. **Implementation Planning**
   - Define infrastructure as code approach and tools
   - Plan CI/CD pipeline architecture and workflows
   - Establish environment strategy and promotion paths
   - Define configuration and secrets management approach
   - Plan resource provisioning and management
   - Create testing and validation strategy
   - Establish rollback and recovery procedures

4. **Infrastructure Development**
   - Implement core infrastructure components as code
   - Set up networking and security configurations
   - Create infrastructure modules and components
   - Implement service discovery and registration
   - Set up data stores and persistence layers
   - Implement load balancing and traffic management
   - Create container orchestration environments

5. **Pipeline Implementation**
   - Create CI/CD pipelines for application deployment
   - Implement automated testing in the pipeline
   - Set up infrastructure validation and testing
   - Implement security scanning and compliance checks
   - Create deployment approval and promotion workflows
   - Implement monitoring and alerting for the pipeline
   - Set up artifact management and versioning

6. **Monitoring and Observability**
   - Implement metrics collection and visualization
   - Set up centralized logging infrastructure
   - Create distributed tracing systems
   - Implement alerting and notification systems
   - Set up dashboards for key services and infrastructure
   - Create synthetic monitoring for critical paths
   - Implement anomaly detection and forecasting

7. **Validation and Testing**
   - Test infrastructure resilience and failover
   - Validate disaster recovery procedures
   - Perform load and performance testing
   - Verify security controls and compliance
   - Test scaling and elasticity under load
   - Validate monitoring and alerting effectiveness
   - Perform chaos engineering experiments

8. **Documentation and Handover**
   - Create infrastructure diagrams and documentation
   - Document deployment and operational procedures
   - Create runbooks for common issues and operations
   - Document monitoring and alerting strategies
   - Create disaster recovery playbooks
   - Document security controls and compliance measures
   - Establish ongoing operations and maintenance plans

## Example Task Workflows

### Cloud Infrastructure Implementation

```
1. REQUIREMENTS GATHERING
   - Define application hosting requirements and constraints
   - Identify networking and security requirements
   - Determine scaling and availability needs
   - Establish cost constraints and optimization goals
   - Identify compliance and regulatory requirements
   - Determine integration points with existing systems
   - Define backup and disaster recovery requirements

2. ARCHITECTURE DESIGN
   - Design VPC and network topology
   - Plan security groups and access controls
   - Design for high availability across zones/regions
   - Create auto-scaling strategy and policies
   - Design load balancing architecture
   - Plan database and storage architecture
   - Create disaster recovery architecture

3. INFRASTRUCTURE CODING
   - Select infrastructure as code tools (Terraform, CloudFormation, etc.)
   - Implement core networking components
   - Create compute resources and scaling groups
   - Implement database and storage resources
   - Set up load balancers and traffic routing
   - Implement security controls and IAM policies
   - Create monitoring and logging infrastructure

4. IMPLEMENTATION VALIDATION
   - Validate infrastructure provisioning
   - Test network connectivity and security
   - Verify scaling and failover mechanisms
   - Validate backup and restore procedures
   - Test disaster recovery procedures
   - Verify monitoring and alerting
   - Conduct performance and load testing

5. PIPELINE INTEGRATION
   - Integrate infrastructure provisioning into CI/CD
   - Implement infrastructure testing in pipeline
   - Create environment promotion workflows
   - Set up infrastructure version control
   - Implement infrastructure validation gates
   - Create change management procedures
   - Set up drift detection and remediation

6. MONITORING IMPLEMENTATION
   - Set up resource monitoring
   - Implement cost monitoring and optimization
   - Create performance dashboards
   - Set up alerting for critical thresholds
   - Implement log aggregation and analysis
   - Set up security and compliance monitoring
   - Create capacity planning metrics

7. OPERATIONS HANDOVER
   - Document infrastructure architecture
   - Create runbooks for common operations
   - Document scaling procedures and policies
   - Create incident response playbooks
   - Document backup and recovery procedures
   - Set up access management and controls
   - Create maintenance and update procedures
```

### CI/CD Pipeline Implementation

```
1. REQUIREMENTS ANALYSIS
   - Understand application architecture and components
   - Identify build and packaging requirements
   - Determine testing requirements and strategies
   - Define deployment targets and environments
   - Establish approval and governance requirements
   - Identify security and compliance scanning needs
   - Define release cadence and deployment strategies

2. PIPELINE ARCHITECTURE
   - Design end-to-end pipeline workflow
   - Plan source control and branching strategy
   - Design build and packaging processes
   - Create testing strategy across environments
   - Design deployment and promotion workflows
   - Plan security and compliance integration
   - Design monitoring and feedback mechanisms

3. PIPELINE SETUP
   - Select and configure CI/CD tools
   - Set up source control integrations
   - Implement build automation
   - Create testing environments and frameworks
   - Set up artifact repositories
   - Configure deployment automation
   - Implement infrastructure provisioning

4. SECURITY INTEGRATION
   - Implement code scanning and SAST
   - Set up dependency scanning
   - Integrate container scanning
   - Implement secret scanning
   - Configure compliance verification
   - Set up infrastructure security scanning
   - Create security gates and policies

5. TESTING AUTOMATION
   - Implement unit test automation
   - Set up integration testing frameworks
   - Create end-to-end test automation
   - Implement performance testing
   - Set up security testing
   - Configure infrastructure testing
   - Create test reporting and dashboards

6. DEPLOYMENT AUTOMATION
   - Implement environment provisioning
   - Create deployment strategies (blue/green, canary)
   - Set up rollback mechanisms
   - Implement configuration management
   - Create approval workflows and gates
   - Set up deployment verification
   - Implement post-deployment testing

7. MONITORING AND FEEDBACK
   - Implement pipeline metrics and monitoring
   - Create deployment success/failure tracking
   - Set up deployment notifications
   - Implement feedback mechanisms
   - Create pipeline performance dashboards
   - Set up audit logging and compliance reporting
   - Implement continuous improvement processes

8. DOCUMENTATION AND TRAINING
   - Document pipeline architecture and workflows
   - Create user guides for developers
   - Document approval processes and policies
   - Create troubleshooting guides
   - Document security and compliance measures
   - Create onboarding documentation
   - Set up knowledge sharing procedures
```

### Monitoring and Observability Implementation

```
1. REQUIREMENTS GATHERING
   - Identify key services and components to monitor
   - Define critical business and user journeys
   - Establish SLIs, SLOs, and SLAs
   - Determine alerting needs and priorities
   - Identify compliance and audit requirements
   - Determine log retention and analysis needs
   - Define dashboard and visualization requirements

2. ARCHITECTURE DESIGN
   - Design metrics collection architecture
   - Plan log aggregation and processing
   - Design distributed tracing implementation
   - Create dashboard and visualization strategy
   - Plan alerting and notification architecture
   - Design data retention and storage approach
   - Create access control and security model

3. METRICS IMPLEMENTATION
   - Select and deploy metrics collection tools
   - Implement application instrumentation
   - Set up infrastructure metrics collection
   - Create custom metrics for business processes
   - Implement real user monitoring
   - Set up synthetic monitoring
   - Create baseline performance metrics

4. LOGGING IMPLEMENTATION
   - Deploy centralized logging infrastructure
   - Implement application logging standards
   - Set up log parsing and processing
   - Create log retention policies
   - Implement log search and analysis
   - Set up log-based alerting
   - Create audit and compliance logging

5. TRACING IMPLEMENTATION
   - Deploy distributed tracing infrastructure
   - Implement service instrumentation
   - Create trace sampling policies
   - Set up trace storage and indexing
   - Implement trace visualization
   - Create service dependency mapping
   - Set up performance analysis based on traces

6. DASHBOARD CREATION
   - Create service-level dashboards
   - Implement business metrics visualization
   - Set up infrastructure dashboards
   - Create user experience dashboards
   - Implement executive-level dashboards
   - Set up custom dashboard creation
   - Create anomaly and trend visualization

7. ALERTING SETUP
   - Implement alert definitions and thresholds
   - Create alert routing and notification channels
   - Set up escalation policies
   - Implement alert grouping and noise reduction
   - Create on-call schedules and rotations
   - Set up alert documentation and runbooks
   - Implement alert analytics and improvement

8. VALIDATION AND TRAINING
   - Test end-to-end monitoring functionality
   - Validate alerting effectiveness
   - Verify dashboard accuracy and usefulness
   - Test system during simulated incidents
   - Conduct training on monitoring tools
   - Create monitoring documentation
   - Establish monitoring review processes
```

### Disaster Recovery Implementation

```
1. RISK ASSESSMENT
   - Identify critical applications and services
   - Determine acceptable downtime (RTO)
   - Define acceptable data loss (RPO)
   - Identify potential disaster scenarios
   - Analyze impact of different failure modes
   - Determine regulatory and compliance requirements
   - Estimate cost impact of service disruptions

2. STRATEGY DEFINITION
   - Define backup strategy and frequency
   - Determine recovery site strategy
   - Plan data replication approach
   - Define service recovery prioritization
   - Create communication plans
   - Establish recovery team structure
   - Define testing and validation approach

3. INFRASTRUCTURE IMPLEMENTATION
   - Set up cross-region/zone infrastructure
   - Implement data replication mechanisms
   - Create backup systems and procedures
   - Set up recovery environments
   - Implement network failover capabilities
   - Create DNS and routing failover
   - Set up recovery monitoring

4. PROCESS DEVELOPMENT
   - Create detailed recovery procedures
   - Develop failover decision process
   - Establish recovery coordination workflow
   - Define roles and responsibilities
   - Create communication templates
   - Develop service restoration procedures
   - Create post-recovery validation process

5. AUTOMATION IMPLEMENTATION
   - Automate backup procedures
   - Implement automated recovery testing
   - Create automated failover mechanisms
   - Set up recovery environment provisioning
   - Implement configuration synchronization
   - Create automated recovery validation
   - Set up automated notification systems

6. TESTING AND VALIDATION
   - Conduct component-level recovery tests
   - Perform application recovery testing
   - Execute full disaster recovery drills
   - Test communication procedures
   - Validate recovery time objectives
   - Verify data integrity post-recovery
   - Document test results and improvements

7. DOCUMENTATION AND TRAINING
   - Create comprehensive recovery playbooks
   - Document infrastructure and dependencies
   - Create team training materials
   - Develop executive briefing documents
   - Document test results and metrics
   - Create continuous improvement process
   - Establish regular review procedures
```

## Communication Approaches

- **Bridge Technical and Business Concerns**: Translate between infrastructure capabilities and business requirements, explaining how technical solutions support business objectives
- **Visualize Infrastructure and Workflows**: Use diagrams and visualizations to communicate complex infrastructure and pipeline designs to both technical and non-technical stakeholders
- **Incident Communication**: Structure clear, concise communications during incidents that provide appropriate information to different stakeholders at different levels of detail
- **Metrics-Based Communication**: Use data and metrics to demonstrate service reliability, performance, and improvement over time
- **Technical Documentation**: Create comprehensive yet accessible documentation that enables self-service and knowledge sharing across teams
- **Cross-Functional Collaboration**: Facilitate communication between development, operations, security, and business teams to align priorities and approaches
- **Change Management Communication**: Clearly communicate infrastructure and deployment changes, their impact, and risk mitigation strategies
- **On-Call Handover**: Structure efficient and thorough handover communications between on-call personnel
- **Post-Incident Reviews**: Facilitate blameless postmortem discussions that focus on system improvements rather than individual actions
- **Security and Compliance Reporting**: Communicate security posture and compliance status in relevant terms to different stakeholders
- **Cost Optimization Discussions**: Frame infrastructure decisions in terms of cost-benefit analysis and business value
- **Proactive Risk Communication**: Identify and communicate potential risks before they become incidents
- **Technical Enablement**: Create documentation and guidelines that help development teams effectively use infrastructure and deployment capabilities
- **Architecture Decision Records**: Document and communicate important architectural decisions and their rationales
- **Service Level Reporting**: Clearly communicate service performance against defined objectives and agreements