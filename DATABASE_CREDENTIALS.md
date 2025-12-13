# Database Credentials - TrekTribe

## Quick Login Credentials

All accounts have been verified (email and phone).

### 👑 Admin Account
- **Email:** admin@trektribe.com
- **Password:** Admin@2025
- **Role:** Administrator
- **Phone:** +91-9876543210
- **Bio:** 🛡️ Platform Administrator - Managing TrekTribe operations

### 🎯 Agent Account
- **Email:** agent@trektribe.com
- **Password:** Agent@2025
- **Role:** Support Agent
- **Phone:** +91-9876543211
- **Bio:** 🎯 Customer Support Agent - Here to help travelers

### 🗺️ Organizer Account
- **Email:** organizer@trektribe.com
- **Password:** Organizer@2025
- **Role:** Trek Organizer
- **Phone:** +91-9876543212
- **Bio:** 🗺️ Professional Trek Organizer - Creating amazing mountain experiences

### ⛰️ Traveler Account
- **Email:** traveler@trektribe.com
- **Password:** Traveler@2025
- **Role:** Traveler
- **Phone:** +91-9876543213
- **Bio:** ⛰️ Adventure Enthusiast - Always ready for the next trek

---

## Database Management Commands

### Clean & Seed Database
```bash
# Development
cd services/api
npm run db:clean

# Production
npm run db:clean:prod
```

This command will:
1. ⚠️ **DELETE ALL DATA** from the database (with 3-second warning)
2. Clean all collections (users, trips, reviews, follows, posts, etc.)
3. Create 4 preset user accounts with verified emails and phones
4. Display login credentials

### Other Useful Commands

```bash
# Setup database indexes
npm run setup:db

# List all users
npm run cli -- user list

# Database stats
npm run cli -- stats
```

---

## Application URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **Backend Health:** http://localhost:4000/health

---

## Notes

- All passwords follow the pattern: `[Role]@2025` (e.g., Admin@2025)
- All accounts are email and phone verified
- Social stats initialized (0 followers, 0 following, 0 posts)
- Phone numbers follow Indian format (+91)
- All users located in different cities across India

---

## Security Notes

⚠️ **These are demo credentials for development only!**
- Never use these credentials in production
- Change passwords immediately in production environments
- Use environment variables for production credentials
- Enable 2FA for admin accounts in production
