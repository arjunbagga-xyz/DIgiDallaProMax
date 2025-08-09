# Database Schema

This document provides a detailed breakdown of the data structures used in the application's file-based database. The database consists of several JSON files stored in the `data/` directory.

## `data/characters.json`

This file stores an array of character objects, each representing a unique AI persona.

| Field                 | Type     | Description                                                                                             | Example Value                                |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `id`                  | `string` | A unique identifier for the character.                                                                  | `"char_1754528276811_4suaz8mqv"`              |
| `name`                | `string` | The character's name.                                                                                   | `"Luna the Mystic"`                          |
| `personality`         | `string` | A brief description of the character's personality.                                                     | `"Dreamy and mystical"`                      |
| `backstory`           | `string` | The character's background story.                                                                       | `"Luna lives in a hidden forest..."`         |
| `instagramHandle`     | `string` | The character's Instagram handle.                                                                       | `"@luna_mystic"`                             |
| `isActive`            | `boolean`| Whether the character is currently active.                                                              | `true`                                       |
| `createdAt`           | `string` | The timestamp when the character was created (ISO 8601 format).                                         | `"2025-08-07T00:57:56.811Z"`                 |
| `updatedAt`           | `string` | The timestamp when the character was last updated (ISO 8601 format).                                    | `"2025-08-08T10:30:00.000Z"`                 |
| `preferredModel`      | `string` | The filename of the preferred ComfyUI model for generating images.                                      | `"sdxl_dreamshaper.safetensors"`             |
| `triggerWord`         | `string` | The trigger word for the character's LoRA model.                                                        | `"luna_character"`                           |
| `promptSettings`      | `object` | An object containing the base prompt settings for the character.                                        | See `promptSettings` table below.            |
| `narratives`          | `array`  | An array of narrative objects that define the character's story arcs.                                   | See `narratives` table below.                |
| `instagramAccountId`  | `string` | The character's Instagram Business Account ID.                                                          | `"1234567890"`                               |
| `instagramApiKey`     | `string` | The character's Instagram Graph API key.                                                                | `"INSTAGRAM_API_KEY"`                        |
| `twitterAccountId`    | `string` | The character's X/Twitter Account ID.                                                                   | `"0987654321"`                               |
| `twitterAppKey`       | `string` | The character's X/Twitter App Key.                                                                      | `"TWITTER_APP_KEY"`                          |
| `twitterAppSecret`    | `string` | The character's X/Twitter App Secret.                                                                   | `"TWITTER_APP_SECRET"`                       |
| `twitterAccessToken`  | `string` | The character's X/Twitter Access Token.                                                                 | `"TWITTER_ACCESS_TOKEN"`                     |
| `twitterAccessSecret` | `string` | The character's X/Twitter Access Secret.                                                                | `"TWITTER_ACCESS_SECRET"`                    |

### Nested Object: `promptSettings`

| Field            | Type     | Description                                | Example Value                        |
| ---------------- | -------- | ------------------------------------------ | ------------------------------------ |
| `basePrompt`     | `string` | The base prompt for image generation.      | `"a beautiful portrait of..."`       |
| `negativePrompt` | `string` | The negative prompt for image generation.  | `"ugly, disfigured"`                 |
| `style`          | `string` | Keywords defining the visual style.        | `"photorealistic, cinematic"`        |
| `mood`           | `string` | Keywords defining the mood of the image.   | `"serene, mystical"`                 |

### Nested Object: `narratives`

Each object in the `narratives` array has the following structure:

| Field         | Type     | Description                               | Example Value                        |
| ------------- | -------- | ----------------------------------------- | ------------------------------------ |
| `id`          | `string` | A unique identifier for the narrative.    | `"narr_1"`                           |
| `title`       | `string` | The title of the narrative.               | `"The Crystal Quest"`                |
| `description` | `string` | A brief description of the narrative.     | `"Luna is searching for a crystal."` |
| `startDate`   | `string` | The start date of the narrative (YYYY-MM-DD). | `"2025-08-01"`                       |
| `endDate`     | `string` | The end date of the narrative (YYYY-MM-DD).   | `"2025-08-31"`                       |

## `data/scheduler.json`

This file stores an array of task objects that define the automation schedule for the characters.

| Field         | Type      | Description                                                               | Example Value                        |
| ------------- | --------- | ------------------------------------------------------------------------- | ------------------------------------ |
| `id`          | `string`  | A unique identifier for the task.                                         | `"task_1"`                           |
| `characterId` | `string`  | The ID of the character this task belongs to.                             | `"char_1754528276811_4suaz8mqv"`      |
| `type`        | `string`  | The type of task to perform (e.g., `generate_and_post`).                  | `"generate_and_post"`                |
| `schedule`    | `string`  | A cron expression for the task's schedule.                                | `"0 18 * * *"`                       |
| `active`      | `boolean` | Whether the task is currently active.                                     | `true`                               |
| `config`      | `object`  | An object containing task-specific configuration.                         | See `config` table below.            |

### Nested Object: `config`

| Field             | Type      | Description                                                | Example Value                                  |
| ----------------- | --------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `prompt`          | `string`  | A custom prompt for this task, overriding the character's default. | `"luna_character in a magical forest"`         |
| `postToInstagram` | `boolean` | Whether to post the generated image to Instagram.          | `true`                                         |

## `data/prompts.json`

This file stores an array of generated prompts that can be used for creating content.

| Field           | Type      | Description                                                     | Example Value                        |
| --------------- | --------- | --------------------------------------------------------------- | ------------------------------------ |
| `id`            | `string`  | A unique identifier for the prompt.                             | `"prompt_1"`                         |
| `characterId`   | `string`  | The ID of the character this prompt belongs to.                 | `"char_1754528276811_4suaz8mqv"`      |
| `characterName` | `string`  | The name of the character this prompt belongs to.               | `"Luna the Mystic"`                  |
| `prompt`        | `string`  | The text of the prompt.                                         | `"a beautiful portrait of..."`       |
| `caption`       | `string`  | The generated caption for the prompt.                           | `"Exploring the enchanted woods..."` |
| `createdAt`     | `string`  | The timestamp when the prompt was created (ISO 8601 format).    | `"2025-08-08T11:00:00.000Z"`         |
| `used`          | `boolean` | Whether the prompt has been used to generate content.           | `false`                              |
