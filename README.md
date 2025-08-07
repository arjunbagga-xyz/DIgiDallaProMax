# Digital Dalla - AI-Powered Instagram Automation Dashboard

**⚠️ THIS IS A WORK IN PROGRESS**

This project is a dashboard for managing and automating AI-powered Instagram accounts. It provides a user interface for creating AI characters, generating images, and scheduling posts. While the core functionality is in place, several features are currently implemented as placeholders or simulations.

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or later)
- npm or yarn
- An instance of [ComfyUI](https://github.com/comfyanonymous/ComfyUI) running and accessible.

### 2. Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd digital-dalla

# Install dependencies
npm install
```

### 3. Configuration
Create a `.env.local` file in the root of the project and add the following environment variables:

```env
# Required for image generation
COMFYUI_URL=http://127.0.0.1:8188

# Required for AI-powered prompt generation
GEMINI_API_KEY=your_gemini_api_key

# Required for posting to Instagram (per character)
# Replace LUNA with your character's name in uppercase
LUNA_INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
LUNA_INSTAGRAM_ACCOUNT_ID=your_instagram_business_account_id
```

### 4. Running the Application
```bash
# Start the development server
npm run dev

# In a separate terminal, start the scheduler daemon
npm run scheduler
```
Open your browser and navigate to `http://localhost:3000`.

## ✨ Features

### ✅ Fully Implemented
- **Character Management**: Create, edit, and delete AI characters with unique personalities and prompt settings.
- **Image Generation**: Generate images using a connected ComfyUI instance.
- **Instagram Posting**: Post generated images to Instagram with captions. The frontend is now correctly connected to the backend API for this.
- **Prompt Management**: View and manage AI-generated prompts.
- **System Monitoring**: A dashboard to monitor the status of connected services (ComfyUI, Database, etc.).

### ⚠️ Placeholder / Simulated Features
- **LoRA Training**: The LoRA training feature is a **simulation**. It does not perform actual model training but mimics the process in the UI.
- **Deployment**: The deployment options (GitHub Actions, Vercel, Docker) only **generate configuration files**. They do not perform any actual deployment. You need to manually use these files to deploy the application.
- **Scheduler**:
    - **Cron Parsing**: The cron expression parsing is **simplified**. It only supports daily schedules and simple intervals (e.g., `6h`, `30m`). Full cron syntax is not supported.
    - **Backup**: The backup functionality is a **placeholder** and does not perform any actual backups.

## 🔧 Known Issues & Limitations

- **Simulated Features**: As mentioned above, LoRA training, deployment, and parts of the scheduler are not fully implemented.
- **No Real-time Logs**: The "real-time" logs for LoRA training are part of the simulation.
- **Error Handling**: Error handling can be improved in some areas.
- **Security**: The application is intended for local use and has not been hardened for production environments.

## 🤝 Contributing
Contributions are welcome! If you'd like to help improve the project, please feel free to fork the repository and submit a pull request. You can start by looking at the "Known Issues & Limitations" section to find areas for improvement.

---
*This README has been updated to accurately reflect the current state of the project.*
