import { type NextRequest, NextResponse } from "next/server"
import { readdir, stat, readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

interface ModelInfo {
  id: string
  name: string
  type: "checkpoint" | "lora" | "vae" | "clip"
  size: number
  path: string
  loaded: boolean
  lastUsed?: string
  downloadUrl?: string
  description?: string
  tags?: string[]
}

const MODELS_DIR = join(process.cwd(), "models")
const MODELS_CONFIG_FILE = join(process.cwd(), "data", "models.json")

// Available models for download
const AVAILABLE_MODELS = {
  checkpoints: [
    {
      id: "flux-dev",
      name: "Flux.1-dev",
      type: "checkpoint" as const,
      size: 11900000000, // ~11.9GB
      downloadUrl: "https://huggingface.co/black-forest-labs/FLUX.1-dev",
      description: "High-quality image generation model",
      tags: ["flux", "dev", "high-quality"],
    },
    {
      id: "flux-schnell",
      name: "Flux.1-schnell",
      type: "checkpoint" as const,
      size: 11900000000,
      downloadUrl: "https://huggingface.co/black-forest-labs/FLUX.1-schnell",
      description: "Fast image generation model",
      tags: ["flux", "schnell", "fast"],
    },
    {
      id: "flux-pro",
      name: "Flux.1-pro",
      type: "checkpoint" as const,
      size: 11900000000,
      downloadUrl: "https://huggingface.co/black-forest-labs/FLUX.1-pro",
      description: "Professional image generation model",
      tags: ["flux", "pro", "professional"],
    },
  ],
  loras: [
    {
      id: "realistic-vision",
      name: "Realistic Vision LoRA",
      type: "lora" as const,
      size: 144000000, // ~144MB
      downloadUrl: "https://huggingface.co/models/realistic-vision-lora",
      description: "Enhances photorealistic output",
      tags: ["realistic", "photography"],
    },
    {
      id: "anime-style",
      name: "Anime Style LoRA",
      type: "lora" as const,
      size: 144000000,
      downloadUrl: "https://huggingface.co/models/anime-style-lora",
      description: "Anime and manga style enhancement",
      tags: ["anime", "manga", "style"],
    },
  ],
}

async function ensureDirectories() {
  const dirs = [
    MODELS_DIR,
    join(MODELS_DIR, "checkpoints"),
    join(MODELS_DIR, "loras"),
    join(MODELS_DIR, "vae"),
    join(process.cwd(), "data"),
  ]

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
  }
}

async function loadModelsConfig(): Promise<ModelInfo[]> {
  try {
    const data = await readFile(MODELS_CONFIG_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function saveModelsConfig(models: ModelInfo[]) {
  await ensureDirectories()
  await writeFile(MODELS_CONFIG_FILE, JSON.stringify(models, null, 2))
}

async function scanLocalModels(): Promise<ModelInfo[]> {
  const models: ModelInfo[] = []

  try {
    await ensureDirectories()

    // Scan checkpoints
    const checkpointsDir = join(MODELS_DIR, "checkpoints")
    if (existsSync(checkpointsDir)) {
      const checkpointFiles = await readdir(checkpointsDir)
      for (const file of checkpointFiles) {
        if (file.endsWith(".safetensors") || file.endsWith(".ckpt")) {
          const filePath = join(checkpointsDir, file)
          const stats = await stat(filePath)
          models.push({
            id: file.replace(/\.(safetensors|ckpt)$/, ""),
            name: file,
            type: "checkpoint",
            size: stats.size,
            path: filePath,
            loaded: true,
          })
        }
      }
    }

    // Scan LoRAs
    const lorasDir = join(MODELS_DIR, "loras")
    if (existsSync(lorasDir)) {
      const loraFiles = await readdir(lorasDir)
      for (const file of loraFiles) {
        if (file.endsWith(".safetensors") || file.endsWith(".pt")) {
          const filePath = join(lorasDir, file)
          const stats = await stat(filePath)
          models.push({
            id: file.replace(/\.(safetensors|pt)$/, ""),
            name: file,
            type: "lora",
            size: stats.size,
            path: filePath,
            loaded: true,
          })
        }
      }
    }

    // Add available models that aren't downloaded
    const localIds = models.map((m) => m.id)

    for (const checkpoint of AVAILABLE_MODELS.checkpoints) {
      if (!localIds.includes(checkpoint.id)) {
        models.push({
          ...checkpoint,
          path: join(MODELS_DIR, "checkpoints", `${checkpoint.id}.safetensors`),
          loaded: false,
        })
      }
    }

    for (const lora of AVAILABLE_MODELS.loras) {
      if (!localIds.includes(lora.id)) {
        models.push({
          ...lora,
          path: join(MODELS_DIR, "loras", `${lora.id}.safetensors`),
          loaded: false,
        })
      }
    }
  } catch (error) {
    console.error("Error scanning models:", error)
  }

  return models
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") // checkpoint, lora, vae
    const loaded = searchParams.get("loaded") // true, false

    let models = await scanLocalModels()

    // Filter by type
    if (type) {
      models = models.filter((m) => m.type === type)
    }

    // Filter by loaded status
    if (loaded !== null) {
      const isLoaded = loaded === "true"
      models = models.filter((m) => m.loaded === isLoaded)
    } else {
      const show = searchParams.get("show")
      if (show !== "all") {
        models = models.filter((m) => m.loaded === true)
      }
    }

    // Sort by type, then by name
    models.sort((a, b) => {
      if (a.type !== b.type) {
        const typeOrder = { checkpoint: 0, lora: 1, vae: 2, clip: 3 }
        return typeOrder[a.type] - typeOrder[b.type]
      }
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      models,
      summary: {
        total: models.length,
        loaded: models.filter((m) => m.loaded).length,
        checkpoints: models.filter((m) => m.type === "checkpoint").length,
        loras: models.filter((m) => m.type === "lora").length,
        totalSize: models.reduce((sum, m) => sum + m.size, 0),
      },
    })
  } catch (error) {
    console.error("Failed to get models:", error)
    return NextResponse.json({ error: "Failed to get models" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, modelId, modelData } = body

    switch (action) {
      case "download":
        return await downloadModel(modelId)
      case "delete":
        return await deleteModel(modelId)
      case "set_active":
        return await setActiveModel(modelId)
      case "upload":
        return await uploadModel(modelData)
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Model operation failed:", error)
    return NextResponse.json({ error: "Model operation failed" }, { status: 500 })
  }
}

import { comfyUIClient } from "../../../lib/comfyui-complete";

async function downloadModel(modelId: string) {
  const allModels = [...AVAILABLE_MODELS.checkpoints, ...AVAILABLE_MODELS.loras];
  const model = allModels.find((m) => m.id === modelId);

  if (!model || !model.downloadUrl) {
    return NextResponse.json({ error: "Model not found or no download URL" }, { status: 404 });
  }

  const result = await comfyUIClient.downloadModel(model.downloadUrl, model.name, model.type);

  if (result.success) {
    const models = await loadModelsConfig();
    const existingModel = models.find((m) => m.id === modelId);
    if (existingModel) {
      existingModel.loaded = true;
      await saveModelsConfig(models);
    }
  }

  return NextResponse.json(result);
}

async function deleteModel(modelId: string) {
  const models = await loadModelsConfig();
  const modelIndex = models.findIndex((m) => m.id === modelId);

  if (modelIndex === -1) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const model = models[modelIndex];

  // In reality, you would delete the actual file
  // For now, just remove from config
  models.splice(modelIndex, 1);
  await saveModelsConfig(models);

  return NextResponse.json({
    success: true,
    message: `Deleted ${model.name}`,
  });
}

async function setActiveModel(modelId: string) {
  const models = await loadModelsConfig();
  const model = models.find((m) => m.id === modelId);

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Update last used timestamp
  model.lastUsed = new Date().toISOString();
  await saveModelsConfig(models);

  return NextResponse.json({
    success: true,
    message: `Set ${model.name} as active`,
    model,
  });
}

async function uploadModel(modelData: any) {
  // Handle model upload
  const { name, type, file } = modelData;

  if (!name || !type || !file) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const modelId = name.toLowerCase().replace(/\s+/g, "-");
  const models = await loadModelsConfig();

  // Check if model already exists
  if (models.find((m) => m.id === modelId)) {
    return NextResponse.json({ error: "Model already exists" }, { status: 409 });
  }

  // In reality, you would save the uploaded file
  const newModel: ModelInfo = {
    id: modelId,
    name,
    type: type as "checkpoint" | "lora" | "vae" | "clip",
    size: file.size || 0,
    path: join(MODELS_DIR, type + "s", `${modelId}.safetensors`),
    loaded: true,
  };

  models.push(newModel);
  await saveModelsConfig(models);

  return NextResponse.json({
    success: true,
    message: `Uploaded ${name} successfully`,
    model: newModel,
  });
}
