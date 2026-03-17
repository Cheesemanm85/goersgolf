## Goers Golf (Next.js + Tailwind)

Minimal fantasy golf web app starter with:

- Basic **username/password auth** (JWT in httpOnly cookie)
- Protected pages: `/team`, `/dashboard`
- Team creation with team name (file-backed demo storage)

## Getting Started

### 1) Install

```bash
npm install
```

### 2) Configure env

Copy `.env.local.example` to `.env.local` and set a strong secret:

```bash
cp .env.local.example .env.local
```

### 3) Run

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Notes

- Demo data is stored in `data/users.json` and `data/teams.json` (good enough for local dev; we’ll replace this with a real DB next).
