# Prompt Engineering Guide

This document outlines the prompt engineering strategies used in this application for generating AI content, including images and captions.

## 1. Overview

Our prompt engineering strategy is designed to create consistent and engaging content that is authentic to the defined characters. We use a combination of structured data and dynamic context (like narratives) to guide the AI models.

The key components of our prompts are:
-   **Character Details**: Name, personality, and backstory.
-   **Narrative Context**: The character's current story arc (e.g., a trip, an event).
-   **Image-Specific Details**: The user-defined prompt for image generation.

## 2. Data Structures for Prompts

Prompt-related data is stored in two main locations: `data/characters.json` and `data/prompts.json`.

### `data/characters.json`

Each character object in `data/characters.json` has a `promptSettings` field that defines the base prompts and style for that character.

**Example `promptSettings` in `data/characters.json`:**

```json
{
  "id": "char_1754528276811_4suaz8mqv",
  "name": "Luna the Mystic",
  "promptSettings": {
    "basePrompt": "a beautiful portrait of luna_character",
    "negativePrompt": "ugly, disfigured, low quality",
    "style": "photorealistic, cinematic lighting",
    "mood": "serene, mystical"
  },
  "...": "..."
}
```

### `data/prompts.json`

This file stores an array of generated prompt objects, which can be used for generating images and captions.

**Example `prompt` object in `data/prompts.json`:**

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

## 3. Caption Generation (Gemini API)

We use the Gemini API to generate compelling Instagram captions. The prompt sent to the Gemini model is carefully structured to provide the necessary context.

### Prompt Structure

Here is the template for the prompt used to generate captions:

```
You are an AI assistant for a social media automation tool.
Your task is to generate a compelling and engaging Instagram caption.

**Character Details:**
- Name: {character.name}
- Personality: {character.personality}
- Backstory: {character.backstory}

**Current Narrative:** (This section is only included if a narrative is active)
- Title: {narrative.title}
- Description: {narrative.description}

**Image Generation Prompt:**
```
{prompt}
```

**Instructions:**
1.  Write a caption that is authentic to the character's voice and personality.
2.  The caption should be inspired by the image generation prompt.
3.  Keep it concise and engaging (1-3 sentences).
4.  Include 3-5 relevant and popular hashtags.
5.  Do not use hashtags that are just the character's name or trigger words.
6.  Do not include any of your own commentary. Just provide the caption.

**Example Output:**
Lost in the neon glow of a city that never sleeps. ✨ #cyberpunk #neocity #nightlife #aiart #characterdesign

**Generated Caption:**
```

### Key Elements of the Caption Prompt

-   **Role-Playing**: The prompt starts by assigning a role to the AI ("You are an AI assistant..."). This helps the AI understand its task.
-   **Contextual Data**: We provide rich context about the character and their current narrative. This ensures the generated caption is consistent with the character's persona and story.
-   **Clear Instructions**: The instructions guide the AI on the desired output format, tone, and content. This includes constraints like the length of the caption and the number of hashtags.
-   **Example Output**: Providing an example helps the AI understand the expected format and quality of the response.

## 4. Image Generation (ComfyUI)

Image generation is handled by ComfyUI, and the prompts are constructed based on the character's settings.

### Prompt Structure

The prompts for image generation are typically a combination of:

-   **Base Prompt**: A general prompt defined in the character's `promptSettings` (e.g., "photo of a woman").
-   **Trigger Word**: The LoRA trigger word for the character (e.g., "luna_character").
-   **Style and Mood**: Additional keywords from the character's `promptSettings` (e.g., "photorealistic", "serene").
-   **Dynamic Elements**: The specific prompt for the image being generated, which can come from `data/prompts.json` or be provided manually.

The final prompt sent to ComfyUI is a combination of these elements, designed to create a consistent look and feel for the character while allowing for variety in the generated images.
