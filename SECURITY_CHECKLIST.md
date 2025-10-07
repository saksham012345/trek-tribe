# 🔒 Security Checklist for Trekk Tribe

## ⚠️ **BEFORE PUSHING TO GITHUB**

### ✅ **Environment Variables**
- [ ] No `.env` files are tracked by git
- [ ] All secrets are moved to environment variables
- [ ] `.env.example` template is created with placeholder values
- [ ] No hardcoded secrets in source code

### ✅ **Sensitive Data**
- [ ] No database credentials in code
- [ ] No API keys or tokens in code
- [ ] No email passwords in code
- [ ] No JWT secrets in code
- [ ] No WhatsApp session data in repository

### ✅ **Files to Exclude**
- [ ] Log files are excluded from git
- [ ] Upload directories are excluded
- [ ] WhatsApp auth data is excluded
- [ ] Build artifacts are excluded
- [ ] Temporary files are excluded

### ✅ **Code Review**
- [ ] No console.log statements with sensitive data
- [ ] No hardcoded URLs or endpoints
- [ ] No test credentials in production code
- [ ] No debugging information in production builds

## 🚨 **CRITICAL SECURITY ISSUES FOUND**

### 1. **Hardcoded JWT Secret**
**File**: `services/api/src/routes/auth.ts`
**Issue**: `process.env.JWT_SECRET || 'devsecret'`
**Risk**: HIGH - Default secret exposes authentication
**Fix**: Remove default value, require environment variable

### 2. **Default Database URI**
**File**: `services/api/src/index.ts`
**Issue**: `process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekktribe'`
**Risk**: MEDIUM - Localhost fallback in production
**Fix**: Remove default, require environment variable

### 3. **Email Credentials**
**Files**: `services/api/src/services/emailService.ts`
**Issue**: Uses `GMAIL_USER` and `GMAIL_APP_PASSWORD`
**Risk**: HIGH - Email account credentials
**Status**: ✅ Properly using environment variables

### 4. **Log Files**
**Directory**: `services/api/logs/`
**Issue**: Contains runtime logs
**Risk**: LOW - May contain sensitive information
**Status**: ✅ Added to .gitignore

## 🛠️ **IMMEDIATE ACTIONS REQUIRED**

### 1. **Fix JWT Secret Default**
```typescript
// BEFORE (INSECURE)
const token = jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });

// AFTER (SECURE)
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}
const token = jwt.sign({ userId: String(user._id), role: user.role }, jwtSecret, { expiresIn: '7d' });
```

### 2. **Fix Database URI Default**
```typescript
// BEFORE (INSECURE)
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekktribe';

// AFTER (SECURE)
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error('MONGODB_URI environment variable is required');
}
```

### 3. **Create Environment File**
```bash
# Copy template
cp env.example .env

# Edit with your values
nano .env
```

## 📋 **ENVIRONMENT VARIABLES NEEDED**

### **Backend (.env)**
```bash
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/trekktribe
JWT_SECRET=your_super_secure_jwt_secret_here
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

### **Frontend (.env)**
```bash
REACT_APP_API_URL=http://localhost:4000
REACT_APP_APP_NAME=Trek Tribe
REACT_APP_VERSION=1.0.0
```

## 🔐 **SECURITY BEST PRACTICES**

### **Environment Variables**
- Use strong, unique secrets (32+ characters)
- Never commit `.env` files
- Use different secrets for development/production
- Rotate secrets regularly

### **Database Security**
- Use connection strings with authentication
- Enable SSL/TLS for production
- Use strong database passwords
- Limit database access by IP

### **Authentication**
- Use strong JWT secrets
- Set appropriate token expiration
- Implement proper session management
- Add rate limiting

### **File Security**
- Validate all file uploads
- Scan uploads for malware
- Limit file types and sizes
- Store uploads outside web root

## 🚫 **NEVER COMMIT**

- `.env` files
- Log files
- Upload directories
- Database files
- SSL certificates
- API keys
- Passwords
- Session data
- WhatsApp auth data

## ✅ **VERIFICATION STEPS**

1. **Check git status**: `git status`
2. **Verify .gitignore**: `git check-ignore .env`
3. **Search for secrets**: `grep -r "password\|secret\|key" --exclude-dir=node_modules .`
4. **Test environment**: Ensure app fails without proper env vars
5. **Review commits**: `git log --oneline` for sensitive commits

## 🔧 **TOOLS FOR SECURITY**

### **Secret Scanning**
```bash
# Install git-secrets
git secrets --install
git secrets --register-aws

# Scan repository
git secrets --scan
```

### **Environment Validation**
```bash
# Check required variables
node -e "require('dotenv').config(); console.log(process.env.JWT_SECRET ? 'OK' : 'MISSING')"
```

## 📞 **INCIDENT RESPONSE**

If secrets are accidentally committed:

1. **Immediately**:
   - Rotate all exposed secrets
   - Remove secrets from git history
   - Notify team members

2. **Git History Cleanup**:
   ```bash
   # Remove file from history
   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' --prune-empty --tag-name-filter cat -- --all
   
   # Force push (DANGEROUS - coordinate with team)
   git push origin --force --all
   ```

3. **Prevention**:
   - Enable branch protection
   - Use pre-commit hooks
   - Regular security audits
   - Team training

---

## ⚠️ **FINAL WARNING**

**DO NOT PUSH TO GITHUB** until all items in this checklist are completed. Exposing secrets can compromise your entire application and user data.

**Remember**: Security is not optional. Take the time to do it right.
