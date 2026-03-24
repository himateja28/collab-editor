# Collaborative Document Editor

A full-stack collaborative editor inspired by Google Docs, built with React, Node.js, Express, Socket.IO, and MongoDB.

## Features

- Real-time collaborative editing across tabs/devices
- Presence indicators (active users + cursor index updates)
- JWT auth (register/login/me)
- Document CRUD with owner/editor/viewer permissions
- Rich text editing (bold, italic, underline, headings, lists, alignment, links, images)
- Autosave + version history snapshots
- Comments and suggestion mode (suggestions are stored as comment events)
- Dark mode toggle
- Export to pseudo PDF/Word (plain text download with extension)

## Architecture

### Frontend

- React + React Router
- Quill rich-text editor
- Socket.IO client for real-time updates
- Axios for REST APIs
- Context API for authentication state

### Backend

- Express REST API
- Socket.IO collaboration server
- MongoDB with Mongoose models
- JWT + bcrypt authentication

### Folder Structure

```text
.
|-- src/
|   |-- components/
|   |-- context/
|   |-- pages/
|   |-- services/
|   `-- utils/
|-- server/
|   |-- config/
|   |-- controllers/
|   |-- middleware/
|   |-- models/
|   |-- routes/
|   `-- sockets/
|-- docker-compose.yml
|-- Dockerfile
`-- README.md
```

## API Endpoints

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Documents

- `GET /documents`
- `POST /documents`
- `GET /documents/:id`
- `PUT /documents/:id`
- `DELETE /documents/:id`
- `PATCH /documents/:id/permissions`
- `POST /documents/:id/share-link`
- `GET /documents/:id/history`
- `POST /documents/:id/comments`
- `PATCH /documents/:id/comments/:commentId/resolve`

## Real-Time Sync Logic

1. Client joins a document room via `document:join` with JWT token.
2. Server validates access and returns canonical document delta/version via `document:load`.
3. Each local user edit emits `document:delta`.
4. Server composes incoming delta onto canonical room state and increments `version`.
5. Server broadcasts `document:remote-delta` to other room members.
6. Clients apply remote delta with Quill `updateContents(delta, "api")`.
7. Server debounces autosave to MongoDB (default 1.5s after last change).

This is centralized sequencing (OT-like) where the server serializes incoming operations in arrival order. It is low-latency and practical for collaborative typing with Socket.IO rooms.

## Local Setup

### Prerequisites

- Node.js 20+
- MongoDB running locally (or Atlas URI)

### 1. Install Dependencies

```bash
npm install
npm --prefix server install
```

### 2. Configure Environment

Create these files:

- `.env` at project root:

```env
REACT_APP_API_URL=http://localhost:5000
```

- `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/collab-editor
JWT_SECRET=replace-with-strong-secret
CLIENT_ORIGIN=http://localhost:3000
```

### 3. Run Development

Run both frontend and backend together:

```bash
npm run dev
```

Or run separately:

```bash
npm start
npm --prefix server run dev
```

Frontend: `http://localhost:3000`  
Backend: `http://localhost:5000`

## Validation Commands

```bash
npm run build
CI=true npm test -- --watch=false
```

## Docker Deployment (Optional)

### Compose for backend + Mongo

```bash
docker compose up --build
```

This starts:

- MongoDB on `27017`
- API/socket server on `5000`

### Frontend image

```bash
docker build -t collab-editor-client .
docker run -p 8080:80 collab-editor-client
```

Then open `http://localhost:8080`.

## Cloud Deployment Guide

### Backend

- Deploy `server/` to Render, Railway, Fly.io, or AWS ECS.
- Set `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `PORT`.
- Use sticky sessions or Socket.IO adapter + Redis for horizontal scaling.

### Frontend

- Deploy React build to Vercel/Netlify/Azure Static Web Apps.
- Set `REACT_APP_API_URL` to deployed backend URL.

## Notes and Constraints

- Google OAuth is optional and not included in this baseline.
- True CRDT/advanced OT transform logic can be added later (Yjs/Automerge or dedicated OT engine).
- Current conflict strategy relies on centralized ordered deltas on server.
- To keep update latency under 200ms in production, run backend close to users and use Redis adapter when scaling socket instances.
