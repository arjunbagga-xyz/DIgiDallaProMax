import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign } from "lucide-react"

export default function AutomationDashboard() {
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
          <h1 className="text-3xl font-bold">Dgital Dalla Dashboard</h1>
          <p className="text-gray-500">All your automation needs in one place.</p>
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
          <TabsContent value="characters">{/* Character content here */}</TabsContent>
          <TabsContent value="models">{/* Models & LoRA content here */}</TabsContent>
          <TabsContent value="scheduling">{/* Scheduling content here */}</TabsContent>
          <TabsContent value="deployment">{/* Deployment content here */}</TabsContent>
          <TabsContent value="prompts">{/* Prompts content here */}</TabsContent>
          <TabsContent value="monitoring">{/* Monitoring content here */}</TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
