// Complete Instagram API integration
export interface InstagramCredentials {
  accessToken: string
  accountId: string
}

export interface InstagramPost {
  id: string
  permalink: string
  mediaUrl: string
  caption: string
  timestamp: string
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM"
}

export interface InstagramPostRequest {
  imageUrl?: string
  imageData?: string
  caption: string
  accessToken: string
  accountId: string
}

export interface InstagramPostResponse {
  success: boolean
  postId?: string
  permalink?: string
  error?: string
}

class InstagramClient {
  private baseUrl = "https://graph.facebook.com/v18.0"

  async postImage(request: InstagramPostRequest): Promise<InstagramPostResponse> {
    try {
      // Step 1: Upload image to Instagram
      let mediaId: string

      if (request.imageData) {
        // Upload from base64 data
        mediaId = await this.uploadImageFromData(request.imageData, request.accessToken, request.accountId)
      } else if (request.imageUrl) {
        // Upload from URL
        mediaId = await this.uploadImageFromUrl(request.imageUrl, request.accessToken, request.accountId)
      } else {
        throw new Error("Either imageUrl or imageData must be provided")
      }

      // Step 2: Publish the media
      const publishResponse = await this.publishMedia(mediaId, request.caption, request.accessToken, request.accountId)

      return {
        success: true,
        postId: publishResponse.id,
        permalink: await this.getPostPermalink(publishResponse.id, request.accessToken),
      }
    } catch (error) {
      console.error("Instagram post failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }
    }
  }

  private async uploadImageFromData(imageData: string, accessToken: string, accountId: string): Promise<string> {
    // First, we need to upload the image to a temporary hosting service
    // For this example, we'll use Vercel Blob or Cloudinary
    const imageUrl = await this.uploadToImageHost(imageData)
    return await this.uploadImageFromUrl(imageUrl, accessToken, accountId)
  }

  private async uploadImageFromUrl(imageUrl: string, accessToken: string, accountId: string): Promise<string> {
    const uploadUrl = `${this.baseUrl}/${accountId}/media`

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        access_token: accessToken,
      }),
    })

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json()
      throw new Error(`Image upload failed: ${errorData.error?.message || uploadResponse.statusText}`)
    }

    const uploadData = await uploadResponse.json()
    return uploadData.id
  }

  private async publishMedia(
    mediaId: string,
    caption: string,
    accessToken: string,
    accountId: string,
  ): Promise<{ id: string }> {
    const publishUrl = `${this.baseUrl}/${accountId}/media_publish`

    const publishResponse = await fetch(publishUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        creation_id: mediaId,
        caption: caption,
        access_token: accessToken,
      }),
    })

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json()
      throw new Error(`Media publish failed: ${errorData.error?.message || publishResponse.statusText}`)
    }

    return await publishResponse.json()
  }

  private async getPostPermalink(postId: string, accessToken: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/${postId}?fields=permalink&access_token=${accessToken}`)

      if (!response.ok) {
        console.warn("Failed to get permalink, using fallback")
        return `https://www.instagram.com/p/${postId}/`
      }

      const data = await response.json()
      return data.permalink || `https://www.instagram.com/p/${postId}/`
    } catch (error) {
      console.warn("Failed to get permalink:", error)
      return `https://www.instagram.com/p/${postId}/`
    }
  }

  private async uploadToImageHost(imageData: string): Promise<string> {
    // Try Vercel Blob first
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      return await this.uploadToVercelBlob(imageData)
    }

    // Try Cloudinary as fallback
    if (process.env.CLOUDINARY_URL) {
      return await this.uploadToCloudinary(imageData)
    }

    throw new Error("No image hosting service configured. Please set BLOB_READ_WRITE_TOKEN or CLOUDINARY_URL")
  }

  private async uploadToVercelBlob(imageData: string): Promise<string> {
    const { put } = await import("@vercel/blob")

    const buffer = Buffer.from(imageData, "base64")
    const filename = `generated-${Date.now()}.png`

    const blob = await put(filename, buffer, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    return blob.url
  }

  private async uploadToCloudinary(imageData: string): Promise<string> {
    const cloudinaryUrl = process.env.CLOUDINARY_URL
    if (!cloudinaryUrl) {
      throw new Error("CLOUDINARY_URL not configured")
    }

    const url = new URL(cloudinaryUrl)
    const cloudName = url.hostname
    const apiKey = url.username
    const apiSecret = url.password

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`

    const formData = new FormData()
    formData.append("file", `data:image/png;base64,${imageData}`)
    formData.append("api_key", apiKey)
    formData.append("timestamp", Math.floor(Date.now() / 1000).toString())

    // Generate signature (simplified - in production, use proper crypto)
    const signature = this.generateCloudinarySignature(apiSecret, Math.floor(Date.now() / 1000))
    formData.append("signature", signature)

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.secure_url
  }

  private generateCloudinarySignature(apiSecret: string, timestamp: number): string {
    // Simplified signature generation - use proper crypto in production
    const crypto = require("crypto")
    const params = `timestamp=${timestamp}`
    return crypto
      .createHash("sha1")
      .update(params + apiSecret)
      .digest("hex")
  }

  async getUserInfo(accessToken: string, accountId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${accountId}?fields=id,username,account_type,media_count&access_token=${accessToken}`,
      )

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Failed to get Instagram user info:", error)
      return null
    }
  }

  async getRecentPosts(accessToken: string, accountId: string, limit = 10): Promise<InstagramPost[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${accountId}/media?fields=id,permalink,media_url,caption,timestamp,media_type&limit=${limit}&access_token=${accessToken}`,
      )

      if (!response.ok) {
        throw new Error(`Failed to get recent posts: ${response.statusText}`)
      }

      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error("Failed to get recent Instagram posts:", error)
      return []
    }
  }

  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/me?access_token=${accessToken}`)
      return response.ok
    } catch (error) {
      console.error("Failed to validate Instagram access token:", error)
      return false
    }
  }

  async getAccountInsights(accessToken: string, accountId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${accountId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${accessToken}`,
      )

      if (!response.ok) {
        throw new Error(`Failed to get insights: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Failed to get Instagram insights:", error)
      return null
    }
  }
}

// Export singleton instance
export const instagramClient = new InstagramClient()

// Helper functions
export async function postToInstagram(request: InstagramPostRequest): Promise<InstagramPostResponse> {
  return await instagramClient.postImage(request)
}

export async function validateInstagramCredentials(accessToken: string, accountId: string): Promise<boolean> {
  const isValid = await instagramClient.validateAccessToken(accessToken)
  if (!isValid) return false

  const userInfo = await instagramClient.getUserInfo(accessToken, accountId)
  return userInfo !== null
}

export async function getInstagramUserInfo(accessToken: string, accountId: string): Promise<any> {
  return await instagramClient.getUserInfo(accessToken, accountId)
}

export async function getRecentInstagramPosts(
  accessToken: string,
  accountId: string,
  limit = 10,
): Promise<InstagramPost[]> {
  return await instagramClient.getRecentPosts(accessToken, accountId, limit)
}
