# Deployment Guide: Where to Run Your Instagram AI Bot

## 🎯 Recommended: GitHub Actions (Serverless)

### Why GitHub Actions is Perfect:

**Generous Free Tier:**
- ✅ **2000 minutes/month** free
- ✅ **~5 minutes per generation** (including posting)
- ✅ **~400 posts/month possible** (way more than needed!)
- ✅ **Perfect for 10+ posts per day**

**Technical Advantages:**
- ✅ Completely serverless (no infrastructure to manage)
- ✅ Built-in scheduling with cron expressions
- ✅ Automatic scaling and reliability
- ✅ Built-in artifact storage for backups
- ✅ Version control and deployment history
- ✅ Free SSL, monitoring, and logging

### GitHub Actions Capacity Analysis:

```
📊 CAPACITY BREAKDOWN:
- Free tier: 2000 minutes/month
- Per generation: ~5 minutes average
- Possible posts: ~400/month
- Daily capacity: ~13 posts/day
- Recommended usage: 3-4 posts/day (well within limits)

⏱️ TIME BREAKDOWN PER POST:
- Setup & dependencies: ~1 minute
- Image generation: ~2-4 minutes (depending on model)
- Instagram posting: ~30 seconds
- Cleanup & artifacts: ~30 seconds
- Total: ~5 minutes average
```

### Setup Steps:

1. **Fork the repository**
2. **Add GitHub Secrets:**
   ```
   HUGGINGFACE_TOKEN=your_token
   FLUX_MODEL=flux-dev
   INSTAGRAM_ACCESS_TOKEN=your_token
   INSTAGRAM_ACCOUNT_ID=your_account_id
   CHARACTER_LORA=your_lora_name (optional)
   ```
3. **Enable GitHub Actions** in repository settings
4. **Customize schedule** in `.github/workflows/instagram-bot.yml`
5. **Deploy and monitor** via Actions tab

## 🔄 Alternative: Vercel Functions

### Pros:
- ✅ **100GB-hours/month** free compute
- ✅ Great for API endpoints
- ✅ Built-in Vercel Cron
- ✅ Easy deployment

### Cons:
- ❌ **10-second timeout limit** (too short for image generation)
- ❌ Would need external image generation service
- ❌ More complex setup for this use case

### When to Use:
- If you want to build a web dashboard
- For API endpoints and webhooks
- Combined with external image generation

## 🖥️ Alternative: Local + Cron Jobs

### Pros:
- ✅ **Unlimited compute** (your hardware)
- ✅ **Local ComfyUI** support for better quality
- ✅ **No API rate limits**
- ✅ **Full control** over everything

### Cons:
- ❌ Requires always-on computer
- ❌ No automatic scaling
- ❌ Manual maintenance and updates
- ❌ No built-in monitoring

### Setup:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/instagram-ai-bot.git
    cd instagram-ai-bot
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**

    Create a `.env.local` file in the root of your project and add the following variables:

    ```
    HUGGINGFACE_TOKEN="your_token"
    INSTAGRAM_ACCESS_TOKEN="your_token"
    INSTAGRAM_ACCOUNT_ID="your_account_id"
    # Optional:
    # COMFYUI_URL="http://localhost:8188"
    ```

4.  **Run the application in development mode:**

    ```bash
    npm run dev
    ```

    This will start the Next.js development server on `http://localhost:3000`.

5.  **Set up a scheduler:**

    To run the automation scripts periodically, you can use a cron job (on Linux/Mac) or the Task Scheduler (on Windows).

    **Cron Job (Linux/Mac):**

    Open your crontab file:

    ```bash
    crontab -e
    ```

    Add a line to run the scheduler script every 8 hours:

    ```
    0 */8 * * * cd /path/to/your/project && node scripts/scheduler-daemon.js
    ```

    **Task Scheduler (Windows):**

    -   Open the Task Scheduler.
    -   Create a new basic task.
    -   Set the trigger to run daily, and repeat every 8 hours.
    -   Set the action to start a program.
    -   The program/script will be `node`.
    -   Add arguments: `scripts/scheduler-daemon.js`.
    -   Set the "Start in" directory to the root of your project.

## 🐳 Alternative: Docker Deployment

### Pros:
- ✅ **Consistent Environment:** Runs the same everywhere
- ✅ **Isolated Dependencies:** No conflicts with other projects
- ✅ **Scalable:** Easy to deploy multiple instances
- ✅ **Cloud-Ready:** Deployable on any cloud provider (AWS, GCP, Azure)

### Cons:
- ❌ Requires Docker to be installed
- ❌ Slightly more complex initial setup

### Docker Setup:

1.  **Create a `Dockerfile` in the root of your project:**

    ```Dockerfile
    # Use an official Node.js runtime as a parent image
    FROM node:18-slim

    # Set the working directory
    WORKDIR /usr/src/app

    # Copy package.json and package-lock.json
    COPY package*.json ./

    # Install app dependencies
    RUN npm install

    # Copy app source
    COPY . .

    # Build the Next.js app
    RUN npm run build

    # Expose the port the app runs on
    EXPOSE 3000

    # Define the command to run the app
    CMD ["npm", "start"]
    ```

2.  **Build the Docker image:**

    ```bash
    docker build -t instagram-ai-bot .
    ```

3.  **Run the Docker container:**

    ```bash
    docker run -p 3000:3000 -d --name my-bot \
      -e HUGGINGFACE_TOKEN="your_token" \
      -e INSTAGRAM_ACCESS_TOKEN="your_token" \
      -e INSTAGRAM_ACCOUNT_ID="your_account_id" \
      instagram-ai-bot
    ```

## 🗃️ Handling the `data` Directory in Deployment

The `data` directory is the heart of your application's state, containing all your characters, schedules, and prompts in JSON files. It's crucial to handle this directory correctly during deployment to avoid data loss.

### Local and Docker Deployments

For local and Docker deployments, the `data` directory is stored on the host machine's filesystem.

*   **Backup:** Regularly back up the `data` directory to a safe location. You can do this manually by copying the directory, or by using a script to automate the process.
*   **Permissions:** Ensure that the user running the application has read and write permissions for the `data` directory and its contents.

### GitHub Actions Deployment

GitHub Actions provides a stateless environment, meaning that any changes to the filesystem are lost when the workflow finishes. To persist the data in the `data` directory, you need to use a different strategy.

*   **Commit to Git:** The simplest approach is to commit the `data` directory to your Git repository. This way, the data is version-controlled and available to every workflow run.
    *   **Pros:** Easy to set up, no external services needed.
    *   **Cons:** The repository size will grow over time. Be mindful of storing sensitive data in a public repository.
*   **External Storage:** For more advanced use cases, you can store the `data` directory in an external storage service like Amazon S3, Google Cloud Storage, or a database.
    *   **Pros:** Scalable, keeps the repository clean.
    *   **Cons:** More complex to set up, may incur costs.

**Recommended approach for GitHub Actions:** For most users, committing the `data` directory to the repository is the most straightforward solution. If your application grows to a large scale, consider moving to an external storage service.

## 🏆 Recommendation: GitHub Actions

**For 99% of users, GitHub Actions is the best choice because:**

1. **Zero Infrastructure:** No servers to manage
2. **Generous Limits:** 400+ posts/month possible
3. **Built-in Features:** Monitoring, logging, artifacts
4. **Reliability:** Enterprise-grade uptime
5. **Cost:** Completely free for typical usage
6. **Scalability:** Automatically handles load

## 📊 Cost Comparison

| Platform | Monthly Cost | Compute Limit | Best For |
|----------|-------------|---------------|----------|
| **GitHub Actions** | **$0** | **2000 minutes** | **Most users** |
| Vercel Functions | $0 | 100GB-hours | Web dashboards |
| Local Cron | $0 | Unlimited | Power users |
| AWS Lambda | ~$1-5 | Pay per use | Enterprise |
| Google Cloud Run | ~$2-10 | Pay per use | Enterprise |

## ⚙️ Environment Variables

Here is a list of all the environment variables the application uses:

| Variable | Description | Example |
| --- | --- | --- |
| `HUGGINGFACE_TOKEN` | Your Hugging Face API token for model access. | `hf_...` |
| `FLUX_MODEL` | The name of the Flux model to use for image generation. | `flux-dev` |
| `INSTAGRAM_ACCESS_TOKEN` | Your Instagram Graph API access token. | `EAAG...` |
| `INSTAGRAM_ACCOUNT_ID` | Your Instagram Account ID. | `178...` |
| `CHARACTER_LORA` | (Optional) The name of a LoRA model to use for character consistency. | `my-character-lora` |
| `COMFYUI_URL` | The URL of your ComfyUI instance (if using local ComfyUI). | `http://localhost:8188` |
| `PYTHON_PATH` | The path to your Python executable (if not in the default location). | `/usr/bin/python3` |

## 🚀 Getting Started (5 Minutes)

1. **Fork this repository**
2. **Get Hugging Face token** (free at huggingface.co)
3. **Setup Instagram Graph API** (business account)
4. **Add secrets to GitHub repository**
5. **Enable Actions and watch it run!**

The system will automatically:
- Generate images every 8 hours
- Post to Instagram
- Save backups as artifacts
- Monitor and log everything
- Scale automatically

Perfect for a completely hands-off Instagram automation! 🎉
