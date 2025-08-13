# Backend Workflows

This document outlines the backend workflows for every button present in the UI, grouped by the page they are on. It also includes details about the database interactions, data structures, and examples.

The application uses a file-based database system. All data is stored in JSON files in the `data/` directory.

## Database Structures

### `data/characters.json`

This file stores an array of character objects.

**Example `character` object:**

```json
{
  "id": "char_1754528276811_4suaz8mqv",
  "name": "Luna the Mystic",
  "personality": "Dreamy and mystical",
  "backstory": "Luna is a mysterious character who lives in a hidden forest.",
  "instagramHandle": "@luna_mystic",
  "isActive": true,
  "createdAt": "2025-08-07T00:57:56.811Z",
  "updatedAt": "2025-08-08T10:30:00.000Z",
  "preferredModel": "sdxl_dreamshaper.safetensors",
  "triggerWord": "luna_character",
  "promptSettings": {
    "basePrompt": "a beautiful portrait of luna_character",
    "negativePrompt": "ugly, disfigured",
    "style": "artistic",
    "mood": "serene"
  },
  "narratives": [
    {
      "id": "narr_1",
      "title": "The Crystal Quest",
      "description": "Luna is searching for a legendary crystal.",
      "startDate": "2025-08-01",
      "endDate": "2025-08-31"
    }
  ],
  "instagramAccountId": "1234567890",
  "instagramApiKey": "INSTAGRAM_API_KEY",
  "twitterAccountId": "0987654321",
  "twitterAppKey": "TWITTER_APP_KEY",
  "twitterAppSecret": "TWITTER_APP_SECRET",
  "twitterAccessToken": "TWITTER_ACCESS_TOKEN",
  "twitterAccessSecret": "TWITTER_ACCESS_SECRET"
}
```

### `data/scheduler.json`

This file stores an array of scheduled task objects.

**Example `task` object:**

```json
{
  "id": "task_1",
  "characterId": "char_1754528276811_4suaz8mqv",
  "type": "generate_and_post",
  "schedule": "0 18 * * *",
  "active": true,
  "config": {
    "prompt": "luna_character in a magical forest",
    "postToInstagram": true
  }
}
```

### `data/prompts.json`

This file stores an array of generated prompt objects.

**Example `prompt` object:**

```json
{
  "id": "prompt_1",
  "characterId": "char_1754528276811_4suaz8mqv",
  "characterName": "Luna the Mystic",
  "prompt": "a beautiful portrait of luna_character in a magical forest",
  "caption": "Exploring the enchanted woods today! #magic #forest #luna",
  "createdAt": "2025-08-08T11:00:00.000Z",
  "used": false
}
```

## Main Page (`app/page.tsx`)

### Character Management Tab

*   **Add Character Button**:
    *   **UI Action**: Opens a dialog to create a new character.
    *   **Backend API Call**: `POST /api/characters`
    *   **Workflow**:
        1.  The frontend sends a POST request to `/api/characters` with the new character's data.
        2.  The API route handler in `app/api/characters/route.ts` receives the request.
        3.  It reads the existing characters from `data/characters.json`.
        4.  A new character object is created with a unique ID and timestamps.
        5.  The new character is added to the list of characters.
        6.  The updated list of characters is written back to `data/characters.json`.
        7.  A success response is returned to the frontend.
    *   **Database Interaction**:
        *   Reads from `data/characters.json`.
        *   Writes to `data/characters.json`.

*   **Refresh Models Button**:
    *   **UI Action**: Refreshes the list of available models.
    *   **Backend API Call**: `GET /api/models?show=all`
    *   **Workflow**:
        1.  The frontend sends a GET request to `/api/models?show=all`.
        2.  The API route handler in `app/api/models/route.ts` receives the request.
        3.  It fetches the list of available models from the ComfyUI server.
        4.  The list of models is returned to the frontend.
    *   **Database Interaction**: None.

*   **Edit Character Button**:
    *   **UI Action**: Opens a dialog to edit an existing character.
    *   **Backend API Call**: `PUT /api/characters`
    *   **Workflow**:
        1.  The frontend sends a PUT request to `/api/characters` with the updated character data.
        2.  The API route handler in `app/api/characters/route.ts` receives the request.
        3.  It reads the existing characters from `data/characters.json`.
        4.  It finds the character with the matching ID and updates its data.
        5.  The updated list of characters is written back to `data/characters.json`.
        6.  A success response is returned to the frontend.
    *   **Database Interaction**:
        *   Reads from `data/characters.json`.
        *   Writes to `data/characters.json`.

*   **Delete Character Button**:
    *   **UI Action**: Deletes a character after confirmation.
    *   **Backend API Call**: `DELETE /api/characters?id={characterId}`
    *   **Workflow**:
        1.  The frontend sends a DELETE request to `/api/characters` with the character's ID as a query parameter.
        2.  The API route handler in `app/api/characters/route.ts` receives the request.
        3.  It reads the existing characters from `data/characters.json`.
        4.  It filters out the character with the matching ID.
        5.  The updated list of characters is written back to `data/characters.json`.
        6.  A success response is returned to the frontend.
    *   **Database Interaction**:
        *   Reads from `data/characters.json`.
        *   Writes to `data/characters.json`.

*   **Generate Button**:
    *   **UI Action**: Generates an image for the selected character.
    *   **Backend API Call**: `POST /api/generate-image`
    *   **Workflow**:
        1.  The frontend sends a POST request to `/api/generate-image` with the character's ID and other generation parameters.
        2.  The API route handler in `app/api/generate-image/route.ts` receives the request.
        3.  It calls the ComfyUI server to generate an image based on the character's prompt and model settings.
        4.  The generated image is returned to the frontend as a base64 string.
    *   **Database Interaction**: None directly, but it reads character data which comes from `data/characters.json`.

*   **Train LoRA Button**:
    *   **UI Action**: Opens a dialog to train a LoRA model for the selected character.
    *   **Backend API Call**: `POST /api/lora/v2/train`
    *   **Workflow**:
        1.  The frontend sends a POST request to `/api/lora/v2/train` with the character's ID, training images, and other training parameters.
        2.  The API route handler in `app/api/lora/v2/train/route.ts` receives the request.
        3.  It initiates a LoRA training process on the ComfyUI server.
        4.  A success response is returned to the frontend.
    *   **Database Interaction**: None directly, but it reads character data which comes from `data/characters.json`.

*   **Post Button**:
    *   **UI Action**: Generates an image and posts it to Instagram.
    *   **Backend API Call**: `POST /api/post-to-instagram`
    *   **Workflow**:
        1.  The frontend first calls `POST /api/generate-image` to generate an image.
        2.  If the image is generated successfully, the frontend sends a POST request to `/api/post-to-instagram` with the character's ID, the generated image, and a caption.
        3.  The API route handler in `app/api/post-to-instagram/route.ts` receives the request.
        4.  It uses the Instagram Graph API to post the image to the character's Instagram account.
        5.  A success response is returned to the frontend.
    *   **Database Interaction**: Reads the character's Instagram API key and account ID from `data/characters.json`.

*   **Post to X Button**:
    *   **UI Action**: Generates an image and posts it to X (formerly Twitter).
    *   **Backend API Call**: `POST /api/post-to-twitter`
    *   **Workflow**:
        1.  The frontend first calls `POST /api/generate-image` to generate an image.
        2.  If the image is generated successfully, the frontend sends a POST request to `/api/post-to-twitter` with the character's ID, the generated image, and a caption.
        3.  The API route handler in `app/api/post-to-twitter/route.ts` receives the request.
        4.  It uses the Twitter API to post the image to the character's X account.
        5.  A success response is returned to the frontend.
    *   **Database Interaction**: Reads the character's Twitter API keys from `data/characters.json`.

### Scheduling Tab

*   **Run Now Button**:
    *   **UI Action**: Manually triggers the scheduler to run all tasks.
    *   **Backend API Call**: `POST /api/scheduler` with `action: "run_now"`
    *   **Workflow**:
        1.  The frontend sends a POST request to `/api/scheduler` with the action `run_now`.
        2.  The API route handler in `app/api/scheduler/route.ts` receives the request.
        3.  It iterates through all scheduled tasks and executes them immediately.
        4.  A success response is returned to the frontend.
    *   **Database Interaction**: Reads from `data/scheduler.json`.

*   **Add Task Button**:
    *   **UI Action**: Opens a dialog to create a new scheduled task.
    *   **Backend API Call**: `POST /api/scheduler` with `action: "add_task"`
    *   **Workflow**:
        1.  The frontend sends a POST request to `/api/scheduler` with the new task's data.
        2.  The API route handler in `app/api/scheduler/route.ts` receives the request.
        3.  It adds the new task to the list of scheduled tasks in `data/scheduler.json`.
        4.  A success response is returned to the frontend.
    *   **Database Interaction**:
        *   Reads from `data/scheduler.json`.
        *   Writes to `data/scheduler.json`.

*   **Pause/Resume Task Button**:
    *   **UI Action**: Pauses or resumes a scheduled task.
    *   **Backend API Call**: `POST /api/scheduler` with `action: "toggle_task"`
    *   **Workflow**:
        1.  The frontend sends a POST request to `/api/scheduler` with the task's ID and the new `active` status.
        2.  The API route handler in `app/api/scheduler/route.ts` receives the request.
        3.  It updates the task's `active` status in `data/scheduler.json`.
        4.  A success response is returned to the frontend.
    *   **Database Interaction**:
        *   Reads from `data/scheduler.json`.
        *   Writes to `data/scheduler.json`.

### Prompt Management Tab

*   **Refresh Prompts Button**:
    *   **UI Action**: Refreshes the list of generated prompts.
    *   **Backend API Call**: `GET /api/prompts`
    *   **Workflow**:
        1.  The frontend sends a GET request to `/api/prompts`.
        2.  The API route handler in `app/api/prompts/route.ts` receives the request.
        3.  It reads the list of prompts from `data/prompts.json`.
        4.  The list of prompts is returned to the frontend.
    *   **Database Interaction**: Reads from `data/prompts.json`.

*   **Delete Prompt Button**:
    *   **UI Action**: Deletes a generated prompt.
    *   **Backend API Call**: `POST /api/prompts` with `action: "delete_prompt"`
    *   **Workflow**:
        1.  The frontend sends a POST request to `/api/prompts` with the prompt's ID.
        2.  The API route handler in `app/api/prompts/route.ts` receives the request.
        3.  It removes the prompt from `data/prompts.json`.
        4.  A success response is returned to the frontend.
    *   **Database Interaction**:
        *   Reads from `data/prompts.json`.
        *   Writes to `data/prompts.json`.

*   **Generate with AI Button**:
    *   **UI Action**: Generates a caption for a prompt using AI.
    *   **Backend API Call**: `POST /api/generate-caption`
    *   **Workflow**:
        1.  The frontend sends a POST request to `/api/generate-caption` with the prompt, character data, and narrative.
        2.  The API route handler in `app/api/generate-caption/route.ts` receives the request.
        3.  It calls the Gemini API to generate a caption.
        4.  The generated caption is returned to the frontend.
    *   **Database Interaction**: Reads character and prompt data from `data/characters.json` and `data/prompts.json`.

### Monitoring Tab

*   **Refresh Status Button**:
    *   **UI Action**: Refreshes the system status.
    *   **Backend API Call**: `GET /api/system/status`
    *   **Workflow**:
        1.  The frontend sends a GET request to `/api/system/status`.
        2.  The API route handler in `app/api/system/status/route.ts` receives the request.
        3.  It checks the status of ComfyUI, the database, the scheduler, and Instagram.
        4.  The system status is returned to the frontend.
    *   **Database Interaction**: Checks for the existence and writability of the `data` directory.
