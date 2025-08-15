import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import { writeFile, mkdir, readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { trainingStatuses, activeProcesses, TrainingStatus } from "@/lib/training-store"

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
  checkpointModelPath: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      characterId,
      characterName,
      baseModel, // Use baseModel from the request body
      trainingImages = [],
      steps = 1000,
    } = body

    if (!characterId) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 })
    }

    // Load character data
    let character = null
    try {
      const charactersData = await readFile(
        join(process.cwd(), "data", "characters.json"),
        "utf-8",
      )
      const characters = JSON.parse(charactersData)
      character = characters.find((c: any) => c.id === characterId)
    } catch (error) {
      return NextResponse.json({ error: "Failed to load character data" }, { status: 500 })
    }

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 })
    }

    // Priority: 1. Model from request (body.baseModel), 2. Character's preferred model
    const finalModelFile = baseModel || character.preferredModel
    if (!finalModelFile) {
      return NextResponse.json(
        {
          error:
            "No model specified in request and no preferredModel configured for character.",
        },
        { status: 400 },
      )
    }

    // Construct the checkpoint model path - directly use models/checkpoints without ComfyUI prefix
    const checkpointModelPath = join(
      process.cwd(),
      "models",
      "checkpoints",
      finalModelFile,
    )

    // This check is for a real environment. In the sandbox, it will fail.
    if (!existsSync(checkpointModelPath)) {
      // Immediately fail the request if the model doesn't exist.
      return NextResponse.json(
        {
          error: "Base model file not found.",
          details: `The required checkpoint model '${finalModelFile}' was not found at the expected path: ${checkpointModelPath}. Please make sure the model exists in the 'models/checkpoints' directory.`,
        },
        { status: 400 },
      )
    }

    const finalCharacterName = characterName || character?.name || "character"
    const trainingId = `training_${characterId}_${Date.now()}`

    // Create training configuration
    const trainingConfig: TrainingConfig = {
      characterId,
      characterName: finalCharacterName,
      baseModel: body.baseModel || "stabilityai/stable-diffusion-xl-base-1.0", // Base for VAE/text encoder
      trainingImages:
        trainingImages.length > 0
          ? trainingImages
          : generateSampleImages(finalCharacterName),
      triggerWord:
        body.triggerWord || finalCharacterName.toLowerCase().replace(/\s+/g, "_"),
      steps,
      learningRate: body.learningRate || 1e-4,
      batchSize: body.batchSize || 1,
      resolution: body.resolution || 1024,
      outputName:
        body.outputName ||
        `${finalCharacterName.toLowerCase().replace(/\s+/g, "_")}_lora`,
      networkDim: body.networkDim || 32,
      networkAlpha: body.networkAlpha || 16,
      checkpointModelPath,
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

// New function to handle Python environment setup in a cross-platform way
async function setupPythonEnvironment(status: TrainingStatus): Promise<string> {
  status.logs.push("🐍 Setting up Python environment (cross-platform)...");
  const venvDir = join(process.cwd(), ".venv");
  const pythonCommand = process.platform === "win32" ? "python" : "python3";

  // 1. Create virtual environment if it doesn't exist
  if (!existsSync(venvDir)) {
    status.logs.push(`Creating Python virtual environment in ${venvDir}...`);
    const venvProcess = spawn(pythonCommand, ["-m", "venv", venvDir], { stdio: "pipe" });
    await new Promise<void>((resolve, reject) => {
      venvProcess.stdout?.on('data', (data) => status.logs.push(`venv: ${data.toString().trim()}`));
      venvProcess.stderr?.on('data', (data) => status.logs.push(`venv-err: ${data.toString().trim()}`));
      venvProcess.on("close", (code) => {
        if (code === 0) {
          status.logs.push("✅ Virtual environment created.");
          resolve();
        } else {
          reject(new Error(`Failed to create venv. Exit code: ${code}. Check if '${pythonCommand}' is installed and in your PATH.`));
        }
      });
      venvProcess.on("error", (err) => reject(new Error(`Failed to spawn '${pythonCommand}': ${err.message}`)));
    });
  } else {
    status.logs.push("👍 Virtual environment already exists.");
  }

  // 2. Install dependencies
  const isWindows = process.platform === "win32";
  const pipPath = join(venvDir, isWindows ? "Scripts" : "bin", "pip");
  const pythonPath = join(venvDir, isWindows ? "Scripts" : "bin", isWindows ? "python.exe" : "python");

  const requirements = [
    "torch>=2.1.0",
    "diffusers==0.24.0",
    "transformers==4.35.2",
    "peft==0.7.1",
    "safetensors==0.4.0",
    "accelerate==0.25.0",
  ];

  status.logs.push(`📦 Installing dependencies using ${pipPath}...`);
  const pipProcess = spawn(pipPath, ["install", ...requirements], { stdio: "pipe" });
  await new Promise<void>((resolve, reject) => {
    pipProcess.stdout?.on('data', (data) => status.logs.push(`pip: ${data.toString().trim()}`));
    pipProcess.stderr?.on('data', (data) => status.logs.push(`pip-err: ${data.toString().trim()}`));
    pipProcess.on("close", (code) => {
      if (code === 0) {
        status.logs.push("✅ Dependencies installed successfully.");
        resolve();
      } else {
        reject(new Error(`Failed to install dependencies with pip. Exit code: ${code}`));
      }
    });
    pipProcess.on("error", (err) => reject(new Error(`Failed to spawn '${pipPath}': ${err.message}`)));
  });

  status.logs.push("✅ Python environment is ready.");
  return pythonPath;
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

    // Setup Python environment
    const pythonPath = await setupPythonEnvironment(status)

    // Use Python from virtual environment
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
      // Handle null exit code by providing a default non-zero value
      handleTrainingComplete(trainingId, code ?? 1)
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

async function prepareTrainingData(
  trainingDir: string,
  config: TrainingConfig,
  status: TrainingStatus,
) {
  status.logs.push("📸 Preparing training images...")

  const imageDir = join(trainingDir, "images")

  if (config.trainingImages.length === 0) {
    throw new Error("No training images provided.")
  }

  // Save training images
  for (let i = 0; i < config.trainingImages.length; i++) {
    const image = config.trainingImages[i]

    if (!image.caption || image.caption.trim() === "") {
      throw new Error(
        `Missing caption for image ${
          i + 1
        }. All training images must have a user-provided caption.`,
      )
    }

    const filename = `${config.triggerWord}_${i + 1}.png`
    const imagePath = join(imageDir, filename)
    const captionPath = join(imageDir, `${config.triggerWord}_${i + 1}.txt`)

    // The try/catch block is moved to the parent function startTrainingProcess
    // Save image (base64 to file)
    const imageBuffer = Buffer.from(image.data, "base64")
    await writeFile(imagePath, imageBuffer)

    // Save caption
    await writeFile(captionPath, image.caption)
  }

  status.logs.push(`✅ Prepared ${config.trainingImages.length} training images`)
}

/**
 * Escapes backslashes in a path for use in a Python string.
 * @param path The path string to escape.
 * @returns The escaped path string.
 */
function escapePathForPython(path: string): string {
  return path.replace(/\\/g, "\\\\")
}

async function createTrainingScript(
  trainingDir: string,
  config: TrainingConfig,
): Promise<string> {
  const scriptPath = join(trainingDir, "train_lora.py")

  // Correctly escape paths for Python on Windows
  const checkpointModelPath = escapePathForPython(config.checkpointModelPath)
  const instanceDir = escapePathForPython(join(trainingDir, "images"))
  const outputDir = escapePathForPython(join(trainingDir, "output"))

  // New, corrected script for SDXL LoRA training
  const script = `#!/usr/bin/env python3
import os
import sys
import torch
import itertools
from diffusers import StableDiffusionXLPipeline, UNet2DConditionModel, DDPMScheduler
from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer
from peft import LoraConfig, get_peft_model
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
from safetensors.torch import save_file
import traceback

# --- Configuration ---
CHECKPOINT_MODEL_PATH = r"${checkpointModelPath}"
INSTANCE_DIR = r"${instanceDir}"
OUTPUT_DIR = r"${outputDir}"
TRIGGER_WORD = "${config.triggerWord}"
STEPS = ${config.steps}
LEARNING_RATE = ${config.learningRate}
BATCH_SIZE = ${config.batchSize}
RESOLUTION = ${config.resolution}
NETWORK_DIM = ${config.networkDim}
NETWORK_ALPHA = ${config.networkAlpha}
OUTPUT_NAME = "${config.outputName}"
TRAIN_TEXT_ENCODER = True # SDXL benefits greatly from this

# --- Dataset ---
class DreamBoothDataset(Dataset):
    def __init__(self, instance_data_root, tokenizer, tokenizer_2, size=1024):
        self.instance_data_root = instance_data_root
        self.tokenizer = tokenizer
        self.tokenizer_2 = tokenizer_2
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
        image_path = self.instance_images_path[index % self.num_instance_images]
        instance_image = Image.open(image_path).convert("RGB")
        example["instance_images"] = self.image_transforms(instance_image)

        base_name = os.path.splitext(os.path.basename(image_path))[0]
        caption_path = os.path.join(self.instance_data_root, f"{base_name}.txt")

        try:
            with open(caption_path, "r", encoding="utf-8") as f:
                caption = f.read().strip()
        except FileNotFoundError:
            print(f"WARNING: Caption file not found for {os.path.basename(image_path)}. Using trigger word as caption.")
            caption = TRIGGER_WORD

        example["instance_prompt"] = caption
        return example

# --- Main Training Logic ---
def main():
    print("--- Initializing SDXL LoRA Training from single checkpoint ---")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    if not os.path.exists(CHECKPOINT_MODEL_PATH):
        print(f"❌ ERROR: Checkpoint file not found at {CHECKPOINT_MODEL_PATH}")
        sys.exit(1)

    # Load the entire pipeline from a single file
    print("Loading pipeline...")
    pipe = StableDiffusionXLPipeline.from_single_file(
        CHECKPOINT_MODEL_PATH,
        torch_dtype=torch.float16,
        use_safetensors=True,
        variant="fp16"
    )
    pipe.to(device)
    print("✅ Pipeline loaded.")

    # Extract components
    vae = pipe.vae
    text_encoder_one = pipe.text_encoder
    text_encoder_two = pipe.text_encoder_2
    tokenizer_one = pipe.tokenizer
    tokenizer_two = pipe.tokenizer_2
    unet = pipe.unet
    noise_scheduler = DDPMScheduler.from_config(pipe.scheduler.config)

    # Freeze models
    vae.requires_grad_(False)
    text_encoder_one.requires_grad_(False)
    text_encoder_two.requires_grad_(False)
    unet.requires_grad_(False)

    # Add LoRA to UNet
    unet_lora_config = LoraConfig(r=NETWORK_DIM, lora_alpha=NETWORK_ALPHA, init_lora_weights="gaussian", target_modules=["to_q", "to_k", "to_v", "to_out.0", "proj_in", "proj_out"])
    unet.add_adapter(unet_lora_config, adapter_name="lora_adapter")

    # Add LoRA to Text Encoders if enabled
    if TRAIN_TEXT_ENCODER:
        text_lora_config = LoraConfig(r=NETWORK_DIM, lora_alpha=NETWORK_ALPHA, init_lora_weights="gaussian", target_modules=["q_proj", "k_proj", "v_proj", "out_proj"])
        text_encoder_one.add_adapter(text_lora_config, adapter_name="lora_adapter")
        text_encoder_two.add_adapter(text_lora_config, adapter_name="lora_adapter")

    # Optimizer
    params_to_optimize = itertools.chain(unet.parameters(), text_encoder_one.parameters(), text_encoder_two.parameters()) if TRAIN_TEXT_ENCODER else unet.parameters()
    optimizer = torch.optim.AdamW(
        [p for p in params_to_optimize if p.requires_grad],
        lr=LEARNING_RATE,
        betas=(0.9, 0.999),
        weight_decay=1e-2,
        eps=1e-08,
    )

    # Dataset and DataLoader
    train_dataset = DreamBoothDataset(INSTANCE_DIR, tokenizer_one, tokenizer_two, size=RESOLUTION)

    def collate_fn(examples):
        pixel_values = torch.stack([example["instance_images"] for example in examples])
        pixel_values = pixel_values.to(memory_format=torch.contiguous_format).float()
        prompts = [example["instance_prompt"] for example in examples]

        # Tokenize and encode prompts
        tokenizers = [tokenizer_one, tokenizer_two]
        text_encoders = [text_encoder_one, text_encoder_two]

        prompt_embeds_list = []
        for tokenizer, text_encoder in zip(tokenizers, text_encoders):
            text_inputs = tokenizer(
                prompts,
                padding="max_length",
                max_length=tokenizer.model_max_length,
                truncation=True,
                return_tensors="pt",
            )
            prompt_embeds = text_encoder(text_inputs.input_ids.to(device), output_hidden_states=True)
            pooled_prompt_embeds = prompt_embeds[0]
            prompt_embeds = prompt_embeds.hidden_states[-2]
            prompt_embeds_list.append(prompt_embeds)

        prompt_embeds = torch.cat(prompt_embeds_list, dim=-1)

        return {
            "pixel_values": pixel_values.to(device, dtype=torch.float16),
            "prompt_embeds": prompt_embeds.to(device, dtype=torch.float16),
            "pooled_prompt_embeds": pooled_prompt_embeds.to(device, dtype=torch.float16)
        }

    train_dataloader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, collate_fn=collate_fn)

    print(f"🚀 Starting training for {STEPS} steps...")
    global_step = 0
    progress_bar = range(STEPS)

    for step in progress_bar:
        unet.train()
        if TRAIN_TEXT_ENCODER:
            text_encoder_one.train()
            text_encoder_two.train()

        batch = next(iter(train_dataloader))

        with torch.no_grad():
            latents = vae.encode(batch["pixel_values"]).latent_dist.sample()
            latents = latents * vae.config.scaling_factor

        noise = torch.randn_like(latents)
        bsz = latents.shape[0]
        timesteps = torch.randint(0, noise_scheduler.config.num_train_timesteps, (bsz,), device=latents.device).long()
        noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)

        add_time_ids = torch.tensor([RESOLUTION, RESOLUTION, 0, 0, RESOLUTION, RESOLUTION], device=device, dtype=torch.float16).repeat(bsz, 1)

        added_cond_kwargs = {"text_embeds": batch["pooled_prompt_embeds"], "time_ids": add_time_ids}

        model_pred = unet(noisy_latents, timesteps, batch["prompt_embeds"], added_cond_kwargs=added_cond_kwargs).sample

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

        if global_step >= STEPS:
            break

    print("✅ Training complete!")

    # Save LoRA layers
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    unet_lora_layers = unet.state_dict(prefix="unet.")

    if TRAIN_TEXT_ENCODER:
        text_encoder_one_lora_layers = text_encoder_one.state_dict(prefix="text_encoder_l.")
        text_encoder_two_lora_layers = text_encoder_two.state_dict(prefix="text_encoder_2.")
        lora_layers = {**unet_lora_layers, **text_encoder_one_lora_layers, **text_encoder_two_lora_layers}
    else:
        lora_layers = unet_lora_layers

    final_lora_path = os.path.join(OUTPUT_DIR, f"{OUTPUT_NAME}.safetensors")
    save_file(lora_layers, final_lora_path)

    print(f"📁 LoRA model saved to: {final_lora_path}")

if __name__ == "__main__":
    try:
        main()
        sys.exit(0)
    except Exception as e:
        print(f"❌ Training failed: {e}")
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
    status.outputPath = join(
      process.cwd(),
      "training",
      trainingId,
      "output",
      `${status.id}.safetensors`,
    )
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
        (a, b) =>
          new Date(b[1].startTime).getTime() - new Date(a[1].startTime).getTime(),
      )

      // Remove old trainings
      for (let i = 10; i < sortedTrainings.length; i++) {
        trainingStatuses.delete(sortedTrainings[i][0])
      }
    }
  }, 5000)
}
