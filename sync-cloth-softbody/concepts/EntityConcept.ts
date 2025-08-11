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

interface ObjectData {
    type: string;
    position: Vector3;
    velocity: Vector3;
    mass: number;
    radius: number;
    mesh: string;
    body: string;
}

export class EntityConcept {
    private objects: Map<string, ObjectData> = new Map();
    private objectCounter = 0;

    createProjectile(args: {
        object: string;
        position: Vector3;
        velocity: Vector3;
        radius: number;
        mass: number;
    }): { object: string } {
        const objectId = args.object || `projectile_${this.objectCounter++}`;
        
        this.objects.set(objectId, {
            type: 'projectile',
            position: args.position,
            velocity: args.velocity,
            mass: args.mass,
            radius: args.radius,
            mesh: `${objectId}_mesh`,
            body: `${objectId}_body`
        });
        
        return { object: objectId };
    }

    update(args: {
        object: string;
        position: Vector3;
        rotation: Quaternion;
    }): { object: string } {
        const objectData = this.objects.get(args.object);
        if (objectData) {
            objectData.position = args.position;
        }
        return { object: args.object };
    }

    remove(args: { object: string }): {} {
        this.objects.delete(args.object);
        return {};
    }

    getAll(): { objects: string[] } {
        return { objects: Array.from(this.objects.keys()) };
    }

    cleanup(): { count: number } {
        let removedCount = 0;
        const threshold = -10; // Remove objects that fall below y = -10
        
        this.objects.forEach((data, id) => {
            if (data.position.y < threshold) {
                this.objects.delete(id);
                removedCount++;
            }
        });
        
        return { count: removedCount };
    }

    // Query functions
    _getObjectData(args: { object: string }): Array<{
        type: string;
        position: Vector3;
        velocity: Vector3;
        mass: number;
        radius: number;
        mesh: string;
        body: string;
    }> {
        const data = this.objects.get(args.object);
        if (!data) return [];
        
        return [data];
    }

    _getAllObjects(): Array<{
        object: string;
        type: string;
        position: Vector3;
        mesh: string;
        body: string;
    }> {
        const allObjects: Array<{
            object: string;
            type: string;
            position: Vector3;
            mesh: string;
            body: string;
        }> = [];
        
        this.objects.forEach((data, id) => {
            allObjects.push({
                object: id,
                type: data.type,
                position: data.position,
                mesh: data.mesh,
                body: data.body
            });
        });
        
        return allObjects;
    }

    _getProjectiles(): Array<{
        object: string;
        position: Vector3;
        velocity: Vector3;
        radius: number;
        mass: number;
        mesh: string;
        body: string;
    }> {
        const projectiles: Array<{
            object: string;
            position: Vector3;
            velocity: Vector3;
            radius: number;
            mass: number;
            mesh: string;
            body: string;
        }> = [];
        
        this.objects.forEach((data, id) => {
            if (data.type === 'projectile') {
                projectiles.push({
                    object: id,
                    position: data.position,
                    velocity: data.velocity,
                    radius: data.radius,
                    mass: data.mass,
                    mesh: data.mesh,
                    body: data.body
                });
            }
        });
        
        return projectiles;
    }
}
