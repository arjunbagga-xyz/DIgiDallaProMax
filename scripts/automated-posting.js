#!/usr/bin/env node

const fetch = require("node-fetch")
const fs = require("fs").promises
const path = require("path")

// Configuration
const CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  dataDir: path.join(process.cwd(), "data"),
  logDir: path.join(process.cwd(), "logs"),
  maxRetries: 3,
  retryDelay: 5000,
}

// Logging utility
class Logger {
  constructor() {
    this.ensureLogDir()
  }

  async ensureLogDir() {
    try {
      await fs.mkdir(CONFIG.logDir, { recursive: true })
    } catch (error) {
      console.error("Failed to create log directory:", error)
    }
  }

  async log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message,
      metadata,
      component: "automated-posting",
    }

    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`)

    try {
      const logFile = path.join(CONFIG.logDir, `automated-posting-${new Date().toISOString().split("T")[0]}.log`)
      await fs.appendFile(logFile, JSON.stringify(logEntry) + "\n")
    } catch (error) {
      console.error("Failed to write to log file:", error)
    }
  }

  info(message, metadata) {
    return this.log("info", message, metadata)
  }
  warn(message, metadata) {
    return this.log("warn", message, metadata)
  }
  error(message, metadata) {
    return this.log("error", message, metadata)
  }
  debug(message, metadata) {
    return this.log("debug", message, metadata)
  }
}

const logger = new Logger()

// API client
class APIClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    }

    let lastError
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        await logger.debug(`API request attempt ${attempt}`, { url, method: config.method || "GET" })

        const response = await fetch(url, config)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`)
        }

        await logger.debug("API request successful", { url, status: response.status })
        return data
      } catch (error) {
        lastError = error
        await logger.warn(`API request failed (attempt ${attempt}/${CONFIG.maxRetries})`, {
          url,
          error: error.message,
        })

        if (attempt < CONFIG.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, CONFIG.retryDelay * attempt))
        }
      }
    }

    throw lastError
  }

  async getCharacters() {
    return await this.request("/api/characters")
  }

  async getScheduledTasks() {
    return await this.request("/api/scheduler")
  }

  async generateImage(characterId, options = {}) {
    return await this.request("/api/generate-image", {
      method: "POST",
      body: JSON.stringify({
        characterId,
        ...options,
      }),
    })
  }

  async postToInstagram(imageData, caption, characterId) {
    return await this.request("/api/post-to-instagram", {
      method: "POST",
      body: JSON.stringify({
        imageBase64: imageData,
        caption,
        characterId,
      }),
    })
  }

  async runScheduler(taskId = null) {
    return await this.request("/api/scheduler", {
      method: "POST",
      body: JSON.stringify({
        action: "run_now",
        taskId,
      }),
    })
  }

  async updateTaskStatus(taskId, updates) {
    return await this.request("/api/scheduler", {
      method: "POST",
      body: JSON.stringify({
        action: "update_task",
        taskId,
        updates,
      }),
    })
  }
}

// Main automation class
class InstagramAutomation {
  constructor() {
    this.api = new APIClient(CONFIG.baseUrl)
    this.isRunning = false
  }

  async start() {
    if (this.isRunning) {
      await logger.warn("Automation already running, skipping...")
      return
    }

    this.isRunning = true
    await logger.info("🚀 Starting Instagram automation...")

    try {
      // Check system status
      await this.checkSystemHealth()

      // Load characters and tasks
      const characters = await this.loadCharacters()
      const tasks = await this.loadScheduledTasks()

      // Trigger the scheduler to run all due tasks
      await this.api.runScheduler()

      await logger.info("✅ Instagram automation cycle completed successfully")
    } catch (error) {
      await logger.error("❌ Instagram automation cycle failed", { error: error.message })
      throw error
    }
    } finally {
      this.isRunning = false
    }
  }

  async checkSystemHealth() {
    await logger.info("🔍 Checking system health...")

    try {
      const response = await fetch(`${CONFIG.baseUrl}/api/system/status`)
      const status = await response.json()

      if (status.comfyui !== "online") {
        throw new Error("ComfyUI is not online")
      }

      await logger.info("✅ System health check passed", {
        comfyui: status.comfyui,
        database: status.database,
        scheduler: status.scheduler,
      })
    } catch (error) {
      await logger.error("❌ System health check failed", { error: error.message })
      throw error
    }
  }

  async loadCharacters() {
    await logger.info("📋 Loading characters...")

    try {
      const response = await this.api.getCharacters()
      const characters = response.characters || []

      await logger.info(`✅ Loaded ${characters.length} characters`, {
        activeCharacters: characters.filter((c) => c.isActive).length,
      })

      return characters
    } catch (error) {
      await logger.error("❌ Failed to load characters", { error: error.message })
      throw error
    }
  }

  async loadScheduledTasks() {
    await logger.info("📅 Loading scheduled tasks...")

    try {
      const response = await this.api.getScheduledTasks()
      const tasks = response.tasks || []

      await logger.info(`✅ Loaded ${tasks.length} scheduled tasks`, {
        activeTasks: tasks.filter((t) => t.active).length,
      })

      return tasks
    } catch (error) {
      await logger.error("❌ Failed to load scheduled tasks", { error: error.message })
      throw error
    }
  }

  hasInstagramCredentials(character) {
    const accessTokenKey = `${character.name.toUpperCase().replace(/\s+/g, "_")}_INSTAGRAM_ACCESS_TOKEN`
    const accountIdKey = `${character.name.toUpperCase().replace(/\s+/g, "_")}_INSTAGRAM_ACCOUNT_ID`

    return process.env[accessTokenKey] && process.env[accountIdKey]
  }

  generateCaption(prompt, character) {
    const hashtags = [
      "#AIArt",
      "#GeneratedArt",
      "#DigitalArt",
      "#AIGenerated",
      "#ArtificialIntelligence",
      "#CreativeAI",
    ]

    if (character.name) {
      hashtags.push(`#${character.name.replace(/\s+/g, "")}`)
    }

    return `${prompt} ✨

Created with AI technology 🤖

${hashtags.join(" ")}`
  }

}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || "run"

  const automation = new InstagramAutomation()

  try {
    switch (command) {
      case "run":
        await automation.start()
        break
      case "test":
        await automation.checkSystemHealth()
        await logger.info("✅ System test completed")
        break
      case "status":
        const response = await fetch(`${CONFIG.baseUrl}/api/system/status`)
        const status = await response.json()
        console.log("System Status:", JSON.stringify(status, null, 2))
        break
      default:
        console.log("Usage: node automated-posting.js [run|test|status]")
        process.exit(1)
    }
  } catch (error) {
    await logger.error("❌ Automation failed", { error: error.message, stack: error.stack })
    process.exit(1)
  }
}

// Handle process signals
process.on("SIGINT", async () => {
  await logger.info("🛑 Received SIGINT, shutting down gracefully...")
  process.exit(0)
})

process.on("SIGTERM", async () => {
  await logger.info("🛑 Received SIGTERM, shutting down gracefully...")
  process.exit(0)
})

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { InstagramAutomation, Logger, APIClient }
