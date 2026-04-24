# Quick Start Guide

## Starting the Services

### Terminal 1 - Start Main Service (port 3000)
```bash
cd time-off-monorepo
npm run start
```

Wait for: `Time-Off Service running on http://localhost:3000`

### Terminal 2 - Start Mock HCM (port 3001)
```bash
cd time-off-monorepo
npm run start:mock-hcm
```

Wait for: `Mock HCM Server running on http://localhost:3001`

## Testing Options

### Option 1: Browser UI (Easiest)
1. Open `test-ui.html` in your browser
2. Click "Check Services" to verify both services are running
3. Use the interactive UI to test all features

### Option 2: Browser URLs (GET requests only)
- View HCM balance: http://localhost:3001/hcm/balances?employeeId=EMP001&locationId=LOC001
- View local balance: http://localhost:3000/time-off/balances?employeeId=EMP001&locationId=LOC001

### Option 3: Bash Script (Full workflow)
```bash
cd time-off-monorepo
./test-api.sh
```

### Option 4: Manual curl commands

**1. Sync balance from HCM:**
```bash
curl -X POST http://localhost:3000/time-off/balances/sync/realtime \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP001","locationId":"LOC001"}'
```

**2. Create time-off request:**
```bash
curl -X POST http://localhost:3000/time-off/requests \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP001","locationId":"LOC001","requestedDays":5.0}'
```

**3. Approve request (replace REQUEST_ID):**
```bash
curl -X PATCH http://localhost:3000/time-off/requests/REQUEST_ID/approve
```

**4. Check updated balance:**
```bash
curl http://localhost:3000/time-off/balances?employeeId=EMP001&locationId=LOC001
```

## Available Test Employees

The mock HCM is pre-seeded with these employees:
- EMP001 @ LOC001: 15.0 days
- EMP001 @ LOC002: 10.0 days
- EMP002 @ LOC001: 20.0 days
- EMP003 @ LOC002: 12.5 days
- EMP004 @ LOC003: 18.0 days
- EMP005 @ LOC003: 25.0 days

## Troubleshooting

**Services not starting?**
- Make sure you're in the `time-off-monorepo` directory
- Run `npm install` first if you haven't already
- Check if ports 3000 and 3001 are available

**CORS errors in browser?**
- This is expected for cross-origin requests
- Use the test-ui.html file or curl/Postman instead

**Database locked errors?**
- Stop all running instances
- Delete `database.sqlite` and restart
