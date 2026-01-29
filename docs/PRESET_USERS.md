# Preset Users (Development & Testing)

This document contains credentials for accessing preset accounts in the Trek Tribe development and testing environments.

> [!WARNING]
> These credentials are for **TESTING ONLY**. Never use these passwords in a real production environment with real user data.

## 🔑 Application Accounts

### Admin Account
*Full system access*
- **Email**: `trektribe_root@trektribe.in`
- **Password**: `Saksham@4700`
- **Role**: `admin`
- **Features**: Full Dashboard Access, User Management

### Agent Account
*Customer support & CRM*
- **Email**: `trektribeagent@gmail.com`
- **Password**: `Agent@9800`
- **Role**: `agent`
- **Features**: Support Ticket Management, CRM Dashboard

### Premium Organizer
*Primary organizer account with all features*
- **Email**: `sakshamtaneja098@gmail.com`
- **Password**: `Premium@1234`
- **Role**: `organizer`
- **Plan**: `premium` (Unlimited trips, Auto-Pay enabled)
- **Features**: CRM Access, Trip Creation, Analytics

### Demo Organizer
*Secondary organizer for payment testing*
- **Email**: `tanejasaksham44@gmail.com`
- **Password**: `Demo@1234`
- **Role**: `organizer`
- **Plan**: `premium` (Unlimited trips, Auto-Pay enabled)
- **Features**: Payment Integration Testing

## 🗄️ Database
- **Connection String**: Provided in `.env` (MongoDB Atlas)

## 🔄 Resetting Credentials
To reset these accounts to their default state (including passwords), run the following command in `services/api`:

```bash
npx ts-node scripts/setup-preset-users-force.ts
```
