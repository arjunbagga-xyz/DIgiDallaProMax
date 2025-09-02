import requests
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from . import database

# Configure logging
logging.basicConfig()
logging.getLogger('apscheduler').setLevel(logging.INFO)

scheduler = AsyncIOScheduler()

BASE_URL = "http://127.0.0.1:8000" # Assuming the app runs here

def run_generate_and_post_task(character_id: str, task_config: dict):
    """
    The actual job that the scheduler runs.
    It simulates the user flow: generate content and post it.
    """
    print(f"Running scheduled task for character {character_id}")

    try:
        # 1. Get character details to generate a prompt
        character_response = requests.get(f"{BASE_URL}/api/characters/{character_id}")
        character_response.raise_for_status()
        character = character_response.json()

        # For simplicity, we'll use a generic prompt or one from config
        prompt_text = task_config.get("prompt", f"A day in the life of {character['name']}")

        # 2. Generate a caption
        caption_payload = {
            "prompt": prompt_text,
            "characterName": character['name'],
            "personality": character['personality'],
            "backstory": character['backstory']
        }
        caption_response = requests.post(f"{BASE_URL}/api/generate-caption", json=caption_payload)
        caption_response.raise_for_status()
        caption = caption_response.json()['caption']

        # 3. Generate an image
        image_payload = {
            "characterId": character_id,
            "prompt": prompt_text
        }
        image_response = requests.post(f"{BASE_URL}/api/generate-image", json=image_payload)
        image_response.raise_for_status()
        image_path = image_response.json()['image_path']

        # 4. Post to Twitter (if configured)
        if task_config.get("postToTwitter", True): # Default to posting
            twitter_payload = {
                "characterId": character_id,
                "image_path": image_path,
                "caption": caption
            }
            requests.post(f"{BASE_URL}/api/post-to-twitter", json=twitter_payload)
            print(f"Successfully posted to Twitter for character {character_id}")

    except Exception as e:
        print(f"Error running scheduled task for character {character_id}: {e}")


def add_task_to_scheduler(task):
    """Adds a task to the APScheduler."""
    if task.active:
        trigger = CronTrigger.from_crontab(task.schedule)
        scheduler.add_job(
            run_generate_and_post_task,
            trigger=trigger,
            id=task.id,
            name=f"Task for {task.characterId}",
            replace_existing=True,
            args=[task.characterId, task.config]
        )
        print(f"Scheduled task {task.id} for character {task.characterId} with schedule: {task.schedule}")

def remove_task_from_scheduler(task_id: str):
    """Removes a task from the APScheduler."""
    try:
        scheduler.remove_job(task_id)
        print(f"Removed task {task_id} from scheduler.")
    except Exception:
        # Job might not exist, which is fine
        pass

def start():
    """Starts the scheduler and loads all tasks from the database."""
    print("Starting scheduler...")
    scheduler.start()
    tasks = database.load_tasks()
    for task in tasks:
        add_task_to_scheduler(task)
    print("Scheduler started and tasks loaded.")

def shutdown():
    """Shuts down the scheduler."""
    print("Shutting down scheduler...")
    scheduler.shutdown()
    print("Scheduler shut down.")
