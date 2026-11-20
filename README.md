# Chat API

This is a Node.js application for a real-time chat system, built with Express, Prisma, and Socket.io.

## Features

- Password authentication with short-lived JWT + rotating refresh tokens, sign-up, password recovery by e-mail
- Channels with roles (owner / ADMIN / MEMBER), invites, member management, role changes and ownership transfer
- Inactive channels: history stays readable, but nobody posts until an admin reactivates them
- 1:1 direct messages (a channel of type `DIRECT`)
- Real-time messaging (Socket.io): cursor pagination, edit/delete, typing indicator, unread counts, presence
- Scalable realtime: Redis adapter for several instances, and an optional standalone Socket.io server (see [Realtime architecture](#realtime-architecture))
- Replies, @mentions (with notifications), emoji reactions, Markdown
- Activity feed (mentions + replies to me) and per-channel mute
- File and image attachments (thumbnails), user avatars
- Full-text search (Portuguese stemming) across every channel you belong to
- Zod validation, helmet, CORS allow-list, rate limit on `/sessions`

## Technologies

- **Node.js 22 + TypeScript**, **Express**
- **PostgreSQL + Prisma**: data, and full-text search with Portuguese stemming
- **Socket.io**: real-time events
- **Redis** (`redis`, `@socket.io/redis-adapter`, `@socket.io/redis-emitter`): shared emits, presence and the standalone realtime server
- **Zod**: request validation
- **bcryptjs** and **jsonwebtoken**: password hashing and access tokens
- **Multer** and **sharp**: uploads and image thumbnails
- **Nodemailer** (with **Mailpit** in dev): transactional e-mail
- **Helmet** and **express-rate-limit**: HTTP hardening
- **Vitest** and **Supertest**: API test suite

## Getting Started

### Running with Docker (recommended)

The only requirement is Docker with Compose. This starts **PostgreSQL**, **Redis**, the **API**, the **realtime server** (Socket.io) and the **web front-end**, all in watch mode (hot reload). Migrations are applied automatically on startup.

> The `web` service is built from `../web`, so both repositories must be cloned side by side:
> `chat-sys/api` and `chat-sys/web`.

```bash
docker compose up --build -d      # or: pnpm docker:up
```

- Web: http://localhost:8080
- API: http://localhost:3333
- Realtime (Socket.io): http://localhost:3334
- Postgres: `localhost:5432` (user/password/db: `docker`)
- Mailpit (catches every e-mail sent in dev): http://localhost:8025

To run only the back-end (e.g. front-end with `pnpm dev` on the host): `docker compose up -d db redis api realtime`.

Useful commands:

| Command | What it does |
| --- | --- |
| `docker compose exec api pnpm prisma db seed` (`pnpm docker:seed`) | Seed the database (logins `gustavo@gmail.com` and `gabriel@gmail.com`, password `123456`, plus generated users) |
| `docker compose exec api pnpm test` (`pnpm docker:test`) | Run the API test suite (Vitest + Supertest) against a separate `chat_test` database, recreated on every run |
| `docker compose logs -f api realtime web` | Follow API, realtime and web logs (`pnpm docker:logs` follows API and web) |
| `docker compose down` (`pnpm docker:down`) | Stop containers (data is kept) |
| `docker compose down -v` | Stop and **delete** the database volume |
| `docker compose up --build -d -V` | Rebuild after changing `package.json` dependencies (API or web) |

> **Why `-V`:** `node_modules` lives in an anonymous volume, and Compose reuses it when it recreates a
> container. Without `-V` (`--renew-anon-volumes`) a container keeps its old `node_modules` and fails
> with `Cannot find module '<new package>'`.

To seed automatically at startup: `RUN_SEED=true docker compose up -d`.
Ports and credentials can be overridden through env vars / a `.env` file (`API_PORT`, `REALTIME_PORT`, `WEB_PORT`, `VITE_API_URL`, `VITE_SOCKET_URL`, `REALTIME_MODE`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).

Creating a new migration after editing `prisma/schema.prisma`:

```bash
docker compose exec api pnpm prisma migrate dev --name <migration-name>
```

### Running locally (without Docker for the API)

#### Prerequisites

- Node.js (v22 or higher)
- pnpm (v9)
- A running Postgres (you can use only the database container: `docker compose up -d db`)
- Redis, only for the scaled or standalone realtime modes (`docker compose up -d redis`)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Guribeiro/chat-sys-api.git
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

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | API in watch mode (`src/server.ts`), loading `.env` |
| `pnpm dev:realtime` | Standalone Socket.io server in watch mode (`src/realtime-server.ts`), for `REALTIME_MODE=standalone` |
| `pnpm test` / `pnpm test:watch` | Test suite (Vitest + Supertest). Needs Postgres: it recreates a separate `chat_test` database (`TEST_DATABASE_URL` overrides it) and always runs in embedded mode, without Redis |
| `pnpm db:studio` | Prisma Studio |
| `pnpm docker:up` / `docker:down` / `docker:logs` / `docker:seed` / `docker:test` | Shortcuts for the Docker commands above |

## Realtime architecture

Socket.io can run in two modes, chosen by `REALTIME_MODE`:

| Mode | Where Socket.io runs | When to use |
| --- | --- | --- |
| `embedded` (default) | Inside the API process, on the same port | Local dev, tests, a single instance. Redis is optional. |
| `standalone` (Docker default) | `src/realtime-server.ts`, its own process/port | Deploying the API without dropping connections; scaling HTTP and WebSockets separately. Requires Redis. |

How the pieces fit:

```
Browser ──HTTP──▶ API ──publish (Redis emitter)──▶ Redis ──▶ realtime instance(s) ──WebSocket──▶ Browser
```

- **Redis adapter** (`@socket.io/redis-adapter`): with `REDIS_URL`, every realtime instance (or every embedded API) relays emits and room operations to the others. That is what makes more than one instance possible: a message posted on instance A reaches a user connected to instance B.
- **Redis emitter** (`@socket.io/redis-emitter`): in standalone mode the API holds no connections. Controllers call `getPublisher()` (`src/socket/publisher.ts`), which is the local Socket.io server in embedded mode and an emitter in standalone mode, with the same `to(...).emit(...)` API.
- **Presence** (`src/socket/presence.ts`): kept in memory without Redis. With Redis, each instance owns a `presence:<serverId>` hash with a 30s TTL renewed by a heartbeat, so a crashed instance's users go offline on their own.
- The web client connects with `transports: ['websocket']`, so a load balancer in front of several realtime instances needs no sticky sessions.

Running standalone outside Docker: start Redis (`docker compose up -d redis`), set `REDIS_URL` and `REALTIME_MODE=standalone` in `.env`, then run `pnpm dev` and `pnpm dev:realtime`, and point the web app at it with `VITE_SOCKET_URL=http://localhost:3334`.

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

Inactive channels are read-only: sending messages and uploading files return `403` until an admin reactivates them.

- `POST /` - Create a channel (you become its owner)
- `GET /:slug` · `PUT /:slug` · `DELETE /:slug` - Read / rename (admins) / delete (owner)
- `PATCH /:slug/active` - Activate or deactivate (admins)
- `GET /:slug/members` · `DELETE /:slug/members/:memberId` - List / remove (admins; only the owner removes admins)
- `PATCH /:slug/members/:memberId` - `{ role: 'ADMIN' | 'MEMBER' }` change a member's role (admins; only the owner demotes an admin)
- `POST /:slug/transfer-ownership` - `{ memberId }` hand the channel over to another member (owner)
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

## Socket events

The client connects with its access token in `auth: { token }` (the handshake is refused with
`unauthorized` otherwise). Each socket joins its personal room `user:<id>`, and the channel room
`channel:<id>` after a successful `channel:join`. The full typed contract is in
[`src/socket/events.ts`](src/socket/events.ts); the web app keeps a copy in sync.

| Direction | Event | Purpose |
| --- | --- | --- |
| client → server | `channel:join` `{ slug }` + ack | Join a channel room (members only); the ack returns `{ ok, channelId }` or a pt-BR error |
| client → server | `channel:leave` `{ slug }` | Leave the room |
| client → server | `channel:typing` `{ channelId }` | Relayed to the room, never stored |
| server → client | `presence:snapshot` · `presence:update` | Who is online (on connect, then on changes) |
| server → client | `channel:message` · `channel:message_updated` · `channel:message_deleted` · `channel:message_reactions` | Messages of a joined channel |
| server → client | `channel:typing` | Someone is typing in a joined channel |
| server → client | `channel:activity` | New message in any of my channels (unread badges, desktop notifications) |
| server → client | `channel:updated` · `channel:deleted` · `channel:member_added` · `channel:member_removed` · `channel:member_updated` · `channel:owner_changed` | Channel and membership changes |
| server → client | `notification:new_invite` · `notification:invite_revoked` · `notification:activity` | Invites, mentions and replies addressed to me |

## Database Schema

The database schema is defined in the `prisma/schema.prisma` file and includes the following models:

- `User`: Stores user information.
- `Token`: Stores tokens for password recovery and refresh.
- `Member`: Represents a user's membership in a channel.
- `Invite`: Stores invitations for users to join channels.
- `Channel`: Represents a chat channel.
- `Message`: Stores messages sent within a channel (soft delete, replies via `parentId`).
- `Reaction`, `Mention`, `Attachment`: Emoji reactions, @mentions and uploaded files of a message.
- Enums: `Role` (`ADMIN`, `MEMBER`), `ChannelType` (`GROUP`, `DIRECT`), `TokenType` (`PASSWORD_RECOVER`, `REFRESH`).

For more details, see the `prisma/schema.prisma` file.
