import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

interface TrainingConfig {
  characterName: string
  baseModel: string
  trainingImages: string[] // base64 encoded images
  triggerWord: string
  steps: number
  learningRate: number
  batchSize: number
  resolution: number
  outputName: string
}

export async function POST(request: NextRequest) {
  try {
    const config: TrainingConfig = await request.json()

    console.log(`Starting LoRA training for ${config.characterName}`)

    // Create training directory
    const trainingDir = join(process.cwd(), "training", config.characterName)
    await mkdir(trainingDir, { recursive: true })

    // Save training images
    const imageDir = join(trainingDir, "images")
    await mkdir(imageDir, { recursive: true })

    for (let i = 0; i < config.trainingImages.length; i++) {
      const imageBuffer = Buffer.from(config.trainingImages[i], "base64")
      const imagePath = join(imageDir, `${config.triggerWord}_${i + 1}.png`)
      await writeFile(imagePath, imageBuffer)
    }

    // Create training config file for Kohya SS
    const kohyaConfig = {
      model_name: config.baseModel,
      pretrained_model_name_or_path: `models/checkpoints/${config.baseModel}`,
      train_data_dir: imageDir,
      output_dir: join(process.cwd(), "models", "loras"),
      output_name: config.outputName,
      resolution: config.resolution,
      train_batch_size: config.batchSize,
      max_train_steps: config.steps,
      learning_rate: config.learningRate,
      lr_scheduler: "cosine_with_restarts",
      lr_warmup_steps: Math.floor(config.steps * 0.1),
      mixed_precision: "fp16",
      save_precision: "fp16",
      caption_extension: ".txt",
      shuffle_caption: true,
      keep_tokens: 1,
      max_token_length: 225,
      bucket_reso_steps: 64,
      bucket_no_upscale: false,
      noise_offset: 0.1,
      adaptive_noise_scale: 0.00357,
      network_module: "networks.lora",
      network_dim: 128,
      network_alpha: 64,
      network_train_unet_only: true,
      network_train_text_encoder_only: false,
      training_comment: `LoRA for ${config.characterName}`,
    }

    const configPath = join(trainingDir, "config.toml")
    await writeFile(configPath, generateTOMLConfig(kohyaConfig))

    // Create caption files
    for (let i = 0; i < config.trainingImages.length; i++) {
      const captionPath = join(imageDir, `${config.triggerWord}_${i + 1}.txt`)
      const caption = `${config.triggerWord}, high quality, detailed face, consistent character`
      await writeFile(captionPath, caption)
    }

    // Start training process
    const trainingProcess = spawn("python", ["scripts/train_network.py", "--config_file", configPath])

    // Track training progress
    let progress = 0
    const trainingId = `${config.characterName}_${Date.now()}`

    trainingProcess.stdout.on("data", (data) => {
      const output = data.toString()
      console.log(`Training output: ${output}`)

      // Parse progress from output
      const stepMatch = output.match(/step (\d+)\/(\d+)/)
      if (stepMatch) {
        const currentStep = Number.parseInt(stepMatch[1])
        const totalSteps = Number.parseInt(stepMatch[2])
        progress = Math.round((currentStep / totalSteps) * 100)
      }
    })

    trainingProcess.stderr.on("data", (data) => {
      console.error(`Training error: ${data}`)
    })

    trainingProcess.on("close", (code) => {
      console.log(`Training process exited with code ${code}`)
    })

    return NextResponse.json({
      success: true,
      trainingId,
      message: "LoRA training started",
      config: kohyaConfig,
      estimatedTime: `${Math.round(config.steps / 100)} hours`,
    })
  } catch (error) {
    console.error("Error starting LoRA training:", error)
    return NextResponse.json({ error: "Failed to start training" }, { status: 500 })
  }
}

function generateTOMLConfig(config: any): string {
  let toml = ""
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      toml += `${key} = "${value}"\n`
    } else if (typeof value === "number") {
      toml += `${key} = ${value}\n`
    } else if (typeof value === "boolean") {
      toml += `${key} = ${value}\n`
    }
  }
  return toml
}

export async function GET(request: NextRequest) {
  // Get training status
  const { searchParams } = new URL(request.url)
  const trainingId = searchParams.get("id")

  if (!trainingId) {
    return NextResponse.json({ error: "Training ID required" }, { status: 400 })
  }

  // In a real implementation, you'd track training progress in a database
  // For now, return mock progress
  return NextResponse.json({
    trainingId,
    progress: 75,
    status: "training",
    eta: "45 minutes",
    currentStep: 750,
    totalSteps: 1000,
  })
}
