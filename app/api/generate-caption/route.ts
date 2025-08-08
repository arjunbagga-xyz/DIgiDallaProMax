import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    const { prompt, character, narrative, apiKey } = await request.json()

    if (!prompt || !character) {
      return NextResponse.json({ error: "Prompt and character are required" }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || "")
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const generationPrompt = `
      You are an AI assistant for a social media automation tool.
      Your task is to generate a compelling and engaging Instagram caption.

      **Character Details:**
      - Name: ${character.name}
      - Personality: ${character.personality}
      - Backstory: ${character.backstory}

      ${narrative ? `
      **Current Narrative:**
      - Title: ${narrative.title}
      - Description: ${narrative.description}
      ` : ""}

      **Image Generation Prompt:**
      \`\`\`
      ${prompt}
      \`\`\`

      **Instructions:**
      1.  Write a caption that is authentic to the character's voice and personality.
      2.  The caption should be inspired by the image generation prompt.
      3.  Keep it concise and engaging (1-3 sentences).
      4.  Include 3-5 relevant and popular hashtags.
      5.  Do not use hashtags that are just the character's name or trigger words.
      6.  Do not include any of your own commentary. Just provide the caption.

      **Example Output:**
      Lost in the neon glow of a city that never sleeps. ✨ #cyberpunk #neocity #nightlife #aiart #characterdesign

      **Generated Caption:**
    `

    const result = await model.generateContent(generationPrompt)
    const response = await result.response
    const caption = response.text()

    return NextResponse.json({ caption })
  } catch (error) {
    console.error("Failed to generate caption:", error)
    return NextResponse.json({ error: "Failed to generate caption" }, { status: 500 })
  }
}
