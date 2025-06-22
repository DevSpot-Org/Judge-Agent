export const preprocessorPrompt = (description: string, generatedFilePrompt: string) => `
You are a senior code analyst with expertise in reverse engineering and comprehensive codebase documentation. Analyze this codebase with extreme detail to create a thorough technical summary that captures the essence of how the code actually works.
CRITICAL: Don't return an invalid or incomplete XML response.
PROJECT DESCRIPTION:
${description}

CODEBASE TO ANALYZE:
${generatedFilePrompt}

Your task is to perform a deep dive analysis and extract every significant detail about this codebase. Return your analysis in the following comprehensive XML format:

<codebase_analysis>
    <metadata>
        <project_type>[web_app|mobile_app|api|library|cli_tool|desktop_app|other]</project_type>
        <primary_language>[main programming language]</primary_language>
        <framework_stack>[main framework/stack used]</framework_stack>
        <estimated_complexity>[low|medium|high]</estimated_complexity>
        <estimated_lines_of_code>[approximate number]</estimated_lines_of_code>
        <file_count>[number of significant files]</file_count>
        <package_manager>[npm|yarn|pnpm|pip|composer|etc]</package_manager>
    </metadata>

    <architectural_deep_dive>
        <overall_structure>
            [Describe the complete architecture: folder hierarchy, module organization, separation of concerns]
        </overall_structure>
        <design_patterns>
            [List ALL design patterns found: Singleton, Factory, Observer, MVC, MVVM, Repository, Strategy, etc.]
        </design_patterns>
        <data_flow_detailed>
            [Trace the complete data flow from input to output, including state management, API calls, database operations]
        </data_flow_detailed>
        <routing_structure>
            [Detail the routing system: routes defined, parameters, middleware, guards]
        </routing_structure>
        <state_management>
            [How application state is managed: Redux, Context, Vuex, local state, global variables]
        </state_management>
    </architectural_deep_dive>

    <technology_stack_detailed>
        <frontend_technologies>
            <framework>[React|Vue|Angular|Svelte|vanilla JS|etc]</framework>
            <ui_libraries>[Material-UI|Ant Design|Bootstrap|Tailwind|styled-components|etc]</ui_libraries>
            <state_management>[Redux|MobX|Zustand|Context API|etc]</state_management>
            <routing>[React Router|Vue Router|Next.js routing|etc]</routing>
            <form_handling>[Formik|React Hook Form|VeeValidate|etc]</form_handling>
            <http_client>[Axios|Fetch|Apollo|etc]</http_client>
        </frontend_technologies>
        <backend_technologies>
            <runtime>[Node.js|Python|PHP|Java|.NET|Go|Ruby|etc]</runtime>
            <framework>[Express|Fastify|Django|Flask|Laravel|Spring|etc]</framework>
            <database>[MongoDB|PostgreSQL|MySQL|SQLite|Redis|etc]</database>
            <orm>[Mongoose|Prisma|TypeORM|Sequelize|SQLAlchemy|etc]</orm>
            <authentication>[JWT|Passport|Auth0|Firebase Auth|etc]</authentication>
            <api_style>[REST|GraphQL|gRPC|etc]</api_style>
        </backend_technologies>
        <styling_approach>
            [CSS-in-JS|SCSS|Less|PostCSS|CSS Modules|Tailwind classes|inline styles]
        </styling_approach>
        <build_and_tooling>
            <bundler>[Webpack|Vite|Rollup|Parcel|etc]</bundler>
            <transpiler>[Babel|TypeScript|SWC|etc]</transpiler>
            <linter>[ESLint|TSLint|Prettier|etc]</linter>
            <testing>[Jest|Vitest|Cypress|Testing Library|Playwright|etc]</testing>
            <deployment>[Docker|Vercel|Netlify|AWS|Heroku|etc]</deployment>
        </build_and_tooling>
        <key_dependencies>
            [List 10-15 most important dependencies with their specific purposes and versions if available]
        </key_dependencies>
    </technology_stack_detailed>

    <core_functions_and_components>
        <main_components>
            [List EVERY significant component/class with brief description of its purpose and key methods]
        </main_components>
        <utility_functions>
            [Document all utility functions, their parameters, return types, and purposes]
        </utility_functions>
        <custom_hooks>
            [React hooks, Vue composables, or similar reusable logic with their signatures]
        </custom_hooks>
        <services_and_apis>
            [API service classes, data fetching functions, external service integrations]
        </services_and_apis>
        <business_logic_modules>
            [Core business logic functions, calculation engines, processing modules]
        </business_logic_modules>
        <data_models_and_types>
            [All interfaces, types, classes, schemas with their properties]
        </data_models_and_types>
    </core_functions_and_components>

    <api_endpoints_and_routes>
        <rest_endpoints>
            [List all REST endpoints: method, path, parameters, response format]
        </rest_endpoints>
        <graphql_schema>
            [GraphQL queries, mutations, subscriptions if present]
        </graphql_schema>
        <middleware_chain>
            [Authentication, logging, validation, error handling middleware]
        </middleware_chain>
        <route_handlers>
            [Controller methods and their business logic]
        </route_handlers>
    </api_endpoints_and_routes>

    <database_and_data_layer>
        <schema_design>
            [Database tables, collections, relationships, indexes]
        </schema_design>
        <query_patterns>
            [Common queries, aggregations, joins used in the codebase]
        </query_patterns>
        <data_access_layer>
            [Repository patterns, DAOs, query builders, ORM usage]
        </data_access_layer>
        <migrations_and_seeds>
            [Database migration files and seed data]
        </migrations_and_seeds>
    </database_and_data_layer>

    <user_interface_details>
        <page_components>
            [List all page/screen components and their responsibilities]
        </page_components>
        <form_implementations>
            [Form components, validation rules, submission handlers]
        </form_implementations>
        <navigation_system>
            [Menu components, breadcrumbs, navigation logic]
        </navigation_system>
        <responsive_design>
            [Breakpoints, mobile adaptations, CSS grid/flexbox usage]
        </responsive_design>
        <animations_and_interactions>
            [Transition libraries, animation implementations, user interactions]
        </animations_and_interactions>
    </user_interface_details>

    <authentication_and_authorization>
        <auth_implementation>
            [Login/logout flow, token management, session handling]
        </auth_implementation>
        <user_roles_permissions>
            [Role-based access control, permission checking functions]
        </user_roles_permissions>
        <protected_routes>
            [Route guards, authentication middleware, access control]
        </protected_routes>
        <security_measures>
            [Input sanitization, XSS prevention, CSRF protection, rate limiting]
        </security_measures>
    </authentication_and_authorization>

    <configuration_and_environment>
        <environment_variables>
            [List all environment variables and their purposes]
        </environment_variables>
        <configuration_files>
            [Config files, their structure, and what they configure]
        </configuration_files>
        <build_configuration>
            [Webpack config, package.json scripts, deployment configs]
        </build_configuration>
        <feature_flags>
            [Feature toggles, conditional logic based on environment]
        </feature_flags>
    </configuration_and_environment>

    <error_handling_and_logging>
        <error_boundaries>
            [Error handling components, try-catch blocks, error recovery]
        </error_boundaries>
        <logging_system>
            [Logging libraries, log levels, log formatting]
        </logging_system>
        <monitoring_integration>
            [Error tracking services, performance monitoring, analytics]
        </monitoring_integration>
        <validation_logic>
            [Input validation, schema validation, business rule validation]
        </validation_logic>
    </error_handling_and_logging>

    <testing_implementation>
        <unit_tests>
            [Unit test files, testing utilities, mock implementations]
        </unit_tests>
        <integration_tests>
            [API tests, database tests, component integration tests]
        </integration_tests>
        <e2e_tests>
            [End-to-end test scenarios, page objects, test data]
        </e2e_tests>
        <test_coverage>
            [Coverage reports, untested code areas, testing gaps]
        </test_coverage>
    </testing_implementation>

    <performance_optimizations>
        <code_splitting>
            [Lazy loading, dynamic imports, bundle optimization]
        </code_splitting>
        <caching_strategies>
            [Browser caching, API caching, memoization, service workers]
        </caching_strategies>
        <optimization_techniques>
            [Virtual scrolling, debouncing, throttling, image optimization]
        </optimization_techniques>
        <memory_management>
            [Memory leak prevention, cleanup functions, resource management]
        </memory_management>
    </performance_optimizations>

    <third_party_integrations>
        <external_apis>
            [Third-party API integrations, SDKs, webhook handlers]
        </external_apis>
        <payment_systems>
            [Payment gateways, subscription handling, billing logic]
        </payment_systems>
        <social_integrations>
            [Social media APIs, OAuth providers, sharing functionality]
        </social_integrations>
        <analytics_tracking>
            [Google Analytics, event tracking, user behavior monitoring]
        </analytics_tracking>
    </third_party_integrations>

    <deployment_and_devops>
        <containerization>
            [Docker files, container orchestration, deployment scripts]
        </containerization>
        <ci_cd_pipeline>
            [GitHub Actions, Jenkins, deployment automation]
        </ci_cd_pipeline>
        <infrastructure_code>
            [Terraform, CloudFormation, infrastructure as code]
        </infrastructure_code>
        <monitoring_setup>
            [Health checks, metrics collection, alerting systems]
        </monitoring_setup>
    </deployment_and_devops>

    <code_quality_assessment>
        <code_organization>
            [Folder structure clarity, file naming conventions, module boundaries]
        </code_organization>
        <coding_standards>
            [Consistent formatting, naming conventions, code style adherence]
        </coding_standards>
        <documentation_quality>
            [README completeness, inline comments, API documentation, type definitions]
        </documentation_quality>
        <complexity_analysis>
            [Cyclomatic complexity, deeply nested functions, large files]
        </complexity_analysis>
        <dependency_health>
            [Outdated packages, security vulnerabilities, unused dependencies]
        </dependency_health>
    </code_quality_assessment>

    <specific_implementation_highlights>
        <complex_algorithms>
            [Any sophisticated algorithms, mathematical calculations, data processing logic]
        </complex_algorithms>
        <custom_implementations>
            [Custom components, utility libraries, unique solutions]
        </custom_implementations>
        <performance_critical_code>
            [High-performance requirements, optimization-critical sections]
        </performance_critical_code>
        <integration_patterns>
            [How different modules communicate, event systems, message passing]
        </integration_patterns>
    </specific_implementation_highlights>

    <potential_issues_detailed>
        <code_smells>
            [Long methods, duplicate code, god objects, feature envy, etc.]
        </code_smells>
        <security_vulnerabilities>
            [Potential security holes, unsafe practices, exposure risks]
        </security_vulnerabilities>
        <scalability_bottlenecks>
            [Performance bottlenecks, resource constraints, scaling limitations]
        </scalability_bottlenecks>
        <maintenance_challenges>
            [Hard-to-modify code, tight coupling, complex dependencies]
        </maintenance_challenges>
        <technical_debt>
            [Shortcuts taken, outdated patterns, refactoring opportunities]
        </technical_debt>
    </potential_issues_detailed>

    <notable_strengths>
        <well_architected_areas>
            [Excellent design patterns, clean architecture implementations]
        </well_architected_areas>
        <robust_implementations>
            [Solid error handling, comprehensive testing, good performance]
        </robust_implementations>
        <innovative_solutions>
            [Creative problem-solving, elegant implementations, unique approaches]
        </innovative_solutions>
        <maintainability_features>
            [Good documentation, clear interfaces, modular design]
        </maintainability_features>
    </notable_strengths>

    <improvement_recommendations>
        <refactoring_opportunities>
            [Specific code sections that could be improved with concrete suggestions]
        </refactoring_opportunities>
        <modernization_paths>
            [Outdated patterns that could be updated, new technologies to adopt]
        </modernization_paths>
        <performance_enhancements>
            [Specific optimizations that could be implemented]
        </performance_enhancements>
        <security_hardening>
            [Security improvements that should be implemented]
        </security_hardening>
    </improvement_recommendations>

    <file_structure_comprehensive>
        <directory_breakdown>
            [Complete directory structure with purpose of each folder]
        </directory_breakdown>
        <key_files_analysis>
            [Important files with their contents summary and purpose]
        </key_files_analysis>
        <configuration_files_detailed>
            [All config files with their key settings and implications]
        </configuration_files_detailed>
        <entry_points_and_bootstrapping>
            [Application entry points, initialization sequence, bootstrap process]
        </entry_points_and_bootstrapping>
    </file_structure_comprehensive>

    <execution_flow_analysis>
        <application_lifecycle>
            [From startup to shutdown, initialization to cleanup]
        </application_lifecycle>
        <request_response_cycle>
            [Complete flow from request to response, including middleware]
        </request_response_cycle>
        <user_interaction_flows>
            [Step-by-step user journey through the application]
        </user_interaction_flows>
        <background_processes>
            [Cron jobs, workers, scheduled tasks, event listeners]
        </background_processes>
    </execution_flow_analysis>
</codebase_analysis>

CRITICAL ANALYSIS INSTRUCTIONS:
1. Be extremely thorough - this analysis should capture the complete technical essence of the codebase
2. Include specific code examples, function names, variable names, and implementation details
3. Document every significant function, component, and module with their purposes
4. Trace data flow through the entire application stack
5. Identify all external dependencies and their specific usage patterns
6. Analyze the actual implementation, not just the intended architecture
7. Include line-of-code estimates for major components
8. Document all configuration options and environment-specific behavior
9. Identify all entry points, APIs, and user interaction patterns
10. Provide specific, actionable insights for code review and evaluation
11. If any section doesn't apply, explicitly state "Not applicable" rather than leaving it empty
12. Focus on what the code actually does, not what it should do
13. Include performance characteristics and resource usage patterns
14. Document all business logic and domain-specific implementations

ANALYSIS DEPTH REQUIREMENTS:
- List at least 10-15 specific functions/components with their exact purposes
- Document all API endpoints with their complete signatures
- Include all major data structures and their relationships
- Trace complete user workflows through the codebase
- Identify all third-party integrations and their usage patterns
- Document all configuration files and their impact on behavior
- Analyze the actual testing coverage and quality
- Provide specific improvement recommendations with code examples where possible

Analyze the codebase now with this level of comprehensive detail.
`;
