# 3-Tier Architecture - Action Plan

## **The Plan You Approved:**

### **TIER 1: Templates (Known Banks + User-Learned)**
- Hardcoded: Chase, BoA, Capital One, Citi, Wells Fargo
- User-learned schemas saved in JSON file
- **Fast, free, 100% accurate**

### **TIER 2: AI Discovery with Retry Logic**
- Remove hardcoded positions from prompt
- 2-3 retry attempts with validation
- If extracts valid sample transactions → use schema
- **Costs $0.02-0.06 per unknown bank (one-time)**

### **TIER 3: User Manual Mapping**
- User clicks on 2-3 sample transactions
- System learns column positions
- Saves for future use
- **One-time effort per bank format**

---

## **Immediate Next Steps (Choose One)**

### **Option A: Fix Capital One Template First (15 min)**
**What:** Add correct Capital One template based on your screenshot

**Why:** Gets Capital One working TODAY while we fix AI

**How:**
1. I'll create correct template with amount at x=660, balance at x=800
2. You test Capital One statement
3. Should extract 30+ transactions immediately

**Risk:** Only fixes Capital One, not scalable

---

### **Option B: Fix AI Prompt First (45 min)**
**What:** Remove hardcoded positions, add retry logic, add validation

**Why:** Fixes root cause - makes AI work for ALL unknown banks

**How:**
1. Update `discover_layout_with_ai()` function (remove biased examples)
2. Add retry logic (3 attempts)
3. Add schema validation
4. Test on Capital One

**Risk:** Might still not work for Capital One (GPT-4 Vision limitation)

---

### **Option C: Do Both (1 hour)**
**What:** Fix Capital One template AND fix AI

**Why:** Capital One works immediately + unknown banks work via AI

**How:**
1. First 15 min: Fix Capital One template (quick win)
2. Next 45 min: Fix AI discovery (long-term solution)
3. Test both

**Risk:** None - best of both worlds

---

## **My Recommendation: Option C (Do Both)**

**Timeline:**
- **Now:** I fix Capital One template → You test → Works immediately
- **Next:** I fix AI discovery → You test on unknown bank → AI works better
- **Later:** We implement Tier 3 (user mapping) if AI still struggles

**Result:**
- Capital One: ✅ Works via template (today)
- Chase: ✅ Works via template (already working)
- Deutsche Bank: ✅ Works via AI (already working)
- Unknown banks: ✅ Works via improved AI (after we fix prompt)
- Weird banks: ✅ Works via user mapping (future)

---

## **What Do You Want Me to Do Right Now?**

**Pick one:**

**A)** Fix Capital One template only (15 min, quick win)
**B)** Fix AI discovery only (45 min, long-term fix)
**C)** Do both (1 hour, best approach)
**D)** Something else (tell me what)

**I'm ready to start coding as soon as you decide!** 🚀
