import { type NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

interface Character {
  id: string
  name: string
  personality: string
  backstory: string
  narrative?: string[]
}

async function loadCharacters(): Promise<Character[]> {
  try {
    const data = await readFile(join(process.cwd(), "data", "characters.json"), "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { characterId, context, style } = await request.json()

    if (!characterId) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 })
    }

    const characters = await loadCharacters()
    const character = characters.find((c) => c.id === characterId)

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 })
    }

    let prompt: string

    // Try to generate with Gemini AI
    try {
      if (process.env.GEMINI_API_KEY) {
        const { GoogleGenerativeAI } = await import("@google/generative-ai")
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
        const model = genAI.getGenerativeModel({ model: "gemini-pro" })

        const promptContext = `
          Create an engaging image prompt for AI generation based on this character:
          
          Character: ${character.name}
          Personality: ${character.personality}
          Backstory: ${character.backstory}
          Previous narrative: ${character.narrative?.join(", ") || "None"}
          
          Context: ${context || "Continue the character's story"}
          Style: ${style || "cinematic, high quality"}
          
          Generate a detailed, visual prompt that:
          1. Captures the character's essence
          2. Continues their narrative naturally
          3. Is suitable for social media
          4. Includes visual style and mood
          5. Is under 200 characters
          
          Return only the prompt, no explanation.
        `

        const result = await model.generateContent(promptContext)
        const response = await result.response
        prompt = response.text().trim()
      } else {
        throw new Error("Gemini API key not configured")
      }
    } catch (error) {
      console.error("Gemini generation failed:", error)

      // Fallback prompt generation
      const templates = [
        `${character.name}, ${character.personality}, portrait style, ${style || "cinematic lighting"}, high quality`,
        `${character.name} in a ${context || "modern setting"}, ${character.personality} expression, detailed, professional`,
        `Close-up of ${character.name}, ${character.personality} mood, ${style || "artistic style"}, masterpiece quality`,
        `${character.name} ${context || "exploring new places"}, ${character.personality} personality, ${style || "dramatic lighting"}`,
        `${character.name}, ${character.personality} character, ${context || "daily life scene"}, high resolution, detailed`,
      ]

      prompt = templates[Math.floor(Math.random() * templates.length)]
    }

    return NextResponse.json({
      success: true,
      prompt,
      character: character.name,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Prompt generation error:", error)
    return NextResponse.json({ error: "Failed to generate prompt" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return recent prompts (mock data for now)
    const recentPrompts = [
      {
        id: "prompt_1",
        characterId: "char_1",
        characterName: "Luna",
        prompt: "Luna, mystical and dreamy, ethereal forest setting, moonlight, cinematic style",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        used: true,
      },
      {
        id: "prompt_2",
        characterId: "char_2",
        characterName: "Alex",
        prompt: "Alex, confident urban explorer, city rooftop, golden hour, dramatic lighting",
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        used: false,
      },
    ]

    return NextResponse.json({ prompts: recentPrompts })
  } catch (error) {
    console.error("Failed to get prompts:", error)
    return NextResponse.json({ error: "Failed to get prompts" }, { status: 500 })
  }
}
