import { type NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

interface Character {
  id: string
  name: string
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

interface InstagramPostRequest {
  characterId: string
  imageBase64: string
  caption: string
}

export async function POST(request: NextRequest) {
  try {
    const { characterId, imageBase64, caption }: InstagramPostRequest = await request.json()

    if (!characterId || !imageBase64 || !caption) {
      return NextResponse.json({ error: "characterId, imageBase64, and caption are required" }, { status: 400 })
    }

    const characters = await loadCharacters()
    const character = characters.find((c) => c.id === characterId)

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 })
    }

    const characterNameUpper = character.name.toUpperCase().replace(/\s/g, "_")
    const accessToken = process.env[`${characterNameUpper}_INSTAGRAM_ACCESS_TOKEN`]
    const accountId = process.env[`${characterNameUpper}_INSTAGRAM_ACCOUNT_ID`]

    if (!accessToken || !accountId) {
      return NextResponse.json(
        {
          error: `Instagram credentials not configured for character: ${character.name}`,
          details: `Please set ${characterNameUpper}_INSTAGRAM_ACCESS_TOKEN and ${characterNameUpper}_INSTAGRAM_ACCOUNT_ID environment variables.`,
        },
        { status: 400 },
      )
    }

    console.log(`🔄 Starting Instagram post process for ${character.name}...`)

    // Step 1: Upload image to Instagram
    const imageBuffer = Buffer.from(imageBase64, "base64")
    const uploadResponse = await uploadImageToInstagram(imageBuffer, accessToken, accountId)

    if (!uploadResponse.success) {
      throw new Error(`Image upload failed: ${uploadResponse.error}`)
    }

    console.log("✅ Image uploaded successfully, creation_id:", uploadResponse.creationId)

    // Step 2: Publish the post
    const publishResponse = await publishInstagramPost(uploadResponse.creationId, caption, accessToken, accountId)

    if (!publishResponse.success) {
      throw new Error(`Post publishing failed: ${publishResponse.error}`)
    }

    console.log("✅ Post published successfully, post_id:", publishResponse.postId)

    return NextResponse.json({
      success: true,
      postId: publishResponse.postId,
      creationId: uploadResponse.creationId,
      caption,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Instagram posting failed:", error)
    return NextResponse.json(
      {
        error: "Failed to post to Instagram",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function uploadImageToInstagram(
  imageBuffer: Buffer,
  accessToken: string,
  accountId: string,
): Promise<{ success: boolean; creationId?: string; error?: string }> {
  try {
    // Convert buffer to form data
    const formData = new FormData()
    const blob = new Blob([imageBuffer], { type: "image/jpeg" })
    formData.append("image", blob, "image.jpg")
    formData.append("access_token", accessToken)

    const response = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media`, {
      method: "POST",
      body: formData,
    })

    const result = await response.json()

    if (response.ok && result.id) {
      return {
        success: true,
        creationId: result.id,
      }
    } else {
      return {
        success: false,
        error: result.error?.message || "Unknown upload error",
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload request failed",
    }
  }
}

async function publishInstagramPost(
  creationId: string,
  caption: string,
  accessToken: string,
  accountId: string,
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media_publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        creation_id: creationId,
        caption: caption,
        access_token: accessToken,
      }),
    })

    const result = await response.json()

    if (response.ok && result.id) {
      return {
        success: true,
        postId: result.id,
      }
    } else {
      return {
        success: false,
        error: result.error?.message || "Unknown publishing error",
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Publishing request failed",
    }
  }
}
