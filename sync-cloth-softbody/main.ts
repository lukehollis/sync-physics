// Main application entry point for cloth simulation

import { setupEngine, startSimulation } from "./syncs/index.ts";

// Global Ammo instance will be available after loading
declare global {
    const Ammo: any;
}

// Add loading indicator
const loadingDiv = document.createElement('div');
loadingDiv.className = 'loading';
loadingDiv.textContent = 'Loading physics engine...';
document.body.appendChild(loadingDiv);

// Initialize Ammo.js physics engine
Ammo().then(() => {
    console.log("Ammo.js physics engine loaded");
    
    // Remove loading indicator
    loadingDiv.remove();
    
    // Setup the concept-based engine
    const engine = setupEngine();
    
    // Enable logging to debug initialization  
    (globalThis as any).Sync.logging = (globalThis as any).Logging.OFF;
    
    // Start the simulation
    console.log("About to call startSimulation...");
    startSimulation(engine);
    
    // Check if API is available
    console.log("API concept available:", !!(globalThis as any).API);
    console.log("All global concepts:", Object.keys(globalThis).filter(k => k.includes('Concept') || ['Physics', 'Cloth', 'Scene', 'Interaction', 'Entity', 'API', 'Sync'].includes(k)));
    
    // Add manual initialization trigger for debugging
    (globalThis as any).manualInit = () => {
        console.log("Manual initialization triggered");
        const API = (globalThis as any).API;
        const Physics = (globalThis as any).Physics;
        const Scene = (globalThis as any).Scene;
        const Cloth = (globalThis as any).Cloth;
        
        if (API && Physics && Scene && Cloth) {
            console.log("All concepts available, triggering manual init");
            // Try direct initialization
            Physics.initialize({ gravity: { x: 0, y: -9.8, z: 0 } });
            Scene.initialize({ width: 800, height: 600 });
            Cloth.create({
                cloth: "main_cloth",
                width: 10,
                height: 10,
                segmentsX: 20,
                segmentsY: 20,
                mass: 1,
                position: { x: 0, y: 5, z: 0 }
            });
        } else {
            console.error("Not all concepts available for manual init");
        }
    };
    console.log("Manual init function available: call manualInit() in console to test");
    
    // Setup event listeners for user interaction after a delay
    // to ensure Scene has initialized and created the canvas
    setTimeout(() => {
        // Debug: Check if concepts are available
        console.log("Checking for concepts before setupEventListeners:");
        console.log("Interaction available:", !!(globalThis as any).Interaction);
        console.log("Scene available:", !!(globalThis as any).Scene);
        console.log("Entity available:", !!(globalThis as any).Entity);
        
        setupEventListeners(0); // Pass retry count
    }, 500); // Increased delay to give Scene time to initialize
    
    // Setup FPS counter
    let lastTime = performance.now();
    let frames = 0;
    const fpsElement = document.querySelector('#fps span');
    const objectsElement = document.querySelector('#objects span');
    
    function updateStats() {
        frames++;
        const currentTime = performance.now();
        if (currentTime >= lastTime + 1000) {
            if (fpsElement) {
                fpsElement.textContent = Math.round((frames * 1000) / (currentTime - lastTime)).toString();
            }
            frames = 0;
            lastTime = currentTime;
        }
        
        // Update object count (count Scene meshes + Entity projectiles)
        const Scene = (globalThis as any).Scene;
        const Entity = (globalThis as any).Entity;
        let totalObjects = 0;
        
        if (Scene && Scene._getAllMeshes) {
            const allMeshes = Scene._getAllMeshes({});
            if (allMeshes) {
                totalObjects += allMeshes.length;
            }
        }
        
        if (Entity && Entity._getAllObjects) {
            const allEntities = Entity._getAllObjects({});
            if (allEntities) {
                totalObjects += allEntities.length;
            }
        }
        
        if (objectsElement) {
            objectsElement.textContent = totalObjects.toString();
        }
        
        requestAnimationFrame(updateStats);
    }
    
    updateStats();
});

function setupEventListeners(retryCount: number = 0) {
    const maxRetries = 10;
    const canvas = document.querySelector('canvas');
    const Interaction = (globalThis as any).Interaction;
    
    if (!canvas) {
        if (retryCount < maxRetries) {
            console.log(`Canvas not found in DOM, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
            // Retry after a delay
            setTimeout(() => setupEventListeners(retryCount + 1), 500);
        } else {
            console.error("Canvas not found after maximum retries. Scene may not have initialized properly.");
        }
        return;
    }
    
    if (!Interaction) {
        if (retryCount < maxRetries) {
            console.log(`Interaction concept not found, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
            console.log("Available on globalThis:", Object.keys(globalThis).filter(k => k.endsWith('Concept') || ['Physics', 'Cloth', 'Scene', 'Interaction', 'Entity', 'API', 'Sync'].includes(k)));
            // Retry after a delay
            setTimeout(() => setupEventListeners(retryCount + 1), 500);
        } else {
            console.error("Interaction concept not found after maximum retries.");
        }
        return;
    }
    
    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click only
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            Interaction.mouseDown({
                event: `mouse_down_${Date.now()}`,
                position: { x, y },
                button: e.button
            });
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        Interaction.mouseMove({
            event: `mouse_move_${Date.now()}`,
            position: { x, y }
        });
    });
    
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) { // Left click only
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            Interaction.mouseUp({
                event: `mouse_up_${Date.now()}`,
                position: { x, y },
                button: e.button
            });
        }
    });
    
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            Interaction.keyDown({
                event: `key_down_${Date.now()}`,
                key: e.key
            });
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            Interaction.keyUp({
                event: `key_up_${Date.now()}`,
                key: e.key
            });
        }
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        const Scene = (globalThis as any).Scene;
        if (Scene) {
            Scene.resize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        }
    });
    
    console.log(`Event listeners setup complete (after ${retryCount} retries)`);
}
