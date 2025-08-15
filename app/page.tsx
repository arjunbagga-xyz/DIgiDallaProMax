"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import {
  DollarSign,
  ChevronDown,
  Plus,
  Play,
  User,
  Brain,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  ImageIcon,
  Github,
  Database,
  Cpu,
  Instagram,
  Zap,
  Trash2,
  Copy,
  Pause,
  Target,
  Edit,
  List,
} from "lucide-react"
import Image from "next/image"

interface Character {
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
  preferredModel?: string
  triggerWord?: string
  promptSettings?: {
    basePrompt?: string
    negativePrompt?: string
    style?: string
    mood?: string
    customPrompts?: string[]
  }
  narratives?: {
    id: string
    title: string
    description: string
    startDate: string
    endDate: string
  }[]
  instagramApiKey?: string
  instagramAccountId?: string
  twitterAccountId?: string
  twitterAppKey?: string
  twitterAppSecret?: string
  twitterAccessToken?: string
  twitterAccessSecret?: string
}

interface SystemStatus {
  comfyui: "online" | "offline" | "error"
  database: "connected" | "disconnected" | "error"
  scheduler: "running" | "stopped" | "error"
  instagram: "connected" | "disconnected" | "error"
  uptime: string
  memory: {
    used: string
    total: string
    percentage: number
  }
  lastCheck: string
}

interface ScheduledTask {
  id: string
  characterId: string
  characterName?: string
  type: string
  schedule: string
  active: boolean
  lastRun?: string
  nextRun?: string
  missedRuns?: { timestamp: string }[]
  config?: {
    prompt?: string
    negativePrompt?: string
    style?: string
    mood?: string
    steps?: number
    cfg?: number
    width?: number
    height?: number
    postToInstagram?: boolean
  }
}

interface ModelInfo {
  id: string
  name: string
  type: "checkpoint" | "lora" | "vae" | "clip"
  size?: number
  loaded: boolean
  lastUsed?: string
  modelType?: "flux" | "sdxl" | "sd15" | "unknown"
}

interface TrainingStatus {
  id: string
  characterId: string
  status: "preparing" | "training" | "completed" | "failed"
  progress: number
  currentStep: number
  totalSteps: number
  logs: string[]
  error?: string
}

interface GeneratedPrompt {
  id: string
  characterId: string
  characterName: string
  prompt: string
  caption: string
  createdAt: string
  used: boolean
}

interface Content {
  id: string
  characterId: string
  prompt: string
  imageUrl: string
  caption: string
  createdAt: string
  postedToInstagram: boolean
  postedToTwitter: boolean
}

export default function AutomationDashboard() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    comfyui: "offline",
    database: "disconnected",
    scheduler: "stopped",
    instagram: "disconnected",
    uptime: "0s",
    memory: { used: "0 MB", total: "0 MB", percentage: 0 },
    lastCheck: new Date().toISOString(),
  })
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [trainings, setTrainings] = useState<TrainingStatus[]>([])
  const [prompts, setPrompts] = useState<GeneratedPrompt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [availableLoras, setAvailableLoras] = useState<ModelInfo[]>([])
  const [newCharacter, setNewCharacter] = useState({
    name: "",
    personality: "",
    backstory: "",
    instagramHandle: "",
    preferredModel: "",
    triggerWord: "",
    instagramApiKey: "",
    instagramAccountId: "",
    twitterAccountId: "",
    twitterAppKey: "",
    twitterAppSecret: "",
    twitterAccessToken: "",
    twitterAccessSecret: "",
    promptSettings: {
      basePrompt: "",
      negativePrompt: "",
      style: "",
      mood: "",
      customPrompts: [] as string[],
    },
    narratives: [] as { id: string; title: string; description: string; startDate: string; endDate: string }[],
  })
  const [generationProgress, setGenerationProgress] = useState<{ [key: string]: number }>({})
  const [generatedContent, setGeneratedContent] = useState<{ [key: string]: { imageUrl: string; caption: string } }>({})
  const [newTask, setNewTask] = useState({
    characterId: "",
    type: "generate_and_post",
    schedule: "0 18 * * *",
    active: true,
    config: {
      prompt: "",
      negativePrompt: "",
      style: "",
      mood: "",
      steps: 20,
      cfg: 7.5,
      width: 1024,
      height: 1024,
      postToInstagram: true,
    },
  })
  const [deploymentStatus, setDeploymentStatus] = useState<{ [key: string]: any }>({})
  const [loraTrainingCharacter, setLoraTrainingCharacter] = useState<Character | null>(null)
  const [loraTrainingBaseModel, setLoraTrainingBaseModel] = useState<string>("")
  const [trainingImages, setTrainingImages] = useState<{data: string, caption: string, name: string}[]>([])
  const [promptCaptions, setPromptCaptions] = useState<{ [key: string]: string }>({})
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [promptSearchTerm, setPromptSearchTerm] = useState("")
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([])
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false)
  const [generatePromptsCharacterId, setGeneratePromptsCharacterId] = useState<string>("")
  const [generatePromptsCount, setGeneratePromptsCount] = useState<number>(10)
  const [allContent, setAllContent] = useState<Content[]>([])
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [selectedTraining, setSelectedTraining] = useState<TrainingStatus | null>(null)

  const viewTrainingDetails = async (trainingId: string) => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/lora/v2/train/${trainingId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedTraining(data)
      } else {
        toast({
          title: "Error",
          description: "Failed to load training details",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to load training details:", error)
      toast({
        title: "Error",
        description: "Failed to load training details",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    const storedApiKey = localStorage.getItem("geminiApiKey")
    if (storedApiKey) {
      setGeminiApiKey(storedApiKey)
    }
  }, [])

  const saveGeminiApiKey = () => {
    localStorage.setItem("geminiApiKey", geminiApiKey)
    toast({
      title: "Success",
      description: "Gemini API key saved.",
    })
  }

  const checkSystemStatus = useCallback(async () => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/system/status`)
      if (response.ok) {
        const status = await response.json()
        setSystemStatus(status)
      }
    } catch (error) {
      console.error("Failed to check system status:", error)
    }
  }, [])

  const loadCharacters = useCallback(async () => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/characters`)
      if (response.ok) {
        const data = await response.json()
        setCharacters(data.characters || [])
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load characters",
        variant: "destructive",
      })
    }
  }, [])

  const loadScheduledTasks = useCallback(async () => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/scheduler`)
      if (response.ok) {
        const data = await response.json()
        setScheduledTasks(data.tasks || [])
      }
    } catch (error) {
      console.error("Failed to load scheduled tasks:", error)
    }
  }, [])

  const loadModels = useCallback(async () => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/models`)
      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
      }
    } catch (error) {
      console.error("Failed to load models:", error)
    }
  }, [])

  const loadTrainings = useCallback(async () => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/lora/v2/train`)
      if (response.ok) {
        const data = await response.json()
        setTrainings(data.trainings || [])
      }
    } catch (error) {
      console.error("Failed to load trainings:", error)
    }
  }, [])

  const loadPrompts = useCallback(async () => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/prompts`)
      if (response.ok) {
        const data = await response.json()
        setPrompts(data.prompts || [])
      }
    } catch (error) {
      console.error("Failed to load prompts:", error)
    }
  }, [])

  const loadAvailableModels = useCallback(async () => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/models?show=all`)
      if (response.ok) {
        const data = await response.json()
        const checkpoints = data.models.filter((m: ModelInfo) => m.type === "checkpoint")
        const loras = data.models.filter((m: ModelInfo) => m.type === "lora")
        setAvailableModels(checkpoints)
        setAvailableLoras(loras)
      }
    } catch (error) {
      console.error("Failed to load available models:", error)
    }
  }, [])

  const loadContent = useCallback(async () => {
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/content`)
      if (response.ok) {
        const data = await response.json()
        setAllContent(data.content || [])
      }
    } catch (error) {
      console.error("Failed to load content:", error)
    }
  }, [])

  const loadAllData = useCallback(async () => {
    await Promise.all([
      checkSystemStatus(),
      loadCharacters(),
      loadScheduledTasks(),
      loadModels(),
      loadTrainings(),
      loadPrompts(),
      loadAvailableModels(),
      loadContent(),
    ])
  }, [checkSystemStatus, loadCharacters, loadScheduledTasks, loadModels, loadTrainings, loadPrompts, loadAvailableModels, loadContent])

  // Load all data
  useEffect(() => {
    loadAllData()

    const interval = setInterval(() => {
      checkSystemStatus()
      loadScheduledTasks()
      loadTrainings()
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [loadAllData, checkSystemStatus, loadScheduledTasks, loadTrainings])

  const createCharacter = async () => {
    if (!newCharacter.name || !newCharacter.personality) {
      toast({
        title: "Error",
        description: "Name and personality are required",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCharacter),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Character created successfully",
        })
        setNewCharacter({
          name: "",
          personality: "",
          backstory: "",
          instagramHandle: "",
          preferredModel: "",
          triggerWord: "",
          instagramApiKey: "",
          instagramAccountId: "",
          twitterAccountId: "",
          twitterAppKey: "",
          twitterAppSecret: "",
          twitterAccessToken: "",
          twitterAccessSecret: "",
          promptSettings: {
            basePrompt: "",
            negativePrompt: "",
            style: "",
            mood: "",
            customPrompts: [] as string[],
          },
          narratives: [] as { id: string; title: string; description: string; startDate: string; endDate: string }[],
        })
        loadCharacters()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to create character")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create character",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateNewPrompts = async () => {
    if (!generatePromptsCharacterId) {
      toast({
        title: "Error",
        description: "Please select a character.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const character = characters.find((c) => c.id === generatePromptsCharacterId)
      if (!character) {
        throw new Error("Character not found")
      }

      const response = await fetch("/api/prompts/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character,
          count: generatePromptsCount,
          apiKey: geminiApiKey,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `${generatePromptsCount} new prompts generated successfully.`,
        })
        loadPrompts()
        setIsGeneratingPrompts(false)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate prompts")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate prompts",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runMissedTask = async (taskId: string, timestamp: string) => {
    setIsLoading(true)
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/scheduler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_missed_task", taskId, timestamp }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Missed task executed successfully.",
        })
        loadScheduledTasks()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to run missed task")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run missed task",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteSelectedPrompts = async () => {
    setIsLoading(true)
    try {
      await Promise.all(selectedPrompts.map(id => deletePrompt(id)))
      setSelectedPrompts([])
      toast({
        title: "Success",
        description: "Selected prompts deleted successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete some of the selected prompts.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const postToTwitter = async (contentId: string) => {
    const content = allContent.find((c) => c.id === contentId)
    if (!content) {
      toast({
        title: "Error",
        description: "Content not found.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      toast({
        title: "Posting to X/Twitter...",
        description: "This may take a moment.",
      })

      const response = await fetch("/api/post-to-twitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: content.characterId,
          imageUrl: content.imageUrl,
          caption: content.caption,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Image posted to X/Twitter.",
        })
      } else {
        const error = await response.json()
        throw new Error(error.details || error.error || "Failed to post to X/Twitter")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred during the post process.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateCaption = async (promptId: string, characterId: string) => {
    setIsLoading(true)
    try {
      const prompt = prompts.find(p => p.id === promptId)
      const character = characters.find(c => c.id === characterId)

      if (!prompt || !character) {
        throw new Error("Prompt or character not found")
      }

      const now = new Date()
      const narrative = character.narratives?.find(n => {
        const start = new Date(n.startDate)
        const end = new Date(n.endDate)
        return now >= start && now <= end
      })

      const response = await fetch("/api/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.prompt, character, narrative, apiKey: geminiApiKey }),
      })

      if (response.ok) {
        const data = await response.json()
        setPromptCaptions({ ...promptCaptions, [promptId]: data.caption })
        toast({
          title: "Success",
          description: "Caption generated successfully.",
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate caption")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate caption",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deletePrompt = async (promptId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_prompt", promptId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Prompt deleted successfully",
        })
        loadPrompts()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete prompt")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete prompt",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleTask = async (taskId: string) => {
    setIsLoading(true)
    try {
      const task = scheduledTasks.find((t) => t.id === taskId)
      if (!task) return

      const response = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_task",
          taskId,
          active: !task.active,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Task ${task.active ? "paused" : "resumed"} successfully`,
        })
        loadScheduledTasks()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to toggle task")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to toggle task",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteCharacter = async (characterId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/characters?id=${characterId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Character deleted successfully",
        })
        loadCharacters()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete character")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete character",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteContent = async (contentId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/content", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contentId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Content deleted successfully.",
        })
        loadContent()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete content")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete content",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateAndPost = async (contentId: string) => {
    const content = allContent.find((c) => c.id === contentId)
    if (!content) {
      toast({
        title: "Error",
        description: "Content not found.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      toast({
        title: "Posting to Instagram...",
        description: "This may take a moment.",
      })

      const response = await fetch("/api/post-to-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: content.characterId,
          imageUrl: content.imageUrl,
          caption: content.caption,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Image posted to Instagram.",
        })
        loadCharacters() // Refresh character data
      } else {
        const error = await response.json()
        throw new Error(error.details || error.error || "Failed to post to Instagram")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred during the post process.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runScheduler = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_now" }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Scheduler executed successfully",
        })
        loadScheduledTasks()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to run scheduler")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run scheduler",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateCharacter = async (characterId: string, updates: Partial<Character>) => {
    const character = characters.find((c) => c.id === characterId)
    if (!character) return

    const updatedCharacter = { ...character, ...updates }

    // Optimistically update the UI
    const newCharacters = characters.map((c) => (c.id === characterId ? updatedCharacter : c))
    setCharacters(newCharacters)

    try {
      const response = await fetch("/api/characters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCharacter),
      })

      if (!response.ok) {
        // Revert on failure
        setCharacters(characters)
        const error = await response.json()
        throw new Error(error.error || "Failed to update character")
      }
    } catch (error) {
      // Revert on failure
      setCharacters(characters)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update character",
        variant: "destructive",
      })
    }
  }

  const generateContent = async (characterId: string) => {
    const character = characters.find((c) => c.id === characterId)
    if (!character) return

    setGenerationProgress({ ...generationProgress, [characterId]: 0 })
    setIsLoading(true)

    try {
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => ({
          ...prev,
          [characterId]: Math.min((prev[characterId] || 0) + 10, 90),
        }))
      }, 1000)

      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/workflows/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character, apiKey: geminiApiKey }),
      })

      clearInterval(progressInterval)
      setGenerationProgress((prev) => ({ ...prev, [characterId]: 100 }))

      if (response.ok) {
        const result = await response.json()
        setGeneratedContent({
          ...generatedContent,
          [characterId]: {
            imageUrl: result.imageUrl,
            caption: result.caption,
          },
        })
        toast({
          title: "Success",
          description: "Content generated successfully!",
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate content")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setTimeout(() => {
        setGenerationProgress((prev) => {
          const newProgress = { ...prev }
          delete newProgress[characterId]
          return newProgress
        })
      }, 2000)
    }
  }

  const trainLora = async (characterId: string, baseModel: string) => {
    const character = characters.find((c) => c.id === characterId)
    if (!character) return

    setIsLoading(true)
    try {
      // Use the current window location to determine the base URL
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/lora/v2/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          characterName: character.name,
          baseModel: baseModel,
          triggerWord: character.triggerWord,
          steps: 1000,
          learningRate: 1e-4,
          trainingImages: trainingImages.map(img => ({ data: img.data, caption: img.caption })),
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success",
          description: `LoRA training started: ${result.trainingId}`,
        })
        loadTrainings()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to start training")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start LoRA training",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addScheduledTask = async () => {
    if (!newTask.characterId) {
      toast({
        title: "Error",
        description: "Please select a character",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_task",
          task: newTask,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Scheduled task created successfully",
        })
        setNewTask({
          characterId: "",
          type: "generate_and_post",
          schedule: "0 18 * * *",
          active: true,
          config: {
            prompt: "",
            negativePrompt: "",
            style: "",
            mood: "",
            steps: 20,
            cfg: 7.5,
            width: 1024,
            height: 1024,
            postToInstagram: true,
          },
        })
        loadScheduledTasks()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to create task")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create task",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deployToGitHub = async () => {
    setIsLoading(true)
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/deployment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deploy",
          platform: "github-actions",
          config: {
            schedule: "0 */6 * * *",
          },
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setDeploymentStatus((prev) => ({ ...prev, github: result }))
        toast({
          title: "Success",
          description: result.message,
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to setup GitHub Actions")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to setup GitHub Actions",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deployToVercel = async () => {
    setIsLoading(true)
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/deployment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deploy",
          platform: "vercel",
          config: {
            schedule: "0 */6 * * *",
          },
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setDeploymentStatus((prev) => ({ ...prev, vercel: result }))
        toast({
          title: "Success",
          description: result.message,
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to deploy to Vercel")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to deploy to Vercel",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deployToDocker = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/deployment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deploy",
          platform: "docker",
          config: {},
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setDeploymentStatus((prev) => ({ ...prev, docker: result }))
        toast({
          title: "Success",
          description: result.message,
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to setup Docker")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to setup Docker",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const StatusBadge = ({ status, label }: { status: string; label: string }) => {
    const getVariant = (status: string) => {
      switch (status) {
        case "online":
        case "connected":
        case "running":
          return "default"
        case "offline":
        case "disconnected":
        case "stopped":
          return "secondary"
        case "error":
          return "destructive"
        default:
          return "secondary"
      }
    }

    const getIcon = (status: string) => {
      switch (status) {
        case "online":
        case "connected":
        case "running":
          return <CheckCircle className="w-3 h-3" />
        case "offline":
        case "disconnected":
        case "stopped":
          return <Clock className="w-3 h-3" />
        case "error":
          return <AlertCircle className="w-3 h-3" />
        default:
          return <Clock className="w-3 h-3" />
      }
    }

    return (
      <Badge variant={getVariant(status)} className="flex items-center gap-1">
        {getIcon(status)}
        {label}: {status}
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
              Zero Cost System
            </Badge>
          </div>
          <h1 className="text-3xl font-bold">Digital Dalla Dashboard</h1>
          <p className="text-gray-500">AI-powered Instagram automation with any model you choose</p>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <StatusBadge status={systemStatus.comfyui} label="ComfyUI" />
            <StatusBadge status={systemStatus.database} label="Database" />
            <StatusBadge status={systemStatus.scheduler} label="Scheduler" />
            <StatusBadge status={systemStatus.instagram} label="Instagram" />
          </div>
        </div>

        <Tabs defaultValue="characters" className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="characters">Characters</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="models">Models & LoRA</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
            <TabsTrigger value="deployment">Deployment</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="characters" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Character Management</h2>
              <div className="flex gap-2">
                <Button onClick={loadAvailableModels} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Models
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Character
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Character</DialogTitle>
                      <DialogDescription>
                        Add a new AI character with unique personality, model preferences, and prompt settings.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="name">Character Name</Label>
                          <Input
                            id="name"
                            value={newCharacter.name}
                            onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                            placeholder="e.g., Luna the Mystic"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="triggerWord">Trigger Word</Label>
                          <Input
                            id="triggerWord"
                            value={newCharacter.triggerWord}
                            onChange={(e) => setNewCharacter({ ...newCharacter, triggerWord: e.target.value })}
                            placeholder="e.g., luna_character"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="personality">Personality</Label>
                        <Input
                          id="personality"
                          value={newCharacter.personality}
                          onChange={(e) => setNewCharacter({ ...newCharacter, personality: e.target.value })}
                          placeholder="e.g., Dreamy and mystical"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="backstory">Backstory</Label>
                        <Textarea
                          id="backstory"
                          value={newCharacter.backstory}
                          onChange={(e) => setNewCharacter({ ...newCharacter, backstory: e.target.value })}
                          placeholder="Character&apos;s background story..."
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="instagram">Instagram Handle</Label>
                          <Input
                            id="instagram"
                            value={newCharacter.instagramHandle}
                            onChange={(e) => setNewCharacter({ ...newCharacter, instagramHandle: e.target.value })}
                            placeholder="@character_handle"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="preferredModel">Preferred Model</Label>
                          <Select
                            value={newCharacter.preferredModel}
                            onValueChange={(value) => setNewCharacter({ ...newCharacter, preferredModel: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableModels.map((model) => (
                                <SelectItem key={model.id} value={model.name}>
                                  {model.name.replace(".safetensors", "").replace(".ckpt", "")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium">API Keys</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="instagram-account-id">Instagram Account ID</Label>
                            <Input
                              id="instagram-account-id"
                              value={newCharacter.instagramAccountId}
                              onChange={(e) => setNewCharacter({ ...newCharacter, instagramAccountId: e.target.value })}
                              placeholder="Enter Instagram Account ID"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="instagram-api-key">Instagram API Key</Label>
                            <Input
                              id="instagram-api-key"
                              type="password"
                              value={newCharacter.instagramApiKey}
                              onChange={(e) => setNewCharacter({ ...newCharacter, instagramApiKey: e.target.value })}
                              placeholder="Enter Instagram API Key"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="twitter-account-id">X/Twitter Account ID</Label>
                            <Input
                              id="twitter-account-id"
                              value={newCharacter.twitterAccountId}
                              onChange={(e) => setNewCharacter({ ...newCharacter, twitterAccountId: e.target.value })}
                              placeholder="Enter X/Twitter Account ID"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="twitter-app-key">X/Twitter App Key</Label>
                            <Input
                              id="twitter-app-key"
                              value={newCharacter.twitterAppKey}
                              onChange={(e) => setNewCharacter({ ...newCharacter, twitterAppKey: e.target.value })}
                              placeholder="Enter X/Twitter App Key"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="twitter-app-secret">X/Twitter App Secret</Label>
                            <Input
                              id="twitter-app-secret"
                              type="password"
                              value={newCharacter.twitterAppSecret}
                              onChange={(e) => setNewCharacter({ ...newCharacter, twitterAppSecret: e.target.value })}
                              placeholder="Enter X/Twitter App Secret"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="twitter-access-token">X/Twitter Access Token</Label>
                            <Input
                              id="twitter-access-token"
                              type="password"
                              value={newCharacter.twitterAccessToken}
                              onChange={(e) => setNewCharacter({ ...newCharacter, twitterAccessToken: e.target.value })}
                              placeholder="Enter X/Twitter Access Token"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="twitter-access-secret">X/Twitter Access Secret</Label>
                            <Input
                              id="twitter-access-secret"
                              type="password"
                              value={newCharacter.twitterAccessSecret}
                              onChange={(e) => setNewCharacter({ ...newCharacter, twitterAccessSecret: e.target.value })}
                              placeholder="Enter X/Twitter Access Secret"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium">Prompt Settings</h4>

                        <div className="grid gap-2">
                          <Label htmlFor="basePrompt">Base Prompt</Label>
                          <Textarea
                            id="basePrompt"
                            value={newCharacter.promptSettings.basePrompt}
                            onChange={(e) =>
                              setNewCharacter({
                                ...newCharacter,
                                promptSettings: { ...newCharacter.promptSettings, basePrompt: e.target.value },
                              })
                            }
                            placeholder="Base prompt for image generation..."
                            rows={2}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="negativePrompt">Negative Prompt</Label>
                          <Textarea
                            id="negativePrompt"
                            value={newCharacter.promptSettings.negativePrompt}
                            onChange={(e) =>
                              setNewCharacter({
                                ...newCharacter,
                                promptSettings: { ...newCharacter.promptSettings, negativePrompt: e.target.value },
                              })
                            }
                            placeholder="What to avoid in generation..."
                            rows={2}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="style">Style</Label>
                            <Input
                              id="style"
                              value={newCharacter.promptSettings.style}
                              onChange={(e) =>
                                setNewCharacter({
                                  ...newCharacter,
                                  promptSettings: { ...newCharacter.promptSettings, style: e.target.value },
                                })
                              }
                              placeholder="e.g., photorealistic, artistic"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="mood">Mood</Label>
                            <Input
                              id="mood"
                              value={newCharacter.promptSettings.mood}
                              onChange={(e) =>
                                setNewCharacter({
                                  ...newCharacter,
                                  promptSettings: { ...newCharacter.promptSettings, mood: e.target.value },
                                })
                              }
                              placeholder="e.g., serene, dramatic"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium">Narratives</h4>
                        {newCharacter.narratives.map((narrative, index) => (
                          <div key={narrative.id} className="space-y-2 border p-2 rounded-md">
                            <Input value={narrative.title} placeholder="Title" onChange={(e) => {
                              const newNarratives = [...newCharacter.narratives]
                              newNarratives[index].title = e.target.value
                              setNewCharacter({ ...newCharacter, narratives: newNarratives })
                            }} />
                            <Textarea value={narrative.description} placeholder="Description" onChange={(e) => {
                              const newNarratives = [...newCharacter.narratives]
                              newNarratives[index].description = e.target.value
                              setNewCharacter({ ...newCharacter, narratives: newNarratives })
                            }} />
                            <div className="flex gap-2">
                              <Input type="date" value={narrative.startDate} onChange={(e) => {
                                const newNarratives = [...newCharacter.narratives]
                                newNarratives[index].startDate = e.target.value
                                setNewCharacter({ ...newCharacter, narratives: newNarratives })
                              }} />
                              <Input type="date" value={narrative.endDate} onChange={(e) => {
                                const newNarratives = [...newCharacter.narratives]
                                newNarratives[index].endDate = e.target.value
                                setNewCharacter({ ...newCharacter, narratives: newNarratives })
                              }} />
                            </div>
                            <Button size="sm" variant="destructive" onClick={() => {
                              const newNarratives = [...newCharacter.narratives]
                              newNarratives.splice(index, 1)
                              setNewCharacter({ ...newCharacter, narratives: newNarratives })
                            }}>Remove</Button>
                          </div>
                        ))}
                        <Button size="sm" onClick={() => {
                          const newNarratives = [...newCharacter.narratives]
                          newNarratives.push({ id: `narrative_${Date.now()}`, title: "", description: "", startDate: "", endDate: "" })
                          setNewCharacter({ ...newCharacter, narratives: newNarratives })
                        }}>Add Narrative</Button>
                      </div>
                    </div>
                    <Button onClick={createCharacter} disabled={isLoading}>
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Create Character
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {characters.map((character) => (
                <Card key={character.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        {character.name}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingCharacter(character)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this character?')) {
                              deleteCharacter(character.id)
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>{character.personality}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600">{character.backstory}</p>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Instagram className="w-4 h-4" />
                        <span>{character.instagramHandle || "Not set"}</span>
                      </div>

                      {character.preferredModel && (
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4" />
                          <span className="truncate">{character.preferredModel.replace(".safetensors", "")}</span>
                        </div>
                      )}

                      {character.triggerWord && (
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          <Badge variant="outline">{character.triggerWord}</Badge>
                        </div>
                      )}

                      {character.loraModelPath && (
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4" />
                          <Badge variant="secondary">LoRA Trained</Badge>
                        </div>
                      )}
                    </div>

                    {generationProgress[character.id] !== undefined && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Generating...</span>
                          <span>{generationProgress[character.id]}%</span>
                        </div>
                        <Progress value={generationProgress[character.id]} />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => generateContent(character.id)} disabled={isLoading}>
                        <ImageIcon className="w-4 h-4 mr-1" />
                        Generate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setLoraTrainingCharacter(character)} disabled={isLoading}>
                        <Brain className="w-4 h-4 mr-1" />
                        Train LoRA
                      </Button>
                    </div>

                    {generatedContent[character.id] && (
                      <div className="mt-4 p-4 border rounded-lg">
                        <h4 className="font-bold mb-2">Generated Content</h4>
                        <Image
                          src={generatedContent[character.id].imageUrl}
                          alt="Generated content"
                          className="rounded-md mb-2"
                          width={512}
                          height={512}
                        />
                        <p className="text-sm italic">&quot;{generatedContent[character.id].caption}&quot;</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {loraTrainingCharacter && (
              <Dialog open={!!loraTrainingCharacter} onOpenChange={() => {
                setLoraTrainingCharacter(null)
                setTrainingImages([])
              }}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Train LoRA for {loraTrainingCharacter.name}</DialogTitle>
                    <DialogDescription>
                      Upload 10-20 images of the character for training. Use clear, high-quality images.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="training-images">Training Images</Label>
                      <Input
                        id="training-images"
                        type="file"
                        multiple
                        accept="image/png, image/jpeg, .txt"
                        onChange={(e) => {
                          if (e.target.files) {
                            const allFiles = Array.from(e.target.files);
                            const imageFiles = allFiles.filter(f => f.type.startsWith('image/'));
                            const textFiles = allFiles.filter(f => f.name.endsWith('.txt'));

                            const filePairs = imageFiles.map(imageFile => {
                                const baseName = imageFile.name.split('.').slice(0, -1).join('.');
                                const textFile = textFiles.find(f => f.name === `${baseName}.txt`);
                                return { imageFile, textFile };
                            });

                            toast({
                                title: "Processing files...",
                                description: `Found ${imageFiles.length} images and ${textFiles.length} text files.`,
                            });

                            const readPromises = filePairs.map(({ imageFile, textFile }) => {
                                const imagePromise = new Promise<{data: string, name: string}>((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.readAsDataURL(imageFile);
                                    reader.onload = () => resolve({ data: (reader.result as string).split(',')[1], name: imageFile.name });
                                    reader.onerror = reject;
                                });

                                const captionPromise = new Promise<string | null>((resolve, reject) => {
                                    if (textFile) {
                                        const reader = new FileReader();
                                        reader.readAsText(textFile);
                                        reader.onload = () => resolve(reader.result as string);
                                        reader.onerror = reject;
                                    } else {
                                        resolve(null);
                                    }
                                });

                                return Promise.all([imagePromise, captionPromise]);
                            });

                            Promise.all(readPromises).then(results => {
                                const imageData = results
                                    .filter(([, caption]) => caption !== null)
                                    .map(([image, caption]) => ({
                                        data: image.data,
                                        name: image.name,
                                        caption: caption as string,
                                    }));

                                const imagesWithCaptions = imageData.length;
                                const imagesWithoutCaptions = filePairs.length - imagesWithCaptions;

                                if (imagesWithoutCaptions > 0) {
                                    toast({
                                        title: "Missing Captions",
                                        description: `${imagesWithoutCaptions} image(s) were ignored because a matching .txt caption file was not found.`,
                                        variant: "destructive"
                                    });
                                }

                                setTrainingImages(imageData);
                            });
                          }
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="base-model">Base Model</Label>
                      <Select value={loraTrainingBaseModel} onValueChange={setLoraTrainingBaseModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a base model" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((model) => (
                            <SelectItem key={model.id} value={model.name}>
                              {model.name.replace(".safetensors", "").replace(".ckpt", "")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {trainingImages.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {trainingImages.map((image, index) => (
                          <Image key={index} src={`data:image/jpeg;base64,${image.data}`} alt={image.name} className="rounded-md object-cover w-full h-24" width={96} height={96} />
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={() => trainLora(loraTrainingCharacter.id, loraTrainingBaseModel)} disabled={isLoading || trainingImages.length === 0 || !loraTrainingBaseModel}>
                    {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : "Start Training"}
                  </Button>
                </DialogContent>
              </Dialog>
            )}

            {editingCharacter && (
              <Dialog open={!!editingCharacter} onOpenChange={() => setEditingCharacter(null)}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit {editingCharacter.name}</DialogTitle>
                    <DialogDescription>
                      Update the details for this character. Click save when you&apos;re done.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-name">Character Name</Label>
                        <Input
                          id="edit-name"
                          value={editingCharacter.name}
                          onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-triggerWord">Trigger Word</Label>
                        <Input
                          id="edit-triggerWord"
                          value={editingCharacter.triggerWord || ""}
                          onChange={(e) => setEditingCharacter({ ...editingCharacter, triggerWord: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-personality">Personality</Label>
                      <Input
                        id="edit-personality"
                        value={editingCharacter.personality}
                        onChange={(e) => setEditingCharacter({ ...editingCharacter, personality: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-backstory">Backstory</Label>
                      <Textarea
                        id="edit-backstory"
                        value={editingCharacter.backstory}
                        onChange={(e) => setEditingCharacter({ ...editingCharacter, backstory: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-instagram">Instagram Handle</Label>
                        <Input
                          id="edit-instagram"
                          value={editingCharacter.instagramHandle}
                          onChange={(e) => setEditingCharacter({ ...editingCharacter, instagramHandle: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-preferredModel">Preferred Model</Label>
                        <Select
                          value={editingCharacter.preferredModel}
                          onValueChange={(value) => setEditingCharacter({ ...editingCharacter, preferredModel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map((model) => (
                              <SelectItem key={model.id} value={model.name}>
                                {model.name.replace(".safetensors", "").replace(".ckpt", "")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => {
                    updateCharacter(editingCharacter.id, editingCharacter);
                    setEditingCharacter(null);
                  }} disabled={isLoading}>
                    Save Changes
                  </Button>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Models & LoRA Training</h2>
              <Button onClick={loadModels} disabled={isLoading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Models
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Available Models</CardTitle>
                  <CardDescription>Checkpoint models available for use or download.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {models.filter(m => m.type === 'checkpoint').map((model) => (
                      <div key={model.id} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{model.name.replace(".safetensors", "").replace(".ckpt", "")}</span>
                          <Badge variant="outline" className="ml-2">
                            {model.name.includes("flux") ? "Flux" : model.name.includes("xl") ? "SDXL" : "SD1.5"}
                          </Badge>
                        </div>
                        <Badge variant={model.loaded ? "default" : "secondary"}>
                          {model.loaded ? "Loaded" : "Not Loaded"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {models.filter(m => m.type === 'checkpoint').length === 0 && (
                    <div className="text-sm text-gray-600">
                      No checkpoint models found.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Available LoRAs</CardTitle>
                  <CardDescription>LoRA models available for use or download.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {models.filter(m => m.type === 'lora').map((model) => (
                      <div key={model.id} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{model.name.replace(".safetensors", "").replace(".pt", "")}</span>
                        </div>
                        <Badge variant={model.loaded ? "default" : "secondary"}>
                          {model.loaded ? "Loaded" : "Not Loaded"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {models.filter(m => m.type === 'lora').length === 0 && (
                    <div className="text-sm text-gray-600">
                      No LoRA models found.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>LoRA Training Status</CardTitle>
                  <CardDescription>Active and completed training sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {trainings.slice(0, 5).map((training) => (
                      <div key={training.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            {characters.find((c) => c.id === training.characterId)?.name || "Unknown"} LoRA
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                training.status === "completed"
                                  ? "default"
                                  : training.status === "failed"
                                    ? "destructive"
                                    : training.status === "training"
                                      ? "secondary"
                                      : "outline"
                              }
                            >
                              {training.status}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => viewTrainingDetails(training.id)}>
                              <List className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {training.status === "training" && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>
                                Step {training.currentStep}/{training.totalSteps}
                              </span>
                              <span>{training.progress}%</span>
                            </div>
                            <Progress value={training.progress} />
                          </div>
                        )}
                      </div>
                    ))}
                    {trainings.length === 0 && <div className="text-sm text-gray-600">No training sessions</div>}
                  </div>
                </CardContent>
              </Card>
            </div>
            {selectedTraining && (
              <Dialog open={!!selectedTraining} onOpenChange={() => setSelectedTraining(null)}>
                <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Training Details: {selectedTraining.id}</DialogTitle>
                    <DialogDescription>
                      Status: {selectedTraining.status} ({selectedTraining.progress}%)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-grow overflow-y-auto p-4 bg-gray-900 text-white font-mono text-xs rounded-md">
                    {selectedTraining.logs.map((log, index) => (
                      <div key={index}>{log}</div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Card>
              <CardHeader>
                <CardTitle>How to Add Models</CardTitle>
                <CardDescription>Instructions for adding your own models.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-2">
                <p>To add your own models, place the files in the following directories in the project&apos;s root:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>For checkpoint models (e.g., SDXL, SD1.5): <code className="bg-gray-100 p-1 rounded">models/checkpoints/</code></li>
                  <li>For LoRA models: <code className="bg-gray-100 p-1 rounded">models/loras/</code></li>
                </ul>
                <p>Supported file formats are <code className="bg-gray-100 p-1 rounded">.safetensors</code> and <code className="bg-gray-100 p-1 rounded">.ckpt</code> for checkpoints, and <code className="bg-gray-100 p-1 rounded">.safetensors</code> and <code className="bg-gray-100 p-1 rounded">.pt</code> for LoRAs.</p>
                <p>After adding the files, click the "Refresh Models" button above to see them in the list.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Missed Runs</CardTitle>
                <CardDescription>Tasks that were scheduled to run but were missed.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Character</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Missed At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledTasks.flatMap(task =>
                      (task.missedRuns || []).map(missedRun => (
                        <TableRow key={`${task.id}-${missedRun.timestamp}`}>
                          <TableCell>{task.characterName}</TableCell>
                          <TableCell>{task.type}</TableCell>
                          <TableCell>{new Date(missedRun.timestamp).toLocaleString()}</TableCell>
                          <TableCell>
                            <Button size="sm" onClick={() => runMissedTask(task.id, missedRun.timestamp)} disabled={isLoading}>
                              Run Now
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="settings" className="space-y-4">
            <h2 className="text-2xl font-bold">Settings</h2>
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage your API keys for third-party services.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gemini-api-key">Gemini API Key</Label>
                  <Input
                    id="gemini-api-key"
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key"
                  />
                </div>
                <Button onClick={saveGeminiApiKey}>Save API Key</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Artifact Storage</CardTitle>
                <CardDescription>
                  Locations where generated content and models are stored.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-2">
                <p>
                  Character and scheduling data is stored in the <code>/data</code> directory.
                </p>
                <p>
                  Generated content (images and captions) is tracked in <code>/data/content.json</code>.
                </p>
                <p>
                  Trained LoRA models are saved to the <code>/training/[trainingId]/output</code> directory.
                </p>
                <p>
                  Checkpoint models should be placed in <code>/models/checkpoints</code> and LoRA models in <code>/models/loras</code>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduling" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Content Scheduling</h2>
              <div className="flex gap-2">
                <Button onClick={runScheduler} disabled={isLoading}>
                  {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Run Now
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Scheduled Task</DialogTitle>
                      <DialogDescription>Schedule automated content generation and posting</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Character</Label>
                          <Select
                            value={newTask.characterId}
                            onValueChange={(value) => setNewTask({ ...newTask, characterId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select character" />
                            </SelectTrigger>
                            <SelectContent>
                              {characters.map((char) => (
                                <SelectItem key={char.id} value={char.id}>
                                  {char.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Task Type</Label>
                          <Select
                            value={newTask.type}
                            onValueChange={(value) => setNewTask({ ...newTask, type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="generate_and_post">Post to Instagram</SelectItem>
                              <SelectItem value="generate_and_post_to_twitter">Post to X/Twitter</SelectItem>
                              <SelectItem value="generate_only">Generate Only</SelectItem>
                              <SelectItem value="train_lora">Train LoRA</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>Schedule (Cron)</Label>
                        <Input
                          value={newTask.schedule}
                          onChange={(e) => setNewTask({ ...newTask, schedule: e.target.value })}
                          placeholder="0 18 * * * (Daily at 6 PM)"
                        />
                      </div>

                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium">Generation Settings</h4>

                        <div className="grid gap-2">
                          <Label>Custom Prompt (optional)</Label>
                          <Textarea
                            value={newTask.config.prompt}
                            onChange={(e) =>
                              setNewTask({
                                ...newTask,
                                config: { ...newTask.config, prompt: e.target.value },
                              })
                            }
                            placeholder="Override character's base prompt..."
                            rows={2}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>Negative Prompt (optional)</Label>
                          <Textarea
                            value={newTask.config.negativePrompt}
                            onChange={(e) =>
                              setNewTask({
                                ...newTask,
                                config: { ...newTask.config, negativePrompt: e.target.value },
                              })
                            }
                            placeholder="Override character's negative prompt..."
                            rows={2}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="grid gap-2">
                            <Label>Steps: {newTask.config.steps}</Label>
                            <Slider
                              value={[newTask.config.steps]}
                              onValueChange={([value]) =>
                                setNewTask({
                                  ...newTask,
                                  config: { ...newTask.config, steps: value },
                                })
                              }
                              max={50}
                              min={10}
                              step={5}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>CFG: {newTask.config.cfg}</Label>
                            <Slider
                              value={[newTask.config.cfg]}
                              onValueChange={([value]) =>
                                setNewTask({
                                  ...newTask,
                                  config: { ...newTask.config, cfg: value },
                                })
                              }
                              max={15}
                              min={1}
                              step={0.5}
                            />
                          </div>
                          <div className="flex items-center space-x-2 pt-6">
                            <Switch
                              id="postToInstagram"
                              checked={newTask.config.postToInstagram}
                              onCheckedChange={(checked) =>
                                setNewTask({
                                  ...newTask,
                                  config: { ...newTask.config, postToInstagram: checked },
                                })
                              }
                            />
                            <Label htmlFor="postToInstagram">Post to Instagram</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button onClick={addScheduledTask} disabled={isLoading}>
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Create Task
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Active Schedules</CardTitle>
                <CardDescription>Automated posting schedules with prompt configurations</CardDescription>
              </CardHeader>
              <CardContent>
                {scheduledTasks.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Character</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Config</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>{task.characterName || "Unknown"}</TableCell>
                          <TableCell>{task.type}</TableCell>
                          <TableCell className="font-mono text-sm">{task.schedule}</TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {task.config?.prompt && <div>Custom prompt</div>}
                              {task.config?.style && <div>Style: {task.config.style}</div>}
                              {task.config?.postToInstagram && <div>✓ Instagram</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={task.active ? "default" : "secondary"}>
                              {task.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleTask(task.id)}
                              disabled={isLoading}
                            >
                              {task.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-gray-600">
                    No scheduled tasks. Create your first task to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deployment" className="space-y-4">
            <h2 className="text-2xl font-bold">Deployment Instructions</h2>
            <Card>
              <CardHeader>
                <CardTitle>Recommended: GitHub Actions (Serverless)</CardTitle>
                <CardDescription>The best choice for most users due to its generous free tier and ease of use.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold">Why GitHub Actions is Perfect:</h4>
                  <ul className="list-disc pl-5 mt-2">
                    <li>✅ **Generous Free Tier:** 2000 minutes/month, enough for ~400 posts.</li>
                    <li>✅ **Serverless:** No infrastructure to manage.</li>
                    <li>✅ **Reliable:** Built-in scheduling, scaling, and monitoring.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold">Setup Steps:</h4>
                  <ol className="list-decimal pl-5 mt-2 space-y-1">
                    <li>Fork the repository.</li>
                    <li>Add the necessary secrets to your GitHub repository (e.g., `HUGGINGFACE_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`).</li>
                    <li>Enable GitHub Actions in your repository settings.</li>
                    <li>Customize the schedule in `.github/workflows/instagram-bot.yml` if needed.</li>
                    <li>Deploy and monitor from the "Actions" tab in your repository.</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Alternative: Local Machine + Cron Job</CardTitle>
                  <CardDescription>For power users who want to run the bot on their own hardware.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold">Pros & Cons:</h4>
                    <ul className="list-disc pl-5 mt-2">
                      <li>✅ **Unlimited Compute:** Use your own hardware&apos;s full power.</li>
                      <li>✅ **Full Control:** Customize everything.</li>
                      <li>❌ **Requires an always-on computer.**</li>
                      <li>❌ **Manual maintenance and updates.**</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold">Setup Steps:</h4>
                    <ol className="list-decimal pl-5 mt-2 space-y-1">
                      <li>Clone the repository locally.</li>
                      <li>Install dependencies with `npm install`.</li>
                      <li>Create a `.env.local` file with your environment variables.</li>
                      <li>Run the application with `npm run dev`.</li>
                      <li>Set up a scheduler (like `cron` on Linux/Mac or Task Scheduler on Windows) to run `node scripts/scheduler-daemon.js` periodically.</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Alternative: Docker Deployment</CardTitle>
                  <CardDescription>For users who prefer containerized deployments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold">Pros & Cons:</h4>
                    <ul className="list-disc pl-5 mt-2">
                      <li>✅ **Consistent Environment:** Runs the same everywhere.</li>
                      <li>✅ **Isolated Dependencies:** No conflicts with other projects.</li>
                      <li>❌ **Requires Docker to be installed.**</li>
                      <li>❌ **Slightly more complex initial setup.**</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold">Setup Steps:</h4>
                    <ol className="list-decimal pl-5 mt-2 space-y-1">
                      <li>Create a `Dockerfile` in your project root (a sample is in the documentation).</li>
                      <li>Build the Docker image: <code className="bg-gray-100 p-1 rounded">{'docker build -t &quot;instagram-ai-bot&quot; .'}</code></li>
                      <li>Run the container, passing your environment variables: <code className="bg-gray-100 p-1 rounded">{'docker run -p 3000:3000 -d --env-file .env.local instagram-ai-bot'}</code></li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <h2 className="text-2xl font-bold">Content Management</h2>
            <Accordion type="single" collapsible className="w-full">
              {characters.map((character) => (
                <AccordionItem key={character.id} value={character.id}>
                  <AccordionTrigger>{character.name}</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <h3 className="font-bold mb-2">Generated Content</h3>
                        <Button onClick={() => generateContent(character.id)} disabled={isLoading}>
                          <Brain className="w-4 h-4 mr-2" />
                          Generate More Content
                        </Button>
                        <div className="grid grid-cols-2 gap-4">
                          {allContent
                            .filter((c) => c.characterId === character.id)
                            .map((contentItem) => (
                              <Card key={contentItem.id}>
                                <CardContent className="p-4">
                                  <Image
                                    src={contentItem.imageUrl}
                                    alt="Generated content"
                                    className="rounded-md mb-2"
                                    width={512}
                                    height={512}
                                  />
                                  <Textarea
                                    value={contentItem.caption}
                                    onChange={(e) => {
                                      const newAllContent = allContent.map((c) =>
                                        c.id === contentItem.id ? { ...c, caption: e.target.value } : c
                                      )
                                      setAllContent(newAllContent)
                                    }}
                                    className="text-sm"
                                  />
                                  <div className="flex justify-between items-center mt-2">
                                    <div className="flex gap-2">
                                      <Badge variant={contentItem.postedToInstagram ? "default" : "secondary"}>
                                        Instagram
                                      </Badge>
                                      <Badge variant={contentItem.postedToTwitter ? "default" : "secondary"}>
                                        X/Twitter
                                      </Badge>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="outline" onClick={() => generateAndPost(contentItem.id)}>
                                        <Instagram className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => postToTwitter(contentItem.id)}>
                                        <Zap className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => deleteContent(contentItem.id)}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold mb-2">Character Settings</h3>
                        <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-name">Character Name</Label>
                        <Input
                          id="edit-name"
                          value={character.name}
                          onChange={(e) => updateCharacter(character.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-triggerWord">Trigger Word</Label>
                        <Input
                          id="edit-triggerWord"
                          value={character.triggerWord}
                          onChange={(e) => updateCharacter(character.id, { triggerWord: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-personality">Personality</Label>
                      <Input
                        id="edit-personality"
                        value={character.personality}
                        onChange={(e) => updateCharacter(character.id, { personality: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-backstory">Backstory</Label>
                      <Textarea
                        id="edit-backstory"
                        value={character.backstory}
                        onChange={(e) => updateCharacter(character.id, { backstory: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="instagram">Instagram Handle</Label>
                          <Input
                            id="instagram"
                            value={character.instagramHandle}
                            onChange={(e) => updateCharacter(character.id, { instagramHandle: e.target.value })}
                            placeholder="@character_handle"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="preferredModel">Preferred Model</Label>
                          <Select
                            value={character.preferredModel}
                            onValueChange={(value) => updateCharacter(character.id, { preferredModel: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableModels.map((model) => (
                                <SelectItem key={model.id} value={model.name}>
                                  {model.name.replace(".safetensors", "").replace(".ckpt", "")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium">API Keys</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="edit-instagram-account-id">Instagram Account ID</Label>
                            <Input
                              id="edit-instagram-account-id"
                              value={character.instagramAccountId}
                              onChange={(e) => updateCharacter(character.id, { instagramAccountId: e.target.value })}
                              placeholder="Enter Instagram Account ID"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="edit-instagram-api-key">Instagram API Key</Label>
                            <Input
                              id="edit-instagram-api-key"
                              type="password"
                              value={character.instagramApiKey}
                              onChange={(e) => updateCharacter(character.id, { instagramApiKey: e.target.value })}
                              placeholder="Enter Instagram API Key"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="edit-twitter-account-id">X/Twitter Account ID</Label>
                            <Input
                              id="edit-twitter-account-id"
                              value={character.twitterAccountId}
                              onChange={(e) => updateCharacter(character.id, { twitterAccountId: e.target.value })}
                              placeholder="Enter X/Twitter Account ID"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="edit-twitter-app-key">X/Twitter App Key</Label>
                            <Input
                              id="edit-twitter-app-key"
                              value={character.twitterAppKey}
                              onChange={(e) => updateCharacter(character.id, { twitterAppKey: e.target.value })}
                              placeholder="Enter X/Twitter App Key"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="edit-twitter-app-secret">X/Twitter App Secret</Label>
                            <Input
                              id="edit-twitter-app-secret"
                              type="password"
                              value={character.twitterAppSecret}
                              onChange={(e) => updateCharacter(character.id, { twitterAppSecret: e.target.value })}
                              placeholder="Enter X/Twitter App Secret"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="edit-twitter-access-token">X/Twitter Access Token</Label>
                            <Input
                              id="edit-twitter-access-token"
                              type="password"
                              value={character.twitterAccessToken}
                              onChange={(e) => updateCharacter(character.id, { twitterAccessToken: e.target.value })}
                              placeholder="Enter X/Twitter Access Token"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="edit-twitter-access-secret">X/Twitter Access Secret</Label>
                            <Input
                              id="edit-twitter-access-secret"
                              type="password"
                              value={character.twitterAccessSecret}
                              onChange={(e) => updateCharacter(character.id, { twitterAccessSecret: e.target.value })}
                              placeholder="Enter X/Twitter Access Secret"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium">Prompt Settings</h4>
                        <div className="grid gap-2">
                          <Label htmlFor="edit-basePrompt">Base Prompt</Label>
                          <Textarea
                            id="edit-basePrompt"
                            value={character.promptSettings?.basePrompt || ""}
                            onChange={(e) => updateCharacter(character.id, { promptSettings: { ...(character.promptSettings || {}), basePrompt: e.target.value } })}
                            placeholder="Base prompt for image generation..."
                            rows={2}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="edit-negativePrompt">Negative Prompt</Label>
                          <Textarea
                            id="edit-negativePrompt"
                            value={character.promptSettings?.negativePrompt || ""}
                            onChange={(e) => updateCharacter(character.id, { promptSettings: { ...(character.promptSettings || {}), negativePrompt: e.target.value } })}
                            placeholder="What to avoid in generation..."
                            rows={2}
                          />
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">System Monitoring</h2>
              <Button onClick={checkSystemStatus} disabled={isLoading}>
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh Status
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ComfyUI Status</CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStatus.comfyui === "online" ? "Online" : "Offline"}</div>
                  <p className="text-xs text-muted-foreground">Image generation service</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Database</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStatus.database === "connected" ? "Connected" : "Disconnected"}
                  </div>
                  <p className="text-xs text-muted-foreground">Data storage status</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Scheduler</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStatus.scheduler === "running" ? "Running" : "Stopped"}
                  </div>
                  <p className="text-xs text-muted-foreground">Automation status</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Instagram API</CardTitle>
                  <Instagram className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStatus.instagram === "connected" ? "Connected" : "Disconnected"}
                  </div>
                  <p className="text-xs text-muted-foreground">Posting capability</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>Real-time system metrics and statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Uptime</span>
                      <span className="text-sm">{systemStatus.uptime}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Memory Usage</span>
                      <span className="text-sm">{systemStatus.memory.percentage}%</span>
                    </div>
                    <Progress value={systemStatus.memory.percentage} />
                    <div className="text-xs text-muted-foreground">
                      {systemStatus.memory.used} / {systemStatus.memory.total}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Last Check</span>
                      <span className="text-sm">{new Date(systemStatus.lastCheck).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{characters.length}</div>
                      <div className="text-xs text-muted-foreground">Characters</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {scheduledTasks.filter((t) => t.active).length}
                      </div>
                      <div className="text-xs text-muted-foreground">Active Tasks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {trainings.filter((t) => t.status === "training").length}
                      </div>
                      <div className="text-xs text-muted-foreground">Training</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{prompts.length}</div>
                      <div className="text-xs text-muted-foreground">Prompts</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
