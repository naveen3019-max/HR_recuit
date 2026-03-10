# HR Recruitment CRM Platform

Production-ready full-stack SaaS starter for recruitment teams.

## Tech Stack

- Backend: Node.js, Express.js, JWT, Prisma ORM
- Frontend: React.js (Vite)
- Database: PostgreSQL
- AI Integration: LLM API (OpenAI-compatible endpoint)
- External Integration: LinkedIn Recruiter API

## Folder Structure

```text
/backend
  /config
  /controllers
  /routes
  /services
  /middleware
  /models
  /utils
  /prisma
  server.js
/frontend
  /src
    /components
    /pages
    /services
    /context
```

## Backend Features Implemented

- Auth module
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - JWT auth + role-based access control
- Candidate CRM module
  - `POST /api/candidates`
  - `GET /api/candidates`
  - `GET /api/candidates/:id`
  - `PUT /api/candidates/:id`
  - `DELETE /api/candidates/:id`
- Recruitment pipeline module
  - `PUT /api/candidates/:id/stage`
- LinkedIn integration module
  - `POST /api/linkedin/import`
- AI insights module
  - `POST /api/ai/candidate-summary`

## Frontend Features Implemented

- Sidebar navigation
- Pages:
  - Dashboard
  - Candidates
  - Candidate Profile
  - Recruitment Pipeline
- Components:
  - Candidate table
  - Candidate profile view
  - Filtering panel
  - Search bar
  - Stage status badges
- Candidate filtering by:
  - skills
  - experience
  - location
  - recruitment stage

## Setup Instructions

## 1. Start PostgreSQL

Create database:

```sql
CREATE DATABASE hr_crm;
```

## 2. Configure Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
```

Backend runs at `http://localhost:5000`.

## 3. Configure Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Environment Variables

Backend: `backend/.env`

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`
- `LINKEDIN_API_BASE_URL`
- `LLM_API_URL`
- `LLM_API_KEY`
- `LLM_MODEL`

Frontend: `frontend/.env`

- `VITE_API_URL`

## API Security

- Helmet headers enabled
- Rate limiting on `/api/*`
- CORS restricted by `FRONTEND_URL`
- Input validation via Zod
- JWT + RBAC middleware

## Notes

- LinkedIn APIs require valid recruiter access tokens and approved app scopes.
- AI summary endpoint supports any OpenAI-compatible chat completion API URL.
- Candidate deletion is admin-only by default.
