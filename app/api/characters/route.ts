import { type NextRequest, NextResponse } from "next/server"
import { writeFile, readFile, mkdir } from "fs/promises"
import { join } from "path"

interface Character {
  id: string
  name: string
  personality: string
  backstory: string
  instagramHandle: string
  loraModelPath?: string
  isActive: boolean
  lastPost?: string
  nextPost?: string
  createdAt: string
  updatedAt: string
}

const CHARACTERS_FILE = join(process.cwd(), "data", "characters.json")

async function ensureDataDirectory() {
  try {
    await mkdir(join(process.cwd(), "data"), { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

async function loadCharacters(): Promise<Character[]> {
  try {
    const data = await readFile(CHARACTERS_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function saveCharacters(characters: Character[]) {
  await ensureDataDirectory()
  await writeFile(CHARACTERS_FILE, JSON.stringify(characters, null, 2))
}

export async function GET(request: NextRequest) {
  try {
    const characters = await loadCharacters()
    return NextResponse.json({ characters })
  } catch (error) {
    console.error("Failed to load characters:", error)
    return NextResponse.json({ error: "Failed to load characters" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, personality, backstory, instagramHandle } = body

    if (!name || !personality) {
      return NextResponse.json({ error: "Name and personality are required" }, { status: 400 })
    }

    const characters = await loadCharacters()

    const newCharacter: Character = {
      id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      personality,
      backstory: backstory || "",
      instagramHandle: instagramHandle || "",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    characters.push(newCharacter)
    await saveCharacters(characters)

    return NextResponse.json({ character: newCharacter })
  } catch (error) {
    console.error("Failed to create character:", error)
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 })
    }

    const characters = await loadCharacters()
    const characterIndex = characters.findIndex((c) => c.id === id)

    if (characterIndex === -1) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 })
    }

    characters[characterIndex] = {
      ...characters[characterIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    await saveCharacters(characters)

    return NextResponse.json({ character: characters[characterIndex] })
  } catch (error) {
    console.error("Failed to update character:", error)
    return NextResponse.json({ error: "Failed to update character" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 })
    }

    const characters = await loadCharacters()
    const filteredCharacters = characters.filter((c) => c.id !== id)

    if (filteredCharacters.length === characters.length) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 })
    }

    await saveCharacters(filteredCharacters)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete character:", error)
    return NextResponse.json({ error: "Failed to delete character" }, { status: 500 })
  }
}
