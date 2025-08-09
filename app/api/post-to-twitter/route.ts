import { type NextRequest, NextResponse } from "next/server"
import { TwitterApi } from "twitter-api-v2"
import { readFile } from "fs/promises"
import { join } from "path"

interface Character {
  id: string
  name: string
  twitterAppKey?: string
  twitterAppSecret?: string
  twitterAccessToken?: string
  twitterAccessSecret?: string
}

async function loadCharacters(): Promise<Character[]> {
  try {
    const data = await readFile(join(process.cwd(), "data", "characters.json"), "utf-8")
    return JSON.parse(data)
  } catch (error) {
    console.error("Failed to load characters:", error)
    return []
  }
}

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

export async function POST(request: NextRequest) {
  try {
    const { characterId, imageUrl, caption, contentId } = await request.json()

    if (!characterId || !imageUrl || !caption || !contentId) {
      return NextResponse.json({ error: "Character ID, image URL, caption and contentId are required" }, { status: 400 })
    }

    const characters = await loadCharacters()
    const character = characters.find((c) => c.id === characterId)

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 })
    }

    const client = new TwitterApi({
      appKey: character.twitterAppKey || process.env.TWITTER_API_KEY || "",
      appSecret: character.twitterAppSecret || process.env.TWITTER_API_KEY_SECRET || "",
      accessToken: character.twitterAccessToken || process.env.TWITTER_ACCESS_TOKEN || "",
      accessSecret: character.twitterAccessSecret || process.env.TWITTER_ACCESS_TOKEN_SECRET || "",
    })

    const twitterClient = client.readWrite

    // Fetch image from URL
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageUrl}`)
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Upload image
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: "image/png" })

    // Post tweet
    await twitterClient.v2.tweet({
      text: caption,
      media: {
        media_ids: [mediaId],
      },
    })

    // Update the content file
    const content = await getContent()
    const contentIndex = content.findIndex((c: any) => c.id === contentId)
    if (contentIndex !== -1) {
      content[contentIndex].postedToTwitter = true
      await saveContent(content)
    }

    return NextResponse.json({ success: true, message: "Posted to X/Twitter successfully" })
  } catch (error) {
    console.error("Failed to post to X/Twitter:", error)
    return NextResponse.json(
      {
        error: "Failed to post to X/Twitter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
