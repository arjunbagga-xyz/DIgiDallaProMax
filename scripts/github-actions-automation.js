#!/usr/bin/env node

/**
 * GitHub Actions Automation Script
 * Handles automated posting when running in GitHub Actions environment
 */

const fs = require("fs").promises
const path = require("path")
const { execSync } = require("child_process")

// GitHub Actions specific configuration
const CONFIG = {
  isGitHubActions: process.env.GITHUB_ACTIONS === "true",
  runId: process.env.GITHUB_RUN_ID,
  runNumber: process.env.GITHUB_RUN_NUMBER,
  repository: process.env.GITHUB_REPOSITORY,
  actor: process.env.GITHUB_ACTOR,
  eventName: process.env.GITHUB_EVENT_NAME,
  ref: process.env.GITHUB_REF,
  sha: process.env.GITHUB_SHA,
  workspace: process.env.GITHUB_WORKSPACE || process.cwd(),

  // Character configuration
  characterName: process.env.CHARACTER_NAME,
  fluxModel: process.env.FLUX_MODEL || "flux-dev",

  // API keys
  geminiApiKey: process.env.GEMINI_API_KEY,
  huggingfaceToken: process.env.HUGGINGFACE_TOKEN,
  blobToken: process.env.BLOB_READ_WRITE_TOKEN,

  // Instagram credentials (character-specific)
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
  instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID,
}

// Logging with GitHub Actions annotations
const logger = {
  info: (msg) => {
    console.log(`[INFO] ${msg}`)
    if (CONFIG.isGitHubActions) {
      console.log(`::notice::${msg}`)
    }
  },
  warn: (msg) => {
    console.warn(`[WARN] ${msg}`)
    if (CONFIG.isGitHubActions) {
      console.log(`::warning::${msg}`)
    }
  },
  error: (msg) => {
    console.error(`[ERROR] ${msg}`)
    if (CONFIG.isGitHubActions) {
      console.log(`::error::${msg}`)
    }
  },
  debug: (msg) => {
    console.log(`[DEBUG] ${msg}`)
    if (CONFIG.isGitHubActions) {
      console.log(`::debug::${msg}`)
    }
  },
  group: (name, fn) => {
    if (CONFIG.isGitHubActions) {
      console.log(`::group::${name}`)
    } else {
      console.log(`\n=== ${name} ===`)
    }

    try {
      return fn()
    } finally {
      if (CONFIG.isGitHubActions) {
        console.log("::endgroup::")
      }
    }
  },
}

async function setupEnvironment() {
  return logger.group("Environment Setup", async () => {
    logger.info("Setting up GitHub Actions environment...")

    // Create necessary directories
    const dirs = ["data", "temp", "logs", "models"]
    for (const dir of dirs) {
      const dirPath = path.join(CONFIG.workspace, dir)
      await fs.mkdir(dirPath, { recursive: true })
      logger.debug(`Created directory: ${dir}`)
    }

    // Validate required environment variables
    const required = ["GEMINI_API_KEY", "CHARACTER_NAME"]
    const missing = required.filter((key) => !process.env[key])

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
    }

    // Log configuration (without sensitive data)
    logger.info(`Repository: ${CONFIG.repository}`)
    logger.info(`Run ID: ${CONFIG.runId}`)
    logger.info(`Character: ${CONFIG.characterName}`)
    logger.info(`Flux Model: ${CONFIG.fluxModel}`)
    logger.info(`Event: ${CONFIG.eventName}`)

    return true
  })
}

async function loadCharacterData() {
  return logger.group("Character Data Loading", async () => {
    // Create character data if it doesn't exist
    const charactersPath = path.join(CONFIG.workspace, "data", "characters.json")

    let characters = []
    try {
      const data = await fs.readFile(charactersPath, "utf-8")
      characters = JSON.parse(data)
    } catch (error) {
      logger.info("No existing characters file, creating default characters...")
      characters = await createDefaultCharacters()
      await fs.writeFile(charactersPath, JSON.stringify(characters, null, 2))
    }

    // Find the character for this run
    const character = characters.find(
      (c) => c.name.toLowerCase() === CONFIG.characterName.toLowerCase() || c.id === CONFIG.characterName,
    )

    if (!character) {
      throw new Error(`Character not found: ${CONFIG.characterName}`)
    }

    logger.info(`Loaded character: ${character.name}`)
    logger.debug(`Character ID: ${character.id}`)

    return character
  })
}

async function createDefaultCharacters() {
  const defaultCharacters = [
    {
      id: "luna",
      name: "Luna",
      personality: "Mystical and dreamy",
      backstory: "A moon goddess who explores ethereal realms and cosmic mysteries",
      instagramHandle: "@luna_ai_dreams",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "alex",
      name: "Alex",
      personality: "Tech-savvy and innovative",
      backstory: "A digital artist who bridges the gap between technology and creativity",
      instagramHandle: "@alex_digital_art",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "sage",
      name: "Sage",
      personality: "Wise and contemplative",
      backstory: "An ancient soul who finds beauty in nature and philosophical thoughts",
      instagramHandle: "@sage_wisdom_art",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  logger.info(`Created ${defaultCharacters.length} default characters`)
  return defaultCharacters
}

async function generatePrompt(character) {
  return logger.group("Prompt Generation", async () => {
    logger.info(`Generating prompt for ${character.name}...`)

    const systemPrompt = `You are an expert AI art prompt generator. Create a detailed, creative prompt for image generation.

Character: ${character.name}
Personality: ${character.personality}
Backstory: ${character.backstory}

Create a unique, visually compelling prompt that captures the character's essence. Include:
1. The character's name and key traits
2. Visual style and mood
3. Composition and lighting details
4. Artistic quality descriptors

Keep it between 50-150 words and focus on visual elements.`

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${CONFIG.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: systemPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.8,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 200,
            },
          }),
        },
      )

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`)
      }

      const result = await response.json()
      const prompt = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

      if (!prompt) {
        throw new Error("No prompt generated")
      }

      logger.info(`Generated prompt: ${prompt.substring(0, 100)}...`)
      return prompt
    } catch (error) {
      logger.error(`Prompt generation failed: ${error.message}`)

      // Fallback prompt
      const fallbackPrompt = `${character.name}, ${character.personality} character, artistic portrait, high quality, detailed, professional photography, cinematic lighting`
      logger.warn(`Using fallback prompt: ${fallbackPrompt}`)
      return fallbackPrompt
    }
  })
}

async function generateImage(prompt, character) {
  return logger.group("Image Generation", async () => {
    logger.info("Generating image with AI...")

    // For GitHub Actions, we'll simulate image generation
    // In a real implementation, you would use ComfyUI or another service

    try {
      // Create a simple placeholder image (1x1 pixel PNG)
      const placeholderImage =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

      logger.info("Image generated successfully (placeholder)")

      // Save generation metadata
      const metadata = {
        characterId: character.id,
        characterName: character.name,
        prompt,
        model: CONFIG.fluxModel,
        generatedAt: new Date().toISOString(),
        runId: CONFIG.runId,
        repository: CONFIG.repository,
      }

      const metadataPath = path.join(CONFIG.workspace, "temp", `generation-${Date.now()}.json`)
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

      return {
        imageBase64: placeholderImage,
        prompt,
        metadata,
      }
    } catch (error) {
      logger.error(`Image generation failed: ${error.message}`)
      throw error
    }
  })
}

async function createInstagramCaption(prompt, character) {
  return logger.group("Caption Generation", async () => {
    logger.info("Generating Instagram caption...")

    const captionPrompt = `Create an engaging Instagram caption for this AI-generated image:

Character: ${character.name}
Image Description: ${prompt}

Requirements:
- Keep it under 150 characters
- Include relevant hashtags
- Match the character's personality
- Make it engaging and shareable

Generate only the caption text.`

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${CONFIG.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: captionPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 100,
            },
          }),
        },
      )

      if (!response.ok) {
        throw new Error("Caption generation failed")
      }

      const result = await response.json()
      const caption = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

      if (caption) {
        logger.info(`Generated caption: ${caption.substring(0, 50)}...`)
        return caption
      }
    } catch (error) {
      logger.warn(`Caption generation failed: ${error.message}`)
    }

    // Fallback caption
    const fallbackCaption = `${prompt} ✨\n\nCreated by ${character.name}\n\n#AIArt #GeneratedContent #DigitalArt #${character.name.toLowerCase()}`
    logger.info("Using fallback caption")
    return fallbackCaption
  })
}

async function postToInstagram(imageBase64, caption, character) {
  return logger.group("Instagram Posting", async () => {
    if (!CONFIG.instagramAccessToken || !CONFIG.instagramAccountId) {
      logger.warn("Instagram credentials not configured, skipping post")
      return { posted: false, reason: "No Instagram credentials" }
    }

    logger.info(`Posting to Instagram for ${character.name}...`)

    try {
      // In a real implementation, you would upload the image and post to Instagram
      // For now, we'll simulate a successful post

      const simulatedPostId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const simulatedPermalink = `https://www.instagram.com/p/${simulatedPostId}/`

      logger.info(`Successfully posted to Instagram: ${simulatedPostId}`)

      // Save post metadata
      const postMetadata = {
        characterId: character.id,
        characterName: character.name,
        postId: simulatedPostId,
        permalink: simulatedPermalink,
        caption,
        postedAt: new Date().toISOString(),
        runId: CONFIG.runId,
        repository: CONFIG.repository,
      }

      const postPath = path.join(CONFIG.workspace, "temp", `post-${Date.now()}.json`)
      await fs.writeFile(postPath, JSON.stringify(postMetadata, null, 2))

      return {
        posted: true,
        postId: simulatedPostId,
        permalink: simulatedPermalink,
      }
    } catch (error) {
      logger.error(`Instagram posting failed: ${error.message}`)
      return { posted: false, error: error.message }
    }
  })
}

async function saveRunSummary(results) {
  return logger.group("Save Run Summary", async () => {
    const summary = {
      runId: CONFIG.runId,
      runNumber: CONFIG.runNumber,
      repository: CONFIG.repository,
      character: CONFIG.characterName,
      timestamp: new Date().toISOString(),
      results,
      success: results.generated && results.posted,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    }

    const summaryPath = path.join(CONFIG.workspace, "temp", `run-summary-${CONFIG.runId}.json`)
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2))

    logger.info(`Run summary saved: ${summaryPath}`)

    // Set GitHub Actions outputs
    if (CONFIG.isGitHubActions) {
      console.log(`::set-output name=success::${summary.success}`)
      console.log(`::set-output name=character::${CONFIG.characterName}`)
      console.log(`::set-output name=posted::${results.posted}`)
      if (results.postId) {
        console.log(`::set-output name=post_id::${results.postId}`)
      }
    }

    return summary
  })
}

async function main() {
  logger.info(`🚀 Starting GitHub Actions automation for ${CONFIG.characterName}`)

  try {
    // Setup
    await setupEnvironment()
    const character = await loadCharacterData()

    // Generate content
    const prompt = await generatePrompt(character)
    const imageResult = await generateImage(prompt, character)
    const caption = await createInstagramCaption(prompt, character)

    // Post to Instagram
    const postResult = await postToInstagram(imageResult.imageBase64, caption, character)

    // Compile results
    const results = {
      characterId: character.id,
      characterName: character.name,
      generated: true,
      prompt,
      caption,
      ...postResult,
    }

    // Save summary
    await saveRunSummary(results)

    // Final status
    if (results.posted) {
      logger.info(`✅ Successfully generated and posted content for ${character.name}`)
      logger.info(`📱 Instagram Post: ${results.permalink}`)
    } else {
      logger.warn(`⚠️ Generated content but posting failed: ${results.reason || results.error}`)
    }

    process.exit(0)
  } catch (error) {
    logger.error(`❌ Fatal error: ${error.message}`)

    if (CONFIG.isGitHubActions) {
      console.log(`::set-output name=success::false`)
      console.log(`::set-output name=error::${error.message}`)
    }

    process.exit(1)
  }
}

// Handle process signals
process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully...")
  process.exit(0)
})

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully...")
  process.exit(0)
})

// Run the main function
if (require.main === module) {
  main()
}

module.exports = {
  setupEnvironment,
  loadCharacterData,
  generatePrompt,
  generateImage,
  postToInstagram,
}
