import { SyncConcept, Logging } from "../engine/mod.ts";

// Import concepts
import { PhysicsConcept } from "../concepts/PhysicsConcept.ts";
import { ClothConcept } from "../concepts/ClothConcept.ts";
import { SceneConcept } from "../concepts/SceneConcept.ts";
import { InteractionConcept } from "../concepts/InteractionConcept.ts";
import { EntityConcept } from "../concepts/EntityConcept.ts";
import { APIConcept } from "../concepts/APIConcept.ts";

// Import synchronizations
import { 
    InitializeSimulation, 
    SetupScene, 
    SetupPhysicsBodies,
    AnchorClothCorners
} from "./initialization.syncs.ts";
import { 
    PhysicsStep, 
    UpdateMeshFromPhysics, 
    UpdateClothMesh,
    ApplyClothAnchorsToPhysics,
    ReleaseClothAnchorsFromPhysics,
    CheckClothTearing
} from "./physics.syncs.ts";
import { 
    StartClothDrag,
    UpdateClothDrag,
    EndClothDrag,
    ShootProjectile,
    CleanupProjectiles,
    TriggerCleanup
} from "./interaction.syncs.ts";

export function setupEngine(): SyncConcept {
    // Create new Sync engine
    const Sync = new SyncConcept();
    
    // Set logging level (OFF, TRACE, or VERBOSE)
    // TRACE logs all actions, which can be noisy in render loops
    Sync.logging = Logging.OFF;
    
    // Register concepts
    const concepts = {
        Physics: new PhysicsConcept(),
        Cloth: new ClothConcept(),
        Scene: new SceneConcept(),
        Interaction: new InteractionConcept(),
        Entity: new EntityConcept(),
        API: new APIConcept()
    };

    // Instrument concepts to be reactive
    const instrumentedConcepts = Sync.instrument(concepts);
    
    // Make instrumented concepts globally available using direct assignment
    // Avoid Object.assign which may not be available in Ammo.js environment
    const g = globalThis as any;
    
    // Expose Sync engine and Logging levels globally for debugging
    g.Sync = Sync;
    g.Logging = Logging;
    // Allow dynamic logging control from console: Sync.logging = Logging.TRACE
    g.Physics = instrumentedConcepts.Physics;
    g.Cloth = instrumentedConcepts.Cloth;
    g.Scene = instrumentedConcepts.Scene;
    g.Interaction = instrumentedConcepts.Interaction;
    g.Entity = instrumentedConcepts.Entity;
    g.API = instrumentedConcepts.API;

    // Create sync functions with concepts passed in
    const createSyncs = (concepts: any) => ({
        // Initialization syncs
        InitializeSimulation: InitializeSimulation(concepts),
        SetupScene: SetupScene(concepts),
        SetupPhysicsBodies: SetupPhysicsBodies(concepts),
        AnchorClothCorners: AnchorClothCorners(concepts),
        
        // Physics syncs
        PhysicsStep: PhysicsStep(concepts),
        UpdateMeshFromPhysics: UpdateMeshFromPhysics(concepts),
        UpdateClothMesh: UpdateClothMesh(concepts),
        ApplyClothAnchorsToPhysics: ApplyClothAnchorsToPhysics(concepts),
        ReleaseClothAnchorsFromPhysics: ReleaseClothAnchorsFromPhysics(concepts),
        CheckClothTearing: CheckClothTearing(concepts),
        
        // Interaction syncs
        StartClothDrag: StartClothDrag(concepts),
        UpdateClothDrag: UpdateClothDrag(concepts),
        EndClothDrag: EndClothDrag(concepts),
        ShootProjectile: ShootProjectile(concepts),
        CleanupProjectiles: CleanupProjectiles(concepts),
        TriggerCleanup: TriggerCleanup(concepts)
    });

    const syncs = createSyncs(instrumentedConcepts);

    Sync.register(syncs);

    return Sync;
}

export function startSimulation(sync: SyncConcept) {
    // Get instrumented API concept
    const API = (globalThis as any).API;
    
    console.log("Starting simulation, API available?", !!API);
    
    if (!API) {
        console.error("API concept not available!");
        return;
    }
    
    // Directly initialize concepts instead of relying on API sync
    const Physics = (globalThis as any).Physics;
    const Scene = (globalThis as any).Scene;
    const Cloth = (globalThis as any).Cloth;
    
    if (!Physics || !Scene || !Cloth) {
        console.error("Required concepts not available:", { Physics: !!Physics, Scene: !!Scene, Cloth: !!Cloth });
        return;
    }
    
    console.log("Initializing physics world...");
    Physics.initialize({ gravity: { x: 0, y: -9.8, z: 0 } });
    
    console.log("Initializing scene...");
    Scene.initialize({ width: window.innerWidth, height: window.innerHeight });
    
    console.log("Creating cloth...");
    const clothResult = Cloth.create({
        cloth: "main_cloth",
        width: 10,
        height: 10,
        segmentsX: 20,
        segmentsY: 20,
        mass: 1,
        position: { x: 0, y: 5, z: 0 }
    });
    
    console.log("Cloth created:", clothResult);
    
    // Setup scene elements
    Scene.addLight({
        light: "ambient",
        type: "ambient",
        color: 0xffffff,
        intensity: 0.6,
        position: { x: 0, y: 0, z: 0 }
    });
    
    Scene.addLight({
        light: "directional",
        type: "directional",
        color: 0xffffff,
        intensity: 0.5,
        position: { x: 5, y: 10, z: 5 }
    });
    
    // Create ground plane (rotated to be horizontal)
    Scene.createMesh({
        mesh: "ground",
        geometry: JSON.stringify({ type: "plane", width: 100, height: 100 }),
        material: "ground",
        position: { x: 0, y: -5, z: 0 }
    });
    
    // Rotate ground to be horizontal (rotate -90 degrees around X axis)
    Scene.updateMesh({
        mesh: "ground",
        rotation: { x: -0.7071068, y: 0, z: 0, w: 0.7071068 }
    });
    
    // Create sphere obstacle
    Scene.createMesh({
        mesh: "sphere",
        geometry: JSON.stringify({ type: "sphere", radius: 2 }),
        material: "standard",
        position: { x: 0, y: 0, z: 0 }
    });
    
    // Create cloth mesh
    Scene.createMesh({
        mesh: "cloth_mesh",
        geometry: JSON.stringify({ 
            vertices: clothResult.vertices, 
            indices: clothResult.indices 
        }),
        material: JSON.stringify({
            color: 0xff7700,
            doubleSide: true,
            roughness: 0.8,
            metalness: 0.2
        }),
        position: { x: 0, y: 0, z: 0 }
    });
    
    // Create physics bodies
    Physics.createRigidBody({
        body: "ground_body",
        shape: JSON.stringify({ type: "box", halfExtents: { x: 50, y: 0.1, z: 50 } }),
        mass: 0,
        position: { x: 0, y: -5, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    Physics.createRigidBody({
        body: "sphere_body",
        shape: JSON.stringify({ type: "sphere", radius: 2 }),
        mass: 0,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    // Create soft body for cloth
    const softBodyResult = Physics.createSoftBody({
        body: "cloth_body",
        mesh: JSON.stringify({ 
            vertices: clothResult.vertices, 
            indices: clothResult.indices 
        }),
        mass: 1,
        position: { x: 0, y: 5, z: 0 }
    });
    
    console.log("Soft body created:", softBodyResult);
    
    // Anchor cloth corners
    Physics.anchorSoftBodyNode({
        body: "cloth_body",
        nodeIndex: 0,
        position: { x: -5, y: 5, z: -5 }
    });
    
    Physics.anchorSoftBodyNode({
        body: "cloth_body",
        nodeIndex: 20,
        position: { x: 5, y: 5, z: -5 }
    });
    
    // Start render loop with physics stepping
    let frameCount = 0;
    function animate() {
        requestAnimationFrame(animate);
        
        // Step physics
        Physics.step({});
        
        // Update cloth mesh from soft body
        const softBodyNodes = Physics._getSoftBodyNodes({ body: "cloth_body" });
        if (softBodyNodes && softBodyNodes.length > 0 && softBodyNodes[0].vertices) {
            Scene.updateMesh({
                mesh: "cloth_mesh",
                vertices: softBodyNodes[0].vertices
            });
            
            Cloth.updateVertices({
                cloth: "main_cloth",
                vertices: softBodyNodes[0].vertices
            });
        }
        
        // Render scene
        Scene.render({});
        
        frameCount++;
        if (frameCount % 60 === 0) {
            console.log(`Animation running: ${frameCount} frames`);
        }
    }
    
    // Start animation immediately
    console.log("Starting animation loop");
    animate();
}
