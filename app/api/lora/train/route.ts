import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

interface TrainingConfig {
  characterId: string
  characterName: string
  baseModel: string
  trainingImages: { data: string; caption?: string }[]
  triggerWord: string
  steps: number
  learningRate: number
  batchSize: number
  resolution: number
  outputName: string
  networkDim: number
  networkAlpha: number
}

interface TrainingStatus {
  id: string
  status: "preparing" | "training" | "completed" | "failed"
  progress: number
  currentStep: number
  totalSteps: number
  logs: string[]
  error?: string
}

// In-memory training status storage (in production, use a database)
const trainingStatuses = new Map<string, TrainingStatus>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { characterId } = body

    if (!characterId) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 })
    }

    // Create training configuration
    const trainingId = `training_${characterId}_${Date.now()}`
    const trainingConfig: TrainingConfig = {
      characterId,
      characterName: body.characterName || "character",
      baseModel: body.baseModel || "flux1-dev.safetensors",
      trainingImages: body.trainingImages || [],
      triggerWord: body.triggerWord || characterId,
      steps: body.steps || 1000,
      learningRate: body.learningRate || 1e-4,
      batchSize: body.batchSize || 1,
      resolution: body.resolution || 1024,
      outputName: body.outputName || `${characterId}_lora`,
      networkDim: body.networkDim || 32,
      networkAlpha: body.networkAlpha || 16,
    }

    // Initialize training status
    const status: TrainingStatus = {
      id: trainingId,
      status: "preparing",
      progress: 0,
      currentStep: 0,
      totalSteps: trainingConfig.steps,
      logs: [`Training started for ${trainingConfig.characterName}`],
    }

    trainingStatuses.set(trainingId, status)

    // Start training process (async)
    startTrainingProcess(trainingId, trainingConfig)

    return NextResponse.json({
      success: true,
      trainingId,
      message: "LoRA training started",
      config: trainingConfig,
    })
  } catch (error) {
    console.error("Failed to start LoRA training:", error)
    return NextResponse.json({ error: "Failed to start LoRA training" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trainingId = searchParams.get("id")

    if (trainingId) {
      const status = trainingStatuses.get(trainingId)
      if (!status) {
        return NextResponse.json({ error: "Training not found" }, { status: 404 })
      }
      return NextResponse.json(status)
    }

    // Return all training statuses
    const allStatuses = Array.from(trainingStatuses.values())
    return NextResponse.json({ trainings: allStatuses })
  } catch (error) {
    console.error("Failed to get training status:", error)
    return NextResponse.json({ error: "Failed to get training status" }, { status: 500 })
  }
}

async function startTrainingProcess(trainingId: string, config: TrainingConfig) {
  const status = trainingStatuses.get(trainingId)
  if (!status) return

  try {
    // Create training directory
    const trainingDir = join(process.cwd(), "training", trainingId)
    await mkdir(trainingDir, { recursive: true })

    // Prepare training data
    await prepareTrainingData(trainingDir, config, status)

    // Create training script
    const scriptPath = await createTrainingScript(trainingDir, config)

    // Start training
    status.status = "training"
    status.logs.push("Starting LoRA training process...")

    const pythonPath = process.env.PYTHON_PATH || "python"
    const trainingProcess = spawn(pythonPath, [scriptPath], {
      cwd: trainingDir,
      stdio: "pipe",
    })

    trainingProcess.stdout?.on("data", (data) => {
      const output = data.toString()
      status.logs.push(output)

      // Parse progress from output
      const stepMatch = output.match(/step (\d+)\/(\d+)/)
      if (stepMatch) {
        status.currentStep = Number.parseInt(stepMatch[1])
        status.progress = Math.round((status.currentStep / status.totalSteps) * 100)
      }
    })

    trainingProcess.stderr?.on("data", (data) => {
      const error = data.toString()
      status.logs.push(`ERROR: ${error}`)
    })

    trainingProcess.on("close", (code) => {
      if (code === 0) {
        status.status = "completed"
        status.progress = 100
        status.logs.push("✅ LoRA training completed successfully!")
      } else {
        status.status = "failed"
        status.error = `Training process exited with code ${code}`
        status.logs.push(`❌ Training failed with exit code ${code}`)
      }
    })
  } catch (error) {
    status.status = "failed"
    status.error = error.message
    status.logs.push(`❌ Training setup failed: ${error.message}`)
  }
}

async function prepareTrainingData(trainingDir: string, config: TrainingConfig, status: TrainingStatus) {
  status.logs.push("Preparing training data...")

  const imageDir = join(trainingDir, "images")
  await mkdir(imageDir, { recursive: true })

  // Save training images
  for (let i = 0; i < config.trainingImages.length; i++) {
    const image = config.trainingImages[i]
    const filename = `${config.triggerWord}_${i + 1}.png`
    const imagePath = join(imageDir, filename)
    const captionPath = join(imageDir, `${config.triggerWord}_${i + 1}.txt`)

    // Save image
    await writeFile(imagePath, Buffer.from(image.data, "base64"))

    // Save caption
    const caption = image.caption || `${config.triggerWord}, high quality, detailed`
    await writeFile(captionPath, caption)
  }

  status.logs.push(`✅ Prepared ${config.trainingImages.length} training images`)
}

async function createTrainingScript(trainingDir: string, config: TrainingConfig): Promise<string> {
  const scriptPath = join(trainingDir, "train_lora.py")

  const script = `
import os
import sys
import json
from pathlib import Path

# Mock training script for demonstration
# In a real implementation, this would use Kohya SS or similar

def train_lora():
    print("Starting LoRA training...")
    print(f"Character: {config.characterName}")
    print(f"Steps: {config.steps}")
    print(f"Learning Rate: {config.learningRate}")
    
    # Simulate training progress
    import time
    for step in range(1, ${config.steps} + 1):
        time.sleep(0.1)  # Simulate training time
        if step % 100 == 0:
            print(f"step {step}/${config.steps}")
            print(f"loss: {0.5 - (step / ${config.steps}) * 0.3:.4f}")
    
    print("Training completed!")
    
    # Create output file
    output_path = Path("${join(trainingDir, "output", config.outputName)}.safetensors")
    output_path.parent.mkdir(exist_ok=True)
    output_path.write_text("# Mock LoRA model file")

if __name__ == "__main__":
    train_lora()
`

  await writeFile(scriptPath, script)
  return scriptPath
}
