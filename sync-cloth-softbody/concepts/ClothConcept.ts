interface Vector3 {
    x: number;
    y: number;
    z: number;
}

interface ClothData {
    width: number;
    height: number;
    segmentsX: number;
    segmentsY: number;
    mass: number;
    position: Vector3;
    vertices: number[];
    indices: number[];
    anchors: Map<number, Vector3>;
    links: Map<string, { initialDistance: number; broken: boolean }>;
}

export class ClothConcept {
    private cloths: Map<string, ClothData> = new Map();
    private anchors: Map<string, { clothId: string; vertexIndex: number; position: Vector3 }> = new Map();

    create(args: {
        cloth: string;
        width: number;
        height: number;
        segmentsX: number;
        segmentsY: number;
        mass: number;
        position: Vector3;
    }): { cloth: string; vertices: number[]; indices: number[] } {
        const { cloth, width, height, segmentsX, segmentsY, mass, position } = args;
        
        // Generate vertices
        const vertices: number[] = [];
        const indices: number[] = [];
        
        for (let y = 0; y <= segmentsY; y++) {
            for (let x = 0; x <= segmentsX; x++) {
                const u = x / segmentsX;
                const v = y / segmentsY;
                
                vertices.push(
                    position.x + (u - 0.5) * width,
                    position.y,
                    position.z + (v - 0.5) * height
                );
            }
        }
        
        // Generate indices for triangles
        for (let y = 0; y < segmentsY; y++) {
            for (let x = 0; x < segmentsX; x++) {
                const a = x + (segmentsX + 1) * y;
                const b = x + (segmentsX + 1) * (y + 1);
                const c = (x + 1) + (segmentsX + 1) * (y + 1);
                const d = (x + 1) + (segmentsX + 1) * y;
                
                // Two triangles per quad
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }
        
        // Store cloth data
        const clothData: ClothData = {
            width,
            height,
            segmentsX,
            segmentsY,
            mass,
            position,
            vertices: [...vertices],
            indices: [...indices],
            anchors: new Map(),
            links: new Map()
        };
        
        // Calculate initial distances for links
        const numVertices = vertices.length / 3;
        for (let i = 0; i < numVertices; i++) {
            // Check horizontal neighbor
            if ((i + 1) % (segmentsX + 1) !== 0) {
                const dist = this.calculateDistance(vertices, i, i + 1);
                clothData.links.set(`${i}-${i + 1}`, { initialDistance: dist, broken: false });
            }
            
            // Check vertical neighbor
            if (i + segmentsX + 1 < numVertices) {
                const dist = this.calculateDistance(vertices, i, i + segmentsX + 1);
                clothData.links.set(`${i}-${i + segmentsX + 1}`, { initialDistance: dist, broken: false });
            }
        }
        
        this.cloths.set(cloth, clothData);
        
        return { cloth, vertices, indices };
    }

    anchorVertex(args: {
        anchor: string;
        cloth: string;
        vertexIndex: number;
        position: Vector3;
    }): { anchor: string } {
        const clothData = this.cloths.get(args.cloth);
        if (clothData) {
            clothData.anchors.set(args.vertexIndex, args.position);
            this.anchors.set(args.anchor, {
                clothId: args.cloth,
                vertexIndex: args.vertexIndex,
                position: args.position
            });
        }
        return { anchor: args.anchor };
    }

    releaseAnchor(args: { anchor: string }): {} {
        const anchorData = this.anchors.get(args.anchor);
        if (anchorData) {
            const clothData = this.cloths.get(anchorData.clothId);
            if (clothData) {
                clothData.anchors.delete(anchorData.vertexIndex);
            }
            this.anchors.delete(args.anchor);
        }
        return {};
    }

    updateVertices(args: { cloth: string; vertices: number[] }): { cloth: string } {
        const clothData = this.cloths.get(args.cloth);
        if (clothData) {
            clothData.vertices = [...args.vertices];
        }
        return { cloth: args.cloth };
    }

    getStress(args: {
        cloth: string;
        vertex1: number;
        vertex2: number;
    }): { stress: number } {
        const clothData = this.cloths.get(args.cloth);
        if (!clothData) return { stress: 0 };
        
        const linkKey = `${Math.min(args.vertex1, args.vertex2)}-${Math.max(args.vertex1, args.vertex2)}`;
        const link = clothData.links.get(linkKey);
        
        if (!link || link.broken) return { stress: 0 };
        
        const currentDistance = this.calculateDistance(clothData.vertices, args.vertex1, args.vertex2);
        const stress = currentDistance / link.initialDistance;
        
        return { stress };
    }

    tearLink(args: {
        link: string;
        cloth: string;
        vertex1: number;
        vertex2: number;
    }): { link: string } {
        const clothData = this.cloths.get(args.cloth);
        if (clothData) {
            const linkKey = `${Math.min(args.vertex1, args.vertex2)}-${Math.max(args.vertex1, args.vertex2)}`;
            const link = clothData.links.get(linkKey);
            if (link) {
                link.broken = true;
            }
        }
        return { link: args.link };
    }

    pickVertex(args: { cloth: string; position: Vector3 }): { vertexIndex: number } {
        const clothData = this.cloths.get(args.cloth);
        if (!clothData) return { vertexIndex: -1 };
        
        let closestIndex = -1;
        let closestDistance = Infinity;
        
        const numVertices = clothData.vertices.length / 3;
        for (let i = 0; i < numVertices; i++) {
            const vx = clothData.vertices[i * 3];
            const vy = clothData.vertices[i * 3 + 1];
            const vz = clothData.vertices[i * 3 + 2];
            
            const dx = vx - args.position.x;
            const dy = vy - args.position.y;
            const dz = vz - args.position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }
        
        return { vertexIndex: closestIndex };
    }

    // Query functions
    _getClothData(args: { cloth: string }): Array<{ 
        vertices: number[]; 
        indices: number[];
        width: number;
        height: number;
        segmentsX: number;
        segmentsY: number;
    }> {
        const clothData = this.cloths.get(args.cloth);
        if (!clothData) return [];
        
        return [{
            vertices: clothData.vertices,
            indices: clothData.indices,
            width: clothData.width,
            height: clothData.height,
            segmentsX: clothData.segmentsX,
            segmentsY: clothData.segmentsY
        }];
    }

    _getAnchors(args: { cloth: string }): Array<{ anchors: Array<{ vertexIndex: number; position: Vector3 }> }> {
        const clothData = this.cloths.get(args.cloth);
        if (!clothData) return [];
        
        const anchors = Array.from(clothData.anchors.entries()).map(([vertexIndex, position]) => ({
            vertexIndex,
            position
        }));
        
        return [{ anchors }];
    }

    _getLinks(args: { cloth: string }): Array<{ links: Array<{ vertex1: number; vertex2: number; broken: boolean }> }> {
        const clothData = this.cloths.get(args.cloth);
        if (!clothData) return [];
        
        const links = Array.from(clothData.links.entries()).map(([key, data]) => {
            const [v1, v2] = key.split('-').map(Number);
            return { vertex1: v1, vertex2: v2, broken: data.broken };
        });
        
        return [{ links }];
    }

    private calculateDistance(vertices: number[], i1: number, i2: number): number {
        const x1 = vertices[i1 * 3];
        const y1 = vertices[i1 * 3 + 1];
        const z1 = vertices[i1 * 3 + 2];
        
        const x2 = vertices[i2 * 3];
        const y2 = vertices[i2 * 3 + 1];
        const z2 = vertices[i2 * 3 + 2];
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
