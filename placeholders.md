# Placeholder and Simulated Features

This document tracks all the features in the Python/Flask application that are currently implemented as placeholders or simulations. This is done to ensure the application's API and structure are complete, even without access to the necessary API keys or in place of highly complex functionality that will be implemented later.

## 1. AI Caption Generation

-   **API Endpoint:** `POST /api/generate-caption`
-   **Current Behavior:** The endpoint returns a hardcoded, sample caption. It does not call an external AI service like Google Gemini.
-   **Reason:** This requires a `GEMINI_API_KEY` which is not available.
-   **TODO:** Replace the placeholder with a real implementation that calls the Gemini API to generate a caption based on the provided prompt and character details.

## 2. Instagram Posting

-   **API Endpoint:** `POST /api/post-to-instagram`
-   **Current Behavior:** The endpoint simulates a successful post to Instagram. It prints a message to the console and returns a success response with a fake post ID. It does not actually connect to the Instagram Graph API.
-   **Reason:** This requires character-specific or global Instagram API keys and account IDs which are not available.
-   **TODO:** Replace the simulation with a real implementation that uploads an image and publishes it with a caption to Instagram.

## 3. Twitter (X) Posting

-   **API Endpoint:** `POST /api/post-to-twitter`
-   **Current Behavior:** Similar to Instagram, this endpoint simulates a successful post to Twitter/X. It returns a success response with a fake post ID without connecting to the Twitter API.
-   **Reason:** This requires character-specific or global Twitter API keys and secrets which are not available.
-   **TODO:** Replace the simulation with a real implementation that posts a tweet with an image and caption.

## 4. Scheduled Task Execution

-   **Function:** `placeholder_task(task_id)` in `app.py`
-   **Current Behavior:** When a scheduled job is triggered by `APScheduler`, it calls this function, which only prints a message to the console indicating that the task was executed. It does not perform the actual "generate and post" workflow.
-   **Reason:** This is a simplified first version of the scheduler. The full workflow execution logic is complex and will be built out later.
-   **TODO:** Replace the placeholder function with a real task execution engine that:
    -   Fetches the task details from `schedule.json`.
    -   Calls the image generation API.
    -   Calls the caption generation API.
    -   Calls the social media posting APIs.
    -   Handles errors and logging for the entire workflow.
