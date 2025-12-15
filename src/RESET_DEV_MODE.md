# 🔄 Reset Dev Mode

If the Dev Portal button is visible without authentication, it means `localStorage` has the dev mode flag set.

## Quick Reset

Open your browser's **Developer Console** (F12 or Cmd+Option+I) and run:

```javascript
localStorage.setItem('novalare_dev_mode', 'false');
location.reload();
```

Or simply:

```javascript
localStorage.clear();
location.reload();
```

## Verify Dev Mode is Off

After reloading, the Dev Portal button should be **hidden**.

To activate it again:
1. Press `d` key 3 times quickly
2. Enter password: `novalare2024`
3. Dev Portal button appears

---

## Troubleshooting

**Problem:** Dev Portal button still visible after reset  
**Solution:** Clear all browser cache and cookies, then reload

**Problem:** Password modal doesn't appear when pressing `d` 3 times  
**Solution:** Make sure you're pressing `d` within 1 second (quick succession)

**Problem:** Password doesn't work  
**Solution:** Check `/components/DevPasswordModal.tsx` line 13 for the current password

---

## Production Deployment Note

Before deploying to production, you may want to:

1. **Remove the hint** in the password modal (line 49-53 in `/components/DevPasswordModal.tsx`)
2. **Change the password** to something more secure
3. **Clear localStorage** on all test devices

This ensures end users can't accidentally discover the dev portal.
