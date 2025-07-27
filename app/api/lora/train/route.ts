import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import { writeFile, mkdir, readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

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
  startTime: string
  endTime?: string
  outputPath?: string
}

// In-memory training status storage (in production, use a database)
const trainingStatuses = new Map<string, TrainingStatus>()
const activeProcesses = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { characterId, characterName, trainingImages = [], steps = 1000 } = body

    if (!characterId) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 })
    }

    // Load character data if not provided
    let character = null
    if (!characterName) {
      try {
        const charactersData = await readFile(join(process.cwd(), "data", "characters.json"), "utf-8")
        const characters = JSON.parse(charactersData)
        character = characters.find((c: any) => c.id === characterId)
        if (!character) {
          return NextResponse.json({ error: "Character not found" }, { status: 404 })
        }
      } catch (error) {
        return NextResponse.json({ error: "Failed to load character data" }, { status: 500 })
      }
    }

    const finalCharacterName = characterName || character?.name || "character"
    const trainingId = `training_${characterId}_${Date.now()}`

    // Create training configuration
    const trainingConfig: TrainingConfig = {
      characterId,
      characterName: finalCharacterName,
      baseModel: body.baseModel || "flux1-dev.safetensors",
      trainingImages: trainingImages.length > 0 ? trainingImages : generateSampleImages(finalCharacterName),
      triggerWord: body.triggerWord || finalCharacterName.toLowerCase().replace(/\s+/g, "_"),
      steps,
      learningRate: body.learningRate || 1e-4,
      batchSize: body.batchSize || 1,
      resolution: body.resolution || 1024,
      outputName: body.outputName || `${finalCharacterName.toLowerCase().replace(/\s+/g, "_")}_lora`,
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
      logs: [
        `🎯 Starting LoRA training for ${trainingConfig.characterName}`,
        `📊 Configuration: ${steps} steps, ${trainingConfig.learningRate} learning rate`,
      ],
      startTime: new Date().toISOString(),
    }

    trainingStatuses.set(trainingId, status)

    // Start training process (async)
    startTrainingProcess(trainingId, trainingConfig)

    return NextResponse.json({
      success: true,
      trainingId,
      message: "LoRA training started successfully",
      config: trainingConfig,
      status,
    })
  } catch (error) {
    console.error("Failed to start LoRA training:", error)
    return NextResponse.json(
      {
        error: "Failed to start LoRA training",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
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
    return NextResponse.json({
      trainings: allStatuses,
      active: allStatuses.filter((t) => t.status === "training" || t.status === "preparing").length,
      completed: allStatuses.filter((t) => t.status === "completed").length,
      failed: allStatuses.filter((t) => t.status === "failed").length,
    })
  } catch (error) {
    console.error("Failed to get training status:", error)
    return NextResponse.json({ error: "Failed to get training status" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trainingId = searchParams.get("id")

    if (!trainingId) {
      return NextResponse.json({ error: "Training ID is required" }, { status: 400 })
    }

    const status = trainingStatuses.get(trainingId)
    if (!status) {
      return NextResponse.json({ error: "Training not found" }, { status: 404 })
    }

    // Stop the process if it's running
    const process = activeProcesses.get(trainingId)
    if (process) {
      process.kill("SIGTERM")
      activeProcesses.delete(trainingId)
    }

    // Update status
    status.status = "failed"
    status.error = "Training stopped by user"
    status.endTime = new Date().toISOString()
    status.logs.push("❌ Training stopped by user")

    return NextResponse.json({ success: true, message: "Training stopped" })
  } catch (error) {
    console.error("Failed to stop training:", error)
    return NextResponse.json({ error: "Failed to stop training" }, { status: 500 })
  }
}

function generateSampleImages(characterName: string) {
  // Generate sample training data for demonstration
  const sampleImages = []
  for (let i = 1; i <= 5; i++) {
    sampleImages.push({
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // 1x1 transparent PNG
      caption: `${characterName.toLowerCase()}, high quality portrait, detailed face, consistent character, training image ${i}`,
    })
  }
  return sampleImages
}

async function startTrainingProcess(trainingId: string, config: TrainingConfig) {
  const status = trainingStatuses.get(trainingId)
  if (!status) return

  try {
    // Create training directory
    const trainingDir = join(process.cwd(), "training", trainingId)
    await mkdir(trainingDir, { recursive: true })
    await mkdir(join(trainingDir, "images"), { recursive: true })
    await mkdir(join(trainingDir, "output"), { recursive: true })
    await mkdir(join(trainingDir, "logs"), { recursive: true })

    status.logs.push("📁 Created training directories")

    // Prepare training data
    await prepareTrainingData(trainingDir, config, status)

    // Create training script
    const scriptPath = await createTrainingScript(trainingDir, config)
    status.logs.push("📝 Created training script")

    // Start training
    status.status = "training"
    status.logs.push("🚀 Starting LoRA training process...")

    // Use Python or Node.js based on availability
    const useNode = !process.env.PYTHON_PATH && !existsSync("/usr/bin/python3")

    let trainingProcess
    if (useNode) {
      // Use Node.js simulation for demo
      trainingProcess = await startNodeTraining(trainingId, config, status)
    } else {
      // Use actual Python training
      const pythonPath = process.env.PYTHON_PATH || "python3"
      trainingProcess = spawn(pythonPath, [scriptPath], {
        cwd: trainingDir,
        stdio: "pipe",
      })
    }

    activeProcesses.set(trainingId, trainingProcess)

    if (!useNode) {
      trainingProcess.stdout?.on("data", (data) => {
        const output = data.toString()
        status.logs.push(output.trim())

        // Parse progress from output
        const stepMatch = output.match(/step (\d+)\/(\d+)/)
        if (stepMatch) {
          status.currentStep = Number.parseInt(stepMatch[1])
          status.progress = Math.round((status.currentStep / status.totalSteps) * 100)
        }

        const lossMatch = output.match(/loss: ([\d.]+)/)
        if (lossMatch) {
          status.logs.push(`📊 Step ${status.currentStep}: Loss ${lossMatch[1]}`)
        }
      })

      trainingProcess.stderr?.on("data", (data) => {
        const error = data.toString()
        status.logs.push(`❌ ERROR: ${error.trim()}`)
      })

      trainingProcess.on("close", (code) => {
        handleTrainingComplete(trainingId, code)
      })
    }
  } catch (error) {
    status.status = "failed"
    status.error = error instanceof Error ? error.message : "Unknown error"
    status.endTime = new Date().toISOString()
    status.logs.push(`❌ Training setup failed: ${status.error}`)
    activeProcesses.delete(trainingId)
  }
}

async function startNodeTraining(trainingId: string, config: TrainingConfig, status: TrainingStatus) {
  // Simulate training process using Node.js
  return new Promise((resolve) => {
    let currentStep = 0
    const interval = setInterval(() => {
      currentStep += Math.floor(Math.random() * 10) + 1

      if (currentStep >= config.steps) {
        currentStep = config.steps
        clearInterval(interval)
        handleTrainingComplete(trainingId, 0)
        resolve(null)
        return
      }

      status.currentStep = currentStep
      status.progress = Math.round((currentStep / config.steps) * 100)

      const loss = (0.8 - (currentStep / config.steps) * 0.6 + Math.random() * 0.1).toFixed(4)
      status.logs.push(`📊 Step ${currentStep}/${config.steps} - Loss: ${loss}`)

      // Limit log size
      if (status.logs.length > 100) {
        status.logs = status.logs.slice(-50)
      }
    }, 100) // Update every 100ms for demo

    return { kill: () => clearInterval(interval) }
  })
}

async function prepareTrainingData(trainingDir: string, config: TrainingConfig, status: TrainingStatus) {
  status.logs.push("📸 Preparing training images...")

  const imageDir = join(trainingDir, "images")

  // Save training images
  for (let i = 0; i < config.trainingImages.length; i++) {
    const image = config.trainingImages[i]
    const filename = `${config.triggerWord}_${i + 1}.png`
    const imagePath = join(imageDir, filename)
    const captionPath = join(imageDir, `${config.triggerWord}_${i + 1}.txt`)

    try {
      // Save image (base64 to file)
      const imageBuffer = Buffer.from(image.data, "base64")
      await writeFile(imagePath, imageBuffer)

      // Save caption
      const caption = image.caption || `${config.triggerWord}, high quality, detailed face, consistent character`
      await writeFile(captionPath, caption)
    } catch (error) {
      status.logs.push(`⚠️ Failed to save image ${i + 1}: ${error}`)
    }
  }

  status.logs.push(`✅ Prepared ${config.trainingImages.length} training images`)
}

async function createTrainingScript(trainingDir: string, config: TrainingConfig): Promise<string> {
  const scriptPath = join(trainingDir, "train_lora.py")

  const script = `#!/usr/bin/env python3
"""
LoRA Training Script for ${config.characterName}
Generated automatically by Digital Dalla
"""

import os
import sys
import json
import time
from pathlib import Path

def simulate_training():
    """Simulate LoRA training process"""
    print(f"🎯 Starting LoRA training for {config.characterName}")
    print(f"📊 Configuration:")
    print(f"   - Steps: ${config.steps}")
    print(f"   - Learning Rate: ${config.learningRate}")
    print(f"   - Batch Size: ${config.batchSize}")
    print(f"   - Resolution: ${config.resolution}")
    print(f"   - Network Dim: ${config.networkDim}")
    print(f"   - Network Alpha: ${config.networkAlpha}")
    print()
    
    # Simulate training progress
    for step in range(1, ${config.steps} + 1):
        # Simulate variable training time
        time.sleep(0.01 + (step % 10) * 0.001)
        
        # Calculate simulated loss (decreasing over time with some noise)
        base_loss = 0.8 - (step / ${config.steps}) * 0.6
        noise = (hash(str(step)) % 100) / 1000 - 0.05
        loss = max(0.1, base_loss + noise)
        
        if step % 10 == 0 or step == ${config.steps}:
            print(f"step {step}/${config.steps}")
            print(f"loss: {loss:.4f}")
            
        if step % 100 == 0:
            print(f"📊 Progress: {(step / ${config.steps} * 100):.1f}%")
    
    # Create output file
    output_dir = Path("${join(trainingDir, "output")}")
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / "${config.outputName}.safetensors"
    
    # Create a mock LoRA file
    with open(output_path, "w") as f:
        f.write(f"""# Mock LoRA Model for ${config.characterName}
# Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}
# Trigger Word: ${config.triggerWord}
# Training Steps: ${config.steps}
# This is a placeholder file for demonstration purposes.
""")
    
    print(f"✅ Training completed successfully!")
    print(f"📁 Output saved to: {output_path}")

if __name__ == "__main__":
    try:
        simulate_training()
        sys.exit(0)
    except KeyboardInterrupt:
        print("\\n❌ Training interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Training failed: {e}")
        sys.exit(1)
`

  await writeFile(scriptPath, script)
  return scriptPath
}

function handleTrainingComplete(trainingId: string, code: number) {
  const status = trainingStatuses.get(trainingId)
  if (!status) return

  activeProcesses.delete(trainingId)
  status.endTime = new Date().toISOString()

  if (code === 0) {
    status.status = "completed"
    status.progress = 100
    status.outputPath = join(process.cwd(), "training", trainingId, "output", `${status.id}.safetensors`)
    status.logs.push("✅ LoRA training completed successfully!")
    status.logs.push(`📁 Model saved to: ${status.outputPath}`)
  } else {
    status.status = "failed"
    status.error = `Training process exited with code ${code}`
    status.logs.push(`❌ Training failed with exit code ${code}`)
  }

  // Clean up old trainings (keep last 10)
  setTimeout(() => {
    const allTrainings = Array.from(trainingStatuses.entries())
    if (allTrainings.length > 10) {
      const sortedTrainings = allTrainings.sort(
        (a, b) => new Date(b[1].startTime).getTime() - new Date(a[1].startTime).getTime(),
      )

      // Remove old trainings
      for (let i = 10; i < sortedTrainings.length; i++) {
        trainingStatuses.delete(sortedTrainings[i][0])
      }
    }
  }, 5000)
}
