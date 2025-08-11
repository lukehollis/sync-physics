interface Vector2 {
    x: number;
    y: number;
}

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

interface DragData {
    active: boolean;
    startPosition: Vector2;
    currentPosition: Vector2;
    target: string;
}

export class InteractionConcept {
    private mouseEvents: Map<string, { type: string; position: Vector2; button: number }> = new Map();
    private keyEvents: Map<string, { type: string; key: string }> = new Map();
    private drags: Map<string, DragData> = new Map();
    private eventCounter = 0;
    private dragCounter = 0;

    constructor() {
        // Set up event listeners when the concept is created
        if (typeof window !== 'undefined') {
            this.setupEventListeners();
        }
    }

    private setupEventListeners() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        // Mouse events
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            // This will be triggered by synchronizations
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            // This will be triggered by synchronizations
        });

        canvas.addEventListener('mouseup', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            // This will be triggered by synchronizations
        });

        // Keyboard events
        window.addEventListener('keydown', (e) => {
            // This will be triggered by synchronizations
        });

        window.addEventListener('keyup', (e) => {
            // This will be triggered by synchronizations
        });
    }

    mouseDown(args: { event: string; position: Vector2; button: number }): { event: string } {
        const eventId = args.event || `mouse_${this.eventCounter++}`;
        this.mouseEvents.set(eventId, {
            type: 'mousedown',
            position: args.position,
            button: args.button
        });
        return { event: eventId };
    }

    mouseMove(args: { event: string; position: Vector2 }): { event: string } {
        const eventId = args.event || `mouse_${this.eventCounter++}`;
        this.mouseEvents.set(eventId, {
            type: 'mousemove',
            position: args.position,
            button: -1
        });
        return { event: eventId };
    }

    mouseUp(args: { event: string; position: Vector2; button: number }): { event: string } {
        const eventId = args.event || `mouse_${this.eventCounter++}`;
        this.mouseEvents.set(eventId, {
            type: 'mouseup',
            position: args.position,
            button: args.button
        });
        return { event: eventId };
    }

    keyDown(args: { event: string; key: string }): { event: string } {
        const eventId = args.event || `key_${this.eventCounter++}`;
        this.keyEvents.set(eventId, {
            type: 'keydown',
            key: args.key
        });
        return { event: eventId };
    }

    keyUp(args: { event: string; key: string }): { event: string } {
        const eventId = args.event || `key_${this.eventCounter++}`;
        this.keyEvents.set(eventId, {
            type: 'keyup',
            key: args.key
        });
        return { event: eventId };
    }

    startDrag(args: { drag: string; position: Vector2; target: string }): { drag: string } {
        const dragId = args.drag || `drag_${this.dragCounter++}`;
        this.drags.set(dragId, {
            active: true,
            startPosition: args.position,
            currentPosition: args.position,
            target: args.target
        });
        return { drag: dragId };
    }

    updateDrag(args: { drag: string; position: Vector2 }): { drag: string } {
        const dragData = this.drags.get(args.drag);
        if (dragData) {
            dragData.currentPosition = args.position;
        }
        return { drag: args.drag };
    }

    endDrag(args: { drag: string }): {} {
        const dragData = this.drags.get(args.drag);
        if (dragData) {
            dragData.active = false;
        }
        return {};
    }

    getRaycast(args: { position: Vector2 }): { origin: Vector3; direction: Vector3 } {
        // This would normally calculate the ray from the camera
        // For now, return a simple ray pointing forward
        return {
            origin: { x: 0, y: 10, z: 20 },
            direction: { x: args.position.x, y: args.position.y, z: -1 }
        };
    }

    // Query functions
    _getActiveDrag(): Array<{ drag: string; position: Vector2; target: string }> {
        const activeDrags: Array<{ drag: string; position: Vector2; target: string }> = [];
        
        this.drags.forEach((data, id) => {
            if (data.active) {
                activeDrags.push({
                    drag: id,
                    position: data.currentPosition,
                    target: data.target
                });
            }
        });
        
        return activeDrags;
    }

    _getLastMouseEvent(): Array<{ type: string; position: Vector2; button: number }> {
        const events = Array.from(this.mouseEvents.values());
        if (events.length === 0) return [];
        
        return [events[events.length - 1]];
    }

    _getLastKeyEvent(): Array<{ type: string; key: string }> {
        const events = Array.from(this.keyEvents.values());
        if (events.length === 0) return [];
        
        return [events[events.length - 1]];
    }
}
