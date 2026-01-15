**QUICK FIX: Remove Double Badge in APReconciliation.tsx**

## Location: Line 1503-1511

**Find:**
```tsx
                                       <Badge 
                                         variant="outline" 
                                         className={theme === 'premium-dark' ? 'bg-white/[0.05] text-white border-white/10' : 'bg-gray-50 text-gray-600 border-gray-200'}
                                       >
                                          <MatchTypeBadge 
                                           matchType={match.match_type}
                                           additionalTransactionsCount={match.additional_vendor_transactions?.length || 0}
                                         />
                                       </Badge>
```

**Replace with:**
```tsx
                                       <MatchTypeBadge 
                                         matchType={match.match_type}
                                         additionalTransactionsCount={match.additional_vendor_transactions?.length || 0}
                                       />
```

## What to do:
1. Open `/components/devportal/workflows/APReconciliation.tsx`
2. Go to line 1503
3. Delete lines 1503-1506 (the `<Badge` opening tag)
4. Delete line 1511 (the `</Badge>` closing tag)
5. Fix the indentation of `<MatchTypeBadge` (remove the extra 2 spaces)

## Result:
Single badge with proper colors - no more double border!
