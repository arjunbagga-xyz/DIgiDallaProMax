import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

let camera, scene, renderer;
let cssScene, cssRenderer;
let material;
const panels = {};
let activeTab = 'status';

function init() {
    const container = document.getElementById('scene-container');
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 800;

    scene = new THREE.Scene();
    cssScene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.top = 0;
    container.appendChild(cssRenderer.domElement);

    const uniforms = { u_time: { type: "f", value: 1.0 }, u_resolution: { type: "v2", value: new THREE.Vector2() } };
    material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
        fragmentShader: `
            uniform vec2 u_resolution; uniform float u_time;
            float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
            float noise(vec2 st) {
                vec2 i = floor(st); vec2 f = fract(st);
                float a = random(i); float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }
            void main() {
                vec2 st = gl_FragCoord.xy / u_resolution.xy;
                st.x *= u_resolution.x / u_resolution.y;
                float time = u_time * 0.1;
                float n = noise(st * 3.0 + time);
                vec3 color1 = vec3(0.0, 0.0, 1.0); vec3 color2 = vec3(1.0, 0.0, 1.0); vec3 color3 = vec3(0.0, 1.0, 1.0);
                vec3 color = mix(color1, color2, smoothstep(0.2, 0.5, n));
                color = mix(color, color3, smoothstep(0.5, 0.8, n));
                gl_FragColor = vec4(color, 1.0);
            }`
    });
    const plane = new THREE.PlaneGeometry(2, 2);
    const background = new THREE.Mesh(plane, material);
    scene.add(background);

    createUIPanels();

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();

    setupEventListeners();
    fetchStatus(); // Initial data load
}

function createUIPanels() {
    const panelElements = document.querySelectorAll('.content-panel');
    const angleStep = Math.PI / 4;
    const radius = 1000;

    panelElements.forEach((element, index) => {
        const object = new CSS3DObject(element);
        const angle = (index - 1) * angleStep;

        object.position.x = radius * Math.sin(angle);
        object.position.z = radius * Math.cos(angle) - radius;
        object.rotation.y = -angle;

        cssScene.add(object);
        panels[element.id.replace('-panel', '')] = { element, object };
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
    if (material) {
        material.uniforms.u_resolution.value.x = renderer.domElement.width;
        material.uniforms.u_resolution.value.y = renderer.domElement.height;
    }
}

function animate() {
    requestAnimationFrame(animate);
    const time = Date.now() * 0.0005;
    if (material) material.uniforms.u_time.value += 0.05;

    // Subtle floating animation for all panels
    Object.values(panels).forEach(({ object }) => {
        object.position.y += Math.sin(time + object.position.x) * 0.2;
    });

    renderer.render(scene, camera);
    cssRenderer.render(cssScene, camera);
}

function setupEventListeners() {
    const nav = document.getElementById('main-nav');
    nav.addEventListener('click', (event) => {
        if (event.target.classList.contains('nav-tab')) {
            const tabName = event.target.dataset.tab;
            switchToTab(tabName);
        }
    });
}

function switchToTab(tabName) {
    if (!panels[tabName] || activeTab === tabName) return;

    activeTab = tabName;

    // Update active class on nav buttons
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Animate camera to the target panel
    const targetPanel = panels[tabName].object;
    gsap.to(camera.position, {
        duration: 1.5,
        x: targetPanel.position.x,
        y: targetPanel.position.y,
        z: targetPanel.position.z + 800, // Keep a distance from the panel
        ease: 'power3.inOut'
    });
    gsap.to(camera.rotation, {
        duration: 1.5,
        y: targetPanel.rotation.y,
        ease: 'power3.inOut'
    });

    // Fetch data for the new tab
    if (tabName === 'status') fetchStatus();
    if (tabName === 'characters') fetchCharacters();
    if (tabName === 'models') fetchModels();
    if (tabName === 'content') fetchPrompts();
    if (tabName === 'scheduler') fetchTasks();
    // No fetch for training or settings tabs yet
}

// --- API Fetching and Rendering ---

async function fetchStatus() {
    const grid = document.getElementById('status-grid');
    grid.innerHTML = '<p>Loading status...</p>';
    try {
        const response = await fetch('/api/system/status');
        const data = await response.json();
        grid.innerHTML = ''; // Clear old data

        Object.entries(data).forEach(([key, value]) => {
            const isOk = value === 'OK' || value === 'Connected' || value === 'Running' || value === 'Configured';
            const statusClass = isOk ? 'status-ok' : 'status-error';
            const item = document.createElement('div');
            item.className = 'status-item';
            item.innerHTML = `<h3>${key.replace('_', ' ').toUpperCase()}</h3><p class="${statusClass}">${value}</p>`;
            grid.appendChild(item);
        });

    } catch (error) {
        console.error('Failed to fetch system status:', error);
        grid.innerHTML = `<p class="status-error">Failed to fetch system status.</p>`;
    }
}

async function fetchCharacters() {
    const list = document.getElementById('characters-list');
    list.innerHTML = '<p>Loading characters...</p>';
    try {
        const response = await fetch('/api/characters');
        const data = await response.json();
        list.innerHTML = ''; // Clear old data

        if (data.length === 0) {
            list.innerHTML = '<p>No characters found. Create one to get started!</p>';
            return;
        }

        data.forEach(char => {
            const item = document.createElement('div');
            item.className = 'character-item'; // You'll need to style this
            item.innerHTML = `<h4>${char.name}</h4><p>${char.personality}</p>`;
            list.appendChild(item);
        });

    } catch (error) {
        console.error('Failed to fetch characters:', error);
        list.innerHTML = `<p class="status-error">Failed to fetch characters.</p>`;
    }
}

async function fetchModels() {
    const list = document.getElementById('models-list');
    list.innerHTML = '<p>Loading models...</p>';
    try {
        const response = await fetch('/api/models');
        const data = await response.json();
        list.innerHTML = ''; // Clear old data

        if (data.length === 0) {
            list.innerHTML = '<p>No models found on ComfyUI server.</p>';
            return;
        }

        const ul = document.createElement('ul');
        data.forEach(modelName => {
            const li = document.createElement('li');
            li.textContent = modelName;
            ul.appendChild(li);
        });
        list.appendChild(ul);

    } catch (error) {
        console.error('Failed to fetch models:', error);
        list.innerHTML = `<p class="status-error">Could not connect to ComfyUI server.</p>`;
    }
}

async function fetchPrompts() {
    const list = document.getElementById('prompts-list');
    list.innerHTML = '<p>Loading prompts...</p>';
    try {
        const response = await fetch('/api/prompts');
        const data = await response.json();
        list.innerHTML = ''; // Clear old data

        if (data.length === 0) {
            list.innerHTML = '<p>No prompts have been generated yet.</p>';
            return;
        }

        data.forEach(prompt => {
            const item = document.createElement('div');
            item.className = 'prompt-item'; // Style this
            item.innerHTML = `
                <h4>For: ${prompt.characterName}</h4>
                <p><strong>Prompt:</strong> ${prompt.prompt}</p>
                <p><strong>Caption:</strong> ${prompt.caption || 'Not generated'}</p>
                <small>Used: ${prompt.used}</small>
            `;
            list.appendChild(item);
        });

    } catch (error) {
        console.error('Failed to fetch prompts:', error);
        list.innerHTML = `<p class="status-error">Failed to fetch prompts.</p>`;
    }
}

async function fetchTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '<p>Loading scheduled tasks...</p>';
    try {
        const response = await fetch('/api/scheduler/tasks');
        const data = await response.json();
        list.innerHTML = ''; // Clear old data

        if (data.length === 0) {
            list.innerHTML = '<p>No scheduled tasks found.</p>';
            return;
        }

        data.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item'; // Style this
            item.innerHTML = `
                <h4>Task: ${task.type}</h4>
                <p>For Character ID: ${task.characterId}</p>
                <p>Schedule (Cron): <code>${task.schedule}</code></p>
                <p>Status: ${task.active ? 'Active' : 'Paused'}</p>
            `;
            list.appendChild(item);
        });

    } catch (error) {
        console.error('Failed to fetch scheduled tasks:', error);
        list.innerHTML = `<p class="status-error">Failed to fetch tasks.</p>`;
    }
}


// --- Main Execution ---
init();
animate();
