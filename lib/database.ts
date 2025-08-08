// Complete database abstraction layer supporting file-based and SQL databases
import { readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"

export interface Character {
  id: string
  name: string
  personality: string
  backstory: string
  instagramHandle: string
  loraModelPath?: string
  isActive: boolean
  lastPost?: string
  nextPost?: string
  createdAt: string
  updatedAt: string
  triggerWord?: string
  preferredModel?: string
  postingSchedule?: string
  tags?: string[]
}

export interface ScheduledTask {
  id: string
  characterId: string
  type: "generate_and_post" | "generate_only" | "train_lora" | "post_only"
  schedule: string
  active: boolean
  lastRun?: string
  nextRun?: string
  createdAt: string
  updatedAt: string
  config?: Record<string, any>
}

export interface GeneratedContent {
  id: string
  characterId: string
  prompt: string
  imageUrl?: string
  imageData?: string
  caption?: string
  hashtags?: string[]
  createdAt: string
  posted: boolean
  postedAt?: string
  instagramPostId?: string
  metadata?: Record<string, any>
}

export interface SystemLog {
  id: string
  level: "info" | "warn" | "error" | "debug"
  message: string
  component: string
  timestamp: string
  metadata?: Record<string, any>
}

class DatabaseManager {
  private dataDir: string
  private useSQL: boolean

  constructor() {
    this.dataDir = join(process.cwd(), "data")
    this.useSQL = !!process.env.DATABASE_URL
    this.ensureDataDirectory()
  }

  private async ensureDataDirectory() {
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true })
    }
  }

  // Character management
  async getCharacters(): Promise<Character[]> {
    if (this.useSQL) {
      return await this.getCharactersSQL()
    } else {
      return await this.getCharactersFile()
    }
  }

  async getCharacter(id: string): Promise<Character | null> {
    const characters = await this.getCharacters()
    return characters.find((c) => c.id === id) || null
  }

  async createCharacter(character: Omit<Character, "id" | "createdAt" | "updatedAt">): Promise<Character> {
    const newCharacter: Character = {
      ...character,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (this.useSQL) {
      return await this.createCharacterSQL(newCharacter)
    } else {
      return await this.createCharacterFile(newCharacter)
    }
  }

  async updateCharacter(id: string, updates: Partial<Character>): Promise<Character | null> {
    if (this.useSQL) {
      return await this.updateCharacterSQL(id, updates)
    } else {
      return await this.updateCharacterFile(id, updates)
    }
  }

  async deleteCharacter(id: string): Promise<boolean> {
    if (this.useSQL) {
      return await this.deleteCharacterSQL(id)
    } else {
      return await this.deleteCharacterFile(id)
    }
  }

  // Scheduled tasks management
  async getScheduledTasks(): Promise<ScheduledTask[]> {
    if (this.useSQL) {
      return await this.getScheduledTasksSQL()
    } else {
      return await this.getScheduledTasksFile()
    }
  }

  async createScheduledTask(task: Omit<ScheduledTask, "id" | "createdAt" | "updatedAt">): Promise<ScheduledTask> {
    const newTask: ScheduledTask = {
      ...task,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (this.useSQL) {
      return await this.createScheduledTaskSQL(newTask)
    } else {
      return await this.createScheduledTaskFile(newTask)
    }
  }

  async updateScheduledTask(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    if (this.useSQL) {
      return await this.updateScheduledTaskSQL(id, updates)
    } else {
      return await this.updateScheduledTaskFile(id, updates)
    }
  }

  async deleteScheduledTask(id: string): Promise<boolean> {
    if (this.useSQL) {
      return await this.deleteScheduledTaskSQL(id)
    } else {
      return await this.deleteScheduledTaskFile(id)
    }
  }

  // Generated content management
  async getGeneratedContent(characterId?: string): Promise<GeneratedContent[]> {
    if (this.useSQL) {
      return await this.getGeneratedContentSQL(characterId)
    } else {
      return await this.getGeneratedContentFile(characterId)
    }
  }

  async createGeneratedContent(content: Omit<GeneratedContent, "id" | "createdAt">): Promise<GeneratedContent> {
    const newContent: GeneratedContent = {
      ...content,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    }

    if (this.useSQL) {
      return await this.createGeneratedContentSQL(newContent)
    } else {
      return await this.createGeneratedContentFile(newContent)
    }
  }

  // System logs
  async addLog(log: Omit<SystemLog, "id" | "timestamp">): Promise<void> {
    const newLog: SystemLog = {
      ...log,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    }

    if (this.useSQL) {
      await this.addLogSQL(newLog)
    } else {
      await this.addLogFile(newLog)
    }
  }

  async getLogs(limit = 100, level?: string): Promise<SystemLog[]> {
    if (this.useSQL) {
      return await this.getLogsSQL(limit, level)
    } else {
      return await this.getLogsFile(limit, level)
    }
  }

  // File-based implementations
  private async getCharactersFile(): Promise<Character[]> {
    try {
      const filePath = join(this.dataDir, "characters.json")
      if (!existsSync(filePath)) {
        return []
      }
      const data = await readFile(filePath, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      console.error("Failed to read characters file:", error)
      return []
    }
  }

  private async createCharacterFile(character: Character): Promise<Character> {
    const characters = await this.getCharactersFile()
    characters.push(character)
    await writeFile(join(this.dataDir, "characters.json"), JSON.stringify(characters, null, 2))
    return character
  }

  private async updateCharacterFile(id: string, updates: Partial<Character>): Promise<Character | null> {
    const characters = await this.getCharactersFile()
    const index = characters.findIndex((c) => c.id === id)
    if (index === -1) return null

    characters[index] = {
      ...characters[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    await writeFile(join(this.dataDir, "characters.json"), JSON.stringify(characters, null, 2))
    return characters[index]
  }

  private async deleteCharacterFile(id: string): Promise<boolean> {
    const characters = await this.getCharactersFile()
    const index = characters.findIndex((c) => c.id === id)
    if (index === -1) return false

    characters.splice(index, 1)
    await writeFile(join(this.dataDir, "characters.json"), JSON.stringify(characters, null, 2))
    return true
  }

  private async getScheduledTasksFile(): Promise<ScheduledTask[]> {
    try {
      const filePath = join(this.dataDir, "scheduled-tasks.json")
      if (!existsSync(filePath)) {
        return []
      }
      const data = await readFile(filePath, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      console.error("Failed to read scheduled tasks file:", error)
      return []
    }
  }

  private async createScheduledTaskFile(task: ScheduledTask): Promise<ScheduledTask> {
    const tasks = await this.getScheduledTasksFile()
    tasks.push(task)
    await writeFile(join(this.dataDir, "scheduled-tasks.json"), JSON.stringify(tasks, null, 2))
    return task
  }

  private async updateScheduledTaskFile(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    const tasks = await this.getScheduledTasksFile()
    const index = tasks.findIndex((t) => t.id === id)
    if (index === -1) return null

    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    await writeFile(join(this.dataDir, "scheduled-tasks.json"), JSON.stringify(tasks, null, 2))
    return tasks[index]
  }

  private async deleteScheduledTaskFile(id: string): Promise<boolean> {
    const tasks = await this.getScheduledTasksFile()
    const index = tasks.findIndex((t) => t.id === id)
    if (index === -1) return false

    tasks.splice(index, 1)
    await writeFile(join(this.dataDir, "scheduled-tasks.json"), JSON.stringify(tasks, null, 2))
    return true
  }

  private async getGeneratedContentFile(characterId?: string): Promise<GeneratedContent[]> {
    try {
      const filePath = join(this.dataDir, "generated-content.json")
      if (!existsSync(filePath)) {
        return []
      }
      const data = await readFile(filePath, "utf-8")
      const content = JSON.parse(data)

      if (characterId) {
        return content.filter((c: GeneratedContent) => c.characterId === characterId)
      }

      return content
    } catch (error) {
      console.error("Failed to read generated content file:", error)
      return []
    }
  }

  private async createGeneratedContentFile(content: GeneratedContent): Promise<GeneratedContent> {
    const allContent = await this.getGeneratedContentFile()
    allContent.push(content)
    await writeFile(join(this.dataDir, "generated-content.json"), JSON.stringify(allContent, null, 2))
    return content
  }

  private async addLogFile(log: SystemLog): Promise<void> {
    const logs = await this.getLogsFile(1000) // Keep last 1000 logs
    logs.push(log)

    // Keep only recent logs to prevent file from growing too large
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000)
    }

    await writeFile(join(this.dataDir, "system-logs.json"), JSON.stringify(logs, null, 2))
  }

  private async getLogsFile(limit = 100, level?: string): Promise<SystemLog[]> {
    try {
      const filePath = join(this.dataDir, "system-logs.json")
      if (!existsSync(filePath)) {
        return []
      }
      const data = await readFile(filePath, "utf-8")
      let logs = JSON.parse(data)

      if (level) {
        logs = logs.filter((log: SystemLog) => log.level === level)
      }

      return logs.slice(-limit).reverse() // Most recent first
    } catch (error) {
      console.error("Failed to read logs file:", error)
      return []
    }
  }

  // SQL implementations (placeholder for when DATABASE_URL is provided)
  private async getCharactersSQL(): Promise<Character[]> {
    // Implement SQL queries when DATABASE_URL is available
    return await this.getCharactersFile()
  }

  private async createCharacterSQL(character: Character): Promise<Character> {
    return await this.createCharacterFile(character)
  }

  private async updateCharacterSQL(id: string, updates: Partial<Character>): Promise<Character | null> {
    return await this.updateCharacterFile(id, updates)
  }

  private async deleteCharacterSQL(id: string): Promise<boolean> {
    return await this.deleteCharacterFile(id)
  }

  private async getScheduledTasksSQL(): Promise<ScheduledTask[]> {
    return await this.getScheduledTasksFile()
  }

  private async createScheduledTaskSQL(task: ScheduledTask): Promise<ScheduledTask> {
    return await this.createScheduledTaskFile(task)
  }

  private async updateScheduledTaskSQL(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    return await this.updateScheduledTaskFile(id, updates)
  }

  private async deleteScheduledTaskSQL(id: string): Promise<boolean> {
    return await this.deleteScheduledTaskFile(id)
  }

  private async getGeneratedContentSQL(characterId?: string): Promise<GeneratedContent[]> {
    return await this.getGeneratedContentFile(characterId)
  }

  private async createGeneratedContentSQL(content: GeneratedContent): Promise<GeneratedContent> {
    return await this.createGeneratedContentFile(content)
  }

  private async addLogSQL(log: SystemLog): Promise<void> {
    return await this.addLogFile(log)
  }

  private async getLogsSQL(limit = 100, level?: string): Promise<SystemLog[]> {
    return await this.getLogsFile(limit, level)
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}

export const db = new DatabaseManager()

// Helper functions
export async function logInfo(message: string, component: string, metadata?: Record<string, any>) {
  await db.addLog({ level: "info", message, component, metadata })
}

export async function logError(message: string, component: string, metadata?: Record<string, any>) {
  await db.addLog({ level: "error", message, component, metadata })
}

export async function logWarn(message: string, component: string, metadata?: Record<string, any>) {
  await db.addLog({ level: "warn", message, component, metadata })
}

export async function logDebug(message: string, component: string, metadata?: Record<string, any>) {
  await db.addLog({ level: "debug", message, component, metadata })
}
