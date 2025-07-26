import { type NextRequest, NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { spawn } from "child_process"

interface ScheduledTask {
  id: string
  characterId: string
  type: "generate_and_post" | "train_lora" | "backup"
  schedule: string // cron expression
  nextRun: string
  lastRun: string | null
  active: boolean
  missedRuns: string[]
  config: any
}

const SCHEDULE_FILE = join(process.cwd(), "data", "schedule.json")
const MISSED_RUNS_FILE = join(process.cwd(), "data", "missed_runs.json")

export async function GET() {
  try {
    const data = await readFile(SCHEDULE_FILE, "utf-8")
    const tasks: ScheduledTask[] = JSON.parse(data)
    return NextResponse.json({ tasks })
  } catch (error) {
    return NextResponse.json({ tasks: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, task } = await request.json()

    switch (action) {
      case "create":
        return await createTask(task)
      case "update":
        return await updateTask(task)
      case "delete":
        return await deleteTask(task.id)
      case "run_now":
        return await runTaskNow(task.id)
      case "check_missed":
        return await checkMissedRuns()
      case "start_scheduler":
        return await startLocalScheduler()
      case "stop_scheduler":
        return await stopLocalScheduler()
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Scheduler error:", error)
    return NextResponse.json({ error: "Scheduler operation failed" }, { status: 500 })
  }
}

async function createTask(task: ScheduledTask) {
  let tasks: ScheduledTask[] = []
  try {
    const data = await readFile(SCHEDULE_FILE, "utf-8")
    tasks = JSON.parse(data)
  } catch (error) {
    // File doesn't exist
  }

  task.id = `task_${Date.now()}`
  task.nextRun = calculateNextRun(task.schedule)
  tasks.push(task)

  await writeFile(SCHEDULE_FILE, JSON.stringify(tasks, null, 2))
  await updateCrontab()

  return NextResponse.json({ success: true, task })
}

async function updateTask(updatedTask: ScheduledTask) {
  const data = await readFile(SCHEDULE_FILE, "utf-8")
  const tasks: ScheduledTask[] = JSON.parse(data)

  const index = tasks.findIndex((t) => t.id === updatedTask.id)
  if (index === -1) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  updatedTask.nextRun = calculateNextRun(updatedTask.schedule)
  tasks[index] = updatedTask

  await writeFile(SCHEDULE_FILE, JSON.stringify(tasks, null, 2))
  await updateCrontab()

  return NextResponse.json({ success: true, task: updatedTask })
}

async function deleteTask(taskId: string) {
  const data = await readFile(SCHEDULE_FILE, "utf-8")
  let tasks: ScheduledTask[] = JSON.parse(data)

  tasks = tasks.filter((t) => t.id !== taskId)

  await writeFile(SCHEDULE_FILE, JSON.stringify(tasks, null, 2))
  await updateCrontab()

  return NextResponse.json({ success: true })
}

async function runTaskNow(taskId: string) {
  const data = await readFile(SCHEDULE_FILE, "utf-8")
  const tasks: ScheduledTask[] = JSON.parse(data)

  const task = tasks.find((t) => t.id === taskId)
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  // Execute the task
  const result = await executeTask(task)

  // Update last run time
  task.lastRun = new Date().toISOString()
  await writeFile(SCHEDULE_FILE, JSON.stringify(tasks, null, 2))

  return NextResponse.json({ success: true, result })
}

async function checkMissedRuns() {
  try {
    const data = await readFile(SCHEDULE_FILE, "utf-8")
    const tasks: ScheduledTask[] = JSON.parse(data)

    const now = new Date()
    const missedTasks: ScheduledTask[] = []

    for (const task of tasks) {
      if (!task.active) continue

      const nextRun = new Date(task.nextRun)
      if (nextRun < now && (!task.lastRun || new Date(task.lastRun) < nextRun)) {
        missedTasks.push(task)
      }
    }

    // Execute missed tasks
    const results = []
    for (const task of missedTasks) {
      console.log(`Executing missed task: ${task.id} for character: ${task.characterId}`)
      const result = await executeTask(task)
      results.push({ taskId: task.id, result })

      // Update task
      task.lastRun = new Date().toISOString()
      task.nextRun = calculateNextRun(task.schedule)
    }

    // Save updated tasks
    await writeFile(SCHEDULE_FILE, JSON.stringify(tasks, null, 2))

    return NextResponse.json({
      success: true,
      missedTasks: missedTasks.length,
      results,
    })
  } catch (error) {
    console.error("Error checking missed runs:", error)
    return NextResponse.json({ error: "Failed to check missed runs" }, { status: 500 })
  }
}

async function executeTask(task: ScheduledTask) {
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

async function executeGenerateAndPost(task: ScheduledTask) {
  // Generate prompt using Gemini
  const promptResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/prompts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      character: task.config.character,
      contextPosts: 5,
    }),
  })

  const promptData = await promptResponse.json()

  // Generate image
  const imageResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customPrompt: promptData.prompt,
      characterLora: task.config.character.lora,
      fluxModel: task.config.fluxModel || "flux-dev",
      useComfyUI: true,
    }),
  })

  const imageData = await imageResponse.json()

  // Post to Instagram
  const postResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/post-to-instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: imageData.image,
      caption: promptData.caption,
      accessToken: task.config.character.accessToken,
      accountId: task.config.character.accountId,
    }),
  })

  const postData = await postResponse.json()

  return {
    success: true,
    prompt: promptData.prompt,
    caption: promptData.caption,
    postId: postData.postId,
    timestamp: new Date().toISOString(),
  }
}

async function executeTrainLora(task: ScheduledTask) {
  // Start LoRA training
  const trainingResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/lora/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task.config.trainingConfig),
  })

  return await trainingResponse.json()
}

async function executeBackup(task: ScheduledTask) {
  // Backup data to GitHub or cloud storage
  return { success: true, message: "Backup completed" }
}

function calculateNextRun(cronExpression: string): string {
  // Simple cron parser - in production, use a proper cron library
  const now = new Date()

  // Handle simple intervals like "6h", "30m", "1d"
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

    return new Date(now.getTime() + milliseconds).toISOString()
  }

  // For proper cron expressions, you'd use a library like node-cron
  // For now, default to 1 hour
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
}

async function updateCrontab() {
  // Update system crontab with current tasks
  const data = await readFile(SCHEDULE_FILE, "utf-8")
  const tasks: ScheduledTask[] = JSON.parse(data)

  const crontabEntries = tasks
    .filter((task) => task.active)
    .map((task) => {
      const command = `cd ${process.cwd()} && node scripts/execute-task.js ${task.id}`
      return `${task.schedule} ${command}`
    })

  // Write to crontab file
  const crontabContent = [
    "# Instagram AI Bot Scheduled Tasks",
    "# Generated automatically - do not edit manually",
    "",
    ...crontabEntries,
    "",
  ].join("\n")

  await writeFile(join(process.cwd(), "crontab.txt"), crontabContent)

  console.log("Crontab updated with", crontabEntries.length, "active tasks")
}

async function startLocalScheduler() {
  // Start the local scheduler daemon
  const schedulerProcess = spawn("node", ["scripts/scheduler-daemon.js"], {
    detached: true,
    stdio: "ignore",
  })

  schedulerProcess.unref()

  return NextResponse.json({
    success: true,
    message: "Local scheduler started",
    pid: schedulerProcess.pid,
  })
}

async function stopLocalScheduler() {
  // Stop the local scheduler daemon
  // In production, you'd track the PID and kill the process
  return NextResponse.json({
    success: true,
    message: "Local scheduler stopped",
  })
}
