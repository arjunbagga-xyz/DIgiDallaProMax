#!/usr/bin/env python3
import os
import sys
import torch
from diffusers import StableDiffusionPipeline, UNet2DConditionModel, DDPMScheduler
from diffusers.models import AutoencoderKL
from diffusers.training_utils import EMAModel
from transformers import CLIPTextModel, CLIPTokenizer
from peft import LoraConfig, get_peft_model
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
import time

# --- Configuration ---
MODEL_NAME = "flux1-dev.safetensors"
INSTANCE_DIR = "/app/training/training_char_1754528276811_4suaz8mqv_1755062828983/images"
OUTPUT_DIR = "/app/training/training_char_1754528276811_4suaz8mqv_1755062828983/output"
TRIGGER_WORD = "test_character"
STEPS = 10
LEARNING_RATE = 0.0001
BATCH_SIZE = 1
RESOLUTION = 1024
NETWORK_DIM = 32
NETWORK_ALPHA = 16
OUTPUT_NAME = "test_character_lora"

# --- Dataset ---
class DreamBoothDataset(Dataset):
    def __init__(self, instance_data_root, instance_prompt, tokenizer, size=512):
        self.instance_data_root = instance_data_root
        self.instance_prompt = instance_prompt
        self.tokenizer = tokenizer
        self.size = size
        self.instance_images_path = [os.path.join(instance_data_root, f) for f in os.listdir(instance_data_root) if f.endswith(('.png', '.jpg', '.jpeg'))]
        self.num_instance_images = len(self.instance_images_path)
        self._length = self.num_instance_images
        self.image_transforms = transforms.Compose([
            transforms.Resize(size, interpolation=transforms.InterpolationMode.BILINEAR),
            transforms.CenterCrop(size),
            transforms.ToTensor(),
            transforms.Normalize([0.5], [0.5]),
        ])

    def __len__(self):
        return self._length

    def __getitem__(self, index):
        example = {}
        instance_image = Image.open(self.instance_images_path[index % self.num_instance_images]).convert("RGB")
        example["instance_images"] = self.image_transforms(instance_image)
        example["instance_prompt_ids"] = self.tokenizer(
            self.instance_prompt,
            truncation=True,
            padding="max_length",
            max_length=self.tokenizer.model_max_length,
            return_tensors="pt",
        ).input_ids
        return example

# --- Main Training Logic ---
def main():
    print("--- Initializing LoRA Training ---")

    # Load models
    tokenizer = CLIPTokenizer.from_pretrained(MODEL_NAME, subfolder="tokenizer")
    text_encoder = CLIPTextModel.from_pretrained(MODEL_NAME, subfolder="text_encoder")
    vae = AutoencoderKL.from_pretrained(MODEL_NAME, subfolder="vae")
    unet = UNet2DConditionModel.from_pretrained(MODEL_NAME, subfolder="unet")

    # Add LoRA to UNet
    lora_config = LoraConfig(
        r=NETWORK_DIM,
        lora_alpha=NETWORK_ALPHA,
        target_modules=["to_q", "to_k", "to_v", "to_out.0", "proj_in", "proj_out"],
        lora_dropout=0.05,
        bias="none",
    )
    unet = get_peft_model(unet, lora_config)

    # Freeze other models
    vae.requires_grad_(False)
    text_encoder.requires_grad_(False)

    # Optimizer
    optimizer = torch.optim.AdamW(
        unet.parameters(),
        lr=LEARNING_RATE,
        betas=(0.9, 0.999),
        weight_decay=1e-2,
        eps=1e-08,
    )

    # Dataset and DataLoader
    train_dataset = DreamBoothDataset(INSTANCE_DIR, f"a photo of {TRIGGER_WORD}", tokenizer, size=RESOLUTION)
    train_dataloader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)

    # Training loop
    device = "cuda" if torch.cuda.is_available() else "cpu"
    unet.to(device)
    vae.to(device)
    text_encoder.to(device)

    noise_scheduler = DDPMScheduler.from_pretrained(MODEL_NAME, subfolder="scheduler")

    print(f"🚀 Starting training for {STEPS} steps...")
    global_step = 0

    for epoch in range(int(STEPS / (len(train_dataloader) / BATCH_SIZE)) + 1):
        unet.train()
        for step, batch in enumerate(train_dataloader):
            if global_step >= STEPS:
                break

            # Convert images to latent space
            latents = vae.encode(batch["instance_images"].to(device)).latent_dist.sample()
            latents = latents * vae.config.scaling_factor

            # Sample noise
            noise = torch.randn_like(latents)
            bsz = latents.shape[0]
            timesteps = torch.randint(0, noise_scheduler.config.num_train_timesteps, (bsz,), device=latents.device).long()

            # Add noise to the latents
            noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)

            # Get the text embedding
            encoder_hidden_states = text_encoder(batch["instance_prompt_ids"].squeeze(1).to(device))[0]

            # Predict the noise residual
            model_pred = unet(noisy_latents, timesteps, encoder_hidden_states).sample

            # Get the target for loss depending on the scheduler prediction type
            if noise_scheduler.config.prediction_type == "epsilon":
                target = noise
            elif noise_scheduler.config.prediction_type == "v_prediction":
                target = noise_scheduler.get_velocity(latents, noise, timesteps)
            else:
                raise ValueError(f"Unknown prediction type {noise_scheduler.config.prediction_type}")

            loss = torch.nn.functional.mse_loss(model_pred.float(), target.float(), reduction="mean")

            loss.backward()
            optimizer.step()
            optimizer.zero_grad()

            global_step += 1
            print(f"Step {global_step}/{STEPS} - Loss: {loss.item():.4f}")

    print("✅ Training complete!")

    # Save LoRA model
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    unet.save_pretrained(OUTPUT_DIR)

    # For compatibility, we can also save as a single safetensors file
    from safetensors.torch import save_file

    lora_layers = unet.state_dict()
    final_lora_path = os.path.join(OUTPUT_DIR, f"{OUTPUT_NAME}.safetensors")
    save_file(lora_layers, final_lora_path)

    print(f"📁 LoRA model saved to: {final_lora_path}")


if __name__ == "__main__":
    try:
        main()
        sys.exit(0)
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
