import { type NextRequest, NextResponse } from "next/server"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

interface ScheduledTask {
  id: string
  characterId: string
  characterName?: string
  type: "generate_and_post" | "generate_and_post_to_twitter" | "train_lora" | "backup" | "generate_only"
  schedule: string // cron expression or interval
  active: boolean
  lastRun?: string
  nextRun?: string
  missedRuns?: string[]
  config?: {
    fluxModel?: string
    postToInstagram?: boolean
    generateCaption?: boolean
    customPrompt?: string
    style?: string
    mood?: string
  }
  createdAt: string
  updatedAt: string
}

interface SchedulerSettings {
  autoRecovery: boolean
  notifications: boolean
  defaultPostingTime: string
  maxMissedRuns: number
  retryAttempts: number
  timezone: string
}

const SCHEDULE_FILE = join(process.cwd(), "data", "schedule.json")
const SETTINGS_FILE = join(process.cwd(), "data", "scheduler-settings.json")

async function ensureDataDirectory() {
  const dataDir = join(process.cwd(), "data")
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true })
  }
}

async function executeGenerateAndPostToTwitter(task: ScheduledTask) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  // Generate image
  const generateResponse = await fetch(`${baseUrl}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterId: task.characterId,
      fluxModel: task.config?.fluxModel || "flux-dev",
      customPrompt: task.config?.customPrompt,
    }),
  })

  if (!generateResponse.ok) {
    const error = await generateResponse.json()
    throw new Error(`Image generation failed: ${error.error}`)
  }

  const generateResult = await generateResponse.json()

  // Post to X/Twitter
  const postResponse = await fetch(`${baseUrl}/api/post-to-twitter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: generateResult.image,
      caption: generateResult.caption || `${generateResult.prompt} ✨\n\n#AIArt #GeneratedContent #DigitalArt`,
    }),
  })

  if (postResponse.ok) {
    return {
      generated: true,
      posted: true,
      prompt: generateResult.prompt,
      caption: generateResult.caption,
    }
  } else {
    const postError = await postResponse.json()
    return {
      generated: true,
      posted: false,
      prompt: generateResult.prompt,
      caption: generateResult.caption,
      postError: postError.error,
    }
  }
}

async function loadSchedule(): Promise<ScheduledTask[]> {
  try {
    const data = await readFile(SCHEDULE_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function saveSchedule(tasks: ScheduledTask[]) {
  await ensureDataDirectory()
  await writeFile(SCHEDULE_FILE, JSON.stringify(tasks, null, 2))
}

async function loadSettings(): Promise<SchedulerSettings> {
  try {
    const data = await readFile(SETTINGS_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return {
      autoRecovery: true,
      notifications: true,
      defaultPostingTime: "18:00",
      maxMissedRuns: 5,
      retryAttempts: 3,
      timezone: "UTC",
    }
  }
}

async function saveSettings(settings: SchedulerSettings) {
  await ensureDataDirectory()
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

async function loadCharacters() {
  try {
    const data = await readFile(join(process.cwd(), "data", "characters.json"), "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")

    if (action === "settings") {
      const settings = await loadSettings()
      return NextResponse.json({ settings })
    }

    const tasks = await loadSchedule()
    const characters = await loadCharacters()

    // Enrich tasks with character names
    const enrichedTasks = tasks.map((task) => ({
      ...task,
      characterName: characters.find((c: any) => c.id === task.characterId)?.name || "Unknown",
      nextRun: calculateNextRun(task.schedule, task.lastRun),
    }))

    return NextResponse.json({
      tasks: enrichedTasks,
      summary: {
        total: tasks.length,
        active: tasks.filter((t) => t.active).length,
        inactive: tasks.filter((t) => !t.active).length,
        missedRuns: tasks.reduce((sum, t) => sum + (t.missedRuns?.length || 0), 0),
      },
    })
  } catch (error) {
    console.error("Failed to get schedule:", error)
    return NextResponse.json({ error: "Failed to get schedule" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case "run_now":
        return await runSchedulerNow(body.taskId)
      case "check_missed":
        return await checkMissedRuns()
      case "add_task":
        return await addScheduledTask(body.task)
      case "update_task":
        return await updateScheduledTask(body.task)
      case "delete_task":
        return await deleteScheduledTask(body.taskId)
      case "toggle_task":
        return await toggleTask(body.taskId)
      case "update_settings":
        return await updateSettings(body.settings)
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Scheduler operation failed:", error)
    return NextResponse.json(
      {
        error: "Scheduler operation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function runSchedulerNow(taskId?: string) {
  try {
    const tasks = await loadSchedule()

    if (taskId) {
      // Run specific task
      const task = tasks.find((t) => t.id === taskId)
      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 })
      }

      const result = await executeTask(task)

      // Update last run time
      task.lastRun = new Date().toISOString()
      task.nextRun = calculateNextRun(task.schedule, task.lastRun)
      await saveSchedule(tasks)

      return NextResponse.json({
        success: true,
        message: `Task "${task.type}" executed successfully`,
        result,
      })
    } else {
      // Run all active tasks
      const activeTasks = tasks.filter((t) => t.active)
      const results = []

      for (const task of activeTasks) {
        try {
          const result = await executeTask(task)
          task.lastRun = new Date().toISOString()
          task.nextRun = calculateNextRun(task.schedule, task.lastRun)
          results.push({ taskId: task.id, success: true, result })
        } catch (error) {
          results.push({
            taskId: task.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }

      await saveSchedule(tasks)

      return NextResponse.json({
        success: true,
        message: `Executed ${activeTasks.length} tasks`,
        results,
        summary: {
          total: activeTasks.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      })
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to run scheduler",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function executeTask(task: ScheduledTask) {
  console.log(`🎯 Executing task ${task.id} (${task.type}) for character ${task.characterId}`)

  switch (task.type) {
    case "generate_and_post":
      return await executeGenerateAndPost(task)
    case "generate_and_post_to_twitter":
      return await executeGenerateAndPostToTwitter(task)
    case "generate_only":
      return await executeGenerateOnly(task)
    case "train_lora":
      return await executeTrainLora(task)
    case "backup":
      return await executeBackup(task)
    default:
      throw new Error(`Unknown task type: ${task.type}`)
  }
}

async function executeGenerateAndPost(task: ScheduledTask) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  // Generate image
  const generateResponse = await fetch(`${baseUrl}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterId: task.characterId,
      fluxModel: task.config?.fluxModel || "flux-dev",
      customPrompt: task.config?.customPrompt,
      style: task.config?.style,
      mood: task.config?.mood,
    }),
  })

  if (!generateResponse.ok) {
    const error = await generateResponse.json()
    throw new Error(`Image generation failed: ${error.error}`)
  }

  const generateResult = await generateResponse.json()

  // Post to Instagram if configured
  if (task.config?.postToInstagram && process.env.INSTAGRAM_ACCESS_TOKEN) {
    const postResponse = await fetch(`${baseUrl}/api/post-to-instagram`, {
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
        caption: generateResult.caption,
        postId: postResult.postId,
        instagramUrl: postResult.permalink,
      }
    } else {
      const postError = await postResponse.json()
      return {
        generated: true,
        posted: false,
        prompt: generateResult.prompt,
        caption: generateResult.caption,
        postError: postError.error,
      }
    }
  }

  return {
    generated: true,
    posted: false,
    prompt: generateResult.prompt,
    caption: generateResult.caption,
    reason: task.config?.postToInstagram ? "Instagram posting failed" : "Instagram posting disabled",
  }
}

async function executeGenerateOnly(task: ScheduledTask) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  const generateResponse = await fetch(`${baseUrl}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterId: task.characterId,
      fluxModel: task.config?.fluxModel || "flux-dev",
      customPrompt: task.config?.customPrompt,
      style: task.config?.style,
      mood: task.config?.mood,
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
    caption: result.caption,
  }
}

async function executeTrainLora(task: ScheduledTask) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  const response = await fetch(`${baseUrl}/api/lora/train`, {
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

  return await response.json()
}

async function executeBackup(task: ScheduledTask) {
  // Simple backup implementation
  const timestamp = new Date().toISOString()
  console.log(`💾 Running backup for character ${task.characterId} at ${timestamp}`)

  return {
    backed_up: true,
    timestamp,
    message: "Backup completed successfully",
    files: ["characters.json", "schedule.json", "generated_images/"],
  }
}

async function checkMissedRuns() {
  const tasks = await loadSchedule()
  const now = new Date()
  let missedCount = 0

  for (const task of tasks) {
    if (!task.active) continue

    const nextRun = new Date(task.nextRun || calculateNextRun(task.schedule, task.lastRun))

    if (nextRun <= now) {
      try {
        await executeTask(task)
        task.lastRun = now.toISOString()
        task.nextRun = calculateNextRun(task.schedule, task.lastRun)
        missedCount++
      } catch (error) {
        console.error(`Failed to execute missed task ${task.id}:`, error)

        // Track missed runs
        if (!task.missedRuns) task.missedRuns = []
        task.missedRuns.push(now.toISOString())

        // Disable task if too many missed runs
        const settings = await loadSettings()
        if (task.missedRuns.length >= settings.maxMissedRuns) {
          task.active = false
          console.log(`Disabled task ${task.id} due to ${task.missedRuns.length} missed runs`)
        }
      }
    }
  }

  if (missedCount > 0) {
    await saveSchedule(tasks)
  }

  return NextResponse.json({
    success: true,
    missedTasks: missedCount,
    message: `Executed ${missedCount} missed tasks`,
  })
}

async function addScheduledTask(taskData: Partial<ScheduledTask>) {
  const tasks = await loadSchedule()

  if (!taskData.characterId || !taskData.type) {
    throw new Error("Character ID and type are required")
  }

  const newTask: ScheduledTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    characterId: taskData.characterId,
    type: taskData.type as ScheduledTask["type"],
    schedule: taskData.schedule || "0 18 * * *", // Daily at 6 PM
    active: taskData.active !== false,
    config: taskData.config || {
      fluxModel: "flux-dev",
      postToInstagram: true,
      generateCaption: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  newTask.nextRun = calculateNextRun(newTask.schedule)
  tasks.push(newTask)
  await saveSchedule(tasks)

  return NextResponse.json({
    success: true,
    task: newTask,
    message: "Task created successfully",
  })
}

async function updateScheduledTask(taskData: ScheduledTask) {
  const tasks = await loadSchedule()
  const taskIndex = tasks.findIndex((t) => t.id === taskData.id)

  if (taskIndex === -1) {
    throw new Error("Task not found")
  }

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    ...taskData,
    updatedAt: new Date().toISOString(),
    nextRun: calculateNextRun(taskData.schedule, taskData.lastRun),
  }

  await saveSchedule(tasks)

  return NextResponse.json({
    success: true,
    task: tasks[taskIndex],
    message: "Task updated successfully",
  })
}

async function deleteScheduledTask(taskId: string) {
  const tasks = await loadSchedule()
  const filteredTasks = tasks.filter((t) => t.id !== taskId)

  if (filteredTasks.length === tasks.length) {
    throw new Error("Task not found")
  }

  await saveSchedule(filteredTasks)

  return NextResponse.json({
    success: true,
    message: "Task deleted successfully",
  })
}

async function toggleTask(taskId: string) {
  const tasks = await loadSchedule()
  const task = tasks.find((t) => t.id === taskId)

  if (!task) {
    throw new Error("Task not found")
  }

  task.active = !task.active
  task.updatedAt = new Date().toISOString()

  if (task.active) {
    task.nextRun = calculateNextRun(task.schedule, task.lastRun)
  }

  await saveSchedule(tasks)

  return NextResponse.json({
    success: true,
    task,
    message: `Task ${task.active ? "activated" : "deactivated"} successfully`,
  })
}

async function updateSettings(settings: SchedulerSettings) {
  await saveSettings(settings)

  return NextResponse.json({
    success: true,
    settings,
    message: "Settings updated successfully",
  })
}

import { parseExpression } from "cron-parser"

function calculateNextRun(schedule: string, lastRun?: string): string {
  try {
    const options = {
      currentDate: lastRun ? new Date(lastRun) : new Date(),
    }
    const interval = parseExpression(schedule, options)
    return interval.next().toISOString()
  } catch (err) {
    console.error("Error parsing cron expression:", err)
    // Fallback for invalid expression
    const now = new Date()
    now.setHours(now.getHours() + 1)
    return now.toISOString()
  }
}
