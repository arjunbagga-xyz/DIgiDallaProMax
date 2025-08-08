// Fully functional scheduler for Instagram automation
const cron = require("node-cron")
const { spawn } = require("child_process")
const fetch = require("node-fetch")
const parser = require("cron-parser")

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

class Scheduler {
  constructor() {
    this.cronJobs = new Map()
    this.running = false
  }

  async start() {
    console.log("🚀 Starting Scheduler...")
    this.running = true
    this.setupSignalHandlers()
    this.scheduleReload() // Periodically reload tasks
    await this.reloadTasks()
    console.log("✅ Scheduler started successfully")
  }

  async stop() {
    console.log("📴 Stopping Scheduler...")
    this.running = false
    for (const [taskId, job] of this.cronJobs) {
      job.stop()
    }
    this.cronJobs.clear()
    console.log("👋 Scheduler stopped")
  }

  scheduleReload() {
    // Reload tasks every 5 minutes to catch any changes
    cron.schedule("*/5 * * * *", () => {
      if (this.running) {
        console.log("🔄 Reloading scheduled tasks...")
        this.reloadTasks()
      }
    })
  }

  async reloadTasks() {
    try {
      const tasks = await this.fetchTasks()
      this.updateCronJobs(tasks)
    } catch (error) {
      console.error("❌ Failed to reload tasks:", error)
    }
  }

  async fetchTasks() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler`)
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`)
      }
      const data = await response.json()
      return data.tasks || []
    } catch (error) {
      console.error("Error fetching tasks:", error)
      return []
    }
  }

  updateCronJobs(tasks) {
    const activeTaskIds = new Set(tasks.map((t) => t.id))

    // Remove old or inactive jobs
    for (const [taskId, job] of this.cronJobs) {
      if (!activeTaskIds.has(taskId)) {
        job.stop()
        this.cronJobs.delete(taskId)
        console.log(`🗑️ Removed stale task: ${taskId}`)
      }
    }

    // Add new or update existing jobs
    for (const task of tasks) {
      if (task.active) {
        if (this.cronJobs.has(task.id)) {
          // Task exists, check if schedule changed
          const existingJob = this.cronJobs.get(task.id)
          if (existingJob.cronTime.source !== task.schedule) {
            existingJob.stop()
            this.scheduleTask(task)
            console.log(`🔄 Updated schedule for task: ${task.id}`)
          }
        } else {
          // New task
          this.scheduleTask(task)
        }
      } else {
        // Task is inactive, ensure it's stopped
        if (this.cronJobs.has(task.id)) {
          this.cronJobs.get(task.id).stop()
          this.cronJobs.delete(task.id)
        }
      }
    }

    console.log(`📊 Monitoring ${this.cronJobs.size} active tasks.`)
  }

  scheduleTask(task) {
    if (!cron.validate(task.schedule)) {
      console.error(`❌ Invalid cron expression for task ${task.id}: ${task.schedule}`)
      return
    }

    const job = cron.schedule(
      task.schedule,
      () => this.executeTask(task),
      {
        timezone: task.timezone || "UTC",
      },
    )

    this.cronJobs.set(task.id, job)
    console.log(`⏰ Scheduled task ${task.id} (${task.characterId}): ${task.schedule}`)
  }

  async executeTask(task) {
    console.log(`🎯 Executing task: ${task.id} (${task.type})`)
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_now", taskId: task.id }),
      })

      if (!response.ok) {
        throw new Error(`Task execution failed: ${response.statusText}`)
      }

      const result = await response.json()
      console.log(`✅ Task ${task.id} completed successfully.`)
      return result
    } catch (error) {
      console.error(`❌ Error executing task ${task.id}:`, error)
      // Implement retry logic here if needed
    }
  }

  setupSignalHandlers() {
    const shutdown = (signal) => {
      console.log(`\n📴 Received ${signal}, shutting down...`)
      this.stop().then(() => process.exit(0))
    }
    process.on("SIGINT", () => shutdown("SIGINT"))
    process.on("SIGTERM", () => shutdown("SIGTERM"))
  }
}

// Start the daemon
const daemon = new SchedulerDaemon()
daemon.start().catch((error) => {
  console.error("Failed to start scheduler daemon:", error)
  process.exit(1)
})
