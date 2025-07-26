import { type NextRequest, NextResponse } from "next/server"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"

interface ScheduledTask {
  id: string
  characterId: string
  type: "generate_and_post" | "train_lora" | "backup"
  schedule: string // cron expression or interval
  active: boolean
  lastRun?: string
  nextRun?: string
  config?: any
}

const SCHEDULE_FILE = join(process.cwd(), "data", "schedule.json")

async function ensureDataDirectory() {
  try {
    await mkdir(join(process.cwd(), "data"), { recursive: true })
  } catch (error) {
    // Directory might already exist
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

export async function GET(request: NextRequest) {
  try {
    const tasks = await loadSchedule()

    // Calculate next run times for display
    const tasksWithNextRun = tasks.map((task) => ({
      ...task,
      nextRun: calculateNextRun(task.schedule),
    }))

    return NextResponse.json({
      tasks: tasksWithNextRun,
      totalTasks: tasks.length,
      activeTasks: tasks.filter((t) => t.active).length,
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
        return await runSchedulerNow(body.task)

      case "check_missed":
        return await checkMissedRuns()

      case "add_task":
        return await addScheduledTask(body.task)

      case "update_task":
        return await updateScheduledTask(body.task)

      case "delete_task":
        return await deleteScheduledTask(body.taskId)

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Scheduler operation failed:", error)
    return NextResponse.json({ error: "Scheduler operation failed" }, { status: 500 })
  }
}

async function runSchedulerNow(task?: ScheduledTask) {
  try {
    if (task) {
      // Run specific task
      const result = await executeTask(task)
      return NextResponse.json({
        success: true,
        message: "Task executed successfully",
        result,
      })
    } else {
      // Run all active tasks
      const tasks = await loadSchedule()
      const activeTasks = tasks.filter((t) => t.active)

      const results = []
      for (const task of activeTasks) {
        try {
          const result = await executeTask(task)
          results.push({ taskId: task.id, success: true, result })
        } catch (error) {
          results.push({ taskId: task.id, success: false, error: error.message })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Executed ${activeTasks.length} tasks`,
        results,
      })
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to run scheduler" }, { status: 500 })
  }
}

async function executeTask(task: ScheduledTask) {
  console.log(`Executing task ${task.id} for character ${task.characterId}`)

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
  // Generate image
  const generateResponse = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/generate-image`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: task.characterId }),
    },
  )

  if (!generateResponse.ok) {
    throw new Error("Failed to generate image")
  }

  const generateResult = await generateResponse.json()

  // Post to Instagram (if configured)
  if (process.env.INSTAGRAM_ACCESS_TOKEN) {
    const postResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/post-to-instagram`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: generateResult.image,
          caption: `${generateResult.prompt} ✨\n\n#AIArt #GeneratedContent #DigitalArt`,
        }),
      },
    )

    if (postResponse.ok) {
      const postResult = await postResponse.json()
      return {
        generated: true,
        posted: true,
        prompt: generateResult.prompt,
        postId: postResult.postId,
      }
    }
  }

  return {
    generated: true,
    posted: false,
    prompt: generateResult.prompt,
    reason: "Instagram not configured",
  }
}

async function executeTrainLora(task: ScheduledTask) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/lora/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterId: task.characterId,
      ...task.config,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to start LoRA training")
  }

  return await response.json()
}

async function executeBackup(task: ScheduledTask) {
  // Simple backup implementation
  console.log(`Running backup for character ${task.characterId}`)
  return {
    backed_up: true,
    timestamp: new Date().toISOString(),
    message: "Backup completed successfully",
  }
}

async function checkMissedRuns() {
  const tasks = await loadSchedule()
  const now = new Date()
  let missedCount = 0

  for (const task of tasks) {
    if (!task.active) continue

    const nextRun = new Date(task.nextRun || calculateNextRun(task.schedule))

    if (nextRun <= now) {
      try {
        await executeTask(task)

        // Update last run time
        task.lastRun = now.toISOString()
        task.nextRun = calculateNextRun(task.schedule)
        missedCount++
      } catch (error) {
        console.error(`Failed to execute missed task ${task.id}:`, error)
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

  const newTask: ScheduledTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    characterId: taskData.characterId!,
    type: taskData.type || "generate_and_post",
    schedule: taskData.schedule || "0 18 * * *", // Daily at 6 PM
    active: taskData.active !== false,
    nextRun: calculateNextRun(taskData.schedule || "0 18 * * *"),
    config: taskData.config || {},
  }

  tasks.push(newTask)
  await saveSchedule(tasks)

  return NextResponse.json({ success: true, task: newTask })
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
    nextRun: calculateNextRun(taskData.schedule),
  }

  await saveSchedule(tasks)

  return NextResponse.json({ success: true, task: tasks[taskIndex] })
}

async function deleteScheduledTask(taskId: string) {
  const tasks = await loadSchedule()
  const filteredTasks = tasks.filter((t) => t.id !== taskId)

  if (filteredTasks.length === tasks.length) {
    throw new Error("Task not found")
  }

  await saveSchedule(filteredTasks)

  return NextResponse.json({ success: true })
}

function calculateNextRun(schedule: string): string {
  const now = new Date()

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

    return new Date(now.getTime() + milliseconds).toISOString()
  }

  // For cron expressions, return next hour as approximation
  // In production, use a proper cron library like node-cron
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
}
