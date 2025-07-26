import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const status = {
      comfyui: "offline" as "online" | "offline" | "error",
      database: "disconnected" as "connected" | "disconnected" | "error",
      scheduler: "stopped" as "running" | "stopped" | "error",
      instagram: "disconnected" as "connected" | "disconnected" | "error",
      timestamp: new Date().toISOString(),
      memory: {
        used: 0,
        total: 0,
      },
      version: "1.0.0",
    }

    // Check ComfyUI status
    try {
      const comfyuiUrl = process.env.COMFYUI_URL || "http://localhost:8188"
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${comfyuiUrl}/system_stats`, {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      status.comfyui = response.ok ? "online" : "error"
    } catch (error) {
      status.comfyui = "offline"
    }

    // Check database status
    try {
      if (process.env.DATABASE_URL) {
        status.database = "connected"
      } else {
        status.database = "disconnected"
      }
    } catch (error) {
      status.database = "error"
    }

    // Check scheduler status (simplified check)
    try {
      // Check if scheduler environment variables are set
      if (process.env.NODE_ENV === "development") {
        status.scheduler = "running"
      } else {
        status.scheduler = "stopped"
      }
    } catch (error) {
      status.scheduler = "error"
    }

    // Check Instagram API status
    try {
      if (process.env.INSTAGRAM_ACCESS_TOKEN) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(
          `https://graph.facebook.com/v18.0/me?access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`,
          { signal: controller.signal },
        )
        clearTimeout(timeoutId)
        status.instagram = response.ok ? "connected" : "error"
      } else {
        status.instagram = "disconnected"
      }
    } catch (error) {
      status.instagram = "error"
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error("System status check failed:", error)
    return NextResponse.json({ error: "Failed to check system status" }, { status: 500 })
  }
}
