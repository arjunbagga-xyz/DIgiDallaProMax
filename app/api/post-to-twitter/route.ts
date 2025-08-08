import { type NextRequest, NextResponse } from "next/server"
import { TwitterApi } from "twitter-api-v2"

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY || "",
  appSecret: process.env.TWITTER_API_KEY_SECRET || "",
  accessToken: process.env.TWITTER_ACCESS_TOKEN || "",
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || "",
})

const twitterClient = client.readWrite

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, caption } = await request.json()

    if (!imageBase64 || !caption) {
      return NextResponse.json({ error: "Image and caption are required" }, { status: 400 })
    }

    // Upload image
    const imageBuffer = Buffer.from(imageBase64, "base64")
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: "image/png" })

    // Post tweet
    await twitterClient.v2.tweet({
      text: caption,
      media: {
        media_ids: [mediaId],
      },
    })

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
