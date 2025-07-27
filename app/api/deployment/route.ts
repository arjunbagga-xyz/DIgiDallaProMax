import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { spawn } from "child_process"
import { existsSync } from "fs"

interface DeploymentConfig {
  platform: "github-actions" | "vercel" | "docker" | "local"
  environment: "development" | "staging" | "production"
  settings: {
    repositoryUrl?: string
    branch?: string
    buildCommand?: string
    startCommand?: string
    environmentVariables?: Record<string, string>
    secrets?: string[]
    schedule?: string
  }
}

interface DeploymentStatus {
  id: string
  platform: string
  status: "preparing" | "deploying" | "deployed" | "failed"
  progress: number
  logs: string[]
  url?: string
  error?: string
  createdAt: string
  updatedAt: string
}

const deploymentStatuses = new Map<string, DeploymentStatus>()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deploymentId = searchParams.get("id")

    if (deploymentId) {
      const status = deploymentStatuses.get(deploymentId)
      if (!status) {
        return NextResponse.json({ error: "Deployment not found" }, { status: 404 })
      }
      return NextResponse.json(status)
    }

    // Return all deployments
    const allDeployments = Array.from(deploymentStatuses.values())
    return NextResponse.json({
      deployments: allDeployments,
      summary: {
        total: allDeployments.length,
        active: allDeployments.filter((d) => d.status === "deploying").length,
        deployed: allDeployments.filter((d) => d.status === "deployed").length,
        failed: allDeployments.filter((d) => d.status === "failed").length,
      },
    })
  } catch (error) {
    console.error("Failed to get deployments:", error)
    return NextResponse.json({ error: "Failed to get deployments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, platform, config } = body

    switch (action) {
      case "deploy":
        return await startDeployment(platform, config)
      case "setup_github_actions":
        return await setupGitHubActions(config)
      case "setup_vercel":
        return await setupVercel(config)
      case "setup_docker":
        return await setupDocker(config)
      case "generate_config":
        return await generateDeploymentConfig(platform, config)
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Deployment operation failed:", error)
    return NextResponse.json(
      {
        error: "Deployment operation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function startDeployment(platform: string, config: DeploymentConfig) {
  const deploymentId = `deploy_${platform}_${Date.now()}`

  const status: DeploymentStatus = {
    id: deploymentId,
    platform,
    status: "preparing",
    progress: 0,
    logs: [`🚀 Starting ${platform} deployment...`],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  deploymentStatuses.set(deploymentId, status)

  // Start deployment process (async)
  processDeployment(deploymentId, platform, config)

  return NextResponse.json({
    success: true,
    deploymentId,
    message: `${platform} deployment started`,
    status,
  })
}

async function processDeployment(deploymentId: string, platform: string, config: DeploymentConfig) {
  const status = deploymentStatuses.get(deploymentId)
  if (!status) return

  try {
    status.status = "deploying"
    status.progress = 10
    status.logs.push("📦 Preparing deployment files...")

    switch (platform) {
      case "github-actions":
        await deployToGitHubActions(deploymentId, config)
        break
      case "vercel":
        await deployToVercel(deploymentId, config)
        break
      case "docker":
        await deployToDocker(deploymentId, config)
        break
      case "local":
        await deployLocally(deploymentId, config)
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    status.status = "deployed"
    status.progress = 100
    status.updatedAt = new Date().toISOString()
    status.logs.push("✅ Deployment completed successfully!")
  } catch (error) {
    status.status = "failed"
    status.error = error instanceof Error ? error.message : "Unknown error"
    status.updatedAt = new Date().toISOString()
    status.logs.push(`❌ Deployment failed: ${status.error}`)
  }
}

async function deployToGitHubActions(deploymentId: string, config: DeploymentConfig) {
  const status = deploymentStatuses.get(deploymentId);
  if (!status) return;

  status.progress = 20;
  status.logs.push("🔧 Generating GitHub Actions workflow...");

  const workflowDir = join(process.cwd(), ".github", "workflows");
  if (!existsSync(workflowDir)) {
    await mkdir(workflowDir, { recursive: true });
  }

  const workflowContent = generateGitHubActionsWorkflow(config);
  const workflowPath = join(workflowDir, "instagram-automation.yml");
  await writeFile(workflowPath, workflowContent);

  status.progress = 40;
  status.logs.push("📝 Created GitHub Actions workflow file");

  // Simulate git operations and API calls to GitHub
  setTimeout(() => {
    status.progress = 80;
    status.logs.push("📤 Simulating push to GitHub repository");
    status.url = config.settings.repositoryUrl || "https://github.com/your-username/your-repo";
  }, 5000);
}

async function deployToVercel(deploymentId: string, config: DeploymentConfig) {
  const status = deploymentStatuses.get(deploymentId)
  if (!status) return

  status.progress = 20
  status.logs.push("⚡ Preparing Vercel deployment...")

  // Generate vercel.json
  const vercelConfig = {
    functions: {
      "app/api/**/*.ts": {
        maxDuration: 300,
      },
    },
    crons: [
      {
        path: "/api/automation",
        schedule: config.settings.schedule || "0 */6 * * *",
      },
    ],
    env: {
      NODE_ENV: "production",
    },
  }

  await writeFile(join(process.cwd(), "vercel.json"), JSON.stringify(vercelConfig, null, 2))

  status.progress = 50
  status.logs.push("📝 Created vercel.json configuration")

  // Generate deployment script
  const deployScript = `#!/bin/bash
echo "🚀 Deploying to Vercel..."
npx vercel --prod
echo "✅ Deployment complete!"
`

  await writeFile(join(process.cwd(), "deploy-vercel.sh"), deployScript)

  status.progress = 80
  status.logs.push("📜 Created deployment script")
  status.logs.push("ℹ️  Manual step: Run 'npx vercel --prod' to deploy")

  status.url = "https://your-app.vercel.app"
}

async function deployToDocker(deploymentId: string, config: DeploymentConfig) {
  const status = deploymentStatuses.get(deploymentId)
  if (!status) return

  status.progress = 20
  status.logs.push("🐳 Generating Docker configuration...")

  // Generate Dockerfile
  const dockerfile = `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/api/system/status || exit 1

# Start the application
CMD ["npm", "start"]
`

  await writeFile(join(process.cwd(), "Dockerfile"), dockerfile)

  status.progress = 40
  status.logs.push("📝 Created Dockerfile")

  // Generate docker-compose.yml
  const dockerCompose = `version: '3.8'

services:
  instagram-automation:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - INSTAGRAM_ACCESS_TOKEN=\${INSTAGRAM_ACCESS_TOKEN}
    volumes:
      - ./data:/app/data
      - ./models:/app/models
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/system/status"]
      interval: 30s
      timeout: 10s
      retries: 3

  scheduler:
    build: .
    command: node scripts/scheduler-daemon.js
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    depends_on:
      - instagram-automation
`

  await writeFile(join(process.cwd(), "docker-compose.yml"), dockerCompose)

  status.progress = 70
  status.logs.push("📝 Created docker-compose.yml")

  // Generate .dockerignore
  const dockerignore = `node_modules
.next
.git
.env.local
.env.*.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
*.tgz
*.tar.gz
training/
temp/
logs/
`

  await writeFile(join(process.cwd(), ".dockerignore"), dockerignore)

  status.progress = 90
  status.logs.push("📝 Created .dockerignore")
  status.logs.push("ℹ️  Manual step: Run 'docker-compose up -d' to start")

  status.url = "http://localhost:3000"
}

async function deployLocally(deploymentId: string, config: DeploymentConfig) {
  const status = deploymentStatuses.get(deploymentId)
  if (!status) return

  status.progress = 20
  status.logs.push("💻 Setting up local deployment...")

  // Generate start script
  const startScript = `#!/bin/bash
echo "🚀 Starting Instagram AI Bot locally..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Start the scheduler daemon
echo "⏰ Starting scheduler daemon..."
node scripts/scheduler-daemon.js &
SCHEDULER_PID=$!

# Start the web application
echo "🌐 Starting web application..."
npm start &
WEB_PID=$!

# Create PID file
echo $SCHEDULER_PID > scheduler.pid
echo $WEB_PID > web.pid

echo "✅ Instagram AI Bot is running!"
echo "🌐 Web interface: http://localhost:3000"
echo "⏰ Scheduler daemon PID: $SCHEDULER_PID"
echo "🌐 Web server PID: $WEB_PID"
echo ""
echo "To stop the bot, run: ./stop.sh"

# Wait for processes
wait
`

  await writeFile(join(process.cwd(), "start.sh"), startScript)

  status.progress = 50
  status.logs.push("📝 Created start script")

  // Generate stop script
  const stopScript = `#!/bin/bash
echo "🛑 Stopping Instagram AI Bot..."

# Stop scheduler daemon
if [ -f scheduler.pid ]; then
    SCHEDULER_PID=$(cat scheduler.pid)
    if kill -0 $SCHEDULER_PID 2>/dev/null; then
        kill $SCHEDULER_PID
        echo "⏰ Stopped scheduler daemon (PID: $SCHEDULER_PID)"
    fi
    rm scheduler.pid
fi

# Stop web server
if [ -f web.pid ]; then
    WEB_PID=$(cat web.pid)
    if kill -0 $WEB_PID 2>/dev/null; then
        kill $WEB_PID
        echo "🌐 Stopped web server (PID: $WEB_PID)"
    fi
    rm web.pid
fi

echo "✅ Instagram AI Bot stopped!"
`

  await writeFile(join(process.cwd(), "stop.sh"), stopScript)

  status.progress = 80
  status.logs.push("📝 Created stop script")

  // Make scripts executable (on Unix systems)
  try {
    spawn("chmod", ["+x", "start.sh", "stop.sh"])
  } catch (error) {
    // Ignore on Windows
  }

  status.logs.push("ℹ️  Manual step: Run './start.sh' to start the bot")
  status.url = "http://localhost:3000"
}

async function setupGitHubActions(config: any) {
  const workflowContent = generateGitHubActionsWorkflow(config)

  return NextResponse.json({
    success: true,
    message: "GitHub Actions workflow generated",
    workflow: workflowContent,
    nextSteps: [
      "1. Commit the generated workflow file to your repository",
      "2. Configure secrets in GitHub repository settings",
      "3. Push changes to trigger the workflow",
    ],
  })
}

async function setupVercel(config: any) {
  const vercelConfig = {
    functions: {
      "app/api/**/*.ts": {
        maxDuration: 300,
      },
    },
    crons: [
      {
        path: "/api/automation",
        schedule: config.schedule || "0 */6 * * *",
      },
    ],
  }

  return NextResponse.json({
    success: true,
    message: "Vercel configuration generated",
    config: vercelConfig,
    nextSteps: [
      "1. Install Vercel CLI: npm i -g vercel",
      "2. Run: vercel --prod",
      "3. Configure environment variables in Vercel dashboard",
    ],
  })
}

async function setupDocker(config: any) {
  return NextResponse.json({
    success: true,
    message: "Docker configuration generated",
    files: ["Dockerfile", "docker-compose.yml", ".dockerignore"],
    nextSteps: [
      "1. Install Docker and Docker Compose",
      "2. Create .env file with your environment variables",
      "3. Run: docker-compose up -d",
    ],
  })
}

async function generateDeploymentConfig(platform: string, config: any) {
  let generatedConfig = ""

  switch (platform) {
    case "github-actions":
      generatedConfig = generateGitHubActionsWorkflow(config)
      break
    case "vercel":
      generatedConfig = JSON.stringify(
        {
          functions: { "app/api/**/*.ts": { maxDuration: 300 } },
          crons: [{ path: "/api/automation", schedule: "0 */6 * * *" }],
        },
        null,
        2,
      )
      break
    case "docker":
      generatedConfig = generateDockerfile()
      break
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }

  return NextResponse.json({
    success: true,
    platform,
    config: generatedConfig,
    message: `${platform} configuration generated successfully`,
  })
}

function generateGitHubActionsWorkflow(config: DeploymentConfig) {
  return `name: Instagram AI Bot Automation

on:
  schedule:
    # Run every 6 hours
    - cron: '0 */6 * * *'
  workflow_dispatch:
    inputs:
      character:
        description: 'Character to generate for (or "all")'
        required: false
        default: 'all'
      force_run:
        description: 'Force run even if recently posted'
        type: boolean
        default: false

jobs:
  generate-and-post:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        character: [luna, alex, sage]
      fail-fast: false
      max-parallel: 1
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Install Python dependencies
      run: |
        pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
        pip install diffusers transformers accelerate

    - name: Create data directories
      run: |
        mkdir -p data
        mkdir -p logs
        mkdir -p temp

    - name: Generate character content
      env:
        GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
        HUGGINGFACE_TOKEN: \${{ secrets.HUGGINGFACE_TOKEN }}
        BLOB_READ_WRITE_TOKEN: \${{ secrets.BLOB_READ_WRITE_TOKEN }}
        CHARACTER_NAME: \${{ matrix.character }}
        FLUX_MODEL: "flux-dev"
        NODE_ENV: production
      run: |
        echo "🎯 Generating content for \${{ matrix.character }}"
        node scripts/github-character-automation.js

    - name: Post to Instagram
      if: success()
      env:
        INSTAGRAM_ACCESS_TOKEN: \${{ secrets[format('{0}_INSTAGRAM_ACCESS_TOKEN', upper(matrix.character))] }}
        INSTAGRAM_ACCOUNT_ID: \${{ secrets[format('{0}_INSTAGRAM_ACCOUNT_ID', upper(matrix.character))] }}
        CHARACTER_NAME: \${{ matrix.character }}
      run: |
        if [ -n "\$INSTAGRAM_ACCESS_TOKEN" ] && [ -n "\$INSTAGRAM_ACCOUNT_ID" ]; then
          echo "📱 Posting to Instagram for \${{ matrix.character }}"
          node scripts/automated-posting.js
        else
          echo "⚠️ Instagram credentials not configured for \${{ matrix.character }}"
        fi

    - name: Upload artifacts
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: generated-content-\${{ matrix.character }}-\${{ github.run_number }}
        path: |
          temp/
          logs/
        retention-days: 7

    - name: Notify on failure
      if: failure()
      run: |
        echo "❌ Generation failed for \${{ matrix.character }}"
        echo "Check the logs for details"
`
}

function generateDockerfile() {
  return `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/api/system/status || exit 1

# Start the application
CMD ["npm", "start"]
`
}

function generateSecretsDocumentation() {
  return `# GitHub Secrets Configuration

Configure the following secrets in your GitHub repository settings:

## Required Secrets

### AI Generation
- \`GEMINI_API_KEY\` - Your Google Gemini API key
- \`HUGGINGFACE_TOKEN\` - Hugging Face access token for model downloads

### Instagram API (per character)
- \`LUNA_INSTAGRAM_ACCESS_TOKEN\` - Instagram access token for Luna character
- \`LUNA_INSTAGRAM_ACCOUNT_ID\` - Instagram account ID for Luna character
- \`ALEX_INSTAGRAM_ACCESS_TOKEN\` - Instagram access token for Alex character
- \`ALEX_INSTAGRAM_ACCOUNT_ID\` - Instagram account ID for Alex character
- \`SAGE_INSTAGRAM_ACCESS_TOKEN\` - Instagram access token for Sage character
- \`SAGE_INSTAGRAM_ACCOUNT_ID\` - Instagram account ID for Sage character

### Storage (Optional)
- \`BLOB_READ_WRITE_TOKEN\` - Vercel Blob storage token for image storage

## How to Configure Secrets

1. Go to your GitHub repository
2. Click on "Settings" tab
3. Click on "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Add each secret with its corresponding value

## Getting API Keys

### Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and add it as \`GEMINI_API_KEY\`

### Instagram API
1. Create a Facebook Developer account
2. Create a new app and configure Instagram Basic Display
3. Get your access token and account ID
4. Add them as secrets for each character

### Hugging Face Token
1. Go to [Hugging Face Settings](https://huggingface.co/settings/tokens)
2. Create a new access token
3. Copy the token and add it as \`HUGGINGFACE_TOKEN\`
`
}
