import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

interface Character {
  name: string
  backstory: string
  narrative: string[]
  personality: string[]
  recentPosts: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { character, contextPosts = 5 }: { character: Character; contextPosts?: number } = await request.json()

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })

    // Build context-aware prompt
    const systemPrompt = `You are an AI assistant that generates creative, contextual prompts for image generation of a specific character.

Character Profile:
- Name: ${character.name}
- Backstory: ${character.backstory}
- Personality: ${character.personality.join(", ")}
- Ongoing Narrative: ${character.narrative.join(" → ")}

Recent Posts Context:
${character.recentPosts
  .slice(-contextPosts)
  .map((post, i) => `${i + 1}. ${post}`)
  .join("\n")}

Guidelines:
1. Generate a detailed image prompt that continues the character's story
2. Consider the recent posts to avoid repetition and maintain narrative flow
3. Include specific visual details (lighting, setting, mood, expression)
4. Maintain character consistency with phrases like "same person", "consistent character"
5. Reflect the character's personality and current narrative arc
6. Consider seasonal relevance and trending activities
7. Keep prompts between 50-100 words
8. End with "detailed face, consistent character, high quality"

Generate a single, creative image prompt that feels natural for this character's next post:`

    const result = await model.generateContent(systemPrompt)
    const generatedPrompt = result.response.text().trim()

    // Add technical parameters for better image generation
    const enhancedPrompt = `${generatedPrompt}, photorealistic, 8k resolution, professional photography, natural lighting`

    // Generate a contextual caption for Instagram
    const captionPrompt = `Based on this image prompt: "${generatedPrompt}"

Generate a natural, engaging Instagram caption for ${character.name} that:
1. Reflects their personality (${character.personality.join(", ")})
2. Continues their narrative naturally
3. Includes 2-3 relevant hashtags
4. Feels authentic and personal
5. Is 1-2 sentences long

Caption:`

    const captionResult = await model.generateContent(captionPrompt)
    const generatedCaption = captionResult.response.text().trim()

    // Update character's narrative context
    const narrativeUpdate = `Based on the generated prompt "${generatedPrompt}", what would be the next logical development in ${character.name}'s ongoing story? Provide a single sentence that could be added to their narrative arc.`

    const narrativeResult = await model.generateContent(narrativeUpdate)
    const narrativeAddition = narrativeResult.response.text().trim()

    return NextResponse.json({
      success: true,
      prompt: enhancedPrompt,
      caption: generatedCaption,
      narrativeAddition,
      context: {
        characterName: character.name,
        postsConsidered: contextPosts,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Error generating prompt:", error)
    return NextResponse.json({ error: "Failed to generate prompt" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Get recent prompts for a character
  const { searchParams } = new URL(request.url)
  const characterName = searchParams.get("character")

  if (!characterName) {
    return NextResponse.json({ error: "Character name required" }, { status: 400 })
  }

  // In a real implementation, you'd fetch from database
  // For now, return mock data
  const recentPrompts = [
    {
      prompt:
        "Emma discovering a hidden waterfall during her morning hike, backpack on, golden hour lighting, sense of wonder and adventure, detailed face, consistent character, high quality",
      caption:
        "Found this incredible hidden gem on today's hike! Sometimes the best discoveries happen when you least expect them ✨ #HiddenGems #HikingLife #Adventure",
      timestamp: "2024-01-15T10:30:00Z",
      used: true,
    },
    {
      prompt:
        "Emma sitting by a campfire at sunset, writing in her travel journal, warm orange glow on her face, peaceful mountain backdrop, detailed face, consistent character, high quality",
      caption:
        "Reflecting on today's adventures by the campfire. There's something magical about documenting memories under the stars 🔥 #TravelJournal #CampfireVibes #Reflection",
      timestamp: "2024-01-14T19:45:00Z",
      used: true,
    },
  ]

  return NextResponse.json({
    character: characterName,
    prompts: recentPrompts,
  })
}
