import { actions, Frames, Vars } from "../engine/mod.ts";

// Initialize the entire simulation
export const InitializeSimulation = (concepts: any) => ({ 
    world, scene, camera, cloth, vertices, indices, request 
}: Vars) => {
    const { API, Physics, Scene, Cloth } = concepts;
    return {
        when: actions(
            [API.request, { 
                callback: "initialize", 
                method: "init" 
            }, { request }]
        ),
        then: actions(
            // Initialize physics world
            [Physics.initialize, { gravity: { x: 0, y: -9.8, z: 0 } }],
            
            // Initialize scene
            [Scene.initialize, { width: 800, height: 600 }],
            
            // Create cloth
            [Cloth.create, {
                cloth: "main_cloth",
                width: 10,
                height: 10,
                segmentsX: 20,
                segmentsY: 20,
                mass: 1,
                position: { x: 0, y: 5, z: 0 }
            }]
        )
    };
};

// Setup scene objects after initialization
export const SetupScene = (concepts: any) => ({ cloth, vertices, indices }: Vars) => {
    const { Scene, Cloth } = concepts;
    return {
        when: actions(
            [Scene.initialize, {}, { scene: "main_scene", camera: "main_camera" }],
            [Cloth.create, { cloth: "main_cloth" }, { cloth, vertices, indices }]
        ),
        then: actions(
            // Add lights
            [Scene.addLight, {
                light: "ambient",
                type: "ambient",
                color: 0xffffff,
                intensity: 0.6,
                position: { x: 0, y: 0, z: 0 }
            }],
            [Scene.addLight, {
                light: "directional",
                type: "directional",
                color: 0xffffff,
                intensity: 0.5,
                position: { x: 5, y: 10, z: 5 }
            }],
            
            // Create ground plane
            [Scene.createMesh, {
                mesh: "ground",
                geometry: JSON.stringify({ type: "plane", width: 100, height: 100 }),
                material: "ground",
                position: { x: 0, y: -5, z: 0 }
            }],
            
            // Create static sphere
            [Scene.createMesh, {
                mesh: "sphere",
                geometry: JSON.stringify({ type: "sphere", radius: 2 }),
                material: "standard",
                position: { x: 0, y: 0, z: 0 }
            }],
            
            // Create cloth mesh
            [Scene.createMesh, {
                mesh: "cloth_mesh",
                geometry: JSON.stringify({ vertices, indices }),
                material: JSON.stringify({ 
                    color: 0xff6600, 
                    doubleSide: true,
                    roughness: 0.8,
                    metalness: 0.2
                }),
                position: { x: 0, y: 0, z: 0 }
            }]
        )
    };
};

// Setup physics bodies
export const SetupPhysicsBodies = (concepts: any) => ({ vertices, indices }: Vars) => {
    const { Physics, Cloth } = concepts;
    return {
        when: actions(
            [Physics.initialize, {}, { world: "main_world" }],
            [Cloth.create, { cloth: "main_cloth" }, { vertices, indices }]
        ),
        then: actions(
            // Create ground rigid body
            [Physics.createRigidBody, {
                body: "ground_body",
                shape: JSON.stringify({ type: "box", halfExtents: { x: 50, y: 0.1, z: 50 } }),
                mass: 0,
                position: { x: 0, y: -5, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 }
            }],
            
            // Create sphere rigid body
            [Physics.createRigidBody, {
                body: "sphere_body",
                shape: JSON.stringify({ type: "sphere", radius: 2 }),
                mass: 0,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 }
            }],
            
            // Create soft body for cloth
            [Physics.createSoftBody, {
                body: "cloth_body",
                mesh: JSON.stringify({ vertices, indices }),
                mass: 1,
                position: { x: 0, y: 5, z: 0 }
            }]
        )
    };
};

// Anchor cloth corners
export const AnchorClothCorners = (concepts: any) => ({}: Vars) => {
    const { Cloth, Physics } = concepts;
    return {
        when: actions(
            [Physics.createSoftBody, { body: "cloth_body" }, { body: "cloth_body" }]
        ),
        then: actions(
            // Anchor top-left corner directly to physics
            [Physics.anchorSoftBodyNode, {
                body: "cloth_body",
                nodeIndex: 0,
                position: { x: -5, y: 5, z: -5 }
            }],
            
            // Anchor top-right corner directly to physics
            [Physics.anchorSoftBodyNode, {
                body: "cloth_body",
                nodeIndex: 20, // segmentsX = 20, so last vertex in first row
                position: { x: 5, y: 5, z: -5 }
            }],
            
            // Also track in Cloth concept for consistency
            [Cloth.anchorVertex, {
                anchor: "anchor_tl",
                cloth: "main_cloth",
                vertexIndex: 0,
                position: { x: -5, y: 5, z: -5 }
            }],
            
            [Cloth.anchorVertex, {
                anchor: "anchor_tr",
                cloth: "main_cloth",
                vertexIndex: 20,
                position: { x: 5, y: 5, z: -5 }
            }]
        )
    };
};