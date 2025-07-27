# 🤖 GenAI Instagram Automation System

**Status: ✅ FULLY FUNCTIONAL - Ready to Use!**

A complete, zero-cost Instagram automation system that generates AI images using multiple characters, trains custom LoRA models, and posts content automatically. Everything is implemented and ready to run!

## 🚀 **QUICK START - You Can Use It Now!**

### 1. Clone and Install
\`\`\`bash
git clone <your-repo>
cd DIgiDallaProMAx
npm install
\`\`\`

### 2. Configure Environment
\`\`\`bash
cp .env.example .env
# Edit .env with your API keys (see configuration section below)
\`\`\`

### 3. Start the System
\`\`\`bash
# Start the dashboard
npm run dev

# In another terminal, start the scheduler
npm run scheduler
\`\`\`

### 4. Open Dashboard
Visit `http://localhost:3000` - **All buttons and features are now functional!**

## ✅ **WHAT'S WORKING RIGHT NOW**

### 🎯 **Fully Implemented Features**
- ✅ **Character Management**: Create, edit, delete characters with full UI
- ✅ **Image Generation**: ComfyUI integration with Flux models
- ✅ **LoRA Training**: Complete training pipeline with progress tracking
- ✅ **Smart Scheduling**: Local daemon + GitHub Actions backup
- ✅ **Instagram Posting**: Full Graph API integration with image hosting
- ✅ **Prompt Generation**: AI-powered prompts using Gemini
- ✅ **System Monitoring**: Real-time health checks and performance metrics
- ✅ **Recovery System**: Automatic missed-run detection and execution

### 🖥️ **Dashboard Features**
- ✅ **Characters Tab**: Add characters, generate images, train LoRAs
- ✅ **Models Tab**: Monitor training progress, manage Flux models
- ✅ **Scheduling Tab**: Configure posting schedules, run tasks manually
- ✅ **Deployment Tab**: Local, GitHub Actions, and self-hosted options
- ✅ **Prompts Tab**: View and manage AI-generated prompts
- ✅ **Monitoring Tab**: System health, performance metrics, logs

### 🔧 **API Endpoints (All Working)**
- ✅ `GET/POST /api/characters` - Character management
- ✅ `POST /api/generate-image` - Image generation with ComfyUI
- ✅ `POST /api/lora/train` - LoRA training with progress tracking
- ✅ `POST /api/prompts/generate` - AI prompt generation
- ✅ `GET/POST /api/scheduler` - Task scheduling and execution
- ✅ `POST /api/post-to-instagram` - Instagram posting
- ✅ `GET /api/system/status` - System health monitoring

## 🛠️ **CONFIGURATION**

### Required Environment Variables
\`\`\`env
# AI Generation (Required)
GEMINI_API_KEY=your_gemini_api_key_here
COMFYUI_URL=http://localhost:8188

# Storage (Choose one)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
# OR
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Instagram (Optional - for actual posting)
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_business_account_id

# Database (Optional - uses file storage by default)
DATABASE_URL=your_database_connection_string
\`\`\`

### ComfyUI Setup
1. **Download ComfyUI**: `git clone https://github.com/comfyanonymous/ComfyUI.git`
2. **Install dependencies**: `pip install -r requirements.txt`
3. **Download Flux model**: Place `flux1-dev.safetensors` in `ComfyUI/models/checkpoints/`
4. **Start ComfyUI**: `python main.py --listen`
5. **Test connection**: `npm run test-comfyui`

## 🎯 **HOW TO USE**

### 1. Create Your First Character
1. Open dashboard at `http://localhost:3000`
2. Go to **Characters** tab
3. Click **"Add Character"** button
4. Fill in character details:
   - Name: "Luna"
   - Personality: "Mystical and dreamy"
   - Backstory: "A moon goddess who explores ethereal realms"
   - Instagram Handle: "@luna_ai_dreams"
5. Click **"Create Character"**

### 2. Generate Your First Image
1. Find your character card
2. Click **"Generate"** button
3. Watch the system:
   - Generate AI prompt using Gemini
   - Create image with ComfyUI + Flux
   - Display result in dashboard

### 3. Set Up Automated Posting
1. Go to **Scheduling** tab
2. Click **"Configure"** button
3. Set posting schedule (e.g., "Daily 6 PM")
4. Enable auto-posting
5. Click **"Save Settings"**

### 4. Train Custom LoRA (Optional)
1. Upload 15-30 character reference images
2. Click **"Train LoRA"** button
3. Monitor progress in **Models** tab
4. Use trained LoRA for consistent character appearance

## 🚀 **DEPLOYMENT OPTIONS**

### Option 1: Local Development (Recommended for Testing)
\`\`\`bash
# Terminal 1: Start dashboard
npm run dev

# Terminal 2: Start scheduler
npm run scheduler

# Terminal 3: Start ComfyUI
cd ComfyUI && python main.py --listen
\`\`\`

### Option 2: GitHub Actions (Free Cloud Automation)
1. Push code to GitHub repository
2. Add secrets in repository settings:
   - `GEMINI_API_KEY`
   - `BLOB_READ_WRITE_TOKEN`
   - `LUNA_INSTAGRAM_ACCESS_TOKEN`
   - `LUNA_INSTAGRAM_ACCOUNT_ID`
3. Enable GitHub Actions
4. Automatic posting every 6 hours!

### Option 3: Self-Hosted Production
\`\`\`bash
npm run build
npm start
pm2 start ecosystem.config.js
\`\`\`

## 🧪 **TESTING & VERIFICATION**

### Test System Components
\`\`\`bash
# Test ComfyUI connection
npm run test-comfyui

# Test character creation
curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","personality":"friendly"}'

# Test image generation
curl -X POST http://localhost:3000/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{"characterId":"your_character_id"}'

# Check system health
curl http://localhost:3000/api/system/status
\`\`\`

## 📊 **SYSTEM ARCHITECTURE**

\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboard UI  │────│  API Routes     │────│   ComfyUI       │
│   (Next.js)     │    │  (Serverless)   │    │   (Local/Cloud) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Character     │────│   Scheduler     │────│   Instagram     │
│   Management    │    │   (Cron/GitHub) │    │   API           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
\`\`\`

## 🔧 **TROUBLESHOOTING**

### Common Issues & Solutions

#### "ComfyUI Connection Failed"
\`\`\`bash
# Check if ComfyUI is running
curl http://localhost:8188/system_stats

# Start ComfyUI if needed
cd ComfyUI
python main.py --listen

# Test connection
npm run test-comfyui
\`\`\`

#### "No Characters Showing"
- Check `data/characters.json` exists
- Verify file permissions
- Try creating a character through the UI

#### "Image Generation Fails"
- Ensure Flux model is downloaded
- Check ComfyUI logs for errors
- Verify sufficient disk space and memory

#### "Instagram Posting Fails"
- Verify access token is valid
- Check Instagram Business Account setup
- Ensure image hosting service is configured

#### "Scheduler Not Running"
\`\`\`bash
# Check if scheduler is running
ps aux | grep scheduler

# Start scheduler manually
npm run scheduler

# Check scheduler logs
tail -f logs/scheduler.log
\`\`\`

## 💰 **COST BREAKDOWN (Zero Cost Setup)**

### Free Tier Limits
- **GitHub Actions**: 2000 minutes/month (≈333 hours)
- **Vercel Blob**: 100GB storage free
- **Gemini API**: 15 requests/minute free tier
- **ComfyUI**: Free (runs locally)
- **Instagram API**: Free (with rate limits)

### Estimated Usage
- **Per character per day**: ~2 minutes GitHub Actions
- **3 characters posting daily**: ~6 minutes/day = 180 minutes/month
- **Well within free limits!**

## 📈 **SCALING & OPTIMIZATION**

### Performance Tips
1. **Use Flux-schnell** for faster generation (4 steps vs 20)
2. **Batch character processing** to reduce API calls
3. **Implement image caching** to avoid regeneration
4. **Use smaller image sizes** for faster processing
5. **Schedule during off-peak hours** for better performance

### Adding More Characters
1. Create character in dashboard
2. Add Instagram credentials to environment
3. Update GitHub Actions secrets
4. Character automatically included in rotation

## 🔒 **SECURITY & PRIVACY**

### Data Protection
- All character data stored locally in `data/` folder
- API keys encrypted in environment variables
- Generated images automatically cleaned up
- No sensitive data sent to external services (except APIs)

### Instagram Compliance
- Respects Instagram rate limits (200 requests/hour)
- Follows community guidelines
- Implements proper error handling
- Includes AI-generated content disclosure

## 🤝 **CONTRIBUTING & SUPPORT**

### Getting Help
1. **Check logs**: `tail -f logs/system.log`
2. **Run health check**: `curl http://localhost:3000/api/system/status`
3. **Test components**: `npm run test-comfyui`
4. **Open GitHub issue** with logs and error details

### Contributing
1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Submit pull request with detailed description

## 🎉 **YOU'RE READY TO GO!**

The system is **100% functional** and ready for production use. Here's your checklist:

- [ ] ✅ Clone repository and install dependencies
- [ ] ✅ Configure environment variables
- [ ] ✅ Start ComfyUI server
- [ ] ✅ Run `npm run dev` to start dashboard
- [ ] ✅ Create your first character
- [ ] ✅ Generate test image
- [ ] ✅ Set up posting schedule
- [ ] ✅ Deploy to GitHub Actions (optional)

**🚀 Start creating amazing AI-generated Instagram content with multiple characters today!**

---

**Built with ❤️ using open-source AI tools**
- Next.js 15 + React 19
- ComfyUI + Flux Models
- Gemini AI for prompts
- Instagram Graph API
- GitHub Actions for automation

**Questions?** Open an issue or check the troubleshooting section above.
