#!/bin/bash

echo "=========================================="
echo "🚀 Starting Server (No Proxy Mode)"
echo "=========================================="
echo ""

# Disable all proxy environment variables
echo "🚫 Disabling proxy variables..."
unset HTTP_PROXY
unset HTTPS_PROXY
unset http_proxy
unset https_proxy
unset ALL_PROXY
unset all_proxy
unset NO_PROXY
unset no_proxy

echo "✅ Proxies disabled"
echo ""

# Check for OpenAI API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ ERROR: OPENAI_API_KEY not set"
    echo ""
    echo "Set it with:"
    echo "  export OPENAI_API_KEY='your-key-here'"
    echo ""
    exit 1
fi

echo "✅ OPENAI_API_KEY found: ${OPENAI_API_KEY:0:10}..."
echo ""

# Check Python version
PYTHON_VERSION=$(python3 --version)
echo "Python: $PYTHON_VERSION"
echo ""

# Check OpenAI SDK version
OPENAI_VERSION=$(pip show openai 2>/dev/null | grep Version | awk '{print $2}')
if [ -z "$OPENAI_VERSION" ]; then
    echo "⚠️  OpenAI SDK not installed"
    echo "Installing..."
    pip install openai
else
    echo "✅ OpenAI SDK: $OPENAI_VERSION"
fi
echo ""

# Start server
echo "=========================================="
echo "🚀 Starting Flask Server"
echo "=========================================="
echo ""

python3 app.py
