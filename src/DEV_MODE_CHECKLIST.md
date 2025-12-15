# ✅ Dev Mode Setup Checklist

## Initial Setup (First Time)

1. **Clear localStorage** (open Console and run):
   ```javascript
   localStorage.setItem('novalare_dev_mode', 'false');
   location.reload();
   ```

2. **Verify button is hidden:**
   - [ ] Check header - no "🔓 Dev Portal" button visible
   - [ ] Try accessing `/dev-portal` directly - should show "Access Denied"

## Activation Test

3. **Trigger password prompt** (choose one method):
   - [ ] **Method A:** Press `d` key 3 times quickly (within 1 second)
   - [ ] **Method B:** Click "Novalare" logo 3 times quickly (within 1 second)

4. **Verify password modal appears:**
   - [ ] Modal shows with orange/red gradient design
   - [ ] Lock icon visible
   - [ ] "Developer Access" title shown
   - [ ] Password input field focused

5. **Test wrong password:**
   - [ ] Enter: `wrongpassword`
   - [ ] Press Enter
   - [ ] Modal shakes
   - [ ] Toast shows: "❌ Access Denied"
   - [ ] Input clears automatically

6. **Test correct password:**
   - [ ] Enter: `novalare2024`
   - [ ] Press Enter
   - [ ] Modal closes
   - [ ] Toast shows: "🔓 Access Granted"
   - [ ] "🔓 Dev Portal" button appears in header (orange color)

7. **Verify Dev Portal access:**
   - [ ] Click "🔓 Dev Portal" button
   - [ ] Should navigate to `/dev-portal`
   - [ ] Dev Portal page loads successfully
   - [ ] Shows status cards, demo links, and roadmap

8. **Test persistence:**
   - [ ] Reload the page (F5)
   - [ ] "🔓 Dev Portal" button still visible (localStorage persists)

9. **Test deactivation:**
   - [ ] Press `d` 3 times again
   - [ ] Toast shows: "🔒 Developer Mode Disabled"
   - [ ] "🔓 Dev Portal" button disappears
   - [ ] Accessing `/dev-portal` now shows "Access Denied"

## Security Verification

10. **Simulate end user:**
    - [ ] Clear localStorage
    - [ ] Don't activate dev mode
    - [ ] Navigate site normally - no dev portal visible
    - [ ] Try `/dev-portal` URL - shows "Access Denied"

---

## All Systems Go? 🚀

If all checkboxes are ✅, your dev portal is properly secured!

**Next Steps:**
- Start building the Auth system
- Set up the database schema
- Create company management features

See `/pages/DevPortal.tsx` for the roadmap.
