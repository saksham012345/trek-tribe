# 🎯 Demo Database Setup Guide

## Overview
This script sets up a complete demo database with test users for all roles, including subscriptions and sample trips.

## Quick Start

### Run the Setup Script
```bash
cd services/api
npx ts-node src/scripts/setup-demo-database.ts
```

## Created Users

### 1️⃣ ADMIN
- **Email**: `admin@trektribe.com`
- **Password**: `Admin@123456`
- **Access**: Full platform administration
- **Features**:
  - Manage all users
  - Approve/reject trips
  - Access all dashboards
  - Bypass subscription checks

### 2️⃣ AGENT
- **Email**: `agent@trektribe.com`
- **Password**: `Agent@123456`
- **Access**: Customer support
- **Features**:
  - View and manage tickets
  - Chat with customers
  - View trip details
  - Assist with bookings

### 3️⃣ PREMIUM ORGANIZER (With CRM Access)
- **Email**: `organizer.premium@trektribe.com`
- **Password**: `Organizer@123`
- **Subscription**: PREMIUM (Active)
- **Trips**: 5 used / 15 total
- **Features**:
  - ✅ Create trips (10 remaining)
  - ✅ CRM access (leads, analytics)
  - ✅ Lead capture forms
  - ✅ Advanced analytics
  - ✅ Email marketing
- **Sample Trips Created**: 2 approved trips

### 4️⃣ BASIC ORGANIZER (No Subscription)
- **Email**: `organizer.basic@trektribe.com`
- **Password**: `Organizer@123`
- **Subscription**: ❌ None (needs to activate)
- **Features**:
  - ❌ Cannot create trips (blocked until subscription)
  - Must start free trial or purchase plan
  - Can browse marketplace
  - Profile visible to travelers

### 5️⃣ TRAVELER
- **Email**: `traveler@trektribe.com`
- **Password**: `Traveler@123`
- **Features**:
  - Browse and search trips
  - Book trips
  - AI chat support
  - Manage bookings
  - Leave reviews

## Testing Scenarios

### 🔒 Test Subscription Gating
1. Login as `organizer.basic@trektribe.com`
2. Try to create a trip
3. **Expected**: 402 error - "Subscription required"
4. Navigate to subscription page
5. Start free trial or purchase plan
6. **Expected**: Can now create trips

### ✅ Test CRM Access
1. Login as `organizer.premium@trektribe.com`
2. Navigate to `/crm/leads`
3. **Expected**: Access granted
4. Logout and login as `organizer.basic@trektribe.com`
5. Try to access `/crm/leads`
6. **Expected**: 403 error - "Premium plan required"

### 📊 Test Trip Limits
1. Login as `organizer.premium@trektribe.com`
2. Create trips (can create 10 more)
3. After 15 total trips:
4. **Expected**: 403 error - "Trip limit reached"
5. **Action**: Upgrade plan or wait for next cycle

### 🎫 Test Booking Flow
1. Login as `traveler@trektribe.com`
2. Browse available trips
3. View trip details
4. Click "Book Now"
5. Complete payment
6. **Expected**: Booking confirmed

### 👨‍💼 Test Admin Features
1. Login as `admin@trektribe.com`
2. Access all dashboards
3. Create trips without subscription check
4. Approve/reject pending trips
5. Manage users

## Database Structure

### Users Created: 5
- 1 Admin
- 1 Agent
- 2 Organizers (1 premium, 1 basic)
- 1 Traveler

### Subscriptions Created: 1
- Premium organizer subscription
  - Plan: PREMIUM
  - Trips: 5/15 used
  - Status: Active
  - Expires: 60 days from setup

### Trips Created: 2
- Hampta Pass Trek - ₹12,500
- Kedarkantha Winter Trek - ₹9,500
- Both approved and ready for booking

## Verification Checklist

After running the script, verify:

- [ ] Can login with all 5 accounts
- [ ] Basic organizer is blocked from creating trips
- [ ] Premium organizer can create trips
- [ ] Premium organizer has CRM access
- [ ] Traveler can browse trips
- [ ] Admin can access all features
- [ ] Agent can view tickets

## Troubleshooting

### "Connection Failed"
- Check MongoDB is running
- Verify `MONGODB_URI` in `.env`

### "Users Already Exist"
- Script cleans database before creating users
- Safe to run multiple times

### "Subscription Not Working"
- Check subscription status in MongoDB:
  ```js
  db.organizersubscriptions.find({ organizerId: ObjectId("...") })
  ```

## Clean Database (Optional)

To start fresh:
```bash
# Connect to MongoDB
mongo

# Switch to database
use trekk-tribe

# Drop all collections
db.users.deleteMany({})
db.organizersubscriptions.deleteMany({})
db.trips.deleteMany({})

# Or drop entire database
db.dropDatabase()
```

Then run the setup script again.

## Environment Variables

Required in `services/api/.env`:
```bash
MONGODB_URI=mongodb://localhost:27017/trekk-tribe
# or your MongoDB Atlas URI
```

## Quick Login Reference

Save these credentials for easy access:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@trektribe.com | Admin@123456 |
| Agent | agent@trektribe.com | Agent@123456 |
| Premium Org | organizer.premium@trektribe.com | Organizer@123 |
| Basic Org | organizer.basic@trektribe.com | Organizer@123 |
| Traveler | traveler@trektribe.com | Traveler@123 |

## Next Steps

1. **Run the setup script**
2. **Start the backend**: `cd services/api && npm run dev`
3. **Start the frontend**: `cd web && npm start`
4. **Login** with any account above
5. **Test features** based on role

## Support

If you encounter issues:
1. Check backend console logs
2. Verify MongoDB connection
3. Check browser console for errors
4. Review network tab in DevTools

---

**Last Updated**: December 20, 2025  
**Script Location**: `services/api/src/scripts/setup-demo-database.ts`
