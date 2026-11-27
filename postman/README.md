# WeHire Postman collection

Import `postman/WeHire_collection.json` using **Postman → Import → Files**.

## Before testing

1. Start PostgreSQL. From `backend/`, run `uv sync --locked` and
   `uv run --locked alembic upgrade head` against your designated development DB.
   Never reset an existing database. If it already has the earlier UUID schema,
   see the root README migration note before proceeding.
2. Complete the one-time administrator setup at `/setup` and manage accounts,
   vacancy records, staff assignments and applications through `/admin`. See the
   root README for the private setup-key configuration. There are no default
   accounts or public staff registration APIs. Candidates can self-register at
   `/sign-up` or use `POST /auth/register`.
3. Run `uv run --locked uvicorn app.main:app --reload --port 8012 --no-proxy-headers`.
4. For local HTTP, root `.env` needs `AUTH_COOKIE_SECURE=false` and
   `CORS_ORIGINS=["http://localhost:3012"]`. The frontend need not be running.

## Variables

The collection contains blank credential/ID placeholders. Use private Postman
environment values (mark passwords sensitive) to override them. Do not commit or
share an export containing real credentials or populated session cookies.

| Variable | Value to supply |
| --- | --- |
| `base_url` | Defaults to `http://localhost:8012`; no trailing slash. |
| `origin` | Defaults to `http://localhost:3012`; match CORS_ORIGINS exactly. |
| `staff_email`, `staff_password` | Existing HR/hiring-manager account and its original password, not the stored hash. |
| `candidate_email`, `candidate_password` | Separate existing candidate account and original password. |
| `staff_application_id` | Existing application under a vacancy assigned to that staff member. |
| `staff_unassigned_application_id` | Existing application under a vacancy not assigned to that staff member. |
| `candidate_application_id` | Application owned by the candidate account. |
| `other_candidate_application_id` | Existing application owned by another candidate, ideally in the same vacancy. |

IDs must be positive integers. Missing credentials or IDs cause the corresponding
request to be skipped with a setup message; populate them before running a full
folder. A 404 for a nonexistent record alone does not prove ownership isolation.

## Run order and session handling

Run `Public`, then `Staff`, then
`Candidate`. Each role flow starts with login and ends with logout and
an expected 401. You can also send requests manually in the same order.

Postman's cookie jar must stay enabled for role flows. Login receives an HttpOnly
`wehire_session` cookie; no bearer token or manual Cookie header is needed. Use
`localhost` consistently instead of mixing it with `127.0.0.1`. Login and logout
send an explicit Origin header. Logout's asynchronous pre-request script obtains
the current CSRF token and inserts X-CSRF-Token without persisting it in variables.
The standalone CSRF request is available for inspection.

Tests assert expected status codes and selected response fields. Intentional
401/403/404 responses pass their corresponding tests. A 429 means the real login
throttle has been reached: wait for Retry-After instead of resetting counters or
looping login attempts. Defaults allow five attempts per account per five minutes.

The collection covers health, login/logout, current identity, CSRF, staff vacancy
access, staff application access and all three candidate access capabilities.
Candidate requests currently acknowledge permission only; file uploads, screening,
DISC interpretation and clarification submission are future APIs. Cookie handling
in Postman does not establish browser SameSite/CORS behaviour.


## Setup and administration

`Setup` and `Admin` folders cover the new management APIs. Configure private
`admin_email`/`admin_password` and log in using **Admin Login**. Read-only lists
and summary can then be sent normally. Only explicitly authorised administrators
can use these endpoints; HR/hiring-manager roles alone do not grant this access.

Writes are intentionally skipped unless `allow_admin_changes=true`. Send them
one at a time after reviewing target variables (`admin_user_id`,
`admin_vacancy_id`, `admin_assignment_id`, `admin_application_id`, `admin_role`).
For JSON writes, set `admin_request_body` privately to the desired JSON object;
each request's displayed Body documents the shape. The pre-request script
serialises this object safely. Logout and admin writes obtain CSRF automatically.

**First Admin** uses private `setup_token`, `admin_email`, `admin_password` values
and is only for initial setup. Do not run it after browser setup has completed.
Never share a populated export. Use a development/test database for mutation
checks; DELETE archives rows and last-administrator protection still applies.
Reset `allow_admin_changes=false` when done. Do not blindly run the entire Admin
folder: later actions may revoke access or archive the target of earlier actions.


## Candidate registration

The `Registration` folder tests candidate-only signup. Set private
`registration_email` and `registration_password` values, then set
`allow_registration=true` to enable these requests. They are skipped by default
because a successful signup creates a real candidate account. The backend expects
the original password, not its stored hash. Review the target environment first.

`Register` and `Repeat` both expect the same generic `202` acknowledgement. The
other requests check invalid passwords, forbidden role/admin fields and the
absence of a public staff signup endpoint. No ID or session cookie is returned;
sign in separately using the candidate flow. Before running candidate application
permission requests, an administrator must link that account to its application
and configure the corresponding numeric application IDs.

Registration has separate email/IP limits (default 3 per email and 10 per IP per
hour). Wait for Retry-After on 429 rather than resetting counters. Email syntax
validation is implemented; email verification is planned and no email is sent.
Reset `allow_registration=false` when done, and never export populated passwords.
