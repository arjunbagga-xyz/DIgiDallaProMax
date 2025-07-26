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
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import {
  DollarSign,
  Plus,
  Play,
  Settings,
  User,
  Brain,
  Upload,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  ImageIcon,
  Github,
  Database,
  Cpu,
} from "lucide-react"
import { Instagram, Zap } from "lucide-react" // Import Instagram and Zap icons

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
}

interface SystemStatus {
  comfyui: "online" | "offline" | "error"
  database: "connected" | "disconnected" | "error"
  scheduler: "running" | "stopped" | "error"
  instagram: "connected" | "disconnected" | "error"
}

export default function AutomationDashboard() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    comfyui: "offline",
    database: "disconnected",
    scheduler: "stopped",
    instagram: "disconnected",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [newCharacter, setNewCharacter] = useState({
    name: "",
    personality: "",
    backstory: "",
    instagramHandle: "",
  })

  // Load system status
  useEffect(() => {
    checkSystemStatus()
    const interval = setInterval(checkSystemStatus, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const checkSystemStatus = async () => {
    try {
      const response = await fetch("/api/system/status")
      const status = await response.json()
      setSystemStatus(status)
    } catch (error) {
      console.error("Failed to check system status:", error)
    }
  }

  const loadCharacters = async () => {
    try {
      const response = await fetch("/api/characters")
      const data = await response.json()
      setCharacters(data.characters || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load characters",
        variant: "destructive",
      })
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
        setNewCharacter({ name: "", personality: "", backstory: "", instagramHandle: "" })
        loadCharacters()
      } else {
        throw new Error("Failed to create character")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create character",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateImage = async (characterId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Image generation started",
        })
      } else {
        throw new Error("Failed to generate image")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate image",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const trainLora = async (characterId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/lora/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "LoRA training started",
        })
      } else {
        throw new Error("Failed to start training")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start LoRA training",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runScheduler = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/scheduler/run", {
        method: "POST",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Scheduler executed successfully",
        })
      } else {
        throw new Error("Failed to run scheduler")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run scheduler",
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

  useEffect(() => {
    loadCharacters()
  }, [])

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
          <p className="text-gray-500">AI-powered Instagram automation for multiple characters</p>

          {/* System Status */}
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Character
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Character</DialogTitle>
                    <DialogDescription>Add a new AI character with unique personality and backstory.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
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
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="instagram">Instagram Handle</Label>
                      <Input
                        id="instagram"
                        value={newCharacter.instagramHandle}
                        onChange={(e) => setNewCharacter({ ...newCharacter, instagramHandle: e.target.value })}
                        placeholder="@character_handle"
                      />
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {characters.map((character) => (
                <Card key={character.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {character.name}
                    </CardTitle>
                    <CardDescription>{character.personality}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600">{character.backstory}</p>
                    <div className="flex items-center gap-2">
                      <Instagram className="w-4 h-4" />
                      <span className="text-sm">{character.instagramHandle}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => generateImage(character.id)} disabled={isLoading}>
                        <ImageIcon className="w-4 h-4 mr-1" />
                        Generate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => trainLora(character.id)} disabled={isLoading}>
                        <Brain className="w-4 h-4 mr-1" />
                        Train LoRA
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
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Upload Model
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Flux Models</CardTitle>
                  <CardDescription>Base models for image generation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Flux.1-dev</span>
                      <Badge>Active</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Flux.1-schnell</span>
                      <Badge variant="secondary">Available</Badge>
                    </div>
                  </div>
                  <Button className="w-full mt-4 bg-transparent" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download Models
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>LoRA Training</CardTitle>
                  <CardDescription>Custom character models</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Luna Training</span>
                        <span className="text-sm">75%</span>
                      </div>
                      <Progress value={75} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Alex Training</span>
                        <span className="text-sm">Complete</span>
                      </div>
                      <Progress value={100} />
                    </div>
                  </div>
                  <Button className="w-full mt-4">
                    <Zap className="w-4 h-4 mr-2" />
                    Start New Training
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scheduling" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Content Scheduling</h2>
              <div className="flex gap-2">
                <Button onClick={runScheduler} disabled={isLoading}>
                  {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Run Now
                </Button>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Active Schedules</CardTitle>
                  <CardDescription>Automated posting schedules</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Character</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Next Run</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Luna</TableCell>
                        <TableCell>Daily 6 PM</TableCell>
                        <TableCell>Today 6:00 PM</TableCell>
                        <TableCell>
                          <Badge>Active</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Alex</TableCell>
                        <TableCell>Mon/Wed/Fri 12 PM</TableCell>
                        <TableCell>Wed 12:00 PM</TableCell>
                        <TableCell>
                          <Badge>Active</Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scheduler Settings</CardTitle>
                  <CardDescription>Configure automation behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-recovery">Auto Recovery</Label>
                    <Switch id="auto-recovery" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifications">Notifications</Label>
                    <Switch id="notifications" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Posting Time</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning (9 AM)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (2 PM)</SelectItem>
                        <SelectItem value="evening">Evening (6 PM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full">
                    <Settings className="w-4 h-4 mr-2" />
                    Save Settings
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="deployment" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Deployment Options</h2>
              <Button>
                <Github className="w-4 h-4 mr-2" />
                Deploy to GitHub
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Local Development</CardTitle>
                  <CardDescription>Run on your machine</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm">✅ Full control</p>
                    <p className="text-sm">✅ No usage limits</p>
                    <p className="text-sm">✅ Instant updates</p>
                    <p className="text-sm">❌ Requires always-on PC</p>
                  </div>
                  <Button className="w-full bg-transparent" variant="outline">
                    <Play className="w-4 h-4 mr-2" />
                    Start Local
                  </Button>
                </CardContent>
              </Card>

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
                  <Button className="w-full">
                    <Github className="w-4 h-4 mr-2" />
                    Setup Actions
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Self-Hosted</CardTitle>
                  <CardDescription>Your own server</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm">✅ Maximum control</p>
                    <p className="text-sm">✅ No limits</p>
                    <p className="text-sm">✅ Custom scaling</p>
                    <p className="text-sm">💰 Server costs</p>
                  </div>
                  <Button className="w-full bg-transparent" variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Deploy Server
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="prompts" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Prompt Management</h2>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Generate Prompts
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Prompts</CardTitle>
                <CardDescription>AI-generated prompts for your characters</CardDescription>
              </CardHeader>
              <CardContent>
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
                    <TableRow>
                      <TableCell>Luna</TableCell>
                      <TableCell className="max-w-xs truncate">
                        A mystical moon goddess standing in a ethereal forest...
                      </TableCell>
                      <TableCell>2 hours ago</TableCell>
                      <TableCell>
                        <Badge>Used</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Alex</TableCell>
                      <TableCell className="max-w-xs truncate">
                        A confident urban explorer discovering hidden...
                      </TableCell>
                      <TableCell>5 hours ago</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Pending</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">System Monitoring</h2>
              <Button onClick={checkSystemStatus}>
                <RefreshCw className="w-4 h-4 mr-2" />
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
                <CardDescription>Real-time system metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">CPU Usage</span>
                      <span className="text-sm">45%</span>
                    </div>
                    <Progress value={45} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Memory Usage</span>
                      <span className="text-sm">62%</span>
                    </div>
                    <Progress value={62} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Storage Usage</span>
                      <span className="text-sm">28%</span>
                    </div>
                    <Progress value={28} />
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
