#!/bin/bash

echo "=== ExampleHR Time-Off Service Test Script ==="
echo ""

# 1. Sync balance from HCM
echo "1. Syncing balance from HCM..."
curl -X POST http://localhost:3000/time-off/balances/sync/realtime \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP001","locationId":"LOC001"}'
echo -e "\n"

# 2. Check balance
echo "2. Checking balance..."
curl http://localhost:3000/time-off/balances?employeeId=EMP001&locationId=LOC001
echo -e "\n"

# 3. Create time-off request
echo "3. Creating time-off request for 5 days..."
REQUEST_RESPONSE=$(curl -s -X POST http://localhost:3000/time-off/requests \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP001","locationId":"LOC001","requestedDays":5.0}')
echo $REQUEST_RESPONSE
REQUEST_ID=$(echo $REQUEST_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Request ID: $REQUEST_ID"
echo ""

# 4. Get request details
echo "4. Getting request details..."
curl http://localhost:3000/time-off/requests/$REQUEST_ID
echo -e "\n"

# 5. Approve request
echo "5. Approving request..."
curl -X PATCH http://localhost:3000/time-off/requests/$REQUEST_ID/approve
echo -e "\n"

# 6. Check updated balance
echo "6. Checking updated balance (should be 10.0)..."
curl http://localhost:3000/time-off/balances?employeeId=EMP001&locationId=LOC001
echo -e "\n"

# 7. Check HCM balance
echo "7. Checking HCM balance (should also be 10.0)..."
curl http://localhost:3001/hcm/balances?employeeId=EMP001&locationId=LOC001
echo -e "\n"

echo "=== Test Complete ==="
