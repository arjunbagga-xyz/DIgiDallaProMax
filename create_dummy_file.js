const fs = require('fs');
const path = require('path');

const dirPath = path.join(process.cwd(), 'ComfyUI', 'models', 'checkpoints');
const filePath = path.join(dirPath, 'dummy_model.safetensors');

try {
  fs.mkdirSync(dirPath, { recursive: true });
  console.log(`Directory created or already exists: ${dirPath}`);

  fs.writeFileSync(filePath, '');
  console.log(`Dummy file created: ${filePath}`);
} catch (error) {
  console.error(`Failed to create dummy file: ${error}`);
  process.exit(1);
}
