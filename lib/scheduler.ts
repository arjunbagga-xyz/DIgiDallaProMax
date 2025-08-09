import cron from "node-cron"
import { type NextRequest, NextResponse } from "next/server"

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

let isSchedulerRunning = false
const cronJobs = new Map()

async function fetchTasks() {
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

async function executeTask(task: any) {
  console.log(`🎯 Executing scheduled task: ${task.id} (${task.type})`)
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
  }
}

function scheduleTask(task: any) {
  if (!cron.validate(task.schedule)) {
    console.error(`❌ Invalid cron expression for task ${task.id}: ${task.schedule}`)
    return
  }

  const job = cron.schedule(
    task.schedule,
    () => executeTask(task),
    {
      timezone: task.timezone || "UTC",
    },
  )

  cronJobs.set(task.id, job)
  console.log(`⏰ Scheduled task ${task.id} (${task.characterId}): ${task.schedule}`)
}

async function reloadTasks() {
  try {
    const tasks = await fetchTasks()
    const activeTaskIds = new Set(tasks.map((t: any) => t.id))

    // Remove old or inactive jobs
    for (const [taskId, job] of cronJobs) {
      if (!activeTaskIds.has(taskId)) {
        job.stop()
        cronJobs.delete(taskId)
        console.log(`🗑️ Removed stale task: ${taskId}`)
      }
    }

    // Add new or update existing jobs
    for (const task of tasks) {
      if (task.active) {
        if (cronJobs.has(task.id)) {
          // Task exists, check if schedule changed
          const existingJob = cronJobs.get(task.id)
          if (existingJob.cronTime.source !== task.schedule) {
            existingJob.stop()
            scheduleTask(task)
            console.log(`🔄 Updated schedule for task: ${task.id}`)
          }
        } else {
          // New task
          scheduleTask(task)
        }
      } else {
        // Task is inactive, ensure it's stopped
        if (cronJobs.has(task.id)) {
          cronJobs.get(task.id).stop()
          cronJobs.delete(task.id)
        }
      }
    }

    console.log(`📊 Monitoring ${cronJobs.size} active tasks.`)
  } catch (error) {
    console.error("❌ Failed to reload tasks:", error)
  }
}

export function startScheduler() {
  if (isSchedulerRunning) {
    console.log("Scheduler is already running.")
    return
  }

  console.log("🚀 Starting Scheduler...")
  isSchedulerRunning = true

  // Periodically reload tasks every 5 minutes
  cron.schedule("*/5 * * * *", reloadTasks)

  // Initial load
  reloadTasks()

  console.log("✅ Scheduler started successfully")
}
