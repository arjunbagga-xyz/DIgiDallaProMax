import { type NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

interface Character {
  id: string
  name: string
  personality: string
  backstory: string
  loraModelPath?: string
}

async function loadCharacters(): Promise<Character[]> {
  try {
    const data = await readFile(join(process.cwd(), "data", "characters.json"), "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function generatePrompt(character: Character): Promise<string> {
  // Generate contextual prompt using Gemini
  try {
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenerativeAI } = await import("@google/generative-ai")
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: "gemini-pro" })

      const promptContext = `
        Character: ${character.name}
        Personality: ${character.personality}
        Backstory: ${character.backstory}
        
        Generate a creative, engaging prompt for an AI image generator that captures this character's essence.
        The prompt should be detailed, cinematic, and suitable for social media.
        Include visual style, mood, and setting. Keep it under 200 characters.
      `

      const result = await model.generateContent(promptContext)
      const response = await result.response
      return response.text()
    }
  } catch (error) {
    console.error("Failed to generate prompt with Gemini:", error)
  }

  // Fallback prompt generation
  const styles = ["cinematic", "portrait", "artistic", "dramatic", "ethereal"]
  const settings = ["urban landscape", "mystical forest", "modern studio", "natural environment", "cosmic background"]
  const moods = ["confident", "mysterious", "serene", "dynamic", "contemplative"]

  const style = styles[Math.floor(Math.random() * styles.length)]
  const setting = settings[Math.floor(Math.random() * settings.length)]
  const mood = moods[Math.floor(Math.random() * moods.length)]

  return `${character.name}, ${character.personality}, ${mood} expression, ${style} style, ${setting}, high quality, detailed, professional photography`
}

async function generateWithComfyUI(prompt: string, character: Character): Promise<string> {
  const comfyuiUrl = process.env.COMFYUI_URL || "http://localhost:8188"

  // Basic ComfyUI workflow for Flux
  const workflow = {
    "1": {
      inputs: {
        ckpt_name: "flux1-dev.safetensors",
      },
      class_type: "CheckpointLoaderSimple",
    },
    "2": {
      inputs: {
        text: prompt,
        clip: ["1", 1],
      },
      class_type: "CLIPTextEncode",
    },
    "3": {
      inputs: {
        text: "blurry, low quality, distorted",
        clip: ["1", 1],
      },
      class_type: "CLIPTextEncode",
    },
    "4": {
      inputs: {
        width: 1024,
        height: 1024,
        batch_size: 1,
      },
      class_type: "EmptyLatentImage",
    },
    "5": {
      inputs: {
        seed: Math.floor(Math.random() * 1000000),
        steps: 20,
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
    "6": {
      inputs: {
        samples: ["5", 0],
        vae: ["1", 2],
      },
      class_type: "VAEDecode",
    },
    "7": {
      inputs: {
        filename_prefix: "flux_generation",
        images: ["6", 0],
      },
      class_type: "SaveImage",
    },
  }

  // Queue the workflow
  const queueResponse = await fetch(`${comfyuiUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  })

  if (!queueResponse.ok) {
    throw new Error(`ComfyUI queue failed: ${queueResponse.statusText}`)
  }

  const queueResult = await queueResponse.json()
  const promptId = queueResult.prompt_id

  // Poll for completion
  let attempts = 0
  const maxAttempts = 60 // 5 minutes max

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds

    const historyResponse = await fetch(`${comfyuiUrl}/history/${promptId}`)

    if (historyResponse.ok) {
      const history = await historyResponse.json()

      if (history[promptId] && history[promptId].outputs) {
        const outputs = history[promptId].outputs

        if (outputs["7"] && outputs["7"].images && outputs["7"].images.length > 0) {
          const imageInfo = outputs["7"].images[0]

          // Download the generated image
          const imageResponse = await fetch(
            `${comfyuiUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder}&type=${imageInfo.type}`,
          )

          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer()
            return Buffer.from(imageBuffer).toString("base64")
          }
        }
      }
    }

    attempts++
  }

  throw new Error("ComfyUI generation timed out")
}

export async function POST(request: NextRequest) {
  try {
    const { characterId } = await request.json()

    if (!characterId) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 })
    }

    const characters = await loadCharacters()
    const character = characters.find((c) => c.id === characterId)

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 })
    }

    // Generate prompt
    const prompt = await generatePrompt(character)
    console.log(`Generated prompt for ${character.name}: ${prompt}`)

    // Generate image
    let imageBase64: string

    try {
      // Try ComfyUI first
      imageBase64 = await generateWithComfyUI(prompt, character)
      console.log("✅ Image generated with ComfyUI")
    } catch (comfyError) {
      console.error("ComfyUI generation failed:", comfyError)

      // Fallback: Return a placeholder or error
      return NextResponse.json(
        {
          error: "Image generation failed",
          details:
            "ComfyUI is not available. Please ensure ComfyUI is running on " +
            (process.env.COMFYUI_URL || "http://localhost:8188"),
          prompt,
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      success: true,
      prompt,
      image: imageBase64,
      character: character.name,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Image generation error:", error)
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 })
  }
}
