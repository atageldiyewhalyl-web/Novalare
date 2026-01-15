# User-Learned Templates (Tier 3)

This directory stores bank templates that users create through the **Manual Mapping** interface (Tier 3).

## How It Works

1. **User uploads unknown bank statement** → AI fails (Tier 2)
2. **System prompts**: "Click on 2-3 sample transactions to teach the system"
3. **User clicks** → System learns column positions
4. **System saves** → Template saved to this directory
5. **Next upload** → Uses learned template instantly (Tier 1)!

## Template Format

User-learned templates follow the same JSON format as built-in templates:

```json
{
  "bank_key": "my_credit_union",
  "bank_name": "My Local Credit Union",
  "version": "1.0",
  "created_by": "user",
  "user_id": "user_12345",
  "last_updated": "2024-12-22",
  "learned_from_file": "statement_2024_12.pdf",
  
  "statement_model": "running_balance",
  "currency": "USD",
  
  "columns": {
    "date": {"x_min": 45, "x_max": 95},
    "description": {"x_min": 100, "x_max": 400},
    "amount": {"x_min": 405, "x_max": 480},
    "balance": {"x_min": 485, "x_max": 560}
  },
  
  "transaction_start_markers": ["Date", "Description"],
  "date_format": "MM/DD/YYYY",
  "has_balance_column": true,
  "multiline_descriptions": false,
  "detection_keywords": ["my credit union"]
}
```

## Priority

User-learned templates have **priority over built-in templates**:
- If both exist, use user-learned (more specific)
- Users can override built-in templates
- Users can share templates with team

## Future Features

- [ ] Template versioning
- [ ] Template sharing (export/import)
- [ ] Template marketplace (community templates)
- [ ] Auto-update templates from usage patterns
- [ ] A/B testing (user template vs built-in)

## Storage

Templates are stored as JSON files:
- **Filename**: `{bank_key}.json` (e.g., `wells_fargo.json`)
- **Created**: When user completes manual mapping
- **Updated**: When user re-maps or system suggests improvements
- **Deleted**: Never (archived instead)

---

**This directory is ready for Tier 3 implementation!** 🚀
