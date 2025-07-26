// ComfyUI integration with proper error handling
interface ComfyUIWorkflow {
  [key: string]: {
    inputs: any
    class_type: string
  }
}

export class ComfyUIClient {
  private baseUrl: string

  constructor(baseUrl = "http://localhost:8188") {
    this.baseUrl = baseUrl
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`)
      return response.ok
    } catch (error) {
      return false
    }
  }

  async generateImage(prompt: string, modelName: string, loraName?: string): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new Error("ComfyUI is not available")
    }

    const workflow = this.createWorkflow(prompt, modelName, loraName)

    // Queue the workflow
    const queueResponse = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    })

    if (!queueResponse.ok) {
      throw new Error(`Failed to queue workflow: ${queueResponse.statusText}`)
    }

    const queueResult = await queueResponse.json()
    const promptId = queueResult.prompt_id

    // Poll for completion
    return await this.pollForCompletion(promptId)
  }

  private createWorkflow(prompt: string, modelName: string, loraName?: string): ComfyUIWorkflow {
    const workflow: ComfyUIWorkflow = {
      "1": {
        inputs: {
          text: prompt,
          clip: ["4", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "2": {
        inputs: {
          text: "",
          clip: ["4", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "3": {
        inputs: {
          seed: Math.floor(Math.random() * 1000000),
          steps: 20,
          cfg: 7.5,
          sampler_name: "dpmpp_2m",
          scheduler: "karras",
          denoise: 1,
          model: ["4", 0],
          positive: ["1", 0],
          negative: ["2", 0],
          latent_image: ["5", 0],
        },
        class_type: "KSampler",
      },
      "4": {
        inputs: {
          ckpt_name: modelName,
        },
        class_type: "CheckpointLoaderSimple",
      },
      "5": {
        inputs: {
          width: 1024,
          height: 1024,
          batch_size: 1,
        },
        class_type: "EmptyLatentImage",
      },
      "6": {
        inputs: {
          samples: ["3", 0],
          vae: ["4", 2],
        },
        class_type: "VAEDecode",
      },
      "7": {
        inputs: {
          filename_prefix: "instagram_bot",
          images: ["6", 0],
        },
        class_type: "SaveImage",
      },
    }

    // Add LoRA if specified
    if (loraName) {
      workflow["8"] = {
        inputs: {
          model: ["4", 0],
          clip: ["4", 1],
          lora_name: loraName,
          strength_model: 0.8,
          strength_clip: 0.8,
        },
        class_type: "LoraLoader",
      }

      // Update references to use LoRA
      workflow["1"].inputs.clip = ["8", 1]
      workflow["2"].inputs.clip = ["8", 1]
      workflow["3"].inputs.model = ["8", 0]
    }

    return workflow
  }

  private async pollForCompletion(promptId: string): Promise<string> {
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds

      const historyResponse = await fetch(`${this.baseUrl}/history/${promptId}`)
      const history = await historyResponse.json()

      if (history[promptId]) {
        const outputs = history[promptId].outputs
        const imageInfo = outputs["7"].images[0]

        const imageResponse = await fetch(
          `${this.baseUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder}&type=${imageInfo.type}`,
        )

        const imageBuffer = await imageResponse.arrayBuffer()
        return Buffer.from(imageBuffer).toString("base64")
      }

      attempts++
    }

    throw new Error("ComfyUI generation timed out")
  }
}

export const comfyUI = new ComfyUIClient()
