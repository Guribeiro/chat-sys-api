# Chat API

This is a Node.js application for a real-time chat system, built with Express, Prisma, and Socket.io.

## Features

- User authentication (password-based)
- Create, update, delete, and manage channels
- Real-time messaging within channels
- Invite users to channels
- Manage channel members
- Password recovery

## Technologies

- **Node.js:** JavaScript runtime environment
- **Express:** Web framework for Node.js
- **Prisma:** Next-generation ORM for Node.js and TypeScript
- **Socket.io:** Real-time, bidirectional event-based communication
- **TypeScript:** Typed superset of JavaScript
- **Zod:** TypeScript-first schema validation
- **bcryptjs:** Library for hashing passwords
- **jsonwebtoken:** Library for creating and verifying JSON Web Tokens

## Getting Started

### Prerequisites

- Node.js (v22 or higher)
- pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/chat-api.git
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a `.env` file based on the `.env.example` file and provide the necessary environment variables.
4. Run database migrations:
   ```bash
   pnpm exec prisma migrate dev
   ```
5. Seed the database (optional):
    ```bash
    pnpm exec prisma db seed
    ```

### Running the Application

- **Development mode:**
  ```bash
  pnpm run dev
  ```
- **Database studio:**
    ```bash
    pnpm run db:studio
    ```

## API Endpoints

### Authentication

- `POST /password` - Authenticate with password
- `POST /password/recover` - Request password recovery
- `POST /password/reset` - Reset password

### Channels

- `POST /` - Create a new channel
- `GET /:slug` - Get channel details
- `DELETE /:slug` - Delete a channel
- `PUT /:slug` - Update a channel
- `PATCH /:slug/active` - Update channel status
- `GET /:slug/members` - Get channel members
- `DELETE /:slug/members/:memberId` - Remove a channel member
- `GET /:slug/messages` - Get channel messages
- `POST /:slug/messages` - Create a new message in a channel
- `GET /:slug/invites` - Get channel invites
- `POST /:slug/invites` - Create a new invite for a channel
- `DELETE /:slug/invites/:inviteId` - Revoke an invite

### Me

- `GET /channels` - Get channels for the authenticated user
- `POST /invites/:inviteId/reject` - Reject an invite
- `POST /invites/:inviteId/accept` - Accept an invite
- `GET /pending-invites` - Get pending invites for the authenticated user

### Users

- `GET /` - List all users

## Database Schema

The database schema is defined in the `prisma/schema.prisma` file and includes the following models:

- `User`: Stores user information.
- `Token`: Stores tokens for password recovery and refresh.
- `Member`: Represents a user's membership in a channel.
- `Invite`: Stores invitations for users to join channels.
- `Channel`: Represents a chat channel.
- `Message`: Stores messages sent within a channel.

For more details, see the `prisma/schema.prisma` file.
