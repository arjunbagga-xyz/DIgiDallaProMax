"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import {
  DollarSign,
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
} from "lucide-react"

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
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [availableLoras, setAvailableLoras] = useState<string[]>([])
  const [newCharacter, setNewCharacter] = useState({
    name: "",
    personality: "",
    backstory: "",
    instagramHandle: "",
    preferredModel: "",
    triggerWord: "",
    promptSettings: {
      basePrompt: "",
      negativePrompt: "",
      style: "",
      mood: "",
      customPrompts: [] as string[],
    },
  })
  const [generationProgress, setGenerationProgress] = useState<{ [key: string]: number }>({})
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
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null)
  const [deploymentStatus, setDeploymentStatus] = useState<{ [key: string]: any }>({})

  // Load all data
  useEffect(() => {
    loadAllData()

    const interval = setInterval(() => {
      checkSystemStatus()
      loadScheduledTasks()
      loadTrainings()
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const loadAllData = async () => {
    await Promise.all([
      checkSystemStatus(),
      loadCharacters(),
      loadScheduledTasks(),
      loadModels(),
      loadTrainings(),
      loadPrompts(),
      loadAvailableModels(),
    ])
  }

  const checkSystemStatus = async () => {
    try {
      const response = await fetch("/api/system/status")
      if (response.ok) {
        const status = await response.json()
        setSystemStatus(status)
      }
    } catch (error) {
      console.error("Failed to check system status:", error)
    }
  }

  const loadCharacters = async () => {
    try {
      const response = await fetch("/api/characters")
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
  }

  const loadScheduledTasks = async () => {
    try {
      const response = await fetch("/api/scheduler")
      if (response.ok) {
        const data = await response.json()
        setScheduledTasks(data.tasks || [])
      }
    } catch (error) {
      console.error("Failed to load scheduled tasks:", error)
    }
  }

  const loadModels = async () => {
    try {
      const response = await fetch("/api/models")
      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
      }
    } catch (error) {
      console.error("Failed to load models:", error)
    }
  }

  const loadTrainings = async () => {
    try {
      const response = await fetch("/api/lora/train")
      if (response.ok) {
        const data = await response.json()
        setTrainings(data.trainings || [])
      }
    } catch (error) {
      console.error("Failed to load trainings:", error)
    }
  }

  const loadPrompts = async () => {
    try {
      const response = await fetch("/api/prompts")
      if (response.ok) {
        const data = await response.json()
        setPrompts(data.prompts || [])
      }
    } catch (error) {
      console.error("Failed to load prompts:", error)
    }
  }

  const loadAvailableModels = async () => {
    try {
      const response = await fetch("/api/models?action=list")
      if (response.ok) {
        const data = await response.json()
        const checkpoints = data.models.filter((m: ModelInfo) => m.type === "checkpoint").map((m: ModelInfo) => m.name)
        const loras = data.models.filter((m: ModelInfo) => m.type === "lora").map((m: ModelInfo) => m.name)
        setAvailableModels(checkpoints)
        setAvailableLoras(loras)
      }
    } catch (error) {
      console.error("Failed to load available models:", error)
    }
  }

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
      const response = await fetch("/api/characters", {
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
          promptSettings: {
            basePrompt: "",
            negativePrompt: "",
            style: "",
            mood: "",
            customPrompts: [],
          },
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

  const updateCharacter = async (characterId: string, updates: Partial<Character>) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/characters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: characterId, ...updates }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Character updated successfully",
        })
        loadCharacters()
        setEditingCharacter(null)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to update character")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update character",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateImage = async (characterId: string) => {
    const character = characters.find((c) => c.id === characterId)
    if (!character) return

    setIsLoading(true)
    setGenerationProgress({ ...generationProgress, [characterId]: 0 })

    try {
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => ({
          ...prev,
          [characterId]: Math.min((prev[characterId] || 0) + 10, 90),
        }))
      }, 500)

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          model: character.preferredModel,
          prompt: character.promptSettings?.basePrompt,
          negativePrompt: character.promptSettings?.negativePrompt,
          loraPath: character.loraModelPath,
          triggerWord: character.triggerWord,
        }),
      })

      clearInterval(progressInterval)
      setGenerationProgress((prev) => ({ ...prev, [characterId]: 100 }))

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success",
          description: `Image generated successfully for ${result.character}`,
        })

        setTimeout(() => {
          setGenerationProgress((prev) => {
            const newProgress = { ...prev }
            delete newProgress[characterId]
            return newProgress
          })
        }, 2000)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate image")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate image",
        variant: "destructive",
      })
      setGenerationProgress((prev) => {
        const newProgress = { ...prev }
        delete newProgress[characterId]
        return newProgress
      })
    } finally {
      setIsLoading(false)
    }
  }

  const trainLora = async (characterId: string) => {
    const character = characters.find((c) => c.id === characterId)
    if (!character) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/lora/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          characterName: character.name,
          baseModel: character.preferredModel,
          triggerWord: character.triggerWord,
          steps: 1000,
          learningRate: 1e-4,
          trainingImages: [],
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
      const response = await fetch("/api/deployment", {
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
      const response = await fetch("/api/deployment", {
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="characters">Characters</TabsTrigger>
            <TabsTrigger value="models">Models & LoRA</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
            <TabsTrigger value="deployment">Deployment</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
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
                          placeholder="Character's background story..."
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
                                <SelectItem key={model} value={model}>
                                  {model.replace(".safetensors", "").replace(".ckpt", "")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                        <Button size="sm" variant="ghost" onClick={() => setEditingCharacter(character.id)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this character?")) {
                              // Delete character logic here
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
                      <Button size="sm" onClick={() => generateImage(character.id)} disabled={isLoading}>
                        <ImageIcon className="w-4 h-4 mr-1" />
                        Generate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => trainLora(character.id)} disabled={isLoading}>
                        <Brain className="w-4 h-4 mr-1" />
                        Train LoRA
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          // Generate and post logic
                        }}
                        disabled={isLoading}
                      >
                        <Zap className="w-4 h-4 mr-1" />
                        Post
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                  <CardDescription>Checkpoint models detected from ComfyUI</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {availableModels.slice(0, 10).map((model) => (
                      <div key={model} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{model.replace(".safetensors", "").replace(".ckpt", "")}</span>
                          <Badge variant="outline" className="ml-2">
                            {model.includes("flux") ? "Flux" : model.includes("xl") ? "SDXL" : "SD1.5"}
                          </Badge>
                        </div>
                        <Badge variant="default">Available</Badge>
                      </div>
                    ))}
                  </div>
                  {availableModels.length === 0 && (
                    <div className="text-sm text-gray-600">
                      No models found. Make sure ComfyUI is running and models are installed.
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
          </TabsContent>

          <TabsContent value="scheduling" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Content Scheduling</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    /* Run scheduler */
                  }}
                  disabled={isLoading}
                >
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
                              <SelectItem value="generate_and_post">Generate & Post</SelectItem>
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

                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Style</Label>
                            <Input
                              value={newTask.config.style}
                              onChange={(e) =>
                                setNewTask({
                                  ...newTask,
                                  config: { ...newTask.config, style: e.target.value },
                                })
                              }
                              placeholder="e.g., cinematic, portrait"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Mood</Label>
                            <Input
                              value={newTask.config.mood}
                              onChange={(e) =>
                                setNewTask({
                                  ...newTask,
                                  config: { ...newTask.config, mood: e.target.value },
                                })
                              }
                              placeholder="e.g., dramatic, peaceful"
                            />
                          </div>
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
                        <TableHead>Actions</TableHead>
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
                            <Button size="sm" variant="ghost" disabled={isLoading}>
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
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Deployment Options</h2>
              <Button onClick={loadAvailableModels} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Status
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>GitHub Actions</CardTitle>
                  <CardDescription>Free cloud automation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm">✅ Completely free</p>
                    <p className="text-sm">✅ Always running</p>
                    <p className="text-sm">✅ No maintenance</p>
                    <p className="text-sm">⚠️ 2000 min/month limit</p>
                  </div>

                  {deploymentStatus.github && (
                    <div className="p-2 bg-gray-50 rounded text-xs">
                      Status: {deploymentStatus.github.status || "Ready"}
                    </div>
                  )}

                  <Button className="w-full" onClick={deployToGitHub} disabled={isLoading}>
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Github className="w-4 h-4 mr-2" />
                    )}
                    Deploy to GitHub
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vercel</CardTitle>
                  <CardDescription>Serverless deployment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm">✅ Serverless functions</p>
                    <p className="text-sm">✅ Automatic scaling</p>
                    <p className="text-sm">✅ Built-in cron jobs</p>
                    <p className="text-sm">💰 Usage-based pricing</p>
                  </div>

                  {deploymentStatus.vercel && (
                    <div className="p-2 bg-gray-50 rounded text-xs">
                      Status: {deploymentStatus.vercel.status || "Ready"}
                    </div>
                  )}

                  <Button className="w-full" onClick={deployToVercel} disabled={isLoading}>
                    {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    Deploy to Vercel
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Docker</CardTitle>
                  <CardDescription>Containerized deployment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm">✅ Consistent environment</p>
                    <p className="text-sm">✅ Easy scaling</p>
                    <p className="text-sm">✅ Self-hosted</p>
                    <p className="text-sm">💰 Server costs</p>
                  </div>

                  {deploymentStatus.docker && (
                    <div className="p-2 bg-gray-50 rounded text-xs">
                      Status: {deploymentStatus.docker.status || "Ready"}
                    </div>
                  )}

                  <Button className="w-full" onClick={deployToDocker} disabled={isLoading}>
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Setup Docker
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Deployment Status</CardTitle>
                <CardDescription>Monitor your deployments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.keys(deploymentStatus).length > 0 ? (
                    Object.entries(deploymentStatus).map(([platform, status]) => (
                      <div key={platform} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <div className="font-medium capitalize">{platform}</div>
                          <div className="text-sm text-gray-600">{status.message || "Deployment configured"}</div>
                        </div>
                        <Badge variant={status.success ? "default" : "destructive"}>
                          {status.success ? "Success" : "Failed"}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-600">No deployments configured yet.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prompts" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Prompt Management</h2>
              <Button onClick={loadPrompts} disabled={isLoading}>
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh Prompts
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Prompts</CardTitle>
                <CardDescription>AI-generated prompts for your characters</CardDescription>
              </CardHeader>
              <CardContent>
                {prompts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Character</TableHead>
                        <TableHead>Prompt</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prompts.slice(0, 10).map((prompt) => (
                        <TableRow key={prompt.id}>
                          <TableCell>{prompt.characterName}</TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={prompt.prompt}>
                              {prompt.prompt}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(prompt.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={prompt.used ? "default" : "secondary"}>
                              {prompt.used ? "Used" : "Available"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  navigator.clipboard.writeText(prompt.prompt)
                                  toast({ title: "Copied", description: "Prompt copied to clipboard" })
                                }}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => generateImage(prompt.characterId)}>
                                <ImageIcon className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-gray-600">
                    No prompts generated yet. Create a character and generate prompts to see them here.
                  </div>
                )}
              </CardContent>
            </Card>
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
