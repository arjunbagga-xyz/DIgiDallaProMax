import requests
from flask import Flask, render_template, request, redirect, url_for, send_from_directory
import json
import os
import uuid
from datetime import datetime
import comfyui_client
import config
import gemini_client
import instagram_client
from flask import flash

app = Flask(__name__)
app.secret_key = os.urandom(24) # Needed for flash messages

# Get the directory of the current script
APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(APP_DIR, 'data', 'characters.json')
SCHEDULER_FILE = os.path.join(APP_DIR, 'data', 'scheduler.json')

# --- Helper Functions ---
def load_characters():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_characters(characters):
    with open(DATA_FILE, 'w') as f:
        json.dump(characters, f, indent=2)

def load_scheduler_jobs():
    if not os.path.exists(SCHEDULER_FILE):
        return []
    with open(SCHEDULER_FILE, 'r') as f:
        return json.load(f)

def save_scheduler_jobs(jobs):
    with open(SCHEDULER_FILE, 'w') as f:
        json.dump(jobs, f, indent=2)

def get_character(character_id):
    characters = load_characters()
    for character in characters:
        if character['id'] == character_id:
            return character
    return None

# --- Routes ---
@app.route('/')
def index():
    # System Status Checks
    status = {
        'comfyui': False,
        'gemini': False,
        'comfyui_path': False,
        'public_url': False
    }
    try:
        # Check ComfyUI connection
        response = requests.get(f"{config.COMFYUI_URL}/object_info", timeout=2)
        if response.status_code == 200:
            status['comfyui'] = True
    except requests.exceptions.RequestException:
        pass # comfyui is down

    # Check Gemini API Key
    if config.GEMINI_API_KEY:
        status['gemini'] = True

    # Check ComfyUI Path
    if config.COMFYUI_PATH and os.path.isdir(config.COMFYUI_PATH):
        status['comfyui_path'] = True

    # Check Public URL
    if config.PUBLIC_URL:
        status['public_url'] = True

    # Quick Stats
    stats = {
        'characters': len(load_characters()),
        'scheduled_jobs': len([j for j in load_scheduler_jobs() if j['status'] == 'scheduled']),
        'completed_jobs': len([j for j in load_scheduler_jobs() if j['status'] == 'completed']),
        'failed_jobs': len([j for j in load_scheduler_jobs() if j['status'] == 'failed']),
    }

    return render_template('dashboard.html', status=status, stats=stats)

@app.route('/characters')
def list_characters():
    characters = load_characters()
    return render_template('characters.html', characters=characters)

@app.route('/characters/add', methods=['GET', 'POST'])
def add_character():
    if request.method == 'POST':
        characters = load_characters()
        new_character = {
            "id": f"char_{int(datetime.timestamp(datetime.now()))}_{uuid.uuid4().hex[:8]}",
            "name": request.form['name'],
            "personality": request.form['personality'],
            "backstory": request.form['backstory'],
            "instagramHandle": request.form['instagramHandle'],
            "isActive": 'isActive' in request.form,
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat(),
            "preferredModel": request.form['preferredModel'],
            "instagram_account_id": request.form.get('instagram_account_id', ''),
            "instagram_access_token": request.form.get('instagram_access_token', '')
        }
        characters.append(new_character)
        save_characters(characters)
        return redirect(url_for('list_characters'))
    return render_template('character_form.html', character=None, title="Add Character", action=url_for('add_character'))

@app.route('/characters/edit/<character_id>', methods=['GET', 'POST'])
def edit_character(character_id):
    character = get_character(character_id)
    if character is None:
        return "Character not found", 404

    if request.method == 'POST':
        characters = load_characters()
        for i, char in enumerate(characters):
            if char['id'] == character_id:
                characters[i]['name'] = request.form['name']
                characters[i]['personality'] = request.form['personality']
                characters[i]['backstory'] = request.form['backstory']
                characters[i]['instagramHandle'] = request.form['instagramHandle']
                characters[i]['isActive'] = 'isActive' in request.form
                characters[i]['updatedAt'] = datetime.now().isoformat()
                characters[i]['preferredModel'] = request.form['preferredModel']
                characters[i]['instagram_account_id'] = request.form.get('instagram_account_id', '')
                # Only update token if a new one is provided
                if request.form.get('instagram_access_token'):
                    characters[i]['instagram_access_token'] = request.form.get('instagram_access_token')
                break
        save_characters(characters)
        return redirect(url_for('list_characters'))

    action_url = url_for('edit_character', character_id=character_id)
    return render_template('character_form.html', character=character, title="Edit Character", action=action_url)

@app.route('/characters/delete/<character_id>', methods=['POST'])
def delete_character(character_id):
    characters = load_characters()
    characters = [char for char in characters if char['id'] != character_id]
    save_characters(characters)
    return redirect(url_for('list_characters'))

from flask import send_from_directory
import config

@app.route('/generate', methods=['GET', 'POST'])
def generate():
    image_filename = request.args.get('filename')

    if request.method == 'POST':
        character_id = request.form.get('character')
        prompt = request.form.get('prompt')
        model = request.form.get('model')
        lora = request.form.get('lora')

        filename = comfyui_client.generate_image(model, prompt, lora)

        if filename:
            return redirect(url_for('generate', filename=filename))
        else:
            # Handle error case
            return "Error generating image", 500

    characters = load_characters()
    models = comfyui_client.get_models()
    loras = comfyui_client.get_loras()
    return render_template('generate.html', characters=characters, models=models, loras=loras, image_filename=image_filename)

@app.route('/outputs/<path:filename>')
def get_output_image(filename):
    if not config.COMFYUI_PATH or not os.path.isdir(config.COMFYUI_PATH):
        return "COMFYUI_PATH is not configured correctly.", 500

    output_dir = os.path.join(config.COMFYUI_PATH, 'output')
    return send_from_directory(output_dir, filename)

@app.route('/generate-prompt', methods=['POST'])
def generate_prompt_route():
    character_id = request.json.get('character_id')
    if not character_id:
        return jsonify({'error': 'Character ID is required.'}), 400

    character = get_character(character_id)
    if not character:
        return jsonify({'error': 'Character not found.'}), 404

    prompt = gemini_client.generate_prompt(character)

    if "Error:" in prompt:
        return jsonify({'error': prompt}), 500

    return jsonify({'prompt': prompt})

@app.route('/post-to-instagram', methods=['POST'])
def post_to_instagram_route():
    image_filename = request.form.get('image_filename')
    caption = request.form.get('caption')
    character_id = request.form.get('character_id')

    if not all([image_filename, caption, character_id]):
        flash("Missing data for Instagram post.", "danger")
        return redirect(url_for('generate', filename=image_filename))

    character = get_character(character_id)
    if not character:
        flash("Character not found.", "danger")
        return redirect(url_for('generate', filename=image_filename))

    result = instagram_client.post_to_instagram(character, image_filename, caption)

    if result.get("success"):
        flash(f"Successfully posted to Instagram! Post ID: {result.get('post_id')}", "success")
    else:
        flash(f"Error posting to Instagram: {result.get('error')}", "danger")

    return redirect(url_for('generate', filename=image_filename))

@app.route('/schedule-post', methods=['POST'])
def schedule_post_route():
    image_filename = request.form.get('image_filename')
    caption = request.form.get('caption')
    character_id = request.form.get('character_id')
    post_at = request.form.get('post_at')

    if not all([image_filename, caption, character_id, post_at]):
        flash("Missing data for scheduled post.", "danger")
        return redirect(url_for('generate', filename=image_filename))

    jobs = load_scheduler_jobs()
    new_job = {
        "id": f"job_{int(datetime.timestamp(datetime.now()))}_{uuid.uuid4().hex[:8]}",
        "character_id": character_id,
        "image_filename": image_filename,
        "caption": caption,
        "post_at": post_at,
        "status": "scheduled",
        "createdAt": datetime.now().isoformat()
    }
    jobs.append(new_job)
    save_scheduler_jobs(jobs)

    flash("Post scheduled successfully!", "success")
    return redirect(url_for('generate', filename=image_filename))

@app.route('/scheduler')
def scheduler_page():
    jobs = load_scheduler_jobs()
    characters = load_characters()
    character_map = {char['id']: char['name'] for char in characters}

    # Sort jobs by post_at date, most recent first
    jobs.sort(key=lambda x: x.get('post_at', ''), reverse=True)
    return render_template('scheduler.html', jobs=jobs, character_map=character_map)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
