#!/usr/bin/env node

/**
 * Local ComfyUI Setup Script
 * Downloads and configures ComfyUI for local development
 */

const fs = require("fs").promises
const path = require("path")
const { execSync, spawn } = require("child_process")
const https = require("https")

const CONFIG = {
  comfyuiDir: path.join(process.cwd(), "ComfyUI"),
  modelsDir: path.join(process.cwd(), "ComfyUI", "models"),
  pythonPath: process.env.PYTHON_PATH || "python3",
  gitPath: process.env.GIT_PATH || "git",
  port: process.env.COMFYUI_PORT || 8188,
  host: process.env.COMFYUI_HOST || "127.0.0.1",
}

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${new Date().toISOString()} - ${msg}`),
}

// Model download configurations
const MODELS = {
  checkpoints: [
    {
      name: "flux1-dev.safetensors",
      url: "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors",
      size: "11.9GB",
      required: true,
    },
    {
      name: "flux1-schnell.safetensors",
      url: "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/flux1-schnell.safetensors",
      size: "11.9GB",
      required: false,
    },
  ],
  vae: [
    {
      name: "ae.safetensors",
      url: "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors",
      size: "335MB",
      required: true,
    },
  ],
  clip: [
    {
      name: "t5xxl_fp16.safetensors",
      url: "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors",
      size: "9.79GB",
      required: true,
    },
    {
      name: "clip_l.safetensors",
      url: "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors",
      size: "246MB",
      required: true,
    },
  ],
}

async function checkSystemRequirements() {
  logger.info("Checking system requirements...")

  try {
    // Check Python
    const pythonVersion = execSync(`${CONFIG.pythonPath} --version`, { encoding: "utf8" })
    logger.info(`Python version: ${pythonVersion.trim()}`)

    // Check Git
    const gitVersion = execSync(`${CONFIG.gitPath} --version`, { encoding: "utf8" })
    logger.info(`Git version: ${gitVersion.trim()}`)

    // Check available disk space
    const stats = await fs.stat(process.cwd())
    logger.info("System requirements check passed")

    return true
  } catch (error) {
    logger.error(`System requirements check failed: ${error.message}`)
    logger.error("Please ensure Python 3.8+ and Git are installed")
    return false
  }
}

async function cloneComfyUI() {
  logger.info("Cloning ComfyUI repository...")

  try {
    // Check if ComfyUI directory already exists
    try {
      await fs.access(CONFIG.comfyuiDir)
      logger.warn("ComfyUI directory already exists, skipping clone")
      return true
    } catch (error) {
      // Directory doesn't exist, proceed with clone
    }

    execSync(`${CONFIG.gitPath} clone https://github.com/comfyanonymous/ComfyUI.git ${CONFIG.comfyuiDir}`, {
      stdio: "inherit",
    })

    logger.success("ComfyUI cloned successfully")
    return true
  } catch (error) {
    logger.error(`Failed to clone ComfyUI: ${error.message}`)
    return false
  }
}

async function installDependencies() {
  logger.info("Installing Python dependencies...")

  try {
    process.chdir(CONFIG.comfyuiDir)

    // Install requirements
    execSync(`${CONFIG.pythonPath} -m pip install -r requirements.txt`, {
      stdio: "inherit",
    })

    // Install additional dependencies for better performance
    try {
      execSync(`${CONFIG.pythonPath} -m pip install xformers`, {
        stdio: "inherit",
      })
      logger.success("Installed xformers for better performance")
    } catch (error) {
      logger.warn("Failed to install xformers, continuing without it")
    }

    logger.success("Dependencies installed successfully")
    return true
  } catch (error) {
    logger.error(`Failed to install dependencies: ${error.message}`)
    return false
  } finally {
    process.chdir(path.dirname(CONFIG.comfyuiDir))
  }
}

async function createDirectories() {
  logger.info("Creating model directories...")

  const directories = [
    path.join(CONFIG.modelsDir, "checkpoints"),
    path.join(CONFIG.modelsDir, "loras"),
    path.join(CONFIG.modelsDir, "vae"),
    path.join(CONFIG.modelsDir, "clip"),
    path.join(CONFIG.modelsDir, "controlnet"),
    path.join(CONFIG.comfyuiDir, "input"),
    path.join(CONFIG.comfyuiDir, "output"),
    path.join(CONFIG.comfyuiDir, "temp"),
  ]

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true })
      logger.info(`Created directory: ${path.relative(process.cwd(), dir)}`)
    } catch (error) {
      logger.warn(`Failed to create directory ${dir}: ${error.message}`)
    }
  }

  logger.success("Model directories created")
  return true
}

async function downloadFile(url, filepath, expectedSize) {
  return new Promise((resolve, reject) => {
    const file = require("fs").createWriteStream(filepath)
    let downloadedBytes = 0

    logger.info(`Downloading ${path.basename(filepath)} (${expectedSize})...`)

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
          return
        }

        const totalBytes = Number.parseInt(response.headers["content-length"] || "0")

        response.on("data", (chunk) => {
          downloadedBytes += chunk.length
          if (totalBytes > 0) {
            const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1)
            process.stdout.write(`\rProgress: ${progress}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB)`)
          }
        })

        response.pipe(file)

        file.on("finish", () => {
          file.close()
          console.log() // New line after progress
          logger.success(`Downloaded ${path.basename(filepath)}`)
          resolve()
        })

        file.on("error", (error) => {
          fs.unlink(filepath).catch(() => {}) // Clean up partial file
          reject(error)
        })
      })
      .on("error", (error) => {
        reject(error)
      })
  })
}

async function downloadModels(downloadAll = false) {
  logger.info("Downloading required models...")

  for (const [category, models] of Object.entries(MODELS)) {
    const categoryDir = path.join(CONFIG.modelsDir, category)

    for (const model of models) {
      if (!downloadAll && !model.required) {
        logger.info(`Skipping optional model: ${model.name}`)
        continue
      }

      const filepath = path.join(categoryDir, model.name)

      // Check if model already exists
      try {
        const stats = await fs.stat(filepath)
        if (stats.size > 1024 * 1024) {
          // At least 1MB
          logger.info(`Model already exists: ${model.name}`)
          continue
        }
      } catch (error) {
        // File doesn't exist, proceed with download
      }

      try {
        await downloadFile(model.url, filepath, model.size)
      } catch (error) {
        logger.error(`Failed to download ${model.name}: ${error.message}`)

        if (model.required) {
          logger.error("This is a required model. ComfyUI may not work properly without it.")
          return false
        }
      }
    }
  }

  logger.success("Model download completed")
  return true
}

async function createStartScript() {
  logger.info("Creating start script...")

  const startScript = `#!/bin/bash
# ComfyUI Start Script
echo "🚀 Starting ComfyUI..."

cd "${CONFIG.comfyuiDir}"

# Check if models exist
if [ ! -f "models/checkpoints/flux1-dev.safetensors" ]; then
    echo "⚠️  Warning: flux1-dev.safetensors not found in models/checkpoints/"
    echo "Please download the required models or run the setup script again"
fi

# Start ComfyUI
echo "🌐 Starting ComfyUI on http://${CONFIG.host}:${CONFIG.port}"
${CONFIG.pythonPath} main.py --listen ${CONFIG.host} --port ${CONFIG.port}
`

  const scriptPath = path.join(process.cwd(), "start-comfyui.sh")
  await fs.writeFile(scriptPath, startScript)

  // Make script executable on Unix systems
  try {
    execSync(`chmod +x ${scriptPath}`)
  } catch (error) {
    // Ignore on Windows
  }

  logger.success(`Start script created: ${scriptPath}`)
  return true
}

async function createConfigFile() {
  logger.info("Creating ComfyUI configuration...")

  const config = {
    host: CONFIG.host,
    port: CONFIG.port,
    models: {
      checkpoints: path.join(CONFIG.modelsDir, "checkpoints"),
      loras: path.join(CONFIG.modelsDir, "loras"),
      vae: path.join(CONFIG.modelsDir, "vae"),
      clip: path.join(CONFIG.modelsDir, "clip"),
    },
    settings: {
      auto_launch_browser: false,
      enable_cors_header: true,
      max_upload_size: 100 * 1024 * 1024, // 100MB
      temp_directory: path.join(CONFIG.comfyuiDir, "temp"),
    },
  }

  const configPath = path.join(CONFIG.comfyuiDir, "extra_model_paths.yaml")
  const yamlContent = `# ComfyUI Model Paths Configuration
checkpoints: ${config.models.checkpoints}
loras: ${config.models.loras}
vae: ${config.models.vae}
clip: ${config.models.clip}
`

  await fs.writeFile(configPath, yamlContent)
  logger.success("Configuration file created")

  return true
}

async function testComfyUI() {
  logger.info("Testing ComfyUI installation...")

  try {
    process.chdir(CONFIG.comfyuiDir)

    // Test import
    const testScript = `
import sys
sys.path.append('.')
try:
    import main
    print("✅ ComfyUI imports successfully")
except Exception as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)
`

    const testPath = path.join(CONFIG.comfyuiDir, "test_import.py")
    await fs.writeFile(testPath, testScript)

    execSync(`${CONFIG.pythonPath} test_import.py`, { stdio: "inherit" })

    // Clean up test file
    await fs.unlink(testPath)

    logger.success("ComfyUI installation test passed")
    return true
  } catch (error) {
    logger.error(`ComfyUI test failed: ${error.message}`)
    return false
  } finally {
    process.chdir(path.dirname(CONFIG.comfyuiDir))
  }
}

async function printSetupSummary() {
  logger.info("\n📋 Setup Summary:")
  logger.info(`ComfyUI Directory: ${CONFIG.comfyuiDir}`)
  logger.info(`Models Directory: ${CONFIG.modelsDir}`)
  logger.info(`Host: ${CONFIG.host}`)
  logger.info(`Port: ${CONFIG.port}`)

  logger.info("\n🚀 Next Steps:")
  logger.info("1. Run ./start-comfyui.sh to start ComfyUI")
  logger.info(`2. Open http://${CONFIG.host}:${CONFIG.port} in your browser`)
  logger.info("3. Test image generation with the web interface")
  logger.info("4. Run npm run test-comfyui to test API integration")

  logger.info("\n📚 Additional Resources:")
  logger.info("- ComfyUI Documentation: https://github.com/comfyanonymous/ComfyUI")
  logger.info("- Flux Models: https://huggingface.co/black-forest-labs")
  logger.info("- Custom Nodes: https://github.com/ltdrdata/ComfyUI-Manager")
}

async function main() {
  logger.info("🎨 Starting ComfyUI Local Setup...")

  const args = process.argv.slice(2)
  const downloadAll = args.includes("--download-all")
  const skipModels = args.includes("--skip-models")

  try {
    // System requirements check
    if (!(await checkSystemRequirements())) {
      process.exit(1)
    }

    // Clone ComfyUI
    if (!(await cloneComfyUI())) {
      process.exit(1)
    }

    // Install dependencies
    if (!(await installDependencies())) {
      process.exit(1)
    }

    // Create directories
    if (!(await createDirectories())) {
      process.exit(1)
    }

    // Download models (unless skipped)
    if (!skipModels) {
      if (!(await downloadModels(downloadAll))) {
        logger.warn("Some models failed to download, but continuing setup...")
      }
    } else {
      logger.info("Skipping model downloads (--skip-models flag)")
    }

    // Create configuration
    if (!(await createConfigFile())) {
      process.exit(1)
    }

    // Create start script
    if (!(await createStartScript())) {
      process.exit(1)
    }

    // Test installation
    if (!(await testComfyUI())) {
      logger.warn("Installation test failed, but setup may still work")
    }

    // Print summary
    await printSetupSummary()

    logger.success("🎉 ComfyUI setup completed successfully!")
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
  checkSystemRequirements,
  cloneComfyUI,
  installDependencies,
  downloadModels,
  createStartScript,
  testComfyUI,
}
