# Instagram AI Character Bot

An automated system that generates consistent character images using Luma AI and posts them to Instagram on a schedule.

## Features

- **Consistent Character Generation**: Uses Luma AI's character reference feature to maintain character consistency across all generated images
- **Dynamic Prompts**: Randomly selects from a library of prompts to create varied content
- **Instagram Integration**: Automatically posts generated images to Instagram using the Graph API
- **Flexible Scheduling**: Supports various scheduling options (cron jobs, Vercel Cron, etc.)
- **Web Dashboard**: Monitor and control the automation through a user-friendly interface

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

\`\`\`bash
cp .env.example .env.local
\`\`\`

### 2. Luma AI Setup

1. Sign up at [Luma AI](https://lumalabs.ai/)
2. Get your API key from the dashboard
3. Add it to your `.env.local` file

### 3. Instagram Setup

1. Create a Facebook App at [Facebook Developers](https://developers.facebook.com/)
2. Add Instagram Basic Display product
3. Convert your Instagram account to a Business account
4. Generate a long-lived access token
5. Get your Instagram Business Account ID

### 4. Character Reference Images

Upload 1-4 high-quality reference images of your character to a public URL (or use the file upload in the dashboard). These images should:
- Show the same person/character
- Be high quality and well-lit
- Show the character clearly
- Be diverse in angles/expressions for better consistency

### 5. Deployment Options

#### Local Development
\`\`\`bash
npm install
npm run dev
\`\`\`

#### Vercel Deployment
1. Deploy to Vercel
2. Add environment variables in Vercel dashboard
3. Set up Vercel Cron Jobs for scheduling

#### Manual Scheduling
Use the `/scripts/setup-scheduler.js` for local cron jobs or integrate with your preferred scheduling service.

## API Endpoints

- `POST /api/generate-image` - Generate a new character image
- `POST /api/post-to-instagram` - Post an image to Instagram
- `POST /api/automation` - Run the full automation pipeline

## Customization

### Adding New Prompts
Edit the `PROMPT_TEMPLATES` array in `/app/api/generate-image/route.ts` to add new scenarios for your character.

### Scheduling Options
- **Vercel Cron**: Use Vercel's built-in cron jobs
- **GitHub Actions**: Set up workflows for scheduling
- **External Services**: Use services like Zapier or Make.com
- **Local Cron**: Use the provided Node.js script

## Legal Considerations

- Ensure you have rights to use character reference images
- Follow Instagram's Terms of Service
- Consider disclosure requirements for AI-generated content
- Respect rate limits and API usage guidelines

## Troubleshooting

- **Image Generation Fails**: Check Luma API key and reference image URLs
- **Instagram Posting Fails**: Verify access token and account permissions
- **Character Inconsistency**: Use more reference images or higher quality images

## Cost Considerations

- Luma AI charges per image generation
- Instagram Graph API is free but has rate limits
- Consider your posting frequency vs. costs
