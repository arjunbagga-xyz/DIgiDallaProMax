document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Switcher ---
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('light-mode', themeToggle.checked);
    });

    // --- Tab Switching ---
    const nav = document.getElementById('main-nav');
    const contentPanels = document.querySelectorAll('.content-panel');
    const tabs = document.querySelectorAll('.nav-tab');

    nav.addEventListener('click', (event) => {
        const tabButton = event.target.closest('.nav-tab');
        if (!tabButton) return;

        const tabName = tabButton.dataset.tab;

        // Update active class on tabs
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Show the correct panel
        contentPanels.forEach(panel => {
            if (panel.id === `${tabName}-panel`) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });

        fetchDataForTab(tabName);
    });

    // --- Dialog Management ---
    const dialogContainer = document.getElementById('dialog-container');
    const dialogBox = document.querySelector('.dialog-box');
    const closeDialogButton = document.querySelector('.close-dialog');
    const dialogTitle = document.getElementById('dialog-title');
    const dialogContent = document.querySelector('.dialog-content');

    window.showDialog = (title, content) => {
        dialogTitle.textContent = title;
        dialogContent.innerHTML = '';
        dialogContent.appendChild(content);
        dialogContainer.style.display = 'flex';
    };

    window.hideDialog = () => {
        dialogContainer.style.display = 'none';
    };

    closeDialogButton.addEventListener('click', window.hideDialog);
    dialogContainer.addEventListener('click', (e) => {
        if (e.target === dialogContainer) {
            window.hideDialog();
        }
    });

    // Set initial tab
    document.querySelector('.nav-tab[data-tab="characters"]').click();

    // Apply saved settings on initial load
    const savedBlur = localStorage.getItem('glassBlur') || 16;
    document.documentElement.style.setProperty('--glass-blur', `${savedBlur}px`);
});

// --- Data Fetching Router ---
function fetchDataForTab(tabName) {
    console.log(`Fetching data for ${tabName}...`);
    if (tabName === 'characters') {
        fetchCharacters();
    } else if (tabName === 'models') {
        fetchModelsAndLoras();
    } else if (tabName === 'content') {
        fetchContent();
    } else if (tabName === 'status') {
        fetchStatus();
    } else if (tabName === 'settings') {
        fetchSettings();
    }
}

// --- Characters Tab ---
async function fetchCharacters() {
    const panel = document.getElementById('characters-panel');
    panel.innerHTML = `<h2>Characters</h2><div class="card-container">Loading...</div><button id="add-character-btn" class="fab">+</button>`;

    // Re-add event listener for the new button
    panel.querySelector('#add-character-btn').addEventListener('click', handleAddCharacter);

    try {
        const response = await fetch('/api/characters');
        if (!response.ok) throw new Error('Failed to fetch characters');
        const characters = await response.json();
        renderCharacters(characters);
    } catch (error) {
        console.error(error);
        panel.querySelector('.card-container').innerHTML = `<p class="error">${error.message}</p>`;
    }
}

// --- Settings Tab ---
function fetchSettings() {
    const panel = document.getElementById('settings-panel');
    const savedBlur = localStorage.getItem('glassBlur') || 16;

    panel.innerHTML = `
        <h2>Settings</h2>
        <p>This page is for managing application-wide settings.</p>
        <div class="settings-item">
            <strong>Theme:</strong> The light/dark mode toggle is in the top-right corner of the header.
        </div>
        <div class="settings-item">
            <label for="blur-slider">Glass Blur Intensity: <span id="blur-value">${savedBlur}px</span></label>
            <input type="range" id="blur-slider" min="0" max="40" value="${savedBlur}">
        </div>
        <div class="settings-item">
            <strong>API Keys & Endpoints:</strong> Currently, these must be configured in the <code>.env</code> file on the server.
        </div>
    `;

    const blurSlider = panel.querySelector('#blur-slider');
    const blurValueSpan = panel.querySelector('#blur-value');

    blurSlider.addEventListener('input', (e) => {
        const newBlur = e.target.value;
        document.documentElement.style.setProperty('--glass-blur', `${newBlur}px`);
        blurValueSpan.textContent = `${newBlur}px`;
    });

    blurSlider.addEventListener('change', (e) => {
        localStorage.setItem('glassBlur', e.target.value);
    });
}

function renderCharacters(characters) {
    const container = document.querySelector('#characters-panel .card-container');
    container.innerHTML = '';
    if (characters.length === 0) {
        container.innerHTML = '<p>No characters found. Add one to get started!</p>';
        return;
    }
    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'card character-card'; // Add specific class
        card.innerHTML = `
            <img src="https://via.placeholder.com/150/000000/FFFFFF/?text=${char.name.charAt(0)}" alt="${char.name}" style="width: 80%; height: auto; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 0.5rem; margin-bottom: 1rem;">
            <h3>${char.name}</h3>
            <div class="card-actions">
                <button class="edit-btn" data-id="${char.id}">Edit</button>
                <button class="train-lora-btn" data-id="${char.id}">Train</button>
                <button class="delete-btn" data-id="${char.id}">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });

    // Add event listeners
    container.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEditCharacter));
    container.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDeleteCharacter));
    container.querySelectorAll('.train-lora-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const charId = e.target.dataset.id;
            handleTrainLora(charId);
        });
    });
}

function handleAddCharacter() {
    const form = createCharacterForm();
    window.showDialog('Add New Character', form);
}

async function handleEditCharacter(event) {
    const charId = event.target.dataset.id;
    try {
        const response = await fetch(`/api/characters/${charId}`);
        if (!response.ok) throw new Error('Failed to fetch character details');
        const character = await response.json();
        const form = createCharacterForm(character);
        window.showDialog(`Edit ${character.name}`, form);
    } catch (error) {
        console.error(error);
        alert('Could not load character data for editing.');
    }
}

async function handleDeleteCharacter(event) {
    const charId = event.target.dataset.id;
    if (confirm('Are you sure you want to delete this character? This action cannot be undone.')) {
        try {
            const response = await fetch(`/api/characters/${charId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete character');
            fetchCharacters(); // Refresh the list
        } catch (error) {
            console.error(error);
            alert('Could not delete character.');
        }
    }
}

function createCharacterForm(character = null) {
    const isEdit = character !== null;
    let narratives = isEdit ? [...character.narratives] : [];

    const formWrapper = document.createElement('div');
    const form = document.createElement('form');
    form.id = 'character-form';

    const name = character ? character.name : '';
    const personality = character ? character.personality : '';
    const backstory = character ? character.backstory : '';
    const promptSettings = character ? JSON.stringify(character.promptSettings, null, 2) : JSON.stringify({ basePrompt: "", negativePrompt: "", style: "", mood: "" }, null, 2);

    form.innerHTML = `
        <label for="name">Name</label>
        <input type="text" id="name" name="name" value="${name}" required>

        <label for="personality">Personality</label>
        <textarea id="personality" name="personality" rows="4" required>${personality}</textarea>

        <label for="backstory">Backstory</label>
        <textarea id="backstory" name="backstory" rows="4" required>${backstory}</textarea>

        <label for="promptSettings">Prompt Settings (JSON)</label>
        <textarea id="promptSettings" name="promptSettings" rows="6" required>${promptSettings}</textarea>
    `;

    formWrapper.appendChild(form);

    if (isEdit) {
        const narrativeSection = document.createElement('div');
        narrativeSection.id = 'narrative-section';
        narrativeSection.innerHTML = '<h3>Narratives</h3><div id="narrative-list"></div><button type="button" id="add-narrative-btn">Add Narrative</button>';
        formWrapper.appendChild(narrativeSection);

        const renderNarratives = () => {
            const list = narrativeSection.querySelector('#narrative-list');
            list.innerHTML = '';
            narratives.forEach((narr, index) => {
                const item = document.createElement('div');
                item.className = 'narrative-item card';
                item.innerHTML = `
                    <strong>${narr.title}</strong>
                    <p>${narr.description}</p>
                    <small>${new Date(narr.startDate).toLocaleDateString()} - ${new Date(narr.endDate).toLocaleDateString()}</small>
                    <div class="card-actions">
                        <button type="button" class="edit-narrative-btn" data-index="${index}">Edit</button>
                        <button type="button" class="delete-narrative-btn delete-btn" data-index="${index}">Delete</button>
                    </div>
                `;
                list.appendChild(item);
            });

            list.querySelectorAll('.delete-narrative-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const index = e.target.dataset.index;
                    narratives.splice(index, 1);
                    renderNarratives();
                };
            });

            list.querySelectorAll('.edit-narrative-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const index = e.target.dataset.index;
                    const item = e.target.closest('.narrative-item');
                    const narrative = narratives[index];

                    // Replace item content with a form
                    item.innerHTML = `
                        <input type="text" value="${narrative.title}" class="narrative-title-input">
                        <textarea class="narrative-desc-input">${narrative.description}</textarea>
                        <input type="date" value="${narrative.startDate.split('T')[0]}" class="narrative-start-input">
                        <input type="date" value="${narrative.endDate.split('T')[0]}" class="narrative-end-input">
                        <div class="card-actions">
                            <button type="button" class="save-narrative-btn">Save</button>
                            <button type="button" class="cancel-narrative-btn">Cancel</button>
                        </div>
                    `;

                    item.querySelector('.cancel-narrative-btn').onclick = () => {
                        renderNarratives(); // Just re-render to cancel
                    };

                    item.querySelector('.save-narrative-btn').onclick = () => {
                        const updatedNarrative = {
                            ...narrative,
                            title: item.querySelector('.narrative-title-input').value,
                            description: item.querySelector('.narrative-desc-input').value,
                            startDate: new Date(item.querySelector('.narrative-start-input').value).toISOString(),
                            endDate: new Date(item.querySelector('.narrative-end-input').value).toISOString(),
                        };
                        narratives[index] = updatedNarrative;
                        renderNarratives();
                    };
                };
            });
        };

        narrativeSection.querySelector('#add-narrative-btn').onclick = () => {
            // For simplicity, we'll add a blank narrative. A real implementation
            // would use another form/dialog here.
            narratives.push({
                id: `new-${Date.now()}`, // Temp ID
                title: 'New Narrative',
                description: '',
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
            });
            renderNarratives();
        };

        renderNarratives();
    }

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = isEdit ? 'Save Changes' : 'Create Character';
    form.appendChild(submitButton);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        let data = Object.fromEntries(formData.entries());

        try {
            data.promptSettings = JSON.parse(data.promptSettings);
        } catch (error) {
            alert('Invalid JSON in Prompt Settings.');
            return;
        }

        data.narratives = narratives.map(n => ({...n, id: n.id.startsWith('new-') ? undefined : n.id }));


        const url = isEdit ? `/api/characters/${character.id}` : '/api/characters';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || `Failed to ${isEdit ? 'update' : 'create'} character`);
            }
            window.hideDialog();
            fetchCharacters(); // Refresh list
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    });

    return formWrapper;
}

// --- Models & LoRA Training Tab ---
async function fetchModelsAndLoras() {
    const panel = document.getElementById('models-panel');
    panel.innerHTML = `
        <div class="models-header">
            <h2>Models & LoRA Training</h2>
            <button id="train-lora-btn">Train New LoRA</button>
        </div>
        <div class="card-container">
            <div class="card" id="base-models-section">
                <h3>Base Models</h3>
                <div class="model-list">Loading...</div>
            </div>
            <div class="card" id="loras-section">
                <h3>LoRAs</h3>
                <p>LoRA listing is not yet supported by the API.</p>
            </div>
            <div class="card" id="training-jobs-section">
                <h3>Training Jobs</h3>
                <p>Training job progress is not yet supported by the API.</p>
            </div>
        </div>
    `;

    panel.querySelector('#train-lora-btn').addEventListener('click', handleTrainLora);

    try {
        const response = await fetch('/api/models');
        if (!response.ok) throw new Error('Failed to fetch base models');
        const models = await response.json();
        const container = panel.querySelector('#base-models-section .model-list');
        container.innerHTML = '';
        models.forEach(model => {
            const item = document.createElement('p');
            item.textContent = model;
            container.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        panel.querySelector('#base-models-section .model-list').innerHTML = `<p class="error">${error.message}</p>`;
    }
}

async function handleTrainLora(characterId = null) {
    const form = await createLoraTrainingForm(characterId);
    window.showDialog('Train New LoRA', form);
}

async function createLoraTrainingForm(characterId = null) {
    const form = document.createElement('form');

    try {
        const [charResponse, modelsResponse] = await Promise.all([
            fetch('/api/characters'),
            fetch('/api/models')
        ]);

        if (!charResponse.ok) {
            throw new Error(`Failed to load characters: ${charResponse.statusText}`);
        }
        const characters = await charResponse.json();

        if (!modelsResponse.ok) {
            const err = await modelsResponse.json();
            throw new Error(`Failed to load models: ${err.detail || modelsResponse.statusText}`);
        }
        const models = await modelsResponse.json();

        if (!Array.isArray(models)) {
            throw new Error('The server did not return a valid list of models.');
        }

        const characterOptions = characters.map(c => `<option value="${c.id}" ${c.id === characterId ? 'selected' : ''}>${c.name}</option>`).join('');
        const modelOptions = models.map(m => `<option value="${m}">${m}</option>`).join('');

        form.innerHTML = `
            <label for="characterId">Character</label>
            <select id="characterId" name="characterId" required>${characterOptions}</select>
            <label for="baseModel">Base Model</label>
            <select id="baseModel" name="baseModel" required>${modelOptions}</select>
            <p style="font-size: 0.8rem; opacity: 0.7;">Note: Image selection is not yet supported by the backend.</p>
            <button type="submit">Start Training</button>
        `;
    } catch (error) {
        console.error('Error creating LoRA form:', error);
        form.innerHTML = `<p class="error">Could not load data for form: ${error.message}</p>`;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.image_paths = []; // Add empty array as it's required by the model

        try {
            const response = await fetch('/api/lora/train', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to start training');
            }
            const result = await response.json();
            alert(`Training started successfully! Log file: ${result.log_file}`);
            window.hideDialog();
        } catch (error) {
            console.error('Error starting LoRA training:', error);
            alert(`Error: ${error.message}`);
        }
    });

    return form;
}

// --- Content Tab ---
async function fetchContent() {
    const panel = document.getElementById('content-panel');
    panel.innerHTML = `<h2>Content</h2><p>Select a character to view their generated content.</p><div class="card-container">Loading characters...</div>`;

    try {
        const response = await fetch('/api/characters');
        if (!response.ok) throw new Error('Failed to fetch characters');
        const characters = await response.json();

        const container = panel.querySelector('.card-container');
        container.innerHTML = '';
        if (characters.length === 0) {
            container.innerHTML = '<p>No characters found. Add a character first.</p>';
            return;
        }

        characters.forEach(char => {
            const card = document.createElement('div');
            card.className = 'card content-char-card';
            card.dataset.id = char.id;
            card.dataset.name = char.name;
            card.innerHTML = `<h3>${char.name}</h3>`;
            container.appendChild(card);
        });

        container.querySelectorAll('.content-char-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const charId = e.currentTarget.dataset.id;
                const charName = e.currentTarget.dataset.name;
                showContentGallery(charId, charName);
            });
        });

    } catch (error) {
        console.error(error);
        panel.querySelector('.card-container').innerHTML = `<p class="error">${error.message}</p>`;
    }
}

async function showContentGallery(characterId, characterName) {
    const galleryContent = document.createElement('div');
    galleryContent.className = 'gallery-container';
    galleryContent.innerHTML = `<div class="card-container">Loading content...</div>`;

    window.showDialog(`Content for ${characterName}`, galleryContent);

    try {
        const response = await fetch('/api/prompts');
        if (!response.ok) throw new Error('Failed to fetch prompts');
        const allPrompts = await response.json();
        const charPrompts = allPrompts.filter(p => p.characterId === characterId);

        const container = galleryContent.querySelector('.card-container');
        container.innerHTML = '';

        if (charPrompts.length === 0) {
            container.innerHTML = '<p>No content found for this character.</p>';
            return;
        }

        charPrompts.forEach(prompt => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <p><strong>Prompt:</strong> ${prompt.prompt}</p>
                <p><strong>Caption:</strong> ${prompt.caption || 'N/A'}</p>
                <small>Posted: ${prompt.used ? 'Yes' : 'No'}</small>
                <div class="card-actions">
                    <button class="delete-prompt-btn delete-btn" data-id="${prompt.id}">Delete</button>
                </div>
            `;
            container.appendChild(card);
        });

        container.querySelectorAll('.delete-prompt-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const promptId = e.target.dataset.id;
                if (confirm('Are you sure you want to delete this prompt?')) {
                    const deleteResponse = await fetch(`/api/prompts/${promptId}`, { method: 'DELETE' });
                    if (deleteResponse.ok) {
                        // Refresh the gallery content
                        window.hideDialog();
                        showContentGallery(characterId, characterName);
                    } else {
                        alert('Failed to delete prompt.');
                    }
                }
            });
        });

    } catch (error) {
        console.error(error);
        galleryContent.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

// --- Status Tab ---
async function fetchStatus() {
    const panel = document.getElementById('status-panel');
    panel.innerHTML = `<h2>System Status</h2><div class="card-container">Loading...</div>`;
    try {
        const response = await fetch('/api/system/status');
        if (!response.ok) throw new Error('Failed to fetch system status');
        const status = await response.json();

        const container = panel.querySelector('.card-container');
        container.innerHTML = '';
        Object.entries(status).forEach(([key, value]) => {
            const card = document.createElement('div');
            card.className = 'card status-card';
            const isOk = value === 'OK' || value === 'Connected' || value === 'Running' || value === 'Configured';
            card.innerHTML = `
                <h3>${key.replace('_', ' ').toUpperCase()}</h3>
                <p style="color: ${isOk ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${value}</p>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        panel.querySelector('.card-container').innerHTML = `<p class="error">${error.message}</p>`;
    }
}
