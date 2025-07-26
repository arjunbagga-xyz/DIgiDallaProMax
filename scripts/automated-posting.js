// Automated posting script for GitHub Actions
const fetch = require("node-fetch")
const fs = require("fs").promises

// Configuration
const FLUX_MODEL = process.env.FLUX_MODEL || "flux-dev" // flux-dev, flux-schnell, or flux-pro

async function runAutomation() {
  try {
    console.log("🤖 Starting Instagram AI Character Bot automation...")
    console.log(`🎨 Using model: ${FLUX_MODEL.toUpperCase()}`)

    // Generate image using selected Flux model
    console.log("🎨 Generating image...")

    const generateResponse = await generateImageWithModel(FLUX_MODEL)

    if (!generateResponse.success) {
      throw new Error("Image generation failed")
    }

    console.log("✅ Image generated successfully!")
    console.log(`📊 Model used: ${generateResponse.model}`)

    // Save image locally as backup
    await fs.mkdir("generated-images", { recursive: true })
    await fs.writeFile(
      `generated-images/image-${FLUX_MODEL}-${Date.now()}.png`,
      Buffer.from(generateResponse.image, "base64"),
    )

    // Attempt to post to Instagram
    console.log("📱 Attempting to post to Instagram...")

    try {
      const postResponse = await postToInstagram(generateResponse.image, generateResponse.prompt)

      if (postResponse.method === "graph_api") {
        console.log("🎉 Successfully posted to Instagram!")
        console.log("Post ID:", postResponse.postId)
      } else {
        console.log("💾 Image saved for manual posting")
        console.log("Instructions:", postResponse.data.instructions)

        // Save caption for manual use
        await fs.writeFile(`generated-images/caption-${Date.now()}.txt`, postResponse.data.caption)
      }
    } catch (postError) {
      console.log("⚠️  Posting failed, image saved for manual upload")
      console.log("Error:", postError.message)
    }

    console.log("✨ Automation completed!")
  } catch (error) {
    console.error("❌ Automation failed:", error)
    process.exit(1)
  }
}

async function generateImageWithModel(fluxModel) {
  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN

  if (!HF_TOKEN) {
    throw new Error("HUGGINGFACE_TOKEN not configured")
  }

  // Model configurations
  const models = {
    "flux-dev": {
      model: "black-forest-labs/FLUX.1-dev",
      steps: 20,
      guidance: 7.5,
    },
    "flux-schnell": {
      model: "black-forest-labs/FLUX.1-schnell",
      steps: 4,
      guidance: 1.0,
    },
    "flux-pro": {
      model: "black-forest-labs/FLUX.1-pro",
      steps: 25,
      guidance: 8.0,
    },
  }

  const modelConfig = models[fluxModel]
  if (!modelConfig) {
    throw new Error(`Invalid model: ${fluxModel}`)
  }

  const prompt = getRandomPrompt()

  console.log(`🎯 Model: ${modelConfig.model}`)
  console.log(`🎯 Prompt: ${prompt}`)

  const response = await fetch(`https://api-inference.huggingface.co/models/${modelConfig.model}`, {
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        width: 1024,
        height: 1024,
        num_inference_steps: modelConfig.steps,
        guidance_scale: modelConfig.guidance,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Hugging Face API error: ${response.statusText} - ${errorText}`)
  }

  const imageBuffer = await response.arrayBuffer()
  const base64Image = Buffer.from(imageBuffer).toString("base64")

  return {
    success: true,
    image: base64Image,
    prompt: prompt,
    model: modelConfig.model,
    timestamp: new Date().toISOString(),
  }
}

function getRandomPrompt() {
  const prompts = [
    "person enjoying morning coffee at a cozy café, warm lighting, candid moment, detailed face, consistent character",
    "person reading a book in a comfortable armchair by a window, soft natural light, same person, recognizable individual",
    "person hiking on a mountain trail, backpack, scenic landscape background, maintaining facial features",
    "person cooking in a modern kitchen, focused expression, steam rising from pan, character reference",
    "person painting on an easel in an art studio, brushes and palette visible, consistent appearance",
    "person walking on a beach at sunset, waves in background, peaceful mood, detailed face",
    "person at a farmers market, examining fresh produce, bustling background, same person",
    "person working on laptop in a trendy coffee shop, concentrated, urban setting, recognizable individual",
  ]

  let selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)]

  // Add LoRA trigger if available
  if (process.env.CHARACTER_LORA) {
    selectedPrompt += `, <lora:${process.env.CHARACTER_LORA}:0.8>`
  }

  return selectedPrompt
}

async function postToInstagram(base64Image, prompt) {
  // This will use the API endpoint we created
  const response = await fetch(`${process.env.DEPLOYMENT_URL || "http://localhost:3000"}/api/post-to-instagram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageBase64: base64Image,
      caption: `${prompt} ✨\n\n#OpenSourceAI #FluxAI #GeneratedArt #AICharacter #${FLUX_MODEL.replace("-", "").toUpperCase()}`,
    }),
  })

  return await response.json()
}

// Run the automation
runAutomation()
