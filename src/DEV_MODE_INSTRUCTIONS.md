# 🔓 Developer Mode - Secret Access

This document explains how to access the hidden Developer Portal on the Novalare website.

## 🔑 Password

**Password:** `novalare2024`

_(You can change this in `/components/DevPasswordModal.tsx` line 13)_

## How to Activate Dev Mode

You have **2 ways** to trigger the password prompt:

### Method 1: Keyboard Shortcut ⌨️
1. Go to the Novalare homepage
2. Press the **"d"** key **3 times quickly** (within 1 second)
3. A password modal will appear
4. Enter: `novalare2024`
5. You'll see a toast notification: "🔓 Access Granted"
6. A "🔓 Dev Portal" button will appear in the header

### Method 2: Logo Click 🖱️
1. Go to the Novalare homepage
2. Click the **"Novalare" logo 3 times quickly** (within 1 second)
3. A password modal will appear
4. Enter: `novalare2024`
5. You'll see a toast notification: "🔓 Access Granted"
6. A "🔓 Dev Portal" button will appear in the header

## Persistence

- Dev mode is saved in **localStorage**
- It will **persist across page reloads** and browser sessions
- You don't need to re-activate it every time you visit the site

## How to Disable Dev Mode

You have **3 ways** to disable it:

1. **Press "d" 3 times again** - toggles dev mode off
2. **Click logo 3 times again** - toggles dev mode off
3. **Click "🔒 Disable Dev Mode" button** in the Dev Portal page
4. **Clear localStorage** in browser dev tools

## What's in the Dev Portal?

The Dev Portal (`/dev-portal`) is your central hub for:

- **Status overview** of what's been built vs. what needs to be built
- **Quick access** to all demo pages (Invoice, Bank Rec, AP Rec, Expense)
- **Next steps roadmap** for building the production SaaS
- **Architecture guidance** on multi-tenancy, database schema, etc.

## Why This Approach?

- ✅ **Completely hidden** from regular users
- ✅ **No risk of accidental discovery** (no visible UI hints)
- ✅ **Easy for you to access** (just press "d" 3 times or click logo)
- ✅ **Persistent** across sessions (stored in localStorage)
- ✅ **Clean** - no need to remember URLs or passwords

## Next Steps

From the Dev Portal, you can start building:
1. Database schema (firms, users, companies, documents)
2. Authentication flow
3. Company management UI
4. Production workflows (scoped to companies)
5. Billing & plan limits

---

**Note:** The Dev Portal route (`/dev-portal`) is technically accessible to anyone who knows the URL, but without the header button, it's essentially invisible. If you want stronger protection later, you can add authentication checks to the route itself.