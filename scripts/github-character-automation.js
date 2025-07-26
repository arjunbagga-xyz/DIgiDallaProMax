// GitHub Actions automation script for character-specific image generation
const fetch = require("node-fetch")
const fs = require("fs").promises

async function runCharacterAutomation() {
  const startTime = Date.now()

  try {
    const characterName = process.env.CHARACTER_NAME
    const imagePrompt = process.env.IMAGE_PROMPT
    const fluxModel = process.env.FLUX_MODEL || "flux-dev"

    console.log(`🤖 Starting automation for ${characterName}`)
    console.log(`🎨 Using model: ${fluxModel}`)
    console.log(`🎯 Prompt: ${imagePrompt}`)

    // Generate image using Hugging Face
    const imageData = await generateImage(imagePrompt, fluxModel)

    // Save image
    await saveImage(characterName, imageData)

    const totalTime = (Date.now() - startTime) / 1000
    console.log(`✅ Character automation completed in ${totalTime}s`)

    // Export image data for next step
    await fs.appendFile(process.env.GITHUB_ENV, `IMAGE_BASE64=${imageData.image}\n`)
    await fs.appendFile(process.env.GITHUB_ENV, `GENERATION_MODEL=${imageData.model}\n`)
  } catch (error) {
    console.error("❌ Character automation failed:", error)
    process.exit(1)
  }
}

async function generateImage(prompt, model) {
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

  const modelConfig = models[model]
  if (!modelConfig) {
    throw new Error(`Invalid model: ${model}`)
  }

  console.log(`🎨 Generating with ${modelConfig.model}...`)

  const response = await fetch(`https://api-inference.huggingface.co/models/${modelConfig.model}`, {
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
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
    throw new Error(`Image generation failed: ${response.statusText} - ${errorText}`)
  }

  const imageBuffer = await response.arrayBuffer()
  const base64Image = Buffer.from(imageBuffer).toString("base64")

  return {
    image: base64Image,
    model: modelConfig.model,
    prompt: prompt,
    timestamp: new Date().toISOString(),
  }
}

async function saveImage(characterName, imageData) {
  const imageDir = `generated-images/${characterName}`
  await fs.mkdir(imageDir, { recursive: true })

  const filename = `image-${Date.now()}.png`
  const filepath = `${imageDir}/${filename}`

  await fs.writeFile(filepath, Buffer.from(imageData.image, "base64"))

  // Save metadata
  const metadataFile = filepath.replace(".png", ".json")
  await fs.writeFile(metadataFile, JSON.stringify(imageData, null, 2))

  console.log(`💾 Image saved: ${filepath}`)
}

// Run the automation
runCharacterAutomation()
