#!/usr/bin/env python3
"""
Quick test script to verify OpenAI API key works.
Run this on Render or locally to debug the empty response issue.
"""

import os
import sys
from openai import OpenAI

def test_openai_api():
    """Test OpenAI API key with a simple request."""
    
    print("🔍 Testing OpenAI API Key...")
    print("=" * 60)
    
    # Check if API key exists
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        print("❌ OPENAI_API_KEY environment variable not set!")
        print("   Set it with: export OPENAI_API_KEY='sk-proj-...'")
        return False
    
    print(f"✅ API Key found: {api_key[:15]}...{api_key[-4:]}")
    print()
    
    # Test 1: List models (check API key is valid)
    print("Test 1: Listing available models...")
    try:
        client = OpenAI(api_key=api_key)
        models = client.models.list()
        model_ids = [m.id for m in models.data]
        
        print(f"✅ API key is valid! Found {len(model_ids)} models")
        
        # Check for GPT-4 Vision models
        gpt4_models = [m for m in model_ids if 'gpt-4' in m]
        if gpt4_models:
            print(f"✅ GPT-4 models available: {', '.join(gpt4_models[:5])}")
        else:
            print("⚠️  No GPT-4 models found - you may not have access")
        
        # Check for gpt-4o specifically
        if 'gpt-4o' in model_ids:
            print("✅ gpt-4o is available!")
        else:
            print("❌ gpt-4o is NOT available - check your API tier")
            print("   Available GPT-4 models:", gpt4_models)
        
    except Exception as e:
        print(f"❌ Failed to list models: {e}")
        return False
    
    print()
    
    # Test 2: Simple completion (check quota)
    print("Test 2: Testing simple chat completion...")
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # Use cheaper model for test
            messages=[{"role": "user", "content": "Say 'API test successful'"}],
            max_tokens=10
        )
        
        content = response.choices[0].message.content
        print(f"✅ Chat completion successful!")
        print(f"   Response: {content}")
        print(f"   Finish reason: {response.choices[0].finish_reason}")
        print(f"   Tokens used: {response.usage.total_tokens}")
        
    except Exception as e:
        print(f"❌ Chat completion failed: {e}")
        if "quota" in str(e).lower():
            print("   💡 Looks like a quota issue - check platform.openai.com/usage")
        elif "rate" in str(e).lower():
            print("   💡 Rate limit exceeded - wait a moment and try again")
        return False
    
    print()
    
    # Test 3: Vision test (check GPT-4 Vision access)
    print("Test 3: Testing GPT-4 Vision (with small image)...")
    try:
        # Create a tiny test image (1x1 red pixel)
        import base64
        tiny_image = base64.b64encode(
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        ).decode()
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "What color is this image? Reply in 3 words."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{tiny_image}"
                        }
                    }
                ]
            }],
            max_tokens=10
        )
        
        content = response.choices[0].message.content
        print(f"✅ GPT-4 Vision test successful!")
        print(f"   Response: {content}")
        print(f"   Finish reason: {response.choices[0].finish_reason}")
        
        # Check if response is empty (the actual bug!)
        if not content or content.strip() == "":
            print("❌ WARNING: Response is empty! This is the bug we're seeing.")
            print("   Finish reason:", response.choices[0].finish_reason)
            print("   Usage:", response.usage)
            return False
        
    except Exception as e:
        print(f"❌ GPT-4 Vision test failed: {e}")
        if "model" in str(e).lower():
            print("   💡 You may not have access to GPT-4 Vision (gpt-4o)")
            print("   💡 Check your OpenAI tier at platform.openai.com/account/limits")
        return False
    
    print()
    print("=" * 60)
    print("🎉 All tests passed! Your OpenAI API key is working correctly.")
    print()
    print("Next steps:")
    print("1. If app.py still fails, check the image size being sent")
    print("2. Check Render logs for the full error message")
    print("3. Verify OPENAI_API_KEY is set correctly in Render environment")
    
    return True

if __name__ == "__main__":
    success = test_openai_api()
    sys.exit(0 if success else 1)
