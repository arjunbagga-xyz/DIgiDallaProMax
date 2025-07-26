#!/bin/bash

echo "🚀 Setting up Instagram AI Automation System..."

# Create necessary directories
mkdir -p data logs generated-images generated-prompts training models/loras models/checkpoints

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set up environment file
if [ ! -f .env.local ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local with your API keys and credentials"
fi

# Download default Flux model (if ComfyUI is available)
if command -v python3 &> /dev/null; then
    echo "🤖 Checking for ComfyUI..."
    if [ -d "ComfyUI" ]; then
        echo "✅ ComfyUI found"
    else
        echo "📥 ComfyUI not found. To install:"
        echo "git clone https://github.com/comfyanonymous/ComfyUI.git"
        echo "cd ComfyUI && pip install -r requirements.txt"
    fi
fi

# Create default character
echo "👤 Creating default character configuration..."
cat > data/characters.json << 'EOF'
[
  {
    "id": "emma",
    "name": "Emma",
    "lora": "emma_v2.safetensors",
    "instagramAccount": "@emma_ai_life",
    "accessToken": "",
    "accountId": "",
    "backstory": "Travel blogger exploring hidden gems around the world",
    "narrative": [
      "Started as a city dweller who felt trapped in routine",
      "Discovered passion for travel through a spontaneous weekend trip",
      "Now documents authentic local experiences and hidden spots"
    ],
    "personality": ["adventurous", "curious", "authentic", "mindful", "optimistic"],
    "schedule": {
      "type": "interval",
      "value": "6h",
      "timezone": "UTC",
      "active": false
    },
    "lastPost": null,
    "nextPost": null,
    "stats": {
      "totalPosts": 0,
      "successRate": 0,
      "avgEngagement": 0
    }
  }
]
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your API keys"
echo "2. Configure characters in the web UI"
echo "3. Train character LoRAs (optional)"
echo "4. Start the system: npm run dev"
echo ""
echo "For local scheduling: npm run start:scheduler"
echo "For GitHub Actions: npm run deploy:github"
