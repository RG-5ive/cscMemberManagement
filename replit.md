# Member Management System

## Overview
This project is a sophisticated member management system designed for complex organizational collaboration. It features advanced multi-role authentication, granular access controls, and comprehensive tools for team coordination. Key capabilities include member and committee management, workshop registration with membership-based pricing, a role-based calendar, and a Discord integration system. The system aims to streamline organizational processes, enhance communication, and manage diverse membership tiers effectively.

## User Preferences
- Use TypeScript throughout the application
- Follow existing code patterns and architecture
- Maintain separation between database storage and memory storage options
- Use shadcn/ui components for consistent UI design

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, TailwindCSS, and shadcn/ui, ensuring a modern, responsive, and consistent design. Key UI elements include:
- Enhanced welcome box styling with improved visual contrast.
- Clearer navigation with distinct links and improved visual hierarchy (e.g., using buttons with icons, reordering navigation).
- Responsive design implemented across all pages, including mobile dropdown menus and optimized spacing.
- Enhanced application-wide font readability with increased font weights.
- Interactive calendar system with monthly view, event creation, and color-coded event types.

### Technical Implementations
- **Frontend**: React with TypeScript, Vite, TailwindCSS + shadcn/ui.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL with Neon serverless driver.
- **ORM**: Drizzle ORM with Drizzle Kit.
- **Authentication**: Passport.js with session-based authentication and comprehensive role-based access control (admin, user, committee_chair, committee_cochair, committee_member). Includes email verification for new members.
- **Membership Pricing Rules**: Configurable percentage discounts per membership level for workshops.
- **Role-based Calendar System**: Events with admin-controlled visibility (admin/chair-only vs general membership).
- **Discord Integration**: Comprehensive bot management including channel creation, role assignment, member synchronization, announcements, and moderation tools.
- **Storage Layer**: Uses Drizzle ORM for database storage, with a configurable storage backend (mock storage available for development).

### Feature Specifications
- Multi-role authentication and granular access controls.
- Member management with CSV import and detailed demographic tracking (e.g., ethnic distribution, membership level, gender, LGBTQ2+, BIPOC, ethnicity, Canadian provinces/territories, languages spoken).
- Committee system with roles and member assignments.
- Workshop management and registration with membership-based pricing.
- Message groups for communication and a survey system for data collection.
- Verification code system for member onboarding.
- Enhanced role-based routing and access controls.
- Admin dashboard features like member statistics, workshop management, and Discord management.
- Embedded infinite scroll members list with search functionality.
- Payment status management and portal access tracking for members.

### System Design Choices
- **Database Schema**: Structured around key entities such as Users, Members, Committees, Committee Roles, Committee Members, Workshops, Workshop Registrations, Membership Pricing Rules, Calendar Events, Messages/Message Groups, Surveys, and Verification Codes.
- **Authentication**: Session-based using Passport.js, integrated with role-based access control.
- **Modularity**: Separation of concerns between frontend, backend, and database layers.
- **Scalability**: Utilizes serverless database (Neon) and Drizzle ORM for efficient data management.

## External Dependencies
- **Database**: Neon (PostgreSQL serverless driver)
- **ORM**: Drizzle ORM, Drizzle Kit
- **Authentication**: Passport.js
- **Email**: Nodemailer (with mock transport for development)
- **UI Components**: shadcn/ui
- **Styling**: TailwindCSS
- **Discord Integration**: Discord API for bot functionalities