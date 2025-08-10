# Application Report: Model Compatibility and LoRA Training Guide

This report provides details on the model compatibility of the application and a comprehensive guide on preparing data for LoRA (Low-Rank Adaptation) training.

**Note:** The project's `README.md` file is outdated and incorrectly states that the LoRA training feature is a simulation. This investigation found that the application *does* perform real LoRA training by dynamically generating and executing a Python script.

## 1. Model Compatibility

The application uses two different mechanisms for its core AI functionalities, each with its own model compatibility:

### Image Generation (via ComfyUI)

Image generation is handled by a connected ComfyUI instance. The application is pre-configured to build workflows for the following types of models:

*   **FLUX Models**: A new generation of fast text-to-image models.
*   **SDXL (Stable Diffusion XL) Models**: High-resolution models capable of generating detailed 1024x1024 images.
*   **SD1.5 (Stable Diffusion 1.5) Models**: Classic 512x512 models, widely supported and with a vast number of available community fine-tunes.

The application dynamically constructs the appropriate ComfyUI workflow based on the selected model type.

### LoRA Training (via Python Script)

LoRA training is performed by a dynamically generated Python script that uses the Hugging Face `diffusers` library. This makes the training process compatible with the same model architectures used for generation:

*   **SDXL, SD1.5, and FLUX base models** can be used for fine-tuning.

The base model for training can be specified as a parameter in the training job configuration.

## 2. Guide to Preparing Data for LoRA Training

The following is a guide on how to prepare your images and captions for LoRA training with this application. The training process expects a specific data structure and format.

### Image Preparation

*   **File Formats**: Your training images should be in one of the following formats:
    *   `.png`
    *   `.jpg`
    *   `.jpeg`
*   **Image Content**: For training a character LoRA, gather a variety of images of the character. Include different angles, expressions, clothing, and backgrounds. The more varied the dataset, the more flexible the resulting LoRA will be.
*   **Resolution**: While the training script can resize images, it is best to use images that are at or above the target training resolution (e.g., 1024x1024 for SDXL, 512x512 for SD1.5). Consistent, high-quality images will produce better results.
*   **Naming**: Image filenames do not have a strict naming requirement, but they must have a corresponding caption file with the exact same name (except for the extension).

### Trigger Word

A "trigger word" is a unique token that you will use in your prompts to invoke the trained LoRA.
*   Choose a unique word that is unlikely to appear in the model's vocabulary (e.g., `mychar_style`, `zxz_person`).
*   This trigger word should be included in your captions.

### Captioning

Captions are crucial for teaching the model what is in the images. Each image must have a corresponding text file with the same name.

*   **File Format**: Create a plain text file (`.txt`) for each image.
*   **Naming Convention**: The caption filename must match the image filename exactly.
    *   Example: `my_image_01.png` should have a caption file named `my_image_01.txt`.
*   **Content**: The caption should be a concise, descriptive sentence explaining the content of the image.
    *   **Include the trigger word.**
    *   Be descriptive. Instead of just "a woman", write "a photo of `[trigger_word]`, a woman with long brown hair, wearing a red jacket, standing in front of a brick wall."
    *   Describe everything you want the LoRA to learn and also things you want to be able to change. If the character is always wearing a hat in the training images but you don't mention the hat in the captions, the LoRA will likely always generate the character with a hat.

### Directory Structure

All your prepared images and their corresponding caption files should be placed together in a single directory.

Example of a prepared dataset folder:
```
/path/to/my_training_data/
├── image_01.png
├── image_01.txt
├── image_02.jpeg
├── image_02.txt
├── image_03.jpg
├── image_03.txt
└── ...
```

When you start a training job through the application's UI, you will upload these images. The backend will then automatically handle creating the necessary directory structure and configuration for the training script based on your uploaded data.
