#!/bin/bash

# Test Template Loader

echo "=========================================="
echo "Testing Template Loader"
echo "=========================================="

cd "$(dirname "$0")"

echo ""
echo "🧪 Running template_loader.py..."
python3 template_loader.py

echo ""
echo "=========================================="
echo "✅ Template loader test complete!"
echo "=========================================="
