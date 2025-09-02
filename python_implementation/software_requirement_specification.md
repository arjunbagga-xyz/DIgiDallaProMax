# Software Requirement Specification (SRS) for the Python Implementation

## 1. Introduction

This document outlines the software requirements for the Python implementation of the Digital Dalla project. The project is a web-based dashboard for managing and automating AI-powered Instagram and Twitter accounts. It provides a user interface for creating AI characters, generating images, scheduling posts, and managing content.

The purpose of this document is to provide a detailed description of the system's functional and non-functional requirements, its architecture, data model, and external interfaces. This document is intended for the development team to guide the implementation of the Python version of the application.

## 2. Functional Requirements

This section provides a detailed breakdown of all system behaviors, categorized by feature.

### 2.1. Character Management

The system shall allow users to perform Create, Read, Update, and Delete (CRUD) operations for AI characters. Each character represents a unique AI persona with a distinct profile.

**Character Attributes:**
*   `id`: A unique identifier for the character.
*   `name`: The character's name.
*   `personality`: A description of the character's personality.
*   `backstory`: The character's background story.
*   `instagramHandle`: The character's Instagram handle.
*   `twitterHandle`: The character's Twitter handle.
*   `isActive`: A boolean indicating if the character is active.
*   `createdAt`: Timestamp of character creation.
*   `updatedAt`: Timestamp of the last update.
*   `preferredModel`: The preferred ComfyUI model for image generation.
*   `triggerWord`: The trigger word for the character's LoRA model.
*   `promptSettings`: Base prompt settings (base prompt, negative prompt, style, mood).
*   `narratives`: Story arcs for the character, each with an `id`, `title`, `description`, `startDate`, and `endDate`.
*   `instagramAccountId`, `instagramApiKey`: Instagram API credentials.
*   `twitterAccountId`, `twitterAppKey`, `twitterAppSecret`, `twitterAccessToken`, `twitterAccessSecret`: Twitter API credentials.

### 2.2. Image Generation

The system shall be able to generate images using a connected ComfyUI instance.

*   **Model Selection**: The system will fetch a list of available checkpoint models from the ComfyUI server via a `GET /api/models` endpoint. The user will be able to select a model from this list for image generation.
*   **Dynamic Workflows**: The system will dynamically construct the appropriate ComfyUI workflow (for SDXL, SD1.5, or FLUX models) based on the selected model and user parameters.
*   **LoRA Integration**: The system shall support the use of LoRA (Low-Rank Adaptation) models to generate images that are consistent with a specific character's appearance. The available LoRAs will also be fetched from the ComfyUI server.
*   **API Endpoint**: Image generation will be exposed through a `POST /api/generate-image` endpoint.

### 2.3. Social Media Integration

The system shall support posting generated content to social media platforms.

*   **Instagram**: Post generated images with captions to a specified Instagram Business Account using the Instagram Graph API. This will be handled by a `POST /api/post-to-instagram` endpoint.
*   **Twitter/X**: Post generated images with captions to a specified Twitter account using the Twitter API v2. This will be handled by a `POST /api/post-to-twitter` endpoint.

### 2.4. Prompt Management

The system shall provide tools for managing prompts for content creation.

*   **AI-Powered Caption Generation**: The system will use the Google Gemini API to generate captions for prompts via a `POST /api/generate-caption` endpoint.
*   **Prompt Library**: The system will store and manage a library of generated prompts in `data/prompts.json`.
*   **Usage Tracking**: The system will track whether a prompt has been used to generate content.
*   **CRUD Operations**: The system will provide API endpoints for reading and deleting prompts.

### 2.5. Scheduling and Automation

The system shall provide functionality to schedule automated tasks for content generation and posting.

*   **Task Scheduling**: Users can create, view, and delete scheduled tasks. Tasks are stored in `data/scheduler.json`.
*   **Cron-Based Scheduling**: The system will use cron expressions to define the schedule for tasks.
*   **Task Management**: Users can manually trigger the scheduler to run all tasks, and can pause or resume individual tasks.
*   **API Endpoints**: Scheduler functionality will be managed through the `/api/scheduler` endpoint.

### 2.6. System Monitoring

The system shall provide a dashboard to monitor the status of its components and dependencies.

*   **Status Checks**: The monitoring dashboard will check the status of the ComfyUI server, the file-based database, the scheduler, and Instagram connectivity.
*   **API Endpoint**: The system status will be available through a `GET /api/system/status` endpoint.

### 2.7. LoRA Training

The system will provide a mechanism for training LoRA models for characters.

*   **Training Process**: The system will trigger a LoRA training process using a script or a dedicated training service like Kohya SS. The training will be initiated via a `POST /api/lora/train` endpoint.
*   **Training Parameters**: The user will be able to specify the base model, training images, and other training parameters.
*   **Training Status**: The system will provide a way to monitor the status of the training process.

### 2.8. Content Management and Settings

The system shall provide pages for managing content and application settings.

*   **Content Management Page**: A page where users can view all generated content, edit captions, and post to social media.
*   **Settings Page**: A page where users can manage API keys (e.g., Gemini API key) and view information about data storage locations.

## 3. Non-Functional Requirements

### 3.1. Performance

*   The API responses should be reasonably fast for a good user experience.
*   The performance of image generation and social media posting is dependent on the response times of external services (ComfyUI, Instagram API, Twitter API).

### 3.2. Security

*   All sensitive information, such as API keys and access tokens, must be stored securely in environment variables or a similar secure configuration management system.
*   The application is designed for local or private network use and is not hardened for exposure to the public internet.

### 3.3. Usability

*   The API should be well-documented and easy to use.
*   Error messages should be clear and informative.

## 4. System Architecture

The application will be a web-based dashboard with a Python backend.

*   **Backend**: The backend will be built with a Python web framework (e.g., Flask, FastAPI) and will expose a RESTful API.
*   **Frontend**: The frontend will be a single-page application (SPA) that communicates with the backend API. The frontend is a separate component and is not part of the Python implementation project.
*   **Database**: A simple file-based database using JSON files will be used for data storage, mirroring the structure of the original Node.js application.

## 5. Data Model

The application will use a file-based database consisting of JSON files stored in a `data/` directory.

### 5.1. `data/characters.json`
Stores an array of character objects. See section 2.1 for the attributes of a character object.

### 5.2. `data/scheduler.json`
Stores an array of scheduled task objects.
*   `id`: Unique identifier for the task.
*   `characterId`: The ID of the character this task belongs to.
*   `type`: The type of task (e.g., `generate_and_post`).
*   `schedule`: A cron expression for the task's schedule.
*   `active`: Whether the task is active.
*   `config`: Task-specific configuration (e.g., custom prompt, postToInstagram).

### 5.3. `data/prompts.json`
Stores an array of generated prompt objects.
*   `id`: Unique identifier for the prompt.
*   `characterId`: The ID of the character this prompt belongs to.
*   `characterName`: The name of the character.
*   `prompt`: The text of the prompt.
*   `caption`: The generated caption for the prompt.
*   `createdAt`: Timestamp of prompt creation.
*   `used`: Whether the prompt has been used.

## 6. External Interfaces

The system will interact with several external services through their APIs.

*   **ComfyUI**: Used for generating images and listing available models. The system will send workflow JSONs to the ComfyUI server's API.
*   **Google Gemini**: Used for generating text content, such as captions for social media posts.
*   **Instagram Graph API**: Used for posting images and captions to Instagram.
*   **Twitter API**: Used for posting images and captions to Twitter/X.
*   **LoRA Training Service**: An external service or script (e.g., Kohya SS) for training LoRA models.
