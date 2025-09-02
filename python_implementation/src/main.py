from fastapi import FastAPI, HTTPException, status
from typing import List
from datetime import datetime

from . import database
import os
import requests
import subprocess
import sys
import uuid
from dotenv import load_dotenv
import google.generativeai as genai
from fastapi.responses import PlainTextResponse
from .models import (
    Character,
    CharacterCreate,
    CharacterUpdate,
    SystemStatus,
    Prompt,
    PromptCreate,
    CaptionRequest,
    CaptionResponse,
    ImageGenerationRequest,
    ImageGenerationResponse,
    SocialMediaPostRequest,
    SocialMediaPostResponse,
    ScheduledTask,
    ScheduledTaskCreate,
    LoraTrainingRequest,
    LoraTrainingResponse,
)
from contextlib import asynccontextmanager
from . import comfyui_utils
from . import social_media_utils
from . import scheduler_service

# Load environment variables from .env file
load_dotenv()

# Configure the Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Configure ComfyUI
COMFYUI_URL = os.getenv("COMFYUI_URL")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Application startup...")
    scheduler_service.start()
    yield
    # Shutdown
    print("Application shutdown...")
    scheduler_service.shutdown()

app = FastAPI(
    title="Digital Dalla API",
    description="API for managing AI-powered social media characters.",
    version="1.0.0",
    lifespan=lifespan
)

@app.post("/api/characters", response_model=Character, status_code=status.HTTP_201_CREATED, tags=["Characters"])
def create_character(character_data: CharacterCreate):
    """
    Create a new character.
    """
    characters = database.load_characters()

    # Create a full Character object from the CharacterCreate object
    new_character = Character(**character_data.model_dump())

    characters.append(new_character)
    database.save_characters(characters)
    return new_character

@app.get("/api/characters", response_model=List[Character], tags=["Characters"])
def get_all_characters():
    """
    Retrieve all characters.
    """
    return database.load_characters()

@app.get("/api/characters/{character_id}", response_model=Character, tags=["Characters"])
def get_character(character_id: str):
    """
    Retrieve a single character by their ID.
    """
    characters = database.load_characters()
    for char in characters:
        if char.id == character_id:
            return char
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

@app.put("/api/characters/{character_id}", response_model=Character, tags=["Characters"])
def update_character(character_id: str, character_update: CharacterUpdate):
    """
    Update an existing character's information.
    """
    characters = database.load_characters()
    character_to_update = None
    char_index = -1
    for i, char in enumerate(characters):
        if char.id == character_id:
            character_to_update = char
            char_index = i
            break

    if not character_to_update:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

    # Create a dictionary with only the fields that were actually provided in the request
    update_data = character_update.model_dump(exclude_unset=True)

    # Update the character object by creating a new model with the updated data
    updated_character = character_to_update.model_copy(update=update_data)

    # Manually update the 'updatedAt' timestamp
    updated_character.updatedAt = datetime.utcnow()

    characters[char_index] = updated_character
    database.save_characters(characters)
    return updated_character

@app.delete("/api/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Characters"])
def delete_character(character_id: str):
    """
    Delete a character by their ID.
    """
    characters = database.load_characters()
    original_length = len(characters)

    characters_to_keep = [char for char in characters if char.id != character_id]

    if len(characters_to_keep) == original_length:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

    database.save_characters(characters_to_keep)
    return

@app.get("/api/system/status", response_model=SystemStatus, tags=["System"])
def get_system_status():
    """
    Check the status of the system and its dependencies.
    """
    # Database check
    db_status = "OK"
    try:
        database.load_characters()
    except Exception:
        db_status = "Error"

    # ComfyUI check
    comfyui_status = "Not Configured"
    if COMFYUI_URL:
        try:
            response = requests.get(COMFYUI_URL, timeout=5)
            if response.status_code == 200:
                comfyui_status = "Connected"
            else:
                comfyui_status = f"Error (Status: {response.status_code})"
        except requests.exceptions.RequestException:
            comfyui_status = "Connection Failed"

    # Scheduler check
    scheduler_status = "Running" if scheduler_service.scheduler.running else "Stopped"

    # Gemini API check
    gemini_status = "Configured" if GEMINI_API_KEY and GEMINI_API_KEY != "YOUR_API_KEY_HERE" else "Not Configured"

    return SystemStatus(
        database=db_status,
        comfyui=comfyui_status,
        scheduler=scheduler_status,
        gemini_api=gemini_status
    )


# --- Prompt Endpoints ---

@app.get("/api/prompts", response_model=List[Prompt], tags=["Prompts"])
def get_all_prompts():
    """
    Retrieve all prompts.
    """
    return database.load_prompts()

@app.post("/api/prompts", response_model=Prompt, status_code=status.HTTP_201_CREATED, tags=["Prompts"])
def create_prompt(prompt_data: PromptCreate):
    """
    Create a new prompt.
    The characterName is retrieved from the characters database.
    """
    prompts = database.load_prompts()

    # Find the character name from the characterId
    characters = database.load_characters()
    character_name = None
    for char in characters:
        if char.id == prompt_data.characterId:
            character_name = char.name
            break

    if not character_name:
        raise HTTPException(status_code=404, detail=f"Character with id {prompt_data.characterId} not found")

    new_prompt = Prompt(
        characterId=prompt_data.characterId,
        characterName=character_name,
        prompt=prompt_data.prompt
    )

    prompts.append(new_prompt)
    database.save_prompts(prompts)
    return new_prompt

@app.delete("/api/prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Prompts"])
def delete_prompt(prompt_id: str):
    """
    Delete a prompt by its ID.
    """
    prompts = database.load_prompts()
    original_length = len(prompts)

    prompts_to_keep = [p for p in prompts if p.id != prompt_id]

    if len(prompts_to_keep) == original_length:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    database.save_prompts(prompts_to_keep)
    return

@app.post("/api/generate-caption", response_model=CaptionResponse, tags=["AI"])
def generate_caption(request: CaptionRequest):
    """
    Generates a social media caption using the Google Gemini API.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_API_KEY_HERE":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API key is not configured. Please set it in the .env file.",
        )

    try:
        model = genai.GenerativeModel('gemini-pro')

        system_prompt = f"""
        You are an AI assistant for a social media character named {request.characterName}.
        Your task is to generate a short, engaging social media caption.

        Character Details:
        - Personality: {request.personality}
        - Backstory: {request.backstory}

        The caption should be inspired by the following prompt, reflecting the character's persona.
        It should be concise and include relevant hashtags.
        """

        user_prompt = f"Generate a caption for this prompt: '{request.prompt}'"

        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        response = model.generate_content(full_prompt)

        return CaptionResponse(caption=response.text)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate caption with Gemini API: {str(e)}"
        )


# --- ComfyUI Endpoints ---

@app.get("/api/models", response_model=List[str], tags=["ComfyUI"])
def get_comfyui_models():
    """
    Fetches a list of available checkpoint models from the ComfyUI server.
    """
    if not COMFYUI_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ComfyUI URL is not configured.",
        )
    try:
        response = requests.get(f"{COMFYUI_URL}/checkpoints")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to ComfyUI server: {e}",
        )

@app.post("/api/generate-image", response_model=ImageGenerationResponse, tags=["ComfyUI"])
def generate_image(request: ImageGenerationRequest):
    """
    Generates an image using ComfyUI.
    """
    if not COMFYUI_URL:
        raise HTTPException(status_code=503, detail="ComfyUI URL not configured")

    # 1. Get character details
    character = next((c for c in database.load_characters() if c.id == request.characterId), None)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # 2. Determine model and construct full prompt
    model_to_use = request.model or character.preferredModel
    if not model_to_use:
        raise HTTPException(status_code=400, detail="No model specified and character has no preferred model")

    # Construct a detailed prompt from character settings
    base_prompt = character.promptSettings.basePrompt
    trigger_word = character.triggerWord or ""
    style = character.promptSettings.style
    mood = character.promptSettings.mood

    positive_prompt = f"{base_prompt}, {trigger_word}, {request.prompt}, style of {style}, {mood}"
    negative_prompt = request.negative_prompt or character.promptSettings.negativePrompt

    # 3. Build and queue the workflow
    try:
        workflow = comfyui_utils.build_basic_workflow(model_to_use, positive_prompt, negative_prompt)
        prompt_id = comfyui_utils.queue_prompt(workflow, COMFYUI_URL)
        image_data = comfyui_utils.get_image_data(prompt_id, COMFYUI_URL)

        if not image_data:
            raise HTTPException(status_code=500, detail="Failed to retrieve image from ComfyUI")

        # 4. Save the image locally
        output_dir = "output/images"
        os.makedirs(output_dir, exist_ok=True)
        image_filename = f"{character.name.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.png"
        image_path = os.path.join(output_dir, image_filename)

        with open(image_path, "wb") as f:
            f.write(image_data)

        # 5. Return the path
        return ImageGenerationResponse(
            image_path=image_path,
            metadata={"prompt_id": prompt_id, "model": model_to_use}
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"ComfyUI API error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


# --- Social Media Endpoints ---

@app.post("/api/post-to-twitter", response_model=SocialMediaPostResponse, tags=["Social Media"])
def post_to_twitter(request: SocialMediaPostRequest):
    """
    Posts an image and caption to Twitter for a specific character.
    """
    # 1. Get character details
    character = next((c for c in database.load_characters() if c.id == request.characterId), None)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # 2. Check if image exists
    if not os.path.exists(request.image_path):
        raise HTTPException(status_code=404, detail=f"Image not found at path: {request.image_path}")

    # 3. Call the utility function to post
    try:
        result = social_media_utils.post_to_twitter(character, request.image_path, request.caption)
        return SocialMediaPostResponse(
            platform="twitter",
            post_id=result["post_id"],
            post_url=result["post_url"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to post to Twitter: {e}")


@app.post("/api/post-to-instagram", response_model=SocialMediaPostResponse, tags=["Social Media"])
def post_to_instagram(request: SocialMediaPostRequest):
    """
    Posts an image and caption to Instagram for a specific character.
    """
    # 1. Get character details
    character = next((c for c in database.load_characters() if c.id == request.characterId), None)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # 2. Check if image exists
    if not os.path.exists(request.image_path):
        raise HTTPException(status_code=404, detail=f"Image not found at path: {request.image_path}")

    # 3. Call the utility function to post
    try:
        result = social_media_utils.post_to_instagram(character, request.image_path, request.caption)
        return SocialMediaPostResponse(
            platform="instagram",
            post_id=result["post_id"],
            post_url=result["post_url"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to post to Instagram: {e}")


# --- Scheduler Endpoints ---

@app.get("/api/scheduler/tasks", response_model=List[ScheduledTask], tags=["Scheduler"])
def get_all_tasks():
    """
    Retrieve all scheduled tasks.
    """
    return database.load_tasks()

@app.post("/api/scheduler/tasks", response_model=ScheduledTask, status_code=status.HTTP_201_CREATED, tags=["Scheduler"])
def create_scheduled_task(task_data: ScheduledTaskCreate):
    """
    Create and schedule a new task.
    """
    tasks = database.load_tasks()
    new_task = ScheduledTask(**task_data.model_dump())

    tasks.append(new_task)
    database.save_tasks(tasks)

    scheduler_service.add_task_to_scheduler(new_task)

    return new_task

@app.delete("/api/scheduler/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Scheduler"])
def delete_scheduled_task(task_id: str):
    """
    Delete a scheduled task.
    """
    tasks = database.load_tasks()
    original_length = len(tasks)

    tasks_to_keep = [t for t in tasks if t.id != task_id]

    if len(tasks_to_keep) == original_length:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    database.save_tasks(tasks_to_keep)
    scheduler_service.remove_task_from_scheduler(task_id)

    return


# --- LoRA Training Endpoints ---

LOGS_DIR = "logs/lora_training"
SCRIPTS_DIR = "scripts"

@app.post("/api/lora/train", response_model=LoraTrainingResponse, tags=["LoRA Training"])
def train_lora_model(request: LoraTrainingRequest):
    """
    Starts a LoRA training process in the background.
    """
    character = next((c for c in database.load_characters() if c.id == request.characterId), None)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Note: In a real app, you'd validate image_paths exist.

    # Ensure the script path is correct relative to the execution directory
    # Assuming the app is run from the `python_implementation` directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script_path = os.path.join(base_dir, SCRIPTS_DIR, "train_lora.py")
    logs_dir_path = os.path.join(base_dir, LOGS_DIR)
    os.makedirs(logs_dir_path, exist_ok=True)

    job_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    log_filename = f"{character.name.replace(' ', '_')}_{timestamp}.log"
    log_filepath = os.path.join(logs_dir_path, log_filename)

    command = [
        sys.executable,
        script_path,
        "--character_name", character.name,
        "--base_model", request.baseModel
    ]

    try:
        with open(log_filepath, "w") as log_file:
            subprocess.Popen(command, stdout=log_file, stderr=subprocess.STDOUT, cwd=base_dir)

        return LoraTrainingResponse(
            message="LoRA training process started successfully.",
            job_id=job_id,
            log_file=log_filename
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start training process: {e}")

@app.get("/api/lora/logs/{log_filename}", response_class=PlainTextResponse, tags=["LoRA Training"])
def get_lora_log(log_filename: str):
    """
    Retrieves the content of a LoRA training log file.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    log_filepath = os.path.join(base_dir, LOGS_DIR, log_filename)

    if not os.path.exists(log_filepath):
        raise HTTPException(status_code=404, detail="Log file not found.")

    with open(log_filepath, "r") as f:
        return PlainTextResponse(content=f.read())


@app.get("/")
def read_root():
    return {"message": "Welcome to the Digital Dalla API"}
