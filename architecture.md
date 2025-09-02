# Application Architecture

This document outlines the architecture for the Python/Flask-based AI-powered Instagram automation dashboard. The design prioritizes simplicity, robustness, and functional completeness, as per the user's requirements.

## 1. High-Level Overview

The application is a web-based dashboard that allows users to manage AI characters, generate content (images), schedule posts to social media, and train custom LoRA models.

The architecture consists of two main parts:
-   A **Python/Flask backend** that serves as a REST API and handles all business logic.
-   A **static frontend** built with HTML, CSS, and vanilla JavaScript that provides the user interface.

## 2. Backend Architecture

The backend is built using the Flask web framework and is consolidated into a single `app.py` file for simplicity.

-   **Framework**: Flask
-   **Main File**: `app.py`
-   **Responsibilities**:
    -   Serving the static frontend files (HTML, CSS, JS).
    -   Providing a RESTful API for the frontend to consume.
    -   Handling all business logic, including:
        -   CRUD operations for characters, prompts, and schedules.
        -   Interacting with the ComfyUI API for image generation.
        -   Posting content to Instagram and Twitter.
        -   Managing a task schedule with `APScheduler`.
        -   Initiating and managing LoRA training jobs.

-   **Asynchronous Tasks**: Long-running tasks, specifically LoRA training, will be handled asynchronously. The API endpoint (`/api/lora/train`) will immediately return a response and trigger the training process in the background to avoid blocking the server. This will be achieved using Python's `threading` or `multiprocessing` modules.

## 3. Frontend Architecture

The frontend is a traditional multi-page web application. It does not use a complex JavaScript framework or server-side templating like Jinja2.

-   **Technologies**: HTML, CSS, Vanilla JavaScript
-   **Structure**: The `static/` directory will contain all frontend files. Each major feature will have its own HTML page (e.g., `index.html`, `characters.html`, `lora.html`).
-   **Functionality**:
    -   JavaScript will be used to make `fetch` requests to the backend API.
    -   Data returned from the API will be used to dynamically render content on the pages (e.g., populating tables with character data).
    -   User interactions (button clicks, form submissions) will trigger API calls to the backend.

## 4. Data Storage

The application uses a simple file-based database consisting of JSON files stored in the `data/` directory.

-   `data/characters.json`: Stores character data.
-   `data/scheduler.json`: Stores scheduled tasks.
-   `data/prompts.json`: Stores generated prompts and content ideas.

This approach is simple and requires no external database setup. The backend will be responsible for reading from and writing to these files.

## 5. Functional LoRA Training

A core feature of this application is the ability to perform actual LoRA (Low-Rank Adaptation) training.

-   **Libraries**: The training process will be implemented in Python using powerful libraries from the Hugging Face ecosystem, including:
    -   `torch` (PyTorch)
    -   `diffusers`
    -   `peft` (Parameter-Efficient Fine-Tuning)
    -   `accelerate`
-   **Process**:
    1.  The user will upload training images to the `training_data/` directory.
    2.  The user will initiate training via a button on the `lora.html` page.
    3.  This triggers a POST request to the `/api/lora/train` endpoint.
    4.  The Flask backend starts a background training script.
    5.  The script prepares a dataset from the images, sets up a `diffusers` training pipeline, and uses `peft` to train a LoRA model.
    6.  The resulting trained LoRA file (`.safetensors`) is saved to the `loras/` directory.
    7.  The frontend will provide feedback on the training status (e.g., "in progress," "completed," "failed").

## 6. Project Structure

```
/
├── app.py                  # Main Flask application file (backend)
├── requirements.txt        # Python dependencies
├── architecture.md         # This file
│
├── data/
│   ├── characters.json
│   ├── scheduler.json
│   └── prompts.json
│
├── static/
│   ├── index.html
│   ├── characters.html
│   ├── lora.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── main.js
│
├── training_data/
│   └── (user-uploaded images for training)
│
└── loras/
    └── (saved LoRA models)
```
