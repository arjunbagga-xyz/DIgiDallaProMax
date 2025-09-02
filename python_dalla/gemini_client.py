import google.generativeai as genai
import config

def generate_prompt(character):
    """
    Generates an image prompt for a given character using the Gemini API.
    """
    if not config.GEMINI_API_KEY:
        return "Error: GEMINI_API_KEY is not configured."

    genai.configure(api_key=config.GEMINI_API_KEY)

    try:
        model = genai.GenerativeModel('gemini-pro')

        # Construct a detailed prompt for the AI
        instruction = (
            f"You are an AI assistant for a digital content creation platform. "
            f"Your task is to generate a creative and descriptive image prompt for an AI image generator like Stable Diffusion or Midjourney. "
            f"The prompt should be based on the persona of an AI character.\n\n"
            f"**Character Details:**\n"
            f"- **Name:** {character.get('name', 'N/A')}\n"
            f"- **Personality:** {character.get('personality', 'N/A')}\n"
            f"- **Backstory:** {character.get('backstory', 'N/A')}\n\n"
            f"**Instructions:**\n"
            f"1. Generate a single, concise image prompt.\n"
            f"2. The prompt should be in English and suitable for a text-to-image model.\n"
            f"3. Capture the essence of the character's personality and backstory.\n"
            f"4. Do not include any explanatory text, just the prompt itself.\n\n"
            f"**Example Output:**\n"
            f"A portrait of a futuristic cyborg with neon-lit eyes, standing on a rainy cyberpunk street, detailed reflections on the wet pavement, cinematic lighting."
        )

        response = model.generate_content(instruction)

        # Clean up the response to get just the prompt text
        generated_text = response.text.strip()
        return generated_text

    except Exception as e:
        print(f"Error generating prompt with Gemini: {e}")
        return f"Error: Could not generate prompt. Details: {e}"
