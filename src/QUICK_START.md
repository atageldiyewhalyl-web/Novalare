# 🚀 Quick Start - Developer Access

## How to Access Dev Portal

### Step 1: Trigger Password Prompt
**Option A:** Press `d` key 3 times quickly  
**Option B:** Click "Novalare" logo 3 times quickly

### Step 2: Enter Password
Type: `novalare2024`

### Step 3: Access Granted ✅
- Toast notification appears: "🔓 Access Granted"
- Orange "🔓 Dev Portal" button appears in header
- Click it to access `/dev-portal`

---

## 🔐 Security Features

✅ **Hidden trigger** - No visible UI clues  
✅ **Password protected** - Requires `novalare2024`  
✅ **Route protected** - `/dev-portal` checks localStorage before rendering  
✅ **Access denied page** - Shows if someone tries to access URL directly  
✅ **Persistent** - Stays active via localStorage  
✅ **Easy disable** - Press `d` 3x again to turn off  

---

## 🚫 What Happens Without Auth?

If someone tries to access `/dev-portal` directly:
1. ⏳ Shows "Verifying access..." loading screen (500ms)
2. 🔒 Shows "Access Denied" page with lock icon
3. 💡 Gives hint: "Try pressing 'd' three times on homepage"
4. ↩️ Button to return to homepage

---

## 📝 Change Password

Edit line 13 in `/components/DevPasswordModal.tsx`:

```typescript
const SECRET_PASSWORD = 'novalare2024'; // Change this
```

---

## 🎯 What's Next?

From the Dev Portal, you'll build:

1. **Auth System** - Supabase Auth + multi-tenant setup
2. **Database Schema** - Firms → Users → Companies → Documents
3. **Company Management** - Create/manage client companies
4. **Workflows** - Migrate demos to production (company-scoped)
5. **Billing** - Per-company pricing enforcement

The Dev Portal gives you a roadmap and links to all existing demos!

---

## 🗂️ File Structure

```
/pages/DevPortal.tsx              ← Main dev portal page
/components/DevPasswordModal.tsx  ← Password prompt UI
/components/Header.tsx            ← Secret trigger logic
/DEV_MODE_INSTRUCTIONS.md         ← Detailed instructions
```

---

**Ready to build? Press `d` three times! 🚀**