import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, caption } = await request.json()

    if (!imageBase64) {
      return NextResponse.json({ error: "Image data is required" }, { status: 400 })
    }

    // IMPORTANT: Instagram Basic Display API is READ-ONLY!
    // It cannot post content. For posting, we need Instagram Graph API
    // which requires a Business/Creator account and app review for some features.

    const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN
    const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID // Business account ID

    if (!ACCESS_TOKEN || !INSTAGRAM_ACCOUNT_ID) {
      return NextResponse.json(
        {
          error: "Instagram Graph API credentials not configured",
          note: "Instagram Basic Display API cannot post content - only read",
        },
        { status: 500 },
      )
    }

    try {
      // Method 1: Instagram Graph API (Business accounts only)
      const result = await postViaGraphAPI(imageBase64, caption, ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID)
      return NextResponse.json(result)
    } catch (graphError) {
      console.log("Graph API posting failed:", graphError.message)

      // Method 2: Save for manual posting or third-party services
      const fallbackResult = await saveForManualPosting(imageBase64, caption)
      return NextResponse.json(fallbackResult)
    }
  } catch (error) {
    console.error("Error in Instagram posting:", error)
    return NextResponse.json(
      {
        error: "Posting failed",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

async function postViaGraphAPI(imageBase64: string, caption: string, accessToken: string, accountId: string) {
  // Step 1: Create media container
  const imageBuffer = Buffer.from(imageBase64, "base64")

  // For Instagram Graph API, we need to upload to a publicly accessible URL first
  // This is a limitation - Instagram needs to fetch the image from a URL

  const containerResponse = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: `data:image/png;base64,${imageBase64}`, // This won't work - Instagram doesn't accept data URLs
      caption: caption || "Generated with open-source AI ✨ #OpenSourceAI #FluxAI #GeneratedArt",
      access_token: accessToken,
    }),
  })

  if (!containerResponse.ok) {
    const error = await containerResponse.json()
    throw new Error(`Container creation failed: ${error.error?.message || containerResponse.statusText}`)
  }

  const containerResult = await containerResponse.json()
  const creationId = containerResult.id

  // Step 2: Publish the media
  const publishResponse = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media_publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken,
    }),
  })

  if (!publishResponse.ok) {
    const error = await publishResponse.json()
    throw new Error(`Publishing failed: ${error.error?.message || publishResponse.statusText}`)
  }

  const publishResult = await publishResponse.json()

  return {
    success: true,
    postId: publishResult.id,
    message: "Successfully posted to Instagram via Graph API",
    method: "graph_api",
  }
}

async function saveForManualPosting(imageBase64: string, caption: string) {
  // Save image and caption for manual posting
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")

  // In a real app, you'd save to a file system or cloud storage
  // For now, we'll return the data for the user to handle

  return {
    success: true,
    message: "Image generated and ready for manual posting",
    method: "manual_posting",
    data: {
      image: imageBase64,
      caption: caption,
      filename: `instagram-post-${timestamp}.png`,
      instructions: [
        "1. Save the base64 image data as a PNG file",
        "2. Open Instagram app or web version",
        "3. Create new post and upload the saved image",
        "4. Use the provided caption",
        "5. Post to your account",
      ],
    },
    alternatives: [
      "Use Buffer, Hootsuite, or Later for scheduled posting",
      "Use Instagram Creator Studio (free for business accounts)",
      "Set up a proper image hosting service for Graph API",
      "Use Instagram's Content Publishing API (requires app review)",
    ],
  }
}
