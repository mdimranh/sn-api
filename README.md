# Secure Notes API

REST API for a note-taking platform with JWT auth and role-based access control.
Stack: **Hono** · **MongoDB + Mongoose** · **JWT** · **bcrypt** · **Zod** · TypeScript

## Run locally

```bash
cp .env.example .env     # fill in MONGODB_URI and JWT_SECRET
npm install
npm run dev              # http://localhost:4000
```

If `ADMIN_EMAIL` / `ADMIN_PASSWORD` are set, an admin account is created on boot (if it doesn't exist).
Anyone registering through `/auth/register` becomes a plain `user`.

## Deploy on Render (free tier)

- New → Web Service → connect this repo
- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start`
- Env vars: everything in `.env.example` (use a MongoDB Atlas free cluster; allow `0.0.0.0/0` in Atlas network access)
- Set `CORS_ORIGIN` to your deployed frontend URL

## Endpoints

All list endpoints are paginated with `?page=1&limit=10` (limit max 100) and return
`{ items, pagination: { page, limit, total, totalPages } }`.

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | public | create account (role `user`) |
| POST | `/auth/login` | public | returns `{ token, user }` |
| GET / PATCH | `/auth/me` | auth | view / update own profile (name, interests, password) |
| GET | `/notes` | user | list **my** notes |
| POST | `/notes` | user | create note |
| GET | `/notes/:id` | owner or admin | read note |
| PATCH / DELETE | `/notes/:id` | owner | update / delete note |
| GET | `/admin/notes?owner=` | admin | list **everyone's** notes (optional filter by owner) |
| GET | `/users` | admin | list users |
| POST | `/users` | admin | add user (can set role) |
| GET / PATCH / DELETE | `/users/:id` | admin | read / update / remove user (deleting cascades to their notes and posts) |
| GET | `/users/grouped-by-interests?interest=` | admin | **Scenario 1** |
| GET | `/posts` | public | list all posts |
| POST | `/posts` | auth | create post |
| GET | `/posts/user/:userId` | public | **Scenario 2** |

## Indexing strategy (all declared with `schema.index`)

| Collection | Index | Why |
|---|---|---|
| users | `{ email: 1 }` unique | login/register lookup + uniqueness |
| users | `{ interests: 1 }` | Scenario 1 `$match` on interest (multikey) |
| notes | `{ owner: 1, _id: -1 }` | "my notes" list, admin "notes of user" list, counts, cascade delete |
| posts | `{ author: 1, _id: -1 }` | Scenario 2 `$lookup` (equality + sort), cascade delete |

Deliberately **not** indexed, because the default `_id` index already covers it:
get user by id, get note by id, admin list of all users, admin list of all notes,
public posts feed (all sorted by `_id` descending, which equals newest first).

## Aggregations

**Scenario 1 – group users by interest** (`routes/users.ts`): a single `User.aggregate()` call:
`$match` (optional interest filter, uses the interests index) → `$unwind` → `$group` (count + first 50 users)
→ `$sort` → `$facet` (page of groups + total). The first `$match` always uses the
`{ interests: 1 }` index: equality when `?interest=` is given, otherwise `{ $gte: "" }` which scans all interest
keys (users with no interests are dropped by `$unwind` anyway).

**Scenario 2 – posts of a user** (`routes/posts.ts`): one pipeline on `users`:
`$match _id` → `$lookup` into `posts` (localField/foreignField + sub-pipeline sort/skip/limit using the
`{author, _id}` index) → second `$lookup` with `$count` for the pagination total → `$project`.
