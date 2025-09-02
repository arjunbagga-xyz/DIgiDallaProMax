import os

# --- ComfyUI Configuration ---

# The URL of your ComfyUI instance.
# This should be the address of the ComfyUI API server.
# Default is "http://127.0.0.1:8188"
COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")

# The absolute path to your ComfyUI installation directory.
# This is required for the application to find and serve the generated images
# from ComfyUI's output directory.
#
# Example for Windows: "C:/Users/YourUser/ComfyUI"
# Example for Linux/macOS: "/home/user/ComfyUI"
#
# If this is not set, the application will not be able to display images.
COMFYUI_PATH = os.environ.get("COMFYUI_PATH", None)

# --- Gemini API Configuration ---
# Your Google Gemini API key for prompt generation.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", None)

# --- Public URL Configuration ---
# The public-facing URL of this application.
# This is required for Instagram posting, as the Instagram API needs to access the
# generated image from a public URL. If you are running this locally, you can use
# a tunneling service like ngrok to get a public URL.
# Example: "https://your-ngrok-id.ngrok.io"
PUBLIC_URL = os.environ.get("PUBLIC_URL", None)
