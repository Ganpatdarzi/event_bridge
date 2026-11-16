# Event Bridge API notes

Base URL: `http://localhost:4000` in development. All JSON endpoints live under `/api/v1`.

> These notes are written incrementally. Stages 2–4 (authentication, profiles, categories,
> administration, requests, matching and distribution) are implemented; later stages add
> quotations, reviews, notifications and dashboards.

## Response envelope

Successful responses:

```json
{ "data": {} }
```

Errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "path": "email", "message": "Enter a valid email address" }]
  }
}
```

Every response carries an `x-request-id` header. Include it when reporting a bug.

### Pagination

List endpoints that paginate return an envelope with the page and the total count:

```json
{
  "data": {
    "items": [],
    "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
  }
}
```

`page` starts at 1; `pageSize` defaults to 20 and is capped at 100. The paginated endpoints are
`GET /vendors`, `GET /requests`, `GET /vendor/requests`, `GET /admin/vendors`, `GET /admin/users`
and `GET /admin/audit-logs`.

## Authentication model

| Item             | Detail                                                                            |
| ---------------- | --------------------------------------------------------------------------------- |
| Access token     | JWT, 15 minutes, sent as `Authorization: Bearer <token>`                          |
| Refresh token    | Opaque 48-byte token in an httpOnly cookie (`eb_rt`), path `/api/v1/auth`, 7 days |
| Rotation         | `POST /auth/refresh` revokes the presented token and issues a new one             |
| Storage          | Only a SHA-256 hash of the refresh token is stored in `refresh_tokens`            |
| Password hashing | Argon2id, 19 MiB, t=2, p=1                                                        |

Sign-in flow:

1. `POST /auth/login` → JSON `data.accessToken` + refresh cookie.
2. Call protected endpoints with the bearer token.
3. When the access token expires, `POST /auth/refresh` (cookie is sent automatically) → new access token + rotated cookie.
4. `POST /auth/logout` revokes the refresh token and clears the cookie.

## Endpoints

### `POST /auth/register`

Creates a society or vendor account. Admin accounts are seeded, never self-registered.
The account is usable immediately; vendors are created with `verification_status = pending_review`.

Society payload:

```json
{
  "role": "society",
  "name": "Ayesha Khan",
  "email": "ayesha@example.com",
  "password": "Example123",
  "society": {
    "societyName": "IBA Entrepreneurship Society",
    "institution": "IBA Karachi",
    "contactPerson": "Ayesha Khan",
    "contactEmail": "society@example.com",
    "contactPhone": "+92 300 0000000",
    "description": "Optional"
  }
}
```

Vendor payload:

```json
{
  "role": "vendor",
  "name": "Adil Khan",
  "email": "adil@example.com",
  "password": "Example123",
  "vendor": {
    "businessName": "Moments by Adil",
    "description": "At least twenty characters describing the business.",
    "city": "Karachi",
    "serviceArea": "Karachi",
    "contactPerson": "Adil Khan",
    "contactPhone": "+92 300 0000000",
    "categoryIds": ["<uuid>"]
  }
}
```

Responses: `201 { data: { user } }`, `409 DUPLICATE` if the email exists. Vendor accounts are
created as `pending_review`; `contactPerson` defaults to the account name when omitted.

### `POST /auth/login`

```json
{ "email": "society@eventbridge.test", "password": "Society123!" }
```

Response:

```json
{
  "data": {
    "user": {
      "id": "...",
      "name": "...",
      "email": "...",
      "role": "society",
      "status": "active",
      "createdAt": "..."
    },
    "profile": { "type": "society", "id": "...", "name": "...", "institution": "..." },
    "accessToken": "..."
  }
}
```

Sets the refresh cookie. Unknown email and wrong password return the same `401 UNAUTHENTICATED` message.

### `POST /auth/refresh`

No body; relies on the `eb_rt` cookie. Rotates the refresh token and returns the same shape as login.
Returns `401` when the session is missing, revoked or expired.

### `POST /auth/logout`

Revokes the presented refresh token, clears the cookie, returns `204`.

### `GET /auth/me`

Requires a bearer token. Returns `{ data: { user, profile } }`.

## Profiles

### `GET /societies/me` · `PATCH /societies/me`

Society accounts only. `GET` returns the society profile plus its account identity:

```json
{
  "data": {
    "id": "...",
    "name": "IBA Entrepreneurship Society",
    "institution": "IBA Karachi",
    "contactPerson": "Ayesha Khan",
    "contactEmail": "society@example.com",
    "contactPhone": "+92 300 0000000",
    "description": "...",
    "createdAt": "...",
    "updatedAt": "...",
    "account": { "id": "...", "name": "Ayesha Khan", "email": "society@example.com" }
  }
}
```

`PATCH` accepts any of `societyName`, `institution`, `contactPerson`, `contactEmail`,
`contactPhone`, `description`. At least one field is required. Only the signed-in society's own
profile can be edited; there is no id in the URL.

### `GET /vendors`

Public directory of vendors that are `verified` and whose account is active.

| Query      | Type   | Notes                                                           |
| ---------- | ------ | --------------------------------------------------------------- |
| `page`     | number | Default 1                                                       |
| `pageSize` | number | Default 20, max 100                                             |
| `search`   | string | Matches business name, description or city                      |
| `city`     | string | Partial, case-insensitive match                                 |
| `category` | string | Category **slug** (e.g. `sound-lighting-av`), active categories |

Each item contains `id`, `businessName`, `description`, `city`, `serviceArea`, `verifiedAt`,
`categories` (`id`, `name`, `slug`) and `rating` (`average`, `count`). Contact details are only
returned by the detail endpoint.

### `GET /vendors/:id`

Public profile of a verified vendor with an active account. Adds `contactPerson`, `contactPhone`,
`contactEmail`, categories and rating. Returns `404` for pending, suspended or deactivated vendors
so the directory does not leak their existence.

### `GET /vendors/me` · `PATCH /vendors/me`

Vendor accounts only. The response adds the verification state:

```json
{
  "data": {
    "id": "...",
    "businessName": "Moments by Adil",
    "description": "...",
    "city": "Karachi",
    "serviceArea": "Karachi",
    "contactPerson": "Adil Khan",
    "contactPhone": "+92 300 0000000",
    "verificationStatus": "verified",
    "rejectionReason": null,
    "verifiedAt": "...",
    "createdAt": "...",
    "updatedAt": "...",
    "categories": [{ "id": "...", "name": "Catering", "slug": "catering" }],
    "rating": { "average": 4.5, "count": 2 },
    "account": { "id": "...", "name": "Adil Khan", "email": "vendor@example.com" }
  }
}
```

`PATCH` accepts any of `businessName`, `description`, `city`, `serviceArea`, `contactPerson`,
`contactPhone`, `categoryIds`. At least one field is required.

- `categoryIds` replaces the vendor's category set; ids must exist and be active (max 10).
- Editing a profile in `changes_requested` or `rejected` resubmits it: the status becomes
  `pending_review` and `rejectionReason` is cleared. The admin review queue then picks it up again.
- A `deactivated` vendor profile cannot be edited (`422`). Suspended vendors can edit their
  profile but still cannot quote.

## Categories

### `GET /categories`

Public. Returns active categories ordered by `sortOrder`, then name:

```json
{
  "data": [
    {
      "id": "...",
      "name": "Catering",
      "slug": "catering",
      "description": "Food and beverage for events of any size.",
      "isActive": true,
      "sortOrder": 0,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### Admin category management

All routes below require an admin access token.

| Method  | Endpoint                 | Body                                                             |
| ------- | ------------------------ | ---------------------------------------------------------------- |
| `GET`   | `/admin/categories`      | — (includes inactive categories + `requestCount`, `vendorCount`) |
| `POST`  | `/categories`            | `name`, optional `slug`, `description`, `sortOrder`, `isActive`  |
| `PATCH` | `/categories/:id`        | Any of `name`, `slug`, `description`, `sortOrder`                |
| `PATCH` | `/categories/:id/status` | `{ "isActive": true }`                                           |

- The slug is derived from the name when omitted; supply one for names without Latin characters.
- `name` and `slug` are unique; duplicates return `409 DUPLICATE`.
- Renaming a category does **not** change its slug automatically — send both when a URL change is
  intended.
- Deactivation is a soft delete: existing requests and vendor assignments keep the reference,
  but the category disappears from the public list and cannot be newly selected.

## Requests

All request routes require an access token. A society owns its requests; a vendor can only see a
request after distribution has assigned it to that vendor.

### `POST /requests`

Society only. Creates a draft by default. Send `"submit": true` to create and distribute in the
same transaction; if validation fails, no draft is left behind.

```json
{
  "event": {
    "name": "Startup Pitch Night 2026",
    "eventDate": "2026-12-10",
    "location": "IBA Main Campus, Karachi",
    "expectedAttendance": 180
  },
  "categoryId": "<uuid>",
  "title": "Catering for 180 guests at Startup Pitch Night",
  "description": "Buffet-style dinner for 180 guests, including vegetarian options.",
  "budgetMin": 120000,
  "budgetMax": 180000,
  "quantity": 180,
  "responseDeadline": "2026-12-01T18:00:00Z",
  "submit": false
}
```

- Send either a nested `event` or an existing `eventId` owned by the same society. The nested form
  creates the event; `eventId` reuses one for another category on the same event.
- `title` is 5–180 characters, `description` is 20–5000 characters. `budgetMin`/`budgetMax` are
  optional, must be non-negative and minimum cannot exceed maximum.
- Drafts may be incomplete in time: a past event date or deadline is only rejected on submit.
- The response is `201` with the full request detail. A human-readable reference such as
  `EB-R-9F3A12CD` is generated automatically.

### `POST /requests/:id/submit`

Society owner, draft only. Validates that:

- the category still exists and is active;
- an event is attached, its date is today or later and a response deadline is set;
- the deadline is in the future and not after the event date;
- the budget range is consistent.

Matching then selects vendors where the account is active, the vendor is `verified`, the vendor
offers the request category and its service area covers the event location. A blank service area
means "serves everywhere"; otherwise the event location must name the vendor's city or one of the
comma/semicolon-separated service-area terms (`nationwide`, `pakistan`, `remote`, etc. are
wildcards). The transaction inserts `request_vendors`, creates one `request_new` notification per
vendor, and moves the request `draft → submitted → open`. A request with no matches still opens
with zero invitations.

The response is the request detail; `counts.invitedVendors` shows the distribution size.

### `GET /requests`

Society owners see their own requests; admins see all requests. Paginated.

| Query        | Meaning                                                          |
| ------------ | ---------------------------------------------------------------- |
| `status`     | Any request status                                               |
| `categoryId` | Filter by category                                               |
| `search`     | Title or reference, case-insensitive                             |
| `societyId`  | Admin only — restrict to one society                             |
| `sort`       | `newest` (default), `oldest` or `deadline` (null deadlines last) |
| `page`       | Page number, default 1                                           |
| `pageSize`   | Page size, default 20, maximum 100                               |

Items contain the category, event summary, society summary, budget, deadline, invitation count,
quotation count and timestamps.

### `GET /requests/:id`

Visible to the owning society, an invited vendor and admins. Any other caller receives `404`, not
`403`, so request existence is not leaked. The response includes `permissions` flags for the
current caller.

Field-level privacy:

- Owner and admin see the society contact details, `selectedQuotationId` and any cancellation
  fields.
- A vendor sees the society name and institution but **not** contact details until its own
  quotation has been selected (`selected`, `completed` or `closed`).
- Reading the detail as an invited vendor sets `distribution.viewedAt` and moves
  `distribution.status` from `invited` to `viewed`, without overwriting `responded` or `declined`.
- `counts` includes invited vendor and non-withdrawn quotation totals.

### `PATCH /requests/:id`

Society owner only, while the request is `draft`, `submitted`, `open` or `partially_quoted`.
Accepts any of `event`, `eventId`, `categoryId`, `title`, `description`, `budgetMin`, `budgetMax`,
`quantity` and `responseDeadline`. At least one field is required.

- Once distributed (`open`/`partially_quoted`), the category, event date and event location are
  locked because changing them would invalidate the distribution (`422 RULE_VIOLATION`).
- A distributed request must keep a future response deadline that is not after the event date.
- `422` is also used when the budget range would become invalid; `409 CONFLICT` when the request
  has reached a non-editable state.

### `POST /requests/:id/cancel`

Society owner or admin. Requires `{ "reason": "..." }` (5–500 characters). Owners can cancel
`draft`, `submitted`, `open`, `partially_quoted` and `quoted`; admins can additionally cancel
`selected`. `completed`, `closed` and `cancelled` requests cannot be cancelled (`409 CONFLICT`).

Cancellation stores `cancelledBy`, `cancelledAt` and `cancellationReason`, notifies every invited
vendor with `request_closed`, and writes `request.cancelled` to the audit log.

### `POST /requests/:id/close`

Society owner or admin. Optional `{ "reason": "..." }` (maximum 500 characters) is kept in the
audit log. Allowed from `open`, `partially_quoted`, `quoted` and `completed`; the request becomes
`closed`, invited vendors receive `request_closed`, and `request.closed` is audited.

### `GET /requests/:id/vendors`

Society owner or admin. Returns the distribution record, not vendor contact details:

```json
{
  "data": {
    "requestId": "...",
    "items": [
      {
        "vendorId": "...",
        "businessName": "Moments by Adil Khan",
        "city": "Karachi",
        "verificationStatus": "verified",
        "distributionStatus": "viewed",
        "viewedAt": "...",
        "notifiedAt": "..."
      }
    ]
  }
}
```

### `GET /vendor/requests`

Vendor only. A non-verified vendor receives `403 NOT_ELIGIBLE`. Paginated board of requests
distributed to the caller in `open` or `partially_quoted`.

Filters: `categoryId`, `search` (title/reference), `sort` (`deadline` default, `newest`, `oldest`)
plus `page`/`pageSize`. Each item includes the event, society name/institution, budget, deadline,
the caller's distribution state and `hasQuoted`.

## Administration

Every `/admin/*` route is restricted to `admin` accounts; society and vendor tokens receive `403`.

### `GET /admin/vendors`

Paginated review queue. Filters: `status` (any vendor status), `search` (business name,
description, account name or email), plus `page` / `pageSize`. Pending reviews are ordered first.

Each item includes the business profile, `verificationStatus`, `rejectionReason`, `verifiedBy`,
`verifiedAt`, `categories`, and:

```json
{
  "user": { "id": "...", "name": "...", "email": "...", "status": "active" }
}
```

### Vendor decisions

| Method | Endpoint                             | Body                           | Transition                             |
| ------ | ------------------------------------ | ------------------------------ | -------------------------------------- |
| `POST` | `/admin/vendors/:id/approve`         | —                              | `pending_review` → `verified`          |
| `POST` | `/admin/vendors/:id/reject`          | `{ "reason": "..." }` required | `pending_review` → `rejected`          |
| `POST` | `/admin/vendors/:id/request-changes` | `{ "reason": "..." }` required | `pending_review` → `changes_requested` |
| `POST` | `/admin/vendors/:id/suspend`         | optional `{ "reason": "..." }` | `verified` → `suspended`               |
| `POST` | `/admin/vendors/:id/restore`         | —                              | `suspended` → `verified`               |

- Approval and restoration require an active vendor account and at least one service category
  (`422 RULE_VIOLATION` otherwise).
- Rejections and change requests require a reason of 5–1000 characters; it is stored in
  `rejectionReason` and shown to the vendor. A suspension reason is also copied there for display.
- Any other transition returns `422 RULE_VIOLATION` with `{ from, to }` details.
- Every decision writes an `audit_logs` row in the same transaction (`vendor.approved`,
  `vendor.rejected`, `vendor.changes_requested`, `vendor.suspended`, `vendor.restored`).

### `GET /admin/users`

Paginated account list with filters `role`, `status`, `search` (name, email, society or business
name), `page` and `pageSize`. Each item includes a `society` summary or a `vendor` summary with its
verification status.

### Account actions

| Method | Endpoint                      | Body                           | Effect                                               |
| ------ | ----------------------------- | ------------------------------ | ---------------------------------------------------- |
| `POST` | `/admin/users/:id/suspend`    | optional `{ "reason": "..." }` | `active` → `suspended`; revokes all refresh tokens   |
| `POST` | `/admin/users/:id/reactivate` | —                              | `suspended`/`deactivated` → `active`                 |
| `POST` | `/admin/users/:id/deactivate` | optional `{ "reason": "..." }` | `active`/`suspended` → `deactivated`; revokes tokens |

- Administrators cannot change their own status or manage another admin account (`403`).
- Suspending a verified vendor also moves the vendor to `suspended`; deactivating a verified or
  suspended vendor moves it to `deactivated`. Reactivating the account does **not** re-verify the
  vendor — use `/admin/vendors/:id/restore`.
- Actions are audited as `user.suspended`, `user.reactivated`, `user.deactivated`.

### `GET /admin/audit-logs`

Paginated, newest first. Filters: `actorId`, `action` (exact, e.g. `vendor.approved`),
`targetType` (e.g. `vendor`, `user`, `category`), `targetId`, `from`, `to` (ISO timestamps).

```json
{
  "data": {
    "items": [
      {
        "id": "...",
        "action": "vendor.approved",
        "targetType": "vendor",
        "targetId": "...",
        "metadata": { "from": "pending_review", "to": "verified", "reason": null },
        "createdAt": "...",
        "actor": { "id": "...", "name": "Platform Admin", "email": "admin@example.com" }
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
  }
}
```

### `GET /admin/stats`

Dashboard counts: users by role and status, vendors by verification status, requests by status,
category totals (including active) and total quotations.

### `GET /health`

Liveness probe, no database access:

```json
{ "data": { "status": "ok", "uptimeSeconds": 42, "timestamp": "2026-11-16T10:00:00.000Z" } }
```

### `GET /health/db`

Runs `SELECT 1` against Neon. Returns `200` when reachable, `500 INTERNAL_ERROR` otherwise.

## Error codes

| Code                | Status | Meaning                                                   |
| ------------------- | ------ | --------------------------------------------------------- |
| `VALIDATION_ERROR`  | 400    | Zod rejected the body/params; `details` lists field paths |
| `BAD_REQUEST`       | 400    | Malformed JSON or invalid reference                       |
| `INVALID_REFERENCE` | 400    | Foreign key points at a missing row                       |
| `UNAUTHENTICATED`   | 401    | Missing, invalid or expired access/refresh token          |
| `FORBIDDEN`         | 403    | Authenticated but wrong role                              |
| `NOT_ELIGIBLE`      | 403    | Role is correct but a business rule blocks the action     |
| `NOT_FOUND`         | 404    | Unknown route or resource                                 |
| `DUPLICATE`         | 409    | Unique constraint (e.g. email already registered)         |
| `CONFLICT`          | 409    | State changed so the requested action is no longer valid  |
| `RULE_VIOLATION`    | 422    | State-machine or business-rule violation                  |
| `RATE_LIMITED`      | 429    | Too many requests                                         |
| `INTERNAL_ERROR`    | 500    | Unexpected failure; the request id is logged              |

## Rate limits

| Scope                                            | Window     | Limit               |
| ------------------------------------------------ | ---------- | ------------------- |
| All `/api/v1` routes                             | 15 minutes | 300 requests per IP |
| `/auth/register`, `/auth/login`, `/auth/refresh` | 15 minutes | 20 requests per IP  |

Limits are skipped when `NODE_ENV=test`.

## Smoke test with curl

```bash
curl -i http://localhost:4000/health

curl -i -c cookies.txt -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"society@eventbridge.test","password":"Society123!"}'

curl -i -b cookies.txt -X POST http://localhost:4000/api/v1/auth/refresh

curl -i -b cookies.txt -X POST http://localhost:4000/api/v1/auth/logout
```

On Windows PowerShell, use `Invoke-RestMethod` with a `WebRequestSession` for cookie persistence.
