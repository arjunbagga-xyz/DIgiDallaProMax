// Script to detect and recover from missed runs when system comes back online
const fs = require("fs").promises
const path = require("path")

const SCHEDULE_FILE = path.join(process.cwd(), "data", "schedule.json")
const RECOVERY_LOG = path.join(process.cwd(), "logs", "recovery.log")

async function checkMissedRuns() {
  console.log("🔍 Checking for missed runs...")

  try {
    const data = await fs.readFile(SCHEDULE_FILE, "utf-8")
    const tasks = JSON.parse(data)

    const now = new Date()
    const missedTasks = []

    for (const task of tasks) {
      if (!task.active) continue

      const nextRun = new Date(task.nextRun)
      const lastRun = task.lastRun ? new Date(task.lastRun) : new Date(0)

      // Check if we missed a scheduled run
      if (nextRun < now && lastRun < nextRun) {
        const missedDuration = now.getTime() - nextRun.getTime()
        const hoursLate = Math.round(missedDuration / (1000 * 60 * 60))

        missedTasks.push({
          ...task,
          missedBy: hoursLate,
          scheduledTime: nextRun.toISOString(),
        })

        console.log(`⚠️  Missed run detected:`)
        console.log(`   Task: ${task.id} (${task.characterId})`)
        console.log(`   Scheduled: ${nextRun.toISOString()}`)
        console.log(`   Late by: ${hoursLate} hours`)
      }
    }

    if (missedTasks.length === 0) {
      console.log("✅ No missed runs detected")
      return
    }

    console.log(`🔄 Found ${missedTasks.length} missed runs, executing now...`)

    // Execute missed tasks
    for (const task of missedTasks) {
      try {
        console.log(`⚡ Executing missed task: ${task.id}`)

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

        if (response.ok) {
          const result = await response.json()
          console.log(`✅ Recovered task: ${task.id}`)

          await logRecovery(task, "SUCCESS", result)
        } else {
          console.log(`❌ Failed to recover task: ${task.id}`)
          await logRecovery(task, "FAILED", { error: response.statusText })
        }
      } catch (error) {
        console.error(`❌ Error recovering task ${task.id}:`, error)
        await logRecovery(task, "ERROR", { error: error.message })
      }

      // Wait between executions to avoid overwhelming APIs
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    console.log("🎉 Missed runs recovery completed")
  } catch (error) {
    console.error("❌ Error during missed runs check:", error)
  }
}

async function logRecovery(task, status, result) {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    taskId: task.id,
    characterId: task.characterId,
    scheduledTime: task.scheduledTime,
    missedBy: task.missedBy,
    status,
    result,
  }

  try {
    await fs.mkdir(path.dirname(RECOVERY_LOG), { recursive: true })
    await fs.appendFile(RECOVERY_LOG, JSON.stringify(logEntry) + "\n")
  } catch (error) {
    console.error("Error writing recovery log:", error)
  }
}

// Run the missed runs check
checkMissedRuns()
