// Script to help set up local ComfyUI installation
console.log("🛠️  ComfyUI Setup Guide for Zero-Cost Instagram Bot")
console.log("=".repeat(60))

console.log(`
📋 SETUP CHECKLIST:

1. Install ComfyUI:
   git clone https://github.com/comfyanonymous/ComfyUI.git
   cd ComfyUI
   pip install -r requirements.txt

2. Download Flux.1-dev model:
   - Download from: https://huggingface.co/black-forest-labs/FLUX.1-dev
   - Place in: ComfyUI/models/checkpoints/

3. Install required custom nodes:
   cd ComfyUI/custom_nodes
   git clone https://github.com/ltdrdata/ComfyUI-Manager.git

4. Start ComfyUI:
   python main.py --listen 0.0.0.0 --port 8188

5. Train character LoRA (optional):
   - Use Kohya SS: https://github.com/kohya-ss/sd-scripts
   - Or use online trainers like CivitAI (free tier)

6. Set environment variables:
   COMFYUI_URL=http://localhost:8188
   CHARACTER_LORA=your_character_lora_name

🎯 BENEFITS OF LOCAL SETUP:
- ✅ Completely free (no API costs)
- ✅ Full control over generation
- ✅ Better character consistency with LoRA
- ✅ No rate limits
- ✅ Privacy (runs locally)

⚡ SYSTEM REQUIREMENTS:
- GPU: RTX 3060 or better (8GB+ VRAM recommended)
- RAM: 16GB+ system RAM
- Storage: 50GB+ free space for models

🔄 ALTERNATIVE: Use Hugging Face Inference API
- Free tier: 1000 requests/month
- No local setup required
- Good for testing and low-volume usage
`)

console.log("\n🚀 Ready to start your zero-cost Instagram automation!")
