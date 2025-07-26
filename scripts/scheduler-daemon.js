// Local scheduler daemon that runs continuously and handles missed runs
const fs = require("fs").promises
const path = require("path")
const { spawn } = require("child_process")

const SCHEDULE_FILE = path.join(process.cwd(), "data", "schedule.json")
const PID_FILE = path.join(process.cwd(), "scheduler.pid")
const LOG_FILE = path.join(process.cwd(), "logs", "scheduler.log")

class LocalScheduler {
  constructor() {
    this.running = false
    this.tasks = []
    this.checkInterval = 60000 // Check every minute
    this.lastCheck = new Date()
  }

  async start() {
    console.log("🚀 Starting Instagram AI Bot Local Scheduler...")

    // Save PID for process management
    await fs.writeFile(PID_FILE, process.pid.toString())

    this.running = true
    this.lastCheck = new Date()

    // Load tasks
    await this.loadTasks()

    // Start main loop
    this.mainLoop()

    // Handle graceful shutdown
    process.on("SIGINT", () => this.stop())
    process.on("SIGTERM", () => this.stop())

    console.log("✅ Local scheduler started successfully")
    console.log(`📊 Loaded ${this.tasks.length} tasks`)
    console.log(`⏰ Check interval: ${this.checkInterval / 1000}s`)
  }

  async stop() {
    console.log("🛑 Stopping local scheduler...")
    this.running = false

    try {
      await fs.unlink(PID_FILE)
    } catch (error) {
      // PID file might not exist
    }

    console.log("✅ Local scheduler stopped")
    process.exit(0)
  }

  async loadTasks() {
    try {
      const data = await fs.readFile(SCHEDULE_FILE, "utf-8")
      this.tasks = JSON.parse(data).filter((task) => task.active)
      console.log(`📋 Loaded ${this.tasks.length} active tasks`)
    } catch (error) {
      console.log("⚠️  No tasks file found, starting with empty schedule")
      this.tasks = []
    }
  }

  async mainLoop() {
    while (this.running) {
      try {
        await this.checkAndExecuteTasks()
        await this.sleep(this.checkInterval)
      } catch (error) {
        console.error("❌ Error in scheduler main loop:", error)
        await this.log(`ERROR: ${error.message}`)
        await this.sleep(this.checkInterval)
      }
    }
  }

  async checkAndExecuteTasks() {
    const now = new Date()

    // Reload tasks periodically
    if (now.getTime() - this.lastCheck.getTime() > 5 * 60 * 1000) {
      await this.loadTasks()
      this.lastCheck = now
    }

    for (const task of this.tasks) {
      try {
        const nextRun = new Date(task.nextRun)

        // Check if task should run
        if (nextRun <= now) {
          console.log(`⚡ Executing task: ${task.id} for character: ${task.characterId}`)
          await this.log(`Executing task: ${task.id} for character: ${task.characterId}`)

          await this.executeTask(task)

          // Update next run time
          task.lastRun = now.toISOString()
          task.nextRun = this.calculateNextRun(task.schedule, now)

          await this.saveTasks()

          console.log(`✅ Task completed: ${task.id}`)
          await this.log(`Task completed: ${task.id}`)
        }
      } catch (error) {
        console.error(`❌ Error executing task ${task.id}:`, error)
        await this.log(`ERROR executing task ${task.id}: ${error.message}`)
      }
    }
  }

  async executeTask(task) {
    // Execute task by calling the API endpoint
    const response = await fetch("http://localhost:3000/api/scheduler", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "run_now",
        task: task,
      }),
    })

    if (!response.ok) {
      throw new Error(`Task execution failed: ${response.statusText}`)
    }

    const result = await response.json()
    return result
  }

  calculateNextRun(cronExpression, fromTime = new Date()) {
    // Handle simple intervals
    if (cronExpression.match(/^\d+[hmd]$/)) {
      const value = Number.parseInt(cronExpression)
      const unit = cronExpression.slice(-1)

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

      return new Date(fromTime.getTime() + milliseconds).toISOString()
    }

    // For cron expressions, you'd use a proper cron library
    // Default to 1 hour
    return new Date(fromTime.getTime() + 60 * 60 * 1000).toISOString()
  }

  async saveTasks() {
    try {
      await fs.writeFile(SCHEDULE_FILE, JSON.stringify(this.tasks, null, 2))
    } catch (error) {
      console.error("Error saving tasks:", error)
    }
  }

  async log(message) {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${message}\n`

    try {
      await fs.mkdir(path.dirname(LOG_FILE), { recursive: true })
      await fs.appendFile(LOG_FILE, logEntry)
    } catch (error) {
      console.error("Error writing to log file:", error)
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Start the scheduler
const scheduler = new LocalScheduler()
scheduler.start().catch((error) => {
  console.error("Failed to start scheduler:", error)
  process.exit(1)
})
