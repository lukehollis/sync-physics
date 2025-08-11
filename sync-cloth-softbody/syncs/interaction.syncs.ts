import { actions, Frames, Vars } from "../engine/mod.ts";

// Handle mouse down to start dragging cloth
export const StartClothDrag = (concepts: any) => ({ event, position, vertexIndex, anchor, origin, direction }: Vars) => {
    const { Interaction, Scene, Cloth } = concepts;
    return {
        when: actions(
            [Interaction.mouseDown, { button: 0 }, { event, position }]
        ),
        where: (frames: Frames): Frames => {
            return frames
                .query(Scene._getRaycaster, { x: position.x, y: position.y }, { origin, direction })
                .query(Cloth.pickVertex, { 
                    cloth: "main_cloth", 
                    position: origin 
                }, { vertexIndex })
                .filter(($) => $[vertexIndex] >= 0);
        },
        then: actions(
            [Interaction.startDrag, { 
                drag: "cloth_drag",
                position,
                target: "cloth"
            }],
            [Cloth.anchorVertex, {
                anchor: "drag_anchor",
                cloth: "main_cloth",
                vertexIndex,
                position
            }]
        )
    };
};

// Update cloth drag position
export const UpdateClothDrag = (concepts: any) => ({ position, drag, origin, target }: Vars) => {
    const { Interaction, Scene, Cloth } = concepts;
    return {
        when: actions(
            [Interaction.mouseMove, {}, { position }]
        ),
        where: (frames: Frames): Frames => {
            return frames
                .query(Interaction._getActiveDrag, {}, { drag, target })
                .filter(($) => $[target] === "cloth")
                .query(Scene._getRaycaster, { x: position.x, y: position.y }, { origin });
        },
        then: actions(
            [Interaction.updateDrag, { drag, position }],
            [Cloth.anchorVertex, {
                anchor: "drag_anchor",
                cloth: "main_cloth",
                vertexIndex: -1, // Will be updated with actual vertex
                position: origin
            }]
        )
    };
};

// End cloth drag
export const EndClothDrag = (concepts: any) => ({ drag }: Vars) => {
    const { Interaction, Cloth } = concepts;
    return {
        when: actions(
            [Interaction.mouseUp, { button: 0 }, {}]
        ),
        where: (frames: Frames): Frames => {
            return frames
                .query(Interaction._getActiveDrag, {}, { drag });
        },
        then: actions(
            [Interaction.endDrag, { drag }],
            [Cloth.releaseAnchor, { anchor: "drag_anchor" }]
        )
    };
};

// Shoot projectile on space key
export const ShootProjectile = (concepts: any) => ({ 
    key, object, position, direction, velocity, mesh, body, target
}: Vars) => {
    const { Interaction, Scene, Entity, Physics } = concepts;
    return {
        when: actions(
            [Interaction.keyDown, { key: " " }, { key }]
        ),
        where: (frames: Frames): Frames => {
            return frames
                .query(Scene._getCamera, {}, { position, target })
                .map(($) => {
                    const pos = $[position] as any;
                    const tgt = $[target] as any;
                    const dir = {
                        x: tgt.x - pos.x,
                        y: tgt.y - pos.y,
                        z: tgt.z - pos.z
                    };
                    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
                    return {
                        ...$,
                        [direction]: {
                            x: dir.x / len * 20,
                            y: dir.y / len * 20,
                            z: dir.z / len * 20
                        },
                        [object]: `projectile_${Date.now()}`,
                        [mesh]: `projectile_mesh_${Date.now()}`,
                        [body]: `projectile_body_${Date.now()}`
                    };
                });
        },
        then: actions(
            // Create projectile object
            [Entity.createProjectile, {
                object,
                position,
                velocity: direction,
                radius: 0.2,
                mass: 0.05
            }],
            
            // Create visual mesh
            [Scene.createMesh, {
                mesh,
                geometry: JSON.stringify({ type: "sphere", radius: 0.2 }),
                material: JSON.stringify({ 
                    color: 0xff0000,
                    roughness: 0.3,
                    metalness: 0.7
                }),
                position
            }],
            
            // Create physics body
            [Physics.createRigidBody, {
                body,
                shape: JSON.stringify({ type: "sphere", radius: 0.2 }),
                mass: 0.05,
                position,
                rotation: { x: 0, y: 0, z: 0, w: 1 }
            }],
            
            // Apply initial velocity
            [Physics.applyForce, {
                body,
                force: direction
            }]
        )
    };
};

// Clean up projectiles that fall too low
export const CleanupProjectiles = (concepts: any) => ({ object, mesh, body, count, position }: Vars) => {
    const { Entity, Scene, Physics } = concepts;
    return {
        when: actions(
            [Entity.cleanup, {}, { count }]
        ),
        where: (frames: Frames): Frames => {
            return frames
                .filter(($) => $[count] > 0)
                .query(Entity._getAllObjects, {}, { object, mesh, body, position })
                .filter(($) => {
                    const pos = $[position] as any;
                    return pos && pos.y < -10;
                });
        },
        then: actions(
            [Entity.remove, { object }],
            [Scene.removeMesh, { mesh }],
            [Physics.removeBody, { body }]
        )
    };
};

// Trigger cleanup periodically
export const TriggerCleanup = (concepts: any) => ({}: Vars) => {
    const { Scene, Entity } = concepts;
    return {
        when: actions(
            [Scene.render, {}, { scene: "main_scene" }]
        ),
        where: (frames: Frames): Frames => {
            // Only cleanup every 60 frames (1 second at 60fps)
            return frames.filter(() => Math.random() < 0.016);
        },
        then: actions(
            [Entity.cleanup, {}]
        )
    };
};