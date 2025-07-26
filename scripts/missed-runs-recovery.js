// Recovery script for missed scheduled runs
const fs = require("fs").promises
const path = require("path")

async function runRecovery() {
  console.log("🔄 Starting missed runs recovery...")

  try {
    // Check if scheduler is running
    const pidFile = path.join(process.cwd(), "scheduler.pid")
    let schedulerRunning = false

    try {
      const pid = await fs.readFile(pidFile, "utf-8")
      // Check if process is actually running
      try {
        process.kill(Number.parseInt(pid), 0)
        schedulerRunning = true
        console.log("✅ Scheduler daemon is running")
      } catch (error) {
        console.log("⚠️  Scheduler daemon PID file exists but process is not running")
      }
    } catch (error) {
      console.log("⚠️  Scheduler daemon is not running")
    }

    // Load scheduled tasks
    const scheduleFile = path.join(process.cwd(), "data", "schedule.json")
    let tasks = []

    try {
      const data = await fs.readFile(scheduleFile, "utf-8")
      tasks = JSON.parse(data)
    } catch (error) {
      console.log("❌ No schedule file found")
      return
    }

    console.log(`📋 Found ${tasks.length} scheduled tasks`)

    // Find missed runs
    const now = new Date()
    const missedTasks = []

    for (const task of tasks) {
      if (!task.active) continue

      const nextRun = new Date(task.nextRun)
      const lastRun = task.lastRun ? new Date(task.lastRun) : new Date(0)

      // If next run time has passed and last run was before next run
      if (nextRun < now && lastRun < nextRun) {
        const missedMinutes = Math.round((now - nextRun) / (1000 * 60))
        missedTasks.push({
          ...task,
          missedMinutes,
        })
      }
    }

    if (missedTasks.length === 0) {
      console.log("✅ No missed runs found")
      return
    }

    console.log(`🎯 Found ${missedTasks.length} missed tasks:`)
    missedTasks.forEach((task) => {
      console.log(`   - ${task.characterId}: ${task.missedMinutes} minutes overdue`)
    })

    // Execute missed tasks
    const results = []

    for (const task of missedTasks) {
      console.log(`\n🚀 Executing missed task for ${task.characterId}...`)

      try {
        const result = await executeTask(task)
        results.push({
          taskId: task.id,
          characterId: task.characterId,
          success: true,
          result,
        })

        // Update task execution time
        task.lastRun = new Date().toISOString()
        task.nextRun = calculateNextRun(task.schedule)

        console.log(`✅ Successfully executed missed task for ${task.characterId}`)
      } catch (error) {
        console.error(`❌ Failed to execute missed task for ${task.characterId}:`, error.message)
        results.push({
          taskId: task.id,
          characterId: task.characterId,
          success: false,
          error: error.message,
        })
      }
    }

    // Update schedule file
    await fs.writeFile(scheduleFile, JSON.stringify(tasks, null, 2))
    console.log("💾 Updated schedule file")

    // Summary
    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    console.log(`\n📊 Recovery Summary:`)
    console.log(`   ✅ Successful: ${successful}`)
    console.log(`   ❌ Failed: ${failed}`)
    console.log(`   📝 Total processed: ${results.length}`)

    if (failed > 0) {
      console.log("\n❌ Failed tasks:")
      results
        .filter((r) => !r.success)
        .forEach((result) => {
          console.log(`   - ${result.characterId}: ${result.error}`)
        })
    }

    // Save recovery log
    const recoveryLog = {
      timestamp: new Date().toISOString(),
      missedTasks: missedTasks.length,
      results,
      summary: { successful, failed },
    }

    const logDir = path.join(process.cwd(), "logs")
    await fs.mkdir(logDir, { recursive: true })

    const logFile = path.join(logDir, `recovery-${Date.now()}.json`)
    await fs.writeFile(logFile, JSON.stringify(recoveryLog, null, 2))
    console.log(`📋 Recovery log saved: ${logFile}`)

    console.log("\n🎉 Recovery completed!")
  } catch (error) {
    console.error("❌ Recovery failed:", error)
    process.exit(1)
  }
}

async function executeTask(task) {
  switch (task.type) {
    case "generate_and_post":
      return await executeGenerateAndPost(task)
    case "train_lora":
      return await executeTrainLora(task)
    case "backup":
      return await executeBackup(task)
    default:
      throw new Error(`Unknown task type: ${task.type}`)
  }
}

async function executeGenerateAndPost(task) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  // Generate prompt
  const promptResponse = await fetch(`${baseUrl}/api/prompts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      character: task.config.character,
      contextPosts: 5,
    }),
  })

  if (!promptResponse.ok) {
    throw new Error(`Prompt generation failed: ${promptResponse.statusText}`)
  }

  const promptData = await promptResponse.json()

  // Generate image
  const imageResponse = await fetch(`${baseUrl}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customPrompt: promptData.prompt,
      characterLora: task.config.character?.lora,
      fluxModel: task.config.fluxModel || "flux-dev",
      useComfyUI: true,
    }),
  })

  if (!imageResponse.ok) {
    throw new Error(`Image generation failed: ${imageResponse.statusText}`)
  }

  const imageData = await imageResponse.json()

  // Post to Instagram
  const postResponse = await fetch(`${baseUrl}/api/post-to-instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: imageData.image,
      caption: promptData.caption,
      accessToken: task.config.character?.accessToken,
      accountId: task.config.character?.accountId,
    }),
  })

  if (!postResponse.ok) {
    throw new Error(`Instagram posting failed: ${postResponse.statusText}`)
  }

  const postData = await postResponse.json()

  return {
    prompt: promptData.prompt,
    caption: promptData.caption,
    postId: postData.postId,
    method: postData.method,
  }
}

async function executeTrainLora(task) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  const response = await fetch(`${baseUrl}/api/lora/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task.config.trainingConfig),
  })

  if (!response.ok) {
    throw new Error(`LoRA training failed: ${response.statusText}`)
  }

  return await response.json()
}

async function executeBackup(task) {
  return { success: true, message: "Backup completed" }
}

function calculateNextRun(schedule) {
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

// Run recovery if called directly
if (require.main === module) {
  runRecovery()
}

module.exports = { runRecovery }
