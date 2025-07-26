import { NextResponse } from "next/server"
import { comfyUI } from "@/lib/comfyui"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function GET() {
  const status = {
    comfyui: false,
    gemini: false,
    huggingface: false,
    instagram: false,
    scheduler: false,
  }

  // Check ComfyUI
  try {
    status.comfyui = await comfyUI.isAvailable()
  } catch (error) {
    console.log("ComfyUI check failed:", error.message)
  }

  // Check Gemini
  try {
    if (process.env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })
      await model.generateContent("test")
      status.gemini = true
    }
  } catch (error) {
    console.log("Gemini check failed:", error.message)
  }

  // Check Hugging Face
  try {
    if (process.env.HUGGINGFACE_TOKEN) {
      const response = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev", {
        headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}` },
      })
      status.huggingface = response.ok
    }
  } catch (error) {
    console.log("Hugging Face check failed:", error.message)
  }

  // Check Instagram (basic token validation)
  try {
    status.instagram = !!(process.env.EMMA_INSTAGRAM_ACCESS_TOKEN || process.env.MAYA_INSTAGRAM_ACCESS_TOKEN)
  } catch (error) {
    console.log("Instagram check failed:", error.message)
  }

  // Check scheduler (look for PID file)
  try {
    const fs = require("fs")
    status.scheduler = fs.existsSync("scheduler.pid")
  } catch (error) {
    console.log("Scheduler check failed:", error.message)
  }

  return NextResponse.json({
    status,
    healthy: Object.values(status).every(Boolean),
    timestamp: new Date().toISOString(),
  })
}
