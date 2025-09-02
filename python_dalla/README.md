# Digital Dalla - Python Edition

This is a Python-based web application for managing and automating AI-powered Instagram accounts, built with Flask. It is a reimplementation of the original Next.js application with a simpler tech stack.

## Features

- **Character Management**: Create and manage AI characters, including their personalities and Instagram credentials.
- **Image Generation**: Connects to a ComfyUI instance to generate images using any available model or LoRA.
- **Prompt Generation**: Uses the Google Gemini API to generate creative prompts based on character personas.
- **Instagram Posting**: Post generated images directly to Instagram.
- **Post Scheduling**: Schedule posts to be published at a future date and time.

## Setup and Installation

### 1. Prerequisites

- Python 3.7+
- A running instance of [ComfyUI](https://github.com/comfyanonymous/ComfyUI).
- A Google Gemini API key.
- An Instagram Business Account and credentials for the Instagram Graph API.

### 2. Installation

1.  **Clone the repository** (if you haven't already).
2.  **Navigate to the `python_dalla` directory:**
    ```bash
    cd python_dalla
    ```
3.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```
4.  **Install the required packages:**
    ```bash
    pip install -r requirements.txt
    ```

### 3. Configuration

The application is configured using environment variables. You can create a `.env` file in this directory or set them directly in your shell.

**Required Configuration:**

```
# ComfyUI Configuration
COMFYUI_URL="http://127.0.0.1:8188"
COMFYUI_PATH="/path/to/your/ComfyUI"  # e.g., "C:/Users/You/ComfyUI" or "/home/you/ComfyUI"

# Gemini API Key
GEMINI_API_KEY="your_gemini_api_key"

# Public URL (Required for Instagram Posting)
# Use a service like ngrok if running locally: https://your-id.ngrok-free.app
PUBLIC_URL="your_public_facing_url"
```

To use a `.env` file, you can install `python-dotenv`:
```bash
pip install python-dotenv
```
And then add `from dotenv import load_dotenv; load_dotenv()` to the top of `app.py` and `scheduler_worker.py`.

## Running the Application

You need to run two processes in separate terminals from within the `python_dalla` directory.

**Terminal 1: Run the Web Server**

```bash
python app.py
```
The application will be available at `http://127.0.0.1:5001`.

**Terminal 2: Run the Scheduler Worker**

```bash
python scheduler_worker.py
```
This worker will run in the background and check for scheduled posts every minute.

---
*This application is a simplified reimplementation. For full details on the original project, please see the main repository's README.*
