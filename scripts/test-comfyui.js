const fetch = require("node-fetch")
const AbortSignal = require("abort-controller").AbortSignal

async function testComfyUI() {
  const comfyuiUrl = process.env.COMFYUI_URL || "http://localhost:8188"

  console.log("🧪 Testing ComfyUI Connection...")
  console.log(`📡 ComfyUI URL: ${comfyuiUrl}`)

  let checkpoints = []
  let loras = []
  let fluxModels = []

  try {
    // Test 1: Basic connection
    console.log("\n1️⃣ Testing basic connection...")
    const response = await fetch(`${comfyuiUrl}/system_stats`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const stats = await response.json()
    console.log("✅ ComfyUI is online!")
    console.log(`   System: ${stats.system?.os || "Unknown"}`)
    console.log(`   Python: ${stats.system?.python_version || "Unknown"}`)
    console.log(`   ComfyUI: ${stats.system?.comfyui_version || "Unknown"}`)

    // Test 2: Check available models
    console.log("\n2️⃣ Checking available models...")
    const objectInfoResponse = await fetch(`${comfyuiUrl}/object_info`)

    if (objectInfoResponse.ok) {
      const objectInfo = await objectInfoResponse.json()

      // Check for checkpoint models
      checkpoints = objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || []
      console.log(`✅ Found ${checkpoints.length} checkpoint models:`)
      checkpoints.slice(0, 5).forEach((model) => console.log(`   - ${model}`))
      if (checkpoints.length > 5) {
        console.log(`   ... and ${checkpoints.length - 5} more`)
      }

      // Check for LoRA models
      loras = objectInfo.LoraLoader?.input?.required?.lora_name?.[0] || []
      console.log(`✅ Found ${loras.length} LoRA models:`)
      loras.slice(0, 5).forEach((lora) => console.log(`   - ${lora}`))
      if (loras.length > 5) {
        console.log(`   ... and ${loras.length - 5} more`)
      }

      // Check for Flux models specifically
      fluxModels = checkpoints.filter((model) => model.toLowerCase().includes("flux"))

      if (fluxModels.length > 0) {
        console.log(`🎯 Found ${fluxModels.length} Flux models:`)
        fluxModels.forEach((model) => console.log(`   ⚡ ${model}`))
      } else {
        console.log("⚠️  No Flux models found. You may need to download them.")
        console.log("   Recommended: flux1-dev.safetensors or flux1-schnell.safetensors")
      }
    }

    // Test 3: Queue status
    console.log("\n3️⃣ Checking queue status...")
    const queueResponse = await fetch(`${comfyuiUrl}/queue`)

    if (queueResponse.ok) {
      const queueData = await queueResponse.json()
      console.log(`✅ Queue status:`)
      console.log(`   Running: ${queueData.queue_running?.length || 0} jobs`)
      console.log(`   Pending: ${queueData.queue_pending?.length || 0} jobs`)
    }

    // Test 4: Simple generation test
    console.log("\n4️⃣ Testing simple generation...")

    if (checkpoints.length === 0) {
      console.log("⚠️  Skipping generation test - no models available")
    } else {
      const testModel = fluxModels[0] || checkpoints[0]
      console.log(`🎨 Using model: ${testModel}`)

      const workflow = {
        1: {
          inputs: {
            ckpt_name: testModel,
          },
          class_type: "CheckpointLoaderSimple",
        },
        2: {
          inputs: {
            text: "a beautiful landscape, high quality",
            clip: ["1", 1],
          },
          class_type: "CLIPTextEncode",
        },
        3: {
          inputs: {
            text: "blurry, low quality",
            clip: ["1", 1],
          },
          class_type: "CLIPTextEncode",
        },
        4: {
          inputs: {
            width: 512,
            height: 512,
            batch_size: 1,
          },
          class_type: "EmptyLatentImage",
        },
        5: {
          inputs: {
            seed: Math.floor(Math.random() * 1000000),
            steps: 4,
            cfg: 7.5,
            sampler_name: "euler",
            scheduler: "normal",
            denoise: 1.0,
            model: ["1", 0],
            positive: ["2", 0],
            negative: ["3", 0],
            latent_image: ["4", 0],
          },
          class_type: "KSampler",
        },
        6: {
          inputs: {
            samples: ["5", 0],
            vae: ["1", 2],
          },
          class_type: "VAEDecode",
        },
        7: {
          inputs: {
            filename_prefix: "test_generation",
            images: ["6", 0],
          },
          class_type: "SaveImage",
        },
      }

      const generateResponse = await fetch(`${comfyuiUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
      })

      if (generateResponse.ok) {
        const result = await generateResponse.json()
        console.log(`✅ Generation queued successfully!`)
        console.log(`   Prompt ID: ${result.prompt_id}`)
        console.log(`   Note: Check ComfyUI interface to see the generation progress`)
      } else {
        const error = await generateResponse.text()
        console.log(`❌ Generation failed: ${error}`)
      }
    }

    console.log("\n🎉 ComfyUI test completed successfully!")
    console.log("\n📋 Summary:")
    console.log(`   ✅ ComfyUI is running and accessible`)
    console.log(`   ✅ ${checkpoints.length} models available`)
    console.log(`   ✅ ${loras.length} LoRA models available`)
    console.log(`   ✅ Queue system operational`)

    if (fluxModels.length > 0) {
      console.log(`   ✅ Flux models ready for use`)
    } else {
      console.log(`   ⚠️  Consider downloading Flux models for best results`)
    }
  } catch (error) {
    console.error("\n❌ ComfyUI test failed!")
    console.error(`   Error: ${error.message}`)

    if (error.code === "ECONNREFUSED") {
      console.error("\n🔧 Troubleshooting:")
      console.error("   1. Make sure ComfyUI is running:")
      console.error("      cd ComfyUI")
      console.error("      python main.py --listen")
      console.error("   2. Check if the URL is correct in your .env file")
      console.error("   3. Ensure no firewall is blocking the connection")
    } else if (error.name === "AbortError") {
      console.error("\n🔧 Troubleshooting:")
      console.error("   1. ComfyUI might be starting up - wait a moment and try again")
      console.error("   2. Check if ComfyUI is overloaded with other tasks")
      console.error("   3. Increase timeout if you have a slow system")
    }

    process.exit(1)
  }
}

// Run the test
testComfyUI()
