import time
import json
import os
from datetime import datetime
import instagram_client

# --- Configuration ---
APP_DIR = os.path.dirname(os.path.abspath(__file__))
SCHEDULER_FILE = os.path.join(APP_DIR, 'data', 'scheduler.json')
CHARACTERS_FILE = os.path.join(APP_DIR, 'data', 'characters.json')
CHECK_INTERVAL_SECONDS = 60

# --- Helper Functions ---
def load_json_file(filepath):
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except (IOError, json.JSONDecodeError) as e:
        print(f"Error loading file {filepath}: {e}")
        return []

def save_json_file(filepath, data):
    try:
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    except IOError as e:
        print(f"Error saving file {filepath}: {e}")

def get_character(character_id, characters):
    for character in characters:
        if character['id'] == character_id:
            return character
    return None

# --- Main Worker Logic ---
def run_scheduler():
    print("Scheduler worker started. Press Ctrl+C to exit.")
    while True:
        print(f"[{datetime.now()}] Checking for scheduled posts...")

        jobs = load_json_file(SCHEDULER_FILE)
        characters = load_json_file(CHARACTERS_FILE)

        now = datetime.now()
        updated = False

        for job in jobs:
            if job.get('status') == 'scheduled':
                try:
                    post_at = datetime.fromisoformat(job.get('post_at'))
                    if post_at <= now:
                        print(f"Found due post: {job['id']}")
                        character = get_character(job['character_id'], characters)

                        if not character:
                            print(f"Error: Character {job['character_id']} not found for job {job['id']}.")
                            job['status'] = 'failed'
                            job['error_message'] = 'Character not found.'
                            updated = True
                            continue

                        result = instagram_client.post_to_instagram(
                            character,
                            job['image_filename'],
                            job['caption']
                        )

                        if result.get("success"):
                            job['status'] = 'completed'
                            job['post_id'] = result.get('post_id')
                            print(f"Successfully posted job {job['id']}.")
                        else:
                            job['status'] = 'failed'
                            job['error_message'] = result.get('error')
                            print(f"Failed to post job {job['id']}: {result.get('error')}")

                        updated = True
                except (ValueError, TypeError) as e:
                    print(f"Error processing job {job.get('id')}: Invalid date format or data. Error: {e}")
                    job['status'] = 'failed'
                    job['error_message'] = f"Invalid job data: {e}"
                    updated = True

        if updated:
            save_json_file(SCHEDULER_FILE, jobs)
            print("Updated scheduler file.")

        time.sleep(CHECK_INTERVAL_SECONDS)

if __name__ == '__main__':
    run_scheduler()
