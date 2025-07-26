// Complete Instagram integration with proper image hosting
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

export interface InstagramPostOptions {
  imageBase64: string
  caption: string
  accessToken: string
  accountId: string
}

export class InstagramClient {
  private baseUrl = "https://graph.facebook.com/v18.0"

  async postImage(options: InstagramPostOptions): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
      // Step 1: Upload image to temporary hosting
      const imageUrl = await this.uploadImageToHosting(options.imageBase64)

      // Step 2: Create media container
      const containerId = await this.createMediaContainer(
        imageUrl,
        options.caption,
        options.accessToken,
        options.accountId,
      )

      // Step 3: Publish the media
      const postId = await this.publishMedia(containerId, options.accessToken, options.accountId)

      return { success: true, postId }
    } catch (error) {
      console.error("Instagram posting failed:", error)
      return { success: false, error: error.message }
    }
  }

  private async uploadImageToHosting(imageBase64: string): Promise<string> {
    // Option 1: Save to public directory (for local development)
    if (process.env.NODE_ENV === "development") {
      const filename = `instagram-${Date.now()}.png`
      const publicPath = join(process.cwd(), "public", "temp", filename)

      await mkdir(join(process.cwd(), "public", "temp"), { recursive: true })
      await writeFile(publicPath, Buffer.from(imageBase64, "base64"))

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      return `${baseUrl}/temp/${filename}`
    }

    // Option 2: Upload to Vercel Blob (production)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob")
      const filename = `instagram-${Date.now()}.png`
      const blob = await put(filename, Buffer.from(imageBase64, "base64"), {
        access: "public",
      })
      return blob.url
    }

    // Option 3: Upload to Cloudinary (alternative)
    if (process.env.CLOUDINARY_URL) {
      const cloudinary = require("cloudinary").v2
      const result = await cloudinary.uploader.upload(`data:image/png;base64,${imageBase64}`, {
        folder: "instagram-bot",
        public_id: `post-${Date.now()}`,
      })
      return result.secure_url
    }

    throw new Error(
      "No image hosting service configured. Please set up Vercel Blob, Cloudinary, or use development mode.",
    )
  }

  private async createMediaContainer(
    imageUrl: string,
    caption: string,
    accessToken: string,
    accountId: string,
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/${accountId}/media`, {
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

  private async publishMedia(containerId: string, accessToken: string, accountId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/${accountId}/media_publish`, {
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

  async getAccountInfo(accessToken: string, accountId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/${accountId}?fields=id,username,account_type&access_token=${accessToken}`,
    )

    if (!response.ok) {
      throw new Error(`Failed to get account info: ${response.statusText}`)
    }

    return response.json()
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/me?access_token=${accessToken}`)
      return response.ok
    } catch (error) {
      return false
    }
  }
}

export const instagram = new InstagramClient()
