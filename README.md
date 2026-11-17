# Event Bridge

> **One request. Multiple quotes. One place to compare.**

A web-based multi-vendor B2B marketplace that lets university societies send one event-service request to many vendors and compare quotations side by side.

[![Status](https://img.shields.io/badge/status-stages%200--4%20complete-brightgreen)](<>)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](<>)
[![Tests](https://img.shields.io/badge/tests-26%20passing-brightgreen)](<>)
[![Stack](https://img.shields.io/badge/stack-React%20%7C%20Node%20%7C%20Express%20%7C%20Neon-1f6feb)](<>)
[![Docs](https://img.shields.io/badge/docs-SRS%20v1.0-informational)](<>)

> **Implementation status (17 Nov 2026):** the backend is complete for **stages 0–4** — npm
> workspaces, the full 14-table schema with migrations, the seed script, authentication (JWT
> access token + rotating refresh cookie, argon2id hashing), society/vendor profiles, the public
> vendor directory, admin-managed categories, admin vendor review and account administration,
> plus request drafts, submission, vendor matching/distribution, request management and the
> vendor request board.
>
> **Quality gates are green.** `npm run typecheck`, `npm run lint`, `npm run build` and
> `npm test` all pass; the suite runs **36/36 tests**, including the real migrations and the
> auth, quotation and notification flows against PostgreSQL-in-WASM.
>
> **Frontend.** A working React + TypeScript frontend runs against the live API: a marketing
> landing page, a searchable vendor directory, login and registration for both societies and
> vendors, a society dashboard that publishes requests and reviews vendor applications, a vendor
> dashboard showing verification, matched requests and an inline quotation form, an admin console
> with platform stats, vendor approval/rejection and category oversight, and a notification bell
> with unread counts. Routing uses a single `BrowserRouter`, sessions are restored from the
> httpOnly refresh cookie, and the UI is built with Tailwind.
>
> **Not built yet.** Quotation selection/preference, withdrawal, a dedicated side-by-side
> comparison view, reviews, portfolio uploads, payments and analytics. The
> [API reference](#8-api-reference) and [build order](#21-build-order) describe the complete
> target specification; shipped endpoints and partially built stages are called out.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem and Solution](#2-problem-and-solution)
3. [Key Features](#3-key-features)
4. [Tech Stack](#4-tech-stack)
5. [Architecture](#5-architecture)
6. [Repository Structure](#6-repository-structure)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Roles and Permissions](#9-roles-and-permissions)
10. [Status Lifecycles](#10-status-lifecycles)
11. [Requirement Coverage](#11-requirement-coverage)
12. [Getting Started](#12-getting-started)
13. [Environment Variables](#13-environment-variables)
14. [Available Scripts](#14-available-scripts)
15. [Testing](#15-testing)
16. [Security](#16-security)
17. [Deployment](#17-deployment)
18. [Roadmap](#18-roadmap)
19. [Definition of Done](#19-definition-of-done)
20. [Team and Documentation](#20-team-and-documentation)
21. [Build Order](#21-build-order)

---

## 1. Overview

University societies run events constantly — competitions, seminars, cultural nights, fests — on small budgets and short deadlines. They find vendors through WhatsApp groups, Instagram, seniors and personal contacts. Prices are hard to compare, and the contact history disappears the moment a new team takes over.

**Event Bridge** replaces that fragmented process with one structured workflow:

1. A society describes the service it needs and its budget.
2. The platform distributes that single request to eligible vendors.
3. Vendors respond with structured quotations.
4. The society compares offers side by side and records a preferred/selected quotation.
5. Vendor profiles, past work and quotation history stay saved for future teams.

**Core value propositions**

| For societies                                     | For vendors                                |
| ------------------------------------------------- | ------------------------------------------ |
| One request instead of ten phone calls            | Access to a new, verified customer segment |
| Side-by-side quotation comparison                 | Structured, pre-qualified leads            |
| Vendor history preserved across committee changes | Profile and portfolio that persist         |
| Trust signals (verification, reviews)             | No cost to join during the pilot           |

> **Note on scope:** Event Bridge supports _discovery, comparison and selection_. It does **not** replace a university's procurement or approval authority, and selecting a quotation is not a confirmed booking.

---

## 2. Problem and Solution

### Evidence base

The project is derived from the _Event Bridge Market Intelligence Report (2026)_, which recorded a survey of **51 students** (35 with recent event-organising experience) and interviews with **5 vendors** in Karachi.

| Finding                                                        | Result                |
| -------------------------------------------------------------- | --------------------- |
| Societies rely on previous society contacts                    | 62.9%                 |
| Societies rely on seniors / previous office bearers            | 60%                   |
| Biggest sourcing problem: trust                                | 60%                   |
| Biggest sourcing problem: budget                               | 51.4%                 |
| Rated the platform idea 4 or 5 out of 5                        | 85.7%                 |
| Must use approved or registered vendors, or get approval       | 68.5%                 |
| Most-needed services: catering / decoration / sound & lighting | 77.1% / 62.9% / 48.6% |

These are early signals from a small convenience sample — not proof of product-market fit. The MVP exists to test real usage.

### Design implications

- **Trust first:** vendor verification, portfolio evidence and reviews are first-class features.
- **Breadth early:** societies want many vendors in one place (51.4%), so launch with a focused but dense vendor network.
- **Fit university rules:** approval and procurement rules stay with the institution; the platform records and respects them.
- **Free for societies:** vendor-side fees are validated during the pilot, not assumed.

---

## 3. Key Features

### MVP (P0 — essential)

> ✅ implemented · ⬜ not built yet (see [§21](#21-build-order) for sequencing).

- [x] Registration and login for society and vendor users, with role-based access control
- [x] Society profile management
- [x] Vendor business profile: categories, service area, description
- [x] Administrator review of vendor applications (approve / reject / request changes)
- [x] Administrator-managed service categories
- [x] Event and service-request creation (date, location, budget, quantity, description)
- [x] Category-based vendor matching and request distribution
- [x] Structured quotation submission (price, scope, inclusions, exclusions, validity), editable until the request closes
- [x] Society quotation listing and per-request application review
- [ ] Side-by-side comparison view and preferred/selected quotation recording with audit trail
- [x] Request status tracking (`open` → `partially_quoted` on the first quotation; `quoted`/`selected` still planned)
- [x] In-app notifications with unread counts, a header bell and mark-as-read controls
- [x] Dashboards for society, vendor and administrator, including the quotation and application flows

### P1 (important, after core flow works)

- [ ] Portfolio image uploads
- [x] Search and filtering (vendor directory)
- [ ] Reviews and ratings after completed engagements
- [ ] Audit log UI
- [x] Basic analytics for the administrator (platform stats)
- [ ] Multiple representatives per society

### Explicitly out of scope for the MVP

- Online payments, refunds, escrow or payment disputes
- Vendor subscriptions or paid featured listings
- Automated university procurement approval or ERP integration
- Native Android/iOS apps
- AI recommendations, price prediction or sentiment analysis
- Contract generation, e-signature, legal dispute resolution
- GPS tracking, accounting, payroll or inventory management

---

## 4. Tech Stack

| Layer         | Choice                                                               | Why                                                         |
| ------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| Frontend      | **React 19** + **Vite**                                              | Fast dev server, modern component model                     |
| Routing       | **React Router v7**                                                  | Route-level layouts and role guards                         |
| Data fetching | **Typed `fetch` client**                                             | Small surface; auth refresh and errors handled in one place |
| Forms         | **Controlled React forms** + **Zod**                                 | Shared validation rules live in `packages/shared`           |
| Styling       | **Tailwind CSS**                                                     | Consistent, responsive UI without bespoke CSS               |
| Backend       | **Node.js 22 LTS** + **Express 5**                                   | Minimal, well-understood REST API                           |
| Database      | **Neon (PostgreSQL 16+)**                                            | Serverless Postgres, branching for dev/prod                 |
| DB driver     | **`pg` + Drizzle ORM**                                               | Typed queries, SQL-first migrations                         |
| Auth          | **JWT access token + refresh cookie**, **argon2id** password hashing | Stateless API with revocable sessions                       |
| Validation    | **Zod** (server and client)                                          | One schema, consistent errors                               |
| Logging       | **pino**                                                             | Structured, JSON-friendly logs                              |
| Testing       | **Vitest** + **Supertest**                                           | API, schema and migration tests                             |

**Minimum versions:** Node ≥ 22, npm ≥ 10, PostgreSQL ≥ 16 (Neon).

---

## 5. Architecture

```
┌──────────────────────────┐        HTTPS/JSON        ┌──────────────────────────┐
│   React SPA (Vite)       │  ──────────────────────▶ │   Express API            │
│   - Public pages         │                          │   - Auth / RBAC          │
│   - Society dashboard    │  ◀────────────────────── │   - Profiles             │
│   - Vendor dashboard     │      REST + JWT          │   - Requests / matching  │
│   - Admin dashboard      │                          │   - Quotations           │
└──────────────────────────┘                          │   - Admin / audit        │
                                                      └───────────┬──────────────┘
                                                                  │ pg (SSL, pooled)
                                                                  ▼
                                                      ┌──────────────────────────┐
                                                      │   Neon PostgreSQL        │
                                                      │   - Relational core      │
                                                      │   - Enum-based statuses  │
                                                      │   - Audit + notifications│
                                                      └──────────────────────────┘
```

**Request flow (happy path)**

```
Society                API                      Database              Vendors
   │  POST /requests      │                          │                    │
   ├─────────────────────▶│  validate + insert       │                    │
   │                      ├─────────────────────────▶│                    │
   │                      │  match vendors by cat.   │                    │
   │                      ├─────────────────────────▶│                    │
   │                      │  notify eligible         │                    │
   │                      ├───────────────────────────────────────────────▶│
   │                      │                          │   POST /quotations │
   │                      │◀───────────────────────────────────────────────┤
   │  GET /requests/:id/quotations                   │                    │
   ├─────────────────────▶│  ownership check         │                    │
   │◀─────────────────────┤  comparison payload      │                    │
   │  PATCH /quotations/:id/select                     │                    │
   ├─────────────────────▶│  record selection + audit│                    │
   │                      ├─────────────────────────▶│                    │
```

**Key architectural decisions**

| Decision                                                             | Rationale                                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| SPA + REST API (not SSR)                                             | Simple mental model for a student team; easy to test and deploy separately |
| Server-side authorization on every protected route                   | Hiding UI is not security (NFR-010)                                        |
| Status as database enums                                             | Prevents illegal states at the storage layer                               |
| Ownership checks in a shared middleware/service                      | Reduces cross-account data leaks (BR-005, FR-045)                          |
| Neon pooled connection for the app, direct connection for migrations | PgBouncer compatibility and reliable DDL                                   |
| Categories are data, not code                                        | Administrators add/deactivate without a deploy (NFR-026)                   |
| No payments in MVP                                                   | Keeps PCI scope and legal exposure out of the pilot                        |

---

## 6. Repository Structure

```
event-bridge/
├─ apps/
│  ├─ web/                        # React SPA
│  │  ├─ src/
│  │  │  ├─ app/                  # router, providers, layouts
│  │  │  ├─ components/           # shared UI (Button, Table, StatusBadge…)
│  │  │  ├─ features/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ society/
│  │  │  │  ├─ vendor/
│  │  │  │  ├─ admin/
│  │  │  │  └─ quotations/
│  │  │  ├─ lib/                  # api client, query keys, formatters
│  │  │  ├─ hooks/
│  │  │  └─ styles/
│  │  └─ vite.config.ts
│  └─ api/                        # Express API
│     ├─ src/
│     │  ├─ config/               # env parsing, db pool, logger
│     │  ├─ db/
│     │  │  ├─ schema/            # Drizzle table definitions
│     │  │  ├─ migrations/        # generated SQL
│     │  │  └─ seed.ts
│     │  ├─ modules/
│     │  │  ├─ auth/
│     │  │  ├─ users/
│     │  │  ├─ societies/
│     │  │  ├─ vendors/
│     │  │  ├─ categories/
│     │  │  ├─ events/
│     │  │  ├─ requests/
│     │  │  ├─ quotations/
│     │  │  ├─ reviews/
│     │  │  ├─ notifications/
│     │  │  └─ admin/
│     │  ├─ middleware/           # auth, rbac, validate, error, rateLimit
│     │  ├─ lib/                  # errors, pagination, audit
│     │  ├─ routes.ts
│     │  └─ server.ts
│     └─ tests/
├─ packages/
│  └─ shared/                     # Zod schemas, enums, types shared by web + api
├─ docs/
│  ├─ api.md                       # endpoint contracts (added as modules are built)
│  └─ architecture.md              # diagrams and decision log (added at stage 6)
├─ Event_Bridge_MIR_final.docx.pdf # source Market Intelligence Report (read-only)
├─ Event_Bridge_Software_Requirements_Specification.docx # source SRS (read-only)
├─ .env.example
├─ package.json                   # npm workspaces + root scripts
└─ README.md
```

Each API module follows the same shape:

```
modules/quotations/
├─ quotations.routes.ts      # route definitions + middleware wiring
├─ quotations.controller.ts  # HTTP in / HTTP out
├─ quotations.service.ts     # business rules and authorization
├─ quotations.repo.ts        # SQL / Drizzle queries
└─ quotations.schema.ts      # Zod request + response schemas
```

---

## 7. Database Schema

### Entity-relationship diagram

```mermaid
erDiagram
    USERS ||--o| SOCIETIES : "represents"
    USERS ||--o| VENDORS : "represents"
    SOCIETIES ||--o{ EVENTS : "organises"
    SOCIETIES ||--o{ SERVICE_REQUESTS : "creates"
    EVENTS ||--o{ SERVICE_REQUESTS : "context for"
    CATEGORIES ||--o{ SERVICE_REQUESTS : "classifies"
    CATEGORIES ||--o{ VENDOR_CATEGORIES : "offered in"
    VENDORS ||--o{ VENDOR_CATEGORIES : "offers"
    SERVICE_REQUESTS ||--o{ REQUEST_VENDORS : "distributed to"
    VENDORS ||--o{ REQUEST_VENDORS : "receives"
    SERVICE_REQUESTS ||--o{ QUOTATIONS : "receives"
    VENDORS ||--o{ QUOTATIONS : "submits"
    SOCIETIES ||--o{ REVIEWS : "writes"
    VENDORS ||--o{ REVIEWS : "receives"
    SERVICE_REQUESTS ||--o| REVIEWS : "justifies"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ AUDIT_LOGS : "performs"
    SERVICE_REQUESTS ||--o{ APPROVAL_RECORDS : "may require"
```

### Tables

| Table               | Purpose                                 | Key columns                                                                                                                                                                                                                   |
| ------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`             | Authentication identity                 | `id`, `name`, `email` (unique), `password_hash`, `role`, `status`, `created_at`                                                                                                                                               |
| `societies`         | Society profile                         | `id`, `user_id`, `name`, `institution`, `contact_person`, `contact_email`, `contact_phone`, `description`                                                                                                                     |
| `vendors`           | Vendor business profile                 | `id`, `user_id`, `business_name`, `description`, `city`, `service_area`, `contact_person`, `contact_phone`, `verification_status`, `verified_by`, `verified_at`, `rejection_reason`                                           |
| `vendor_categories` | Vendor ↔ category (many-to-many)        | `vendor_id`, `category_id`                                                                                                                                                                                                    |
| `categories`        | Controlled service list                 | `id`, `name` (unique), `slug`, `description`, `is_active`, `sort_order`                                                                                                                                                       |
| `events`            | Event context                           | `id`, `society_id`, `name`, `event_date`, `location`, `expected_attendance`                                                                                                                                                   |
| `service_requests`  | The core request                        | `id`, `reference`, `society_id`, `event_id`, `category_id`, `title`, `budget_min`, `budget_max`, `quantity`, `description`, `status`, `response_deadline`, `selected_quotation_id`, `created_at`, `updated_at`                |
| `request_vendors`   | Distribution / eligibility record       | `request_id`, `vendor_id`, `distribution_status`, `viewed_at`, `notified_at`                                                                                                                                                  |
| `quotations`        | Vendor offer                            | `id`, `reference`, `request_id`, `vendor_id`, `total_price`, `currency`, `description`, `inclusions`, `exclusions`, `additional_charges`, `available_on_date`, `valid_until`, `notes`, `status`, `submitted_at`, `updated_at` |
| `reviews`           | Post-engagement feedback                | `id`, `society_id`, `vendor_id`, `request_id` (unique), `rating`, `comment`, `is_hidden`, `created_at`                                                                                                                        |
| `notifications`     | In-app messages                         | `id`, `user_id`, `type`, `title`, `body`, `link`, `read_at`, `created_at`                                                                                                                                                     |
| `approval_records`  | University approval evidence (optional) | `id`, `request_id`, `institution`, `status`, `reference`, `recorded_by`, `recorded_at`                                                                                                                                        |
| `audit_logs`        | Accountability trail                    | `id`, `actor_id`, `action`, `target_type`, `target_id`, `metadata` (jsonb), `created_at`                                                                                                                                      |
| `refresh_tokens`    | Revocable sessions                      | `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `user_agent`, `ip`                                                                                                                                                 |

### Enumerated values

```sql
user_role            ('society','vendor','admin')
account_status       ('active','suspended','deactivated')
vendor_status        ('pending_review','verified','changes_requested','rejected','suspended','deactivated')
request_status       ('draft','submitted','open','partially_quoted','quoted','selected','completed','closed','cancelled')
quotation_status     ('submitted','updated','withdrawn','preferred','selected','not_selected','expired')
distribution_status  ('invited','viewed','responded','declined')
notification_type    ('new_quotation','quotation_selected','quotation_rejected','vendor_status','request_closed','request_new')
```

### Integrity rules

- `quotations(request_id, vendor_id)` is **unique** — one vendor, one offer per request.
- `reviews(request_id)` is **unique** — one review per completed engagement (FR-076).
- `service_requests.selected_quotation_id` must reference a quotation belonging to the **same** request (enforce in service layer + trigger).
- `price` and `budget` are `numeric(12,2)` with `CHECK (>= 0)`.
- `rating` has `CHECK (rating BETWEEN 1 AND 5)`.
- Deleting a category or vendor is blocked while referenced; use soft deactivation (BR-009).
- All timestamps are `timestamptz`, stored in UTC.

### Indexes

```sql
CREATE INDEX idx_requests_society_status ON service_requests (society_id, status);
CREATE INDEX idx_requests_category_status ON service_requests (category_id, status);
CREATE INDEX idx_quotations_request ON quotations (request_id, status);
CREATE INDEX idx_quotations_vendor ON quotations (vendor_id, submitted_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read_at);
CREATE UNIQUE INDEX idx_vendors_active_category ON vendor_categories (category_id, vendor_id);
```

---

## 8. API Reference

Base URL: `/api/v1` · Auth: `Authorization: Bearer <accessToken>` · Errors: `{ "error": { "code", "message", "details?" } }`

Paginated endpoints return `{ "data": { "items": [...], "pagination": { "page", "pageSize", "total", "totalPages" } } }`. Every `/admin/*` route requires an admin token and writes administrative decisions to `audit_logs`.

> Rows marked **(planned)** are part of the target specification but are not shipped yet. The
> quotation and notification endpoints below reflect the current implementation.

### Auth

| Method | Endpoint                | Access        | Description                         |
| ------ | ----------------------- | ------------- | ----------------------------------- |
| POST   | `/auth/register`        | Public        | Register society or vendor          |
| POST   | `/auth/login`           | Public        | Issue access token + refresh cookie |
| POST   | `/auth/refresh`         | Cookie        | Rotate refresh token                |
| POST   | `/auth/logout`          | Authenticated | Revoke refresh token                |
| GET    | `/auth/me`              | Authenticated | Current user + profile summary      |
| POST   | `/auth/forgot-password` | Public        | Send reset link (planned)           |
| POST   | `/auth/reset-password`  | Public        | Consume single-use token (planned)  |

### Profiles

| Method | Endpoint                | Access  | Description                              |
| ------ | ----------------------- | ------- | ---------------------------------------- |
| GET    | `/societies/me`         | Society | Own society profile                      |
| PATCH  | `/societies/me`         | Society | Update own profile                       |
| GET    | `/vendors`              | Public  | Directory (active + verified, paginated) |
| GET    | `/vendors/:id`          | Public  | Public vendor profile                    |
| GET    | `/vendors/me`           | Vendor  | Own vendor profile                       |
| PATCH  | `/vendors/me`           | Vendor  | Update own business profile              |
| POST   | `/vendors/me/portfolio` | Vendor  | Upload portfolio image (planned, P1)     |

### Categories (admin-managed)

| Method | Endpoint                 | Access | Description            |
| ------ | ------------------------ | ------ | ---------------------- |
| GET    | `/categories`            | Public | Active categories      |
| GET    | `/admin/categories`      | Admin  | All categories + usage |
| POST   | `/categories`            | Admin  | Create category        |
| PATCH  | `/categories/:id`        | Admin  | Rename / reorder       |
| PATCH  | `/categories/:id/status` | Admin  | Activate / deactivate  |

### Requests

| Method | Endpoint                | Access                               | Description                              |
| ------ | ----------------------- | ------------------------------------ | ---------------------------------------- |
| POST   | `/requests`             | Society                              | Create request (draft or submit)         |
| GET    | `/requests`             | Society, admin                       | List requests, filter by status/category |
| GET    | `/requests/:id`         | Society owner, invited vendor, admin | Request detail (field-level privacy)     |
| PATCH  | `/requests/:id`         | Society owner                        | Edit while editable                      |
| POST   | `/requests/:id/submit`  | Society owner                        | Validate and distribute                  |
| POST   | `/requests/:id/cancel`  | Society owner, admin                 | Cancel with reason                       |
| POST   | `/requests/:id/close`   | Society owner, admin                 | Close an active or completed request     |
| GET    | `/requests/:id/vendors` | Society owner, admin                 | Distribution record                      |
| GET    | `/vendor/requests`      | Vendor                               | Eligible open requests                   |

### Quotations

Implemented:

| Method | Endpoint                        | Access                   | Description                            |
| ------ | ------------------------------- | ------------------------ | -------------------------------------- |
| POST   | `/requests/:id/quotations`      | Invited, verified vendor | Create or update own quotation         |
| GET    | `/requests/:id/quotations/mine` | Vendor                   | Own quotation for a request, or `null` |
| GET    | `/requests/:id/quotations`      | Society owner, admin     | Paginated quotations for review        |

Planned, not shipped yet: `GET /quotations`, `GET /quotations/:id`,
`PATCH /quotations/:id`, `POST /quotations/:id/withdraw`,
`POST /quotations/:id/prefer`, `POST /quotations/:id/select` and
`GET /requests/:id/compare`.

### Reviews (P1)

| Method | Endpoint               | Access                           | Description                 |
| ------ | ---------------------- | -------------------------------- | --------------------------- |
| POST   | `/requests/:id/review` | Society owner, completed request | Create review               |
| GET    | `/vendors/:id/reviews` | Public                           | Visible reviews + aggregate |
| PATCH  | `/reviews/:id/hide`    | Admin                            | Moderate review             |

### Admin

| Method | Endpoint                               | Access | Description                |
| ------ | -------------------------------------- | ------ | -------------------------- |
| GET    | `/admin/vendors?status=pending_review` | Admin  | Review queue               |
| POST   | `/admin/vendors/:id/approve`           | Admin  | Verify vendor              |
| POST   | `/admin/vendors/:id/reject`            | Admin  | Reject with reason         |
| POST   | `/admin/vendors/:id/request-changes`   | Admin  | Request corrections        |
| POST   | `/admin/vendors/:id/suspend`           | Admin  | Suspend vendor             |
| POST   | `/admin/vendors/:id/restore`           | Admin  | Restore a suspended vendor |
| GET    | `/admin/users`                         | Admin  | Paginated account list     |
| POST   | `/admin/users/:id/suspend`             | Admin  | Suspend account            |
| POST   | `/admin/users/:id/reactivate`          | Admin  | Reactivate account         |
| POST   | `/admin/users/:id/deactivate`          | Admin  | Deactivate account         |
| GET    | `/admin/audit-logs`                    | Admin  | Filterable audit trail     |
| GET    | `/admin/stats`                         | Admin  | Dashboard counts           |

### Notifications

| Method | Endpoint                  | Access        | Description                      |
| ------ | ------------------------- | ------------- | -------------------------------- |
| GET    | `/notifications`          | Authenticated | Own notifications + unread count |
| POST   | `/notifications/read-all` | Authenticated | Mark all notifications read      |
| POST   | `/notifications/:id/read` | Authenticated | Mark one notification read       |

### Error codes

| HTTP | Code                         | Meaning                                                     |
| ---- | ---------------------------- | ----------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`           | Zod validation failed (`details` lists fields)              |
| 401  | `UNAUTHENTICATED`            | Missing/expired token                                       |
| 403  | `FORBIDDEN` / `NOT_ELIGIBLE` | Role or eligibility violation                               |
| 404  | `NOT_FOUND`                  | Record missing **or** not visible to this user              |
| 409  | `CONFLICT` / `DUPLICATE`     | Duplicate email, duplicate quotation, closed request        |
| 422  | `RULE_VIOLATION`             | Business rule breach (e.g. own quotation on closed request) |
| 429  | `RATE_LIMITED`               | Throttled                                                   |
| 500  | `INTERNAL_ERROR`             | Safe message + request id in logs                           |

> Use `404` rather than `403` where revealing existence would leak data (e.g. another society's request).

---

## 9. Roles and Permissions

| Function                        | Society | Vendor |      Admin      |
| ------------------------------- | :-----: | :----: | :-------------: |
| Manage own profile              |   ✅    |   ✅   |  ✅ (support)   |
| Create service request          |   ✅    |   —    |        —        |
| View own society requests       |   ✅    |   —    | ✅ (oversight)  |
| View eligible vendor requests   |    —    |   ✅   |       ✅        |
| Submit quotation                |    —    |   ✅   |        —        |
| View quotations for own request |   ✅    |   —    |       ✅        |
| View competitor quotations      |    —    |   —    | ⚠️ support only |
| Select quotation (planned)      |    —    |   —    |        —        |
| Approve/reject vendor           |    —    |   —    |       ✅        |
| Manage categories               |    —    |   —    |       ✅        |
| Suspend account                 |    —    |   —    |       ✅        |
| View audit log                  |    —    |   —    |       ✅        |

University administration has **no account in the MVP**. Approval requirements are communicated in the UI and optionally recorded in `approval_records`.

**Enforcement rules**

1. Every protected route passes `authenticate` → `authorize(role)` → resource-level ownership check.
2. Ownership is resolved from the database, **never** from a client-supplied id alone.
3. Admin actions write an `audit_logs` row in the same transaction.
4. Vendor eligibility = active account **and** `verification_status = 'verified'` **and** an
   invitation in `request_vendors` **and** request `status IN ('open','partially_quoted')`
   **and** the response deadline has not passed.

---

## 10. Status Lifecycles

### Request

```
draft ──▶ submitted ──▶ open ──┬──▶ partially_quoted ──▶ quoted ──▶ selected ──▶ completed ──▶ closed
  │           │                 │            │                          │
  └───────────┴─────────────────┴────────────┴──────────────────────────┴──▶ cancelled
```

| Status             | Meaning                          | Allowed next                                        |
| ------------------ | -------------------------------- | --------------------------------------------------- |
| `draft`            | Saved, not distributed           | `submitted`, `cancelled`                            |
| `submitted`        | Validated, awaiting distribution | `open`, `cancelled`                                 |
| `open`             | Visible to eligible vendors      | `partially_quoted`, `quoted`, `closed`, `cancelled` |
| `partially_quoted` | ≥1 quotation, window still open  | `quoted`, `closed`, `cancelled`                     |
| `quoted`           | Quotations available for review  | `selected`, `closed`, `cancelled`                   |
| `selected`         | A quotation is chosen            | `completed`, `cancelled` (admin)                    |
| `completed`        | Engagement recorded complete     | `closed`                                            |
| `closed`           | No further action                | —                                                   |
| `cancelled`        | Withdrawn by authorised user     | —                                                   |

### Quotation

```
submitted ──┬──▶ preferred ──▶ selected
            ├──▶ updated ──▶ (returns to submitted)
            ├──▶ withdrawn
            ├──▶ not_selected
            └──▶ expired (valid_until passed)
```

### Vendor

```
pending_review ──┬──▶ verified ──▶ suspended ──▶ verified
                 ├──▶ changes_requested ──▶ pending_review
                 └──▶ rejected
verified ──▶ deactivated
```

**Transition guards**

- Only the owning society may select, and only from `quoted`/`partially_quoted`.
- Selecting a quotation marks other `submitted` quotations `not_selected`.
- Vendors cannot edit/withdraw after selection or request closure.
- `verified` is never shown unless an admin recorded the decision (BR-004).
- Selection never implies university approval (BR-008); the UI must say so.

> Selection, preference, withdrawal and expiry handling are still planned. The shipped flow
> stops at submission/editing, society review and notifications.

---

## 11. Requirement Coverage

| Module                  | Requirements      | Primary screens                             |
| ----------------------- | ----------------- | ------------------------------------------- |
| Auth                    | FR-001 – FR-012   | Register, Login, Forgot password            |
| Society profile         | FR-013 – FR-018   | Society profile                             |
| Vendor profile          | FR-019 – FR-027   | Business profile, Portfolio                 |
| Admin verification      | FR-028 – FR-034   | Review queue, User management, Categories   |
| Requests                | FR-035 – FR-045   | Create request, My requests, Request detail |
| Matching & distribution | FR-046 – FR-052   | Vendor request board, Distribution log      |
| Quotations              | FR-053 – FR-063   | Submit quotation, My quotations             |
| Comparison & selection  | FR-064 – FR-072   | Compare view, Select dialog                 |
| Reviews                 | FR-073 – FR-078   | Review form, Vendor reviews                 |
| Notifications           | FR-079 – FR-084   | Notification bell                           |
| Search & history        | FR-085 – FR-088   | Filters, Vendor directory                   |
| Dashboards              | FR-089 – FR-092   | Society / Vendor / Admin dashboards         |
| Errors & audit          | FR-093 – FR-096   | Global error handling, Audit log            |
| Non-functional          | NFR-001 – NFR-038 | Cross-cutting                               |
| Business rules          | BR-001 – BR-012   | Service layer + DB constraints              |

Acceptance tests to satisfy before calling the MVP complete: **AC-001 – AC-015** (see SRS §15).

---

## 12. Getting Started

### Prerequisites

- **Node.js 22+** and **npm 10+**
- A **Neon** account (free tier is sufficient)
- Git

### 1. Clone and install

```bash
git clone <your-repo-url> event-bridge
cd event-bridge
npm install
```

### 2. Create the Neon database

1. Sign in at <https://console.neon.tech> and create a project (e.g. `event-bridge`).
2. Open **Connection Details** and copy both strings:
   - **Pooled** connection → `DATABASE_URL`
   - **Direct** connection → `DIRECT_URL`
3. Append `?sslmode=require` if it is not already present.

> Neon project branching is useful here: create a `dev` branch so experiments never touch pilot data.

### 3. Configure environment

```bash
cp .env.example apps/api/.env
```

Fill in `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` and `JWT_REFRESH_SECRET`. Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 4. Run migrations and seed

```bash
npm run db:migrate
npm run db:seed
```

The seed creates:

| Account                     | Password      | Role                         |
| --------------------------- | ------------- | ---------------------------- |
| `admin@eventbridge.test`    | `Admin123!`   | admin                        |
| `society@eventbridge.test`  | `Society123!` | society                      |
| `society2@eventbridge.test` | `Society123!` | society (second institution) |
| `vendor@eventbridge.test`   | `Vendor123!`  | vendor (verified)            |
| `pending@eventbridge.test`  | `Vendor123!`  | vendor (pending_review)      |

It also inserts the four launch categories — Catering, Decoration, Sound/Lighting/AV, Photography — plus one sample request and two quotations.

### 5. Start development

```bash
npm run dev
```

| Service       | URL                            |
| ------------- | ------------------------------ |
| Web (Vite)    | <http://localhost:5173>        |
| API (Express) | <http://localhost:4000/api/v1> |
| Health check  | <http://localhost:4000/health> |

### 6. Database commands

```bash
npm run db:generate   # generate migration from schema changes
npm run db:migrate    # apply pending migrations (uses DIRECT_URL)
npm run db:studio     # inspect data (Drizzle Studio)
npm run db:reset      # drop + recreate + seed (dev only)
```

### 7. Frontend map

The web app is a single-page React application. Every dashboard is guarded by role, so sign in
with one of the seeded accounts above to see the matching view.

| Route       | Audience | What it does                                                                     |
| ----------- | -------- | -------------------------------------------------------------------------------- |
| `/`         | Public   | Landing page: value proposition, categories, how it works and featured vendors   |
| `/vendors`  | Public   | Verified vendor directory with keyword, city and category filters                |
| `/login`    | Public   | Sign in; the demo-account buttons fill in seeded credentials                     |
| `/register` | Public   | Create a society account or apply as a vendor (with a category picker)           |
| `/society`  | Society  | Request stats, request list, new-request form and expandable vendor applications |
| `/vendor`   | Vendor   | Verification status, public profile preview, matched requests and quotation form |
| `/admin`    | Admin    | Platform stats, vendor approval/rejection queue and category oversight           |

> Signed-in users also get a notification bell with unread counts and mark-as-read controls.
> Society request cards expand to show each vendor's quotation; vendor cards open an inline form
> to submit or revise a quotation.

---

## 13. Environment Variables

`apps/api/.env`

```ini
NODE_ENV=development
PORT=4000
APP_ORIGIN=http://localhost:5173

# Neon: pooled connection for runtime queries
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/eventbridge?sslmode=require
# Neon: direct connection for migrations
DIRECT_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/eventbridge?sslmode=require

JWT_SECRET=<48-byte-base64url>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<48-byte-base64url>
REFRESH_EXPIRES_IN=7d
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false

BCRYPT_OR_ARGON_MEMORY_KIB=19456
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

`apps/web/.env`

```ini
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

**Rules:** never commit `.env`; keep secrets out of the client bundle (`VITE_*` is public); rotate `JWT_SECRET` on any suspected leak.

---

## 14. Available Scripts

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Run web + API concurrently                       |
| `npm run dev:web`      | Vite dev server only                             |
| `npm run dev:api`      | Express with watch mode                          |
| `npm run build`        | Build shared package, compile API and bundle web |
| `npm run start`        | Run the compiled API (`apps/api/dist`)           |
| `npm run lint`         | ESLint across the repo                           |
| `npm run format`       | Prettier write                                   |
| `npm run format:check` | Prettier check (CI)                              |
| `npm run typecheck`    | `tsc --noEmit` for all packages                  |
| `npm test`             | Run API unit and integration tests               |
| `npm run test:e2e`     | Playwright suite (added in stage 9)              |
| `npm run db:generate`  | Generate a migration from schema changes         |
| `npm run db:migrate`   | Apply pending migrations using `DIRECT_URL`      |
| `npm run db:seed`      | Insert demo accounts, categories and sample data |
| `npm run db:reset`     | Drop schemas, re-migrate and re-seed (dev only)  |
| `npm run db:studio`    | Open Drizzle Studio                              |

A Husky pre-commit hook runs `lint-staged`, which applies ESLint fixes and Prettier to staged files.

---

## 15. Testing

| Level                | Tool                        | What it covers                                                                                  |
| -------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| Unit                 | Vitest                      | Password hashing, Zod schemas, status transition guards, matching rules                         |
| Database integration | Vitest + PGlite             | Applies the real migration to PostgreSQL-in-WASM and checks tables, enums, keys and constraints |
| API integration      | Vitest + Supertest + PGlite | Register, login, refresh rotation, logout, `/auth/me`, duplicate and suspended-account paths    |
| Component            | React Testing Library       | Forms, validation messages, status badges                                                       |
| End-to-end           | Playwright                  | Full society → vendor → select journey                                                          |
| Security             | Manual + automated          | Cross-account access, IDOR, injection, rate limits                                              |

**Mandatory security test cases (from SRS §15.3)**

- `TC-005` — negative quotation price is rejected server-side.
- `TC-006` — quotation on a closed request is rejected.
- `TC-007` — Society A cannot open Society B's request by changing the URL id.
- `TC-008` — Vendor A cannot view Vendor B's quotation.
- `TC-014` — a non-admin user cannot reach any `/admin/*` endpoint.

Run the suite:

```bash
npm test
npm run test:e2e
```

---

## 16. Security

| Area          | Control                                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| Passwords     | argon2id (or bcrypt cost ≥ 12); never stored or logged in plaintext                     |
| Sessions      | Short-lived access JWT + rotating refresh token stored hashed, httpOnly/SameSite cookie |
| Authorization | Server-side middleware on every protected route; ownership resolved from DB             |
| Input         | Zod schema validation on every endpoint; parameterised SQL only                         |
| Transport     | HTTPS enforced in production; secure cookies                                            |
| Headers       | `helmet`, strict CORS allow-list                                                        |
| Abuse         | Rate limits on auth, request creation and uploads; duplicate-click protection           |
| Uploads       | Type + size allow-list, generated filenames, stored outside the app path                |
| Privacy       | Field-level response shaping so contact details never leak to uninvited vendors         |
| Audit         | Admin approvals, suspensions, cancellations and selections written to `audit_logs`      |
| Logging       | Structured logs with request ids; passwords, tokens and PII redacted                    |

**Never** treat a hidden button as access control, and never trust an id from the browser as proof of ownership (NFR-010, §12.3).

---

## 17. Deployment

| Component        | Suggested host            | Notes                                                              |
| ---------------- | ------------------------- | ------------------------------------------------------------------ |
| Web (static SPA) | Vercel / Netlify          | Build `apps/web`, rewrite all routes to `index.html`               |
| API              | Render / Railway / Fly.io | Node 22, `npm run start`, health check `/health`                   |
| Database         | Neon                      | Use the pooled URL for the API; run migrations with the direct URL |

**Production checklist**

- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`, correct `APP_ORIGIN`
- [ ] Secrets set in the host's secret manager (not in the repo)
- [ ] Migrations applied before the new API version starts
- [ ] CORS restricted to the deployed web origin
- [ ] HTTPS and HSTS verified
- [ ] Backups / point-in-time restore confirmed
- [ ] Health check and error tracking (e.g. Sentry) wired
- [ ] Seed/demo accounts disabled or removed

---

## 18. Roadmap

| Phase | Focus                                      | Deliverable                  |
| ----- | ------------------------------------------ | ---------------------------- |
| 0     | Repository, tooling, CI, env, Neon project | Running skeleton             |
| 1     | Auth, RBAC, profiles, categories           | Register/login end to end    |
| 2     | Requests, matching, distribution           | Society can submit a request |
| 3     | Quotations, comparison, selection          | Core marketplace loop        |
| 4     | Admin verification, audit, notifications   | Trust and operations         |
| 5     | Dashboards, search, filters                | Usable pilot product         |
| 6     | Reviews, portfolio uploads, polish         | P1 features                  |
| 7     | Testing, security review, pilot            | Release candidate            |

**Milestone definition:** the MVP is complete when a society can register, create a valid request, receive a quotation from an eligible vendor, compare offers and record a selection — while an administrator can verify vendors and manage categories (SRS §14.3).

### Future enhancements (post-validation)

Online payments · vendor subscriptions · featured listings · AI-assisted matching · quotation insights · university approval portal · email/SMS notifications · native mobile apps · advanced analytics.

---

## 19. Definition of Done

A feature is done when:

1. It maps to a requirement id or an approved change.
2. Server-side authorization and validation are implemented and tested.
3. Happy path **and** at least one failure path are covered by tests.
4. Empty, loading and error states exist in the UI.
5. It works at mobile (375px), tablet and desktop widths.
6. Status changes are reflected consistently across dashboards.
7. No secrets, debug code or console noise is committed.
8. Documentation (README/API notes) is updated.

---

## 20. Team and Documentation

**Project:** Event Bridge — Mid Term Group Activity, _Managing the Entrepreneurial Venture_
**Institution:** Karachi, Pakistan · **Supervisor:** Sir Danial Shaikh

| Name         | Registration no. |
| ------------ | ---------------- |
| Fehmida Azam | 606725           |
| Asna Alam    | 594003           |
| Aliyan Ahmed | 606728           |

### Source documents

| Document                                 | Location                                                | Purpose                                           |
| ---------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Market Intelligence Report               | `Event_Bridge_MIR_final.docx.pdf`                       | Business validation, market evidence              |
| Software Requirements Specification v1.0 | `Event_Bridge_Software_Requirements_Specification.docx` | Functional/non-functional baseline                |
| API notes                                | `docs/api.md`                                           | Endpoint contracts (written as modules are built) |

### Traceability

Every implementation task should reference an `FR-`, `NFR-`, `BR-` or `AC-` identifier from the SRS. Changes to approved scope are recorded with reason, affected requirements, impact and approval decision (SRS §16.1).

---

## 21. Build Order

Build in this sequence. Steps are numbered **1 → 65**; complete each one before starting the next, unless marked _(parallel)_.

> **Rule of thumb:** database → API → UI for each feature. Never build a screen before the endpoint it calls exists, and never build an endpoint without its validation and authorization.

### Stage 0 — Foundation (do this once)

| #   | Build                                                          | Why it comes here                          |
| --- | -------------------------------------------------------------- | ------------------------------------------ |
| 1   | Repository, `git init`, `.gitignore`, `.editorconfig`          | Everything else lives here                 |
| 2   | Root `package.json` with npm workspaces + `concurrently`       | Enables `apps/*` and `packages/*`          |
| 3   | TypeScript configs (base, web, api, shared)                    | Both apps need types before code           |
| 4   | ESLint + Prettier + Husky pre-commit                           | Cheap now, expensive to add later          |
| 5   | `packages/shared`: enums (roles, all 6 statuses) + Zod schemas | Single source of truth for web **and** api |
| 6   | `apps/api/src/config/env.ts` — Zod-validated env loader        | Fail fast on bad config                    |
| 7   | Neon project + `dev` / `production` branches + test database   | You need a database to write step 9        |

### Stage 1 — Database

| #   | Build                                                                                                       | Why it comes here                                |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 8   | `db/pool.ts` (pooled URL) + `drizzle.config.ts` (direct URL)                                                | Connection before schema                         |
| 9   | Schema part 1: `users`, `societies`, `vendors`, `categories`, `vendor_categories`                           | Identity and profiles come first                 |
| 10  | Migration `0001` + apply to Neon                                                                            | Verify the foundation is real                    |
| 11  | Schema part 2: `events`, `service_requests`, `request_vendors`                                              | Request lifecycle depends on users/societies     |
| 12  | Schema part 3: `quotations`, `reviews`, `notifications`, `approval_records`, `audit_logs`, `refresh_tokens` | Quotations need requests; audit needs everything |
| 13  | Migration `0002` + unique indexes + `CHECK` constraints                                                     | Enforce rules in the database, not just in code  |
| 14  | `db/seed.ts` — categories, admin, 2 societies, 3 vendors, 1 request, 2 quotations                           | Realistic data for every later step              |

### Stage 2 — API core and authentication

| #   | Build                                                               | Why it comes here                        |
| --- | ------------------------------------------------------------------- | ---------------------------------------- |
| 15  | Express app: `server.ts`, `app.ts`, `routes.ts`, middleware order   | The skeleton everything mounts onto      |
| 16  | `AppError`, global error middleware, `asyncHandler`, 404 handler    | Consistent errors from step 1 of the API |
| 17  | Pino logger + request ids + `GET /health`                           | Debuggability before features            |
| 18  | Transaction helper + pagination helper                              | Used by nearly every module              |
| 19  | `POST /auth/register` (society + vendor) with Zod validation        | First real endpoint                      |
| 20  | Password hashing (argon2id) + `POST /auth/login` issuing access JWT | Core credential flow                     |
| 21  | Refresh-token rotation, `POST /auth/logout`, `GET /auth/me`         | Sessions must be revocable               |
| 22  | `authenticate` + `authorize(role)` middleware + rate limiters       | Every later route depends on these       |

### Stage 3 — Profiles and administration

| #   | Build                                                                           | Why it comes here                                       |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 23  | Categories: public list + admin CRUD/activate                                   | Requests cannot be created without categories           |
| 24  | Society profile `GET/PATCH /societies/me`                                       | Required before creating a request                      |
| 25  | Vendor profile `GET/PATCH /vendors/me` + public directory                       | Vendor side of the marketplace                          |
| 26  | Admin vendor review: approve / reject / request changes / suspend + audit write | Verification must exist before quotations mean anything |
| 27  | Account suspension/deactivation + `GET /admin/users`                            | Completes the admin baseline                            |

### Stage 4 — Requests and matching

| #   | Build                                                                             | Why it comes here                     |
| --- | --------------------------------------------------------------------------------- | ------------------------------------- |
| 28  | Event + `POST /requests` (saved as `draft`)                                       | Core domain object                    |
| 29  | Request validation, reference generation, `POST /requests/:id/submit`             | Transitions draft → submitted         |
| 30  | Matching service: category + eligibility + service area                           | Decides which vendors see the request |
| 31  | Distribution: write `request_vendors`, create notifications, status → `open`      | Connects society to vendors           |
| 32  | `GET /requests`, `GET /requests/:id`, `PATCH`, cancel/close + field-level privacy | Society can manage its own requests   |
| 33  | `GET /vendor/requests` (eligible board, filters, pagination)                      | Vendor side becomes usable            |

### Stage 5 — Quotations and selection

| #   | Build                                                                                 | Why it comes here                        |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| 34  | `POST /requests/:id/quotations` with eligibility + uniqueness checks                  | First half of the core value proposition |
| 35  | `GET /quotations`, `GET /quotations/:id`, edit, withdraw                              | Vendor manages its offers                |
| 36  | Quotation status transitions + expiry handling, request → `partially_quoted`/`quoted` | Keeps both lifecycles consistent         |
| 37  | `GET /requests/:id/compare` — normalised side-by-side payload                         | The differentiator feature               |
| 38  | Prefer + select in a transaction (supersede other offers with `not_selected`)         | Most consequential write in the system   |
| 39  | Notification + audit on every quotation event                                         | Trust and accountability                 |

**Shipped from Stage 5:** quotation creation/update, own-quotation lookup, society quotation
listing, `open → partially_quoted`, and notification + audit rows on submit/update. Tasks 35
(quotation detail/withdraw), 37 (compare payload) and 38 (prefer/select) are still planned.

**Milestone 1 — the backend MVP is complete here.** Every FR-001–FR-096 path now exists via the API.

### Stage 6 — Frontend foundation

| #   | Build                                                                                    | Why it comes here                         |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| 40  | Vite app + Tailwind + router + QueryClient provider                                      | Shell before screens                      |
| 41  | API client: base URL, token handling, refresh-on-401, error normalisation                | Every screen depends on it                |
| 42  | Auth context + protected routes + role guards                                            | Stops building screens users can't reach  |
| 43  | Layouts: public, society, vendor, admin + navigation                                     | Visual consistency                        |
| 44  | Shared UI: Button, Input, Select, Textarea, Table, Modal, Toast, EmptyState, StatusBadge | Prevents a different button on every page |
| 45  | Auth screens: register (role choice), login, forgot/reset password                       | First end-to-end user journey             |
| 46  | Three dashboard shells wired to real counts                                              | Landing point after login                 |

### Stage 7 — Frontend feature flows

| #   | Build                                                     | Why it comes here                     |
| --- | --------------------------------------------------------- | ------------------------------------- |
| 47  | Society profile page                                      | Needed before requesting              |
| 48  | Vendor business profile + portfolio upload                | Vendor onboarding completion          |
| 49  | Admin screens: review queue, user list, category manager  | Makes verification usable without SQL |
| 50  | Create-request wizard (event → service → budget → review) | Primary society task                  |
| 51  | My requests list + request detail with status timeline    | Tracks stage 29–32 work               |
| 52  | Vendor request board + quotation form                     | Primary vendor task                   |
| 53  | Comparison table + select dialog with confirmation        | Primary decision screen               |
| 54  | Notification drawer + unread badge                        | Closes the loop                       |

**Milestone 2 — a full society → vendor → select run is possible in the browser.**

### Stage 8 — P1 features

| #   | Build                                                                    | Why it comes here                       |
| --- | ------------------------------------------------------------------------ | --------------------------------------- |
| 55  | Reviews: form on completed request, vendor review list, aggregate rating | Needs completed engagements to exist    |
| 56  | Search, filters and pagination polish across lists                       | Meaningful only with real volumes       |
| 57  | Audit log UI + admin analytics                                           | Depends on audit writes from stages 3–5 |
| 58  | Multiple society representatives (if approved)                           | Optional scope                          |

### Stage 9 — Quality and launch

| #   | Build                                                                                                 | Why it comes here                     |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 59  | Unit tests: validators, status transitions, matching rules                                            | Fastest feedback, protects the rules  |
| 60  | API integration tests: auth, RBAC, IDOR (`TC-007`, `TC-008`), closed-request and negative-price cases | Verifies the security the SRS demands |
| 61  | Component tests for forms and validation messages                                                     | Guards the UX contract                |
| 62  | Playwright E2E: register → request → quote → compare → select                                         | Proves AC-001–AC-015                  |
| 63  | Security pass: headers, CORS, rate limits, upload validation, dependency audit                        | Before exposing to real users         |
| 64  | Deploy: Neon production branch → migrate → API host → web host → smoke test                           | Only after tests pass                 |
| 65  | Pilot onboarding + metrics capture (request completion, response rate, time to first quote)           | The point of the MVP                  |

### Parallelisation notes

- Steps **40–44** (frontend foundation) can start as soon as the API contract in Section 8 is agreed, using mock data.
- Steps **23–27** (profiles/admin) and **45–49** (their screens) can be split between two developers after step 22.
- Do **not** parallelise schema changes (steps 9–13) — migrations must stay linear.
- Write the test for a rule at the same time as the rule, not only in stage 9.

---

**License:** Academic project — not licensed for commercial use without the team's permission.

**Status:** stages 0–4 implemented, plus the quotation submission/review and notification slice of Stage 5. Verified with typecheck, lint, build and 36/36 tests. Selection, preference and comparison remain planned — see the [build order](#21-build-order).
