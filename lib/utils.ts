import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date and time utilities
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return "just now"
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? "s" : ""} ago`
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? "s" : ""} ago`
  } else {
    return formatDate(date)
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// String utilities
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substr(0, maxLength - 3) + "..."
}

export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function camelToTitle(text: string): string {
  return text
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

// Array utilities
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function unique<T>(array: T[]): T[] {
  return [...new Set(array)]
}

// Object utilities
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj }
  keys.forEach((key) => {
    delete result[key]
  })
  return result
}

// Validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function isValidInstagramHandle(handle: string): boolean {
  const instagramRegex = /^@?[a-zA-Z0-9._]{1,30}$/
  return instagramRegex.test(handle)
}

// File utilities
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || ""
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
}

// Color utilities
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

// Random utilities
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

export function randomId(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Async utilities
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retry<T>(fn: () => Promise<T>, maxAttempts = 3, delay = 1000): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt === maxAttempts) break
      await sleep(delay * attempt)
    }
  }

  throw lastError!
}

export function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  return new Promise((resolve, reject) => {
    let retries = 0

    const attempt = async () => {
      try {
        const result = await fn()
        resolve(result)
      } catch (error) {
        retries++

        if (retries >= maxRetries) {
          reject(error)
          return
        }

        const delay = baseDelay * Math.pow(2, retries - 1)
        setTimeout(attempt, delay)
      }
    }

    attempt()
  })
}

// Environment utilities
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name]
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue
    throw new Error(`Environment variable ${name} is required`)
  }
  return value
}

export function getEnvVarAsNumber(name: string, defaultValue?: number): number {
  const value = process.env[name]
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue
    throw new Error(`Environment variable ${name} is required`)
  }
  const num = Number(value)
  if (isNaN(num)) {
    throw new Error(`Environment variable ${name} must be a number`)
  }
  return num
}

export function getEnvVarAsBoolean(name: string, defaultValue?: boolean): boolean {
  const value = process.env[name]
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue
    throw new Error(`Environment variable ${name} is required`)
  }
  return value.toLowerCase() === "true"
}

// Cron utilities
export function parseCronExpression(cron: string): {
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
} {
  const parts = cron.split(" ")
  if (parts.length !== 5) {
    throw new Error("Invalid cron expression")
  }

  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  }
}

export function getNextCronDate(cron: string): Date {
  // Simple implementation for common patterns
  const parts = parseCronExpression(cron)
  const now = new Date()
  const next = new Date(now)

  // Handle daily at specific time (e.g., "0 18 * * *")
  if (
    parts.minute !== "*" &&
    parts.hour !== "*" &&
    parts.dayOfMonth === "*" &&
    parts.month === "*" &&
    parts.dayOfWeek === "*"
  ) {
    next.setHours(Number.parseInt(parts.hour), Number.parseInt(parts.minute), 0, 0)
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    return next
  }

  // Handle hourly (e.g., "0 * * * *")
  if (parts.minute !== "*" && parts.hour === "*") {
    next.setMinutes(Number.parseInt(parts.minute), 0, 0)
    if (next <= now) {
      next.setHours(next.getHours() + 1)
    }
    return next
  }

  // Default: add 1 hour
  next.setHours(next.getHours() + 1)
  return next
}

export function parseSchedule(schedule: string): {
  type: "cron" | "interval"
  description: string
  nextRun?: Date
} {
  // Handle interval format (e.g., "6h", "30m", "1d")
  const intervalMatch = schedule.match(/^(\d+)([hmd])$/)
  if (intervalMatch) {
    const value = Number.parseInt(intervalMatch[1])
    const unit = intervalMatch[2]

    let description = ""
    let milliseconds = 0

    switch (unit) {
      case "m":
        description = `Every ${value} minute${value > 1 ? "s" : ""}`
        milliseconds = value * 60 * 1000
        break
      case "h":
        description = `Every ${value} hour${value > 1 ? "s" : ""}`
        milliseconds = value * 60 * 60 * 1000
        break
      case "d":
        description = `Every ${value} day${value > 1 ? "s" : ""}`
        milliseconds = value * 24 * 60 * 60 * 1000
        break
    }

    return {
      type: "interval",
      description,
      nextRun: new Date(Date.now() + milliseconds),
    }
  }

  // Handle cron format
  const cronParts = schedule.split(" ")
  if (cronParts.length === 5) {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = cronParts

    let description = "Custom schedule"

    // Common patterns
    if (schedule === "0 */6 * * *") {
      description = "Every 6 hours"
    } else if (schedule === "0 18 * * *") {
      description = "Daily at 6:00 PM"
    } else if (schedule === "0 9 * * 1") {
      description = "Weekly on Monday at 9:00 AM"
    } else if (schedule === "0 0 1 * *") {
      description = "Monthly on the 1st at midnight"
    } else if (hour !== "*" && minute !== "*") {
      description = `Daily at ${hour}:${minute.padStart(2, "0")}`
    }

    return {
      type: "cron",
      description,
    }
  }

  return {
    type: "cron",
    description: "Invalid schedule format",
  }
}

export function calculateNextRun(schedule: string, lastRun?: string): Date {
  const now = new Date()
  const lastRunDate = lastRun ? new Date(lastRun) : now

  // Handle interval format
  const intervalMatch = schedule.match(/^(\d+)([hmd])$/)
  if (intervalMatch) {
    const value = Number.parseInt(intervalMatch[1])
    const unit = intervalMatch[2]

    let milliseconds = 0
    switch (unit) {
      case "m":
        milliseconds = value * 60 * 1000
        break
      case "h":
        milliseconds = value * 60 * 60 * 1000
        break
      case "d":
        milliseconds = value * 24 * 60 * 60 * 1000
        break
    }

    return new Date(Math.max(now.getTime(), lastRunDate.getTime()) + milliseconds)
  }

  // Handle cron format (simplified)
  const cronParts = schedule.split(" ")
  if (cronParts.length === 5) {
    const [minute, hour] = cronParts

    if (hour !== "*" && minute !== "*") {
      const nextRun = new Date(now)
      nextRun.setHours(Number.parseInt(hour), Number.parseInt(minute), 0, 0)

      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }

      return nextRun
    }
  }

  // Default: next hour
  return new Date(now.getTime() + 60 * 60 * 1000)
}

// Hash utilities
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Performance utilities
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Additional utilities
export function generatePromptVariations(basePrompt: string, character: any): string[] {
  const variations = []
  const styles = ["photorealistic", "artistic", "cinematic", "portrait style"]
  const moods = ["serene", "mysterious", "vibrant", "dramatic"]
  const settings = ["studio lighting", "natural lighting", "golden hour", "soft lighting"]

  for (const style of styles) {
    for (const mood of moods) {
      const variation = `${basePrompt}, ${style}, ${mood} atmosphere, ${settings[Math.floor(Math.random() * settings.length)]}`
      variations.push(variation)
    }
  }

  return variations.slice(0, 8) // Return top 8 variations
}

export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[\w]+/g
  return text.match(hashtagRegex) || []
}

export function generateInstagramCaption(prompt: string, character: any): string {
  const hashtags = [
    "#AIArt",
    "#GeneratedArt",
    "#DigitalArt",
    "#AIGenerated",
    "#ArtificialIntelligence",
    "#CreativeAI",
    "#DigitalCreativity",
    "#AIArtist",
  ]

  // Add character-specific hashtags
  if (character.name) {
    hashtags.push(`#${character.name.replace(/\s+/g, "")}`)
  }

  const caption = `${prompt} ✨

Created with AI technology 🤖

${hashtags.join(" ")}`

  return caption
}

export function validateCharacterData(character: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!character.name || character.name.trim().length === 0) {
    errors.push("Character name is required")
  }

  if (!character.personality || character.personality.trim().length === 0) {
    errors.push("Character personality is required")
  }

  if (character.instagramHandle && !character.instagramHandle.startsWith("@")) {
    errors.push("Instagram handle must start with @")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  } else {
    return `${remainingSeconds}s`
  }
}
