# PathLab Pro — Architecture Document

## Overview

PathLab Pro is a pathology lab management application with two clients sharing a single backend:

- **Web App** (React) — talks directly to MongoDB via REST API
- **Electron Desktop App** (React + SQLite) — works offline, syncs with MongoDB in background

```
┌─────────────────────────────────────────────────────┐
│                   MongoDB (Source of Truth)          │
│                                                       │
│  patients    reports    tests    test_categories     │
│  users       settings   ── all with local_id field   │
└──────────────────────┬──────────────────────────────┘
                       │ REST API (HTTPS)
                       │ https://patholabpro.online/api
          ┌────────────┴────────────┐
          │                         │
   ┌──────▼──────┐          ┌───────▼───────┐
   │   Web App   │          │  Electron App │
   │  (Browser)  │          │   (Desktop)   │
   │             │          │               │
   │  Direct API │          │  SQLite (local)│
   │  No sync    │          │  + Sync Engine │
   └─────────────┘          └───────────────┘
```

---

## Web App (Browser)

- **No local database** — all reads/writes go directly to MongoDB via REST API
- **Always online** — requires internet connection
- **No sync logic** — no `local_id`, no `remote_id`, no SQLite
- Uses `src/api.js` which detects non-Electron environment and calls `fetch()` to the remote API

---

## Electron App (Desktop)

### Local Storage: SQLite

Each table has two ID columns:

| Column      | Type | Description                                      |
|-------------|------|--------------------------------------------------|
| `_id`       | TEXT | **Local ID** — UUID generated on client, PRIMARY KEY, never changes |
| `remote_id` | TEXT | **Remote ID** — MongoDB `_id`, set after first successful push to server |

Tables: `patients`, `reports`, `tests`, `test_categories`, `users`

### Sync Status

| Status    | Meaning                                    |
|-----------|--------------------------------------------|
| `pending` | Created/modified locally, not yet pushed   |
| `synced`  | Successfully pushed to server              |
| `deleted` | Deleted locally, tombstone to push to server |

### Offline Flow (No Internet)

```
1. User registers patient
   → SQLite: _id=abc123, remote_id=NULL, sync_status='pending'

2. User creates report with tests
   → SQLite: _id=def456, remote_id=NULL, sync_status='pending'
   → report.patient_id = abc123 (references local _id)

3. User edits report results
   → SQLite: sync_status='pending' (marked dirty)

4. All data available locally — app works fully offline
```

### Sync Flow (Online — Push Then Pull)

#### Step 1: Push (Local → Server)

```
For each pending record:

  1. Try PUT /api/{resource}/{remote_id or _id}
     - Payload includes: local_id = _id (so server stores it)

  2. If 404 (not found on server):
     → POST /api/{resource}
     → Server creates document with MongoDB _id
     → Store server's _id in remote_id column
     → Mark sync_status = 'synced'
     → Local _id stays unchanged

  3. If 200 (updated successfully):
     → Mark sync_status = 'synced'

  4. If POST returns no _id:
     → Keep sync_status = 'pending' (retry next sync)
     → Data stays visible locally
```

**Example:**
```
Local patient: _id=abc123, remote_id=NULL, sync_status='pending'

Push:
  PUT /api/patients/abc123 → 404 (server doesn't know this ID)
  POST /api/patients { _id: abc123, local_id: abc123, name: "John", ... }
  Server creates: { _id: xyz789, local_id: abc123, name: "John", ... }
  Server returns: { _id: xyz789 }

Update SQLite:
  remote_id = xyz789
  sync_status = 'synced'
  _id stays abc123 (never changes!)
```

#### Step 2: Pull (Server → Local)

```
For each remote document from server:

  1. Find local match using findLocalRow():
     a. Match by local_id:  WHERE _id = remoteDoc.local_id
     b. Match by remote_id:  WHERE remote_id = remoteDoc._id
     c. Match by _id:        WHERE _id = remoteDoc._id (backwards compat)

  2. If found:
     → UPDATE local row with server data
     → Set remote_id = server's _id
     → Set sync_status = 'synced'
     → Skip if local sync_status is 'pending' or 'deleted' (local changes win)

  3. If not found:
     → INSERT new row with _id = server's _id, remote_id = server's _id
     → (This is data created from web or other sources)

  4. For synced local rows not returned by server:
     → If remote_id is NULL: re-mark as 'pending' (never pushed, retry)
     → If remote_id exists: keep as 'synced' (server just didn't return it)
```

### Foreign Key Resolution

When pulling reports from server, `patient_id` could be either:
- The local `_id` (if report was created from Electron)
- The MongoDB `_id` (if report was created from web)

`resolvePatientId()` handles both:
```
1. WHERE patients._id = server_patient_id     → found (local_id was stored)
2. WHERE patients.remote_id = server_patient_id → found (MongoDB _id)
3. Not found → return as-is (patient may not be synced yet)
```

Same pattern for `category_id` in tests via `resolveCategoryId()`.

### Manual Sync

- **Sync button** in header (Electron only)
- States: "Sync Now" (amber, pending changes) → "Syncing..." (blue, spinner) → "Synced" (green, checkmark)
- Toast notifications: success, fully synced, errors, failure
- Auto-sync triggers: on app launch, on network reconnect, every 30 seconds if online

---

## Data Model

### SQLite Schema (Electron)

```sql
patients (
  _id TEXT PRIMARY KEY,        -- local UUID, never changes
  remote_id TEXT,              -- MongoDB _id, set after push
  name, age, gender, phone, email, address, referred_by,
  created_at, updated_at,
  sync_status TEXT DEFAULT 'synced'
)

reports (
  _id TEXT PRIMARY KEY,
  remote_id TEXT,
  patient_id TEXT,             -- references patients._id (local)
  patient_name, age, gender,   -- denormalized for offline display
  referred_by, ref_no, specimen, investigation,
  doctor_name, doctor_designation,
  status, date_of_collection, date_of_reporting,
  created_at,
  tests TEXT,                  -- JSON array of test objects
  results TEXT,                -- JSON array of parameter results
  sync_status TEXT DEFAULT 'synced'
)

tests (
  _id TEXT PRIMARY KEY,
  remote_id TEXT,
  name, category_id, category_name, specimen, price,
  parameters TEXT,             -- JSON array of test parameters
  created_at,
  sync_status
)

test_categories (
  _id TEXT PRIMARY KEY,
  remote_id TEXT,
  name, description, created_at,
  sync_status
)

users (
  _id TEXT PRIMARY KEY,
  remote_id TEXT,
  name, phone, role, password, created_at,
  sync_status
)
```

### Report Results Structure

Each item in `results` JSON array:
```json
{
  "param_name": "Haemoglobin",
  "result_value": "14.5",
  "unit": "g/dL",
  "ref_range_male": "13.0-17.0",
  "ref_range_female": "12.0-15.0",
  "group_name": "CBC",
  "sort_order": 1,
  "calc_formula": null,
  "is_abnormal": false,
  "category_name": "Hematology",
  "specimen": "BLOOD"
}
```

---

## API Endpoints

| Method | Endpoint                          | Purpose                    |
|--------|-----------------------------------|----------------------------|
| GET    | /api/patients                     | List all patients          |
| POST   | /api/patients                     | Create patient             |
| PUT    | /api/patients/:id                 | Update patient             |
| DELETE | /api/patients/:id                 | Delete patient             |
| GET    | /api/reports                      | List all reports           |
| POST   | /api/reports                      | Create report              |
| PUT    | /api/reports/:id                  | Update report              |
| DELETE | /api/reports/:id                  | Delete report              |
| GET    | /api/tests                        | List all tests             |
| POST   | /api/tests                        | Create test                |
| PUT    | /api/tests/:id                    | Update test                |
| DELETE | /api/tests/:id                    | Delete test                |
| GET    | /api/tests/categories             | List categories            |
| POST   | /api/tests/categories             | Create category            |
| PUT    | /api/tests/categories/:id         | Update category            |
| GET    | /api/settings/report-layout       | Get report layout settings |
| GET    | /api/settings/referring-doctors   | Get referring doctors list |
| GET    | /api/auth/users                   | List users                 |
| POST   | /api/auth/users                   | Create user                |
| PUT    | /api/auth/users/:id               | Update user                |

**Note:** Electron push payloads include a `local_id` field. The server should store and return this field for full-proof sync matching. If the server ignores it, sync falls back to `remote_id` matching (still works, less robust).

---

## File Structure

```
electron/
  main.cjs          — Electron main process, window management, IPC setup
  preload.cjs       — Context bridge between renderer and main process
  db.cjs            — SQLite schema, connection, ID generation, JSON helpers
  sync.cjs          — Sync engine (push/pull, local_id matching, FK resolution)
  ipc-handlers.cjs  — IPC handlers for CRUD operations

src/
  api.js            — API abstraction (fetch for web, IPC for Electron)
  context/
    SyncContext.jsx — Sync state provider (online status, pending count, trigger)
  components/
    Layout/
      Header.jsx    — Header with sync button and status indicator
    PrintableReport.jsx — Printable report component
  pages/
    Patients.jsx    — Patient management + test selection
    Reports.jsx     — Report list, view, edit, print
    QuickReport.jsx — Quick report creation (stores patient data in report)
    TestManagement.jsx — Test and category management
    Settings.jsx    — App settings
    StaffManagement.jsx — User management
```

---

## Key Design Decisions

1. **Local `_id` never changes** — all foreign keys reference it, no cascade updates needed
2. **`remote_id` is set once** — after first successful push, never overwritten (except during pull if server returns different _id)
3. **Pull never deletes** — unmatched synced rows with `remote_id` stay synced; without `remote_id` re-marked as pending
4. **Pending local changes win** — if local row is `pending` or `deleted`, pull skips it (local changes take priority)
5. **Denormalized patient data in reports** — `patient_name`, `age`, `gender` stored directly in reports table for offline display and printing
6. **`local_id` in payload** — sent to server so MongoDB stores it, enabling full-proof matching on pull
