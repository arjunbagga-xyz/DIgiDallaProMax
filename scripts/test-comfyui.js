// Test script to verify ComfyUI integration
const { comfyUI } = require("../lib/comfyui-complete")

async function testComfyUI() {
  console.log("🧪 Testing ComfyUI integration...")

  try {
    // Test availability
    const isAvailable = await comfyUI.isAvailable()
    console.log(`ComfyUI Available: ${isAvailable ? "✅" : "❌"}`)

    if (!isAvailable) {
      console.log("❌ ComfyUI is not running. Please start it with:")
      console.log("cd ComfyUI && python main.py --listen 0.0.0.0 --port 8188")
      return
    }

    // Test system stats
    const stats = await comfyUI.getSystemStats()
    console.log("📊 System Stats:", stats)

    // Test models
    const models = await comfyUI.getModels()
    console.log(`📦 Available Models: ${models.length}`)
    models.forEach((model) => {
      console.log(`  - ${model.name} (${model.type})`)
    })

    // Test generation (if models available)
    const fluxModel = models.find((m) => m.name.includes("flux") && m.type === "checkpoint")
    if (fluxModel) {
      console.log(`🎨 Testing generation with ${fluxModel.name}...`)

      const base64Image = await comfyUI.generateImage({
        prompt: "a beautiful landscape, high quality, detailed",
        modelName: fluxModel.name,
        steps: 4, // Quick test
        cfg: 1.0,
      })

      console.log(`✅ Generation successful! Image size: ${base64Image.length} characters`)
    } else {
      console.log("⚠️  No Flux models found for testing")
    }
  } catch (error) {
    console.error("❌ ComfyUI test failed:", error.message)
  }
}

testComfyUI()
