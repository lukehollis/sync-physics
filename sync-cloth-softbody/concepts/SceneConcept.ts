// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { OrbitControls } from "npm:three/examples/jsm/controls/OrbitControls";

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

interface MeshData {
    mesh: THREE.Mesh;
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
}

export class SceneConcept {
    private scene: THREE.Scene | null = null;
    private camera: THREE.PerspectiveCamera | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private controls: OrbitControls | null = null;
    private meshes: Map<string, MeshData> = new Map();
    private lights: Map<string, THREE.Light> = new Map();
    private container: HTMLElement | null = null;

    initialize(args: { width: number; height: number }): { scene: string; camera: string } {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            args.width / args.height,
            0.1,
            1000
        );
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(args.width, args.height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Add to DOM
        this.container = document.getElementById("container") || document.body;
        this.container.appendChild(this.renderer.domElement);

        // Add orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        return { scene: "main_scene", camera: "main_camera" };
    }

    addLight(args: {
        light: string;
        type: string;
        color: number;
        intensity: number;
        position: Vector3;
    }): { light: string } {
        if (!this.scene) return { light: args.light };

        let light: THREE.Light;

        switch (args.type) {
            case "ambient":
                light = new THREE.AmbientLight(args.color, args.intensity);
                break;
            case "directional":
                light = new THREE.DirectionalLight(args.color, args.intensity);
                light.position.set(args.position.x, args.position.y, args.position.z);
                light.castShadow = true;
                (light as THREE.DirectionalLight).shadow.camera.left = -20;
                (light as THREE.DirectionalLight).shadow.camera.right = 20;
                (light as THREE.DirectionalLight).shadow.camera.top = 20;
                (light as THREE.DirectionalLight).shadow.camera.bottom = -20;
                break;
            case "point":
                light = new THREE.PointLight(args.color, args.intensity);
                light.position.set(args.position.x, args.position.y, args.position.z);
                break;
            default:
                light = new THREE.AmbientLight(args.color, args.intensity);
        }

        this.scene.add(light);
        this.lights.set(args.light, light);

        return { light: args.light };
    }

    createMesh(args: {
        mesh: string;
        geometry: string;
        material: string;
        position: Vector3;
    }): { mesh: string } {
        if (!this.scene) return { mesh: args.mesh };

        let geometry: THREE.BufferGeometry;
        let material: THREE.Material;

        // Parse geometry
        if (args.geometry === "sphere") {
            geometry = new THREE.SphereGeometry(1, 32, 32);
        } else if (args.geometry === "box") {
            geometry = new THREE.BoxGeometry(2, 2, 2);
        } else if (args.geometry === "plane") {
            geometry = new THREE.PlaneGeometry(100, 100);
        } else if (args.geometry === "cloth") {
            // Cloth geometry will be created from vertices/indices
            geometry = new THREE.BufferGeometry();
        } else {
            // Parse custom geometry data
            const geoData = JSON.parse(args.geometry);
            if (geoData.type === "sphere") {
                geometry = new THREE.SphereGeometry(geoData.radius || 1, 32, 32);
            } else if (geoData.type === "plane") {
                geometry = new THREE.PlaneGeometry(
                    geoData.width || 10,
                    geoData.height || 10,
                    geoData.widthSegments || 10,
                    geoData.heightSegments || 10
                );
            } else if (geoData.vertices && geoData.indices) {
                geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(geoData.vertices, 3));
                geometry.setIndex(geoData.indices);
                geometry.computeVertexNormals();
            } else {
                geometry = new THREE.BoxGeometry(1, 1, 1);
            }
        }

        // Parse material
        if (args.material === "standard") {
            material = new THREE.MeshStandardMaterial({ 
                color: 0x808080,
                roughness: 0.5,
                metalness: 0.1
            });
        } else if (args.material === "cloth") {
            material = new THREE.MeshStandardMaterial({
                color: 0xff6600,
                side: THREE.DoubleSide,
                roughness: 0.8,
                metalness: 0.2
            });
        } else if (args.material === "ground") {
            material = new THREE.MeshStandardMaterial({
                color: 0x404040,
                roughness: 1,
                metalness: 0
            });
        } else {
            // Parse custom material data
            const matData = JSON.parse(args.material);
            material = new THREE.MeshStandardMaterial({
                color: matData.color || 0x808080,
                side: matData.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
                roughness: matData.roughness || 0.5,
                metalness: matData.metalness || 0.1
            });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(args.position.x, args.position.y, args.position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);
        this.meshes.set(args.mesh, { mesh, geometry, material });

        return { mesh: args.mesh };
    }

    updateMesh(args: { 
        mesh: string; 
        vertices?: number[];
        position?: Vector3;
        rotation?: Quaternion;
    }): { mesh: string } {
        const meshData = this.meshes.get(args.mesh);
        if (!meshData) return { mesh: args.mesh };

        // Update vertices if provided
        if (args.vertices) {
            const geometry = meshData.geometry;
            const positionAttribute = geometry.getAttribute('position');
            
            if (positionAttribute) {
                const positions = positionAttribute.array as Float32Array;
                for (let i = 0; i < args.vertices.length; i++) {
                    positions[i] = args.vertices[i];
                }
                positionAttribute.needsUpdate = true;
                geometry.computeVertexNormals();
            }
        }
        
        // Update position if provided
        if (args.position) {
            meshData.mesh.position.set(args.position.x, args.position.y, args.position.z);
        }
        
        // Update rotation if provided
        if (args.rotation) {
            meshData.mesh.quaternion.set(args.rotation.x, args.rotation.y, args.rotation.z, args.rotation.w);
        }

        return { mesh: args.mesh };
    }

    removeMesh(args: { mesh: string }): {} {
        const meshData = this.meshes.get(args.mesh);
        if (meshData && this.scene) {
            this.scene.remove(meshData.mesh);
            meshData.geometry.dispose();
            meshData.material.dispose();
            this.meshes.delete(args.mesh);
        }
        return {};
    }

    render(): { scene: string } {
        if (this.renderer && this.scene && this.camera) {
            if (this.controls) {
                this.controls.update();
            }
            this.renderer.render(this.scene, this.camera);
        }
        return { scene: "main_scene" };
    }

    setCameraPosition(args: {
        camera: string;
        position: Vector3;
        target: Vector3;
    }): { camera: string } {
        if (this.camera) {
            this.camera.position.set(args.position.x, args.position.y, args.position.z);
            this.camera.lookAt(args.target.x, args.target.y, args.target.z);
            if (this.controls) {
                this.controls.target.set(args.target.x, args.target.y, args.target.z);
                this.controls.update();
            }
        }
        return { camera: args.camera };
    }

    resize(args: { width: number; height: number }): { scene: string } {
        if (this.camera && this.renderer) {
            this.camera.aspect = args.width / args.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(args.width, args.height);
        }
        return { scene: "main_scene" };
    }

    // Query functions
    _getMeshPosition(args: { mesh: string }): Array<{ position: Vector3; rotation: Quaternion }> {
        const meshData = this.meshes.get(args.mesh);
        if (!meshData) return [];

        const mesh = meshData.mesh;
        return [{
            position: {
                x: mesh.position.x,
                y: mesh.position.y,
                z: mesh.position.z
            },
            rotation: {
                x: mesh.quaternion.x,
                y: mesh.quaternion.y,
                z: mesh.quaternion.z,
                w: mesh.quaternion.w
            }
        }];
    }

    _getCamera(): Array<{ position: Vector3; target: Vector3 }> {
        if (!this.camera || !this.controls) return [];

        return [{
            position: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            },
            target: {
                x: this.controls.target.x,
                y: this.controls.target.y,
                z: this.controls.target.z
            }
        }];
    }

    _getRaycaster(args: { x: number; y: number }): Array<{ origin: Vector3; direction: Vector3 }> {
        if (!this.camera) return [];

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(args.x, args.y);
        raycaster.setFromCamera(mouse, this.camera);

        return [{
            origin: {
                x: raycaster.ray.origin.x,
                y: raycaster.ray.origin.y,
                z: raycaster.ray.origin.z
            },
            direction: {
                x: raycaster.ray.direction.x,
                y: raycaster.ray.direction.y,
                z: raycaster.ray.direction.z
            }
        }];
    }

    _getAllMeshes(): Array<{ mesh: string; position: Vector3 }> {
        const allMeshes: Array<{ mesh: string; position: Vector3 }> = [];
        
        this.meshes.forEach((meshData, id) => {
            allMeshes.push({
                mesh: id,
                position: {
                    x: meshData.mesh.position.x,
                    y: meshData.mesh.position.y,
                    z: meshData.mesh.position.z
                }
            });
        });
        
        return allMeshes;
    }
}
