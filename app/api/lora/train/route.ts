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
  // In a real app, you'd use a library to generate placeholder images
  const sampleImages = [];
  for (let i = 1; i <= 20; i++) {
    // Using a simple transparent pixel as a placeholder
    sampleImages.push({
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      caption: `${characterName}, high quality portrait, detailed face, training image ${i}`,
    });
  }
  return sampleImages;
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

    // Use actual Python training
    const pythonPath = process.env.PYTHON_PATH || "python3"

    // Install dependencies
    status.logs.push("📦 Installing Python dependencies...")
    const pipInstall = spawn(pythonPath, ["-m", "pip", "install", "torch", "diffusers", "transformers", "peft", "safetensors", "accelerate"])

    pipInstall.stdout.on('data', (data) => {
      status.logs.push(`pip: ${data.toString()}`);
    });

    pipInstall.stderr.on('data', (data) => {
      status.logs.push(`pip-error: ${data.toString()}`);
    });

    await new Promise(resolve => pipInstall.on('close', resolve));
    status.logs.push("✅ Python dependencies installed.")


    const trainingProcess = spawn(pythonPath, [scriptPath], {
      cwd: trainingDir,
      stdio: "pipe",
    })

    activeProcesses.set(trainingId, trainingProcess)

    trainingProcess.stdout?.on("data", (data) => {
      const output = data.toString()
      status.logs.push(output.trim())

      // Parse progress from output
      const stepMatch = output.match(/Step (\d+)\/(\d+)/)
      if (stepMatch) {
        status.currentStep = Number.parseInt(stepMatch[1])
        status.progress = Math.round((status.currentStep / status.totalSteps) * 100)
      }

      const lossMatch = output.match(/Loss: ([\d.]+)/)
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

  // Using a real training script with diffusers
  const script = `#!/usr/bin/env python3
import os
import sys
import torch
from diffusers import StableDiffusionPipeline, UNet2DConditionModel, DDPMScheduler
from diffusers.models import AutoencoderKL
from diffusers.training_utils import EMAModel
from transformers import CLIPTextModel, CLIPTokenizer
from peft import LoraConfig, get_peft_model
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
import time

# --- Configuration ---
MODEL_NAME = "${config.baseModel}"
INSTANCE_DIR = "${join(trainingDir, "images")}"
OUTPUT_DIR = "${join(trainingDir, "output")}"
TRIGGER_WORD = "${config.triggerWord}"
STEPS = ${config.steps}
LEARNING_RATE = ${config.learningRate}
BATCH_SIZE = ${config.batchSize}
RESOLUTION = ${config.resolution}
NETWORK_DIM = ${config.networkDim}
NETWORK_ALPHA = ${config.networkAlpha}
OUTPUT_NAME = "${config.outputName}"

# --- Dataset ---
class DreamBoothDataset(Dataset):
    def __init__(self, instance_data_root, instance_prompt, tokenizer, size=512):
        self.instance_data_root = instance_data_root
        self.instance_prompt = instance_prompt
        self.tokenizer = tokenizer
        self.size = size
        self.instance_images_path = [os.path.join(instance_data_root, f) for f in os.listdir(instance_data_root) if f.endswith(('.png', '.jpg', '.jpeg'))]
        self.num_instance_images = len(self.instance_images_path)
        self._length = self.num_instance_images
        self.image_transforms = transforms.Compose([
            transforms.Resize(size, interpolation=transforms.InterpolationMode.BILINEAR),
            transforms.CenterCrop(size),
            transforms.ToTensor(),
            transforms.Normalize([0.5], [0.5]),
        ])

    def __len__(self):
        return self._length

    def __getitem__(self, index):
        example = {}
        instance_image = Image.open(self.instance_images_path[index % self.num_instance_images]).convert("RGB")
        example["instance_images"] = self.image_transforms(instance_image)
        example["instance_prompt_ids"] = self.tokenizer(
            self.instance_prompt,
            truncation=True,
            padding="max_length",
            max_length=self.tokenizer.model_max_length,
            return_tensors="pt",
        ).input_ids
        return example

# --- Main Training Logic ---
def main():
    print("--- Initializing LoRA Training ---")
    
    # Load models
    tokenizer = CLIPTokenizer.from_pretrained(MODEL_NAME, subfolder="tokenizer")
    text_encoder = CLIPTextModel.from_pretrained(MODEL_NAME, subfolder="text_encoder")
    vae = AutoencoderKL.from_pretrained(MODEL_NAME, subfolder="vae")
    unet = UNet2DConditionModel.from_pretrained(MODEL_NAME, subfolder="unet")

    # Add LoRA to UNet
    lora_config = LoraConfig(
        r=NETWORK_DIM,
        lora_alpha=NETWORK_ALPHA,
        target_modules=["to_q", "to_k", "to_v", "to_out.0", "proj_in", "proj_out"],
        lora_dropout=0.05,
        bias="none",
    )
    unet = get_peft_model(unet, lora_config)

    # Freeze other models
    vae.requires_grad_(False)
    text_encoder.requires_grad_(False)

    # Optimizer
    optimizer = torch.optim.AdamW(
        unet.parameters(),
        lr=LEARNING_RATE,
        betas=(0.9, 0.999),
        weight_decay=1e-2,
        eps=1e-08,
    )

    # Dataset and DataLoader
    train_dataset = DreamBoothDataset(INSTANCE_DIR, f"a photo of {TRIGGER_WORD}", tokenizer, size=RESOLUTION)
    train_dataloader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)

    # Training loop
    device = "cuda" if torch.cuda.is_available() else "cpu"
    unet.to(device)
    vae.to(device)
    text_encoder.to(device)

    noise_scheduler = DDPMScheduler.from_pretrained(MODEL_NAME, subfolder="scheduler")

    print(f"🚀 Starting training for {STEPS} steps...")
    global_step = 0

    for epoch in range(int(STEPS / (len(train_dataloader) / BATCH_SIZE)) + 1):
        unet.train()
        for step, batch in enumerate(train_dataloader):
            if global_step >= STEPS:
                break

            # Convert images to latent space
            latents = vae.encode(batch["instance_images"].to(device)).latent_dist.sample()
            latents = latents * vae.config.scaling_factor

            # Sample noise
            noise = torch.randn_like(latents)
            bsz = latents.shape[0]
            timesteps = torch.randint(0, noise_scheduler.config.num_train_timesteps, (bsz,), device=latents.device).long()

            # Add noise to the latents
            noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)

            # Get the text embedding
            encoder_hidden_states = text_encoder(batch["instance_prompt_ids"].squeeze(1).to(device))[0]

            # Predict the noise residual
            model_pred = unet(noisy_latents, timesteps, encoder_hidden_states).sample
            
            # Get the target for loss depending on the scheduler prediction type
            if noise_scheduler.config.prediction_type == "epsilon":
                target = noise
            elif noise_scheduler.config.prediction_type == "v_prediction":
                target = noise_scheduler.get_velocity(latents, noise, timesteps)
            else:
                raise ValueError(f"Unknown prediction type {noise_scheduler.config.prediction_type}")

            loss = torch.nn.functional.mse_loss(model_pred.float(), target.float(), reduction="mean")

            loss.backward()
            optimizer.step()
            optimizer.zero_grad()

            global_step += 1
            print(f"Step {global_step}/{STEPS} - Loss: {loss.item():.4f}")

    print("✅ Training complete!")

    # Save LoRA model
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    unet.save_pretrained(OUTPUT_DIR)
    
    # For compatibility, we can also save as a single safetensors file
    from safetensors.torch import save_file
    
    lora_layers = unet.state_dict()
    final_lora_path = os.path.join(OUTPUT_DIR, f"{OUTPUT_NAME}.safetensors")
    save_file(lora_layers, final_lora_path)
    
    print(f"📁 LoRA model saved to: {final_lora_path}")


if __name__ == "__main__":
    try:
        main()
        sys.exit(0)
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
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
