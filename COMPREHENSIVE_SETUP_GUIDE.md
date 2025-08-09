# Comprehensive Setup Guide: Advanced Multi-Character Instagram AI Bot

This system provides everything you requested: multiple characters, LoRA training, local/cloud deployment, Gemini prompts, scheduling, and a complete management UI.

## 🎯 Features Implemented

### ✅ Character Management
- **Multiple Characters**: Each with unique personality, backstory, and narrative
- **Individual Instagram Accounts**: Separate credentials and posting schedules
- **Character LoRAs**: Custom trained models for visual consistency
- **Ongoing Narratives**: AI-generated story progression for each character

### ✅ LoRA Training & Management
- **Any Flux Model Support**: flux-dev, flux-schnell, flux-pro, flux-fill
- **Automated Training**: Kohya SS integration for LoRA training
- **Training Queue**: Manage multiple training jobs
- **Quality Assessment**: Test and retrain LoRAs as needed

### ✅ Deployment Options
- **Local Execution**: Full ComfyUI integration with unlimited generation
- **GitHub Actions**: Cloud backup with 2000 minutes/month free
- **Hybrid Approach**: Local primary, cloud fallback
- **Missed Run Recovery**: Automatic catch-up when system comes back online

### ✅ AI-Powered Prompts
- **Gemini Integration**: Context-aware prompt generation
- **Character Consistency**: Prompts reflect personality and ongoing story
- **Seasonal Adaptation**: Considers time, season, and trending topics
- **Narrative Continuity**: Builds on previous posts and character development

### ✅ Advanced Scheduling
- **Individual Schedules**: Each character has separate posting times
- **Local Scheduler**: Cron-based with missed run detection
- **Cloud Backup**: GitHub Actions as fallback
- **Smart Recovery**: Executes missed posts when system comes online

### ✅ Complete Management UI
- **Character Dashboard**: Manage all characters from one interface
- **LoRA Training Interface**: Start, monitor, and manage training jobs
- **Scheduling Control**: Set up and modify posting schedules
- **Deployment Management**: Control local and cloud deployments
- **Real-time Monitoring**: System health, usage stats, and activity logs

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository>
cd instagram-automation
npm install
```

### 2. Set Up Environment Variables
Copy `.env.example` to `.env.local` and configure:
- Gemini API key for prompt generation
- Hugging Face token for image generation
- Instagram Graph API credentials for each character
- ComfyUI URL if running locally

### 3. Configure Characters
Use the UI or edit `data/characters.json`:
- Add character profiles with backstories
- Set up Instagram account credentials
- Define posting schedules
- Configure LoRA models

### 4. Train Character LoRAs (Optional)
- Upload 10-20 character images via UI
- Start training process
- Monitor progress in training queue
- Test and deploy trained LoRAs

### 5. Deploy
Choose your deployment strategy:

**Local + Cloud Hybrid (Recommended):**
```bash
# Start local scheduler
npm run start:scheduler

# Deploy to GitHub Actions as backup
npm run deploy:github
```

**Local Only:**
```bash
# Start ComfyUI
python ComfyUI/main.py --listen 0.0.0.0 --port 8188

# Start local scheduler
npm run start:scheduler
```

**Cloud Only:**
```bash
# Deploy to GitHub Actions
npm run deploy:github
```

## 🗃️ Database System

The application uses a simple and effective file-based database system. All data is stored in JSON files within the `data/` directory. This approach is lightweight, easy to manage, and fits perfectly with the zero-cost deployment model.

### `data/characters.json`

This is the core database file, storing an array of character objects. Each object contains all the information needed to define a character, including their personality, API keys, and settings.

**Example `character` object:**

```json
{
  "id": "char_1754528276811_4suaz8mqv",
  "name": "Luna the Mystic",
  "personality": "Dreamy and mystical",
  "backstory": "Luna is a mysterious character who lives in a hidden forest.",
  "instagramHandle": "@luna_mystic",
  "isActive": true,
  "createdAt": "2025-08-07T00:57:56.811Z",
  "updatedAt": "2025-08-08T10:30:00.000Z",
  "preferredModel": "sdxl_dreamshaper.safetensors",
  "triggerWord": "luna_character",
  "promptSettings": {
    "basePrompt": "a beautiful portrait of luna_character",
    "negativePrompt": "ugly, disfigured",
    "style": "artistic",
    "mood": "serene"
  },
  "narratives": [
    {
      "id": "narr_1",
      "title": "The Crystal Quest",
      "description": "Luna is searching for a legendary crystal.",
      "startDate": "2025-08-01",
      "endDate": "2025-08-31"
    }
  ],
  "instagramAccountId": "1234567890",
  "instagramApiKey": "INSTAGRAM_API_KEY",
  "twitterAccountId": "0987654321",
  "twitterAppKey": "TWITTER_APP_KEY",
  "twitterAppSecret": "TWITTER_APP_SECRET",
  "twitterAccessToken": "TWITTER_ACCESS_TOKEN",
  "twitterAccessSecret": "TWITTER_ACCESS_SECRET"
}
```

### `data/scheduler.json`

This file stores an array of scheduled task objects, defining what actions should be taken and when.

**Example `task` object:**

```json
{
  "id": "task_1",
  "characterId": "char_1754528276811_4suaz8mqv",
  "type": "generate_and_post",
  "schedule": "0 18 * * *",
  "active": true,
  "config": {
    "prompt": "luna_character in a magical forest",
    "postToInstagram": true
  }
}
```

### `data/prompts.json`

This file stores an array of generated prompt objects, which can be used for generating images and captions.

**Example `prompt` object:**

```json
{
  "id": "prompt_1",
  "characterId": "char_1754528276811_4suaz8mqv",
  "characterName": "Luna the Mystic",
  "prompt": "a beautiful portrait of luna_character in a magical forest",
  "caption": "Exploring the enchanted woods today! #magic #forest #luna",
  "createdAt": "2025-08-08T11:00:00.000Z",
  "used": false
}
```

## 📊 System Architecture

### Local Deployment
- **ComfyUI**: Local image generation with unlimited capacity
- **Scheduler Daemon**: Continuous monitoring and execution
- **Missed Run Recovery**: Automatic catch-up on system restart
- **Web UI**: Local management interface

### Cloud Deployment  
- **GitHub Actions**: Serverless execution with 2000 minutes/month
- **Multi-Character Workflows**: Separate schedules for each character
- **Artifact Storage**: Automatic backup of generated content
- **Status Reporting**: Comprehensive logging and monitoring

### Hybrid Approach
- **Primary**: Local execution for unlimited generation
- **Backup**: GitHub Actions when local system is offline
- **Smart Failover**: Automatic switching between local and cloud
- **Unified Management**: Single UI controls both deployments

## 🎨 Character System

### Character Configuration
Each character includes:
- **Profile**: Name, backstory, personality traits
- **Visual Style**: LoRA model, visual preferences
- **Narrative Arc**: Ongoing story progression
- **Schedule**: Individual posting frequency and times
- **Instagram Account**: Separate credentials and account ID

### Narrative Progression
- **Context Awareness**: Considers previous posts
- **Story Continuity**: Builds coherent character development
- **Seasonal Adaptation**: Incorporates time and trending topics
- **Personality Consistency**: Maintains character voice and style

## 🧠 AI Prompt Generation

### Gemini Integration
- **Model**: gemini-1.5-pro for best context understanding
- **Context Window**: Considers last 5-20 posts for continuity
- **Prompt Strategy**: Character-specific, narrative-driven
- **Caption Generation**: Instagram-optimized captions

### Prompt Enhancement
- **Technical Parameters**: Optimized for Flux models
- **LoRA Integration**: Automatic trigger word inclusion
- **Quality Modifiers**: Professional photography, lighting
- **Consistency Phrases**: "same person", "consistent character"

## 📅 Scheduling System

### Local Scheduler
- **Daemon Process**: Runs continuously in background
- **Cron Integration**: Standard cron expressions supported
- **Missed Run Detection**: Checks for skipped executions
- **Auto Recovery**: Executes missed posts on startup

### GitHub Actions
- **Multiple Workflows**: One per character schedule
- **Matrix Strategy**: Parallel execution with rate limiting
- **Conditional Execution**: Smart character selection
- **Resource Management**: Optimized for 2000 minute limit

### Schedule Examples
```yaml
# Emma - Travel blogger (every 6 hours)
schedule: "0 */6 * * *"

# Maya - Artist (every 8 hours, offset)
schedule: "0 2,10,18 * * *"  

# Alex - Urban photographer (twice daily)
schedule: "0 9,18 * * *"
```

## 🔧 LoRA Training

### Training Process
1. **Image Upload**: 10-20 character images via UI
2. **Preprocessing**: Automatic captioning and organization
3. **Kohya SS Integration**: Professional LoRA training
4. **Progress Monitoring**: Real-time training status
5. **Quality Testing**: Automated generation tests
6. **Deployment**: Automatic integration with generation

### Training Configuration
- **Base Models**: Any Flux model supported
- **Training Steps**: 1000-2000 (configurable)
- **Learning Rate**: Optimized for character consistency
- **Resolution**: 1024x1024 for high quality
- **Mixed Precision**: fp16 for efficiency

## 📱 Instagram Integration

### Graph API Setup
Each character needs:
1. **Business Account**: Convert personal to business
2. **Facebook Page**: Connect Instagram to Facebook
3. **App Creation**: Facebook Developer app
4. **Permissions**: instagram_basic, pages_show_list
5. **Access Tokens**: Long-lived tokens for automation

### Posting Features
- **Automatic Posting**: Direct API integration
- **Caption Generation**: AI-generated, character-specific
- **Hashtag Strategy**: Relevant, trending hashtags
- **Engagement Tracking**: Success rates and metrics

## 🖥️ Management UI

### Dashboard Features
- **Character Overview**: Status, next posts, statistics
- **Model Management**: Download, train, and deploy LoRAs
- **Schedule Control**: Create, edit, and monitor schedules
- **Deployment Status**: Local and cloud system health
- **Activity Monitoring**: Recent posts, training progress

### Configuration Options
- **Character Profiles**: Edit backstories and personalities
- **Schedule Management**: Individual posting frequencies
- **Model Selection**: Choose Flux models per character
- **Deployment Control**: Start/stop local and cloud systems

## 💰 Cost Analysis

### Free Tier Limits
- **GitHub Actions**: 2000 minutes/month (400+ posts possible)
- **Hugging Face**: 1000 requests/month (sufficient for testing)
- **Gemini API**: 1M tokens/month (thousands of prompts)
- **Instagram Graph API**: 200 requests/hour (more than needed)

### Recommended Usage
- **3 Characters**: ~12 posts/day total
- **GitHub Actions**: ~360 minutes/month (18% of limit)
- **Local Generation**: Unlimited with your hardware
- **Total Cost**: $0 with proper configuration

## 🔍 Monitoring & Maintenance

### Health Monitoring
- **System Status**: Local scheduler, ComfyUI, APIs
- **Success Rates**: Post success, generation quality
- **Resource Usage**: GitHub minutes, API quotas
- **Error Tracking**: Failed posts, training issues

### Maintenance Tasks
- **LoRA Retraining**: Periodic quality improvements
- **Schedule Optimization**: Adjust based on engagement
- **Content Review**: Monitor generated content quality
- **System Updates**: Keep dependencies current

## 🚨 Troubleshooting

### Common Issues
1. **Local Scheduler Not Running**: Check daemon process
2. **Image Generation Fails**: Verify ComfyUI/HF tokens
3. **Instagram Posting Fails**: Check access tokens
4. **LoRA Training Stuck**: Monitor GPU memory usage
5. **Missed Runs**: Run recovery script manually

### Recovery Procedures
- **System Restart**: Automatic missed run detection
- **Manual Recovery**: Run specific character tasks
- **Backup Deployment**: Switch to GitHub Actions
- **Data Recovery**: Restore from artifacts/backups

This system provides everything you need for a sophisticated, multi-character Instagram automation with AI-generated content, character consistency, and robust scheduling. The hybrid local/cloud approach ensures reliability while keeping costs at zero.
```

This comprehensive system addresses all your requirements:

- ✅ **Multiple Characters** with individual personalities, backstories, and Instagram accounts
- ✅ **LoRA Training** for any Flux model with queue management
- ✅ **Local & Cloud Deployment** with hybrid failover
- ✅ **Gemini Prompt Generation** with character context and narrative continuity  
- ✅ **Advanced Scheduling** with missed run recovery
- ✅ **Complete Management UI** for configuration and monitoring

The system runs locally for unlimited generation and uses GitHub Actions as a reliable backup, ensuring your characters never miss their posting schedules even if your PC is offline.
