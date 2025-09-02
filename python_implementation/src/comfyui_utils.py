import websocket
import uuid
import json
import requests
from urllib.parse import urlencode

def queue_prompt(prompt_workflow: dict, comfyui_url: str):
    """
    Queues a prompt workflow in ComfyUI and returns the prompt ID.
    """
    client_id = str(uuid.uuid4())

    # The data payload for the /prompt endpoint
    data = {
        "prompt": prompt_workflow,
        "client_id": client_id
    }

    # Make the request to queue the prompt
    response = requests.post(f"{comfyui_url}/prompt", json=data)
    response.raise_for_status()

    return response.json()['prompt_id']


def get_image_data(prompt_id: str, comfyui_url: str):
    """
    Connects to the ComfyUI WebSocket and waits for the image data
    for a given prompt ID.
    """
    # WebSocket URL is the http URL with ws:// scheme
    ws_url = comfyui_url.replace("http", "ws") + "/ws?clientId=" + str(uuid.uuid4())

    ws = websocket.WebSocket()
    ws.connect(ws_url)

    try:
        while True:
            out = ws.recv()
            if isinstance(out, str):
                message = json.loads(out)
                if message['type'] == 'executing':
                    data = message['data']
                    if data['node'] is None and data['prompt_id'] == prompt_id:
                        # Execution is done
                        break
    finally:
        ws.close()

    # After execution, get the history
    history_url = f"{comfyui_url}/history/{prompt_id}"
    response = requests.get(history_url)
    response.raise_for_status()
    history = response.json()

    # Find the output image from the history
    prompt_history = history.get(prompt_id, {})
    outputs = prompt_history.get('outputs', {})

    for node_id in outputs:
        node_output = outputs[node_id]
        if 'images' in node_output:
            images_output = node_output['images']
            if images_output:
                first_image = images_output[0]
                image_filename = first_image['filename']

                # Fetch the image data from the /view endpoint
                image_url = f"{comfyui_url}/view?{urlencode({'filename': image_filename})}"
                image_response = requests.get(image_url)
                image_response.raise_for_status()
                return image_response.content

    return None

def build_basic_workflow(model: str, positive_prompt: str, negative_prompt: str):
    """
    Builds a simple text-to-image workflow JSON.
    """
    # This is a simplified workflow. A real one has more nodes and connections.
    # The numbers are node IDs.
    workflow = {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 12345, # A fixed seed for reproducibility
                "steps": 20,
                "cfg": 8,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            }
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": { "ckpt_name": model }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": { "width": 512, "height": 512, "batch_size": 1 }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": { "text": positive_prompt, "clip": ["4", 1] }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": { "text": negative_prompt, "clip": ["4", 1] }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": { "filename_prefix": "digitaldalla", "images": ["8", 0] }
        }
    }
    return workflow
