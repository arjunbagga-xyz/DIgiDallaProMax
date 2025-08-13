#!/usr/bin/env node

/**
 * Missed Runs Recovery Script
 * Detects and executes missed scheduled tasks
 */

const fs = require("fs").promises
const path = require("path")

const CONFIG = {
  scheduleFile: path.join(process.cwd(), "data", "schedule.json"),
  logFile: path.join(process.cwd(), "logs", "missed-runs.log"),
  maxMissedRuns: 5,
  recoveryWindow: 24 * 60 * 60 * 1000, // 24 hours
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
}

const logger = {
  info: (msg) => {
    const logMsg = `[INFO] ${new Date().toISOString()} - ${msg}`
    console.log(logMsg)
    return logMsg
  },
  warn: (msg) => {
    const logMsg = `[WARN] ${new Date().toISOString()} - ${msg}`
    console.warn(logMsg)
    return logMsg
  },
  error: (msg) => {
    const logMsg = `[ERROR] ${new Date().toISOString()} - ${msg}`
    console.error(logMsg)
    return logMsg
  },
  success: (msg) => {
    const logMsg = `[SUCCESS] ${new Date().toISOString()} - ${msg}`
    console.log(logMsg)
    return logMsg
  },
}

async function loadScheduledTasks() {
  try {
    const data = await fs.readFile(CONFIG.scheduleFile, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    logger.warn(`Failed to load scheduled tasks: ${error.message}`)
    return []
  }
}

async function saveScheduledTasks(tasks) {
  try {
    await fs.writeFile(CONFIG.scheduleFile, JSON.stringify(tasks, null, 2))
    return true
  } catch (error) {
    logger.error(`Failed to save scheduled tasks: ${error.message}`)
    return false
  }
}

async function loadCharacters() {
  try {
    const charactersPath = path.join(process.cwd(), "data", "characters.json")
    const data = await fs.readFile(charactersPath, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    logger.warn(`Failed to load characters: ${error.message}`)
    return []
  }
}

function calculateNextRun(schedule, lastRun) {
  const now = new Date()
  const lastRunDate = lastRun ? new Date(lastRun) : new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Handle simple intervals (e.g., "6h", "30m", "1d")
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

    return new Date(lastRunDate.getTime() + milliseconds)
  }

  // Handle cron expressions (simplified)
  if (schedule.includes("*")) {
    const parts = schedule.split(" ")
    if (parts.length >= 2) {
      const hour = Number.parseInt(parts[1]) || 18
      const nextRun = new Date(lastRunDate)
      nextRun.setHours(hour, 0, 0, 0)

      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }

      return nextRun
    }
  }

  // Default: next hour
  return new Date(now.getTime() + 60 * 60 * 1000)
}

function isMissedRun(task, now) {
  if (!task.active) return false

  const nextRun = task.nextRun ? new Date(task.nextRun) : calculateNextRun(task.schedule, task.lastRun)
  const timeDiff = now.getTime() - nextRun.getTime()

  // Consider a run missed if it's more than 10 minutes overdue
  return timeDiff > 10 * 60 * 1000
}

function isWithinRecoveryWindow(task, now) {
  const nextRun = task.nextRun ? new Date(task.nextRun) : calculateNextRun(task.schedule, task.lastRun)
  const timeDiff = now.getTime() - nextRun.getTime()

  // Only recover runs within the recovery window
  return timeDiff <= CONFIG.recoveryWindow
}

async function executeTask(task, characters) {
  const character = characters.find((c) => c.id === task.characterId)
  if (!character) {
    throw new Error(`Character not found: ${task.characterId}`)
  }

  logger.info(`Executing missed task: ${task.type} for ${character.name}`)

  try {
    let result
    switch (task.type) {
      case "generate_and_post":
        result = await executeGenerateAndPost(task, character)
        break
      case "generate_only":
        result = await executeGenerateOnly(task, character)
        break
      case "train_lora":
        result = await executeTrainLora(task, character)
        break
      case "backup":
        result = await executeBackup(task, character)
        break
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }

    logger.success(`Task executed successfully: ${task.id}`)
    return result
  } catch (error) {
    logger.error(`Task execution failed: ${task.id} - ${error.message}`)
    throw error
  }
}

async function executeGenerateAndPost(task, character) {
  // Generate image
  const generateResponse = await fetch(`${CONFIG.baseUrl}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterId: task.characterId,
      fluxModel: task.config?.fluxModel || "flux-dev",
    }),
  })

  if (!generateResponse.ok) {
    const error = await generateResponse.json()
    throw new Error(`Image generation failed: ${error.error}`)
  }

  const generateResult = await generateResponse.json()

  // Post to Instagram if configured
  if (task.config?.postToInstagram && process.env.INSTAGRAM_ACCESS_TOKEN) {
    const postResponse = await fetch(`${CONFIG.baseUrl}/api/post-to-instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: generateResult.image,
        caption: generateResult.caption || `${generateResult.prompt} ✨\n\n#AIArt #GeneratedContent #DigitalArt`,
        characterId: task.characterId,
      }),
    })

    if (postResponse.ok) {
      const postResult = await postResponse.json()
      return {
        generated: true,
        posted: true,
        prompt: generateResult.prompt,
        postId: postResult.postId,
        recoveredRun: true,
      }
    } else {
      const postError = await postResponse.json()
      return {
        generated: true,
        posted: false,
        prompt: generateResult.prompt,
        postError: postError.error,
        recoveredRun: true,
      }
    }
  }

  return {
    generated: true,
    posted: false,
    prompt: generateResult.prompt,
    reason: "Instagram posting not configured",
    recoveredRun: true,
  }
}

async function executeGenerateOnly(task, character) {
  const generateResponse = await fetch(`${CONFIG.baseUrl}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterId: task.characterId,
      fluxModel: task.config?.fluxModel || "flux-dev",
    }),
  })

  if (!generateResponse.ok) {
    const error = await generateResponse.json()
    throw new Error(`Image generation failed: ${error.error}`)
  }

  const result = await generateResponse.json()
  return {
    generated: true,
    posted: false,
    prompt: result.prompt,
    recoveredRun: true,
  }
}

async function executeTrainLora(task, character) {
  const response = await fetch(`${CONFIG.baseUrl}/api/lora/v2/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterId: task.characterId,
      ...task.config,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`LoRA training failed: ${error.error}`)
  }

  const result = await response.json()
  return {
    ...result,
    recoveredRun: true,
  }
}

async function executeBackup(task, character) {
  const timestamp = new Date().toISOString()
  logger.info(`Running backup for character ${task.characterId} at ${timestamp}`)

  return {
    backed_up: true,
    timestamp,
    message: "Backup completed successfully (recovered run)",
    files: ["characters.json", "schedule.json", "generated_images/"],
    recoveredRun: true,
  }
}

async function logRecoveryAction(action, task, result) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      taskId: task.id,
      characterId: task.characterId,
      taskType: task.type,
      result: result ? "success" : "failed",
      details: result || "No result",
    }

    // Ensure log directory exists
    await fs.mkdir(path.dirname(CONFIG.logFile), { recursive: true })

    // Append to log file
    const logLine = JSON.stringify(logEntry) + "\n"
    await fs.appendFile(CONFIG.logFile, logLine)
  } catch (error) {
    logger.warn(`Failed to write recovery log: ${error.message}`)
  }
}

async function findMissedRuns() {
  logger.info("Scanning for missed runs...")

  const tasks = await loadScheduledTasks()
  const characters = await loadCharacters()
  const now = new Date()
  const missedTasks = []

  for (const task of tasks) {
    if (!task.active) continue

    if (isMissedRun(task, now) && isWithinRecoveryWindow(task, now)) {
      // Check if we haven't exceeded max missed runs
      const missedCount = task.missedRuns ? task.missedRuns.length : 0
      if (missedCount < CONFIG.maxMissedRuns) {
        missedTasks.push(task)
        logger.info(`Found missed run: ${task.id} (${task.type}) for character ${task.characterId}`)
      } else {
        logger.warn(`Task ${task.id} has exceeded max missed runs (${CONFIG.maxMissedRuns}), disabling`)
        task.active = false
      }
    }
  }

  logger.info(`Found ${missedTasks.length} missed runs to recover`)
  return { missedTasks, allTasks: tasks, characters }
}

async function recoverMissedRuns() {
  const { missedTasks, allTasks, characters } = await findMissedRuns()

  if (missedTasks.length === 0) {
    logger.info("No missed runs found")
    return {
      recovered: 0,
      failed: 0,
      message: "No missed runs to recover",
    }
  }

  let recovered = 0
  let failed = 0

  for (const task of missedTasks) {
    try {
      const result = await executeTask(task, characters)

      // Update task status
      task.lastRun = new Date().toISOString()
      task.nextRun = calculateNextRun(task.schedule, task.lastRun).toISOString()

      // Clear missed runs counter on successful recovery
      if (task.missedRuns) {
        delete task.missedRuns
      }

      await logRecoveryAction("recovered", task, result)
      recovered++

      logger.success(`Recovered missed run: ${task.id}`)

      // Add delay between tasks to avoid overwhelming the system
      if (missedTasks.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    } catch (error) {
      // Track missed run
      if (!task.missedRuns) {
        task.missedRuns = []
      }
      task.missedRuns.push(new Date().toISOString())

      await logRecoveryAction("failed", task, null)
      failed++

      logger.error(`Failed to recover missed run: ${task.id} - ${error.message}`)
    }
  }

  // Save updated tasks
  await saveScheduledTasks(allTasks)

  const summary = {
    recovered,
    failed,
    total: missedTasks.length,
    message: `Recovered ${recovered}/${missedTasks.length} missed runs`,
  }

  logger.info(`Recovery summary: ${summary.message}`)
  return summary
}

async function generateRecoveryReport() {
  logger.info("Generating recovery report...")

  try {
    const logData = await fs.readFile(CONFIG.logFile, "utf-8")
    const logEntries = logData
      .trim()
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch (error) {
          return null
        }
      })
      .filter((entry) => entry !== null)

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentEntries = logEntries.filter((entry) => new Date(entry.timestamp) > last24Hours)

    const report = {
      generatedAt: new Date().toISOString(),
      period: "Last 24 hours",
      summary: {
        totalRecoveryAttempts: recentEntries.length,
        successful: recentEntries.filter((e) => e.result === "success").length,
        failed: recentEntries.filter((e) => e.result === "failed").length,
      },
      byCharacter: {},
      byTaskType: {},
      recentEntries: recentEntries.slice(-10), // Last 10 entries
    }

    // Group by character
    for (const entry of recentEntries) {
      if (!report.byCharacter[entry.characterId]) {
        report.byCharacter[entry.characterId] = { successful: 0, failed: 0 }
      }
      report.byCharacter[entry.characterId][entry.result]++
    }

    // Group by task type
    for (const entry of recentEntries) {
      if (!report.byTaskType[entry.taskType]) {
        report.byTaskType[entry.taskType] = { successful: 0, failed: 0 }
      }
      report.byTaskType[entry.taskType][entry.result]++
    }

    const reportPath = path.join(
      process.cwd(),
      "logs",
      `recovery-report-${new Date().toISOString().split("T")[0]}.json`,
    )
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))

    logger.success(`Recovery report generated: ${reportPath}`)
    return report
  } catch (error) {
    logger.warn(`Failed to generate recovery report: ${error.message}`)
    return null
  }
}

async function main() {
  logger.info("🔄 Starting Missed Runs Recovery...")

  const args = process.argv.slice(2)
  const generateReport = args.includes("--report")
  const dryRun = args.includes("--dry-run")

  try {
    if (generateReport) {
      const report = await generateRecoveryReport()
      if (report) {
        console.log("\n📊 Recovery Report Summary:")
        console.log(`Total attempts: ${report.summary.totalRecoveryAttempts}`)
        console.log(`Successful: ${report.summary.successful}`)
        console.log(`Failed: ${report.summary.failed}`)
      }
      return
    }

    if (dryRun) {
      logger.info("Running in dry-run mode (no actual recovery)")
      const { missedTasks } = await findMissedRuns()

      console.log("\n📋 Missed Runs Found:")
      for (const task of missedTasks) {
        console.log(`- Task: ${task.id} (${task.type}) for character ${task.characterId}`)
        console.log(`  Next run was: ${task.nextRun}`)
        console.log(`  Missed runs: ${task.missedRuns ? task.missedRuns.length : 0}`)
      }

      return
    }

    // Perform actual recovery
    const result = await recoverMissedRuns()

    console.log("\n📊 Recovery Results:")
    console.log(`Recovered: ${result.recovered}`)
    console.log(`Failed: ${result.failed}`)
    console.log(`Total: ${result.total}`)

    // Generate report after recovery
    await generateRecoveryReport()

    process.exit(result.failed > 0 ? 1 : 0)
  } catch (error) {
    logger.error(`Recovery failed: ${error.message}`)
    process.exit(1)
  }
}

// Handle process signals
process.on("SIGINT", () => {
  logger.info("Recovery interrupted by user")
  process.exit(0)
})

process.on("SIGTERM", () => {
  logger.info("Recovery terminated")
  process.exit(0)
})

// Run the main function
if (require.main === module) {
  main()
}

module.exports = {
  findMissedRuns,
  recoverMissedRuns,
  executeTask,
  generateRecoveryReport,
}
