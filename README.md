# CSC Member Management System

A comprehensive member management system for professional organizations with advanced demographic analytics, role-based access control, and Discord integration.

## Features

- **Multi-role Authentication**: Admin, user, committee chair/co-chair/member roles
- **Member Management**: CSV import, comprehensive demographic tracking with 12 ethnic categories
- **Committee System**: Role-based committee management and assignments
- **Workshop Management**: Event creation, registration, and tracking
- **Role-based Calendar**: Admin-controlled visibility for events and workshops
- **Discord Integration**: Bot management, channel creation, role assignment, announcements
- **Demographic Analytics**: LGBTQ2+ status, BIPOC classification, geographic distribution
- **Communication**: Message groups and survey system
- **Verification System**: Email-based member onboarding

## Tech Stack

- **Frontend**: React with TypeScript, Vite, TailwindCSS + shadcn/ui
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM with Drizzle Kit
- **Authentication**: Passport.js with session-based auth
- **Email**: Nodemailer

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- (Optional) Discord application for Discord integration

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd csc-member-management
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your actual database credentials and API keys.

### Required Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `PGDATABASE`, `PGHOST`, `PGPASSWORD`, `PGPORT`, `PGUSER`: Database connection details
- `SESSION_SECRET`: Random string for session encryption

### Optional Environment Variables

- `DISCORD_BOT_TOKEN`: Discord bot token (for Discord integration)
- `DISCORD_CLIENT_ID`: Discord application client ID
- `DISCORD_GUILD_ID`: Discord server ID

### Database Setup

1. Push the database schema:
```bash
npm run db:push
```

2. (Optional) Import member data from CSV files using the admin interface

### Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

### Default Admin Account

The default admin account credentials are configured via environment variables:
- Email: Set via `ADMIN_EMAIL` in your .env file
- Password: Set via `ADMIN_PASSWORD` in your .env file

See `.env.example` for the default values.

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   └── lib/           # Utilities and configurations
├── server/                 # Express backend
│   ├── auth.ts            # Authentication logic
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Database operations
│   └── discord-bot.ts     # Discord integration
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema definitions
└── README.md
```

## Key Features

### Member Portal Features
- Personal profile management
- Workshop registration
- Committee participation
- Demographic change requests

### Admin Dashboard
- Member statistics and analytics
- Workshop management
- Calendar event creation
- Discord server management
- User account administration

### Committee Management
- Role-based permissions
- Member assignments
- Committee-specific access controls

## Deployment

This application is designed to run on platforms like Replit, Vercel, or any Node.js hosting service with PostgreSQL support.

### Environment Variables for Production

Ensure all required environment variables are set in your production environment:

- Database credentials
- Session secret
- Discord credentials (if using Discord integration)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Add your license information here]

## Support

For questions or support, contact the CSC technical team.