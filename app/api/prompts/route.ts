import { type NextRequest, NextResponse } from "next/server"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

interface PromptTemplate {
  id: string
  name: string
  category: "portrait" | "lifestyle" | "artistic" | "fantasy" | "realistic"
  template: string
  variables: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
  usageCount: number
}

interface GeneratedPrompt {
  id: string
  characterId: string
  characterName: string
  prompt: string
  caption: string
  templateId?: string
  style?: string
  mood?: string
  setting?: string
  createdAt: string
  used: boolean
  usedAt?: string
  imageGenerated: boolean
  posted: boolean
}

const PROMPTS_FILE = join(process.cwd(), "data", "generated-prompts.json")
const TEMPLATES_FILE = join(process.cwd(), "data", "prompt-templates.json")

// Default prompt templates
const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "portrait-classic",
    name: "Classic Portrait",
    category: "portrait",
    template:
      "{character}, {personality} expression, {style} portrait, {lighting}, high quality, detailed face, consistent character",
    variables: ["character", "personality", "style", "lighting"],
    tags: ["portrait", "classic", "professional"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "lifestyle-casual",
    name: "Casual Lifestyle",
    category: "lifestyle",
    template:
      "{character}, {personality} character, {activity}, {setting}, natural lighting, candid moment, {style} photography",
    variables: ["character", "personality", "activity", "setting", "style"],
    tags: ["lifestyle", "casual", "natural"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "artistic-creative",
    name: "Artistic Creative",
    category: "artistic",
    template:
      "{character}, {personality} mood, {artistic_style}, {composition}, creative lighting, artistic interpretation, {medium} style",
    variables: ["character", "personality", "artistic_style", "composition", "medium"],
    tags: ["artistic", "creative", "experimental"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "fantasy-magical",
    name: "Fantasy Magical",
    category: "fantasy",
    template:
      "{character}, {personality} character, {magical_element}, {fantasy_setting}, ethereal lighting, mystical atmosphere, fantasy art style",
    variables: ["character", "personality", "magical_element", "fantasy_setting"],
    tags: ["fantasy", "magical", "ethereal"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "realistic-photographic",
    name: "Realistic Photography",
    category: "realistic",
    template:
      "{character}, {personality} expression, {photo_style}, {camera_angle}, professional photography, {lighting_type}, sharp focus, 8k resolution",
    variables: ["character", "personality", "photo_style", "camera_angle", "lighting_type"],
    tags: ["realistic", "photography", "professional"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
]

async function ensureDataDirectory() {
  const dataDir = join(process.cwd(), "data")
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true })
  }
}

async function loadPrompts(): Promise<GeneratedPrompt[]> {
  try {
    const data = await readFile(PROMPTS_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function savePrompts(prompts: GeneratedPrompt[]) {
  await ensureDataDirectory()
  await writeFile(PROMPTS_FILE, JSON.stringify(prompts, null, 2))
}

async function loadTemplates(): Promise<PromptTemplate[]> {
  try {
    const data = await readFile(TEMPLATES_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    // Return default templates if file doesn't exist
    await saveTemplates(DEFAULT_TEMPLATES)
    return DEFAULT_TEMPLATES
  }
}

async function saveTemplates(templates: PromptTemplate[]) {
  await ensureDataDirectory()
  await writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2))
}

async function loadCharacters() {
  try {
    const data = await readFile(join(process.cwd(), "data", "characters.json"), "utf-8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") // "prompts" or "templates"
    const characterId = searchParams.get("characterId")
    const category = searchParams.get("category")
    const used = searchParams.get("used")

    if (type === "templates") {
      let templates = await loadTemplates()

      if (category) {
        templates = templates.filter((t) => t.category === category)
      }

      return NextResponse.json({
        templates,
        categories: ["portrait", "lifestyle", "artistic", "fantasy", "realistic"],
        summary: {
          total: templates.length,
          byCategory: {
            portrait: templates.filter((t) => t.category === "portrait").length,
            lifestyle: templates.filter((t) => t.category === "lifestyle").length,
            artistic: templates.filter((t) => t.category === "artistic").length,
            fantasy: templates.filter((t) => t.category === "fantasy").length,
            realistic: templates.filter((t) => t.category === "realistic").length,
          },
        },
      })
    }

    // Default: return generated prompts
    let prompts = await loadPrompts()
    const characters = await loadCharacters()

    // Enrich prompts with character names and other details
    prompts = prompts.map((prompt) => {
      const character = characters.find((c: any) => c.id === prompt.characterId)
      return {
        ...prompt,
        characterName: character?.name || "Unknown",
        characterBackstory: character?.backstory || "",
        characterAvatar: character?.avatarUrl || null, // Assuming an avatarUrl property
      }
    })

    // Filter by character
    if (characterId) {
      prompts = prompts.filter((p) => p.characterId === characterId)
    }

    // Filter by used status
    if (used !== null) {
      const isUsed = used === "true"
      prompts = prompts.filter((p) => p.used === isUsed)
    }

    // Sort by creation date (newest first)
    prompts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      prompts,
      summary: {
        total: prompts.length,
        used: prompts.filter((p) => p.used).length,
        unused: prompts.filter((p) => !p.used).length,
        withImages: prompts.filter((p) => p.imageGenerated).length,
        posted: prompts.filter((p) => p.posted).length,
      },
    })
  } catch (error) {
    console.error("Failed to get prompts:", error)
    return NextResponse.json({ error: "Failed to get prompts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case "generate":
        return await generatePrompt(body)
      case "save_template":
        return await saveTemplate(body.template)
      case "delete_template":
        return await deleteTemplate(body.templateId)
      case "use_prompt":
        return await markPromptAsUsed(body.promptId)
      case "delete_prompt":
        return await deletePrompt(body.promptId)
      case "bulk_generate":
        return await bulkGeneratePrompts(body)
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Prompt operation failed:", error)
    return NextResponse.json(
      {
        error: "Prompt operation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function generatePrompt(data: any) {
  const { characterId, templateId, customVariables, style, mood, setting } = data

  if (!characterId) {
    throw new Error("Character ID is required")
  }

  // Load character data
  const characters = await loadCharacters()
  const character = characters.find((c: any) => c.id === characterId)
  if (!character) {
    throw new Error("Character not found")
  }

  let prompt = ""
  let caption = ""
  const usedTemplateId = templateId

  if (templateId) {
    // Use specific template
    const templates = await loadTemplates()
    const template = templates.find((t) => t.id === templateId)
    if (!template) {
      throw new Error("Template not found")
    }

    prompt = generateFromTemplate(template, character, customVariables)
    template.usageCount++
    await saveTemplates(templates)
  } else {
    // Generate using AI or fallback
    const generateResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/prompts/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          character,
          style,
          mood,
          setting,
        }),
      },
    )

    if (generateResponse.ok) {
      const result = await generateResponse.json()
      prompt = result.prompt
      caption = result.caption
    } else {
      throw new Error("Failed to generate prompt")
    }
  }

  // Save generated prompt
  const prompts = await loadPrompts()
  const newPrompt: GeneratedPrompt = {
    id: `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    characterId,
    characterName: character.name,
    prompt,
    caption,
    templateId: usedTemplateId,
    style,
    mood,
    setting,
    createdAt: new Date().toISOString(),
    used: false,
    imageGenerated: false,
    posted: false,
  }

  prompts.push(newPrompt)
  await savePrompts(prompts)

  return NextResponse.json({
    success: true,
    prompt: newPrompt,
    message: "Prompt generated successfully",
  })
}

function generateFromTemplate(template: PromptTemplate, character: any, customVariables: Record<string, string> = {}) {
  let prompt = template.template

  // Default variable values
  const defaultValues: Record<string, string[]> = {
    character: [character.name],
    personality: [character.personality],
    style: ["cinematic", "artistic", "professional", "dramatic", "ethereal"],
    lighting: ["golden hour", "soft natural light", "dramatic shadows", "warm ambient light"],
    activity: ["reading", "walking", "thinking", "exploring", "creating"],
    setting: ["urban landscape", "natural environment", "cozy interior", "modern studio"],
    artistic_style: ["impressionist", "surreal", "minimalist", "abstract", "contemporary"],
    composition: ["close-up", "medium shot", "wide angle", "dynamic angle"],
    medium: ["oil painting", "watercolor", "digital art", "photography"],
    magical_element: ["glowing aura", "floating objects", "mystical energy", "enchanted atmosphere"],
    fantasy_setting: ["enchanted forest", "crystal cave", "floating island", "magical library"],
    photo_style: ["portrait", "environmental", "fashion", "documentary"],
    camera_angle: ["eye level", "low angle", "high angle", "dutch angle"],
    lighting_type: ["natural light", "studio lighting", "golden hour", "blue hour"],
  }

  // Replace variables in template
  for (const variable of template.variables) {
    const placeholder = `{${variable}}`

    if (customVariables[variable]) {
      prompt = prompt.replace(placeholder, customVariables[variable])
    } else if (defaultValues[variable]) {
      const options = defaultValues[variable]
      const randomValue = options[Math.floor(Math.random() * options.length)]
      prompt = prompt.replace(placeholder, randomValue)
    } else {
      // Remove placeholder if no value available
      prompt = prompt.replace(placeholder, "")
    }
  }

  // Clean up extra spaces and commas
  prompt = prompt.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim()

  return prompt
}

async function saveTemplate(templateData: Partial<PromptTemplate>) {
  const templates = await loadTemplates()

  if (!templateData.name || !templateData.template) {
    throw new Error("Template name and template text are required")
  }

  const newTemplate: PromptTemplate = {
    id: templateData.id || `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: templateData.name,
    category: templateData.category || "portrait",
    template: templateData.template,
    variables: extractVariables(templateData.template),
    tags: templateData.tags || [],
    createdAt: templateData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: templateData.usageCount || 0,
  }

  // Update existing or add new
  const existingIndex = templates.findIndex((t) => t.id === newTemplate.id)
  if (existingIndex >= 0) {
    templates[existingIndex] = newTemplate
  } else {
    templates.push(newTemplate)
  }

  await saveTemplates(templates)

  return NextResponse.json({
    success: true,
    template: newTemplate,
    message: "Template saved successfully",
  })
}

function extractVariables(template: string): string[] {
  const matches = template.match(/\{([^}]+)\}/g)
  if (!matches) return []

  return matches.map((match) => match.slice(1, -1)).filter((value, index, self) => self.indexOf(value) === index)
}

async function deleteTemplate(templateId: string) {
  const templates = await loadTemplates()
  const filteredTemplates = templates.filter((t) => t.id !== templateId)

  if (filteredTemplates.length === templates.length) {
    throw new Error("Template not found")
  }

  await saveTemplates(filteredTemplates)

  return NextResponse.json({
    success: true,
    message: "Template deleted successfully",
  })
}

async function markPromptAsUsed(promptId: string) {
  const prompts = await loadPrompts()
  const prompt = prompts.find((p) => p.id === promptId)

  if (!prompt) {
    throw new Error("Prompt not found")
  }

  prompt.used = true
  prompt.usedAt = new Date().toISOString()
  await savePrompts(prompts)

  return NextResponse.json({
    success: true,
    prompt,
    message: "Prompt marked as used",
  })
}

async function deletePrompt(promptId: string) {
  const prompts = await loadPrompts()
  const filteredPrompts = prompts.filter((p) => p.id !== promptId)

  if (filteredPrompts.length === prompts.length) {
    throw new Error("Prompt not found")
  }

  await savePrompts(filteredPrompts)

  return NextResponse.json({
    success: true,
    message: "Prompt deleted successfully",
  })
}

async function bulkGeneratePrompts(data: any) {
  const { characterIds, count = 5, templateIds, styles, moods } = data

  if (!characterIds || characterIds.length === 0) {
    throw new Error("At least one character ID is required")
  }

  const characters = await loadCharacters()
  const results = []

  for (const characterId of characterIds) {
    const character = characters.find((c: any) => c.id === characterId)
    if (!character) continue

    for (let i = 0; i < count; i++) {
      try {
        const templateId =
          templateIds && templateIds.length > 0
            ? templateIds[Math.floor(Math.random() * templateIds.length)]
            : undefined

        const style = styles && styles.length > 0 ? styles[Math.floor(Math.random() * styles.length)] : undefined

        const mood = moods && moods.length > 0 ? moods[Math.floor(Math.random() * moods.length)] : undefined

        const result = await generatePrompt({
          characterId,
          templateId,
          style,
          mood,
        })

        results.push({ characterId, success: true, prompt: result })
      } catch (error) {
        results.push({
          characterId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    results,
    summary: {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
    message: `Generated ${results.filter((r) => r.success).length} prompts`,
  })
}
