# Digital Dalla - Python Backend

This project is the Python backend implementation for the Digital Dalla project, a web-based dashboard for managing and automating AI-powered social media accounts. It provides a complete API for character management, content generation, social media posting, and task automation, as outlined in the Software Requirement Specification.

## Features

-   **Character Management**: Full CRUD API for creating, reading, updating, and deleting AI character personas.
-   **AI Content Generation**:
    -   **Captions**: Integrates with the Google Gemini API to generate creative social media captions.
    -   **Images**: Integrates with a ComfyUI server to generate images based on detailed prompts and character settings.
-   **Social Media Posting**:
    -   **Twitter**: Post images and captions directly to Twitter via the v2 API.
    -   **Instagram**: Post images and captions to Instagram Business Accounts via the Graph API. (Uses `ngrok` to create a temporary public URL for local images).
-   **Scheduling & Automation**: A robust, cron-based task scheduler using APScheduler to automate content generation and posting workflows.
-   **LoRA Training Framework**: An API to trigger and monitor long-running LoRA training jobs as background processes.
-   **System Monitoring**: A status endpoint to check the health and connectivity of all major components (Database, ComfyUI, Gemini API, Scheduler).

## Setup and Installation

### Prerequisites

-   Python 3.10+
-   A running ComfyUI instance (for image generation).
-   API keys for Google Gemini, Twitter, and Instagram.

### 1. Set up a Virtual Environment

It is highly recommended to use a virtual environment to manage dependencies.

```bash
# Navigate to the python_implementation directory
cd python_implementation

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On macOS and Linux:
source venv/bin/activate
# On Windows:
# venv\\Scripts\\activate
```

### 2. Install Dependencies

Install all the required Python packages using pip.

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

The application uses a `.env` file to manage sensitive keys and configuration.

1.  In the `python_implementation` directory, create a file named `.env`.
2.  Add the following variables to the file:

    ```env
    # Your API key for Google Gemini
    GEMINI_API_KEY="YOUR_API_KEY_HERE"

    # The URL of your running ComfyUI server
    COMFYUI_URL="http://127.0.0.1:8188"
    ```

**Note on Social Media Keys**: API keys for Twitter and Instagram are stored per-character in the database. They can be added when creating or updating a character via the `/api/characters` endpoint.

## Running the Application

To run the FastAPI server, use `uvicorn`. Make sure you are in the `python_implementation` directory with your virtual environment activated.

```bash
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at `http://127.0.0.1:8000`.

You can access the interactive API documentation (provided by Swagger UI) at `http://127.0.0.1:8000/docs`.

## API Endpoints Overview

The API is organized by tags. Here is a brief overview:

-   **Characters**: Manage AI personas.
-   **Prompts**: Manage a library of prompts for content generation.
-   **AI**: Endpoints that use AI for generation (e.g., `/generate-caption`).
-   **ComfyUI**: Endpoints for interacting with the ComfyUI server (listing models, generating images).
-   **Social Media**: Endpoints for posting content to Twitter and Instagram.
-   **Scheduler**: Endpoints for managing automated tasks.
-   **LoRA Training**: Endpoints for starting and monitoring training jobs.
-   **System**: The system status endpoint.
