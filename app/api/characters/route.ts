import { type NextRequest, NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import { join } from "path"

interface Character {
  id: string
  name: string
  lora: string
  instagramAccount: string
  accessToken: string
  accountId: string
  backstory: string
  narrative: string[]
  personality: string[]
  schedule: {
    type: "interval" | "cron" | "times"
    value: string
    timezone: string
    active: boolean
  }
  lastPost: string | null
  nextPost: string | null
  stats: {
    totalPosts: number
    successRate: number
    avgEngagement: number
  }
}

const CHARACTERS_FILE = join(process.cwd(), "data", "characters.json")

export async function GET() {
  try {
    const data = await readFile(CHARACTERS_FILE, "utf-8")
    const characters: Character[] = JSON.parse(data)
    return NextResponse.json({ characters })
  } catch (error) {
    // Return default characters if file doesn't exist
    const defaultCharacters: Character[] = [
      {
        id: "emma",
        name: "Emma",
        lora: "emma_v2.safetensors",
        instagramAccount: "@emma_ai_life",
        accessToken: "",
        accountId: "",
        backstory: "Travel blogger exploring hidden gems around the world",
        narrative: [
          "Started as a city dweller who felt trapped in routine",
          "Discovered passion for travel through a spontaneous weekend trip",
          "Now documents authentic local experiences and hidden spots",
          "Focuses on sustainable and mindful travel practices",
        ],
        personality: ["adventurous", "curious", "authentic", "mindful", "optimistic"],
        schedule: {
          type: "interval",
          value: "6h",
          timezone: "UTC",
          active: true,
        },
        lastPost: null,
        nextPost: null,
        stats: {
          totalPosts: 0,
          successRate: 0,
          avgEngagement: 0,
        },
      },
    ]

    return NextResponse.json({ characters: defaultCharacters })
  }
}

export async function POST(request: NextRequest) {
  try {
    const character: Character = await request.json()

    // Read existing characters
    let characters: Character[] = []
    try {
      const data = await readFile(CHARACTERS_FILE, "utf-8")
      characters = JSON.parse(data)
    } catch (error) {
      // File doesn't exist, start with empty array
    }

    // Add or update character
    const existingIndex = characters.findIndex((c) => c.id === character.id)
    if (existingIndex >= 0) {
      characters[existingIndex] = character
    } else {
      characters.push(character)
    }

    // Save to file
    await writeFile(CHARACTERS_FILE, JSON.stringify(characters, null, 2))

    return NextResponse.json({ success: true, character })
  } catch (error) {
    console.error("Error saving character:", error)
    return NextResponse.json({ error: "Failed to save character" }, { status: 500 })
  }
}
