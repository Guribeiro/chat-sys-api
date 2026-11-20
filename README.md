# Chat API

This is a Node.js application for a real-time chat system, built with Express, Prisma, and Socket.io.

## Features

- Password authentication with short-lived JWT + rotating refresh tokens, sign-up, password recovery by e-mail
- Channels with roles (owner / ADMIN / MEMBER), invites and member management
- 1:1 direct messages (a channel of type `DIRECT`)
- Real-time messaging (Socket.io): cursor pagination, edit/delete, typing indicator, unread counts, presence
- Replies, @mentions (with notifications), emoji reactions, Markdown
- Activity feed (mentions + replies to me) and per-channel mute
- File and image attachments (thumbnails), user avatars
- Full-text search (Portuguese stemming) across every channel you belong to
- Zod validation, helmet, CORS allow-list, rate limit on `/sessions`

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

### Running with Docker (recommended)

The only requirement is Docker with Compose. This starts **PostgreSQL**, the **API** and the **web front-end**, all in watch mode (hot reload). Migrations are applied automatically on startup.

> The `web` service is built from `../web`, so both repositories must be cloned side by side:
> `chat-sys/api` and `chat-sys/web`.

```bash
docker compose up --build -d      # or: pnpm docker:up
```

- Web: http://localhost:8080
- API: http://localhost:3333
- Postgres: `localhost:5432` (user/password/db: `docker`)
- Mailpit (catches every e-mail sent in dev): http://localhost:8025

To run only the back-end (e.g. front-end with `pnpm dev` on the host): `docker compose up -d db api`.

Useful commands:

| Command | What it does |
| --- | --- |
| `docker compose exec api pnpm prisma db seed` (`pnpm docker:seed`) | Seed the database (login `gustavo@gmail.com` / `123456`) |
| `docker compose exec api pnpm test` (`pnpm docker:test`) | Run the API test suite (Vitest + Supertest) against a separate `chat_test` database, recreated on every run |
| `docker compose logs -f api web` (`pnpm docker:logs`) | Follow API and web logs |
| `docker compose down` (`pnpm docker:down`) | Stop containers (data is kept) |
| `docker compose down -v` | Stop and **delete** the database volume |
| `docker compose up --build -d` | Rebuild after changing `package.json` dependencies (API or web) |

To seed automatically at startup: `RUN_SEED=true docker compose up -d`.
Ports and credentials can be overridden through env vars / a `.env` file (`API_PORT`, `WEB_PORT`, `VITE_API_URL`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).

Creating a new migration after editing `prisma/schema.prisma`:

```bash
docker compose exec api pnpm prisma migrate dev --name <migration-name>
```

### Running locally (without Docker for the API)

#### Prerequisites

- Node.js (v22 or higher)
- pnpm
- A running Postgres (you can use only the database container: `docker compose up -d db`)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/guribeiro/chat-api.git
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

Every route except `/sessions/*` requires `Authorization: Bearer <token>`. Bodies, params and
queries are validated with Zod (`src/http/schemas.ts`); invalid input returns `400` with `errors`.

### Sessions (`/sessions`)

- `POST /account` - Create an account
- `POST /password` - Log in, returns `{ token, refreshToken, user }`
- `POST /refresh` - Exchange a refresh token for a new pair (single use)
- `POST /logout` - Revoke a refresh token
- `POST /password/recover` - Send a recovery link by e-mail (valid for 1 hour)
- `POST /password/reset` - Reset the password with the code (single use, ends every session)

### Channels (`/channels`) — members only

- `POST /` - Create a channel (you become its owner)
- `GET /:slug` · `PUT /:slug` · `DELETE /:slug` - Read / rename (admins) / delete (owner)
- `PATCH /:slug/active` - Activate or deactivate (admins)
- `GET /:slug/members` · `DELETE /:slug/members/:memberId` - List / remove (admins; only the owner removes admins)
- `GET /:slug/messages?cursor=&limit=` - Messages, newest page first (`nextCursor` loads older ones)
- `POST /:slug/messages` - `{ content?, replyToId?, attachmentIds? }`
- `PATCH /:slug/messages/:id` · `DELETE /:slug/messages/:id` - Edit (author) / delete (author or admin)
- `POST /:slug/messages/:id/reactions` - Toggle an emoji reaction
- `POST /:slug/attachments` - Upload up to 5 files (`files` field, 10 MB each), then send their ids in a message
- `POST /:slug/read` - Mark the channel as read
- `PATCH /:slug/notifications` - `{ muted }` mute/unmute the channel for me (mentions and replies still notify)
- `GET /:slug/invites` · `POST /:slug/invites` · `DELETE /:slug/invites/:inviteId` - Invites (admins)

### Me (`/me`)

- `GET /` · `PATCH /` - Profile / change name
- `PATCH /password` - Change password (other sessions are revoked)
- `PUT /avatar` · `DELETE /avatar` - Upload (`avatar` field) / remove the avatar
- `GET /channels` - My channels and DMs, with `unreadCount`, `unreadMentionCount`, `muted` (and `peer` for DMs)
- `GET /activity?cursor=&limit=` - Mentions of me and replies to my messages, newest first, with `unreadCount`
- `POST /activity/seen` - Mark the activity feed as seen
- `POST /direct-messages` - Open or reuse a DM with `{ userId }`
- `GET /search?q=` - Full-text search in all my channels
- `GET /pending-invites` · `POST /invites/:id/accept` · `POST /invites/:id/reject`

### Users (`/users`)

- `GET /?q=&limit=` - Search users by name or e-mail

### Files

- `GET /uploads/...` - Uploaded files (random, unguessable names; non-images are served as downloads)

## Database Schema

The database schema is defined in the `prisma/schema.prisma` file and includes the following models:

- `User`: Stores user information.
- `Token`: Stores tokens for password recovery and refresh.
- `Member`: Represents a user's membership in a channel.
- `Invite`: Stores invitations for users to join channels.
- `Channel`: Represents a chat channel.
- `Message`: Stores messages sent within a channel (soft delete, replies via `parentId`).
- `Reaction`, `Mention`, `Attachment`: Emoji reactions, @mentions and uploaded files of a message.

For more details, see the `prisma/schema.prisma` file.
