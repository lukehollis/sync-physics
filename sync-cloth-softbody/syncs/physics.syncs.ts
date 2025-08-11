import { actions, Frames, Vars } from "../engine/mod.ts";

// Synchronize physics simulation stepping with scene rendering
export const PhysicsStep = (concepts: any) => ({}: Vars) => {
    const { Scene, Physics } = concepts;
    return {
        when: actions(
            [Scene.render, {}, { scene: "main_scene" }]
        ),
        then: actions(
            [Physics.step, {}]
        )
    };
};

// Update visual meshes with physics body transforms
export const UpdateMeshFromPhysics = (concepts: any) => ({ body, position, rotation, mesh, object }: Vars) => {
    const { Physics, Entity, Scene } = concepts;
    return {
        when: actions(
            [Physics.step, {}, { world: "main_world" }]
        ),
        where: (frames: Frames): Frames => {
            return frames
                .query(Entity._getAllObjects, {}, { object, body, mesh })
                .query(Physics._getBodyTransform, { body }, { position, rotation })
                .filter(($) => $[position] && $[rotation]);
        },
        then: actions(
            [Scene.updateMesh, { mesh, position, rotation }]
        )
    };
};

// Update cloth mesh vertices from soft body simulation
export const UpdateClothMesh = (concepts: any) => ({ vertices }: Vars) => {
    const { Physics, Cloth, Scene } = concepts;
    return {
        when: actions(
            [Physics.step, {}, { world: "main_world" }]
        ),
        where: (frames: Frames): Frames => {
            // Get the updated vertices from the physics soft body
            return frames
                .query(Physics._getSoftBodyNodes, { body: "cloth_body" }, { vertices })
                .filter(($) => $[vertices] && ($[vertices] as number[]).length > 0);
        },
        then: actions(
            [Scene.updateMesh, { mesh: "cloth_mesh", vertices }],
            [Cloth.updateVertices, { cloth: "main_cloth", vertices }]
        )
    };
};

// Apply cloth anchors to physics soft body
export const ApplyClothAnchorsToPhysics = (concepts: any) => ({ anchor, vertexIndex, position }: Vars) => {
    const { Cloth, Physics } = concepts;
    return {
        when: actions(
            [Cloth.anchorVertex, { cloth: "main_cloth" }, { anchor }]
        ),
        where: (frames: Frames): Frames => {
            return frames
                .query(Cloth._getAnchors, { cloth: "main_cloth" }, { anchors: anchor })
                .map(($) => {
                    const anchorsList = $[anchor] as any[];
                    return anchorsList.map(a => ({
                        ...$,
                        [vertexIndex]: a.vertexIndex,
                        [position]: a.position
                    }));
                })
                .flat()
                .filter(($) => $[vertexIndex] !== undefined);
        },
        then: actions(
            [Physics.anchorSoftBodyNode, { 
                body: "cloth_body", 
                nodeIndex: vertexIndex, 
                position 
            }]
        )
    };
};

// Release cloth anchors from physics soft body
export const ReleaseClothAnchorsFromPhysics = (concepts: any) => ({ anchor, vertexIndex }: Vars) => {
    const { Cloth, Physics } = concepts;
    return {
        when: actions(
            [Cloth.releaseAnchor, { anchor: "drag_anchor" }, {}]
        ),
        where: (frames: Frames): Frames => {
            // Find which vertex was anchored
            return frames
                .query(Cloth._getAnchors, { cloth: "main_cloth" }, { anchors: anchor })
                .map(($) => {
                    const anchorsList = $[anchor] as any[];
                    // Get the previously anchored vertex if any
                    return anchorsList.filter(a => a.vertexIndex >= 0).map(a => ({
                        ...$,
                        [vertexIndex]: a.vertexIndex
                    }));
                })
                .flat();
        },
        then: actions(
            [Physics.releaseSoftBodyAnchor, { 
                body: "cloth_body", 
                nodeIndex: vertexIndex 
            }]
        )
    };
};

// Check cloth stress and tear links if necessary
export const CheckClothTearing = (concepts: any) => ({ cloth, vertex1, vertex2, stress, link, links }: Vars) => {
    const { Cloth } = concepts;
    return {
        when: actions(
            [Cloth.updateVertices, { cloth: "main_cloth" }, { cloth }]
        ),
        where: (frames: Frames): Frames => {
            return frames
                .query(Cloth._getLinks, { cloth }, { links })
                .map(($) => {
                    const linksList = $[links] as any[];
                    return linksList.filter(l => !l.broken).map(l => ({
                        ...$,
                        [vertex1]: l.vertex1,
                        [vertex2]: l.vertex2,
                        [link]: `${l.vertex1}-${l.vertex2}`
                    }));
                })
                .flat()
                .query(Cloth.getStress, { cloth, vertex1, vertex2 }, { stress })
                .filter(($) => $[stress] > 1.8); // Tear threshold
        },
        then: actions(
            [Cloth.tearLink, { link, cloth, vertex1, vertex2 }]
        )
    };
};