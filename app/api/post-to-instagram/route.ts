import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

interface InstagramPostRequest {
  imageBase64: string
  caption: string
  accessToken?: string
  accountId?: string
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, caption, accessToken, accountId }: InstagramPostRequest = await request.json()

    if (!imageBase64 || !caption) {
      return NextResponse.json({ error: "Image and caption are required" }, { status: 400 })
    }

    const token = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN
    const businessAccountId = accountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

    if (!token || !businessAccountId) {
      return NextResponse.json(
        {
          error: "Instagram credentials not configured",
          details: "Please set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID environment variables",
        },
        { status: 400 },
      )
    }

    // Step 1: Upload image to hosting service
    const imageUrl = await uploadImageToHosting(imageBase64)

    // Step 2: Create Instagram media container
    const containerId = await createMediaContainer(imageUrl, caption, token, businessAccountId)

    // Step 3: Publish the media
    const postId = await publishMedia(containerId, token, businessAccountId)

    return NextResponse.json({
      success: true,
      postId,
      imageUrl,
      caption,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Instagram posting failed:", error)
    return NextResponse.json({ error: "Failed to post to Instagram", details: error.message }, { status: 500 })
  }
}

async function uploadImageToHosting(imageBase64: string): Promise<string> {
  // Option 1: Vercel Blob (production)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob")
      const filename = `instagram-${Date.now()}.png`
      const blob = await put(filename, Buffer.from(imageBase64, "base64"), {
        access: "public",
        contentType: "image/png",
      })
      return blob.url
    } catch (error) {
      console.error("Vercel Blob upload failed:", error)
    }
  }

  // Option 2: Cloudinary
  if (process.env.CLOUDINARY_URL) {
    try {
      const cloudinary = require("cloudinary").v2
      const result = await cloudinary.uploader.upload(`data:image/png;base64,${imageBase64}`, {
        folder: "instagram-automation",
        public_id: `post-${Date.now()}`,
        resource_type: "image",
      })
      return result.secure_url
    } catch (error) {
      console.error("Cloudinary upload failed:", error)
    }
  }

  // Option 3: Local storage (development only)
  if (process.env.NODE_ENV === "development") {
    const filename = `instagram-${Date.now()}.png`
    const publicPath = join(process.cwd(), "public", "temp")

    await mkdir(publicPath, { recursive: true })
    await writeFile(join(publicPath, filename), Buffer.from(imageBase64, "base64"))

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    return `${baseUrl}/temp/${filename}`
  }

  throw new Error(
    "No image hosting service configured. Please set up Vercel Blob, Cloudinary, or use development mode.",
  )
}

async function createMediaContainer(
  imageUrl: string,
  caption: string,
  accessToken: string,
  accountId: string,
): Promise<string> {
  const response = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Container creation failed: ${error.error?.message || response.statusText}`)
  }

  const result = await response.json()
  return result.id
}

async function publishMedia(containerId: string, accessToken: string, accountId: string): Promise<string> {
  const response = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Publishing failed: ${error.error?.message || response.statusText}`)
  }

  const result = await response.json()
  return result.id
}

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN
    const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

    if (!token || !accountId) {
      return NextResponse.json({
        configured: false,
        message: "Instagram credentials not configured",
      })
    }

    // Test the connection
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}?fields=id,username,account_type&access_token=${token}`,
      { signal: AbortSignal.timeout(5000) },
    )

    if (response.ok) {
      const accountInfo = await response.json()
      return NextResponse.json({
        configured: true,
        connected: true,
        account: accountInfo,
      })
    } else {
      return NextResponse.json({
        configured: true,
        connected: false,
        error: "Failed to connect to Instagram API",
      })
    }
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: error.message,
    })
  }
}
