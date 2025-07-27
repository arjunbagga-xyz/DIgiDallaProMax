import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Check system components
    const status = {
      timestamp: new Date().toISOString(),
      status: "healthy",
      services: {
        database: await checkDatabase(),
        comfyui: await checkComfyUI(),
        scheduler: await checkScheduler(),
        storage: await checkStorage(),
      },
      system: {
        memory: getMemoryUsage(),
        environment: process.env.NODE_ENV || "development",
      },
    }

    // Determine overall health
    const allHealthy = Object.values(status.services).every((service) => service.status === "healthy")
    status.status = allHealthy ? "healthy" : "degraded"

    return NextResponse.json(status)
  } catch (error) {
    console.error("System status check failed:", error)
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

async function checkDatabase() {
  try {
    // Simple database connectivity check
    const { neon } = await import("@neondatabase/serverless")
    if (!process.env.DATABASE_URL) {
      return { status: "warning", message: "Database URL not configured" }
    }

    const sql = neon(process.env.DATABASE_URL)
    await sql`SELECT 1`
    return { status: "healthy", message: "Database connected" }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Database connection failed",
    }
  }
}

async function checkComfyUI() {
  try {
    const comfyUrl = process.env.COMFYUI_URL || "http://localhost:8188"
    const response = await fetch(`${comfyUrl}/system_stats`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (response.ok) {
      return { status: "healthy", message: "ComfyUI server responding" }
    } else {
      return { status: "error", message: `ComfyUI server returned ${response.status}` }
    }
  } catch (error) {
    return {
      status: "warning",
      message: "ComfyUI server not accessible (may be offline)",
    }
  }
}

async function checkScheduler() {
  try {
    // Check if scheduler lock file exists (indicates running)
    const fs = await import("fs").then((m) => m.promises)
    const path = await import("path")

    const lockFile = path.join(process.cwd(), "logs", "scheduler.lock")

    try {
      const stats = await fs.stat(lockFile)
      const age = Date.now() - stats.mtime.getTime()

      if (age < 60000) {
        // Less than 1 minute old
        return { status: "healthy", message: "Scheduler active" }
      } else {
        return { status: "warning", message: "Scheduler may be stale" }
      }
    } catch {
      return { status: "warning", message: "Scheduler not running" }
    }
  } catch (error) {
    return { status: "warning", message: "Cannot check scheduler status" }
  }
}

async function checkStorage() {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      return { status: "healthy", message: "Vercel Blob configured" }
    } else if (process.env.CLOUDINARY_URL) {
      return { status: "healthy", message: "Cloudinary configured" }
    } else {
      return { status: "warning", message: "No storage provider configured" }
    }
  } catch (error) {
    return { status: "error", message: "Storage check failed" }
  }
}

function getMemoryUsage() {
  try {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        used: Math.round(usage.heapUsed / 1024 / 1024),
        total: Math.round(usage.heapTotal / 1024 / 1024),
        unit: "MB",
      }
    }
    return { message: "Memory usage not available" }
  } catch {
    return { message: "Memory usage not available" }
  }
}
