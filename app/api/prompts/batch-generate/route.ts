import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { promises as fs } from "fs"
import path from "path"

const promptsFilePath = path.join(process.cwd(), "data", "prompts.json")

async function getPrompts() {
  try {
    const data = await fs.readFile(promptsFilePath, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    if (error.code === "ENOENT") {
      return []
    }
    throw error
  }
}

async function savePrompts(prompts: any) {
  await fs.writeFile(promptsFilePath, JSON.stringify(prompts, null, 2))
}

export async function POST(req: Request) {
  try {
    const { character, count, apiKey } = await req.json()

    if (!character || !count || !apiKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" })

    const generationPrompt = `
      You are an AI assistant for a social media automation tool.
      Your task is to generate ${count} creative and engaging image generation prompts for the following character.
      The prompts should be diverse and reflect the character's personality and backstory.
      Provide the output as a JSON array of strings.

      **Character Details:**
      - Name: ${character.name}
      - Personality: ${character.personality}
      - Backstory: ${character.backstory}

      **Instructions:**
      1. Generate ${count} unique prompts.
      2. The prompts should be suitable for a text-to-image model like Stable Diffusion or Midjourney.
      3. The prompts should be in a JSON array format, like this: ["prompt 1", "prompt 2", "prompt 3"]
      4. Do not include any other text or commentary in your response.
    `

    const result = await model.generateContent(generationPrompt)
    const response = await result.response
    const text = response.text()

    // Clean the response to get only the JSON array
    const jsonString = text.substring(text.indexOf("["), text.lastIndexOf("]") + 1)
    const generatedPrompts = JSON.parse(jsonString)

    const allPrompts = await getPrompts()
    const newPrompts = generatedPrompts.map((promptText: string) => ({
      id: `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      characterId: character.id,
      characterName: character.name,
      prompt: promptText,
      caption: "",
      createdAt: new Date().toISOString(),
      used: false,
    }))

    const updatedPrompts = [...allPrompts, ...newPrompts]
    await savePrompts(updatedPrompts)

    return NextResponse.json({ prompts: newPrompts })
  } catch (error) {
    console.error("Failed to generate prompts:", error)
    return NextResponse.json(
      {
        error: "Failed to generate prompts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
