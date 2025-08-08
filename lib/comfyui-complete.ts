// Complete ComfyUI client with full model management
import { createWorkflowForModel, getDefaultConfigForModel } from "./comfyui-workflows"

export interface ComfyUIModel {
  name: string
  type: "checkpoint" | "lora" | "vae" | "clip" | "controlnet"
  size?: number
  loaded: boolean
  lastUsed?: string
  modelType?: "flux" | "sdxl" | "sd15" | "unknown"
}

export interface GenerationRequest {
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
}

export interface GenerationResult {
  success: boolean
  imageUrl?: string
  imageData?: string
  error?: string
  executionTime?: number
  seed?: number
  metadata?: Record<string, any>
}

export class ComfyUIClient {
  private baseUrl: string
  private clientId: string
  private timeout: number

  constructor(baseUrl = process.env.COMFYUI_URL || "http://localhost:8188", timeout = 300000) {
    this.baseUrl = baseUrl
    this.clientId = this.generateClientId()
    this.timeout = timeout
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch (error) {
      console.error("ComfyUI availability check failed:", error)
      return false
    }
  }

  async getModels(): Promise<ComfyUIModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/object_info`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const objectInfo = await response.json()
      const models: ComfyUIModel[] = []

      // Get checkpoints
      const checkpoints = objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || []
      for (const checkpoint of checkpoints) {
        models.push({
          name: checkpoint,
          type: "checkpoint",
          loaded: false,
          modelType: this.detectModelType(checkpoint),
        })
      }

      // Get LoRAs
      const loras = objectInfo.LoraLoader?.input?.required?.lora_name?.[0] || []
      for (const lora of loras) {
        models.push({
          name: lora,
          type: "lora",
          loaded: false,
        })
      }

      // Get VAEs
      const vaes = objectInfo.VAELoader?.input?.required?.vae_name?.[0] || []
      for (const vae of vaes) {
        models.push({
          name: vae,
          type: "vae",
          loaded: false,
        })
      }

      return models
    } catch (error) {
      console.error("Failed to get models from ComfyUI:", error)
      return []
    }
  }

  private detectModelType(modelName: string): "flux" | "sdxl" | "sd15" | "unknown" {
    const name = modelName.toLowerCase()

    if (name.includes("flux")) {
      return "flux"
    } else if (name.includes("xl") || name.includes("sdxl")) {
      return "sdxl"
    } else if (name.includes("sd15") || name.includes("1.5") || name.includes("v1-5")) {
      return "sd15"
    }

    return "unknown"
  }

  async generateImage(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now()

    try {
      // Validate model exists
      const availableModels = await this.getModels()
      const modelExists = availableModels.some((m) => m.name === request.model && m.type === "checkpoint")

      if (!modelExists) {
        const availableCheckpoints = availableModels.filter((m) => m.type === "checkpoint").map((m) => m.name)
        throw new Error(`Model "${request.model}" not found. Available models: ${availableCheckpoints.join(", ")}`)
      }

      // Get default config for model type
      const defaultConfig = getDefaultConfigForModel(request.model)
      const finalConfig = { ...defaultConfig, ...request }

      // Create workflow
      const workflow = createWorkflowForModel(request.model, request.prompt, finalConfig)

      // Queue the workflow
      const queueResponse = await fetch(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: this.clientId,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!queueResponse.ok) {
        const errorText = await queueResponse.text()
        throw new Error(`Failed to queue workflow: ${queueResponse.statusText} - ${errorText}`)
      }

      const queueResult = await queueResponse.json()
      const promptId = queueResult.prompt_id

      if (!promptId) {
        throw new Error("No prompt ID returned from ComfyUI")
      }

      // Wait for completion
      const result = await this.waitForCompletion(promptId)

      return {
        ...result,
        executionTime: Date.now() - startTime,
        seed: finalConfig.seed,
        metadata: {
          model: request.model,
          prompt: request.prompt,
          negativePrompt: request.negativePrompt,
          config: finalConfig,
        },
      }
    } catch (error) {
      console.error("Image generation failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        executionTime: Date.now() - startTime,
      }
    }
  }

  private async waitForCompletion(promptId: string): Promise<GenerationResult> {
    const maxWaitTime = this.timeout
    const pollInterval = 1000
    let elapsedTime = 0

    while (elapsedTime < maxWaitTime) {
      try {
        // Check queue status
        const queueResponse = await fetch(`${this.baseUrl}/queue`, {
          signal: AbortSignal.timeout(5000),
        })

        if (!queueResponse.ok) {
          throw new Error(`Queue check failed: ${queueResponse.statusText}`)
        }

        const queueData = await queueResponse.json()

        // Check if our prompt is still in queue
        const inQueue =
          queueData.queue_running?.some((item: any) => item[1] === promptId) ||
          queueData.queue_pending?.some((item: any) => item[1] === promptId)

        if (!inQueue) {
          // Prompt completed, get the result
          const historyResponse = await fetch(`${this.baseUrl}/history/${promptId}`, {
            signal: AbortSignal.timeout(10000),
          })

          if (!historyResponse.ok) {
            throw new Error(`History check failed: ${historyResponse.statusText}`)
          }

          const historyData = await historyResponse.json()

          if (historyData[promptId]) {
            const outputs = historyData[promptId].outputs

            // Find the SaveImage node output
            for (const nodeId in outputs) {
              const output = outputs[nodeId]
              if (output.images && output.images.length > 0) {
                const image = output.images[0]
                const imageUrl = `${this.baseUrl}/view?filename=${image.filename}&subfolder=${image.subfolder || ""}&type=${image.type || "output"}`

                try {
                  // Get image data
                  const imageResponse = await fetch(imageUrl, {
                    signal: AbortSignal.timeout(30000),
                  })

                  if (!imageResponse.ok) {
                    throw new Error(`Image fetch failed: ${imageResponse.statusText}`)
                  }

                  const imageBuffer = await imageResponse.arrayBuffer()
                  const imageData = Buffer.from(imageBuffer).toString("base64")

                  return {
                    success: true,
                    imageUrl,
                    imageData,
                  }
                } catch (imageError) {
                  console.error("Failed to fetch generated image:", imageError)
                  return {
                    success: false,
                    error: `Failed to fetch generated image: ${imageError instanceof Error ? imageError.message : "Unknown error"}`,
                  }
                }
              }
            }

            // Check for errors in the history
            if (historyData[promptId].status?.status_str === "error") {
              const errorMessages = historyData[promptId].status?.messages || []
              const errorText = errorMessages.map((msg: any) => msg[1]).join(", ")
              throw new Error(`Generation failed: ${errorText}`)
            }
          }

          throw new Error("No image output found in completed workflow")
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval))
        elapsedTime += pollInterval
      } catch (error) {
        if (error instanceof Error && error.message.includes("Generation failed:")) {
          return {
            success: false,
            error: error.message,
          }
        }

        console.error("Error while waiting for completion:", error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error while waiting for completion",
        }
      }
    }

    return {
      success: false,
      error: `Generation timed out after ${maxWaitTime}ms`,
    }
  }

  async interruptGeneration(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/interrupt`, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch (error) {
      console.error("Failed to interrupt generation:", error)
      return false
    }
  }

  async getQueueStatus(): Promise<{ running: number; pending: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/queue`, {
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`Queue status check failed: ${response.statusText}`)
      }

      const data = await response.json()

      return {
        running: data.queue_running?.length || 0,
        pending: data.queue_pending?.length || 0,
      }
    } catch (error) {
      console.error("Failed to get queue status:", error)
      return { running: 0, pending: 0 }
    }
  }

  async getSystemStats(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`System stats check failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Failed to get system stats:", error)
      return null
    }
  }

  async downloadModel(modelUrl: string, modelName: string, modelType?: string): Promise<{ success: boolean; message: string }> {
    try {
      const fetch = (await import('node-fetch')).default
      const fs = await import('fs/promises')
      const path = await import('path')

      const modelDir = this.getModelDirectory(modelType || this.detectModelType(modelName));
      const filePath = path.join(modelDir, modelName);

      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.statusText}`);
      }

      const fileStream = require('fs').createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on("error", reject);
        fileStream.on("finish", resolve);
      });

      return {
        success: true,
        message: `Model ${modelName} downloaded successfully to ${filePath}.`,
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to download model",
      }
    }
  }

  private getModelDirectory(modelType: string): string {
    const basePath = process.env.COMFYUI_BASE_PATH || path.join(process.cwd(), 'ComfyUI');
    switch (modelType) {
      case 'checkpoint':
        return path.join(basePath, 'models', 'checkpoints');
      case 'lora':
        return path.join(basePath, 'models', 'loras');
      case 'vae':
        return path.join(basePath, 'models', 'vaes');
      case 'controlnet':
        return path.join(basePath, 'models', 'controlnet');
      default:
        return path.join(basePath, 'models', 'misc');
    }
  }

  async loadModel(modelName: string): Promise<{ success: boolean; message: string }> {
    try {
      // ComfyUI loads models automatically when used in workflows
      // We can verify the model exists
      const models = await this.getModels()
      const modelExists = models.some((m) => m.name === modelName)

      if (!modelExists) {
        return {
          success: false,
          message: `Model ${modelName} not found`,
        }
      }

      return {
        success: true,
        message: `Model ${modelName} is available and will be loaded when used`,
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load model",
      }
    }
  }
}

// Export singleton instance
export const comfyUIClient = new ComfyUIClient()

// Helper functions
export async function generateImageWithComfyUI(
  prompt: string,
  model: string,
  options: Partial<GenerationRequest> = {},
): Promise<GenerationResult> {
  return await comfyUIClient.generateImage({
    prompt,
    model,
    ...options,
  })
}

export async function isComfyUIAvailable(): Promise<boolean> {
  return await comfyUIClient.isAvailable()
}

export async function getAvailableModels(): Promise<ComfyUIModel[]> {
  return await comfyUIClient.getModels()
}

export async function getCheckpointModels(): Promise<string[]> {
  const models = await comfyUIClient.getModels()
  return models.filter((m) => m.type === "checkpoint").map((m) => m.name)
}

export async function getLoRAModels(): Promise<string[]> {
  const models = await comfyUIClient.getModels()
  return models.filter((m) => m.type === "lora").map((m) => m.name)
}
