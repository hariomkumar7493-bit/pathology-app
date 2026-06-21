# PathologyApp — Database Structure & Frontend Flow

## MongoDB Database: `PathoLabDB`

Your database needs **5 collections**:

---

## 1. `test_categories`

Groups tests into categories (e.g., Hematology, Biochemistry).

```json
{
  "_id": ObjectId("..."),
  "name": "HEMATOLOGY"
}
```

```json
{
  "_id": ObjectId("..."),
  "name": "BIOCHEMISTRY"
}
```

---

## 2. `tests`

Each test has its parameters **embedded** inside it (not a separate collection).

```json
{
  "_id": ObjectId("665a1b..."),
  "name": "Complete Blood Count (CBC)",
  "category_id": ObjectId("..."),
  "specimen": "BLOOD",
  "parameters": [
    {
      "id": 1,
      "param_name": "Haemoglobin (Hb)",
      "unit": "g/dL",
      "ref_range_male": "13.0 - 17.0",
      "ref_range_female": "12.0 - 15.0",
      "group_name": "Complete Blood Count",
      "sort_order": 1
    },
    {
      "id": 2,
      "param_name": "Total WBC Count",
      "unit": "cells/cumm",
      "ref_range_male": "4000 - 11000",
      "ref_range_female": "4000 - 11000",
      "group_name": "Complete Blood Count",
      "sort_order": 2
    },
    {
      "id": 3,
      "param_name": "Neutrophils",
      "unit": "%",
      "ref_range_male": "40 - 70",
      "ref_range_female": "40 - 70",
      "group_name": "Differential Count",
      "sort_order": 3
    }
  ]
}
```

### Parameter Fields:

| Field            | Purpose                                      |
|------------------|----------------------------------------------|
| `id`             | Unique integer ID within the test            |
| `param_name`     | Display name (e.g. "Haemoglobin")            |
| `unit`           | Measurement unit (e.g. "g/dL")               |
| `ref_range_male` | Normal range for males (e.g. "13.0 - 17.0")  |
| `ref_range_female`| Normal range for females                    |
| `group_name`     | Sub-heading in the report (e.g. "Differential Count") |
| `sort_order`     | Display order within the test                |

---

## 3. `patients`

```json
{
  "_id": ObjectId("..."),
  "name": "Rahul Kumar",
  "age": 30,
  "gender": "Male",
  "phone": "9876543210",
  "email": "rahul@email.com",
  "address": "123 Main St",
  "referred_by": "Dr. Sharma",
  "created_at": ISODate("2025-06-21T00:00:00Z")
}
```

---

## 4. `reports`

A report connects a patient to selected tests and stores results.

```json
{
  "_id": ObjectId("..."),
  "patient_id": ObjectId("..."),
  "ref_no": "1",
  "specimen": "BLOOD",
  "investigation": "Complete Blood Count (CBC), Lipid Profile",
  "doctor_name": "Dr. C. Ashok",
  "doctor_designation": "MBBS MD (PATH)",
  "status": "Completed",
  "date_of_collection": ISODate("2025-06-21T00:00:00Z"),
  "date_of_reporting": ISODate("2025-06-21T00:00:00Z"),
  "created_at": ISODate("2025-06-21T00:00:00Z"),
  "tests": [
    {
      "test_id": ObjectId("..."),
      "test_name": "Complete Blood Count (CBC)",
      "specimen": "BLOOD"
    }
  ],
  "results": [
    {
      "test_id": ObjectId("..."),
      "param_name": "Haemoglobin (Hb)",
      "result_value": "14.5",
      "is_abnormal": false,
      "unit": "g/dL",
      "ref_range_male": "13.0 - 17.0",
      "ref_range_female": "12.0 - 15.0",
      "group_name": "Complete Blood Count",
      "sort_order": 1
    }
  ]
}
```

### Report Status Values:
- `"Pending"` — tests selected but results not entered
- `"Completed"` — results filled in

---

## 5. `users`

```json
{
  "_id": ObjectId("..."),
  "name": "Dr. C. Ashok",
  "email": "admin@pathlab.com",
  "password": "$2a$10$...(bcrypt hash)",
  "role": "admin",
  "lab_name": "S & S Diagnostic Center",
  "created_at": ISODate("2025-06-21T00:00:00Z")
}
```

---

## Collection Relationships

```
test_categories          tests                       reports
┌──────────────┐   ┌───────────────────┐    ┌─────────────────────────┐
│ _id          │◄──│ category_id       │    │ _id                     │
│ name         │   │ name              │    │ patient_id ─────────────┼──► patients._id
└──────────────┘   │ specimen          │    │ ref_no                  │
                   │ parameters: [     │    │ status                  │
                   │   { id,           │    │ tests: [                │
                   │     param_name,   │    │   { test_id ────────────┼──► tests._id
                   │     unit,         │    │     test_name }         │
                   │     ref_range_*,  │    │ ]                       │
                   │     group_name,   │    │ results: [              │
                   │     sort_order }  │    │   { test_id,            │
                   │ ]                 │    │     param_name,          │
                   └───────────────────┘    │     result_value,        │
                                            │     is_abnormal }        │
                                            │ ]                        │
                                            └─────────────────────────┘
```

---

## Frontend → Backend Flow

### Flow 1: Test Selection (Patients page / Quick Report)

```
Frontend: api.getTests()
  → GET /api/tests
  → Backend reads `tests` + `test_categories` collections
  → Joins category_name onto each test
  → Returns: [{ _id, name, category_name, specimen, parameters }]
  → Frontend groups by category_name and displays checkboxes
```

### Flow 2: Loading Parameters for Selected Tests (Quick Report)

```
Frontend: api.getBulkParameters([testId1, testId2])
  → POST /api/tests/parameters/bulk  { testIds: [...] }
  → Backend fetches those tests, flattens all parameters
  → Adds test_name + category_name to each parameter
  → Returns flat array of parameters
  → Frontend groups by category_name → group_name for display
```

### Flow 3: Creating a Report

```
Frontend: api.createQuickReport({ patient_name, test_ids, results, ... })
  → POST /api/reports/quick
  → Backend creates/finds patient
  → Fetches test docs to get parameter metadata
  → Builds results array (param_name matched to submitted values)
  → Stores complete report document in `reports` collection
```

### Flow 4: Viewing/Printing a Report

```
Frontend: api.getReport(reportId)
  → GET /api/reports/:id
  → Backend reads report, joins patient info
  → Re-fetches test parameters for units/ranges/groups
  → Returns full report with results sorted by test → sort_order
  → Frontend passes to PrintableReport component
```

---

## API Endpoints Summary

| Method | Endpoint                    | Purpose                         |
|--------|-----------------------------|---------------------------------|
| GET    | /api/tests                  | All tests with category names   |
| GET    | /api/tests/categories       | All test categories             |
| GET    | /api/tests/:id/parameters   | Parameters for one test         |
| POST   | /api/tests/parameters/bulk  | Parameters for multiple tests   |
| GET    | /api/patients               | All patients                    |
| POST   | /api/patients               | Create patient                  |
| PUT    | /api/patients/:id           | Update patient                  |
| DELETE | /api/patients/:id           | Delete patient                  |
| GET    | /api/reports                | All reports (with patient info) |
| GET    | /api/reports/:id            | Full report details             |
| POST   | /api/reports                | Create report (select tests)    |
| POST   | /api/reports/quick          | Quick report (all in one)       |
| PUT    | /api/reports/:id/results    | Update results                  |
| DELETE | /api/reports/:id            | Delete report                   |
| POST   | /api/auth/login             | Login                           |
| POST   | /api/auth/register          | Signup                          |
