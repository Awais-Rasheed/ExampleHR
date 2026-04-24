# ExampleHR Time-Off Microservice

A production-grade NestJS microservice for managing employee time-off requests with real-time balance synchronization and a mock HCM server.

## Architecture

This is a NestJS monorepo containing:
- **time-off-monorepo**: Main time-off service (port 3000)
- **mock-hcm**: Mock HCM server for testing (port 3001)
- **common**: Shared library with TypeORM entities

## Tech Stack

- NestJS (TypeScript)
- SQLite with TypeORM
- better-sqlite3 driver
- Jest for testing
- Axios for HTTP requests

## Features

### Time-Off Service
- Create, approve, reject, and cancel time-off requests
- Real-time balance synchronization with HCM
- Batch balance synchronization
- Stale balance detection and auto-refresh
- Transaction-based balance deductions
- Race condition protection

### Mock HCM Server
- In-memory balance storage
- Deduct and restore balance operations
- Batch balance retrieval
- Anniversary bonus simulation
- Reset functionality for testing

## Setup

```bash
npm install
```

## Configuration

Environment variables are configured in `.env`:

```
PORT=3000
HCM_BASE_URL=http://localhost:3001
BALANCE_STALE_THRESHOLD_MINUTES=10
DB_PATH=./database.sqlite
SYNC_JOB_INTERVAL_MS=300000
```

## Running the Application

### Start the main time-off service
```bash
npm run start
```

### Start the mock HCM server (in a separate terminal)
```bash
npm run start:mock-hcm
```

### Development mode with auto-reload
```bash
npm run start:dev
```

## API Endpoints

### Time-Off Requests

- `POST /time-off/requests` - Create a new time-off request
  ```json
  {
    "employeeId": "EMP001",
    "locationId": "LOC001",
    "requestedDays": 5.0
  }
  ```

- `GET /time-off/requests/:id` - Get request by ID
- `GET /time-off/requests?employeeId=X` - List requests by employee
- `PATCH /time-off/requests/:id/approve` - Approve a request
- `PATCH /time-off/requests/:id/reject` - Reject a request
- `PATCH /time-off/requests/:id/cancel` - Cancel a request

### Balance Management

- `GET /time-off/balances?employeeId=X&locationId=Y` - Get cached balance
- `POST /time-off/balances/sync/realtime` - Sync single employee balance from HCM
  ```json
  {
    "employeeId": "EMP001",
    "locationId": "LOC001"
  }
  ```

- `POST /time-off/balances/sync/batch` - Batch sync all balances
  ```json
  [
    {
      "employeeId": "EMP001",
      "locationId": "LOC001",
      "availableDays": 15.0
    }
  ]
  ```

### Mock HCM Endpoints

- `GET /hcm/balances?employeeId=X&locationId=Y` - Get balance from HCM
- `POST /hcm/balances/deduct` - Deduct days from balance
- `POST /hcm/balances/restore` - Restore days to balance
- `POST /hcm/balances/batch` - Get all balances
- `POST /hcm/simulate/anniversary` - Add bonus days
- `POST /hcm/reset` - Reset HCM to initial state

## Business Rules

1. **Race Condition Protection**: Transactions ensure only one approval succeeds for concurrent requests
2. **Defensive Local Validation**: Balance is always checked locally before calling HCM
3. **Stale Balance Detection**: Balances older than 10 minutes trigger automatic refresh
4. **Batch Sync Idempotency**: Running the same batch twice produces identical results
5. **Cancellation Logic**:
   - PENDING requests: No balance change, no HCM call
   - APPROVED requests: HCM restore first, then local balance restore
6. **Status Transitions**:
   - Valid: PENDING→APPROVED, PENDING→REJECTED, PENDING→CANCELLED, APPROVED→CANCELLED
   - All others return 409 Conflict

## Testing

### Run all tests
```bash
npm run test
```

### Run tests with coverage
```bash
npm run test -- --coverage
```

### Watch mode
```bash
npm run test:watch
```

## Test Coverage

The test suite includes 23 comprehensive test cases covering:
- Unit tests (9 tests): Balance validation, status transitions, batch upsert, stale detection
- Integration tests (11 tests): Happy path, error handling, HCM integration, race conditions
- E2E tests (3 tests): Full lifecycle workflows

**Current Coverage: 88.64%** (exceeds 85% requirement)

## Database

The service uses SQLite with TypeORM. The database schema is automatically synchronized on startup.

### Entities

- **TimeOffBalance**: Employee balance cache with sync timestamps
- **TimeOffRequest**: Time-off request records with status tracking
- **SyncLog**: Audit log for synchronization operations

## Development

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Format
```bash
npm run format
```

## Project Structure

```
time-off-monorepo/
├── apps/
│   ├── time-off-monorepo/     # Main service
│   │   └── src/
│   │       ├── balances/      # Balance management module
│   │       ├── requests/      # Request management module
│   │       └── app.module.ts
│   └── mock-hcm/              # Mock HCM server
│       └── src/
├── libs/
│   └── common/                # Shared entities
│       └── src/
│           └── entities/
├── test/                      # E2E tests
└── package.json
```

## Notes

- The mock HCM server must be running for the main service to function properly
- All timestamps are stored in UTC
- Balance amounts use DECIMAL(6,2) precision
- The service uses transactions to ensure data consistency
- Stale balance threshold is configurable via environment variables
