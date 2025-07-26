// Complete ComfyUI workflow definitions for different Flux models
export interface ComfyUINode {
  inputs: Record<string, any>
  class_type: string
}

export interface ComfyUIWorkflow {
  [key: string]: ComfyUINode
}

export class WorkflowBuilder {
  static createFluxWorkflow(
    prompt: string,
    modelName: string,
    loraName?: string,
    steps = 20,
    cfg = 7.5,
  ): ComfyUIWorkflow {
    const workflow: ComfyUIWorkflow = {
      // Load Flux model
      "10": {
        inputs: {
          ckpt_name: modelName,
        },
        class_type: "CheckpointLoaderSimple",
      },

      // Load CLIP for text encoding
      "11": {
        inputs: {
          clip_name: "clip_l.safetensors", // Flux uses separate CLIP
        },
        class_type: "CLIPLoader",
      },

      // Positive prompt
      "1": {
        inputs: {
          text: prompt,
          clip: ["11", 0],
        },
        class_type: "CLIPTextEncode",
      },

      // Negative prompt
      "2": {
        inputs: {
          text: "blurry, low quality, distorted, deformed, duplicate, multiple people, crowd",
          clip: ["11", 0],
        },
        class_type: "CLIPTextEncode",
      },

      // Empty latent image
      "5": {
        inputs: {
          width: 1024,
          height: 1024,
          batch_size: 1,
        },
        class_type: "EmptyLatentImage",
      },

      // KSampler for generation
      "3": {
        inputs: {
          seed: Math.floor(Math.random() * 1000000),
          steps: steps,
          cfg: cfg,
          sampler_name: modelName.includes("schnell") ? "euler" : "dpmpp_2m",
          scheduler: "normal",
          denoise: 1,
          model: ["10", 0],
          positive: ["1", 0],
          negative: ["2", 0],
          latent_image: ["5", 0],
        },
        class_type: "KSampler",
      },

      // VAE Decode
      "8": {
        inputs: {
          samples: ["3", 0],
          vae: ["10", 2],
        },
        class_type: "VAEDecode",
      },

      // Save Image
      "9": {
        inputs: {
          filename_prefix: `flux_${Date.now()}`,
          images: ["8", 0],
        },
        class_type: "SaveImage",
      },
    }

    // Add LoRA if specified
    if (loraName) {
      workflow["12"] = {
        inputs: {
          model: ["10", 0],
          clip: ["11", 0],
          lora_name: loraName,
          strength_model: 0.8,
          strength_clip: 0.8,
        },
        class_type: "LoraLoader",
      }

      // Update references to use LoRA
      workflow["1"].inputs.clip = ["12", 1]
      workflow["2"].inputs.clip = ["12", 1]
      workflow["3"].inputs.model = ["12", 0]
    }

    return workflow
  }

  static createTrainingWorkflow(trainingImages: string[], outputName: string, baseModel: string): ComfyUIWorkflow {
    // This would be a more complex workflow for LoRA training
    // For now, return a placeholder that shows the structure
    return {
      "1": {
        inputs: {
          model_name: baseModel,
          output_name: outputName,
          training_images: trainingImages,
          steps: 1000,
          learning_rate: 1e-4,
        },
        class_type: "LoRATrainer", // Custom node for training
      },
    }
  }
}
