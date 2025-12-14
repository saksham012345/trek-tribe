# TrekTribe Preset Test Credentials

## 🔐 Test User Accounts

These accounts are automatically created when you run the database seed script.

### Admin Account
- **Email:** `admin@trektribe.com`
- **Password:** `Admin@2025`
- **Role:** Admin
- **Access:** Full platform access, user management, system settings

### Support Agent Account  
- **Email:** `agent@trektribe.com`
- **Password:** `Agent@2025`
- **Role:** Agent
- **Access:** Customer support features, ticket management

### Organizer Account
- **Email:** `organizer@trektribe.com`
- **Password:** `Organizer@2025`
- **Role:** Organizer
- **Access:** Create trips, manage bookings, CRM access (with subscription)

### Traveler Account
- **Email:** `traveler@trektribe.com`
- **Password:** `Traveler@2025`
- **Role:** Traveler
- **Access:** Browse trips, make bookings, reviews

---

## 🚀 How to Set Up Test Users

### Option 1: Render/Vercel (Hosted) — Safe Upsert
Call the internal seed endpoint (requires `SEED_TOKEN` env):
```bash
curl -X POST https://trek-tribe-38in.onrender.com/api/internal/seed/preset-users \
	-H "x-seed-token: $SEED_TOKEN"
```

### Option 2: Local Dev (Non-destructive)
```bash
cd services/api
npm run setup:users
```

### Option 3: Local Dev (Full reset + seed) ⚠️ wipes data
```bash
cd services/api
npm run db:clean
```

⚠️ **Warning:** `db:clean` deletes ALL data. Do not run on production.

---

## 🔧 Troubleshooting

### Issue: "Invalid credentials" error
**Solution:** Run the seed script to create the users:
```bash
cd services/api
npm run seed
```

### Issue: "Email not verified" error
**Solution:** Admin and Agent accounts don't require email verification. Organizer and Traveler accounts are automatically verified when created by the seed script.

### Issue: Profile not loading
**Possible causes:**
1. User not found in database - Run seed script
2. Invalid JWT token - Clear browser storage and login again
3. Backend not running - Check `npm run dev` in services/api

---

## 📝 Notes

- All preset users are created with email verification already completed
- Passwords follow the pattern: `RoleName@2025`
- Phone numbers are in format: `+91-987654321X` (where X is 0-3)
