import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { comfyUIClient } from "@/lib/comfyui"
import { promises as fs } from "fs"
import path from "path"

const contentFilePath = path.join(process.cwd(), "data", "content.json")

async function getContent() {
  try {
    const data = await fs.readFile(contentFilePath, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    if (error.code === "ENOENT") {
      return []
    }
    throw error
  }
}

async function saveContent(content: any) {
  await fs.writeFile(contentFilePath, JSON.stringify(content, null, 2))
}

export async function POST(req: Request) {
  try {
    const { character, apiKey } = await req.json()

    if (!character || !apiKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    // Step 1: Generate a dynamic prompt
    const promptModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" })
    const promptGenerationPrompt = `
      You are an AI assistant for a social media automation tool.
      Your task is to generate a creative and engaging image generation prompt for the following character.
      The prompt should be diverse and reflect the character's personality, backstory, and current narrative.
      Provide the output as a single string.

      **Character Details:**
      - Name: ${character.name}
      - Personality: ${character.personality}
      - Backstory: ${character.backstory}
      - Current Narrative: ${character.narratives?.[0]?.description || "No active narrative."}

      **Instructions:**
      1. Generate a single, unique prompt suitable for a text-to-image model.
      2. Do not include any other text or commentary in your response.
    `
    const promptResult = await promptModel.generateContent(promptGenerationPrompt)
    const dynamicPrompt = (await promptResult.response.text()).trim()

    // Step 2: Generate the image using the dynamic prompt
    const imageResult = await comfyUIClient.generateImage({
      prompt: dynamicPrompt,
      model: character.preferredModel,
      negativePrompt: character.promptSettings?.negativePrompt,
      loraPath: character.loraModelPath,
      triggerWord: character.triggerWord,
    })

    if (!imageResult.success || !imageResult.imageData) {
      throw new Error(imageResult.error || "Failed to generate image")
    }

    // Step 3: Generate a caption from the image
    const captionModel = genAI.getGenerativeModel({ model: "gemini-pro-vision" })
    const captionGenerationPrompt = [
      `You are an AI assistant for a social media automation tool. Your task is to generate a compelling and engaging Instagram caption for the following character, based on the provided image. The caption should be less than 100 characters.`,
      `**Character Details:**\n- Name: ${character.name}\n- Personality: ${character.personality}`,
      {
        inlineData: {
          data: imageResult.imageData,
          mimeType: "image/png",
        },
      },
      `**Instructions:**\n1. Write a caption that is authentic to the character's voice and personality.\n2. The caption must be less than 100 characters.\n3. Include 2-3 relevant hashtags.\n4. Do not include any of your own commentary. Just provide the caption.`,
    ]

    const captionResult = await captionModel.generateContent(captionGenerationPrompt)
    const dynamicCaption = (await captionResult.response.text()).trim()

    // Save the generated content
    const allContent = await getContent()
    const newContent = {
      id: `content_${Date.now()}_${character.id}`,
      characterId: character.id,
      prompt: dynamicPrompt,
      imageUrl: imageResult.imageUrl,
      caption: dynamicCaption,
      createdAt: new Date().toISOString(),
    }
    const updatedContent = [newContent, ...allContent]
    await saveContent(updatedContent)

    return NextResponse.json(newContent)
  } catch (error) {
    console.error("Failed to generate content:", error)
    return NextResponse.json(
      {
        error: "Failed to generate content",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
