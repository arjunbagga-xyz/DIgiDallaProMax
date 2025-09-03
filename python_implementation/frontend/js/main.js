document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('main-nav');
    const panels = document.querySelectorAll('.content-panel');
    const tabs = document.querySelectorAll('.nav-tab');

    // Function to switch tabs
    const switchToTab = (tabName) => {
        // Hide all panels
        panels.forEach(panel => {
            panel.style.display = 'none';
        });

        // Show the target panel
        const targetPanel = document.getElementById(`${tabName}-panel`);
        if (targetPanel) {
            targetPanel.style.display = 'block';
        }

        // Update active class on tabs
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Fetch data for the tab
        fetchDataForTab(tabName);
    };

    // Event listener for nav clicks
    nav.addEventListener('click', (event) => {
        const tab = event.target.closest('.nav-tab');
        if (tab) {
            const tabName = tab.dataset.tab;
            switchToTab(tabName);
        }
    });

    // Initial load
    // I'll start with the 'characters' tab as the default
    switchToTab('characters');

    // --- Dialog Box Logic ---
    const dialogContainer = document.getElementById('dialog-container');
    const dialogBox = document.querySelector('.dialog-box');
    const closeDialogButton = document.querySelector('.close-dialog');

    window.showDialog = function(title, content) {
        document.getElementById('dialog-title').textContent = title;
        const dialogContent = document.querySelector('.dialog-content');
        dialogContent.innerHTML = '';
        dialogContent.appendChild(content);
        dialogContainer.style.display = 'flex';
    }

    window.hideDialog = function() {
        dialogContainer.style.display = 'none';
    }

    closeDialogButton.addEventListener('click', window.hideDialog);
    dialogContainer.addEventListener('click', (e) => {
        if (e.target === dialogContainer) {
            window.hideDialog();
        }
    });

    // --- Dragging Logic for Dialog ---
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    dialogBox.addEventListener('mousedown', (e) => {
        if (e.target.closest('.dialog-header')) {
            isDragging = true;
            offset.x = e.clientX - dialogBox.offsetLeft;
            offset.y = e.clientY - dialogBox.offsetTop;
            dialogBox.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            dialogBox.style.left = `${e.clientX - offset.x}px`;
            dialogBox.style.top = `${e.clientY - offset.y}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        dialogBox.style.cursor = 'grab';
    });


    // --- Character Tab Logic ---
    const addCharacterBtn = document.getElementById('add-character-btn');
    addCharacterBtn.addEventListener('click', () => {
        window.showDialog('Add New Character', createCharacterForm());
    });

    // --- Models & LoRA Training Tab Logic ---
    const trainLoraBtn = document.getElementById('train-lora-btn');
    trainLoraBtn.addEventListener('click', async () => {
        const form = await createLoraTrainingForm();
        window.showDialog('Train New LoRA', form);
    });
});

async function createLoraTrainingForm() {
    const form = document.createElement('form');

    // Fetch characters and models in parallel
    const [characters, models] = await Promise.all([
        fetch('/api/characters').then(res => res.json()),
        fetch('/api/models').then(res => res.json())
    ]);

    const characterOptions = characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const modelOptions = models.map(m => `<option value="${m}">${m}</option>`).join('');

    form.innerHTML = `
        <label for="characterId">Character:</label>
        <select id="characterId" name="characterId" required>
            ${characterOptions}
        </select>
        <label for="baseModel">Base Model:</label>
        <select id="baseModel" name="baseModel" required>
            ${modelOptions}
        </select>
        <button type="submit">Start Training</button>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

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
            alert(`Training started! Log file: ${result.log_file}`);
            window.hideDialog();
        } catch (error) {
            console.error('Error starting LoRA training:', error);
            alert(`Error: ${error.message}`);
        }
    });

    return form;
}

function createCharacterForm(character = {}) {
    const form = document.createElement('form');
    form.innerHTML = `
        <label for="name">Name:</label>
        <input type="text" id="name" name="name" value="${character.name || ''}" required>
        <label for="personality">Personality:</label>
        <textarea id="personality" name="personality" required>${character.personality || ''}</textarea>
        <label for="backstory">Backstory:</label>
        <textarea id="backstory" name="backstory" required>${character.backstory || ''}</textarea>
        <label for="triggerWord">Trigger Word:</label>
        <input type="text" id="triggerWord" name="triggerWord" value="${character.triggerWord || ''}">
        <label for="preferredModel">Preferred Model:</label>
        <input type="text" id="preferredModel" name="preferredModel" value="${character.preferredModel || ''}">
        <button type="submit">Save Character</button>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // This is a simplified version. In a real app, you would have more complex nested objects.
        const characterData = {
            name: data.name,
            personality: data.personality,
            backstory: data.backstory,
            triggerWord: data.triggerWord,
            preferredModel: data.preferredModel,
            // These are nested in the python model, so we create a default structure
            promptSettings: {
                basePrompt: "a photo of a character",
                style: "cinematic",
                mood: "neutral",
                negativePrompt: "low quality, ugly"
            },
            socialMediaAccounts: {}
        };

        try {
            const response = await fetch('/api/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(characterData)
            });
            if (!response.ok) throw new Error('Failed to save character');

            document.querySelector('.close-dialog').click(); // a bit hacky, but works
            fetchCharacters(); // Refresh the list
        } catch (error) {
            console.error('Error saving character:', error);
            // Here you would show an error to the user
        }
    });

    return form;
}


// --- Data Fetching ---

async function fetchCharacters() {
    const list = document.getElementById('characters-list');
    list.innerHTML = '<p>Loading characters...</p>';
    try {
        const response = await fetch('/api/characters');
        const characters = await response.json();
        renderCharacters(characters);
    } catch (error) {
        console.error('Failed to fetch characters:', error);
        list.innerHTML = '<p class="error">Failed to load characters.</p>';
    }
}

function renderCharacters(characters) {
    const list = document.getElementById('characters-list');
    list.innerHTML = '';

    if (characters.length === 0) {
        list.innerHTML = '<p>No characters found. Add one to get started!</p>';
        return;
    }

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h3>${char.name}</h3>
            <p>${char.personality.substring(0, 100)}...</p>
            <div class="card-actions">
                <button class="edit-btn" data-id="${char.id}">Edit</button>
                <button class="train-btn" data-id="${char.id}">Train LoRA</button>
                <button class="delete-btn" data-id="${char.id}">Delete</button>
            </div>
        `;
        list.appendChild(card);
    });

    // Add event listeners for the new buttons
    list.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => console.log('Edit character:', e.target.dataset.id));
    });
    list.querySelectorAll('.train-btn').forEach(btn => {
        btn.addEventListener('click', (e) => console.log('Train LoRA for character:', e.target.dataset.id));
    });
    list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => console.log('Delete character:', e.target.dataset.id));
    });
}

async function fetchModels() {
    const list = document.getElementById('models-list');
    list.innerHTML = '<h3>Available Base Models</h3><p>Loading...</p>';
    try {
        const response = await fetch('/api/models');
        if (!response.ok) throw new Error('Failed to fetch models from server.');
        const models = await response.json();

        const ul = document.createElement('ul');
        models.forEach(modelName => {
            const li = document.createElement('li');
            li.textContent = modelName;
            ul.appendChild(li);
        });
        list.querySelector('p').remove();
        list.appendChild(ul);

    } catch (error) {
        console.error('Failed to fetch models:', error);
        list.innerHTML += `<p class="error">${error.message}</p>`;
    }
}

async function fetchContent() {
    const gallery = document.getElementById('content-gallery');
    gallery.innerHTML = '<h2>Select a Character to View Content</h2>';
    try {
        const response = await fetch('/api/characters');
        const characters = await response.json();
        renderContentCharacterChooser(characters);
    } catch (error) {
        console.error('Failed to fetch characters for content tab:', error);
        gallery.innerHTML = '<p class="error">Failed to load characters.</p>';
    }
}

function renderContentCharacterChooser(characters) {
    const gallery = document.getElementById('content-gallery');
    gallery.innerHTML = '<h2>Select a Character to View Content</h2>';
    const container = document.createElement('div');
    container.className = 'card-container';

    if (characters.length === 0) {
        gallery.innerHTML += '<p>No characters found.</p>';
        return;
    }

    characters.forEach(char => {
        const card = document.createElement('div');
        card.className = 'card character-content-choice';
        card.dataset.id = char.id;
        card.dataset.name = char.name;
        card.innerHTML = `<h3>${char.name}</h3>`;
        container.appendChild(card);
    });

    gallery.appendChild(container);

    gallery.querySelectorAll('.character-content-choice').forEach(card => {
        card.addEventListener('click', (e) => {
            const charId = e.currentTarget.dataset.id;
            const charName = e.currentTarget.dataset.name;
            fetchPromptsForCharacter(charId, charName);
        });
    });
}

async function fetchPromptsForCharacter(characterId, characterName) {
    const gallery = document.getElementById('content-gallery');
    gallery.innerHTML = `<h2>Content for ${characterName}</h2><p>Loading prompts...</p>`;
    try {
        const response = await fetch('/api/prompts');
        const allPrompts = await response.json();
        const characterPrompts = allPrompts.filter(p => p.characterId === characterId);
        renderPromptGallery(characterPrompts, characterId, characterName);
    } catch (error) {
        console.error(`Failed to fetch prompts for ${characterName}:`, error);
        gallery.innerHTML += `<p class="error">Failed to load prompts.</p>`;
    }
}

function renderPromptGallery(prompts, characterId, characterName) {
    const gallery = document.getElementById('content-gallery');
    gallery.innerHTML = `
        <div class="gallery-header">
            <h2>Content for ${characterName}</h2>
            <button id="back-to-chars-btn">&larr; Back to Characters</button>
        </div>
        <div class="gallery-controls">
             <!-- Sorting/filtering controls will go here -->
        </div>
        <div class="prompt-gallery-container card-container"></div>
    `;

    const container = gallery.querySelector('.prompt-gallery-container');
    if (prompts.length === 0) {
        container.innerHTML = '<p>No content found for this character.</p>';
        return;
    }

    prompts.forEach(prompt => {
        const card = document.createElement('div');
        card.className = 'card prompt-card';
        card.innerHTML = `
            <p><strong>Prompt:</strong> ${prompt.prompt}</p>
            <p><strong>Caption:</strong> ${prompt.caption || 'N/A'}</p>
            <small>Posted: ${prompt.used ? 'Yes' : 'No'} | Created: ${new Date(prompt.createdAt).toLocaleDateString()}</small>
            <div class="card-actions">
                <button class="delete-prompt-btn" data-id="${prompt.id}">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });

    // Event listener for back button
    gallery.querySelector('#back-to-chars-btn').addEventListener('click', fetchContent);

    // Event listeners for delete buttons
    gallery.querySelectorAll('.delete-prompt-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const promptId = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this prompt?')) {
                try {
                    const response = await fetch(`/api/prompts/${promptId}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Failed to delete prompt');
                    fetchPromptsForCharacter(characterId, characterName); // Refresh
                } catch (error) {
                    console.error('Error deleting prompt:', error);
                    alert('Could not delete the prompt.');
                }
            }
        });
    });
}


async function fetchStatus() {
    const grid = document.getElementById('status-grid');
    grid.innerHTML = '<p>Loading system status...</p>';
    try {
        const response = await fetch('/api/system/status');
        const data = await response.json();
        renderStatus(data);
    } catch (error) {
        console.error('Failed to fetch system status:', error);
        grid.innerHTML = `<p class="error">Failed to fetch system status.</p>`;
    }
}

function renderStatus(data) {
    const grid = document.getElementById('status-grid');
    grid.innerHTML = ''; // Clear old data
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    grid.style.gap = '1rem';


    Object.entries(data).forEach(([key, value]) => {
        const isOk = value === 'OK' || value === 'Connected' || value === 'Running' || value === 'Configured';
        const statusClass = isOk ? 'status-ok' : 'status-error';

        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = `
            <h3>${key.replace('_', ' ').toUpperCase()}</h3>
            <p class="${statusClass}" style="font-weight: bold; color: ${isOk ? '#4ade80' : '#f87171'};">${value}</p>
        `;
        grid.appendChild(item);
    });
}

function fetchSettings() {
    const settingsForm = document.getElementById('settings-form');
    settingsForm.innerHTML = `
        <p>Application settings and API key management will be available here in a future update.</p>
        <p>For now, please configure settings in the <code>.env</code> file.</p>
    `;
}

// A placeholder for now, will be expanded in later steps
async function fetchDataForTab(tabName) {
    console.log(`Fetching data for ${tabName}...`);
    if (tabName === 'characters') {
        await fetchCharacters();
    } else if (tabName === 'models') {
        await fetchModels();
    } else if (tabName === 'content') {
        await fetchContent();
    } else if (tabName === 'status') {
        await fetchStatus();
    } else if (tabName === 'settings') {
        fetchSettings();
    }
}
