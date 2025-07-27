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

      // Process due tasks
      await this.processDueTasks(tasks, characters)

      // Check for missed runs
      await this.checkMissedRuns(tasks, characters)

      await logger.info("✅ Instagram automation completed successfully")
    } catch (error) {
      await logger.error("❌ Instagram automation failed", { error: error.message })
      throw error
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

  async processDueTasks(tasks, characters) {
    const now = new Date()
    const dueTasks = tasks.filter((task) => {
      if (!task.active) return false

      const nextRun = new Date(task.nextRun)
      return nextRun <= now
    })

    if (dueTasks.length === 0) {
      await logger.info("ℹ️ No tasks due for execution")
      return
    }

    await logger.info(`🎯 Processing ${dueTasks.length} due tasks...`)

    for (const task of dueTasks) {
      try {
        await this.executeTask(task, characters)
      } catch (error) {
        await logger.error(`❌ Task execution failed: ${task.id}`, {
          taskId: task.id,
          characterId: task.characterId,
          error: error.message,
        })
      }
    }
  }

  async executeTask(task, characters) {
    const character = characters.find((c) => c.id === task.characterId)
    if (!character) {
      throw new Error(`Character not found: ${task.characterId}`)
    }

    await logger.info(`🎯 Executing task for ${character.name}`, {
      taskId: task.id,
      taskType: task.type,
      characterId: character.id,
    })

    switch (task.type) {
      case "generate_and_post":
        await this.executeGenerateAndPost(task, character)
        break
      case "generate_only":
        await this.executeGenerateOnly(task, character)
        break
      case "train_lora":
        await this.executeTrainLora(task, character)
        break
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }

    // Update task status
    await this.api.updateTaskStatus(task.id, {
      lastRun: new Date().toISOString(),
      nextRun: this.calculateNextRun(task.schedule),
    })

    await logger.info(`✅ Task completed for ${character.name}`, { taskId: task.id })
  }

  async executeGenerateAndPost(task, character) {
    await logger.info(`🎨 Generating image for ${character.name}...`)

    // Generate image
    const generateOptions = {
      model: character.preferredModel,
      prompt: task.config?.prompt || character.promptSettings?.basePrompt,
      negativePrompt: task.config?.negativePrompt || character.promptSettings?.negativePrompt,
      loraPath: character.loraModelPath,
      triggerWord: character.triggerWord,
      steps: task.config?.steps || 20,
      cfg: task.config?.cfg || 7.5,
      width: task.config?.width || 1024,
      height: task.config?.height || 1024,
    }

    const generateResult = await this.api.generateImage(character.id, generateOptions)

    if (!generateResult.success) {
      throw new Error(`Image generation failed: ${generateResult.error}`)
    }

    await logger.info(`✅ Image generated for ${character.name}`)

    // Post to Instagram if enabled
    if (task.config?.postToInstagram !== false && this.hasInstagramCredentials(character)) {
      await logger.info(`📱 Posting to Instagram for ${character.name}...`)

      const caption = this.generateCaption(generateResult.prompt, character)
      const postResult = await this.api.postToInstagram(generateResult.imageData, caption, character.id)

      if (postResult.success) {
        await logger.info(`✅ Posted to Instagram for ${character.name}`, {
          postId: postResult.postId,
          permalink: postResult.permalink,
        })
      } else {
        await logger.warn(`⚠️ Instagram posting failed for ${character.name}`, {
          error: postResult.error,
        })
      }
    } else {
      await logger.info(`ℹ️ Instagram posting skipped for ${character.name}`, {
        reason: task.config?.postToInstagram === false ? "Disabled in task config" : "No Instagram credentials",
      })
    }
  }

  async executeGenerateOnly(task, character) {
    await logger.info(`🎨 Generating image only for ${character.name}...`)

    const generateOptions = {
      model: character.preferredModel,
      prompt: task.config?.prompt || character.promptSettings?.basePrompt,
      negativePrompt: task.config?.negativePrompt || character.promptSettings?.negativePrompt,
      loraPath: character.loraModelPath,
      triggerWord: character.triggerWord,
      steps: task.config?.steps || 20,
      cfg: task.config?.cfg || 7.5,
    }

    const generateResult = await this.api.generateImage(character.id, generateOptions)

    if (!generateResult.success) {
      throw new Error(`Image generation failed: ${generateResult.error}`)
    }

    await logger.info(`✅ Image generated for ${character.name} (no posting)`)
  }

  async executeTrainLora(task, character) {
    await logger.info(`🧠 Starting LoRA training for ${character.name}...`)

    const trainingResult = await this.api.request("/api/lora/train", {
      method: "POST",
      body: JSON.stringify({
        characterId: character.id,
        characterName: character.name,
        baseModel: character.preferredModel,
        triggerWord: character.triggerWord,
        steps: task.config?.steps || 1000,
        learningRate: task.config?.learningRate || 1e-4,
      }),
    })

    await logger.info(`✅ LoRA training started for ${character.name}`, {
      trainingId: trainingResult.trainingId,
    })
  }

  async checkMissedRuns(tasks, characters) {
    await logger.info("🔍 Checking for missed runs...")

    const now = new Date()
    let missedCount = 0

    for (const task of tasks) {
      if (!task.active) continue

      const lastRun = task.lastRun ? new Date(task.lastRun) : new Date(0)
      const expectedRun = this.calculatePreviousRun(task.schedule, now)

      if (expectedRun > lastRun) {
        await logger.warn(`⚠️ Missed run detected for task ${task.id}`, {
          taskId: task.id,
          characterName: task.characterName,
          expectedRun: expectedRun.toISOString(),
          lastRun: lastRun.toISOString(),
        })

        try {
          const character = characters.find((c) => c.id === task.characterId)
          if (character) {
            await this.executeTask(task, characters)
            missedCount++
          }
        } catch (error) {
          await logger.error(`❌ Failed to execute missed task ${task.id}`, {
            error: error.message,
          })
        }
      }
    }

    if (missedCount > 0) {
      await logger.info(`✅ Executed ${missedCount} missed tasks`)
    } else {
      await logger.info("ℹ️ No missed runs found")
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

  calculateNextRun(schedule) {
    const now = new Date()

    // Handle interval format (e.g., "6h", "30m", "1d")
    const intervalMatch = schedule.match(/^(\d+)([hmd])$/)
    if (intervalMatch) {
      const value = Number.parseInt(intervalMatch[1])
      const unit = intervalMatch[2]

      let milliseconds = 0
      switch (unit) {
        case "m":
          milliseconds = value * 60 * 1000
          break
        case "h":
          milliseconds = value * 60 * 60 * 1000
          break
        case "d":
          milliseconds = value * 24 * 60 * 60 * 1000
          break
      }

      return new Date(now.getTime() + milliseconds).toISOString()
    }

    // Handle cron format (simplified)
    const cronParts = schedule.split(" ")
    if (cronParts.length === 5) {
      const [minute, hour] = cronParts

      if (hour !== "*" && minute !== "*") {
        const nextRun = new Date(now)
        nextRun.setHours(Number.parseInt(hour), Number.parseInt(minute), 0, 0)

        // If time has passed today, schedule for tomorrow
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1)
        }

        return nextRun.toISOString()
      }
    }

    // Default: next hour
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  }

  calculatePreviousRun(schedule, currentTime) {
    // Simplified implementation - in production, use a proper cron parser
    const now = new Date(currentTime)

    // Handle interval format
    const intervalMatch = schedule.match(/^(\d+)([hmd])$/)
    if (intervalMatch) {
      const value = Number.parseInt(intervalMatch[1])
      const unit = intervalMatch[2]

      let milliseconds = 0
      switch (unit) {
        case "m":
          milliseconds = value * 60 * 1000
          break
        case "h":
          milliseconds = value * 60 * 60 * 1000
          break
        case "d":
          milliseconds = value * 24 * 60 * 60 * 1000
          break
      }

      return new Date(now.getTime() - milliseconds)
    }

    // Handle cron format
    const cronParts = schedule.split(" ")
    if (cronParts.length === 5) {
      const [minute, hour] = cronParts

      if (hour !== "*" && minute !== "*") {
        const previousRun = new Date(now)
        previousRun.setHours(Number.parseInt(hour), Number.parseInt(minute), 0, 0)

        // If time hasn't passed today, go to yesterday
        if (previousRun > now) {
          previousRun.setDate(previousRun.getDate() - 1)
        }

        return previousRun
      }
    }

    // Default: previous hour
    return new Date(now.getTime() - 60 * 60 * 1000)
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
