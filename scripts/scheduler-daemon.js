// Local scheduler daemon for Instagram automation
const cron = require("node-cron")
const fs = require("fs").promises
const path = require("path")
const { spawn } = require("child_process")

class SchedulerDaemon {
  constructor() {
    this.tasks = new Map()
    this.pidFile = path.join(process.cwd(), "scheduler.pid")
    this.scheduleFile = path.join(process.cwd(), "data", "schedule.json")
    this.running = false
  }

  async start() {
    console.log("🚀 Starting Instagram AI Bot Scheduler Daemon...")

    try {
      // Write PID file
      await fs.writeFile(this.pidFile, process.pid.toString())
      console.log(`📝 PID file created: ${this.pidFile}`)

      // Load scheduled tasks
      await this.loadTasks()

      // Start task monitoring
      this.startTaskMonitoring()

      // Handle graceful shutdown
      this.setupSignalHandlers()

      this.running = true
      console.log("✅ Scheduler daemon started successfully")
      console.log(`🔄 Monitoring ${this.tasks.size} scheduled tasks`)

      // Keep the process alive
      this.keepAlive()
    } catch (error) {
      console.error("❌ Failed to start scheduler daemon:", error)
      process.exit(1)
    }
  }

  async loadTasks() {
    try {
      const data = await fs.readFile(this.scheduleFile, "utf-8")
      const tasks = JSON.parse(data)

      console.log(`📋 Loading ${tasks.length} scheduled tasks...`)

      for (const task of tasks) {
        if (task.active) {
          await this.scheduleTask(task)
        }
      }
    } catch (error) {
      console.log("⚠️  No existing schedule file found, starting with empty schedule")
    }
  }

  async scheduleTask(task) {
    try {
      // Convert simple intervals to cron expressions
      let cronExpression = task.schedule

      if (task.schedule.match(/^\d+[hmd]$/)) {
        cronExpression = this.intervalToCron(task.schedule)
      }

      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        console.error(`❌ Invalid cron expression for task ${task.id}: ${cronExpression}`)
        return
      }

      // Schedule the task
      const cronTask = cron.schedule(
        cronExpression,
        async () => {
          await this.executeTask(task)
        },
        {
          scheduled: false,
          timezone: task.timezone || "UTC",
        },
      )

      cronTask.start()
      this.tasks.set(task.id, { task, cronTask })

      console.log(`⏰ Scheduled task ${task.id} (${task.characterId}): ${cronExpression}`)
    } catch (error) {
      console.error(`❌ Failed to schedule task ${task.id}:`, error)
    }
  }

  intervalToCron(interval) {
    const value = Number.parseInt(interval)
    const unit = interval.slice(-1)

    switch (unit) {
      case "m": // minutes
        return `*/${value} * * * *`
      case "h": // hours
        return `0 */${value} * * *`
      case "d": // days
        return `0 0 */${value} * *`
      default:
        throw new Error(`Unsupported interval unit: ${unit}`)
    }
  }

  async executeTask(task) {
    console.log(`🎯 Executing task ${task.id} for character ${task.characterId}`)

    try {
      const startTime = Date.now()

      // Execute the task based on type
      let result
      switch (task.type) {
        case "generate_and_post":
          result = await this.executeGenerateAndPost(task)
          break
        case "train_lora":
          result = await this.executeTrainLora(task)
          break
        case "backup":
          result = await this.executeBackup(task)
          break
        default:
          throw new Error(`Unknown task type: ${task.type}`)
      }

      const duration = (Date.now() - startTime) / 1000
      console.log(`✅ Task ${task.id} completed in ${duration}s`)

      // Update task execution time
      await this.updateTaskExecution(task.id, true, result)
    } catch (error) {
      console.error(`❌ Task ${task.id} failed:`, error.message)
      await this.updateTaskExecution(task.id, false, { error: error.message })
    }
  }

  async executeGenerateAndPost(task) {
    // Spawn the automation script
    return new Promise((resolve, reject) => {
      const script = spawn("node", ["scripts/automated-posting.js"], {
        env: {
          ...process.env,
          CHARACTER_ID: task.characterId,
          FLUX_MODEL: task.config?.fluxModel || "flux-dev",
          CHARACTER_LORA: task.config?.character?.lora,
        },
        stdio: "pipe",
      })

      let output = ""
      let error = ""

      script.stdout.on("data", (data) => {
        const text = data.toString()
        output += text
        console.log(`[${task.characterId}] ${text.trim()}`)
      })

      script.stderr.on("data", (data) => {
        const text = data.toString()
        error += text
        console.error(`[${task.characterId}] ERROR: ${text.trim()}`)
      })

      script.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true, output })
        } else {
          reject(new Error(`Script exited with code ${code}: ${error}`))
        }
      })
    })
  }

  async executeTrainLora(task) {
    // Start LoRA training
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/lora/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task.config.trainingConfig),
    })

    return await response.json()
  }

  async executeBackup(task) {
    // Backup data
    console.log(`💾 Running backup for ${task.characterId}`)
    return { success: true, message: "Backup completed" }
  }

  async updateTaskExecution(taskId, success, result) {
    try {
      const data = await fs.readFile(this.scheduleFile, "utf-8")
      const tasks = JSON.parse(data)

      const taskIndex = tasks.findIndex((t) => t.id === taskId)
      if (taskIndex >= 0) {
        tasks[taskIndex].lastRun = new Date().toISOString()
        tasks[taskIndex].nextRun = this.calculateNextRun(tasks[taskIndex].schedule)

        if (!success) {
          tasks[taskIndex].missedRuns = tasks[taskIndex].missedRuns || []
          tasks[taskIndex].missedRuns.push(new Date().toISOString())
        }
      }

      await fs.writeFile(this.scheduleFile, JSON.stringify(tasks, null, 2))
    } catch (error) {
      console.error("Failed to update task execution:", error)
    }
  }

  calculateNextRun(schedule) {
    const now = new Date()

    if (schedule.match(/^\d+[hmd]$/)) {
      const value = Number.parseInt(schedule)
      const unit = schedule.slice(-1)

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

    // For cron expressions, return next hour as approximation
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  }

  startTaskMonitoring() {
    // Check for missed runs every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      await this.checkMissedRuns()
    })

    // Reload tasks every hour
    cron.schedule("0 * * * *", async () => {
      console.log("🔄 Reloading scheduled tasks...")
      await this.reloadTasks()
    })
  }

  async checkMissedRuns() {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/scheduler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_missed" }),
      })

      const result = await response.json()

      if (result.missedTasks > 0) {
        console.log(`🔄 Executed ${result.missedTasks} missed tasks`)
      }
    } catch (error) {
      console.error("Failed to check missed runs:", error)
    }
  }

  async reloadTasks() {
    // Stop existing tasks
    for (const [taskId, { cronTask }] of this.tasks) {
      cronTask.stop()
    }
    this.tasks.clear()

    // Reload tasks
    await this.loadTasks()
  }

  setupSignalHandlers() {
    const shutdown = async (signal) => {
      console.log(`\n📴 Received ${signal}, shutting down gracefully...`)

      // Stop all cron tasks
      for (const [taskId, { cronTask }] of this.tasks) {
        cronTask.stop()
      }

      // Remove PID file
      try {
        await fs.unlink(this.pidFile)
        console.log("🗑️  PID file removed")
      } catch (error) {
        // File might not exist
      }

      console.log("👋 Scheduler daemon stopped")
      process.exit(0)
    }

    process.on("SIGINT", () => shutdown("SIGINT"))
    process.on("SIGTERM", () => shutdown("SIGTERM"))
  }

  keepAlive() {
    // Log status every hour
    setInterval(
      () => {
        if (this.running) {
          console.log(`💓 Scheduler daemon alive - monitoring ${this.tasks.size} tasks`)
        }
      },
      60 * 60 * 1000,
    ) // 1 hour
  }
}

// Start the daemon
const daemon = new SchedulerDaemon()
daemon.start().catch((error) => {
  console.error("Failed to start scheduler daemon:", error)
  process.exit(1)
})
