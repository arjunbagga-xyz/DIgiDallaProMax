# 🤖 GenAI Instagram Automation System

A comprehensive, zero-cost Instagram automation system that generates AI images using multiple characters, trains custom LoRA models, and posts content automatically.

## 🌟 Features

### Core Functionality
- **Multi-Character System**: Create and manage multiple AI characters with unique personalities
- **Custom LoRA Training**: Train personalized models for each character
- **Automated Posting**: Schedule and post content to Instagram automatically
- **Smart Prompt Generation**: AI-powered prompt creation using Gemini
- **Local & Cloud Deployment**: Run locally or deploy to GitHub Actions
- **Zero Cost Operation**: Uses only free and open-source tools

### Character Management
- Individual character profiles with backstories
- Separate Instagram accounts per character
- Custom LoRA models for consistent appearance
- Ongoing narrative tracking
- Independent posting schedules

### Technical Features
- **ComfyUI Integration**: Professional AI image generation
- **Flux Model Support**: State-of-the-art image quality
- **Vercel Blob Storage**: Efficient image and model storage
- **GitHub Actions**: Free cloud automation
- **Local Scheduling**: Missed-run recovery system
- **Health Monitoring**: System status and performance tracking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.8+ (for ComfyUI)
- Git
- Instagram Business Account

### 1. Clone and Setup
\`\`\`bash
git clone <your-repo>
cd instagram-automation
npm install
chmod +x setup.sh
./setup.sh
\`\`\`

### 2. Environment Configuration
\`\`\`bash
cp .env.example .env
# Edit .env with your API keys
\`\`\`

### 3. Start the System
\`\`\`bash
# Development
npm run dev

# Production
npm run build
npm start

# Local Scheduler
npm run scheduler
\`\`\`

## 📋 Environment Variables

### Required APIs
\`\`\`env
# AI Generation
GEMINI_API_KEY=your_gemini_key
COMFYUI_URL=http://localhost:8188
FLUX_MODEL_PATH=/path/to/flux/model

# Storage
VERCEL_BLOB_READ_WRITE_TOKEN=your_blob_token
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Instagram (Optional - for posting)
INSTAGRAM_ACCESS_TOKEN=your_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_account_id

# Database
DATABASE_URL=your_database_url

# System
PYTHON_PATH=/usr/bin/python3
NODE_ENV=production
\`\`\`

## 🏗️ Architecture

### System Components
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

### Data Flow
1. **Character Creation** → Profile + LoRA Training
2. **Prompt Generation** → AI-powered story continuation  
3. **Image Generation** → ComfyUI + Flux + Custom LoRA
4. **Content Scheduling** → Local cron or GitHub Actions
5. **Instagram Posting** → Automated publishing
6. **Monitoring** → Health checks and analytics

## 🎯 Usage Guide

### Creating Characters
1. Navigate to Characters tab
2. Click "Add Character"
3. Fill in character details:
   - Name and personality
   - Backstory and narrative
   - Instagram account info
   - Upload reference images
4. Train custom LoRA model
5. Set posting schedule

### Managing Content
1. **Prompts Tab**: View and edit generated prompts
2. **Models Tab**: Monitor LoRA training progress
3. **Scheduling Tab**: Configure posting times
4. **Monitoring Tab**: Track system health

### Deployment Options

#### Local Development
\`\`\`bash
npm run dev
npm run scheduler  # In separate terminal
\`\`\`

#### GitHub Actions (Free)
1. Push code to GitHub
2. Set repository secrets
3. Enable Actions workflow
4. Automatic scheduling activated

#### Self-Hosted Production
\`\`\`bash
npm run build
npm start
pm2 start ecosystem.config.js
\`\`\`

## 🔧 API Endpoints

### Character Management
- `GET /api/characters` - List all characters
- `POST /api/characters` - Create new character
- `PUT /api/characters/:id` - Update character
- `DELETE /api/characters/:id` - Delete character

### Content Generation
- `POST /api/generate-image` - Generate character image
- `POST /api/prompts/generate` - Create new prompt
- `GET /api/prompts` - List prompts

### LoRA Training
- `POST /api/lora/train` - Start LoRA training
- `GET /api/lora/status/:id` - Check training status
- `GET /api/lora/models` - List trained models

### Scheduling
- `GET /api/scheduler` - Get schedule status
- `POST /api/scheduler/run` - Manual execution
- `PUT /api/scheduler/config` - Update schedule

### System
- `GET /api/system/status` - Health check
- `GET /api/system/logs` - System logs

## 🛠️ Customization

### Adding New Characters
\`\`\`javascript
const character = {
  name: "Luna",
  personality: "Mystical and dreamy",
  backstory: "A moon goddess who...",
  instagramHandle: "@luna_dreams",
  loraModelPath: "/models/luna.safetensors",
  postingSchedule: "0 18 * * *" // Daily at 6 PM
}
\`\`\`

### Custom Prompts
\`\`\`javascript
const promptTemplate = {
  character: "{character_name}",
  setting: "{current_narrative_context}",
  style: "cinematic, high quality, detailed",
  mood: "{character_personality_trait}"
}
\`\`\`

### Scheduling Configuration
\`\`\`javascript
// Local cron format
const schedules = {
  "luna": "0 18 * * *",     // Daily 6 PM
  "alex": "0 12 * * 1,3,5", // Mon/Wed/Fri noon
  "sage": "0 9 * * 0"       // Sunday 9 AM
}
\`\`\`

## 🚨 Troubleshooting

### Common Issues

#### ComfyUI Connection Failed
\`\`\`bash
# Check if ComfyUI is running
curl http://localhost:8188/system_stats

# Restart ComfyUI
cd ComfyUI
python main.py --listen
\`\`\`

#### LoRA Training Errors
\`\`\`bash
# Check Python environment
python --version
pip list | grep torch

# Verify GPU availability
python -c "import torch; print(torch.cuda.is_available())"
\`\`\`

#### Instagram API Issues
- Verify Business Account setup
- Check access token validity
- Ensure proper permissions
- Review rate limits

#### Scheduling Problems
\`\`\`bash
# Check cron service
systemctl status cron

# View scheduler logs
npm run logs

# Manual test run
npm run test-schedule
\`\`\`

### Performance Optimization

#### Memory Usage
- Monitor ComfyUI memory consumption
- Implement model unloading between generations
- Use efficient image formats (WebP)

#### Generation Speed
- Use appropriate Flux model size
- Optimize ComfyUI workflows
- Implement generation queuing

#### Storage Management
- Regular cleanup of temporary files
- Compress stored images
- Archive old content

## 📊 Monitoring & Analytics

### Health Checks
- System uptime monitoring
- API response times
- Generation success rates
- Instagram posting status

### Performance Metrics
- Average generation time
- Memory usage patterns
- Storage consumption
- Error rates

### Logging
\`\`\`bash
# View system logs
tail -f logs/system.log

# Check scheduler logs
tail -f logs/scheduler.log

# Monitor ComfyUI logs
tail -f ComfyUI/logs/comfyui.log
\`\`\`

## 🔒 Security & Privacy

### Data Protection
- Local storage of sensitive data
- Encrypted API keys
- Secure file permissions
- Regular security updates

### Instagram Compliance
- Respect rate limits
- Follow community guidelines
- Implement proper attribution
- Monitor content quality

## 💰 Cost Analysis

### Zero-Cost Setup
- **Compute**: GitHub Actions (2000 minutes/month free)
- **Storage**: Vercel Blob (100GB free tier)
- **AI**: Gemini API (free tier available)
- **Hosting**: Vercel (hobby plan free)

### Scaling Costs
- Additional compute: $0.008/minute
- Extra storage: $0.15/GB/month
- Premium AI models: Variable pricing
- Dedicated hosting: $20+/month

## 🤝 Contributing

### Development Setup
\`\`\`bash
git clone <repo>
cd instagram-automation
npm install
npm run dev
\`\`\`

### Code Standards
- TypeScript strict mode
- ESLint + Prettier
- Conventional commits
- Test coverage >80%

### Pull Request Process
1. Fork repository
2. Create feature branch
3. Add tests
4. Update documentation
5. Submit PR

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

### Documentation
- [Setup Guide](./COMPREHENSIVE_SETUP_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Instagram API Guide](./INSTAGRAM_API_REALITY_CHECK.md)
- [Zero Cost Setup](./ZERO_COST_SETUP.md)

### Community
- GitHub Issues for bugs
- Discussions for questions
- Wiki for advanced guides

### Professional Support
Contact for enterprise deployments and custom integrations.

---

**⚡ Ready to automate your Instagram with AI? Start with `npm run dev` and create your first character!**
