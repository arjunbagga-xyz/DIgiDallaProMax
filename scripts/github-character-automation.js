#!/usr/bin/env node

/**
 * GitHub Character-Specific Automation
 * Handles character-specific automation in GitHub Actions
 */

const fs = require("fs").promises
const path = require("path")

// Import the main automation functions
const {
  setupEnvironment,
  loadCharacterData,
  generatePrompt,
  generateImage,
  postToInstagram,
} = require("./github-actions-automation")

// Character-specific configuration
const CHARACTERS = {
  luna: {
    name: "Luna",
    instagramToken: process.env.LUNA_INSTAGRAM_ACCESS_TOKEN,
    instagramAccount: process.env.LUNA_INSTAGRAM_ACCOUNT_ID,
    style: "mystical",
    mood: "ethereal",
    themes: ["moon", "stars", "dreams", "magic", "cosmic"],
  },
  alex: {
    name: "Alex",
    instagramToken: process.env.ALEX_INSTAGRAM_ACCESS_TOKEN,
    instagramAccount: process.env.ALEX_INSTAGRAM_ACCOUNT_ID,
    style: "futuristic",
    mood: "dynamic",
    themes: ["technology", "digital", "innovation", "cyber", "neon"],
  },
  sage: {
    name: "Sage",
    instagramToken: process.env.SAGE_INSTAGRAM_ACCESS_TOKEN,
    instagramAccount: process.env.SAGE_INSTAGRAM_ACCOUNT_ID,
    style: "natural",
    mood: "contemplative",
    themes: ["nature", "wisdom", "philosophy", "earth", "zen"],
  },
}

const CONFIG = {
  characterName: process.env.CHARACTER_NAME?.toLowerCase(),
  isGitHubActions: process.env.GITHUB_ACTIONS === "true",
  runId: process.env.GITHUB_RUN_ID,
  workspace: process.env.GITHUB_WORKSPACE || process.cwd(),
}

// Enhanced logging
const logger = {
  info: (msg) => {
    console.log(`[${CONFIG.characterName?.toUpperCase()}] ${msg}`)
    if (CONFIG.isGitHubActions) {
      console.log(`::notice title=${CONFIG.characterName}::${msg}`)
    }
  },
  warn: (msg) => {
    console.warn(`[${CONFIG.characterName?.toUpperCase()}] ${msg}`)
    if (CONFIG.isGitHubActions) {
      console.log(`::warning title=${CONFIG.characterName}::${msg}`)
    }
  },
  error: (msg) => {
    console.error(`[${CONFIG.characterName?.toUpperCase()}] ${msg}`)
    if (CONFIG.isGitHubActions) {
      console.log(`::error title=${CONFIG.characterName}::${msg}`)
    }
  },
}

async function getCharacterConfig() {
  const characterKey = CONFIG.characterName

  if (!characterKey || !CHARACTERS[characterKey]) {
    throw new Error(`Unknown character: ${characterKey}. Available: ${Object.keys(CHARACTERS).join(", ")}`)
  }

  const config = CHARACTERS[characterKey]

  // Validate Instagram credentials
  if (!config.instagramToken || !config.instagramAccount) {
    logger.warn(`Instagram credentials not configured for ${config.name}`)
  }

  return config
}

async function generateCharacterSpecificPrompt(character, characterConfig) {
  logger.info(`Generating ${characterConfig.style} prompt for ${character.name}...`)

  const themes = characterConfig.themes.join(", ")
  const systemPrompt = `You are an expert AI art prompt generator specializing in ${characterConfig.style} ${characterConfig.mood} imagery.

Character: ${character.name}
Personality: ${character.personality}
Backstory: ${character.backstory}
Style: ${characterConfig.style}
Mood: ${characterConfig.mood}
Themes: ${themes}

Create a detailed, visually compelling prompt that:
1. Features ${character.name} as the main subject
2. Incorporates ${characterConfig.style} visual elements
3. Conveys a ${characterConfig.mood} atmosphere
4. Includes themes related to: ${themes}
5. Specifies high-quality artistic details

Keep it 50-150 words, focusing on visual composition, lighting, and artistic style.`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

    logger.info(`Generated ${characterConfig.style} prompt: ${prompt.substring(0, 80)}...`)
    return prompt
  } catch (error) {
    logger.error(`Character-specific prompt generation failed: ${error.message}`)

    // Character-specific fallback prompts
    const fallbackPrompts = {
      luna: `Luna, mystical moon goddess, ethereal portrait, glowing lunar energy, starlit background, dreamy atmosphere, soft celestial lighting, high quality, detailed, magical realism`,
      alex: `Alex, futuristic digital artist, cyberpunk portrait, neon lighting, holographic elements, tech-inspired background, dynamic composition, high-tech aesthetic, professional photography`,
      sage: `Sage, wise contemplative figure, natural portrait, earth tones, philosophical atmosphere, organic textures, warm natural lighting, serene composition, artistic photography`,
    }

    const fallback =
      fallbackPrompts[CONFIG.characterName] ||
      `${character.name}, artistic portrait, high quality, professional photography`
    logger.warn(`Using fallback prompt: ${fallback}`)
    return fallback
  }
}

async function createCharacterCaption(prompt, character, characterConfig) {
  logger.info(`Creating ${character.name}-specific caption...`)

  const captionPrompt = `Create an engaging Instagram caption for ${character.name}:

Character: ${character.name} (${character.personality})
Image: ${prompt}
Style: ${characterConfig.style}
Themes: ${characterConfig.themes.join(", ")}

Requirements:
- Reflect ${character.name}'s personality
- Include ${characterConfig.style} aesthetic
- Add relevant hashtags for ${characterConfig.themes.join(", ")}
- Keep under 150 characters
- Make it engaging and authentic to the character

Generate only the caption text.`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
      logger.info(`Generated character caption: ${caption.substring(0, 50)}...`)
      return caption
    }
  } catch (error) {
    logger.warn(`Character caption generation failed: ${error.message}`)
  }

  // Character-specific fallback captions
  const fallbackCaptions = {
    luna: `${prompt} ✨\n\nExploring cosmic mysteries and lunar dreams\n\n#Luna #MysticalArt #MoonGoddess #CosmicArt #AIArt`,
    alex: `${prompt} 🚀\n\nBridging technology and creativity\n\n#Alex #DigitalArt #FuturisticArt #TechArt #CyberArt #AIArt`,
    sage: `${prompt} 🌿\n\nFinding wisdom in nature's beauty\n\n#Sage #NatureArt #Philosophy #WisdomArt #EarthArt #AIArt`,
  }

  const fallback =
    fallbackCaptions[CONFIG.characterName] || `${prompt} ✨\n\n#${character.name} #AIArt #GeneratedContent`
  logger.info("Using character-specific fallback caption")
  return fallback
}

async function postToCharacterInstagram(imageBase64, caption, character, characterConfig) {
  logger.info(`Posting to ${character.name}'s Instagram account...`)

  if (!characterConfig.instagramToken || !characterConfig.instagramAccount) {
    logger.warn(`Instagram not configured for ${character.name}`)
    return { posted: false, reason: "Instagram credentials not configured" }
  }

  try {
    // Set character-specific Instagram credentials
    process.env.INSTAGRAM_ACCESS_TOKEN = characterConfig.instagramToken
    process.env.INSTAGRAM_ACCOUNT_ID = characterConfig.instagramAccount

    // Use the main Instagram posting function
    const result = await postToInstagram(imageBase64, caption, character)

    if (result.posted) {
      logger.info(`✅ Successfully posted to ${character.name}'s Instagram: ${result.postId}`)
    } else {
      logger.warn(`⚠️ Failed to post to ${character.name}'s Instagram: ${result.reason || result.error}`)
    }

    return result
  } catch (error) {
    logger.error(`Instagram posting failed for ${character.name}: ${error.message}`)
    return { posted: false, error: error.message }
  }
}

async function saveCharacterMetrics(character, results, characterConfig) {
  logger.info(`Saving metrics for ${character.name}...`)

  try {
    const metricsPath = path.join(CONFIG.workspace, "temp", `metrics-${character.id}-${Date.now()}.json`)

    const metrics = {
      characterId: character.id,
      characterName: character.name,
      runId: CONFIG.runId,
      timestamp: new Date().toISOString(),
      characterConfig: {
        style: characterConfig.style,
        mood: characterConfig.mood,
        themes: characterConfig.themes,
      },
      results: {
        generated: results.generated,
        posted: results.posted,
        prompt: results.prompt,
        caption: results.caption,
        postId: results.postId,
        permalink: results.permalink,
      },
      success: results.generated && results.posted,
    }

    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2))
    logger.info(`Metrics saved for ${character.name}`)

    return metrics
  } catch (error) {
    logger.warn(`Failed to save metrics for ${character.name}: ${error.message}`)
  }
}

async function main() {
  logger.info(`🎭 Starting character-specific automation for ${CONFIG.characterName}`)

  try {
    // Get character configuration
    const characterConfig = await getCharacterConfig()
    logger.info(`Loaded configuration for ${characterConfig.name}`)

    // Setup environment
    await setupEnvironment()

    // Load character data
    const character = await loadCharacterData()

    // Generate character-specific content
    const prompt = await generateCharacterSpecificPrompt(character, characterConfig)
    const imageResult = await generateImage(prompt, character)
    const caption = await createCharacterCaption(prompt, character, characterConfig)

    // Post to character's Instagram
    const postResult = await postToCharacterInstagram(imageResult.imageBase64, caption, character, characterConfig)

    // Compile results
    const results = {
      characterId: character.id,
      characterName: character.name,
      generated: true,
      prompt,
      caption,
      ...postResult,
    }

    // Save character-specific metrics
    await saveCharacterMetrics(character, results, characterConfig)

    // Set GitHub Actions outputs
    if (CONFIG.isGitHubActions) {
      console.log(`::set-output name=character::${character.name}`)
      console.log(`::set-output name=success::${results.generated && results.posted}`)
      console.log(`::set-output name=posted::${results.posted}`)
      console.log(`::set-output name=style::${characterConfig.style}`)
      if (results.postId) {
        console.log(`::set-output name=post_id::${results.postId}`)
        console.log(`::set-output name=permalink::${results.permalink}`)
      }
    }

    // Final status
    if (results.posted) {
      logger.info(`✅ Successfully completed automation for ${character.name}`)
      logger.info(`🎨 Style: ${characterConfig.style} | Mood: ${characterConfig.mood}`)
      logger.info(`📱 Posted: ${results.permalink}`)
    } else {
      logger.warn(`⚠️ Generated content but posting failed for ${character.name}`)
      logger.warn(`Reason: ${results.reason || results.error}`)
    }

    process.exit(results.posted ? 0 : 1)
  } catch (error) {
    logger.error(`❌ Fatal error in ${CONFIG.characterName} automation: ${error.message}`)

    if (CONFIG.isGitHubActions) {
      console.log(`::set-output name=success::false`)
      console.log(`::set-output name=error::${error.message}`)
      console.log(`::set-output name=character::${CONFIG.characterName}`)
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
  getCharacterConfig,
  generateCharacterSpecificPrompt,
  createCharacterCaption,
  postToCharacterInstagram,
  CHARACTERS,
}
