#!/usr/bin/env node

/**
 * ComfyUI Connection Test Script
 * Tests ComfyUI server connection and basic functionality
 */

const fetch = require("node-fetch")
const fs = require("fs").promises

const CONFIG = {
  comfyuiUrl: process.env.COMFYUI_URL || "http://localhost:8188",
  timeout: 30000,
  testPrompt: "beautiful landscape, high quality, detailed, professional photography",
  testModel: "flux1-dev.safetensors",
}

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${new Date().toISOString()} - ${msg}`),
}

async function testConnection() {
  logger.info(`Testing connection to ComfyUI at ${CONFIG.comfyuiUrl}...`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${CONFIG.comfyuiUrl}/system_stats`, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const stats = await response.json()
      logger.success("ComfyUI connection successful")
      logger.info(`System stats: ${JSON.stringify(stats, null, 2)}`)
      return true
    } else {
      logger.error(`HTTP ${response.status}: ${response.statusText}`)
      return false
    }
  } catch (error) {
    if (error.name === "AbortError") {
      logger.error("Connection timeout (5 seconds)")
    } else {
      logger.error(`Connection failed: ${error.message}`)
    }
    return false
  }
}

async function testObjectInfo() {
  logger.info("Testing object info endpoint...")

  try {
    const response = await fetch(`${CONFIG.comfyuiUrl}/object_info`)

    if (!response.ok) {
      logger.error(`HTTP ${response.status}: ${response.statusText}`)
      return false
    }

    const objectInfo = await response.json()
    logger.success("Object info retrieved successfully")

    // Check for required nodes
    const requiredNodes = ["CheckpointLoaderSimple", "CLIPTextEncode", "KSampler", "VAEDecode", "SaveImage"]
    const availableNodes = Object.keys(objectInfo)

    logger.info("Checking required nodes...")
    for (const node of requiredNodes) {
      if (availableNodes.includes(node)) {
        logger.success(`✅ ${node} - Available`)
      } else {
        logger.error(`❌ ${node} - Missing`)
      }
    }

    // Check available models
    if (objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]) {
      const models = objectInfo.CheckpointLoaderSimple.input.required.ckpt_name[0]
      logger.info(`Available models: ${models.length}`)
      models.slice(0, 5).forEach((model) => logger.info(`  - ${model}`))
      if (models.length > 5) {
        logger.info(`  ... and ${models.length - 5} more`)
      }

      // Check if test model is available
      if (models.includes(CONFIG.testModel)) {
        logger.success(`✅ Test model found: ${CONFIG.testModel}`)
      } else {
        logger.warn(`⚠️  Test model not found: ${CONFIG.testModel}`)
        logger.info("Available models for testing:")
        models.slice(0, 3).forEach((model) => logger.info(`  - ${model}`))
      }
    } else {
      logger.warn("No checkpoint models found")
    }

    return true
  } catch (error) {
    logger.error(`Object info test failed: ${error.message}`)
    return false
  }
}

async function testQueue() {
  logger.info("Testing queue endpoint...")

  try {
    const response = await fetch(`${CONFIG.comfyuiUrl}/queue`)

    if (!response.ok) {
      logger.error(`HTTP ${response.status}: ${response.statusText}`)
      return false
    }

    const queueData = await response.json()
    logger.success("Queue endpoint accessible")
    logger.info(`Queue running: ${queueData.queue_running?.length || 0}`)
    logger.info(`Queue pending: ${queueData.queue_pending?.length || 0}`)

    return true
  } catch (error) {
    logger.error(`Queue test failed: ${error.message}`)
    return false
  }
}

async function createTestWorkflow() {
  logger.info('Creating test workflow...')
  
  const workflow = {
    "1": {
      "inputs": {
        "ckpt_name": CONFIG.testModel
      },
      "class_type": "CheckpointLoaderSimple",
      "_meta": {
        "title": "Load Checkpoint"
      }
    },
    "2": {
      "inputs": {
        "text": CONFIG.testPrompt,
        "clip": ["1", 1]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Prompt)"
      }
    },
    "3": {
      "inputs": {
        "text": "blurry, low quality, distorted",
        "clip": ["1", 1]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Negative)"
      }
    },
    "4": {
      "inputs": {
        "width": 512,
        "height": 512,
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage",
      "_meta": {
        "title": "Empty Latent Image"
      }
    },
    "5": {
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000),
        "steps": 10, // Reduced steps for faster testing
        "cfg": 7.5,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1.0,
        "model": ["1", 0],
        "positive": ["2", 0],
        "negative": ["3", 0],
        "latent_image": ["4", 0]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "KSampler"
      }
    },
    "6": {
      "inputs": {
        "samples": ["5", 0],
        "vae": ["1", 2]
      },
      "class\
