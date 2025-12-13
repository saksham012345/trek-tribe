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

### Option 1: Run Seed Script (Recommended)
```bash
cd services/api
npm run seed
```

### Option 2: Clean and Seed
```bash
cd services/api
npm run clean-seed
```

⚠️ **Warning:** `clean-seed` will delete ALL existing data

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
