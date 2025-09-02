import json
from typing import List
from .models import Character, Prompt, ScheduledTask
import os

# Build the absolute path to the data file
# The script is in src/, data/ is a sibling directory
# So we go up one level from the current file's directory (__file__) and then into data/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "characters.json")

def load_characters() -> List[Character]:
    """Loads characters from the JSON file."""
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, "r") as f:
            data = json.load(f)
        return [Character(**char) for char in data]
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_characters(characters: List[Character]):
    """Saves a list of characters to the JSON file."""
    with open(DATA_FILE, "w") as f:
        # Convert Pydantic models to dictionaries for JSON serialization
        json.dump([char.model_dump(mode='json') for char in characters], f, indent=4)


# --- Prompt Database Functions ---

PROMPTS_DATA_FILE = os.path.join(BASE_DIR, "data", "prompts.json")

def load_prompts() -> List[Prompt]:
    """Loads prompts from the JSON file."""
    if not os.path.exists(PROMPTS_DATA_FILE):
        return []
    try:
        with open(PROMPTS_DATA_FILE, "r") as f:
            data = json.load(f)
        return [Prompt(**p) for p in data]
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_prompts(prompts: List[Prompt]):
    """Saves a list of prompts to the JSON file."""
    with open(PROMPTS_DATA_FILE, "w") as f:
        json.dump([p.model_dump(mode='json') for p in prompts], f, indent=4)


# --- Scheduler Database Functions ---

SCHEDULER_DATA_FILE = os.path.join(BASE_DIR, "data", "scheduler.json")

def load_tasks() -> List[ScheduledTask]:
    """Loads scheduled tasks from the JSON file."""
    if not os.path.exists(SCHEDULER_DATA_FILE):
        return []
    try:
        with open(SCHEDULER_DATA_FILE, "r") as f:
            data = json.load(f)
        return [ScheduledTask(**task) for task in data]
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_tasks(tasks: List[ScheduledTask]):
    """Saves a list of scheduled tasks to the JSON file."""
    with open(SCHEDULER_DATA_FILE, "w") as f:
        json.dump([task.model_dump(mode='json') for task in tasks], f, indent=4)
