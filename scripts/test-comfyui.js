// Test script for ComfyUI connection and functionality
const { comfyUI } = require("../lib/comfyui-complete")

async function testComfyUI() {
  console.log("🧪 Testing ComfyUI Connection...")

  try {
    // Test 1: Check if ComfyUI is available
    console.log("1. Checking ComfyUI availability...")
    const isAvailable = await comfyUI.isAvailable()

    if (!isAvailable) {
      console.log("❌ ComfyUI is not available")
      console.log("💡 Make sure ComfyUI is running on http://localhost:8188")
      console.log("💡 Start ComfyUI with: python main.py --listen")
      return
    }

    console.log("✅ ComfyUI is available")

    // Test 2: Get system stats
    console.log("2. Getting system stats...")
    const stats = await comfyUI.getSystemStats()
    console.log("📊 System Stats:", {
      system: stats.system,
      devices: stats.devices?.map((d) => ({ name: d.name, type: d.type, vram_total: d.vram_total })),
    })

    // Test 3: Get available models
    console.log("3. Getting available models...")
    const models = await comfyUI.getModels()
    console.log("🎨 Available Models:")

    const checkpoints = models.filter((m) => m.type === "checkpoint")
    const loras = models.filter((m) => m.type === "lora")

    console.log(`   Checkpoints (${checkpoints.length}):`)
    checkpoints.slice(0, 5).forEach((model) => {
      console.log(`     - ${model.name}`)
    })
    if (checkpoints.length > 5) {
      console.log(`     ... and ${checkpoints.length - 5} more`)
    }

    console.log(`   LoRAs (${loras.length}):`)
    loras.slice(0, 5).forEach((model) => {
      console.log(`     - ${model.name}`)
    })
    if (loras.length > 5) {
      console.log(`     ... and ${loras.length - 5} more`)
    }

    // Test 4: Check for Flux models
    console.log("4. Checking for Flux models...")
    const fluxModels = checkpoints.filter(
      (m) =>
        m.name.toLowerCase().includes("flux") ||
        m.name.toLowerCase().includes("dev") ||
        m.name.toLowerCase().includes("schnell"),
    )

    if (fluxModels.length === 0) {
      console.log("⚠️  No Flux models found")
      console.log("💡 Download Flux models to ComfyUI/models/checkpoints/")
      console.log("💡 Recommended: FLUX.1-dev.safetensors")
    } else {
      console.log("✅ Flux models found:")
      fluxModels.forEach((model) => {
        console.log(`     - ${model.name}`)
      })
    }

    // Test 5: Test image generation (if models available)
    if (fluxModels.length > 0) {
      console.log("5. Testing image generation...")
      console.log("⏳ This may take a few minutes...")

      try {
        const testPrompt = "a simple red apple on a white background, photorealistic, high quality"
        const startTime = Date.now()

        const base64Image = await comfyUI.generateImage({
          prompt: testPrompt,
          modelName: fluxModels[0].name,
          steps: 4, // Quick test
          cfg: 1.0,
          width: 512,
          height: 512,
        })

        const duration = (Date.now() - startTime) / 1000
        console.log(`✅ Image generated successfully in ${duration}s`)
        console.log(`📏 Image size: ${Math.round(base64Image.length * 0.75)} bytes`)

        // Save test image
        const fs = require("fs")
        const path = require("path")

        const outputDir = path.join(process.cwd(), "test-output")
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true })
        }

        const imagePath = path.join(outputDir, `comfyui-test-${Date.now()}.png`)
        fs.writeFileSync(imagePath, Buffer.from(base64Image, "base64"))
        console.log(`💾 Test image saved: ${imagePath}`)
      } catch (genError) {
        console.log("❌ Image generation failed:", genError.message)
        console.log("💡 Check ComfyUI console for detailed error messages")
      }
    }

    // Test 6: Queue status
    console.log("6. Checking queue status...")
    const queueStatus = await comfyUI.getQueueStatus()
    console.log("📋 Queue Status:", {
      running: queueStatus.queue_running?.length || 0,
      pending: queueStatus.queue_pending?.length || 0,
    })

    console.log("\n🎉 ComfyUI test completed successfully!")
    console.log("💡 Your ComfyUI setup is ready for the Instagram automation system")
  } catch (error) {
    console.error("❌ ComfyUI test failed:", error.message)
    console.log("\n🔧 Troubleshooting:")
    console.log("1. Make sure ComfyUI is running: python main.py --listen")
    console.log("2. Check if port 8188 is accessible")
    console.log("3. Verify ComfyUI installation is complete")
    console.log("4. Check ComfyUI console for error messages")
  }
}

// Run the test
testComfyUI()
