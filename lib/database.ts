// Simple file-based database for development
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"

const DATA_DIR = join(process.cwd(), "data")

export interface Character {
  id: string
  name: string
  lora: string
  instagramAccount: string
  accessToken: string
  accountId: string
  backstory: string
  narrative: string[]
  personality: string[]
  schedule: {
    type: "interval" | "cron" | "times"
    value: string
    timezone: string
    active: boolean
  }
  lastPost: string | null
  nextPost: string | null
  stats: {
    totalPosts: number
    successRate: number
    avgEngagement: number
  }
}

export interface Post {
  id: string
  characterId: string
  prompt: string
  caption: string
  imageUrl: string
  instagramPostId: string | null
  timestamp: string
  success: boolean
}

export class Database {
  private async ensureDataDir() {
    try {
      await mkdir(DATA_DIR, { recursive: true })
    } catch (error) {
      // Directory already exists
    }
  }

  async getCharacters(): Promise<Character[]> {
    await this.ensureDataDir()
    try {
      const data = await readFile(join(DATA_DIR, "characters.json"), "utf-8")
      return JSON.parse(data)
    } catch (error) {
      return []
    }
  }

  async saveCharacter(character: Character): Promise<void> {
    await this.ensureDataDir()
    const characters = await this.getCharacters()
    const index = characters.findIndex((c) => c.id === character.id)

    if (index >= 0) {
      characters[index] = character
    } else {
      characters.push(character)
    }

    await writeFile(join(DATA_DIR, "characters.json"), JSON.stringify(characters, null, 2))
  }

  async getPosts(characterId?: string): Promise<Post[]> {
    await this.ensureDataDir()
    try {
      const data = await readFile(join(DATA_DIR, "posts.json"), "utf-8")
      const posts: Post[] = JSON.parse(data)
      return characterId ? posts.filter((p) => p.characterId === characterId) : posts
    } catch (error) {
      return []
    }
  }

  async savePost(post: Post): Promise<void> {
    await this.ensureDataDir()
    const posts = await this.getPosts()
    posts.push(post)
    await writeFile(join(DATA_DIR, "posts.json"), JSON.stringify(posts, null, 2))
  }
}

export const db = new Database()
