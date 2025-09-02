import argparse
import os
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from diffusers import AutoencoderKL, DDPMScheduler, UNet2DConditionModel
from transformers import CLIPTextModel, CLIPTokenizer
from peft import LoraConfig, get_peft_model
from accelerate import Accelerator

class DreamBoothDataset(Dataset):
    def __init__(self, instance_data_root, tokenizer, size=512):
        self.instance_data_root = instance_data_root
        self.tokenizer = tokenizer
        self.size = size
        self.instance_images_path = [os.path.join(self.instance_data_root, f) for f in os.listdir(self.instance_data_root) if f.endswith(('.png', '.jpg', '.jpeg'))]

    def __len__(self):
        return len(self.instance_images_path)

    def __getitem__(self, index):
        image_path = self.instance_images_path[index]
        image = Image.open(image_path).convert("RGB").resize((self.size, self.size))
        # For simplicity, we use a generic prompt. In a real scenario, you might have per-image prompts.
        text = "a photo of sks character"

        # Preprocessing is simplified here.
        image = torch.tensor(image.tobytes()).view(self.size, self.size, 3).permute(2, 0, 1) / 127.5 - 1.0
        input_ids = self.tokenizer(text, padding="max_length", truncation=True, max_length=self.tokenizer.model_max_length, return_tensors="pt").input_ids

        return {"instance_images": image, "instance_prompt_ids": input_ids}

def train_lora(base_model_path, image_dir, output_dir, lora_rank=4, learning_rate=1e-4, num_steps=1000):
    print("--- Initializing Functional LoRA Training ---")

    accelerator = Accelerator(
        gradient_accumulation_steps=1,
        mixed_precision="fp16",
    )

    # 1. Load models
    tokenizer = CLIPTokenizer.from_pretrained(base_model_path, subfolder="tokenizer")
    text_encoder = CLIPTextModel.from_pretrained(base_model_path, subfolder="text_encoder")
    vae = AutoencoderKL.from_pretrained(base_model_path, subfolder="vae")
    unet = UNet2DConditionModel.from_pretrained(base_model_path, subfolder="unet")
    noise_scheduler = DDPMScheduler.from_pretrained(base_model_path, subfolder="scheduler")

    # Freeze VAE and text_encoder
    vae.requires_grad_(False)
    text_encoder.requires_grad_(False)

    # 2. Configure LoRA
    lora_config = LoraConfig(
        r=lora_rank,
        lora_alpha=lora_rank,
        target_modules=["to_q", "to_v", "to_k", "to_out.0"],
        lora_dropout=0.05,
        bias="none",
    )
    unet.add_adapter(lora_config)

    # 3. Optimizer
    trainable_params = list(filter(lambda p: p.requires_grad, unet.parameters()))
    optimizer = torch.optim.AdamW(trainable_params, lr=learning_rate)

    # 4. Dataset and DataLoader
    train_dataset = DreamBoothDataset(image_dir, tokenizer)
    train_dataloader = DataLoader(train_dataset, batch_size=1, shuffle=True)

    # 5. Prepare for training with accelerator
    unet, optimizer, train_dataloader = accelerator.prepare(
        unet, optimizer, train_dataloader
    )

    # 6. Training Loop
    print(f"--- Starting training for {num_steps} steps ---")

    global_step = 0
    while global_step < num_steps:
        for step, batch in enumerate(train_dataloader):
            if global_step >= num_steps:
                break

            with accelerator.accumulate(unet):
                # Convert images to latent space
                latents = vae.encode(batch["instance_images"]).latent_dist.sample()
                latents = latents * vae.config.scaling_factor

                # Sample noise that we'll add to the latents
                noise = torch.randn_like(latents)
                bsz = latents.shape[0]
                timesteps = torch.randint(0, noise_scheduler.config.num_train_timesteps, (bsz,), device=latents.device).long()

                # Add noise to the latents according to the noise magnitude at each timestep
                noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)

                # Get the text embedding for conditioning
                encoder_hidden_states = text_encoder(batch["instance_prompt_ids"].squeeze(1))[0]

                # Predict the noise residual
                model_pred = unet(noisy_latents, timesteps, encoder_hidden_states).sample

                # Get the target for loss depending on the prediction type
                if noise_scheduler.config.prediction_type == "epsilon":
                    target = noise
                elif noise_scheduler.config.prediction_type == "v_prediction":
                    target = noise_scheduler.get_velocity(latents, noise, timesteps)
                else:
                    raise ValueError(f"Unknown prediction type {noise_scheduler.config.prediction_type}")

                loss = F.mse_loss(model_pred.float(), target.float(), reduction="mean")

                accelerator.backward(loss)
                optimizer.step()
                optimizer.zero_grad()

            if accelerator.is_main_process:
                if (global_step + 1) % 50 == 0:
                    print(f"Step {global_step + 1}/{num_steps}, Loss: {loss.item()}")

            global_step += 1

    # 7. Save the trained LoRA adapter
    accelerator.wait_for_everyone()
    if accelerator.is_main_process:
        unwrapped_unet = accelerator.unwrap_model(unet)
        unwrapped_unet.save_pretrained(output_dir)
        print(f"--- LoRA model saved to {output_dir} ---")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train a LoRA model.")
    parser.add_argument("--base_model", type=str, default="runwayml/stable-diffusion-v1-5", help="Path or name of the base Stable Diffusion model.")
    parser.add_argument("--images", type=str, required=True, help="Directory containing training images.")
    parser.add_argument("--output", type=str, required=True, help="Directory to save the trained LoRA model.")
    parser.add_argument("--rank", type=int, default=4, help="Rank of the LoRA adapter.")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate.")
    parser.add_argument("--steps", type=int, default=500, help="Number of training steps.")

    args = parser.parse_args()

    train_lora(args.base_model, args.images, args.output, args.rank, args.lr, args.steps)
