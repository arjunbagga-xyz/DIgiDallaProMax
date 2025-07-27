// Complete ComfyUI integration with support for any model
import { createWorkflowForModel } from "./comfyui-workflows"

export interface ComfyUIConfig {
  url: string
  timeout: number
}

export interface GenerationRequest {
  prompt: string
  model: string
  negativePrompt?: string
  width?: number
  height?: number
  steps?: number
  cfg?: number
  guidance?: number
  seed?: number
  loraPath?: string
  loraStrength?: number
}

export interface GenerationResult {
  success: boolean
  imageUrl?: string
  imageData?: string
  error?: string
  executionTime?: number
  seed?: number
}

export class ComfyUIClient {
  private config: ComfyUIConfig
  private clientId: string

  constructor(config: ComfyUIConfig) {
    this.config = config
    this.clientId = this.generateClientId()
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/system_stats`, {
        method: "GET",
        timeout: 5000,
      })
      return response.ok
    } catch (error) {
      console.error("ComfyUI connection check failed:", error)
      return false
    }
  }

  async getAvailableModels(): Promise<{ checkpoints: string[]; loras: string[]; vaes: string[] }> {
    try {
      const response = await fetch(`${this.config.url}/object_info`, {
        method: "GET",
        timeout: 10000,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const objectInfo = await response.json()

      const checkpoints = objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || []
      const loras = objectInfo.LoraLoader?.input?.required?.lora_name?.[0] || []
      const vaes = objectInfo.VAELoader?.input?.required?.vae_name?.[0] || []

      return { checkpoints, loras, vaes }
    } catch (error) {
      console.error("Failed to get available models:", error)
      return { checkpoints: [], loras: [], vaes: [] }
    }
  }

  async generateImage(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now()

    try {
      // Validate model exists
      const availableModels = await this.getAvailableModels()
      if (!availableModels.checkpoints.includes(request.model)) {
        throw new Error(
          `Model "${request.model}" not found. Available models: ${availableModels.checkpoints.join(", ")}`,
        )
      }

      // Create workflow based on model type
      const workflow = createWorkflowForModel(request.model, request.prompt, {
        negativePrompt: request.negativePrompt,
        width: request.width,
        height: request.height,
        steps: request.steps,
        cfg: request.cfg,
        guidance: request.guidance,
        seed: request.seed,
        loraPath: request.loraPath,
        loraStrength: request.loraStrength,
      })

      // Queue the workflow
      const queueResponse = await fetch(`${this.config.url}/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: this.clientId,
        }),
      })

      if (!queueResponse.ok) {
        throw new Error(`Failed to queue workflow: ${queueResponse.statusText}`)
      }

      const queueResult = await queueResponse.json()
      const promptId = queueResult.prompt_id

      // Wait for completion and get result
      const result = await this.waitForCompletion(promptId)

      return {
        ...result,
        executionTime: Date.now() - startTime,
        seed: request.seed,
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
    const maxWaitTime = this.config.timeout
    const pollInterval = 1000
    let elapsedTime = 0

    while (elapsedTime < maxWaitTime) {
      try {
        // Check queue status
        const queueResponse = await fetch(`${this.config.url}/queue`)
        const queueData = await queueResponse.json()

        // Check if our prompt is still in queue
        const inQueue =
          queueData.queue_running.some((item: any) => item[1] === promptId) ||
          queueData.queue_pending.some((item: any) => item[1] === promptId)

        if (!inQueue) {
          // Prompt completed, get the result
          const historyResponse = await fetch(`${this.config.url}/history/${promptId}`)
          const historyData = await historyResponse.json()

          if (historyData[promptId]) {
            const outputs = historyData[promptId].outputs

            // Find the SaveImage node output
            for (const nodeId in outputs) {
              const output = outputs[nodeId]
              if (output.images && output.images.length > 0) {
                const image = output.images[0]
                const imageUrl = `${this.config.url}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`

                // Get image data
                const imageResponse = await fetch(imageUrl)
                const imageBuffer = await imageResponse.arrayBuffer()
                const imageData = Buffer.from(imageBuffer).toString("base64")

                return {
                  success: true,
                  imageUrl,
                  imageData,
                }
              }
            }
          }

          throw new Error("No image output found in completed workflow")
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval))
        elapsedTime += pollInterval
      } catch (error) {
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
      const response = await fetch(`${this.config.url}/interrupt`, {
        method: "POST",
      })
      return response.ok
    } catch (error) {
      console.error("Failed to interrupt generation:", error)
      return false
    }
  }

  async getQueueStatus(): Promise<{ running: number; pending: number }> {
    try {
      const response = await fetch(`${this.config.url}/queue`)
      const data = await response.json()

      return {
        running: data.queue_running.length,
        pending: data.queue_pending.length,
      }
    } catch (error) {
      console.error("Failed to get queue status:", error)
      return { running: 0, pending: 0 }
    }
  }

  async getSystemStats(): Promise<any> {
    try {
      const response = await fetch(`${this.config.url}/system_stats`)
      return await response.json()
    } catch (error) {
      console.error("Failed to get system stats:", error)
      return null
    }
  }
}

// Default client instance
export const comfyUIClient = new ComfyUIClient({
  url: process.env.COMFYUI_URL || "http://localhost:8188",
  timeout: 300000, // 5 minutes
})

// Helper function for easy image generation
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

// Helper function to check if ComfyUI is available
export async function isComfyUIAvailable(): Promise<boolean> {
  return await comfyUIClient.checkConnection()
}
