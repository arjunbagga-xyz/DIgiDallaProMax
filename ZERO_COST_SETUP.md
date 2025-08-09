# Zero-Cost Instagram AI Character Bot Setup

This guide will help you set up a completely free Instagram automation system using open-source tools.

## 🆓 Free Tools Stack

### Image Generation Options:

1. **Hugging Face Inference API** (Recommended for beginners)
   - ✅ Free tier: 1000 requests/month
   - ✅ No local setup required
   - ✅ Flux.1-dev model available
   - ❌ Limited requests per month

2. **Local ComfyUI + Flux.1-dev** (Recommended for power users)
   - ✅ Unlimited generations
   - ✅ Better quality control
   - ✅ Character LoRA support
   - ❌ Requires powerful GPU

### Scheduling Options:

1. **GitHub Actions** (Recommended)
   - ✅ 2000 minutes/month free
   - ✅ Reliable scheduling
   - ✅ No server costs
   - ✅ Version control included

2. **Local Cron Jobs**
   - ✅ Completely free
   - ✅ Full control
   - ❌ Requires always-on computer

### Database:

**File-Based Database (`/data` directory)**
- ✅ **Completely Free**: No database hosting costs.
- ✅ **Simple**: Easy to view and edit your data directly.
- ✅ **Portable**: Your data is just a folder in your project.
- ✅ **Version Controlled**: If you commit the `data` directory to Git, your data is versioned and backed up with your code.

## 🚀 Quick Start (Hugging Face + GitHub Actions)

### Step 1: Get Hugging Face Token
1. Sign up at [huggingface.co](https://huggingface.co)
2. Go to Settings → Access Tokens
3. Create a new token with "Read" permissions

### Step 2: Instagram Setup
1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add Instagram Basic Display product
3. Generate access token for your personal account

### Step 3: GitHub Repository Setup
1. Fork this repository
2. Add secrets in Settings → Secrets and variables → Actions:
   - `HUGGINGFACE_TOKEN`
   - `INSTAGRAM_ACCESS_TOKEN`
   - `INSTAGRAM_USER_ID`

### Step 4: Enable GitHub Actions
1. Go to Actions tab in your repository
2. Enable workflows
3. The bot will run automatically every 8 hours

## 🎨 Advanced Setup (Local ComfyUI)

### System Requirements:
- **GPU**: RTX 3060 or better (8GB+ VRAM)
- **RAM**: 16GB+ system RAM
- **Storage**: 50GB+ free space

### Installation Steps:

1. **Install ComfyUI**:
   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI.git
   cd ComfyUI
   pip install -r requirements.txt
   ```

2. **Download Flux.1-dev**:
   - Download from [Hugging Face](https://huggingface.co/black-forest-labs/FLUX.1-dev)
   - Place in `ComfyUI/models/checkpoints/`

3. **Start ComfyUI**:
   ```bash
   python main.py --listen 0.0.0.0 --port 8188
   ```

4. **Train Character LoRA** (Optional):
   - Use [Kohya SS](https://github.com/kohya-ss/sd-scripts)
   - Or online trainers like CivitAI

## 📱 Instagram Posting Options

### Option 1: Automated Posting
- Uses Instagram Graph API
- Requires business account conversion
- May have restrictions

### Option 2: Manual Posting (Recommended)
- Bot generates images and saves them
- You manually post to Instagram
- No API restrictions
- Better engagement control

## 💰 Cost Breakdown

| Component | Cost | Limits |
|-----------|------|--------|
| Hugging Face | FREE | 1000 requests/month |
| GitHub Actions | FREE | 2000 minutes/month |
| Instagram API | FREE | Personal use only |
| ComfyUI (Local) | FREE | Unlimited (electricity only) |
| File-Based Database | FREE | Unlimited (your storage) |
| **Total Monthly Cost** | **$0** | **Perfect for personal use** |

## 🔧 Customization

### Adding New Prompts:
Edit `PROMPT_TEMPLATES` in `/app/api/generate-image/route.ts` or add prompts through the UI.

### Changing Schedule:
Modify the cron expression in `.github/workflows/instagram-bot.yml` or edit the schedule in the UI.

### Character Consistency:
1. Train a LoRA with 10-20 character images
2. Add LoRA trigger word to prompts
3. Use consistent lighting and style descriptions

## 🛠️ Troubleshooting

### Common Issues:

1. **Hugging Face API Errors**:
   - Check token validity
   - Verify model availability
   - Wait if rate limited

2. **Instagram Posting Fails**:
   - Verify access token
   - Check account permissions
   - Consider manual posting option

3. **GitHub Actions Fails**:
   - Check secrets configuration
   - Verify workflow syntax
   - Review action logs

### Getting Help:
- Check the GitHub Issues
- Join the Discord community
- Read ComfyUI documentation

## 📈 Scaling Up

Once you outgrow the free tiers:

1. **Hugging Face Pro**: $9/month for more requests
2. **Dedicated GPU Server**: $20-50/month
3. **Instagram Business API**: May require verification
4. **Database**: Move to a cloud database like Vercel Postgres or Supabase.

But for personal use and experimentation, the free tier is perfect!

## 🎯 Best Practices

1. **Content Quality**: Use high-quality prompts and character references
2. **Posting Schedule**: Don't over-post (3-4 times per day max)
3. **Engagement**: Manually engage with comments and followers
4. **Compliance**: Follow Instagram's terms of service
5. **Backup**: Always save generated images locally and back up your `data` directory.

## 🌟 Success Tips

1. **Character Development**: Create a consistent character backstory
2. **Prompt Variety**: Use diverse scenarios and settings
3. **Quality Control**: Review images before posting
4. **Community Building**: Engage with your audience
5. **Continuous Improvement**: Regularly update prompts and settings

Happy automating! 🤖✨
