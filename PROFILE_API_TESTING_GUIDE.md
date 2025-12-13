# Profile API - Quick Testing Guide

## Test Cases

### 1️⃣ Valid Profile (200 OK)
```bash
# Get your own profile
curl -X GET http://localhost:5000/profile/enhanced \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK
# Response: { success: true, data: { user: {...}, isOwnProfile: true } }
```

### 2️⃣ Valid User, Different Profile (200 OK)
```bash
# Get another user's public profile
curl -X GET http://localhost:5000/profile/enhanced/[VALID_USER_ID] \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK
# Response: { success: true, data: { user: {...}, isOwnProfile: false } }
```

### 3️⃣ User Not Found (404 Not Found)
```bash
# Assuming this is a valid ObjectId format but user doesn't exist
# Example ID: 507f1f77bcf86cd799439011
curl -X GET http://localhost:5000/profile/enhanced/507f1f77bcf86cd799439011

# Expected: 404 Not Found
# Response: { success: false, message: "User not found", statusCode: 404 }
```

### 4️⃣ Invalid ObjectId Format (400 Bad Request)
```bash
# Invalid format: not 24 hex characters
curl -X GET http://localhost:5000/profile/enhanced/invalidUserId123

# Expected: 400 Bad Request
# Response: { success: false, message: "Invalid user ID format", statusCode: 400 }
```

### 5️⃣ Private Profile (403 Forbidden)
```bash
# Access someone else's private profile
curl -X GET http://localhost:5000/profile/enhanced/[PRIVATE_USER_ID] \
  -H "Authorization: Bearer DIFFERENT_USER_JWT"

# Expected: 403 Forbidden
# Response: { success: false, message: "This profile is private", statusCode: 403 }
```

---

## Frontend Testing

### 1. Test in Browser

#### Valid Profile
```
1. Visit: http://localhost:3000/profile/[VALID_USER_ID]
2. Expected: Profile displays with all data
3. Check console: No errors
```

#### Profile Not Found (404)
```
1. Visit: http://localhost:3000/profile/507f1f77bcf86cd799439011
2. Expected: Shows "Profile Not Found" message
3. Check console: Shows statusCode: 404
```

#### Invalid ID Format (400)
```
1. Visit: http://localhost:3000/profile/invalid
2. Expected: Shows appropriate error
3. Check console: Shows statusCode: 400
```

#### Private Profile (403)
```
1. Create a user with private profile
2. Login as different user
3. Visit their profile
4. Expected: Shows "Profile is Private" message
5. Check console: Shows statusCode: 403
```

---

## Console Verification

### Successful Request
```javascript
// Frontend console should show:
// GET /profile/enhanced/[userId] 200 OK
```

### Error Request
```javascript
// Frontend console should show:
Error fetching profile: {
  statusCode: 404,
  errorMessage: "User not found",
  error: { ... }
}
```

---

## Backend Log Verification

### Successful Request
```
Fetching profile: 507f1f77bcf86cd799439011
```

### Invalid Format
```
Invalid user ID format provided { userId: 'invalidUserId123' }
```

### User Not Found
```
User not found { userId: '507f1f77bcf86cd799439011' }
```

### Error
```
Error fetching enhanced profile {
  error: 'connection timeout',
  userId: '507f1f77bcf86cd799439011',
  stack: '[stack trace...]'
}
```

---

## Test Data Setup

### Create Test Users
```bash
# Create user 1 (public profile)
POST /api/auth/register
{
  "name": "John Public",
  "email": "john.public@test.com",
  "password": "Test123!",
  "role": "traveller"
}

# Create user 2 (private profile)
POST /api/auth/register
{
  "name": "Jane Private",
  "email": "jane.private@test.com",
  "password": "Test123!",
  "role": "traveller"
}

# Update user 2's profile to private
PUT /profile/enhanced
Authorization: Bearer [JANE_TOKEN]
{
  "privacySettings": {
    "profileVisibility": "private"
  }
}
```

---

## Error Messages to Expect

| Scenario | Error Message | Status Code |
|----------|---------------|------------|
| Invalid ID format | "Invalid user ID format" | 400 |
| No ID provided | "User ID is required" | 400 |
| User doesn't exist | "User not found" | 404 |
| Profile is private | "This profile is private" | 403 |
| Server error | "Failed to fetch profile" | 500 |

---

## Quick Test Checklist

- [ ] ✅ Valid profile loads successfully (200)
- [ ] ✅ Non-existent profile shows proper error (404)
- [ ] ✅ Invalid ID format shows proper error (400)
- [ ] ✅ Private profile shows proper error (403)
- [ ] ✅ Server errors are handled gracefully (500)
- [ ] ✅ Console shows correct status codes
- [ ] ✅ Backend logs show detailed error info
- [ ] ✅ UI displays user-friendly messages
- [ ] ✅ No unhandled exceptions in backend
- [ ] ✅ No generic errors in frontend

---

## Troubleshooting

### Profile still shows "Profile not found" for everything?
1. Check backend is restarted
2. Hard refresh browser (Ctrl+Shift+R)
3. Check console for actual status code
4. Verify API endpoint URL is correct

### Still getting 500 errors?
1. Check backend logs for stack trace
2. Verify MongoDB connection
3. Check that `USER_ID` is valid MongoDB ObjectId format
4. Ensure backend is running latest code

### No error message appearing?
1. Check browser console for JavaScript errors
2. Verify error state is being set in React
3. Check that response.data structure matches expected format

---

## Expected Behavior

### User Flow
```
1. Click on profile link
   ↓
2. Frontend loads profile page
   ↓
3. Makes GET /profile/enhanced/[userId] request
   ↓
4. Backend validates:
   - Is userId format valid? (if not → 400)
   - Does user exist? (if not → 404)
   - Is profile public or authorized? (if not → 403)
   ↓
5. Returns profile data (200)
   ↓
6. Frontend displays profile OR error message
```

---

## Success Criteria

✅ **Objective Complete When:**
- Backend validates input format before database query
- All error codes return proper HTTP status (400, 403, 404, 500)
- Frontend shows different messages for different errors
- Console shows specific status codes
- Backend logs include detailed error context
- No unhandled exceptions crash the API
- Frontend build succeeds with 0 TypeScript errors

---

## Additional Notes

- Uses MongoDB ObjectId format: `[0-9a-fA-F]{24}`
- Logging includes error context for debugging
- Development mode shows error details, production hides them
- Privacy settings checked for authorization
- All responses include explicit `statusCode` field
