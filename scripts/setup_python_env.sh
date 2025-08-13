#!/bin/bash
set -e

# --- Configuration ---
VENV_DIR=".venv"
PYTHON_CMD="python3"
REQUIREMENTS=(
    "torch==2.1.0"
    "diffusers==0.24.0"
    "transformers==4.35.2"
    "peft==0.7.1"
    "safetensors==0.4.0"
    "accelerate==0.25.0"
)

# --- Functions ---
check_python() {
    if ! command -v $PYTHON_CMD &> /dev/null; then
        echo "❌ Error: $PYTHON_CMD is not installed or not in PATH."
        exit 1
    fi
}

create_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        echo "🐍 Creating Python virtual environment in $VENV_DIR..."
        $PYTHON_CMD -m venv $VENV_DIR
        echo "✅ Virtual environment created."
    else
        echo "👍 Virtual environment already exists."
    fi
}

install_packages() {
    echo "📦 Installing dependencies..."
    source "$VENV_DIR/bin/activate"

    # Create a temporary requirements file
    local temp_reqs=$(mktemp)
    for pkg in "${REQUIREMENTS[@]}"; do
        echo "$pkg" >> "$temp_reqs"
    done

    # Install from the requirements file
    pip install -r "$temp_reqs"

    # Clean up the temp file
    rm "$temp_reqs"

    deactivate
    echo "✅ Dependencies installed successfully."
}

# --- Main Execution ---
echo "--- Setting up Python Environment for LoRA Training ---"
check_python
create_venv
install_packages
echo "--- Python Environment is Ready ---"
