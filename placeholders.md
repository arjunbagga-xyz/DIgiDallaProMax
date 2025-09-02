# Placeholder and Simulated Features

This document tracks all the features in the Python/Flask application that are currently implemented as placeholders or simulations. This is done to ensure the application's API and structure are complete, even without access to the necessary API keys or in place of highly complex functionality that will be implemented later.

## 1. AI Caption Generation

-   **API Endpoint:** `POST /api/generate-caption`
-   **Current Behavior:** The full logic to call the Google Gemini API is implemented. However, it will not function without a valid `GEMINI_API_KEY` provided as an environment variable.
-   **TODO:** The user must provide their own `GEMINI_API_KEY` for this feature to work.

## 2. Instagram Posting

-   **API Endpoint:** `POST /api/post-to-instagram`
-   **Current Behavior:** The full logic to post to the Instagram Graph API is implemented. It will not function without valid Instagram API credentials (`instagramApiKey` and `instagramAccountId`) configured for a character.
-   **TODO:** The user must provide their own Instagram API credentials for each character they wish to post as.

## 3. Twitter (X) Posting

-   **API Endpoint:** `POST /api/post-to-twitter`
-   **Current Behavior:** The full logic to post to the Twitter API using Tweepy is implemented. It requires a full set of Twitter developer credentials (`twitterAppKey`, `twitterAppSecret`, `twitterAccessToken`, `twitterAccessSecret`) for a character.
-   **TODO:** The user must provide their own Twitter developer credentials for each character.

## 4. Scheduled Task Execution

-   **Function:** `execute_scheduled_task(task_id)` in `app.py`
-   **Current Behavior:** The scheduler is now connected to the real logic functions for generating content and posting to social media.
-   **Status:** **Complete.** The functionality of this feature now depends on the services it calls (e.g., it will not be able to post if the social media posting is not configured with API keys).
