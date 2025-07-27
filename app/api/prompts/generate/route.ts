import { type NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

interface Character {
  id: string
  name: string
  personality: string
  backstory: string
  narrative?: string[]
  recentPosts?: string[]
}

interface PromptRequest {
  characterId?: string
  character?: Character
  contextPosts?: number
  style?: string
  mood?: string
  setting?: string
}

async function loadCharacters(): Promise<Character[]> {
  try {
    const data = await readFile(join(process.cwd(), "data", "characters.json"), "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function generateContextualPrompt(
  character: Character,
  options: {
    contextPosts?: number
    style?: string
    mood?: string
    setting?: string
  },
): Promise<string> {
  // Try Gemini AI first
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai")
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: "gemini-pro" })

      const contextPrompt = `
        Create a detailed image generation prompt for this AI character:
        
        Character: ${character.name}
        Personality: ${character.personality}
        Backstory: ${character.backstory}
        
        ${options.style ? `Preferred Style: ${options.style}` : ""}
        ${options.mood ? `Desired Mood: ${options.mood}` : ""}
        ${options.setting ? `Setting: ${options.setting}` : ""}
        
        Recent narrative context:
        ${character.narrative?.slice(-3).join(". ") || "Beginning of character's journey"}
        
        Generate a creative, detailed prompt for AI image generation that:
        1. Captures the character's essence and personality
        2. Creates engaging visual content for social media
        3. Maintains narrative consistency
        4. Includes specific visual details (lighting, composition, style)
        5. Is optimized for Flux AI models
        
        Keep the prompt under 200 words and make it cinematic and engaging.
        Focus on visual elements that would work well on Instagram.
      `

      const result = await model.generateContent(contextPrompt)
      const response = await result.response
      const generatedPrompt = response.text()

      // Add technical parameters for better generation
      return `${generatedPrompt}, high quality, detailed, professional photography, 8k resolution, sharp focus, perfect lighting`
    } catch (error) {
      console.error("Gemini AI prompt generation failed:", error)
    }
  }

  // Fallback to template-based generation
  return generateFallbackPrompt(character, options)
}

function generateFallbackPrompt(
  character: Character,
  options: {
    style?: string
    mood?: string
    setting?: string
  },
): string {
  const styles = options.style ? [options.style] : ["cinematic", "portrait", "artistic", "dramatic", "ethereal"]
  const moods = options.mood ? [options.mood] : ["confident", "mysterious", "serene", "dynamic", "contemplative"]
  const settings = options.setting
    ? [options.setting]
    : ["urban landscape", "mystical forest", "modern studio", "natural environment", "cosmic background"]

  const lighting = ["golden hour", "soft natural light", "dramatic shadows", "ethereal glow", "warm ambient light"]
  const compositions = ["close-up portrait", "medium shot", "environmental portrait", "artistic angle", "dynamic pose"]

  const selectedStyle = styles[Math.floor(Math.random() * styles.length)]
  const selectedMood = moods[Math.floor(Math.random() * moods.length)]
  const selectedSetting = settings[Math.floor(Math.random() * settings.length)]
  const selectedLighting = lighting[Math.floor(Math.random() * lighting.length)]
  const selectedComposition = compositions[Math.floor(Math.random() * compositions.length)]

  return `${character.name}, ${character.personality} character, ${selectedMood} expression, ${selectedComposition}, ${selectedSetting}, ${selectedLighting}, ${selectedStyle} style, high quality, detailed face, consistent character, professional photography, 8k resolution, sharp focus`
}

async function generateInstagramCaption(character: Character, prompt: string): Promise<string> {
  // Try Gemini AI for caption generation
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai")
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: "gemini-pro" })

      const captionPrompt = `
        Create an engaging Instagram caption for this AI character:
        
        Character: ${character.name}
        Personality: ${character.personality}
        Backstory: ${character.backstory}
        
        Image context: ${prompt}
        
        Create a caption that:
        1. Stays in character
        2. Is engaging and authentic
        3. Includes relevant hashtags
        4. Encourages engagement
        5. Is 1-3 sentences long
        
        Make it feel natural and human-like, not robotic.
      `

      const result = await model.generateContent(captionPrompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error("Gemini AI caption generation failed:", error)
    }
  }

  // Fallback caption generation
  const captions = [
    `Living my best life ✨ #${character.name.toLowerCase()} #aiart #digitallife`,
    `Another day, another adventure 🌟 What do you think? #authentic #journey`,
    `Feeling ${character.personality.toLowerCase()} today 💫 #mood #vibes #aicharacter`,
    `Just being me 🎨 #creative #digital #lifestyle`,
    `Capturing moments that matter ✨ #photography #art #life`,
  ]

  return captions[Math.floor(Math.random() * captions.length)]
}

export async function POST(request: NextRequest) {
  try {
    const body: PromptRequest = await request.json()
    const { characterId, character, contextPosts = 5, style, mood, setting } = body

    let targetCharacter: Character

    if (character) {
      targetCharacter = character
    } else if (characterId) {
      const characters = await loadCharacters()
      const foundCharacter = characters.find((c) => c.id === characterId)
      if (!foundCharacter) {
        return NextResponse.json({ error: "Character not found" }, { status: 404 })
      }
      targetCharacter = foundCharacter
    } else {
      return NextResponse.json({ error: "Character ID or character object required" }, { status: 400 })
    }

    // Generate contextual prompt
    const prompt = await generateContextualPrompt(targetCharacter, {
      contextPosts,
      style,
      mood,
      setting,
    })

    // Generate Instagram caption
    const caption = await generateInstagramCaption(targetCharacter, prompt)

    return NextResponse.json({
      success: true,
      prompt,
      caption,
      character: targetCharacter.name,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Prompt generation failed:", error)
    return NextResponse.json(
      {
        error: "Failed to generate prompt",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
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
        caption: "Living my best life ✨ #luna #aiart #digitallife",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        used: true,
      },
      {
        id: "prompt_2",
        characterId: "char_2",
        characterName: "Alex",
        prompt: "Alex, confident urban explorer, city rooftop, golden hour, dramatic lighting",
        caption: "Another day, another adventure 🌟 What do you think? #authentic #journey",
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
