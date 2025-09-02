# Main Flask application file
# This file will contain all backend logic and API endpoints.
import os
import json
import random
from flask import Flask, request, jsonify
from datetime import datetime
import uuid

app = Flask(__name__, static_folder='static', static_url_path='')

DATA_DIR = os.path.join(os.getcwd(), "data")
CHARACTERS_FILE = os.path.join(DATA_DIR, "characters.json")

# Helper functions for data persistence
def load_characters():
    if not os.path.exists(CHARACTERS_FILE):
        return []
    with open(CHARACTERS_FILE, 'r') as f:
        return json.load(f)

def save_characters(characters):
    with open(CHARACTERS_FILE, 'w') as f:
        json.dump(characters, f, indent=2)

# More constants for data files
PROMPTS_FILE = os.path.join(DATA_DIR, "generated-prompts.json")
TEMPLATES_FILE = os.path.join(DATA_DIR, "prompt-templates.json")

# Configuration
COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")

# --- Scheduler Setup ---
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = BackgroundScheduler()

def placeholder_task(task_id):
    """A placeholder function for scheduled jobs."""
    print(f"Executing scheduled task: {task_id}")
    # In the future, this will trigger the actual generate/post logic
    pass

def load_schedule():
    schedule_file = os.path.join(DATA_DIR, "schedule.json")
    if not os.path.exists(schedule_file):
        return []
    with open(schedule_file, 'r') as f:
        return json.load(f)

def save_schedule(schedule):
    schedule_file = os.path.join(DATA_DIR, "schedule.json")
    with open(schedule_file, 'w') as f:
        json.dump(schedule, f, indent=2)

def initialize_scheduler():
    """Loads tasks from file and adds them to the scheduler."""
    tasks = load_schedule()
    for task in tasks:
        if task.get('active', True):
            scheduler.add_job(
                placeholder_task,
                CronTrigger.from_crontab(task['schedule']),
                id=task['id'],
                args=[task['id']]
            )
    scheduler.start()

# --- API Endpoints ---

@app.route('/api/scheduler', methods=['GET'])
def get_schedule():
    tasks = load_schedule()
    jobs = {job.id: job.next_run_time for job in scheduler.get_jobs()}

    for task in tasks:
        task['next_run_time'] = jobs.get(task['id'])

    return jsonify({"tasks": tasks})

@app.route('/api/scheduler', methods=['POST'])
def add_task():
    data = request.get_json()
    if not data or not data.get('characterId') or not data.get('schedule'):
        return jsonify({"error": "characterId and schedule are required"}), 400

    new_task = {
        "id": f"task_{uuid.uuid4().hex}",
        "characterId": data['characterId'],
        "type": data.get('type', 'generate_and_post'),
        "schedule": data['schedule'],
        "active": True,
        "createdAt": datetime.now().isoformat()
    }

    tasks = load_schedule()
    tasks.append(new_task)
    save_schedule(tasks)

    scheduler.add_job(
        placeholder_task,
        CronTrigger.from_crontab(new_task['schedule']),
        id=new_task['id'],
        args=[new_task['id']]
    )

    return jsonify({"success": True, "task": new_task}), 201

@app.route('/api/scheduler/<string:task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks = load_schedule()
    original_length = len(tasks)
    tasks = [task for task in tasks if task['id'] != task_id]

    if len(tasks) == original_length:
        return jsonify({"error": "Task not found"}), 404

    save_schedule(tasks)

    if scheduler.get_job(task_id):
        scheduler.remove_job(task_id)

    return jsonify({"success": True})

@app.route('/api/scheduler/<string:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid data"}), 400

    tasks = load_schedule()
    task_found = False
    for task in tasks:
        if task['id'] == task_id:
            task.update(data)
            task['updatedAt'] = datetime.now().isoformat()

            if scheduler.get_job(task_id):
                trigger = CronTrigger.from_crontab(task['schedule'])
                scheduler.reschedule_job(task_id, trigger=trigger)

            task_found = True
            break

    if not task_found:
        return jsonify({"error": "Task not found"}), 404

    save_schedule(tasks)

    return jsonify({"success": True})

@app.route('/api/post-to-instagram', methods=['POST'])
def post_to_instagram():
    # Placeholder implementation
    data = request.get_json()
    if not data or not all(k in data for k in ['characterId', 'imageUrl', 'caption']):
        return jsonify({"error": "characterId, imageUrl, and caption are required"}), 400

    print(f"Simulating post to Instagram for character {data['characterId']}")
    print(f"Caption: {data['caption']}")

    return jsonify({
        "success": True,
        "postId": f"insta_{uuid.uuid4().hex}",
        "message": "Successfully posted to Instagram (simulation)."
    })

@app.route('/api/post-to-twitter', methods=['POST'])
def post_to_twitter():
    # Placeholder implementation
    data = request.get_json()
    if not data or not all(k in data for k in ['characterId', 'imageUrl', 'caption']):
        return jsonify({"error": "characterId, imageUrl, and caption are required"}), 400

    print(f"Simulating post to Twitter for character {data['characterId']}")
    print(f"Caption: {data['caption']}")

    return jsonify({
        "success": True,
        "postId": f"tweet_{uuid.uuid4().hex}",
        "message": "Successfully posted to Twitter (simulation)."
    })

# In-memory stores for tasks
generation_tasks = {}
lora_training_tasks = {}

def _run_lora_training(task_id, payload):
    import subprocess
    import sys

    lora_training_tasks[task_id] = {"status": "running", "log": ""}

    try:
        base_model = payload.get("base_model", "runwayml/stable-diffusion-v1-5")
        image_dir = payload.get("image_dir", "training_data/default_character")
        output_dir = payload.get("output_dir", f"loras/{task_id}")

        command = [
            sys.executable,
            "train_lora.py",
            "--base_model", base_model,
            "--images", image_dir,
            "--output", output_dir
        ]

        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

        log = ""
        for line in iter(process.stdout.readline, ''):
            log += line
            lora_training_tasks[task_id]['log'] = log

        process.wait()

        if process.returncode == 0:
            lora_training_tasks[task_id]['status'] = 'completed'
        else:
            lora_training_tasks[task_id]['status'] = 'failed'

    except Exception as e:
        lora_training_tasks[task_id] = {"status": "failed", "error": str(e)}

@app.route('/api/lora/train', methods=['POST'])
def train_lora_model():
    import threading

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid data"}), 400

    task_id = f"lora_train_{uuid.uuid4().hex}"

    thread = threading.Thread(target=_run_lora_training, args=(task_id, data))
    thread.start()

    return jsonify({"task_id": task_id})

@app.route('/api/lora/training-status/<string:task_id>', methods=['GET'])
def get_lora_training_status(task_id):
    task = lora_training_tasks.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)

@app.route('/api/system/status', methods=['GET'])
def get_system_status():
    # In a real app, this would check the status of ComfyUI, DB, etc.
    # For now, we'll return a mock status.
    comfyui_status = "connected"
    try:
        import requests
        response = requests.get(f"{COMFYUI_URL}/system_stats", timeout=2)
        if not response.ok:
            comfyui_status = "disconnected"
    except requests.exceptions.RequestException:
        comfyui_status = "disconnected"

    status = {
        "comfyUI": comfyui_status,
        "database": "connected", # Since we're using local files
        "scheduler": "running" if scheduler.running else "stopped",
        "version": "1.0.0-python"
    }
    return jsonify(status)

def create_comfy_workflow(prompt, model, seed):
    # This is a simplified workflow based on the standard txt2img.
    # It can be expanded to match the complexity of the TypeScript version.
    return {
        "3": {
            "inputs": {
                "seed": seed,
                "steps": 20,
                "cfg": 8,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            },
            "class_type": "KSampler"
        },
        "4": {
            "inputs": {"ckpt_name": model},
            "class_type": "CheckpointLoaderSimple"
        },
        "5": {
            "inputs": {"width": 512, "height": 512, "batch_size": 1},
            "class_type": "EmptyLatentImage"
        },
        "6": {
            "inputs": {"text": prompt, "clip": ["4", 1]},
            "class_type": "CLIPTextEncode"
        },
        "7": {
            "inputs": {"text": "text, wattermark, ugly", "clip": ["4", 1]},
            "class_type": "CLIPTextEncode"
        },
        "8": {
            "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
            "class_type": "VAEDecode"
        },
        "9": {
            "inputs": {"filename_prefix": "comfy_gen", "images": ["8", 0]},
            "class_type": "SaveImage"
        }
    }

def _run_image_generation(task_id, payload):
    import requests
    import time

    generation_tasks[task_id] = {"status": "running", "result": None}

    try:
        prompt = payload['prompt']
        model = payload['model']
        seed = payload.get('seed', random.randint(0, 1_000_000_000))

        workflow = create_comfy_workflow(prompt, model, seed)

        # Queue prompt
        p = {"prompt": workflow, "client_id": str(uuid.uuid4())}
        data = json.dumps(p).encode('utf-8')
        req = requests.post(f"{COMFYUI_URL}/prompt", data=data)
        prompt_id = req.json()['prompt_id']

        # Poll for result
        while True:
            with requests.get(f"{COMFYUI_URL}/history/{prompt_id}") as response:
                history = response.json()
                if prompt_id in history and history[prompt_id]['outputs']:
                    outputs = history[prompt_id]['outputs']
                    # Find the image output
                    image_output = None
                    for node_id in outputs:
                        if 'images' in outputs[node_id]:
                            image_output = outputs[node_id]['images'][0]
                            break

                    if image_output:
                        image_data, mime_type = _get_image_data(image_output['filename'])
                        generation_tasks[task_id] = {
                            "status": "completed",
                            "result": {"image_data": image_data, "mime_type": mime_type}
                        }
                    else:
                        raise Exception("No image output found")
                    return
            time.sleep(1)

    except Exception as e:
        generation_tasks[task_id] = {"status": "failed", "error": str(e)}

def _get_image_data(filename):
    import requests
    import base64

    response = requests.get(f"{COMFYUI_URL}/view?filename={filename}", timeout=20)
    response.raise_for_status()
    mime_type = response.headers['Content-Type']
    image_data = base64.b64encode(response.content).decode('utf-8')
    return image_data, mime_type

@app.route('/api/generate-image', methods=['POST'])
def generate_image():
    import threading

    data = request.get_json()
    if not data or 'prompt' not in data or 'model' not in data:
        return jsonify({"error": "Prompt and model are required"}), 400

    task_id = f"task_{uuid.uuid4().hex}"

    thread = threading.Thread(target=_run_image_generation, args=(task_id, data))
    thread.start()

    return jsonify({"task_id": task_id})

@app.route('/api/generation-status/<string:task_id>', methods=['GET'])
def get_generation_status(task_id):
    task = generation_tasks.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)

@app.route('/api/generate-caption', methods=['POST'])
def generate_caption():
    # Placeholder implementation
    # In a real implementation, this would call an external AI API (e.g., Gemini)
    # For now, we return a sample caption.
    data = request.get_json()
    prompt = data.get('prompt', 'a beautiful image')

    # Create a sample caption based on the prompt
    sample_caption = f"A caption for an image generated with the prompt: '{prompt}'. #aiart #generatedart #coolpictures"

    return jsonify({"caption": sample_caption})

# Endpoint to get available models from ComfyUI
@app.route('/api/models', methods=['GET'])
def get_models():
    try:
        import requests
        response = requests.get(f"{COMFYUI_URL}/object_info", timeout=5)
        response.raise_for_status()
        object_info = response.json()

        checkpoints = object_info.get('CheckpointLoaderSimple', {}).get('input', {}).get('required', {}).get('ckpt_name', [[]])[0]
        loras = object_info.get('LoraLoader', {}).get('input', {}).get('required', {}).get('lora_name', [[]])[0]

        models = []
        for name in checkpoints:
            models.append({"name": name, "type": "checkpoint"})
        for name in loras:
            models.append({"name": name, "type": "lora"})

        return jsonify({"models": models})
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Could not connect to ComfyUI: {e}"}), 503
    except Exception as e:
        return jsonify({"error": f"An error occurred: {e}"}), 500

# Helper functions for prompts and templates
def load_prompts():
    if not os.path.exists(PROMPTS_FILE):
        return []
    with open(PROMPTS_FILE, 'r') as f:
        return json.load(f)

def save_prompts(prompts):
    with open(PROMPTS_FILE, 'w') as f:
        json.dump(prompts, f, indent=2)

def load_templates():
    if not os.path.exists(TEMPLATES_FILE):
        # If the file doesn't exist, create it with default templates
        from default_templates import DEFAULT_TEMPLATES
        save_templates(DEFAULT_TEMPLATES)
        return DEFAULT_TEMPLATES
    with open(TEMPLATES_FILE, 'r') as f:
        return json.load(f)

def save_templates(templates):
    with open(TEMPLATES_FILE, 'w') as f:
        json.dump(templates, f, indent=2)

# API endpoint for getting prompts and templates
@app.route('/api/prompts', methods=['GET'])
def get_prompts():
    type = request.args.get("type")

    if type == "templates":
        templates = load_templates()
        categories = list(set(t['category'] for t in templates))
        summary = {
            "total": len(templates),
            "byCategory": {cat: sum(1 for t in templates if t['category'] == cat) for cat in categories}
        }
        return jsonify({
            "templates": templates,
            "categories": categories,
            "summary": summary
        })

    # Default to returning generated prompts
    prompts = load_prompts()
    characters = load_characters()

    char_map = {char['id']: char['name'] for char in characters}
    for p in prompts:
        p['characterName'] = char_map.get(p.get('characterId'), "Unknown")

    # Filtering
    character_id = request.args.get("characterId")
    if character_id:
        prompts = [p for p in prompts if p.get('characterId') == character_id]

    used_status = request.args.get("used")
    if used_status is not None:
        is_used = used_status.lower() == 'true'
        prompts = [p for p in prompts if p.get('used') == is_used]

    prompts.sort(key=lambda p: p.get('createdAt', ''), reverse=True)

    summary = {
        "total": len(prompts),
        "used": sum(1 for p in prompts if p.get('used')),
        "unused": sum(1 for p in prompts if not p.get('used')),
        "withImages": sum(1 for p in prompts if p.get('imageGenerated')),
        "posted": sum(1 for p in prompts if p.get('posted')),
    }

    return jsonify({"prompts": prompts, "summary": summary})

@app.route('/api/prompts', methods=['POST'])
def handle_prompt_actions():
    data = request.get_json()
    action = data.get('action')

    if not action:
        return jsonify({"error": "Action is required"}), 400

    if action == 'save_template':
        template_data = data.get('template', {})
        if not template_data.get('name') or not template_data.get('template'):
            return jsonify({"error": "Template name and text are required"}), 400

        templates = load_templates()
        template_id = template_data.get('id')

        if template_id: # Update existing
            for t in templates:
                if t['id'] == template_id:
                    t.update(template_data)
                    t['updatedAt'] = datetime.now().isoformat()
                    break
        else: # Create new
            template_data['id'] = f"template_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
            template_data['createdAt'] = datetime.now().isoformat()
            template_data['updatedAt'] = datetime.now().isoformat()
            templates.append(template_data)

        save_templates(templates)
        return jsonify({"success": True, "template": template_data})

    elif action == 'delete_template':
        template_id = data.get('templateId')
        if not template_id:
            return jsonify({"error": "Template ID is required"}), 400

        templates = load_templates()
        original_length = len(templates)
        templates = [t for t in templates if t['id'] != template_id]

        if len(templates) == original_length:
            return jsonify({"error": "Template not found"}), 404

        save_templates(templates)
        return jsonify({"success": True})

    elif action == 'use_prompt':
        prompt_id = data.get('promptId')
        if not prompt_id:
            return jsonify({"error": "Prompt ID is required"}), 400

        prompts = load_prompts()
        prompt_found = False
        for p in prompts:
            if p['id'] == prompt_id:
                p['used'] = True
                p['usedAt'] = datetime.now().isoformat()
                prompt_found = True
                break

        if not prompt_found:
            return jsonify({"error": "Prompt not found"}), 404

        save_prompts(prompts)
        return jsonify({"success": True})

    elif action == 'delete_prompt':
        prompt_id = data.get('promptId')
        if not prompt_id:
            return jsonify({"error": "Prompt ID is required"}), 400

        prompts = load_prompts()
        original_length = len(prompts)
        prompts = [p for p in prompts if p['id'] != prompt_id]

        if len(prompts) == original_length:
            return jsonify({"error": "Prompt not found"}), 404

        save_prompts(prompts)
        return jsonify({"success": True})

    elif action == 'generate':
        new_prompt, error = _generate_single_prompt(request.get_json())
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"success": True, "prompt": new_prompt})

    elif action == 'bulk_generate':
        data = request.get_json()
        character_ids = data.get('characterIds', [])
        count = data.get('count', 1)

        if not character_ids:
            return jsonify({"error": "Character IDs are required"}), 400

        results = []
        for char_id in character_ids:
            for _ in range(count):
                # This assumes a template is chosen randomly or passed in data
                # For simplicity, we'll require a templateId for now.
                template_id = data.get('templateId') # Or logic to pick one
                if not template_id:
                    results.append({"characterId": char_id, "success": False, "error": "Template ID is required"})
                    continue

                payload = {
                    "characterId": char_id,
                    "templateId": template_id,
                    "customVariables": data.get('customVariables', {})
                }
                new_prompt, error = _generate_single_prompt(payload)
                if error:
                    results.append({"characterId": char_id, "success": False, "error": error})
                else:
                    results.append({"characterId": char_id, "success": True, "prompt": new_prompt})

        return jsonify({"success": True, "results": results})

    else:
        return jsonify({"error": f"Action '{action}' is not yet implemented"}), 400

def _generate_single_prompt(data):
    character_id = data.get('characterId')
    template_id = data.get('templateId')

    if not character_id:
        return None, "Character ID is required"

    characters = load_characters()
    character = next((c for c in characters if c['id'] == character_id), None)
    if not character:
        return None, "Character not found"

    prompt_text = ""
    caption_text = ""

    if template_id:
        templates = load_templates()
        template = next((t for t in templates if t['id'] == template_id), None)
        if not template:
            return None, "Template not found"
        prompt_text = generate_from_template(template, character, data.get('customVariables', {}))
        # Caption would be generated separately
    else:
        # Fallback to placeholder AI generation if no template is provided
        prompt_text, caption_text = _generate_prompt_with_ai(character)

    new_prompt = {
        "id": f"prompt_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}",
        "characterId": character_id,
        "characterName": character.get('name', 'Unknown'),
        "prompt": prompt_text,
        "caption": caption_text,
        "templateId": template_id,
        "createdAt": datetime.now().isoformat(),
        "used": False,
        "imageGenerated": False,
        "posted": False,
    }

    prompts = load_prompts()
    prompts.append(new_prompt)
    save_prompts(prompts)

    return new_prompt, None

def _generate_prompt_with_ai(character):
    """Placeholder for generating a prompt and caption with an AI service."""
    print(f"--- Simulating AI prompt generation for character: {character['name']} ---")
    prompt = f"A dramatic, cinematic portrait of {character['name']}, who is known for being {character['personality']}."
    caption = f"This is a simulated AI-generated caption for {character['name']}. #ai #placeholder"
    return prompt, caption

def extract_variables(template_string):
    import re
    return re.findall(r'\{([^}]+)\}', template_string)

def generate_from_template(template, character, custom_variables={}):
    import random
    prompt = template['template']

    default_values = {
        "character": [character.get('name', '')],
        "personality": [character.get('personality', '')],
        "style": ["cinematic", "artistic", "professional", "dramatic", "ethereal"],
        "lighting": ["golden hour", "soft natural light", "dramatic shadows", "warm ambient light"],
        "activity": ["reading", "walking", "thinking", "exploring", "creating"],
        "setting": ["urban landscape", "natural environment", "cozy interior", "modern studio"],
        "artistic_style": ["impressionist", "surreal", "minimalist", "abstract", "contemporary"],
        "composition": ["close-up", "medium shot", "wide angle", "dynamic angle"],
        "medium": ["oil painting", "watercolor", "digital art", "photography"],
        "magical_element": ["glowing aura", "floating objects", "mystical energy", "enchanted atmosphere"],
        "fantasy_setting": ["enchanted forest", "crystal cave", "floating island", "magical library"],
        "photo_style": ["portrait", "environmental", "fashion", "documentary"],
        "camera_angle": ["eye level", "low angle", "high angle", "dutch angle"],
        "lighting_type": ["natural light", "studio lighting", "golden hour", "blue hour"],
    }

    variables = extract_variables(prompt)
    for var in variables:
        placeholder = f"{{{var}}}"
        if var in custom_variables:
            prompt = prompt.replace(placeholder, custom_variables[var])
        elif var in default_values:
            prompt = prompt.replace(placeholder, random.choice(default_values[var]))
        else:
            prompt = prompt.replace(placeholder, "") # Remove placeholder if no value

    return prompt.replace("  ", " ").strip()

# API endpoints for characters
@app.route('/api/characters', methods=['GET'])
def get_characters():
    characters = load_characters()
    return jsonify({"characters": characters})

@app.route('/api/characters', methods=['POST'])
def create_character():
    data = request.get_json()
    if not data or 'name' not in data or 'personality' not in data:
        return jsonify({"error": "Name and personality are required"}), 400

    characters = load_characters()

    new_character = {
        "id": f"char_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}",
        "name": data['name'],
        "personality": data['personality'],
        "backstory": data.get('backstory', ''),
        "instagramHandle": data.get('instagramHandle', ''),
        "isActive": True,
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat(),
        "preferredModel": data.get('preferredModel', ''),
        "triggerWord": data.get('triggerWord', ''),
        "promptSettings": data.get('promptSettings', {}),
        "narratives": data.get('narratives', []),
    }

    characters.append(new_character)
    save_characters(characters)

    return jsonify({"character": new_character}), 201

@app.route('/api/characters/<string:char_id>', methods=['PUT'])
def update_character(char_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid data"}), 400

    characters = load_characters()
    character_index = -1
    for i, char in enumerate(characters):
        if char['id'] == char_id:
            character_index = i
            break

    if character_index == -1:
        return jsonify({"error": "Character not found"}), 404

    # Update character fields
    characters[character_index].update(data)
    characters[character_index]['updatedAt'] = datetime.now().isoformat()

    save_characters(characters)

    return jsonify({"character": characters[character_index]})

@app.route('/api/characters/<string:char_id>', methods=['DELETE'])
def delete_character(char_id):
    characters = load_characters()
    original_length = len(characters)

    characters = [char for char in characters if char['id'] != char_id]

    if len(characters) == original_length:
        return jsonify({"error": "Character not found"}), 404

    save_characters(characters)

    return jsonify({"success": True})

@app.route('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    # Ensure data directory exists
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    initialize_scheduler()
    app.run(debug=True, port=5000, use_reloader=False)
