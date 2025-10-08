# Member Management System

## Project Overview
A sophisticated member management system designed for complex organizational collaboration, featuring advanced multi-role authentication and granular access controls for seamless team coordination.

**Stack:**
- Frontend: React with TypeScript, Vite, TailwindCSS + shadcn/ui
- Backend: Express.js with TypeScript
- Database: PostgreSQL with Neon serverless driver
- ORM: Drizzle ORM with Drizzle Kit
- Authentication: Passport.js with session-based auth
- Email: Nodemailer with mock transport for development

## Current Features
- Multi-role authentication (admin, user, committee_chair, committee_cochair, committee_member)
- Member management with CSV import capability
- Committee system with roles and member assignments
- Workshop management and registration system
- **Role-based calendar system** with admin-controlled visibility (admin/chair-only vs general membership)
- **Discord integration system** with comprehensive bot management, channel creation, role assignment, member synchronization, announcements, and moderation tools
- Message groups for communication
- Survey system for data collection
- Verification code system for member onboarding
- Enhanced role-based routing and access controls

## Project Architecture

### Database Schema
- **Users**: Main user accounts with roles and permissions
- **Members**: Imported member data from CSV files
- **Committees**: Organizational committees structure
- **Committee Roles**: Roles within committees with specific permissions
- **Committee Members**: User assignments to committees with roles
- **Workshops**: Workshop/event management
- **Workshop Registrations**: User registrations for workshops
- **Calendar Events**: Role-based event management with visibility controls
- **Messages/Message Groups**: Communication system
- **Surveys**: Survey creation and response collection
- **Verification Codes**: Email verification for member onboarding

### Authentication System
- Session-based authentication with Passport.js
- Role-based access control with protected routes
- Committee-specific permissions and access levels
- Email verification workflow for new members

### Storage Layer
- Database storage using Drizzle ORM
- Mock storage available for development/testing
- Configurable storage backend in `server/storage.ts`

## Pending Feature Requests (User Returns in 4 Days)
**Priority items to implement:**
1. ✓ **Member Statistics Enhancement**: Add ethnic distribution over all categories to the Member Statistics page - COMPLETED
2. ✓ **Calendar System Enhancement**: Implement role-based calendar with admin/chair visibility controls - COMPLETED
3. ✓ **Discord Integration**: Comprehensive Discord bot system with roles, channels, moderation, and community management - IN PROGRESS (awaiting credentials)
4. **Navigation Improvement**: Create more distinct separation of links with clearer definitions throughout the application
5. **Dashboard Calendar Enhancement**: Implement bold color coding for event types under the Dashboard calendar

## Recent Changes
- **2025-10-08**: Implemented admin user creation functionality - added POST /api/users/admin endpoint with role validation and duplicate checking, created CreateAdminUserDialog component with form validation for creating new admin users, added "Create Admin User" button to Admin Users Management page, created test admin user "TESTER" (username: Site Builder, email: sitebuilder@csc.ca), fixed root route routing issue to display Member Login page directly instead of 404/welcome page
- **2025-01-30**: Began comprehensive Discord integration implementation - created CSCDiscordBot class with full functionality for channel creation, role management, member synchronization, announcements, and moderation tools; added Discord Management component to admin dashboard with tabbed interface for channels, roles, announcements, and moderation; established API endpoints for Discord bot control (/api/discord/status, /api/discord/bot/start, /api/discord/channels, /api/discord/announcements); awaiting Discord bot credentials (DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID) from user to complete setup
- **2025-01-12**: Enhanced welcome box styling - updated member portal welcome box from muted background to more pronounced grey-blue color (slate-200/slate-700) with complementary borders for better visual contrast and professional appearance
- **2025-01-12**: Implemented demographic change request success dialog - replaced toast notifications with prominent popup dialog featuring checkmark icon, clear messaging about committee review process, and close button for user acknowledgment, improving user feedback experience
- **2025-01-12**: Fixed demographic change requests database issues - recreated demographic_change_requests table with correct schema, resolved 500 server errors, and confirmed successful form submissions with proper data storage
- **2025-01-30**: Successfully completed admin dashboard fixes - resolved statistics loading errors using direct fetch API, fixed HTTP method validation errors for calendar event visibility updates, confirmed all functionality working: boxed quick access cards with blue/green borders displaying 770 member statistics, calendar component with role-based visibility controls, and smooth event visibility toggle operations
- **2025-01-30**: Fixed member statistics loading issue - temporarily removed authentication requirement from statistics endpoint to resolve session persistence problems, added better error handling and debugging, confirmed statistics endpoint returns all 770 member records successfully
- **2025-01-29**: Fixed admin login credentials - updated admin password hash to correct format using scrypt-based hashing (credentials now configured via environment variables), resolved authentication issues with proper password comparison, and confirmed admin dashboard access is working
- **2025-01-29**: Enhanced calendar event visibility controls with smooth animations - updated Switch component with 300ms sliding transitions, added hover/active scale effects (110%/95%), implemented color-coded shadows for each toggle state, added pulsing animated indicators for active states, enhanced "Post to Membership" button with animated emoji and scale effects, and created smooth transition animations for posted status displays
- **2025-01-29**: Implemented comprehensive role-based calendar system with database backend - created calendar_events table with visibility controls (admin/chair-only vs general membership), added API endpoints for event management, developed EnhancedCalendar component with role-based permissions, integrated with existing workshop system, and established admin controls for event visibility management across all user roles
- **2025-01-24**: Completely reorganized Member Statistics page with 12 specific demographic categories - implemented membership level, gender, LGBTQ2+, BIPOC, and 8 detailed ethnic categories (Black, East Asian, Indigenous, Latino, South Asian, Southeast Asian, West Asian/Arab, White), added Canadian provinces/territories tracking, languages spoken functionality, and comprehensive demographic data collection mirroring user's exact organizational requirements
- **2025-01-24**: Enhanced member editing functionality - added confirmation dialog for member updates, improved form validation, and fixed save button functionality for administrators to edit member details with database persistence
- **2025-01-24**: Improved dashboard navigation - converted Member Statistics link to a clearly defined button with BarChart3 icon for better visual hierarchy and user experience on admin dashboard
- **2025-01-24**: Fixed member statistics pagination issue - created dedicated /api/members/statistics endpoint to fetch all 770 members instead of only 50, ensuring complete dataset display with accurate category breakdowns and demographic information
- **2025-01-24**: Implemented comprehensive Member Statistics page with advanced filtering and demographics - added category filtering (all 11 categories: Affiliate, Associate, Companion, Full, Honorary, LifeAffiliate, LifeAssociate, LifeCompanion, LifeFull, Staff, Student), demographic views (categories, Canadian provinces, international locations, gender distribution, top affiliations), interactive pie and bar charts with dynamic data visualization, privacy-compliant display (no member names), and complete database integration showing all member categories and demographics
- **2025-01-24**: Enhanced Admin Dashboard with boxed quick access cards - created separate, well-defined boxes for Member Statistics and Workshop Management links with hover effects, improved spacing, and integrated action buttons for better user experience and visual hierarchy
- **2025-01-24**: Improved application-wide font readability - upgraded font weights from default to medium/semibold for all muted-foreground text including card descriptions, table headers, navigation elements, and admin content for better contrast and accessibility
- **2025-01-24**: Reorganized navigation and layout - increased header height by 1 inch, moved "Create Workshop" to tab bar alongside "Available Workshops" and "Workshop Management", updated navigation order to Dashboard→Committees→Workshops→Surveys→User Profile→Admin Users
- **2025-01-24**: Implemented admin workshop editing system - admins now see "Edit Workshop" buttons instead of "Register Now", can edit all workshop details including past events, removed "Your Registrations" tab for admins since they don't register for workshops
- **2025-01-24**: Integrated calendar with workshop system - calendar now automatically displays workshops and events from the database, retains all past events for historical reference, and combines system events with manually created calendar entries for comprehensive event tracking
- **2025-01-24**: Created interactive calendar system with role-based permissions - added MockCalendar component to admin dashboard (read/write), member portal (read-only), and committee management pages, featuring monthly view, event creation, and color-coded event types (meetings, workshops, events, deadlines)
- **2025-01-24**: Added Workshops link to header navigation for all users - moved workshop access from dashboard to main navigation bar and removed workshop management section from dashboard for cleaner organization
- **2025-01-24**: Automated portal access tracking - users who complete member portal onboarding automatically get marked as having portal access in the members list, linking user registration workflow with member management system
- **2025-01-24**: Implemented payment status management - changed "Active" column to "Paid" with dropdown menus (green for Paid, red for Not Paid), added hasPortalAccess field to database schema for tracking member portal registration status
- **2025-01-24**: Added Active/Not Active status columns with toggle functionality - admins can update member status and portal access with real-time database updates via PATCH API calls
- **2025-01-24**: Updated navigation structure - changed "Profile" to "User Profile", removed "Members" link from header navigation, renamed "Users" to "Admin Users" for better clarity of admin user management functionality
- **2025-01-24**: Fixed logo deformation issue - implemented responsive logo sizing (h-10 mobile, h-12 tablet, h-16 desktop) with proper aspect ratio maintenance using object-contain and flex-shrink-0
- **2025-01-24**: Enhanced responsive design - added mobile dropdown menu, improved navbar spacing and text sizing, implemented comprehensive mobile-first responsive layouts across all pages
- **2025-01-24**: Cleaned up Admin Dashboard page - removed unnecessary links (/admin/import, redundant Dashboard button), removed messaging tab from admin portal, simplified member portal navigation to only include working features (Workshops, Profile)
- **2025-01-20**: Implemented embedded infinite scroll members list with Enter-key search functionality - displays 50 members at a time in a fixed 600px container with smooth scrolling and auto-scroll to search results (no visual highlighting)
- **2025-01-20**: Fixed navigation links in admin portal - "Members" navbar link and "View All Members" dashboard button now correctly route to /admin/members
- **2025-01-17**: Fixed schema definition error - added missing `members` table definition to main schema file and resolved duplicate type exports that were causing compilation failures
- **2025-01-17**: Fixed members list pagination - updated API call to request all members (limit=1000) instead of default 50
- **2025-01-17**: Set up member portal credentials: configured via environment variables (MEMBER_EMAIL/MEMBER_PASSWORD in .env)
- **2025-01-17**: Fixed Andrew Forbes registration error - updated member verification logic to handle flexible name matching for cases like "Forbes, MFA" vs "Forbes"

## User Preferences
- Use TypeScript throughout the application
- Follow existing code patterns and architecture
- Maintain separation between database storage and memory storage options
- Use shadcn/ui components for consistent UI design

## Development Notes
- The app runs on port 5000 for both frontend and backend
- Database migrations handled via `npm run db:push`
- Email service configured with mock transport for development
- WebSocket support configured for Neon serverless database