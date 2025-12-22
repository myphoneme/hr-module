# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Start server (Terminal 1) - runs on http://localhost:3001
cd server && npm run dev

# Start client (Terminal 2) - runs on http://localhost:5173
cd client && npm run dev
```

### Build & Lint
```bash
# Build server
cd server && npm run build

# Build client (includes TypeScript check)
cd client && npm run build

# Lint client
cd client && npm run lint
```

## Architecture

This is a full-stack Task Manager application with Google OAuth authentication and role-based access control.

### Client (`client/`)
- **Framework**: React 19 + TypeScript + Vite 7
- **Styling**: TailwindCSS 4
- **State Management**: TanStack Query for server state
- **Auth**: Google OAuth via `@react-oauth/google`, context in `src/contexts/AuthContext.tsx`
- **API Layer**: `src/api/client.ts` (with credentials), domain APIs in `src/api/`
- **Custom Hooks**: `src/hooks/` wraps TanStack Query for CRUD operations

### Server (`server/`)
- **Framework**: Express 5 + TypeScript
- **Database**: SQLite via better-sqlite3, initialized in `src/db.ts`
- **Auth**: Google OAuth token verification via `google-auth-library`, JWT in httpOnly cookies
- **Middleware**: `src/middleware/auth.ts` (authenticateToken, requireAdmin)
- **Routes**: auth, todos, comments, users, settings (admin), notifications, ai
- **Database File**: `server/database.sqlite` (auto-created on first run)

### Authentication System
- **Google Sign-In**: Primary login method - users sign in with their Google corporate account
- **Auto User Creation**: Users are created automatically on first Google sign-in
- **First User = Admin**: The first user to sign in becomes admin
- **Domain Restriction**: Admin can configure allowed email domains
- **Fallback Admin Login**: Email/password login available (for initial setup)
- **Default Admin**: `phoneme2016@gmail.com` / `Solution@1979` (if using email login)

### Google OAuth Setup
1. Create a Google Cloud project at https://console.cloud.google.com
2. Enable Google+ API
3. Create OAuth 2.0 credentials (Web application type)
4. Add authorized JavaScript origin: `http://localhost:5173`
5. Set environment variables:
   - Server: `GOOGLE_CLIENT_ID=your-client-id`
   - Client: `VITE_GOOGLE_CLIENT_ID=your-client-id` (in `.env` file)

### Database Schema
- `users`: id, email, password (empty for Google users), name, role, isActive, profilePhoto, lastLoginAt, timestamps
- `settings`: key-value store (e.g., `allowed_domains`)
- `todos`: id, title, description, assignerId (FK), assigneeId (FK), completed, priority (low/medium/high), isFavorite, dueDate, timestamps
- `comments`: id, todoId (FK), authorId (FK), content, createdAt
- `notifications`: id, userId (FK), type, title, message, relatedId, isRead, createdAt

### Access Control
- **Admin**: Full access - manage users, settings, edit/delete any task or comment
- **User**: Create tasks, edit/complete own tasks or assigned tasks, comment on any task
- **Assigner**: Can edit/delete their own tasks
- **Assignee**: Can edit and mark complete tasks assigned to them

### Key Patterns
- Assigner is automatically set to the logged-in user when creating tasks
- Tasks and comments reference users by ID, responses include user names via JOINs
- CORS configured for `http://localhost:5173` with credentials
- Server uses CommonJS, client uses ESM
