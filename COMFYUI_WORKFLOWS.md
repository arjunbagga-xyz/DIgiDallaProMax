# ComfyUI Workflows

This document provides a detailed explanation of the ComfyUI workflows used in this application for generating images.

## 1. Overview

The application dynamically constructs ComfyUI workflows in JSON format based on the selected model and user-defined parameters. These workflows are then sent to the ComfyUI server for execution. The core logic for creating these workflows is located in `lib/comfyui-workflows.ts`.

The application supports three main types of models, each with its own workflow structure:
-   **FLUX models**
-   **SDXL models**
-   **SD1.5 models**

The `createWorkflowForModel` function in `lib/comfyui-workflows.ts` first detects the model type using the `detectModelType` function and then calls the appropriate function to create the workflow.

## 2. Image Generation Workflows

### Common Workflow Structure

All image generation workflows share a common structure:
1.  **Load Checkpoint**: Loads the main model file.
2.  **Encode Prompts**: Converts the positive and negative text prompts into embeddings using a CLIP model.
3.  **Create Latent Image**: Creates an empty latent image with the specified dimensions.
4.  **KSampler**: The core of the workflow. It uses the model, prompts, and a sampler to generate the image in the latent space.
5.  **VAE Decode**: Decodes the generated latent image into a pixel-based image.
6.  **Save Image**: Saves the final image.
7.  **Load LoRA (Optional)**: If a LoRA is specified, it's loaded and applied to the model and CLIP.

### SDXL Workflow

The `createSDXLWorkflow` function creates a workflow for SDXL models.

**Key Nodes and Parameters:**
-   **`CheckpointLoaderSimple`**: Loads the SDXL model.
    -   `ckpt_name`: The filename of the model (e.g., `sd_xl_base_1.0.safetensors`).
-   **`CLIPTextEncode`**: Two of these nodes are used, one for the positive prompt and one for the negative prompt.
-   **`EmptyLatentImage`**: Creates a latent image, typically 1024x1024 for SDXL.
-   **`KSampler`**:
    -   `sampler_name`: `dpmpp_2m`
    -   `scheduler`: `karras`
    -   `steps`: 30
    -   `cfg`: 7.5
-   **`VAEDecode`**: Decodes the latent image.
-   **`SaveImage`**: Saves the final image.

**Example SDXL Workflow JSON (simplified):**
```json
{
  "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "sd_xl_base_1.0.safetensors" } },
  "2": { "class_type": "CLIPTextEncode", "inputs": { "text": "a beautiful landscape", "clip": ["1", 1] } },
  "3": { "class_type": "CLIPTextEncode", "inputs": { "text": "low quality, blurry", "clip": ["1", 1] } },
  "4": { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 1024 } },
  "5": { "class_type": "KSampler", "inputs": { "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0], "steps": 30, "cfg": 7.5, "sampler_name": "dpmpp_2m", "scheduler": "karras" } },
  "6": { "class_type": "VAEDecode", "inputs": { "samples": ["5", 0], "vae": ["1", 2] } },
  "7": { "class_type": "SaveImage", "inputs": { "images": ["6", 0] } }
}
```

### FLUX Workflow

The `createFluxWorkflow` function creates a workflow for FLUX models.

**Key Nodes and Parameters:**
-   **`CheckpointLoaderSimple`**: Loads the FLUX model.
-   **`CLIPTextEncode`**: Only one is used for both positive and negative prompts (as FLUX models can handle this differently).
-   **`EmptyLatentImage`**: Creates a 1024x1024 latent image.
-   **`KSampler`**:
    -   `sampler_name`: `euler`
    -   `scheduler`: `simple`
    -   `steps`: 20
    -   `cfg`: 3.5
-   **`VAEDecode`**: Decodes the latent image.
-   **`SaveImage`**: Saves the final image.

### SD1.5 Workflow

The `createSD15Workflow` function creates a workflow for SD1.5 models.

**Key Nodes and Parameters:**
-   **`CheckpointLoaderSimple`**: Loads the SD1.5 model.
-   **`CLIPTextEncode`**: One for positive and one for negative prompts.
-   **`EmptyLatentImage`**: Creates a 512x512 latent image.
-   **`KSampler`**:
    -   `sampler_name`: `euler_a`
    -   `scheduler`: `normal`
    -   `steps`: 25
    -   `cfg`: 7.0
-   **`VAEDecode`**: Decodes the latent image.
-   **`SaveImage`**: Saves the final image.

## 3. LoRA Integration

When a LoRA is specified in the image generation request, the workflows are dynamically modified to include a `LoraLoader` node.

-   A `LoraLoader` node is added to the workflow.
-   The `model` and `clip` outputs of the `CheckpointLoaderSimple` node are re-routed to the `LoraLoader` node.
-   The subsequent nodes (like `CLIPTextEncode` and `KSampler`) are then connected to the `model` and `clip` outputs of the `LoraLoader` node.

This allows for the seamless application of LoRA models to any of the base image generation workflows.

## 4. LoRA Training

The application does not currently use a ComfyUI workflow for LoRA training. The `trainLora` function in `app/page.tsx` sends a request to the `/api/lora/train` endpoint, which is expected to handle the training process through a different mechanism, such as by calling a script or interacting with a dedicated training service like Kohya SS. The details of this process are not defined within the ComfyUI workflow files.
