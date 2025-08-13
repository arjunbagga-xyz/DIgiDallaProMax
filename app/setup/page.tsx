"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, RefreshCw } from "lucide-react"

interface SystemStatus {
  comfyui: boolean
  gemini: boolean
  huggingface: boolean
  instagram: boolean
  scheduler: boolean
}

export default function SetupPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const checkStatus = async () => {
    setLoading(true)
    try {
      const baseUrl = window.location.origin
      const response = await fetch(`${baseUrl}/api/system/status`)
      const data = await response.json()
      setStatus(data.status)
    } catch (error) {
      console.error("Failed to check status:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const StatusIcon = ({ isHealthy }: { isHealthy: boolean }) => {
    if (isHealthy) return <CheckCircle className="w-5 h-5 text-green-500" />
    return <XCircle className="w-5 h-5 text-red-500" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">System Setup & Status</h1>
          <p className="text-gray-600">Check system health and configure components</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>System Health Check</CardTitle>
              <Button onClick={checkStatus} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <CardDescription>Verify all components are properly configured</CardDescription>
          </CardHeader>
          <CardContent>
            {status ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">ComfyUI</div>
                    <div className="text-sm text-gray-600">Local image generation</div>
                  </div>
                  <StatusIcon isHealthy={status.comfyui} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Gemini API</div>
                    <div className="text-sm text-gray-600">Prompt generation</div>
                  </div>
                  <StatusIcon isHealthy={status.gemini} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Hugging Face</div>
                    <div className="text-sm text-gray-600">Cloud image generation</div>
                  </div>
                  <StatusIcon isHealthy={status.huggingface} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Instagram API</div>
                    <div className="text-sm text-gray-600">Social media posting</div>
                  </div>
                  <StatusIcon isHealthy={status.instagram} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Local Scheduler</div>
                    <div className="text-sm text-gray-600">Automated posting</div>
                  </div>
                  <StatusIcon isHealthy={status.scheduler} />
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Checking system status...</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Setup</CardTitle>
              <CardDescription>Essential configuration steps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">1. Environment Variables</h4>
                <p className="text-sm text-gray-600">Configure API keys in .env.local</p>
                <a href="https://github.com/your-username/your-repo/edit/main/.env.local" target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    Edit Environment
                  </Button>
                </a>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">2. Character Setup</h4>
                <p className="text-sm text-gray-600">Create and configure your AI characters</p>
                <a href="/#characters">
                  <Button size="sm" variant="outline">
                    Manage Characters
                  </Button>
                </a>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">3. Instagram Accounts</h4>
                <p className="text-sm text-gray-600">Connect Instagram business accounts</p>
                <a href="/#monitoring">
                  <Button size="sm" variant="outline">
                    Setup Instagram
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deployment Options</CardTitle>
              <CardDescription>Choose how to run your automation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 border rounded-lg">
                <div className="font-medium mb-1">Local + GitHub Actions</div>
                <div className="text-sm text-gray-600 mb-2">Recommended: Local primary, cloud backup</div>
                <a href="/#deployment">
                  <Button size="sm">Deploy Hybrid</Button>
                </a>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="font-medium mb-1">Local Only</div>
                <div className="text-sm text-gray-600 mb-2">Full control, unlimited generation</div>
                <a href="/#deployment">
                  <Button size="sm" variant="outline">
                    Start Local
                  </Button>
                </a>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="font-medium mb-1">Cloud Only</div>
                <div className="text-sm text-gray-600 mb-2">GitHub Actions serverless</div>
                <a href="/#deployment">
                  <Button size="sm" variant="outline">
                    Deploy Cloud
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
