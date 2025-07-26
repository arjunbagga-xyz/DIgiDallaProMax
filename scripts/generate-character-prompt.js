// Generate contextual prompts using Gemini for specific characters
const { GoogleGenerativeAI } = require("@google/generative-ai")
const fs = require("fs").promises
const path = require("path")

// Character configurations
const CHARACTERS = {
  emma: {
    name: "Emma",
    backstory: "Travel blogger exploring hidden gems around the world",
    personality: ["adventurous", "curious", "authentic", "mindful", "optimistic"],
    narrative: [
      "Started as a city dweller who felt trapped in routine",
      "Discovered passion for travel through a spontaneous weekend trip",
      "Now documents authentic local experiences and hidden spots",
      "Focuses on sustainable and mindful travel practices",
    ],
    currentArc: "Exploring mountain regions and connecting with local communities",
    visualStyle: "Natural lighting, outdoor settings, candid moments, earth tones",
  },
  maya: {
    name: "Maya",
    backstory: "Digital artist and creative mentor inspiring others",
    personality: ["creative", "inspiring", "thoughtful", "passionate", "supportive"],
    narrative: [
      "Self-taught digital artist who started during pandemic",
      "Built online community around accessible art education",
      "Now mentors emerging artists and creates educational content",
      "Advocates for mental health through creative expression",
    ],
    currentArc: "Launching collaborative art projects with her community",
    visualStyle: "Warm studio lighting, artistic environments, creative tools, vibrant colors",
  },
  alex: {
    name: "Alex",
    backstory: "Urban photographer and coffee enthusiast",
    personality: ["observant", "contemplative", "urban", "artistic", "social"],
    narrative: [
      "Street photographer documenting city life and culture",
      "Coffee shop regular who finds inspiration in daily routines",
      "Captures the beauty in ordinary urban moments",
      "Building connections between communities through visual storytelling",
    ],
    currentArc: "Documenting the changing seasons in the city",
    visualStyle: "Urban settings, golden hour, street photography, coffee culture, city life",
  },
}

async function generatePrompt() {
  try {
    const characterName = process.env.CHARACTER_NAME?.toLowerCase()
    if (!characterName || !CHARACTERS[characterName]) {
      throw new Error(`Invalid character: ${characterName}`)
    }

    const character = CHARACTERS[characterName]
    console.log(`🎯 Generating prompt for ${character.name}`)

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })

    // Load recent posts for context
    const recentPosts = await loadRecentPosts(characterName)

    // Create contextual prompt
    const systemPrompt = `You are an AI assistant generating creative image prompts for ${character.name}, a ${character.backstory}.

Character Profile:
- Personality: ${character.personality.join(", ")}
- Current Story Arc: ${character.currentArc}
- Visual Style: ${character.visualStyle}
- Narrative Background: ${character.narrative.join(" → ")}

Recent Posts Context (to avoid repetition):
${recentPosts.map((post, i) => `${i + 1}. ${post.prompt}`).join("\n")}

Current Season: ${getCurrentSeason()}
Time of Day: ${getTimeContext()}
Trending Topics: ${getTrendingTopics()}

Generate a detailed image prompt that:
1. Continues ${character.name}'s story naturally
2. Reflects their personality and current arc
3. Avoids repeating recent scenarios
4. Incorporates seasonal/temporal relevance
5. Maintains visual consistency with their style
6. Includes specific details (lighting, mood, setting, expression)
7. Ends with "detailed face, consistent character, high quality"

The prompt should be 60-80 words and feel authentic to ${character.name}'s journey.

Generate only the image prompt:`

    const result = await model.generateContent(systemPrompt)
    const imagePrompt = result.response.text().trim()

    // Generate Instagram caption
    const captionPrompt = `Based on this image scenario: "${imagePrompt}"

Generate a natural Instagram caption for ${character.name} that:
1. Reflects their personality (${character.personality.join(", ")})
2. Continues their narrative naturally
3. Feels authentic and personal
4. Includes 2-3 relevant hashtags
5. Is 1-2 sentences, conversational tone
6. Connects to their current story arc: ${character.currentArc}

Generate only the caption:`

    const captionResult = await model.generateContent(captionPrompt)
    const instagramCaption = captionResult.response.text().trim()

    // Generate narrative update
    const narrativePrompt = `Based on this new post: "${imagePrompt}"

What would be the next logical development in ${character.name}'s ongoing story (${character.currentArc})?

Provide a single sentence that could be added to their narrative progression, maintaining story continuity.

Generate only the narrative update:`

    const narrativeResult = await model.generateContent(narrativePrompt)
    const narrativeUpdate = narrativeResult.response.text().trim()

    // Save generated content
    const output = {
      character: character.name,
      timestamp: new Date().toISOString(),
      imagePrompt: `${imagePrompt}, <lora:${process.env.CHARACTER_LORA}:0.8>`,
      instagramCaption,
      narrativeUpdate,
      context: {
        season: getCurrentSeason(),
        timeContext: getTimeContext(),
        postsConsidered: recentPosts.length,
      },
    }

    // Save to file
    await fs.mkdir(`generated-prompts/${characterName}`, { recursive: true })
    const filename = `prompt-${Date.now()}.json`
    await fs.writeFile(`generated-prompts/${characterName}/${filename}`, JSON.stringify(output, null, 2))

    // Save as environment variables for next steps
    console.log("Generated prompt:", output.imagePrompt)
    console.log("Generated caption:", output.instagramCaption)

    // Export for GitHub Actions
    await fs.appendFile(process.env.GITHUB_ENV, `IMAGE_PROMPT=${output.imagePrompt}\n`)
    await fs.appendFile(process.env.GITHUB_ENV, `INSTAGRAM_CAPTION=${output.instagramCaption}\n`)
    await fs.appendFile(process.env.GITHUB_ENV, `NARRATIVE_UPDATE=${output.narrativeUpdate}\n`)

    console.log("✅ Prompt generation completed successfully")
  } catch (error) {
    console.error("❌ Error generating prompt:", error)
    process.exit(1)
  }
}

async function loadRecentPosts(characterName) {
  try {
    const postsDir = `generated-prompts/${characterName}`
    const files = await fs.readdir(postsDir)

    const recentFiles = files
      .filter((file) => file.startsWith("prompt-") && file.endsWith(".json"))
      .sort()
      .slice(-5) // Last 5 posts

    const posts = []
    for (const file of recentFiles) {
      const content = await fs.readFile(path.join(postsDir, file), "utf-8")
      const post = JSON.parse(content)
      posts.push(post)
    }

    return posts
  } catch (error) {
    console.log("No recent posts found, starting fresh")
    return []
  }
}

function getCurrentSeason() {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return "Spring"
  if (month >= 5 && month <= 7) return "Summer"
  if (month >= 8 && month <= 10) return "Fall"
  return "Winter"
}

function getTimeContext() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return "Morning"
  if (hour >= 12 && hour < 17) return "Afternoon"
  if (hour >= 17 && hour < 21) return "Evening"
  return "Night"
}

function getTrendingTopics() {
  // In a real implementation, you might fetch from social media APIs
  const topics = {
    Spring: ["spring cleaning", "blooming flowers", "outdoor activities", "fresh starts"],
    Summer: ["beach days", "festivals", "travel", "outdoor dining"],
    Fall: ["autumn colors", "cozy vibes", "harvest season", "back to school"],
    Winter: ["holiday season", "cozy indoors", "winter sports", "new year goals"],
  }

  const season = getCurrentSeason()
  return topics[season].join(", ")
}

// Run the prompt generation
generatePrompt()
