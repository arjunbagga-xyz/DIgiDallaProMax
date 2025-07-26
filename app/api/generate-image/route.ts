import { type NextRequest, NextResponse } from "next/server"
import { comfyUI } from "@/lib/comfyui-complete"

export async function POST(request: NextRequest) {
  try {
    const { customPrompt, characterLora, fluxModel = "flux-dev", useComfyUI = true } = await request.json()

    if (!customPrompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    console.log(`🎨 Generating image with ${fluxModel}`)
    console.log(`🎯 Prompt: ${customPrompt}`)

    if (useComfyUI) {
      // Check if ComfyUI is available
      const isAvailable = await comfyUI.isAvailable()
      if (!isAvailable) {
        return NextResponse.json(
          {
            error: "ComfyUI is not available",
            suggestion: "Please start ComfyUI server or use Hugging Face fallback",
          },
          { status: 503 },
        )
      }

      // Get available models
      const models = await comfyUI.getModels()
      const availableModel = models.find((m) => m.name.includes(fluxModel) && m.type === "checkpoint")

      if (!availableModel) {
        return NextResponse.json(
          {
            error: `Model ${fluxModel} not found in ComfyUI`,
            availableModels: models.filter((m) => m.type === "checkpoint").map((m) => m.name),
          },
          { status: 400 },
        )
      }

      const base64Image = await comfyUI.generateImage({
        prompt: customPrompt,
        modelName: availableModel.name,
        loraName: characterLora,
        steps: fluxModel === "flux-schnell" ? 4 : 20,
        cfg: fluxModel === "flux-schnell" ? 1.0 : 7.5,
      })

      return NextResponse.json({
        success: true,
        image: base64Image,
        prompt: customPrompt,
        model: availableModel.name,
        method: "comfyui",
        timestamp: new Date().toISOString(),
      })
    } else {
      // Fallback to Hugging Face
      return await generateWithHuggingFace(customPrompt, fluxModel)
    }
  } catch (error) {
    console.error("Error generating image:", error)
    return NextResponse.json(
      {
        error: "Failed to generate image",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

async function generateWithHuggingFace(prompt: string, fluxModel: string) {
  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN

  if (!HF_TOKEN) {
    throw new Error("Hugging Face token not configured")
  }

  const models = {
    "flux-dev": "black-forest-labs/FLUX.1-dev",
    "flux-schnell": "black-forest-labs/FLUX.1-schnell",
    "flux-pro": "black-forest-labs/FLUX.1-pro",
  }

  const modelName = models[fluxModel]
  if (!modelName) {
    throw new Error(`Invalid model: ${fluxModel}`)
  }

  const response = await fetch(`https://api-inference.huggingface.co/models/${modelName}`, {
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
        num_inference_steps: fluxModel === "flux-schnell" ? 4 : 20,
        guidance_scale: fluxModel === "flux-schnell" ? 1.0 : 7.5,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Hugging Face API error: ${response.statusText} - ${errorText}`)
  }

  const imageBuffer = await response.arrayBuffer()
  const base64Image = Buffer.from(imageBuffer).toString("base64")

  return NextResponse.json({
    success: true,
    image: base64Image,
    prompt: prompt,
    model: modelName,
    method: "huggingface",
    timestamp: new Date().toISOString(),
  })
}
