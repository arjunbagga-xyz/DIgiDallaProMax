#!/usr/bin/env node

/**
 * Scheduler Setup Script
 * Configures local scheduling daemon and cron jobs
 */

const fs = require("fs").promises
const path = require("path")
const { execSync } = require("child_process")
const os = require("os")
const cron = require("node-cron")

const CONFIG = {
  platform: os.platform(),
  schedulerScript: path.join(process.cwd(), "scripts", "scheduler-daemon.js"),
  pidFile: path.join(process.cwd(), "scheduler.pid"),
  logFile: path.join(process.cwd(), "logs", "scheduler.log"),
  configFile: path.join(process.cwd(), "data", "scheduler-config.json"),
  systemdService: "/etc/systemd/system/instagram-ai-bot.service",
  launchdPlist: path.join(os.homedir(), "Library", "LaunchAgents", "com.instagram-ai-bot.plist"),
}

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${new Date().toISOString()} - ${msg}`),
}

// Character reference images (you'll need to replace these with actual URLs)
const CHARACTER_IMAGES = [
  "https://example.com/character-ref-1.jpg",
  "https://example.com/character-ref-2.jpg",
  // Add more reference images for better consistency
]

// Function to run the automation
async function runAutomation() {
  try {
    console.log("Running scheduled automation...")

    // Use a configurable base URL instead of hardcoded localhost
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/automation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "run",
        characterImages: CHARACTER_IMAGES,
      }),
    })

    const result = await response.json()

    if (result.success) {
      console.log("✅ Automation completed successfully!")
      console.log("Prompt used:", result.prompt)
      console.log("Instagram Post ID:", result.postId)
    } else {
      console.error("❌ Automation failed:", result.error)
    }
  } catch (error) {
    console.error("❌ Scheduler error:", error)
  }
}

async function createDirectories() {
  logger.info("Creating necessary directories...")

  const directories = [path.dirname(CONFIG.logFile), path.dirname(CONFIG.configFile), path.join(process.cwd(), "temp")]

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true })
      logger.info(`Created directory: ${path.relative(process.cwd(), dir)}`)
    } catch (error) {
      logger.warn(`Failed to create directory ${dir}: ${error.message}`)
    }
  }

  return true
}

async function createSchedulerConfig() {
  logger.info("Creating scheduler configuration...")

  const config = {
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    settings: {
      checkInterval: 60000, // 1 minute
      maxConcurrentTasks: 3,
      retryAttempts: 3,
      retryDelay: 300000, // 5 minutes
      logLevel: "info",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    defaultSchedules: [
      {
        id: "daily-morning",
        name: "Daily Morning Posts",
        schedule: "0 9 * * *",
        description: "Post content every day at 9 AM",
      },
      {
        id: "daily-evening",
        name: "Daily Evening Posts",
        schedule: "0 18 * * *",
        description: "Post content every day at 6 PM",
      },
      {
        id: "every-6-hours",
        name: "Every 6 Hours",
        schedule: "0 */6 * * *",
        description: "Post content every 6 hours",
      },
      {
        id: "weekly-summary",
        name: "Weekly Summary",
        schedule: "0 10 * * 0",
        description: "Weekly summary every Sunday at 10 AM",
      },
    ],
    tasks: [],
  }

  try {
    // Check if config already exists
    await fs.access(CONFIG.configFile)
    logger.info("Scheduler configuration already exists, skipping creation")
  } catch (error) {
    // Config doesn't exist, create it
    await fs.writeFile(CONFIG.configFile, JSON.stringify(config, null, 2))
    logger.success("Scheduler configuration created")
  }

  return true
}

async function createSystemdService() {
  if (CONFIG.platform !== "linux") {
    logger.info("Skipping systemd service creation (not on Linux)")
    return true
  }

  logger.info("Creating systemd service...")

  const serviceContent = `[Unit]
Description=Instagram AI Bot Scheduler
After=network.target
Wants=network.target

[Service]
Type=simple
User=${os.userInfo().username}
WorkingDirectory=${process.cwd()}
ExecStart=${process.execPath} ${CONFIG.schedulerScript}
Restart=always
RestartSec=10
StandardOutput=append:${CONFIG.logFile}
StandardError=append:${CONFIG.logFile}
Environment=NODE_ENV=production
Environment=PATH=${process.env.PATH}

[Install]
WantedBy=multi-user.target
`

  try {
    // Check if we have sudo access
    execSync("sudo -n true", { stdio: "ignore" })

    // Write service file
    await fs.writeFile("/tmp/instagram-ai-bot.service", serviceContent)
    execSync(`sudo mv /tmp/instagram-ai-bot.service ${CONFIG.systemdService}`)
    execSync(`sudo systemctl daemon-reload`)

    logger.success("Systemd service created")
    logger.info("To enable the service: sudo systemctl enable instagram-ai-bot")
    logger.info("To start the service: sudo systemctl start instagram-ai-bot")

    return true
  } catch (error) {
    logger.warn(`Failed to create systemd service: ${error.message}`)
    logger.info("You can manually create the service later with sudo privileges")
    return false
  }
}

async function createLaunchdPlist() {
  if (CONFIG.platform !== "darwin") {
    logger.info("Skipping launchd plist creation (not on macOS)")
    return true
  }

  logger.info("Creating launchd plist...")

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.instagram-ai-bot</string>
    <key>ProgramArguments</key>
    <array>
        <string>${process.execPath}</string>
        <string>${CONFIG.schedulerScript}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${process.cwd()}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${CONFIG.logFile}</string>
    <key>StandardErrorPath</key>
    <string>${CONFIG.logFile}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PATH</key>
        <string>${process.env.PATH}</string>
    </dict>
</dict>
</plist>
`

  try {
    // Create LaunchAgents directory if it doesn't exist
    await fs.mkdir(path.dirname(CONFIG.launchdPlist), { recursive: true })

    // Write plist file
    await fs.writeFile(CONFIG.launchdPlist, plistContent)

    logger.success("Launchd plist created")
    logger.info(`To load the service: launchctl load ${CONFIG.launchdPlist}`)
    logger.info(`To start the service: launchctl start com.instagram-ai-bot`)

    return true
  } catch (error) {
    logger.warn(`Failed to create launchd plist: ${error.message}`)
    return false
  }
}

async function createWindowsService() {
  if (CONFIG.platform !== "win32") {
    logger.info("Skipping Windows service creation (not on Windows)")
    return true
  }

  logger.info("Creating Windows service script...")

  const batchContent = `@echo off
REM Instagram AI Bot Scheduler Service
title Instagram AI Bot Scheduler

:start
echo Starting Instagram AI Bot Scheduler...
cd /d "${process.cwd()}"
"${process.execPath}" "${CONFIG.schedulerScript}"

echo Scheduler stopped. Restarting in 10 seconds...
timeout /t 10 /nobreak > nul
goto start
`

  const batchPath = path.join(process.cwd(), "start-scheduler.bat")
  await fs.writeFile(batchPath, batchContent)

  logger.success("Windows service script created")
  logger.info(`To start the scheduler: run ${batchPath}`)
  logger.info("For automatic startup, add the batch file to Windows startup folder")

  return true
}

async function createStartStopScripts() {
  logger.info("Creating start/stop scripts...")

  // Start script
  const startScript = `#!/bin/bash
# Instagram AI Bot Scheduler Start Script

SCRIPT_DIR=\$(cd \$(dirname "\$0") && pwd)
PID_FILE="${CONFIG.pidFile}"
LOG_FILE="${CONFIG.logFile}"
SCHEDULER_SCRIPT="${CONFIG.schedulerScript}"

echo "🚀 Starting Instagram AI Bot Scheduler..."

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=\$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "⚠️  Scheduler is already running (PID: $PID)"
        exit 1
    else
        echo "🧹 Removing stale PID file"
        rm "$PID_FILE"
    fi
fi

# Start the scheduler
cd "$SCRIPT_DIR"
nohup node "$SCHEDULER_SCRIPT" >> "$LOG_FILE" 2>&1 &
PID=\!

# Save PID
echo \$PID > "$PID_FILE"

echo "✅ Scheduler started successfully (PID: \$PID)"
echo "📝 Logs: $LOG_FILE"
echo "🛑 To stop: ./stop-scheduler.sh"
`

  // Stop script
  const stopScript = `#!/bin/bash
# Instagram AI Bot Scheduler Stop Script

PID_FILE="${CONFIG.pidFile}"

echo "🛑 Stopping Instagram AI Bot Scheduler..."

if [ ! -f "$PID_FILE" ]; then
    echo "⚠️  PID file not found. Scheduler may not be running."
    exit 1
fi

PID=\$(cat "$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    
    # Wait for process to stop
    for i in {1..10}; do
        if ! kill -0 "$PID" 2>/dev/null; then
            break
        fi
        sleep 1
    done
    
    # Force kill if still running
    if kill -0 "$PID" 2>/dev/null; then
        echo "⚠️  Process didn't stop gracefully, force killing..."
        kill -9 "$PID"
    fi
    
    rm "$PID_FILE"
    echo "✅ Scheduler stopped successfully"
else
    echo "⚠️  Process not running, removing PID file"
    rm "$PID_FILE"
fi
`

  // Status script
  const statusScript = `#!/bin/bash
# Instagram AI Bot Scheduler Status Script

PID_FILE="${CONFIG.pidFile}"
LOG_FILE="${CONFIG.logFile}"

echo "📊 Instagram AI Bot Scheduler Status"
echo "=================================="

if [ -f "$PID_FILE" ]; then
    PID=\$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Status: ✅ Running (PID: $PID)"
        echo "Started: \$(ps -o lstart= -p $PID)"
        echo "Memory: \$(ps -o rss= -p $PID | awk '{print \$1/1024 " MB"}')"
    else
        echo "Status: ❌ Not running (stale PID file)"
    fi
else
    echo "Status: ❌ Not running"
fi

echo ""
echo "📝 Recent logs:"
if [ -f "$LOG_FILE" ]; then
    tail -10 "$LOG_FILE"
else
    echo "No log file found"
fi
`

  const scripts = [
    { name: "start-scheduler.sh", content: startScript },
    { name: "stop-scheduler.sh", content: stopScript },
    { name: "status-scheduler.sh", content: statusScript },
  ]

  for (const script of scripts) {
    const scriptPath = path.join(process.cwd(), script.name)
    await fs.writeFile(scriptPath, script.content)

    // Make executable on Unix systems
    try {
      execSync(`chmod +x ${scriptPath}`)
    } catch (error) {
      // Ignore on Windows
    }

    logger.info(`Created script: ${script.name}`)
  }

  logger.success("Start/stop scripts created")
  return true
}

async function createCronJobs() {
  if (CONFIG.platform === "win32") {
    logger.info("Skipping cron job creation (Windows)")
    return true
  }

  logger.info("Creating cron job examples...")

  const cronExamples = `# Instagram AI Bot Cron Job Examples
# Add these to your crontab with: crontab -e

# Start scheduler on system boot
@reboot cd ${process.cwd()} && ./start-scheduler.sh

# Check scheduler status every hour and restart if needed
0 * * * * cd ${process.cwd()} && ./status-scheduler.sh | grep -q "Not running" && ./start-scheduler.sh

# Daily log rotation at midnight
0 0 * * * cd ${process.cwd()} && mv logs/scheduler.log logs/scheduler.log.\$(date +\\%Y\\%m\\%d) && touch logs/scheduler.log

# Weekly cleanup of old logs (keep last 7 days)
0 1 * * 0 cd ${process.cwd()} && find logs/ -name "scheduler.log.*" -mtime +7 -delete

# Manual character posting examples:
# Post for Luna every day at 9 AM
0 9 * * * cd ${process.cwd()} && CHARACTER_ID=luna node scripts/automated-posting.js

# Post for Alex every 6 hours
0 */6 * * * cd ${process.cwd()} && CHARACTER_ID=alex node scripts/automated-posting.js

# Post for Sage every day at 6 PM
0 18 * * * cd ${process.cwd()} && CHARACTER_ID=sage node scripts/automated-posting.js
`

  const cronPath = path.join(process.cwd(), "cron-examples.txt")
  await fs.writeFile(cronPath, cronExamples)

  logger.success(`Cron examples created: ${cronPath}`)
  return true
}

async function testScheduler() {
  logger.info("Testing scheduler setup...")

  try {
    // Test if scheduler script exists and is executable
    await fs.access(CONFIG.schedulerScript)
    logger.info("✅ Scheduler script found")

    // Test configuration file
    await fs.access(CONFIG.configFile)
    const configData = await fs.readFile(CONFIG.configFile, "utf-8")
    JSON.parse(configData) // Validate JSON
    logger.info("✅ Configuration file valid")

    // Test log directory
    await fs.access(path.dirname(CONFIG.logFile))
    logger.info("✅ Log directory accessible")

    logger.success("Scheduler setup test passed")
    return true
  } catch (error) {
    logger.error(`Scheduler test failed: ${error.message}`)
    return false
  }
}

async function printSetupSummary() {
  logger.info("\n📋 Scheduler Setup Summary:")
  logger.info(`Platform: ${CONFIG.platform}`)
  logger.info(`Scheduler Script: ${CONFIG.schedulerScript}`)
  logger.info(`Configuration: ${CONFIG.configFile}`)
  logger.info(`Log File: ${CONFIG.logFile}`)
  logger.info(`PID File: ${CONFIG.pidFile}`)

  logger.info("\n🚀 Available Commands:")
  logger.info("• ./start-scheduler.sh - Start the scheduler daemon")
  logger.info("• ./stop-scheduler.sh - Stop the scheduler daemon")
  logger.info("• ./status-scheduler.sh - Check scheduler status")

  if (CONFIG.platform === "linux") {
    logger.info("\n🐧 Linux Systemd Service:")
    logger.info("• sudo systemctl enable instagram-ai-bot - Enable auto-start")
    logger.info("• sudo systemctl start instagram-ai-bot - Start service")
    logger.info("• sudo systemctl status instagram-ai-bot - Check status")
  }

  if (CONFIG.platform === "darwin") {
    logger.info("\n🍎 macOS Launchd Service:")
    logger.info(`• launchctl load ${CONFIG.launchdPlist} - Load service`)
    logger.info("• launchctl start com.instagram-ai-bot - Start service")
    logger.info("• launchctl list | grep instagram-ai-bot - Check status")
  }

  if (CONFIG.platform === "win32") {
    logger.info("\n🪟 Windows Service:")
    logger.info("• start-scheduler.bat - Start scheduler")
    logger.info("• Add to startup folder for auto-start")
  }

  logger.info("\n📚 Next Steps:")
  logger.info("1. Configure your characters in the dashboard")
  logger.info("2. Set up scheduled tasks")
  logger.info("3. Start the scheduler daemon")
  logger.info("4. Monitor logs for proper operation")

  logger.info("\n📝 Configuration Files:")
  logger.info(`• ${CONFIG.configFile} - Scheduler settings`)
  logger.info(`• cron-examples.txt - Cron job examples`)
  logger.info(`• ${CONFIG.logFile} - Runtime logs`)
}

async function main() {
  logger.info("⏰ Starting Scheduler Setup...")

  try {
    // Create directories
    if (!(await createDirectories())) {
      process.exit(1)
    }

    // Create configuration
    if (!(await createSchedulerConfig())) {
      process.exit(1)
    }

    // Create platform-specific services
    await createSystemdService()
    await createLaunchdPlist()
    await createWindowsService()

    // Create start/stop scripts
    if (!(await createStartStopScripts())) {
      process.exit(1)
    }

    // Create cron examples
    if (!(await createCronJobs())) {
      process.exit(1)
    }

    // Test setup
    if (!(await testScheduler())) {
      logger.warn("Setup test failed, but installation may still work")
    }

    // Print summary
    await printSetupSummary()

    logger.success("🎉 Scheduler setup completed successfully!")
  } catch (error) {
    logger.error(`Setup failed: ${error.message}`)
    process.exit(1)
  }
}

// Handle process signals
process.on("SIGINT", () => {
  logger.info("Setup interrupted by user")
  process.exit(0)
})

// Run the main function
if (require.main === module) {
  main()
}

module.exports = {
  createDirectories,
  createSchedulerConfig,
  createStartStopScripts,
  testScheduler,
}

console.log("Setting up Instagram AI Character Bot Scheduler...")

// Schedule to run every 6 hours
cron.schedule("0 */6 * * *", runAutomation)

console.log("Scheduler setup complete! The bot will post every 6 hours.")
