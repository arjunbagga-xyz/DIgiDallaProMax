import requests
import json
import time
import config

def get_models():
    """Fetches the list of available checkpoint models from ComfyUI."""
    try:
        response = requests.get(f"{config.COMFYUI_URL}/object_info")
        response.raise_for_status()
        object_info = response.json()
        if "CheckpointLoaderSimple" in object_info:
            return object_info["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
        return []
    except requests.exceptions.RequestException as e:
        print(f"Error fetching models from ComfyUI: {e}")
        return []

def get_loras():
    """Fetches the list of available LoRA models from ComfyUI."""
    try:
        response = requests.get(f"{config.COMFYUI_URL}/object_info")
        response.raise_for_status()
        object_info = response.json()
        if "LoraLoader" in object_info:
            return object_info["LoraLoader"]["input"]["required"]["lora_name"][0]
        return []
    except requests.exceptions.RequestException as e:
        print(f"Error fetching LoRAs from ComfyUI: {e}")
        return []

def queue_prompt(prompt_workflow):
    """Queues a prompt workflow to be executed by ComfyUI."""
    try:
        data = json.dumps({"prompt": prompt_workflow}).encode('utf-8')
        response = requests.post(f"{config.COMFYUI_URL}/prompt", data=data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error queuing prompt in ComfyUI: {e}")
        return None

def get_history(prompt_id):
    """Gets the execution history for a given prompt ID."""
    try:
        response = requests.get(f"{config.COMFYUI_URL}/history/{prompt_id}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error getting history from ComfyUI: {e}")
        return None

def generate_image(model, prompt, lora=None, negative_prompt=""):
    """Generates an image using a simplified SDXL workflow."""
    # This is a simplified SDXL workflow based on COMFYUI_WORKFLOWS.md
    # A real implementation would be more robust and handle different model types.
    workflow = {
      "3": {
        "class_type": "KSampler",
        "inputs": {
          "seed": int(time.time()),
          "steps": 25,
          "cfg": 8,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1,
          "model": [ "4", 0 ],
          "positive": [ "6", 0 ],
          "negative": [ "7", 0 ],
          "latent_image": [ "5", 0 ]
        }
      },
      "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": { "ckpt_name": model }
      },
      "5": {
        "class_type": "EmptyLatentImage",
        "inputs": {
          "width": 1024,
          "height": 1024,
          "batch_size": 1
        }
      },
      "6": {
        "class_type": "CLIPTextEncode",
        "inputs": {
          "text": prompt,
          "clip": [ "4", 1 ]
        }
      },
      "7": {
        "class_type": "CLIPTextEncode",
        "inputs": {
          "text": negative_prompt,
          "clip": [ "4", 1 ]
        }
      },
      "8": {
        "class_type": "VAEDecode",
        "inputs": {
          "samples": [ "3", 0 ],
          "vae": [ "4", 2 ]
        }
      },
      "9": {
        "class_type": "SaveImage",
        "inputs": {
          "filename_prefix": "digital-dalla",
          "images": [ "8", 0 ]
        }
      }
    }

    # Simple LoRA integration (not fully robust)
    if lora and lora != "None":
        workflow["10"] = {
          "class_type": "LoraLoader",
          "inputs": {
            "lora_name": lora,
            "strength_model": 1.0,
            "strength_clip": 1.0,
            "model": ["4", 0],
            "clip": ["4", 1]
          }
        }
        workflow["3"]["inputs"]["model"] = ["10", 0]
        workflow["6"]["inputs"]["clip"] = ["10", 1]
        workflow["7"]["inputs"]["clip"] = ["10", 1]


    result = queue_prompt(workflow)
    if not result or 'prompt_id' not in result:
        return None

    prompt_id = result['prompt_id']

    # Poll for the result
    while True:
        history = get_history(prompt_id)
        if history and prompt_id in history and 'outputs' in history[prompt_id]:
            outputs = history[prompt_id]['outputs']
            for node_id in outputs:
                node_output = outputs[node_id]
                if 'images' in node_output:
                    for image in node_output['images']:
                        if image['type'] == 'output':
                            return image['filename']
        time.sleep(1)
