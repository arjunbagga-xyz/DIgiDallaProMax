import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { action, characterImages } = await request.json()

    if (action === "run") {
      // This would be called by your scheduler (cron job, Vercel Cron, etc.)

      console.log("Running automation...")

      // Step 1: Generate image
      const generateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ characterImages }),
      })

      const generateResult = await generateResponse.json()

      if (!generateResult.success) {
        throw new Error("Failed to generate image")
      }

      // Step 2: Post to Instagram
      const postResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/post-to-instagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: generateResult.image,
          caption: `${generateResult.prompt} ✨\n\n#AIArt #GeneratedContent #DigitalArt #CreativeAI`,
        }),
      })

      const postResult = await postResponse.json()

      if (!postResult.success) {
        throw new Error("Failed to post to Instagram")
      }

      return NextResponse.json({
        success: true,
        message: "Automation completed successfully",
        prompt: generateResult.prompt,
        postId: postResult.postId,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Automation error:", error)
    return NextResponse.json({ error: `Automation failed: ${error.message}` }, { status: 500 })
  }
}
