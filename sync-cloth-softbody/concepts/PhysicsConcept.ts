// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

declare const Ammo: any;

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

export class PhysicsConcept {
    private world: any;
    private bodies: Map<string, any> = new Map();
    private softBodies: Map<string, any> = new Map();
    private transform: any;
    private softBodyHelpers: any;
    private stepCount: number = 0;

    initialize(args: { gravity: Vector3 }): { world: string } {
        // Initialize Ammo physics - it should already be loaded from main.ts
        if (typeof Ammo === 'undefined') {
            console.error("Ammo.js not loaded! Make sure it's loaded before initializing physics.");
            return { world: "main_world" };
        }

        const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
        const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
        const broadphase = new Ammo.btDbvtBroadphase();
        const solver = new Ammo.btSequentialImpulseConstraintSolver();
        const softBodySolver = new Ammo.btDefaultSoftBodySolver();

        this.world = new Ammo.btSoftRigidDynamicsWorld(
            dispatcher,
            broadphase,
            solver,
            collisionConfiguration,
            softBodySolver
        );

        this.world.setGravity(new Ammo.btVector3(args.gravity.x, args.gravity.y, args.gravity.z));
        this.world.getWorldInfo().set_m_gravity(new Ammo.btVector3(args.gravity.x, args.gravity.y, args.gravity.z));

        this.transform = new Ammo.btTransform();
        this.softBodyHelpers = new Ammo.btSoftBodyHelpers();

        console.log("Physics world initialized with gravity:", args.gravity);
        return { world: "main_world" };
    }

    private async loadAmmo() {
        // This would be loaded via script tag in HTML
        console.log("Ammo.js should be loaded via script tag");
    }

    createRigidBody(args: {
        body: string;
        shape: string;
        mass: number;
        position: Vector3;
        rotation: Quaternion;
    }): { body: string } {
        let shape: any;
        
        switch (args.shape) {
            case "sphere":
                shape = new Ammo.btSphereShape(1);
                break;
            case "box":
                shape = new Ammo.btBoxShape(new Ammo.btVector3(1, 1, 1));
                break;
            case "plane":
                shape = new Ammo.btBoxShape(new Ammo.btVector3(50, 0.1, 50));
                break;
            default:
                // Parse custom shape data
                const shapeData = JSON.parse(args.shape);
                if (shapeData.type === "sphere") {
                    shape = new Ammo.btSphereShape(shapeData.radius || 1);
                } else if (shapeData.type === "box") {
                    shape = new Ammo.btBoxShape(
                        new Ammo.btVector3(
                            shapeData.halfExtents?.x || 1,
                            shapeData.halfExtents?.y || 1,
                            shapeData.halfExtents?.z || 1
                        )
                    );
                }
        }

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(args.position.x, args.position.y, args.position.z));
        transform.setRotation(new Ammo.btQuaternion(args.rotation.x, args.rotation.y, args.rotation.z, args.rotation.w));

        const motionState = new Ammo.btDefaultMotionState(transform);
        const localInertia = new Ammo.btVector3(0, 0, 0);
        
        if (args.mass !== 0) {
            shape.calculateLocalInertia(args.mass, localInertia);
        }

        const rbInfo = new Ammo.btRigidBodyConstructionInfo(args.mass, motionState, shape, localInertia);
        const body = new Ammo.btRigidBody(rbInfo);

        this.world.addRigidBody(body);
        this.bodies.set(args.body, body);

        return { body: args.body };
    }

    createSoftBody(args: {
        body: string;
        mesh: string;
        mass: number;
        position: Vector3;
    }): { body: string } {
        console.log("Creating soft body:", args.body);
        
        if (!this.world) {
            console.error("Physics world not initialized!");
            return { body: args.body };
        }
        
        const meshData = JSON.parse(args.mesh);
        const vertices = meshData.vertices;
        const indices = meshData.indices;
        
        console.log("Soft body mesh data:", {
            vertexCount: vertices.length / 3,
            indexCount: indices.length,
            triangleCount: indices.length / 3
        });

        // Create soft body from mesh data
        const softBody = this.softBodyHelpers.CreateFromTriMesh(
            this.world.getWorldInfo(),
            vertices,
            indices,
            indices.length / 3,
            true
        );

        // Configure soft body for cloth simulation
        const sbConfig = softBody.get_m_cfg();
        sbConfig.set_viterations(10);  // Velocity solver iterations
        sbConfig.set_piterations(10);  // Position solver iterations
        sbConfig.set_diterations(10);  // Drift solver iterations
        sbConfig.set_citerations(4);   // Cluster solver iterations
        
        // Set aerodynamics model
        sbConfig.set_aeromodel(1); // V_Point model for cloth
        
        // Enable collisions: 0x0011 for rigid body collisions
        sbConfig.set_collisions(0x0011);
        
        // Material properties for cloth
        sbConfig.set_kDF(0.2);   // Dynamic friction
        sbConfig.set_kDP(0.01);  // Damping coefficient  
        sbConfig.set_kDG(0.003); // Drag coefficient
        sbConfig.set_kLF(0);     // Lift coefficient  
        sbConfig.set_kPR(0);     // Pressure (0 for cloth)
        sbConfig.set_kVC(0);     // Volume conservation (0 for cloth)
        sbConfig.set_kAHR(0.7);  // Anchor hardness
        sbConfig.set_kCHR(1.0);  // Rigid contact hardness
        sbConfig.set_kKHR(0.1);  // Kinetic contact hardness
        sbConfig.set_kSHR(1.0);  // Soft contact hardness
        sbConfig.set_kSRHR_CL(0.1); // Soft vs rigid hardness
        sbConfig.set_kSKHR_CL(1);   // Soft vs kinetic hardness
        sbConfig.set_kSSHR_CL(0.5); // Soft vs soft hardness
        
        // Material stiffness
        const mat = softBody.get_m_materials().at(0);
        mat.set_m_kLST(0.8);  // Linear stiffness - make cloth stiffer
        mat.set_m_kAST(0.8);  // Area/Angular stiffness
        mat.set_m_kVST(0.001); // Volume stiffness - very low for cloth
        
        // Generate bending constraints for cloth-like behavior
        softBody.generateBendingConstraints(2, mat);
        
        // Randomize positions slightly to avoid perfectly flat initial state
        softBody.randomizeConstraints();

        // Set mass
        softBody.setTotalMass(args.mass, false);

        // Set position
        Ammo.btSoftBody.prototype.translate.call(
            softBody,
            new Ammo.btVector3(args.position.x, args.position.y, args.position.z)
        );

        this.world.addSoftBody(softBody, 1, -1);
        this.softBodies.set(args.body, softBody);
        
        console.log("Soft body created and added to world:", args.body);

        return { body: args.body };
    }

    step(): { world: string } {
        if (this.world) {
            this.world.stepSimulation(1/60, 10);
            this.stepCount++;
            
            // Log every 60th step (once per second at 60fps)
            if (this.stepCount % 60 === 0) {
                console.log(`Physics stepping: ${this.stepCount} steps, ${this.softBodies.size} soft bodies, ${this.bodies.size} rigid bodies`);
                
                // Debug: Check if soft body vertices are actually changing
                const softBody = this.softBodies.get("cloth_body");
                if (softBody) {
                    const nodes = softBody.get_m_nodes();
                    if (nodes && nodes.size() > 0) {
                        const node = nodes.at(10); // Check a middle node
                        const pos = node.get_m_x();
                        console.log(`Sample cloth node position: x=${pos.x()}, y=${pos.y()}, z=${pos.z()}`);
                    }
                }
            }
        } else {
            console.error("Physics world is null!");
        }
        return { world: "main_world" };
    }

    applyForce(args: { body: string; force: Vector3 }): { body: string } {
        const body = this.bodies.get(args.body);
        if (body) {
            body.activate();
            body.applyCentralImpulse(new Ammo.btVector3(args.force.x, args.force.y, args.force.z));
        }
        return { body: args.body };
    }

    anchorSoftBodyNode(args: { 
        body: string; 
        nodeIndex: number; 
        position: Vector3;
        rigidBody?: string;
    }): { anchor: string } {
        const softBody = this.softBodies.get(args.body);
        if (!softBody) {
            console.error("Soft body not found:", args.body);
            return { anchor: `${args.body}_anchor_${args.nodeIndex}` };
        }

        console.log(`Attempting to anchor node ${args.nodeIndex} of soft body ${args.body}`);
        
        // Get the actual number of nodes to validate
        const nodes = softBody.get_m_nodes();
        const numNodes = nodes.size();
        console.log(`Soft body has ${numNodes} nodes total`);
        
        if (args.nodeIndex >= numNodes || args.nodeIndex < 0) {
            console.error(`Invalid node index ${args.nodeIndex} for soft body with ${numNodes} nodes`);
            return { anchor: `${args.body}_anchor_${args.nodeIndex}` };
        }

        // If a rigid body is specified, anchor to it
        if (args.rigidBody) {
            const rigid = this.bodies.get(args.rigidBody);
            if (rigid) {
                softBody.appendAnchor(args.nodeIndex, rigid, false, 1.0);
                console.log(`Anchored to rigid body ${args.rigidBody}`);
            }
        } else {
            // Create a small static rigid body to anchor to
            const anchorShape = new Ammo.btSphereShape(0.01);
            const anchorTransform = new Ammo.btTransform();
            anchorTransform.setIdentity();
            anchorTransform.setOrigin(new Ammo.btVector3(args.position.x, args.position.y, args.position.z));
            
            const anchorMotionState = new Ammo.btDefaultMotionState(anchorTransform);
            const anchorRbInfo = new Ammo.btRigidBodyConstructionInfo(0, anchorMotionState, anchorShape, new Ammo.btVector3(0, 0, 0));
            const anchorBody = new Ammo.btRigidBody(anchorRbInfo);
            
            // Add to world and store
            this.world.addRigidBody(anchorBody);
            const anchorId = `${args.body}_anchor_body_${args.nodeIndex}`;
            this.bodies.set(anchorId, anchorBody);
            
            // Now anchor the soft body node to this rigid body
            softBody.appendAnchor(args.nodeIndex, anchorBody, true, 1.0);
            console.log(`Created anchor rigid body at position (${args.position.x}, ${args.position.y}, ${args.position.z}) and anchored node ${args.nodeIndex}`);
        }
        
        return { anchor: `${args.body}_anchor_${args.nodeIndex}` };
    }

    releaseSoftBodyAnchor(args: { body: string; nodeIndex: number }): {} {
        const softBody = this.softBodies.get(args.body);
        if (!softBody) {
            console.error("Soft body not found:", args.body);
            return {};
        }

        // Restore mass to make the node dynamic again
        softBody.setMass(args.nodeIndex, 0.05); // Small mass value for each node
        
        console.log(`Released anchor at node ${args.nodeIndex} of soft body ${args.body}`);
        return {};
    }

    removeBody(args: { body: string }): {} {
        const rigidBody = this.bodies.get(args.body);
        if (rigidBody) {
            this.world.removeRigidBody(rigidBody);
            this.bodies.delete(args.body);
        }

        const softBody = this.softBodies.get(args.body);
        if (softBody) {
            this.world.removeSoftBody(softBody);
            this.softBodies.delete(args.body);
        }

        return {};
    }

    // Query functions
    _getBodyTransform(args: { body: string }): Array<{ position: Vector3; rotation: Quaternion }> {
        const body = this.bodies.get(args.body);
        if (!body) return [];

        const ms = body.getMotionState();
        if (ms) {
            ms.getWorldTransform(this.transform);
            const origin = this.transform.getOrigin();
            const rotation = this.transform.getRotation();
            
            return [{
                position: { x: origin.x(), y: origin.y(), z: origin.z() },
                rotation: { x: rotation.x(), y: rotation.y(), z: rotation.z(), w: rotation.w() }
            }];
        }
        return [];
    }

    _getSoftBodyNodes(args: { body: string }): Array<{ vertices: number[] }> {
        const softBody = this.softBodies.get(args.body);
        if (!softBody) return [];

        const nodes = softBody.get_m_nodes();
        const numNodes = nodes.size();
        const vertices: number[] = [];

        for (let i = 0; i < numNodes; i++) {
            const node = nodes.at(i);
            const pos = node.get_m_x();
            vertices.push(pos.x(), pos.y(), pos.z());
        }

        return [{ vertices }];
    }

    _getSoftBodyAnchors(args: { body: string }): Array<{ anchors: any[] }> {
        const softBody = this.softBodies.get(args.body);
        if (!softBody) return [];
        
        // Return anchor information
        return [{ anchors: [] }];
    }
}
