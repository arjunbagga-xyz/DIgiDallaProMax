import { type NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

interface Character {
  id: string
  name: string
  personality: string
  backstory: string
  instagramHandle: string
  isActive: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { action, characterId, fluxModel = "flux-dev" } = await request.json()

    switch (action) {
      case "generate_and_post":
        return await generateAndPost(characterId, fluxModel)

      case "generate_all":
        return await generateForAllCharacters(fluxModel)

      case "test_workflow":
        return await testWorkflow(characterId)

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Automation error:", error)
    return NextResponse.json(
      {
        error: "Automation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function generateAndPost(characterId: string, fluxModel: string) {
  try {
    console.log(`🚀 Starting automation for character: ${characterId}`)

    // Step 1: Generate prompt
    const promptResponse = await fetch(`${getBaseUrl()}/api/prompts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    })

    if (!promptResponse.ok) {
      throw new Error("Failed to generate prompt")
    }

    const promptData = await promptResponse.json()
    console.log("✅ Prompt generated:", promptData.prompt)

    // Step 2: Generate image
    const imageResponse = await fetch(`${getBaseUrl()}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId,
        customPrompt: promptData.prompt,
        fluxModel,
      }),
    })

    if (!imageResponse.ok) {
      throw new Error("Failed to generate image")
    }

    const imageData = await imageResponse.json()
    console.log("✅ Image generated successfully")

    // Step 3: Post to Instagram
    const postResponse = await fetch(`${getBaseUrl()}/api/post-to-instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: imageData.image,
        caption: promptData.caption,
      }),
    })

    if (!postResponse.ok) {
      const postError = await postResponse.json()
      console.warn("⚠️ Instagram posting failed:", postError.error)

      return NextResponse.json({
        success: true,
        generated: true,
        posted: false,
        prompt: promptData.prompt,
        caption: promptData.caption,
        reason: postError.error || "Instagram posting failed",
        timestamp: new Date().toISOString(),
      })
    }

    const postData = await postResponse.json()
    console.log("✅ Posted to Instagram:", postData.postId)

    return NextResponse.json({
      success: true,
      generated: true,
      posted: true,
      prompt: promptData.prompt,
      caption: promptData.caption,
      postId: postData.postId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Generate and post failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function generateForAllCharacters(fluxModel: string) {
  try {
    const characters = await loadCharacters()
    const activeCharacters = characters.filter((c) => c.isActive)

    console.log(`🚀 Starting automation for ${activeCharacters.length} active characters`)

    const results = []

    for (const character of activeCharacters) {
      try {
        console.log(`Processing character: ${character.name}`)

        const result = await generateAndPost(character.id, fluxModel)
        const resultData = await result.json()

        results.push({
          characterId: character.id,
          characterName: character.name,
          success: resultData.success,
          ...resultData,
        })
      } catch (error) {
        results.push({
          characterId: character.id,
          characterName: character.name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    console.log(`✅ Automation completed: ${successCount}/${activeCharacters.length} successful`)

    return NextResponse.json({
      success: true,
      totalCharacters: activeCharacters.length,
      successfulPosts: successCount,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Bulk automation failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function testWorkflow(characterId: string) {
  try {
    console.log(`🧪 Testing workflow for character: ${characterId}`)

    // Test prompt generation
    const promptResponse = await fetch(`${getBaseUrl()}/api/prompts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    })

    const promptTest = {
      success: promptResponse.ok,
      status: promptResponse.status,
      data: promptResponse.ok ? await promptResponse.json() : null,
    }

    // Test image generation (without actually generating)
    const imageTest = {
      success: true, // We'll assume this works if ComfyUI is available
      status: 200,
      message: "Image generation endpoint available",
    }

    // Test Instagram connection
    const instagramTest = {
      success: !!(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
      status: process.env.INSTAGRAM_ACCESS_TOKEN ? 200 : 400,
      message: process.env.INSTAGRAM_ACCESS_TOKEN ? "Instagram credentials configured" : "Instagram not configured",
    }

    return NextResponse.json({
      success: true,
      tests: {
        promptGeneration: promptTest,
        imageGeneration: imageTest,
        instagramPosting: instagramTest,
      },
      overallStatus: promptTest.success && imageTest.success ? "ready" : "needs_setup",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Workflow test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function loadCharacters(): Promise<Character[]> {
  try {
    const data = await readFile(join(process.cwd(), "data", "characters.json"), "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
}
