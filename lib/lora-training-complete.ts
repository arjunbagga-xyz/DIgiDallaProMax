// Complete LoRA training integration with Kohya SS
import { spawn, type ChildProcess } from "child_process"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import process from "process"

export interface LoRATrainingConfig {
  characterName: string
  baseModel: string
  trainingImages: { data: string; caption?: string }[] // base64 + optional caption
  triggerWord: string
  steps: number
  learningRate: number
  batchSize: number
  resolution: number
  outputName: string
  networkDim: number
  networkAlpha: number
}

export interface TrainingProgress {
  id: string
  status: "preparing" | "training" | "completed" | "failed"
  progress: number
  currentStep: number
  totalSteps: number
  eta: string
  logs: string[]
  error?: string
}

export class LoRATrainer {
  private activeTrainings = new Map<string, { process: ChildProcess; progress: TrainingProgress }>()
  private kohyaPath: string

  constructor(kohyaPath = "kohya_ss") {
    this.kohyaPath = kohyaPath
  }

  async startTraining(config: LoRATrainingConfig): Promise<string> {
    const trainingId = `${config.characterName}_${Date.now()}`
    const trainingDir = join(process.cwd(), "training", trainingId)

    console.log(`🎯 Starting LoRA training: ${trainingId}`)

    try {
      // Prepare training data
      await this.prepareTrainingData(trainingDir, config)

      // Create training configuration
      const configPath = await this.createTrainingConfig(trainingDir, config)

      // Start training process
      const process = await this.startTrainingProcess(configPath, trainingId)

      // Track progress
      const progress: TrainingProgress = {
        id: trainingId,
        status: "training",
        progress: 0,
        currentStep: 0,
        totalSteps: config.steps,
        eta: this.estimateTrainingTime(config),
        logs: [],
      }

      this.activeTrainings.set(trainingId, { process, progress })

      return trainingId
    } catch (error) {
      console.error(`Failed to start training ${trainingId}:`, error)
      throw error
    }
  }

  private async prepareTrainingData(trainingDir: string, config: LoRATrainingConfig): Promise<void> {
    // Create directory structure
    const imageDir = join(trainingDir, "images")
    const logDir = join(trainingDir, "logs")
    const outputDir = join(trainingDir, "output")

    await mkdir(imageDir, { recursive: true })
    await mkdir(logDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })

    // Save training images with captions
    for (let i = 0; i < config.trainingImages.length; i++) {
      const image = config.trainingImages[i]
      const filename = `${config.triggerWord}_${i + 1}.png`
      const imagePath = join(imageDir, filename)
      const captionPath = join(imageDir, `${config.triggerWord}_${i + 1}.txt`)

      // Save image
      await writeFile(imagePath, Buffer.from(image.data, "base64"))

      // Save caption
      const caption = image.caption || `${config.triggerWord}, high quality, detailed face, consistent character`
      await writeFile(captionPath, caption)
    }

    console.log(`✅ Prepared ${config.trainingImages.length} training images`)
  }

  private async createTrainingConfig(trainingDir: string, config: LoRATrainingConfig): Promise<string> {
    const configPath = join(trainingDir, "training_config.toml")

    const tomlConfig = `
# LoRA Training Configuration for ${config.characterName}
[model]
pretrained_model_name_or_path = "${join(process.cwd(), "models", "checkpoints", config.baseModel)}"
v2 = false
v_parameterization = false

[dataset]
train_data_dir = "${join(trainingDir, "images")}"
resolution = ${config.resolution}
batch_size = ${config.batchSize}
max_train_steps = ${config.steps}
shuffle_caption = true
keep_tokens = 1
caption_extension = ".txt"

[training]
learning_rate = ${config.learningRate}
lr_scheduler = "cosine_with_restarts"
lr_warmup_steps = ${Math.floor(config.steps * 0.1)}
optimizer_type = "AdamW8bit"
mixed_precision = "fp16"
save_precision = "fp16"
gradient_checkpointing = true
gradient_accumulation_steps = 1

[network]
network_module = "networks.lora"
network_dim = ${config.networkDim}
network_alpha = ${config.networkAlpha}
network_train_unet_only = true
network_train_text_encoder_only = false

[output]
output_dir = "${join(trainingDir, "output")}"
output_name = "${config.outputName}"
save_model_as = "safetensors"
save_every_n_epochs = 1

[logging]
logging_dir = "${join(trainingDir, "logs")}"
log_with = "tensorboard"

[advanced]
noise_offset = 0.1
adaptive_noise_scale = 0.00357
multires_noise_iterations = 10
multires_noise_discount = 0.1
sample_every_n_steps = 100
sample_prompts = "${config.triggerWord}, masterpiece, best quality"
`

    await writeFile(configPath, tomlConfig)
    return configPath
  }

  private async startTrainingProcess(configPath: string, trainingId: string): Promise<ChildProcess> {
    const pythonPath = process.env.PYTHON_PATH || "python"
    const trainScript = join(this.kohyaPath, "train_network.py")

    const process = spawn(pythonPath, [trainScript, "--config_file", configPath], {
      stdio: ["pipe", "pipe", "pipe"],
    })

    // Handle process output
    process.stdout?.on("data", (data) => {
      const output = data.toString()
      this.handleTrainingOutput(trainingId, output)
    })

    process.stderr?.on("data", (data) => {
      const error = data.toString()
      this.handleTrainingError(trainingId, error)
    })

    process.on("close", (code) => {
      this.handleTrainingComplete(trainingId, code)
    })

    return process
  }

  private handleTrainingOutput(trainingId: string, output: string): void {
    const training = this.activeTrainings.get(trainingId)
    if (!training) return

    training.progress.logs.push(output)

    // Parse progress from output
    const stepMatch = output.match(/step (\d+)\/(\d+)/)
    if (stepMatch) {
      training.progress.currentStep = Number.parseInt(stepMatch[1])
      training.progress.totalSteps = Number.parseInt(stepMatch[2])
      training.progress.progress = Math.round((training.progress.currentStep / training.progress.totalSteps) * 100)
    }

    // Parse loss information
    const lossMatch = output.match(/loss: ([\d.]+)/)
    if (lossMatch) {
      console.log(`Training ${trainingId} - Step ${training.progress.currentStep}: Loss ${lossMatch[1]}`)
    }
  }

  private handleTrainingError(trainingId: string, error: string): void {
    const training = this.activeTrainings.get(trainingId)
    if (!training) return

    training.progress.logs.push(`ERROR: ${error}`)
    console.error(`Training ${trainingId} error:`, error)
  }

  private handleTrainingComplete(trainingId: string, code: number): void {
    const training = this.activeTrainings.get(trainingId)
    if (!training) return

    if (code === 0) {
      training.progress.status = "completed"
      training.progress.progress = 100
      console.log(`✅ Training completed successfully: ${trainingId}`)
    } else {
      training.progress.status = "failed"
      training.progress.error = `Training process exited with code ${code}`
      console.error(`❌ Training failed: ${trainingId} (exit code: ${code})`)
    }

    // Clean up after a delay
    setTimeout(() => {
      this.activeTrainings.delete(trainingId)
    }, 300000) // Keep for 5 minutes
  }

  getTrainingProgress(trainingId: string): TrainingProgress | null {
    const training = this.activeTrainings.get(trainingId)
    return training ? training.progress : null
  }

  async stopTraining(trainingId: string): Promise<boolean> {
    const training = this.activeTrainings.get(trainingId)
    if (!training) return false

    training.process.kill("SIGTERM")
    training.progress.status = "failed"
    training.progress.error = "Training stopped by user"

    return true
  }

  getAllTrainings(): TrainingProgress[] {
    return Array.from(this.activeTrainings.values()).map((t) => t.progress)
  }

  private estimateTrainingTime(config: LoRATrainingConfig): string {
    // Rough estimation based on steps and batch size
    const minutesPerStep = 0.1 // Adjust based on your hardware
    const totalMinutes = config.steps * minutesPerStep
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.floor(totalMinutes % 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }
}

export const loraTrainer = new LoRATrainer()
