// Complete ComfyUI client with full error handling and model management
import { WorkflowBuilder } from "./comfyui-workflows"

export interface GenerationOptions {
  prompt: string
  modelName: string
  loraName?: string
  steps?: number
  cfg?: number
  width?: number
  height?: number
  seed?: number
}

export interface ModelInfo {
  name: string
  type: "checkpoint" | "lora" | "vae" | "clip"
  size: number
  loaded: boolean
}

export class ComfyUIClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl = "http://localhost:8188", timeout = 300000) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.baseUrl}/system_stats`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      return false
    }
  }

  async getSystemStats(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/system_stats`)
    if (!response.ok) throw new Error("Failed to get system stats")
    return response.json()
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/object_info`)
      if (!response.ok) throw new Error("Failed to get models")

      const objectInfo = await response.json()
      const models: ModelInfo[] = []

      // Extract checkpoint models
      if (objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]) {
        const checkpoints = objectInfo.CheckpointLoaderSimple.input.required.ckpt_name[0]
        checkpoints.forEach((name: string) => {
          models.push({
            name,
            type: "checkpoint",
            size: 0, // Would need to check file system for actual size
            loaded: true,
          })
        })
      }

      // Extract LoRA models
      if (objectInfo.LoraLoader?.input?.required?.lora_name?.[0]) {
        const loras = objectInfo.LoraLoader.input.required.lora_name[0]
        loras.forEach((name: string) => {
          models.push({
            name,
            type: "lora",
            size: 0,
            loaded: true,
          })
        })
      }

      return models
    } catch (error) {
      console.error("Error getting models:", error)
      return []
    }
  }

  async generateImage(options: GenerationOptions): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new Error("ComfyUI is not available. Please start ComfyUI server.")
    }

    const workflow = WorkflowBuilder.createFluxWorkflow(
      options.prompt,
      options.modelName,
      options.loraName,
      options.steps || 20,
      options.cfg || 7.5,
    )

    console.log("🎨 Queuing ComfyUI workflow...")

    // Queue the workflow
    const queueResponse = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    })

    if (!queueResponse.ok) {
      const errorText = await queueResponse.text()
      throw new Error(`Failed to queue workflow: ${queueResponse.statusText} - ${errorText}`)
    }

    const queueResult = await queueResponse.json()
    const promptId = queueResult.prompt_id

    console.log(`⏳ Waiting for generation (ID: ${promptId})...`)

    // Poll for completion with timeout
    return await this.pollForCompletion(promptId)
  }

  private async pollForCompletion(promptId: string): Promise<string> {
    const startTime = Date.now()
    let attempts = 0
    const maxAttempts = Math.floor(this.timeout / 5000) // Check every 5 seconds

    while (attempts < maxAttempts) {
      const elapsed = Date.now() - startTime
      if (elapsed > this.timeout) {
        throw new Error(`Generation timed out after ${this.timeout / 1000} seconds`)
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))

      try {
        const historyResponse = await fetch(`${this.baseUrl}/history/${promptId}`)

        if (!historyResponse.ok) {
          console.log(`History check failed: ${historyResponse.statusText}`)
          attempts++
          continue
        }

        const history = await historyResponse.json()

        if (history[promptId]) {
          const execution = history[promptId]

          // Check for errors
          if (execution.status?.status_str === "error") {
            const errorMsg = execution.status.messages?.[0]?.[1] || "Unknown error"
            throw new Error(`ComfyUI generation failed: ${errorMsg}`)
          }

          // Check if completed successfully
          if (execution.outputs && execution.outputs["9"]) {
            const imageInfo = execution.outputs["9"].images[0]

            console.log("✅ Generation completed, downloading image...")

            const imageResponse = await fetch(
              `${this.baseUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder}&type=${imageInfo.type}`,
            )

            if (!imageResponse.ok) {
              throw new Error(`Failed to download image: ${imageResponse.statusText}`)
            }

            const imageBuffer = await imageResponse.arrayBuffer()
            return Buffer.from(imageBuffer).toString("base64")
          }
        }

        // Check queue status
        const queueResponse = await fetch(`${this.baseUrl}/queue`)
        const queueData = await queueResponse.json()

        const isInQueue =
          queueData.queue_running.some((item: any) => item[1] === promptId) ||
          queueData.queue_pending.some((item: any) => item[1] === promptId)

        if (!isInQueue && !history[promptId]) {
          throw new Error("Generation was removed from queue without completion")
        }

        console.log(`⏳ Still generating... (${Math.round(elapsed / 1000)}s elapsed)`)
      } catch (error) {
        if (error.message.includes("ComfyUI generation failed") || error.message.includes("Generation timed out")) {
          throw error
        }
        console.log(`Polling error: ${error.message}`)
      }

      attempts++
    }

    throw new Error("Generation timed out - no response from ComfyUI")
  }

  async interruptGeneration(): Promise<void> {
    await fetch(`${this.baseUrl}/interrupt`, { method: "POST" })
  }

  async clearQueue(): Promise<void> {
    await fetch(`${this.baseUrl}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    })
  }

  async getQueueStatus(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/queue`)
    return response.json()
  }
}

export const comfyUI = new ComfyUIClient()
