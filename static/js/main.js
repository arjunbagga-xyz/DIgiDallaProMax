document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path === '/' || path === '/index.html') {
        fetchSystemStatus();
    } else if (path === '/characters.html') {
        fetchCharacters();
        handleCreateCharacterForm();
    } else if (path === '/prompts.html') {
        fetchPromptTemplates();
        fetchGeneratedPrompts();
        handleCreateTemplateForm();
    } else if (path === '/generate.html') {
        populateModelsDropdown();
        handleImageGenerationForm();
    } else if (path === '/scheduler.html') {
        fetchScheduledTasks();
        populateCharacterDropdown();
        handleCreateTaskForm();
    } else if (path === '/lora.html') {
        handleLoraTrainingForm();
    }
});

function handleLoraTrainingForm() {
    const form = document.getElementById('lora-training-form');
    const statusDiv = document.getElementById('lora-status');
    const logPre = document.getElementById('lora-log');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        statusDiv.textContent = 'Starting LoRA training...';
        logPre.textContent = '';

        try {
            const response = await fetch('/api/lora/train', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.task_id) {
                pollLoraStatus(result.task_id);
            } else {
                throw new Error('Failed to start LoRA training task.');
            }
        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
        }
    });
}

function pollLoraStatus(taskId) {
    const statusDiv = document.getElementById('lora-status');
    const logPre = document.getElementById('lora-log');

    const interval = setInterval(async () => {
        try {
            const response = await fetch(`/api/lora/training-status/${taskId}`);
            const data = await response.json();

            statusDiv.textContent = `Status: ${data.status}`;
            logPre.textContent = data.log;

            if (data.status === 'completed' || data.status === 'failed') {
                clearInterval(interval);
            }
        } catch (error) {
            clearInterval(interval);
            statusDiv.textContent = 'Error fetching status.';
        }
    }, 3000); // Poll every 3 seconds
}

async function fetchScheduledTasks() {
    const tableBody = document.querySelector('#tasks-table tbody');
    try {
        const response = await fetch('/api/scheduler');
        const data = await response.json();
        tableBody.innerHTML = '';
        data.tasks.forEach(task => {
            const row = document.createElement('tr');
            const nextRun = task.next_run_time ? new Date(task.next_run_time).toLocaleString() : 'N/A';
            row.innerHTML = `
                <td>${task.characterId}</td> <!-- Replace with name later -->
                <td>${task.type}</td>
                <td>${task.schedule}</td>
                <td>${task.active ? 'Active' : 'Inactive'}</td>
                <td>${nextRun}</td>
                <td><button>Delete</button></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6">Error loading tasks.</td></tr>`;
    }
}

async function populateCharacterDropdown() {
    const select = document.getElementById('character-select');
    try {
        const response = await fetch('/api/characters');
        const data = await response.json();
        select.innerHTML = '<option value="">--Select a character--</option>';
        data.characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.id;
            option.textContent = char.name;
            select.appendChild(option);
        });
    } catch (error) {
        select.innerHTML = '<option value="">--Could not load characters--</option>';
    }
}

function handleCreateTaskForm() {
    const form = document.getElementById('create-task-form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            await fetch('/api/scheduler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            form.reset();
            fetchScheduledTasks();
        } catch (error) {
            alert('Failed to create task.');
        }
    });
}

async function populateModelsDropdown() {
    const select = document.getElementById('model-select');
    try {
        const response = await fetch('/api/models');
        const data = await response.json();
        select.innerHTML = '<option value="">--Select a model--</option>';
        data.models.forEach(model => {
            if (model.type === 'checkpoint') {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                select.appendChild(option);
            }
        });
    } catch (error) {
        select.innerHTML = '<option value="">--Could not load models--</option>';
    }
}

function handleImageGenerationForm() {
    const form = document.getElementById('generate-image-form');
    const statusDiv = document.getElementById('generation-status');
    const resultContainer = document.getElementById('result-image-container');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        statusDiv.textContent = 'Starting image generation...';
        resultContainer.innerHTML = '';

        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.task_id) {
                pollGenerationStatus(result.task_id);
            } else {
                throw new Error('Failed to start generation task.');
            }
        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
        }
    });
}

function pollGenerationStatus(taskId) {
    const statusDiv = document.getElementById('generation-status');
    const resultContainer = document.getElementById('result-image-container');

    const interval = setInterval(async () => {
        try {
            const response = await fetch(`/api/generation-status/${taskId}`);
            const data = await response.json();

            statusDiv.textContent = `Status: ${data.status}`;

            if (data.status === 'completed') {
                clearInterval(interval);
                const img = document.createElement('img');
                img.src = `data:${data.result.mime_type};base64,${data.result.image_data}`;
                img.style.maxWidth = '100%';
                resultContainer.appendChild(img);
            } else if (data.status === 'failed') {
                clearInterval(interval);
                statusDiv.textContent = `Status: Failed - ${data.error}`;
            }
        } catch (error) {
            clearInterval(interval);
            statusDiv.textContent = 'Error fetching status.';
        }
    }, 2000); // Poll every 2 seconds
}

async function fetchPromptTemplates() {
    const tableBody = document.querySelector('#templates-table tbody');
    try {
        const response = await fetch('/api/prompts?type=templates');
        const data = await response.json();
        tableBody.innerHTML = '';
        data.templates.forEach(template => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${template.name}</td>
                <td>${template.category}</td>
                <td>${template.template}</td>
                <td><button>Delete</button></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4">Error loading templates.</td></tr>`;
    }
}

async function fetchGeneratedPrompts() {
    const tableBody = document.querySelector('#generated-prompts-table tbody');
    try {
        const response = await fetch('/api/prompts');
        const data = await response.json();
        tableBody.innerHTML = '';
        data.prompts.forEach(prompt => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${prompt.characterName}</td>
                <td>${prompt.prompt}</td>
                <td>${new Date(prompt.createdAt).toLocaleString()}</td>
                <td>${prompt.used ? 'Yes' : 'No'}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4">Error loading generated prompts.</td></tr>`;
    }
}

function handleCreateTemplateForm() {
    const form = document.getElementById('create-template-form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const data = {
            action: 'save_template',
            template: Object.fromEntries(formData.entries())
        };

        try {
            await fetch('/api/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            form.reset();
            fetchPromptTemplates();
        } catch (error) {
            alert('Failed to create template.');
        }
    });
}

function handleCreateCharacterForm() {
    const form = document.getElementById('create-character-form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/characters', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error('Failed to create character');
            }

            form.reset();
            fetchCharacters(); // Refresh the list

        } catch (error) {
            alert(`Error creating character: ${error.message}`);
        }
    });
}

async function fetchCharacters() {
    const tableBody = document.querySelector('#characters-table tbody');
    try {
        const response = await fetch('/api/characters');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const characters = data.characters;

        tableBody.innerHTML = ''; // Clear existing rows

        characters.forEach(char => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${char.name}</td>
                <td>${char.personality}</td>
                <td>${char.instagramHandle}</td>
                <td>${char.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                    <button>Edit</button>
                    <button>Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="color: red;">Could not load characters: ${error.message}</td></tr>`;
    }
}

async function fetchSystemStatus() {
    const statusDiv = document.getElementById('system-status');
    try {
        const response = await fetch('/api/system/status');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const status = await response.json();

        statusDiv.innerHTML = ''; // Clear loading message

        for (const [key, value] of Object.entries(status)) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'status-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'status-name';
            nameSpan.textContent = key;

            const valueSpan = document.createElement('span');
            valueSpan.className = `status-value ${value}`;
            valueSpan.textContent = value;

            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(valueSpan);
            statusDiv.appendChild(itemDiv);
        }

    } catch (error) {
        statusDiv.innerHTML = `<p style="color: red;">Could not load system status: ${error.message}</p>`;
    }
}
