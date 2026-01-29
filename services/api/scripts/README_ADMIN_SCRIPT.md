# Create Admin & Agent Users

This script creates default admin and agent users for the Trek Tribe platform.

## Default Credentials

After running this script, you can log in with:

### Admin Account
- **Email**: admin@trektribe.com
- **Password**: Admin@123456
- **Role**: admin
- **Access**: Full platform access, can manage users, trips, bookings, etc.

### Agent Account 1
- **Email**: agent@trektribe.com
- **Password**: Agent@123456
- **Role**: agent
- **Access**: Customer support dashboard, ticket management

### Agent Account 2
- **Email**: agent2@trektribe.com
- **Password**: Agent2@123456
- **Role**: agent
- **Access**: Customer support dashboard, ticket management

## How to Run

### Prerequisites
1. MongoDB must be running
2. Environment variables must be configured in `services/api/.env`

### Steps

1. Navigate to the API directory:
```bash
cd services/api
```

2. Run the script:
```bash
npx ts-node src/scripts/create-admin-agent.ts
```

Or using npm script (if configured):
```bash
npm run create-admin
```

## What It Does

1. Connects to MongoDB
2. Checks if users already exist
3. Creates admin and agent users with:
   - Hashed passwords (bcrypt with 12 rounds)
   - Email verified flag set to true
   - Appropriate role assignments
4. Prints credentials to console
5. Disconnects from MongoDB

## Security Notes

⚠️ **IMPORTANT**: These are default credentials for development/testing.

**For Production**:
1. Change these passwords immediately after first login
2. Use strong, unique passwords
3. Enable two-factor authentication (if implemented)
4. Rotate credentials regularly
5. Never commit actual production credentials to git

## Troubleshooting

### "User already exists"
If you see this message, the user was already created. To recreate:
1. Delete the existing user from MongoDB
2. Run the script again

### Connection Error
Make sure:
- MongoDB is running
- `MONGODB_URI` in `.env` is correct
- MongoDB is accessible from your network

### Permission Denied
Make sure you have write permissions to the MongoDB database.

## Next Steps

After creating admin/agent users:
1. Start the backend: `npm run dev`
2. Start the frontend: `cd ../web && npm start`
3. Navigate to http://localhost:3000/login
4. Log in with admin credentials
5. Change default passwords

## Related Documentation

- [SETUP_COMPLETE.md](../../SETUP_COMPLETE.md) - Full platform setup guide
- [ENV_VARIABLES_QUICK_REF.md](../../docs/ENV_VARIABLES_QUICK_REF.md) - Environment configuration
- API authentication docs - `/docs/API_AUTH.md`
