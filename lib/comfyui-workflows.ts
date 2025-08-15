// Complete ComfyUI workflow definitions for Flux models
export interface WorkflowNode {
  inputs: Record<string, any>
  class_type: string
  _meta?: {
    title: string
  }
}

export interface ComfyUIWorkflow {
  [key: string]: WorkflowNode
}

export interface WorkflowConfig {
  prompt: string
  negativePrompt?: string
  model: string
  width?: number
  height?: number
  steps?: number
  cfg?: number
  guidance?: number
  seed?: number
  loraPath?: string
  loraStrength?: number
  sampler?: string
  scheduler?: string
  triggerWord?: string
}

export type Workflow = Record<string, WorkflowNode>

export function createFluxWorkflow(modelName: string, prompt: string, config: Partial<WorkflowConfig> = {}): Workflow {
  const {
    width = 1024,
    height = 1024,
    steps = 20,
    guidance = 3.5,
    seed = Math.floor(Math.random() * 1000000),
    loraPath,
    loraStrength = 1.0,
    sampler = "euler",
    scheduler = "simple",
    triggerWord,
  } = config

  let finalPrompt = prompt
  if (loraPath && triggerWord) {
    finalPrompt = `${triggerWord}, ${prompt}`
  }

  const workflow: Workflow = {
    "1": {
      inputs: {
        ckpt_name: modelName,
      },
      class_type: "CheckpointLoaderSimple",
      _meta: {
        title: "Load Checkpoint",
      },
    },
    "2": {
      inputs: {
        text: finalPrompt,
        clip: ["1", 1],
      },
      class_type: "CLIPTextEncode",
      _meta: {
        title: "CLIP Text Encode (Prompt)",
      },
    },
    "3": {
      inputs: {
        width: width,
        height: height,
        batch_size: 1,
      },
      class_type: "EmptyLatentImage",
      _meta: {
        title: "Empty Latent Image",
      },
    },
    "4": {
      inputs: {
        seed: seed,
        steps: steps,
        cfg: guidance,
        sampler_name: sampler,
        scheduler: scheduler,
        denoise: 1,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["2", 0],
        latent_image: ["3", 0],
      },
      class_type: "KSampler",
      _meta: {
        title: "KSampler",
      },
    },
    "5": {
      inputs: {
        vae: ["1", 2],
        samples: ["4", 0],
      },
      class_type: "VAEDecode",
      _meta: {
        title: "VAE Decode",
      },
    },
    "6": {
      inputs: {
        filename_prefix: "flux_generated",
        images: ["5", 0],
      },
      class_type: "SaveImage",
      _meta: {
        title: "Save Image",
      },
    },
  }

  // Add LoRA if specified
  if (loraPath) {
    workflow["7"] = {
      inputs: {
        lora_name: loraPath,
        strength_model: loraStrength,
        strength_clip: loraStrength,
        model: ["1", 0],
        clip: ["1", 1],
      },
      class_type: "LoraLoader",
      _meta: {
        title: "Load LoRA",
      },
    }

    // Update connections to use LoRA
    workflow["2"].inputs.clip = ["7", 1]
    workflow["4"].inputs.model = ["7", 0]
  }

  return workflow
}

export function createSDXLWorkflow(modelName: string, prompt: string, config: Partial<WorkflowConfig> = {}): Workflow {
  const {
    negativePrompt = "low quality, blurry, distorted",
    width = 1024,
    height = 1024,
    steps = 30,
    cfg = 7.5,
    seed = Math.floor(Math.random() * 1000000),
    loraPath,
    loraStrength = 1.0,
    sampler = "dpmpp_2m",
    scheduler = "karras",
    triggerWord,
  } = config

  let finalPrompt = prompt
  if (loraPath && triggerWord) {
    finalPrompt = `${triggerWord}, ${prompt}`
  }

  const workflow: Workflow = {
    "1": {
      inputs: {
        ckpt_name: modelName,
      },
      class_type: "CheckpointLoaderSimple",
      _meta: {
        title: "Load Checkpoint",
      },
    },
    "2": {
      inputs: {
        text: finalPrompt,
        clip: ["1", 1],
      },
      class_type: "CLIPTextEncode",
      _meta: {
        title: "CLIP Text Encode (Prompt)",
      },
    },
    "3": {
      inputs: {
        text: negativePrompt,
        clip: ["1", 1],
      },
      class_type: "CLIPTextEncode",
      _meta: {
        title: "CLIP Text Encode (Negative)",
      },
    },
    "4": {
      inputs: {
        width: width,
        height: height,
        batch_size: 1,
      },
      class_type: "EmptyLatentImage",
      _meta: {
        title: "Empty Latent Image",
      },
    },
    "5": {
      inputs: {
        seed: seed,
        steps: steps,
        cfg: cfg,
        sampler_name: sampler,
        scheduler: scheduler,
        denoise: 1,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
      },
      class_type: "KSampler",
      _meta: {
        title: "KSampler",
      },
    },
    "6": {
      inputs: {
        vae: ["1", 2],
        samples: ["5", 0],
      },
      class_type: "VAEDecode",
      _meta: {
        title: "VAE Decode",
      },
    },
    "7": {
      inputs: {
        filename_prefix: "sdxl_generated",
        images: ["6", 0],
      },
      class_type: "SaveImage",
      _meta: {
        title: "Save Image",
      },
    },
  }

  // Add LoRA if specified
  if (loraPath) {
    workflow["8"] = {
      inputs: {
        lora_name: loraPath,
        strength_model: loraStrength,
        strength_clip: loraStrength,
        model: ["1", 0],
        clip: ["1", 1],
      },
      class_type: "LoraLoader",
      _meta: {
        title: "Load LoRA",
      },
    }

    // Update connections to use LoRA
    workflow["2"].inputs.clip = ["8", 1]
    workflow["3"].inputs.clip = ["8", 1]
    workflow["5"].inputs.model = ["8", 0]
  }

  return workflow
}

export function createSD15Workflow(modelName: string, prompt: string, config: Partial<WorkflowConfig> = {}): Workflow {
  const {
    negativePrompt = "low quality, blurry, distorted, bad anatomy",
    width = 768,
    height = 512,
    steps = 25,
    cfg = 7.0,
    seed = Math.floor(Math.random() * 1000000),
    loraPath,
    loraStrength = 1.0,
    sampler = "euler_a",
    scheduler = "normal",
    triggerWord,
  } = config

  let finalPrompt = prompt
  if (loraPath && triggerWord) {
    finalPrompt = `${triggerWord}, ${prompt}`
  }

  // Hires fix specific settings
  const upscaleFactor = 2
  const hiresDenoise = 0.4
  const hiresSteps = 15

  const workflow: Workflow = {
    "1": {
      inputs: {
        ckpt_name: modelName,
      },
      class_type: "CheckpointLoaderSimple",
      _meta: {
        title: "Load Checkpoint",
      },
    },
    "2": {
      inputs: {
        text: finalPrompt,
        clip: ["1", 1],
      },
      class_type: "CLIPTextEncode",
      _meta: {
        title: "CLIP Text Encode (Prompt)",
      },
    },
    "3": {
      inputs: {
        text: negativePrompt,
        clip: ["1", 1],
      },
      class_type: "CLIPTextEncode",
      _meta: {
        title: "CLIP Text Encode (Negative)",
      },
    },
    "4": {
      inputs: {
        width: width,
        height: height,
        batch_size: 1,
      },
      class_type: "EmptyLatentImage",
      _meta: {
        title: "Empty Latent Image",
      },
    },
    "5": {
      inputs: {
        seed: seed,
        steps: steps,
        cfg: cfg,
        sampler_name: sampler,
        scheduler: scheduler,
        denoise: 1.0,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
      },
      class_type: "KSampler",
      _meta: {
        title: "KSampler (Base Pass)",
      },
    },
    "6": {
      inputs: {
        vae: ["1", 2],
        samples: ["9", 0], // Connects to the output of the hires sampler
      },
      class_type: "VAEDecode",
      _meta: {
        title: "VAE Decode",
      },
    },
    "7": {
      inputs: {
        filename_prefix: "sd15_generated_hires",
        images: ["6", 0],
      },
      class_type: "SaveImage",
      _meta: {
        title: "Save Image",
      },
    },
    "8": {
      inputs: {
        samples: ["5", 0],
        upscale_method: "nearest-exact",
        scale_by: upscaleFactor,
      },
      class_type: "LatentUpscale",
      _meta: {
        title: "Upscale Latent",
      },
    },
    "9": {
      inputs: {
        seed: seed,
        steps: hiresSteps,
        cfg: cfg,
        sampler_name: sampler,
        scheduler: scheduler,
        denoise: hiresDenoise,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["8", 0],
      },
      class_type: "KSampler",
      _meta: {
        title: "KSampler (Hires Pass)",
      },
    },
  }

  // Add LoRA if specified
  if (loraPath) {
    workflow["10"] = {
      inputs: {
        lora_name: loraPath,
        strength_model: loraStrength,
        strength_clip: loraStrength,
        model: ["1", 0],
        clip: ["1", 1],
      },
      class_type: "LoraLoader",
      _meta: {
        title: "Load LoRA",
      },
    }

    // Update connections to use LoRA
    workflow["2"].inputs.clip = ["10", 1]
    workflow["3"].inputs.clip = ["10", 1]
    workflow["5"].inputs.model = ["10", 0]
    workflow["9"].inputs.model = ["10", 0] // Also patch the hires sampler
  }

  return workflow
}

export function createWorkflowForModel(
  modelName: string,
  prompt: string,
  config: Partial<WorkflowConfig> = {},
): Workflow {
  const modelType = detectModelType(modelName)

  switch (modelType) {
    case "flux":
      return createFluxWorkflow(modelName, prompt, config)
    case "sdxl":
      return createSDXLWorkflow(modelName, prompt, config)
    case "sd15":
      return createSD15Workflow(modelName, prompt, config)
    default:
      // Default to SDXL workflow for unknown models
      return createSDXLWorkflow(modelName, prompt, config)
  }
}

function detectModelType(modelName: string): "flux" | "sdxl" | "sd15" {
  const name = modelName.toLowerCase()

  if (name.includes("flux")) {
    return "flux"
  } else if (name.includes("xl") || name.includes("sdxl")) {
    return "sdxl"
  } else if (name.includes("sd15") || name.includes("1.5") || name.includes("v1-5")) {
    return "sd15"
  }

  // Default to SDXL for unknown models
  return "sdxl"
}

export function getDefaultConfigForModel(modelName: string): Partial<WorkflowConfig> {
  const modelType = detectModelType(modelName)

  switch (modelType) {
    case "flux":
      return {
        width: 1024,
        height: 1024,
        steps: 20,
        guidance: 3.5,
        sampler: "euler",
        scheduler: "simple",
      }
    case "sdxl":
      return {
        width: 1024,
        height: 1024,
        steps: 30,
        cfg: 7.5,
        sampler: "dpmpp_2m",
        scheduler: "karras",
        negativePrompt: "low quality, blurry, distorted",
      }
    case "sd15":
      return {
        width: 512,
        height: 512,
        steps: 25,
        cfg: 7.0,
        sampler: "euler_a",
        scheduler: "normal",
        negativePrompt: "low quality, blurry, distorted, bad anatomy",
      }
    default:
      return {}
  }
}

export function getSamplersForModel(modelName: string): string[] {
  const modelType = detectModelType(modelName)

  switch (modelType) {
    case "flux":
      return ["euler", "heun", "dpm_2", "dpm_2_ancestral"]
    case "sdxl":
      return [
        "euler",
        "euler_a",
        "heun",
        "dpm_2",
        "dpm_2_ancestral",
        "lms",
        "dpm_fast",
        "dpm_adaptive",
        "dpmpp_2s_ancestral",
        "dpmpp_sde",
        "dpmpp_2m",
        "ddim",
        "uni_pc",
        "uni_pc_bh2",
      ]
    case "sd15":
      return [
        "euler",
        "euler_a",
        "heun",
        "dpm_2",
        "dpm_2_ancestral",
        "lms",
        "dpm_fast",
        "dpm_adaptive",
        "dpmpp_2s_ancestral",
        "dpmpp_sde",
        "dpmpp_2m",
        "ddim",
      ]
    default:
      return ["euler", "euler_a", "dpm_2", "dpmpp_2m"]
  }
}

export function getSchedulersForModel(modelName: string): string[] {
  const modelType = detectModelType(modelName)

  switch (modelType) {
    case "flux":
      return ["simple", "normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform"]
    case "sdxl":
      return ["normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform"]
    case "sd15":
      return ["normal", "karras", "exponential", "simple", "ddim_uniform"]
    default:
      return ["normal", "karras", "exponential"]
  }
}

export class WorkflowBuilder {
  static createFluxWorkflow(
    prompt: string,
    modelName: string,
    loraName?: string,
    steps = 20,
    cfg = 7.5,
    width = 1024,
    height = 1024,
    seed?: number,
  ): Workflow {
    const workflow: Workflow = {
      "1": {
        inputs: {
          ckpt_name: modelName,
        },
        class_type: "CheckpointLoaderSimple",
        _meta: {
          title: "Load Checkpoint",
        },
      },
      "2": {
        inputs: {
          text: prompt,
          clip: ["1", 1],
        },
        class_type: "CLIPTextEncode",
        _meta: {
          title: "CLIP Text Encode (Prompt)",
        },
      },
      "3": {
        inputs: {
          text: "blurry, low quality, distorted, deformed, bad anatomy, worst quality",
          clip: ["1", 1],
        },
        class_type: "CLIPTextEncode",
        _meta: {
          title: "CLIP Text Encode (Negative)",
        },
      },
      "4": {
        inputs: {
          width: width,
          height: height,
          batch_size: 1,
        },
        class_type: "EmptyLatentImage",
        _meta: {
          title: "Empty Latent Image",
        },
      },
      "5": {
        inputs: {
          seed: seed !== undefined ? seed : Math.floor(Math.random() * 1000000),
          steps: steps,
          cfg: cfg,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 1.0,
          model: ["1", 0],
          positive: ["2", 0],
          negative: ["3", 0],
          latent_image: ["4", 0],
        },
        class_type: "KSampler",
        _meta: {
          title: "KSampler",
        },
      },
      "6": {
        inputs: {
          samples: ["5", 0],
          vae: ["1", 2],
        },
        class_type: "VAEDecode",
        _meta: {
          title: "VAE Decode",
        },
      },
      "9": {
        inputs: {
          filename_prefix: "ComfyUI",
          images: ["6", 0],
        },
        class_type: "SaveImage",
        _meta: {
          title: "Save Image",
        },
      },
    }

    // Add LoRA if specified
    if (loraName) {
      workflow["7"] = {
        inputs: {
          lora_name: loraName,
          strength_model: 1.0,
          strength_clip: 1.0,
          model: ["1", 0],
          clip: ["1", 1],
        },
        class_type: "LoraLoader",
        _meta: {
          title: "Load LoRA",
        },
      }

      // Update connections to use LoRA
      workflow["2"].inputs.clip = ["7", 1]
      workflow["3"].inputs.clip = ["7", 1]
      workflow["5"].inputs.model = ["7", 0]
    }

    return workflow
  }

  static createFluxSchnellWorkflow(
    prompt: string,
    modelName: string,
    loraName?: string,
    steps = 4,
    width = 1024,
    height = 1024,
    seed?: number,
  ): Workflow {
    // Flux Schnell optimized workflow (fewer steps, faster generation)
    return this.createFluxWorkflow(prompt, modelName, loraName, steps, 1.0, width, height, seed)
  }

  static createImg2ImgWorkflow(
    prompt: string,
    modelName: string,
    inputImage: string,
    denoise = 0.7,
    steps = 20,
    cfg = 7.5,
    seed?: number,
  ): Workflow {
    return {
      "1": {
        inputs: {
          ckpt_name: modelName,
        },
        class_type: "CheckpointLoaderSimple",
        _meta: {
          title: "Load Checkpoint",
        },
      },
      "2": {
        inputs: {
          text: prompt,
          clip: ["1", 1],
        },
        class_type: "CLIPTextEncode",
        _meta: {
          title: "CLIP Text Encode (Prompt)",
        },
      },
      "3": {
        inputs: {
          text: "blurry, low quality, distorted",
          clip: ["1", 1],
        },
        class_type: "CLIPTextEncode",
        _meta: {
          title: "CLIP Text Encode (Negative)",
        },
      },
      "4": {
        inputs: {
          image: inputImage,
          upload: "image",
        },
        class_type: "LoadImage",
        _meta: {
          title: "Load Image",
        },
      },
      "5": {
        inputs: {
          pixels: ["4", 0],
          vae: ["1", 2],
        },
        class_type: "VAEEncode",
        _meta: {
          title: "VAE Encode",
        },
      },
      "6": {
        inputs: {
          seed: seed !== undefined ? seed : Math.floor(Math.random() * 1000000),
          steps: steps,
          cfg: cfg,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: denoise,
          model: ["1", 0],
          positive: ["2", 0],
          negative: ["3", 0],
          latent_image: ["5", 0],
        },
        class_type: "KSampler",
        _meta: {
          title: "KSampler",
        },
      },
      "7": {
        inputs: {
          samples: ["6", 0],
          vae: ["1", 2],
        },
        class_type: "VAEDecode",
        _meta: {
          title: "VAE Decode",
        },
      },
      "8": {
        inputs: {
          filename_prefix: "img2img",
          images: ["7", 0],
        },
        class_type: "SaveImage",
        _meta: {
          title: "Save Image",
        },
      },
    }
  }

  static createControlNetWorkflow(
    prompt: string,
    modelName: string,
    controlNetName: string,
    controlImage: string,
    strength = 1.0,
    seed?: number,
  ): Workflow {
    return {
      "1": {
        inputs: {
          ckpt_name: modelName,
        },
        class_type: "CheckpointLoaderSimple",
        _meta: {
          title: "Load Checkpoint",
        },
      },
      "2": {
        inputs: {
          text: prompt,
          clip: ["1", 1],
        },
        class_type: "CLIPTextEncode",
        _meta: {
          title: "CLIP Text Encode (Prompt)",
        },
      },
      "3": {
        inputs: {
          text: "blurry, low quality",
          clip: ["1", 1],
        },
        class_type: "CLIPTextEncode",
        _meta: {
          title: "CLIP Text Encode (Negative)",
        },
      },
      "4": {
        inputs: {
          control_net_name: controlNetName,
        },
        class_type: "ControlNetLoader",
        _meta: {
          title: "Load ControlNet",
        },
      },
      "5": {
        inputs: {
          image: controlImage,
          upload: "image",
        },
        class_type: "LoadImage",
        _meta: {
          title: "Load Control Image",
        },
      },
      "6": {
        inputs: {
          strength: strength,
          conditioning: ["2", 0],
          control_net: ["4", 0],
          image: ["5", 0],
        },
        class_type: "ControlNetApply",
        _meta: {
          title: "Apply ControlNet",
        },
      },
      "7": {
        inputs: {
          width: 1024,
          height: 1024,
          batch_size: 1,
        },
        class_type: "EmptyLatentImage",
        _meta: {
          title: "Empty Latent Image",
        },
      },
      "8": {
        inputs: {
          seed: seed !== undefined ? seed : Math.floor(Math.random() * 1000000),
          steps: 20,
          cfg: 7.5,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 1.0,
          model: ["1", 0],
          positive: ["6", 0],
          negative: ["3", 0],
          latent_image: ["7", 0],
        },
        class_type: "KSampler",
        _meta: {
          title: "KSampler",
        },
      },
      "9": {
        inputs: {
          samples: ["8", 0],
          vae: ["1", 2],
        },
        class_type: "VAEDecode",
        _meta: {
          title: "VAE Decode",
        },
      },
      "10": {
        inputs: {
          filename_prefix: "controlnet",
          images: ["9", 0],
        },
        class_type: "SaveImage",
        _meta: {
          title: "Save Image",
        },
      },
    }
  }

  static validateWorkflow(workflow: Workflow): boolean {
    try {
      // Check if all required nodes exist
      const requiredNodes = ["1", "2", "3", "5", "6", "9"]
      for (const nodeId of requiredNodes) {
        if (!workflow[nodeId]) {
          console.error(`Missing required node: ${nodeId}`)
          return false
        }
      }

      // Validate node connections
      for (const [nodeId, node] of Object.entries(workflow)) {
        for (const [inputKey, inputValue] of Object.entries(node.inputs)) {
          if (Array.isArray(inputValue) && inputValue.length === 2) {
            const [sourceNodeId] = inputValue
            if (!workflow[sourceNodeId]) {
              console.error(`Invalid connection: Node ${nodeId} references non-existent node ${sourceNodeId}`)
              return false
            }
          }
        }
      }

      return true
    } catch (error) {
      console.error("Workflow validation error:", error)
      return false
    }
  }

  static optimizeWorkflow(
    workflow: Workflow,
    options: {
      fastMode?: boolean
      highQuality?: boolean
      lowMemory?: boolean
    } = {},
  ): Workflow {
    const optimized = JSON.parse(JSON.stringify(workflow))

    if (options.fastMode) {
      // Reduce steps for faster generation
      if (optimized["5"]) {
        optimized["5"].inputs.steps = Math.min(optimized["5"].inputs.steps, 10)
        optimized["5"].inputs.sampler_name = "euler_a"
      }
    }

    if (options.highQuality) {
      // Increase steps for better quality
      if (optimized["5"]) {
        optimized["5"].inputs.steps = Math.max(optimized["5"].inputs.steps, 30)
        optimized["5"].inputs.sampler_name = "dpmpp_2m"
      }
    }

    if (options.lowMemory) {
      // Reduce batch size and image dimensions
      if (optimized["4"]) {
        optimized["4"].inputs.width = Math.min(optimized["4"].inputs.width, 768)
        optimized["4"].inputs.height = Math.min(optimized["4"].inputs.height, 768)
        optimized["4"].inputs.batch_size = 1
      }
    }

    return optimized
  }
}
