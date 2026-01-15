# URGENT: Fix AP Rec UI - Manual Edit Required

## ✅ Step 1: Import added successfully
Line 16 in APReconciliation.tsx now has:
```tsx
import { MatchTypeBadge, MatchStatusBadge } from './APRecBadges';
```

## ⚠️ Step 2: Edit lines 1502-1515 manually

**Open:** `/components/devportal/workflows/APReconciliation.tsx`  
**Find lines 1502-1515:**

```tsx
                                    <td className="py-4 px-6">
                                       <Badge 
                                         variant="outline" 
                                         className={theme === 'premium-dark' ? 'bg-white/[0.05] text-white border-white/10' : 'bg-gray-50 text-gray-600 border-gray-200'}
                                       >
                                          <MatchTypeBadge 
                                           matchType={match.match_type}
                                           additionalTransactionsCount={match.additional_vendor_transactions?.length || 0}
                                         />
                                       </Badge>
                                     </td>
                                     <td className="py-4 px-6 text-sm text-gray-600">
                                       {match.match_confidence}%
                                     </td>
```

**Replace with:**

```tsx
                                    <td className="py-4 px-6">
                                       <MatchTypeBadge 
                                         matchType={match.match_type}
                                         additionalTransactionsCount={match.additional_vendor_transactions?.length || 0}
                                       />
                                     </td>
                                     <td className="py-4 px-6">
                                       <MatchStatusBadge 
                                         matchStatus={match.match_status}
                                         confidence={match.match_confidence}
                                       />
                                     </td>
```

## What This Does:

1. **Removes the wrapping Badge** (double-badge issue)
2. **Adds colored badges** via MatchTypeBadge component
   - exact → Purple
   - one_to_many → Green
   - many_to_one → Orange/Amber
   - fx_tolerance → Blue

3. **Adds status badges** via MatchStatusBadge component
   - "Review Required" (red) for low confidence
   - "Review" (yellow) for medium confidence
   - "✓" (green) for auto-approved

## Result:
Your AP Rec will look exactly like Bank Rec with colored badges and status indicators!

## Files Created:
- ✅ `/components/devportal/workflows/APRecBadges.tsx` - Badge components
- ✅ `/AP_REC_UI_UPGRADE_GUIDE.md` - Full documentation
- ✅ `/AP_REC_BADGE_PATCH.tsx` - Code snippet reference

##After making this ONE change, refresh your browser and you'll see colored badges!
