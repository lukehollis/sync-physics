var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// engine/vars.ts
var $vars = new Proxy({}, {
  get(_, prop) {
    if (typeof prop === "string") {
      return Symbol(prop);
    }
    return void 0;
  }
});
if (import.meta.main) {
  const { user, post } = $vars;
  console.log(user, post);
}

// engine/util.ts
function inspect(obj, options) {
  if (typeof obj === "string")
    return obj;
  if (obj === null)
    return "null";
  if (obj === void 0)
    return "undefined";
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}

// engine/actions.ts
var ActionConcept = class {
  constructor() {
    __publicField(this, "actions", /* @__PURE__ */ new Map());
    __publicField(this, "flowIndex", /* @__PURE__ */ new Map());
  }
  invoke(record) {
    let id = record.id;
    const flow2 = record.flow;
    if (id === void 0) {
      id = uuid();
    }
    const actionRecord = { id, ...record };
    this.actions.set(id, actionRecord);
    const partition = this.flowIndex.get(flow2) || [];
    this.flowIndex.set(flow2, [...partition, actionRecord]);
    return { id };
  }
  invoked({ id, output }) {
    const action = this.actions.get(id);
    if (action === void 0) {
      throw new Error(`Action with id ${id} not found.`);
    }
    action.output = output;
    return { id };
  }
  _getByFlow(flow2) {
    return this.flowIndex.get(flow2);
  }
  _getById(id) {
    return this.actions.get(id);
  }
};

// engine/frames.ts
var Frames = class _Frames extends Array {
  constructor(...frames) {
    super(...frames);
    return new Proxy(this, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function" && prop !== "query" && prop !== "queryAsync") {
          return function(...args) {
            const result = value.apply(this, args);
            if (Array.isArray(result) && !(result instanceof _Frames)) {
              return new _Frames(...result);
            }
            return result;
          };
        }
        return value;
      }
    });
  }
  query(f, input, output) {
    const result = new _Frames();
    const promises = [];
    const processOutputs = (frame, functionOutputArray) => {
      for (const functionOutput of functionOutputArray) {
        const newFrame = { ...frame };
        for (const [outputKey, symbolKey] of Object.entries(output)) {
          if (typeof symbolKey === "symbol" && functionOutput && typeof functionOutput === "object" && outputKey in functionOutput) {
            newFrame[symbolKey] = functionOutput[outputKey];
          }
        }
        result.push(newFrame);
      }
    };
    for (const frame of this) {
      const entries = [];
      for (const [key, binding] of Object.entries(input)) {
        let value = binding;
        if (typeof binding === "symbol") {
          const bound = frame[binding];
          if (bound === void 0) {
            throw new Error(
              `Binding: ${String(binding)} not found in frame: ${frame}`
            );
          }
          value = bound;
        }
        entries.push([key, value]);
      }
      const boundInput = Object.fromEntries(entries);
      const maybeArray = f(boundInput);
      if (typeof maybeArray.then === "function") {
        const p = maybeArray.then((arr) => {
          processOutputs(frame, arr);
        });
        promises.push(p);
      } else {
        processOutputs(frame, maybeArray);
      }
    }
    if (promises.length > 0) {
      return Promise.all(promises).then(() => result);
    }
    return result;
  }
  async queryAsync(f, input, output) {
    const result = new _Frames();
    for (const frame of this) {
      const entries = [];
      for (const [key, binding] of Object.entries(input)) {
        let value = binding;
        if (typeof binding === "symbol") {
          const bound = frame[binding];
          if (bound === void 0) {
            throw new Error(
              `Binding: ${String(binding)} not found in frame: ${frame}`
            );
          }
          value = bound;
        }
        entries.push([key, value]);
      }
      const boundInput = Object.fromEntries(entries);
      const functionOutputArray = await f(
        boundInput
      );
      for (const functionOutput of functionOutputArray) {
        const newFrame = { ...frame };
        for (const [outputKey, symbolKey] of Object.entries(output)) {
          if (typeof symbolKey === "symbol" && functionOutput && typeof functionOutput === "object" && outputKey in functionOutput) {
            newFrame[symbolKey] = functionOutput[outputKey];
          }
        }
        result.push(newFrame);
      }
    }
    return result;
  }
};

// engine/sync.ts
var flow = Symbol("flow");
var synced = Symbol("synced");
var actionId = Symbol("actionId");
function actions(...actions2) {
  return actions2.map(([action, input, output]) => {
    const concept = action.concept;
    if (concept === void 0) {
      throw new Error(`Action ${action.name} is not instrumented.`);
    }
    return {
      concept,
      action,
      input,
      flow,
      ...output ? { output } : {}
    };
  });
}
var Logging = /* @__PURE__ */ ((Logging2) => {
  Logging2[Logging2["OFF"] = 0] = "OFF";
  Logging2[Logging2["TRACE"] = 1] = "TRACE";
  Logging2[Logging2["VERBOSE"] = 2] = "VERBOSE";
  return Logging2;
})(Logging || {});
var SyncConcept = class {
  constructor(actionConcept = new ActionConcept()) {
    __publicField(this, "syncs", {});
    __publicField(this, "syncsByAction", /* @__PURE__ */ new Map());
    __publicField(this, "Action");
    __publicField(this, "logging", 1 /* TRACE */);
    __publicField(this, "boundActions", /* @__PURE__ */ new Map());
    this.Action = actionConcept;
  }
  register(syncs) {
    if (!syncs || typeof syncs !== "object") {
      console.error("Invalid syncs object provided to register:", syncs);
      return;
    }
    for (const name in syncs) {
      if (!syncs.hasOwnProperty || syncs.hasOwnProperty(name)) {
        const syncFunction = syncs[name];
        if (typeof syncFunction !== "function") {
          console.warn(`Skipping sync "${name}" - not a function`);
          continue;
        }
        const syncDeclaration = syncFunction($vars);
        const sync = { sync: name, ...syncDeclaration };
        this.syncs[name] = sync;
        for (const { action } of sync.when) {
          const mappedSyncs = this.syncsByAction.get(action);
          if (mappedSyncs === void 0) {
            this.syncsByAction.set(action, /* @__PURE__ */ new Set([sync]));
          } else {
            mappedSyncs.add(sync);
          }
        }
      }
    }
  }
  async synchronize(record) {
    if (this.logging === 2 /* VERBOSE */) {
      console.log("Synchronizing action:", record);
    }
    if (this.logging === 1 /* TRACE */) {
      const boundAction = record.action.action;
      const boundName = boundAction ? boundAction.name.slice("bound ".length) : "UNDEFINED";
      console.log(
        `${record.concept.constructor.name}.${boundName} ${inspect(record.input)} => ${inspect(record.output)}
`
      );
    }
    const syncs = await this.syncsByAction.get(record.action);
    if (syncs) {
      for (const sync of syncs) {
        let [frames, actionSymbols] = await this.matchWhen(
          record,
          sync
        );
        this.logFrames(
          `Matched \`sync\`: ${sync.sync} with \`when\`:`,
          frames
        );
        if (sync.where !== void 0) {
          const maybeFrames = sync.where(frames);
          frames = maybeFrames instanceof Promise ? await maybeFrames : maybeFrames;
          this.logFrames("After processing `where`:", frames);
        }
        await this.addThen(frames, sync, actionSymbols);
      }
    }
  }
  logFrames(message, frames) {
    if (this.logging === 2 /* VERBOSE */ && frames.length > 0) {
      console.log(message, frames);
    }
  }
  async matchWhen(record, sync) {
    let frames = new Frames();
    const whens = sync.when;
    const flowActions = await this.Action._getByFlow(record.flow);
    if (flowActions === void 0)
      return [frames, []];
    let i = 0;
    const actionSymbols = [];
    frames.push({ [flow]: record.flow });
    for (const when of whens) {
      const actionSymbol = Symbol(`action_${i}`);
      actionSymbols.push(actionSymbol);
      i++;
      const newFrames = new Frames();
      for (const frame of frames) {
        for (const record2 of flowActions) {
          if (record2.synced && record2.synced.has(sync.sync)) {
            continue;
          }
          const matched = this.matchArguments(
            record2,
            when,
            frame,
            actionSymbol
          );
          if (matched === void 0)
            continue;
          newFrames.push(matched);
        }
      }
      frames = newFrames;
    }
    return [frames, actionSymbols];
  }
  async addThen(frames, sync, actionSymbols) {
    const thens = [];
    for (const frame of frames) {
      const whenActions = [];
      for (const actionSymbol of actionSymbols) {
        const actionId2 = frame[actionSymbol];
        if (actionId2 === void 0 || typeof actionId2 !== "string") {
          throw new Error("Missing actionId in `then` clause.");
        }
        const action = this.Action._getById(actionId2);
        if (action?.synced) {
          whenActions.push(action);
        } else {
          throw new Error(
            `Action ${action} missing or missing synced Map.`
          );
        }
      }
      for (const then of sync.then) {
        const matched = this.matchThen(then, frame);
        const id = matched[actionId];
        if (id === void 0 || typeof id !== "string") {
          throw new Error(
            "Action produced from `then` is missing an id."
          );
        }
        for (const whenAction of whenActions) {
          whenAction.synced?.set(sync.sync, id);
        }
        thens.push([then.action, matched]);
      }
    }
    for (const [thenAction, thenRecord] of thens) {
      if (this.logging === 2 /* VERBOSE */) {
        console.log(`${sync.sync}: THEN ${thenAction}`, thenRecord);
      }
      await thenAction(thenRecord);
    }
  }
  matchThen(then, frame) {
    const bound = Object.entries(then.input).map(([key, value]) => {
      let matchedValue = value;
      if (typeof value === "symbol") {
        matchedValue = frame[value];
        if (matchedValue === void 0) {
          throw new Error(
            `Missing binding: ${String(value)} in frame: ${frame}`
          );
        }
      }
      return [key, matchedValue];
    });
    const inputPattern = Object.fromEntries(bound);
    const input = {
      ...inputPattern,
      [flow]: frame[flow],
      [actionId]: uuid()
    };
    return input;
  }
  matchArguments(record, when, frame, actionSymbol) {
    let newFrame = { ...frame };
    if (record.concept !== when.concept || record.action !== when.action)
      return;
    for (const [key, value] of Object.entries(when.input)) {
      const recordValue = record.input[key];
      if (recordValue === void 0)
        return;
      if (typeof value === "symbol") {
        const bound = frame[value];
        if (bound === void 0) {
          newFrame = { ...newFrame, [value]: recordValue };
        } else {
          if (bound !== recordValue)
            return;
        }
      } else {
        if (recordValue !== value)
          return;
      }
    }
    if (when.output === void 0) {
      throw new Error(`When pattern: ${when} is missing output pattern.`);
    }
    for (const [key, value] of Object.entries(when.output)) {
      if (record.output === void 0)
        return;
      const recordValue = record.output[key];
      if (recordValue === void 0)
        return;
      if (typeof value === "symbol") {
        const bound = frame[value];
        if (bound === void 0) {
          newFrame = { ...newFrame, [value]: recordValue };
        } else {
          if (bound !== recordValue)
            return;
        }
      } else {
        if (recordValue !== value)
          return;
      }
    }
    return { ...newFrame, [actionSymbol]: record.id };
  }
  instrumentConcept(concept) {
    const Action = this.Action;
    const synchronize = this.synchronize.bind(this);
    const boundActions = this.boundActions;
    return new Proxy(concept, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function" && value.name.startsWith("_")) {
          let bound = boundActions.get(value);
          if (bound === void 0) {
            bound = value.bind(concept);
            if (bound === void 0) {
              throw new Error(`Action ${value} not found.`);
            }
            boundActions.set(value, bound);
          }
          return bound;
        }
        if (typeof value === "function" && !value.name.startsWith("_")) {
          let instrumented = boundActions.get(value);
          if (instrumented === void 0) {
            const action = value.bind(concept);
            instrumented = async function instrumented2(args) {
              let {
                [flow]: flowToken,
                [synced]: syncedMap,
                [actionId]: id,
                ...input
              } = args;
              if (flowToken === void 0) {
                flowToken = uuid();
              }
              if (typeof flowToken !== "string") {
                throw new Error("Flow token not string.");
              }
              if (syncedMap === void 0) {
                syncedMap = /* @__PURE__ */ new Map();
              }
              if (!(syncedMap instanceof Map)) {
                throw new Error("synced must be a Map.");
              }
              if (id === void 0)
                id = uuid();
              if (typeof id !== "string") {
                throw new Error("actionId not string.");
              }
              const actionRecord = {
                id,
                action: instrumented2,
                concept,
                input,
                synced: syncedMap,
                flow: flowToken
              };
              Action.invoke(actionRecord);
              const output = await action(input);
              Action.invoked({ id, output });
              await synchronize({ ...actionRecord, output });
              return output;
            };
            instrumented.concept = concept;
            instrumented.action = action;
            const instrumentedRepr = () => `${inspect(action)}`;
            instrumented.toString = instrumentedRepr;
            Object.defineProperty(instrumented, inspect.custom, {
              value: instrumentedRepr,
              writable: false,
              configurable: true
            });
            boundActions.set(value, instrumented);
          }
          return instrumented;
        }
        return value;
      }
    });
  }
  instrument(concepts) {
    return Object.fromEntries(
      Object.entries(concepts).map(([key, concept]) => [
        key,
        this.instrumentConcept(concept)
      ])
    );
  }
};

// concepts/PhysicsConcept.ts
var PhysicsConcept = class {
  constructor() {
    __publicField(this, "world");
    __publicField(this, "bodies", /* @__PURE__ */ new Map());
    __publicField(this, "softBodies", /* @__PURE__ */ new Map());
    __publicField(this, "transform");
    __publicField(this, "softBodyHelpers");
    __publicField(this, "stepCount", 0);
  }
  initialize(args) {
    if (typeof Ammo === "undefined") {
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
  async loadAmmo() {
    console.log("Ammo.js should be loaded via script tag");
  }
  createRigidBody(args) {
    let shape;
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
  createSoftBody(args) {
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
    const softBody = this.softBodyHelpers.CreateFromTriMesh(
      this.world.getWorldInfo(),
      vertices,
      indices,
      indices.length / 3,
      true
    );
    const sbConfig = softBody.get_m_cfg();
    sbConfig.set_viterations(10);
    sbConfig.set_piterations(10);
    sbConfig.set_diterations(10);
    sbConfig.set_citerations(10);
    sbConfig.set_collisions(17);
    sbConfig.set_kDF(0.5);
    sbConfig.set_kDP(0.05);
    sbConfig.set_kDG(5e-3);
    sbConfig.set_kLF(0.05);
    sbConfig.set_kPR(0);
    sbConfig.set_kVC(20);
    sbConfig.set_kAHR(0.7);
    sbConfig.set_kCHR(1);
    sbConfig.set_kKHR(0.1);
    sbConfig.set_kSHR(1);
    const mat = softBody.get_m_materials().at(0);
    mat.set_m_kLST(0.4);
    mat.set_m_kAST(0.4);
    mat.set_m_kVST(0.4);
    softBody.generateBendingConstraints(2, mat);
    softBody.setTotalMass(args.mass, false);
    Ammo.btSoftBody.prototype.translate.call(
      softBody,
      new Ammo.btVector3(args.position.x, args.position.y, args.position.z)
    );
    this.world.addSoftBody(softBody, 1, -1);
    this.softBodies.set(args.body, softBody);
    console.log("Soft body created and added to world:", args.body);
    return { body: args.body };
  }
  step() {
    if (this.world) {
      this.world.stepSimulation(1 / 60, 10);
      this.stepCount++;
      if (this.stepCount % 60 === 0) {
        console.log(`Physics stepping: ${this.stepCount} steps, ${this.softBodies.size} soft bodies, ${this.bodies.size} rigid bodies`);
      }
    }
    return { world: "main_world" };
  }
  applyForce(args) {
    const body = this.bodies.get(args.body);
    if (body) {
      body.activate();
      body.applyCentralImpulse(new Ammo.btVector3(args.force.x, args.force.y, args.force.z));
    }
    return { body: args.body };
  }
  anchorSoftBodyNode(args) {
    const softBody = this.softBodies.get(args.body);
    if (!softBody) {
      console.error("Soft body not found:", args.body);
      return { anchor: `${args.body}_anchor_${args.nodeIndex}` };
    }
    if (args.rigidBody) {
      const rigid = this.bodies.get(args.rigidBody);
      if (rigid) {
        softBody.appendAnchor(args.nodeIndex, rigid, false, 1);
      }
    } else {
      softBody.setMass(args.nodeIndex, 0);
    }
    console.log(`Anchored node ${args.nodeIndex} of soft body ${args.body}`);
    return { anchor: `${args.body}_anchor_${args.nodeIndex}` };
  }
  releaseSoftBodyAnchor(args) {
    const softBody = this.softBodies.get(args.body);
    if (!softBody) {
      console.error("Soft body not found:", args.body);
      return {};
    }
    softBody.setMass(args.nodeIndex, 0.05);
    console.log(`Released anchor at node ${args.nodeIndex} of soft body ${args.body}`);
    return {};
  }
  removeBody(args) {
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
  _getBodyTransform(args) {
    const body = this.bodies.get(args.body);
    if (!body)
      return [];
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
  _getSoftBodyNodes(args) {
    const softBody = this.softBodies.get(args.body);
    if (!softBody)
      return [];
    const nodes = softBody.get_m_nodes();
    const numNodes = nodes.size();
    const vertices = [];
    for (let i = 0; i < numNodes; i++) {
      const node = nodes.at(i);
      const pos = node.get_m_x();
      vertices.push(pos.x(), pos.y(), pos.z());
    }
    return [{ vertices }];
  }
  _getSoftBodyAnchors(args) {
    const softBody = this.softBodies.get(args.body);
    if (!softBody)
      return [];
    return [{ anchors: [] }];
  }
};

// concepts/ClothConcept.ts
var ClothConcept = class {
  constructor() {
    __publicField(this, "cloths", /* @__PURE__ */ new Map());
    __publicField(this, "anchors", /* @__PURE__ */ new Map());
  }
  create(args) {
    const { cloth, width, height, segmentsX, segmentsY, mass, position } = args;
    const vertices = [];
    const indices = [];
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
    for (let y = 0; y < segmentsY; y++) {
      for (let x = 0; x < segmentsX; x++) {
        const a = x + (segmentsX + 1) * y;
        const b = x + (segmentsX + 1) * (y + 1);
        const c = x + 1 + (segmentsX + 1) * (y + 1);
        const d = x + 1 + (segmentsX + 1) * y;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    const clothData = {
      width,
      height,
      segmentsX,
      segmentsY,
      mass,
      position,
      vertices: [...vertices],
      indices: [...indices],
      anchors: /* @__PURE__ */ new Map(),
      links: /* @__PURE__ */ new Map()
    };
    const numVertices = vertices.length / 3;
    for (let i = 0; i < numVertices; i++) {
      if ((i + 1) % (segmentsX + 1) !== 0) {
        const dist = this.calculateDistance(vertices, i, i + 1);
        clothData.links.set(`${i}-${i + 1}`, { initialDistance: dist, broken: false });
      }
      if (i + segmentsX + 1 < numVertices) {
        const dist = this.calculateDistance(vertices, i, i + segmentsX + 1);
        clothData.links.set(`${i}-${i + segmentsX + 1}`, { initialDistance: dist, broken: false });
      }
    }
    this.cloths.set(cloth, clothData);
    return { cloth, vertices, indices };
  }
  anchorVertex(args) {
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
  releaseAnchor(args) {
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
  updateVertices(args) {
    const clothData = this.cloths.get(args.cloth);
    if (clothData) {
      clothData.vertices = [...args.vertices];
    }
    return { cloth: args.cloth };
  }
  getStress(args) {
    const clothData = this.cloths.get(args.cloth);
    if (!clothData)
      return { stress: 0 };
    const linkKey = `${Math.min(args.vertex1, args.vertex2)}-${Math.max(args.vertex1, args.vertex2)}`;
    const link = clothData.links.get(linkKey);
    if (!link || link.broken)
      return { stress: 0 };
    const currentDistance = this.calculateDistance(clothData.vertices, args.vertex1, args.vertex2);
    const stress = currentDistance / link.initialDistance;
    return { stress };
  }
  tearLink(args) {
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
  pickVertex(args) {
    const clothData = this.cloths.get(args.cloth);
    if (!clothData)
      return { vertexIndex: -1 };
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
  _getClothData(args) {
    const clothData = this.cloths.get(args.cloth);
    if (!clothData)
      return [];
    return [{
      vertices: clothData.vertices,
      indices: clothData.indices,
      width: clothData.width,
      height: clothData.height,
      segmentsX: clothData.segmentsX,
      segmentsY: clothData.segmentsY
    }];
  }
  _getAnchors(args) {
    const clothData = this.cloths.get(args.cloth);
    if (!clothData)
      return [];
    const anchors = Array.from(clothData.anchors.entries()).map(([vertexIndex, position]) => ({
      vertexIndex,
      position
    }));
    return [{ anchors }];
  }
  _getLinks(args) {
    const clothData = this.cloths.get(args.cloth);
    if (!clothData)
      return [];
    const links = Array.from(clothData.links.entries()).map(([key, data]) => {
      const [v1, v2] = key.split("-").map(Number);
      return { vertex1: v1, vertex2: v2, broken: data.broken };
    });
    return [{ links }];
  }
  calculateDistance(vertices, i1, i2) {
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
};

// concepts/SceneConcept.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
var SceneConcept = class {
  constructor() {
    __publicField(this, "scene", null);
    __publicField(this, "camera", null);
    __publicField(this, "renderer", null);
    __publicField(this, "controls", null);
    __publicField(this, "meshes", /* @__PURE__ */ new Map());
    __publicField(this, "lights", /* @__PURE__ */ new Map());
    __publicField(this, "container", null);
  }
  initialize(args) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(8900331);
    this.camera = new THREE.PerspectiveCamera(
      75,
      args.width / args.height,
      0.1,
      1e3
    );
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(args.width, args.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container = document.getElementById("container") || document.body;
    this.container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    return { scene: "main_scene", camera: "main_camera" };
  }
  addLight(args) {
    if (!this.scene)
      return { light: args.light };
    let light;
    switch (args.type) {
      case "ambient":
        light = new THREE.AmbientLight(args.color, args.intensity);
        break;
      case "directional":
        light = new THREE.DirectionalLight(args.color, args.intensity);
        light.position.set(args.position.x, args.position.y, args.position.z);
        light.castShadow = true;
        light.shadow.camera.left = -20;
        light.shadow.camera.right = 20;
        light.shadow.camera.top = 20;
        light.shadow.camera.bottom = -20;
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
  createMesh(args) {
    if (!this.scene)
      return { mesh: args.mesh };
    let geometry;
    let material;
    if (args.geometry === "sphere") {
      geometry = new THREE.SphereGeometry(1, 32, 32);
    } else if (args.geometry === "box") {
      geometry = new THREE.BoxGeometry(2, 2, 2);
    } else if (args.geometry === "plane") {
      geometry = new THREE.PlaneGeometry(100, 100);
    } else if (args.geometry === "cloth") {
      geometry = new THREE.BufferGeometry();
    } else {
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
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(geoData.vertices, 3));
        geometry.setIndex(geoData.indices);
        geometry.computeVertexNormals();
      } else {
        geometry = new THREE.BoxGeometry(1, 1, 1);
      }
    }
    if (args.material === "standard") {
      material = new THREE.MeshStandardMaterial({
        color: 8421504,
        roughness: 0.5,
        metalness: 0.1
      });
    } else if (args.material === "cloth") {
      material = new THREE.MeshStandardMaterial({
        color: 16737792,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.2
      });
    } else if (args.material === "ground") {
      material = new THREE.MeshStandardMaterial({
        color: 4210752,
        roughness: 1,
        metalness: 0
      });
    } else {
      const matData = JSON.parse(args.material);
      material = new THREE.MeshStandardMaterial({
        color: matData.color || 8421504,
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
  updateMesh(args) {
    const meshData = this.meshes.get(args.mesh);
    if (!meshData)
      return { mesh: args.mesh };
    if (args.vertices) {
      const geometry = meshData.geometry;
      const positionAttribute = geometry.getAttribute("position");
      if (positionAttribute) {
        const positions = positionAttribute.array;
        for (let i = 0; i < args.vertices.length; i++) {
          positions[i] = args.vertices[i];
        }
        positionAttribute.needsUpdate = true;
        geometry.computeVertexNormals();
      }
    }
    if (args.position) {
      meshData.mesh.position.set(args.position.x, args.position.y, args.position.z);
    }
    if (args.rotation) {
      meshData.mesh.quaternion.set(args.rotation.x, args.rotation.y, args.rotation.z, args.rotation.w);
    }
    return { mesh: args.mesh };
  }
  removeMesh(args) {
    const meshData = this.meshes.get(args.mesh);
    if (meshData && this.scene) {
      this.scene.remove(meshData.mesh);
      meshData.geometry.dispose();
      meshData.material.dispose();
      this.meshes.delete(args.mesh);
    }
    return {};
  }
  render() {
    if (this.renderer && this.scene && this.camera) {
      if (this.controls) {
        this.controls.update();
      }
      this.renderer.render(this.scene, this.camera);
    }
    return { scene: "main_scene" };
  }
  setCameraPosition(args) {
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
  resize(args) {
    if (this.camera && this.renderer) {
      this.camera.aspect = args.width / args.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(args.width, args.height);
    }
    return { scene: "main_scene" };
  }
  // Query functions
  _getMeshPosition(args) {
    const meshData = this.meshes.get(args.mesh);
    if (!meshData)
      return [];
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
  _getCamera() {
    if (!this.camera || !this.controls)
      return [];
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
  _getRaycaster(args) {
    if (!this.camera)
      return [];
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
  _getAllMeshes() {
    const allMeshes = [];
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
};

// concepts/InteractionConcept.ts
var InteractionConcept = class {
  constructor() {
    __publicField(this, "mouseEvents", /* @__PURE__ */ new Map());
    __publicField(this, "keyEvents", /* @__PURE__ */ new Map());
    __publicField(this, "drags", /* @__PURE__ */ new Map());
    __publicField(this, "eventCounter", 0);
    __publicField(this, "dragCounter", 0);
    if (typeof window !== "undefined") {
      this.setupEventListeners();
    }
  }
  setupEventListeners() {
    const canvas = document.querySelector("canvas");
    if (!canvas)
      return;
    canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
    canvas.addEventListener("mouseup", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
    window.addEventListener("keydown", (e) => {
    });
    window.addEventListener("keyup", (e) => {
    });
  }
  mouseDown(args) {
    const eventId = args.event || `mouse_${this.eventCounter++}`;
    this.mouseEvents.set(eventId, {
      type: "mousedown",
      position: args.position,
      button: args.button
    });
    return { event: eventId };
  }
  mouseMove(args) {
    const eventId = args.event || `mouse_${this.eventCounter++}`;
    this.mouseEvents.set(eventId, {
      type: "mousemove",
      position: args.position,
      button: -1
    });
    return { event: eventId };
  }
  mouseUp(args) {
    const eventId = args.event || `mouse_${this.eventCounter++}`;
    this.mouseEvents.set(eventId, {
      type: "mouseup",
      position: args.position,
      button: args.button
    });
    return { event: eventId };
  }
  keyDown(args) {
    const eventId = args.event || `key_${this.eventCounter++}`;
    this.keyEvents.set(eventId, {
      type: "keydown",
      key: args.key
    });
    return { event: eventId };
  }
  keyUp(args) {
    const eventId = args.event || `key_${this.eventCounter++}`;
    this.keyEvents.set(eventId, {
      type: "keyup",
      key: args.key
    });
    return { event: eventId };
  }
  startDrag(args) {
    const dragId = args.drag || `drag_${this.dragCounter++}`;
    this.drags.set(dragId, {
      active: true,
      startPosition: args.position,
      currentPosition: args.position,
      target: args.target
    });
    return { drag: dragId };
  }
  updateDrag(args) {
    const dragData = this.drags.get(args.drag);
    if (dragData) {
      dragData.currentPosition = args.position;
    }
    return { drag: args.drag };
  }
  endDrag(args) {
    const dragData = this.drags.get(args.drag);
    if (dragData) {
      dragData.active = false;
    }
    return {};
  }
  getRaycast(args) {
    return {
      origin: { x: 0, y: 10, z: 20 },
      direction: { x: args.position.x, y: args.position.y, z: -1 }
    };
  }
  // Query functions
  _getActiveDrag() {
    const activeDrags = [];
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
  _getLastMouseEvent() {
    const events = Array.from(this.mouseEvents.values());
    if (events.length === 0)
      return [];
    return [events[events.length - 1]];
  }
  _getLastKeyEvent() {
    const events = Array.from(this.keyEvents.values());
    if (events.length === 0)
      return [];
    return [events[events.length - 1]];
  }
};

// concepts/EntityConcept.ts
var EntityConcept = class {
  constructor() {
    __publicField(this, "objects", /* @__PURE__ */ new Map());
    __publicField(this, "objectCounter", 0);
  }
  createProjectile(args) {
    const objectId = args.object || `projectile_${this.objectCounter++}`;
    this.objects.set(objectId, {
      type: "projectile",
      position: args.position,
      velocity: args.velocity,
      mass: args.mass,
      radius: args.radius,
      mesh: `${objectId}_mesh`,
      body: `${objectId}_body`
    });
    return { object: objectId };
  }
  update(args) {
    const objectData = this.objects.get(args.object);
    if (objectData) {
      objectData.position = args.position;
    }
    return { object: args.object };
  }
  remove(args) {
    this.objects.delete(args.object);
    return {};
  }
  getAll() {
    return { objects: Array.from(this.objects.keys()) };
  }
  cleanup() {
    let removedCount = 0;
    const threshold = -10;
    this.objects.forEach((data, id) => {
      if (data.position.y < threshold) {
        this.objects.delete(id);
        removedCount++;
      }
    });
    return { count: removedCount };
  }
  // Query functions
  _getObjectData(args) {
    const data = this.objects.get(args.object);
    if (!data)
      return [];
    return [data];
  }
  _getAllObjects() {
    const allObjects = [];
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
  _getProjectiles() {
    const projectiles = [];
    this.objects.forEach((data, id) => {
      if (data.type === "projectile") {
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
};

// concepts/APIConcept.ts
var APIConcept = class {
  constructor() {
    __publicField(this, "requests", /* @__PURE__ */ new Map());
    __publicField(this, "requestCounter", 0);
  }
  request(args) {
    const requestId = `request_${this.requestCounter++}`;
    console.log(`APIConcept.request called with:`, args, `-> ${requestId}`);
    const callback = args.callback || "";
    this.requests.set(requestId, {
      callback,
      input: args
    });
    return { request: requestId };
  }
  response(args) {
    const requestData = this.requests.get(args.request);
    if (requestData) {
      const { request, ...output } = args;
      requestData.output = output;
    }
    return { request: args.request };
  }
  // Query functions
  _getRequest(args) {
    const data = this.requests.get(args.request);
    return data ? [data] : [];
  }
  _getPendingRequests() {
    const pending = [];
    this.requests.forEach((data, id) => {
      if (!data.output) {
        pending.push({
          request: id,
          callback: data.callback,
          input: data.input
        });
      }
    });
    return pending;
  }
};

// syncs/initialization.syncs.ts
var InitializeSimulation = (concepts) => ({
  world,
  scene,
  camera,
  cloth,
  vertices,
  indices,
  request
}) => {
  const { API, Physics, Scene: Scene2, Cloth } = concepts;
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
      [Scene2.initialize, { width: 800, height: 600 }],
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
var SetupScene = (concepts) => ({ cloth, vertices, indices }) => {
  const { Scene: Scene2, Cloth } = concepts;
  return {
    when: actions(
      [Scene2.initialize, {}, { scene: "main_scene", camera: "main_camera" }],
      [Cloth.create, { cloth: "main_cloth" }, { cloth, vertices, indices }]
    ),
    then: actions(
      // Add lights
      [Scene2.addLight, {
        light: "ambient",
        type: "ambient",
        color: 16777215,
        intensity: 0.6,
        position: { x: 0, y: 0, z: 0 }
      }],
      [Scene2.addLight, {
        light: "directional",
        type: "directional",
        color: 16777215,
        intensity: 0.5,
        position: { x: 5, y: 10, z: 5 }
      }],
      // Create ground plane
      [Scene2.createMesh, {
        mesh: "ground",
        geometry: JSON.stringify({ type: "plane", width: 100, height: 100 }),
        material: "ground",
        position: { x: 0, y: -5, z: 0 }
      }],
      // Create static sphere
      [Scene2.createMesh, {
        mesh: "sphere",
        geometry: JSON.stringify({ type: "sphere", radius: 2 }),
        material: "standard",
        position: { x: 0, y: 0, z: 0 }
      }],
      // Create cloth mesh
      [Scene2.createMesh, {
        mesh: "cloth_mesh",
        geometry: JSON.stringify({ vertices, indices }),
        material: JSON.stringify({
          color: 16737792,
          doubleSide: true,
          roughness: 0.8,
          metalness: 0.2
        }),
        position: { x: 0, y: 0, z: 0 }
      }]
    )
  };
};
var SetupPhysicsBodies = (concepts) => ({ vertices, indices }) => {
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
var AnchorClothCorners = (concepts) => ({}) => {
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
        nodeIndex: 20,
        // segmentsX = 20, so last vertex in first row
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

// syncs/physics.syncs.ts
var PhysicsStep = (concepts) => ({}) => {
  const { Scene: Scene2, Physics } = concepts;
  return {
    when: actions(
      [Scene2.render, {}, { scene: "main_scene" }]
    ),
    then: actions(
      [Physics.step, {}]
    )
  };
};
var UpdateMeshFromPhysics = (concepts) => ({ body, position, rotation, mesh, object }) => {
  const { Physics, Entity, Scene: Scene2 } = concepts;
  return {
    when: actions(
      [Physics.step, {}, { world: "main_world" }]
    ),
    where: (frames) => {
      return frames.query(Entity._getAllObjects, {}, { object, body, mesh }).query(Physics._getBodyTransform, { body }, { position, rotation }).filter(($) => $[position] && $[rotation]);
    },
    then: actions(
      [Scene2.updateMesh, { mesh, position, rotation }]
    )
  };
};
var UpdateClothMesh = (concepts) => ({ vertices }) => {
  const { Physics, Cloth, Scene: Scene2 } = concepts;
  return {
    when: actions(
      [Physics.step, {}, { world: "main_world" }]
    ),
    where: (frames) => {
      return frames.query(Physics._getSoftBodyNodes, { body: "cloth_body" }, { vertices }).filter(($) => $[vertices] && $[vertices].length > 0);
    },
    then: actions(
      [Scene2.updateMesh, { mesh: "cloth_mesh", vertices }],
      [Cloth.updateVertices, { cloth: "main_cloth", vertices }]
    )
  };
};
var ApplyClothAnchorsToPhysics = (concepts) => ({ anchor, vertexIndex, position }) => {
  const { Cloth, Physics } = concepts;
  return {
    when: actions(
      [Cloth.anchorVertex, { cloth: "main_cloth" }, { anchor }]
    ),
    where: (frames) => {
      return frames.query(Cloth._getAnchors, { cloth: "main_cloth" }, { anchors: anchor }).map(($) => {
        const anchorsList = $[anchor];
        return anchorsList.map((a) => ({
          ...$,
          [vertexIndex]: a.vertexIndex,
          [position]: a.position
        }));
      }).flat().filter(($) => $[vertexIndex] !== void 0);
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
var ReleaseClothAnchorsFromPhysics = (concepts) => ({ anchor, vertexIndex }) => {
  const { Cloth, Physics } = concepts;
  return {
    when: actions(
      [Cloth.releaseAnchor, { anchor: "drag_anchor" }, {}]
    ),
    where: (frames) => {
      return frames.query(Cloth._getAnchors, { cloth: "main_cloth" }, { anchors: anchor }).map(($) => {
        const anchorsList = $[anchor];
        return anchorsList.filter((a) => a.vertexIndex >= 0).map((a) => ({
          ...$,
          [vertexIndex]: a.vertexIndex
        }));
      }).flat();
    },
    then: actions(
      [Physics.releaseSoftBodyAnchor, {
        body: "cloth_body",
        nodeIndex: vertexIndex
      }]
    )
  };
};
var CheckClothTearing = (concepts) => ({ cloth, vertex1, vertex2, stress, link, links }) => {
  const { Cloth } = concepts;
  return {
    when: actions(
      [Cloth.updateVertices, { cloth: "main_cloth" }, { cloth }]
    ),
    where: (frames) => {
      return frames.query(Cloth._getLinks, { cloth }, { links }).map(($) => {
        const linksList = $[links];
        return linksList.filter((l) => !l.broken).map((l) => ({
          ...$,
          [vertex1]: l.vertex1,
          [vertex2]: l.vertex2,
          [link]: `${l.vertex1}-${l.vertex2}`
        }));
      }).flat().query(Cloth.getStress, { cloth, vertex1, vertex2 }, { stress }).filter(($) => $[stress] > 1.8);
    },
    then: actions(
      [Cloth.tearLink, { link, cloth, vertex1, vertex2 }]
    )
  };
};

// syncs/interaction.syncs.ts
var StartClothDrag = (concepts) => ({ event, position, vertexIndex, anchor, origin, direction }) => {
  const { Interaction, Scene: Scene2, Cloth } = concepts;
  return {
    when: actions(
      [Interaction.mouseDown, { button: 0 }, { event, position }]
    ),
    where: (frames) => {
      return frames.query(Scene2._getRaycaster, { x: position.x, y: position.y }, { origin, direction }).query(Cloth.pickVertex, {
        cloth: "main_cloth",
        position: origin
      }, { vertexIndex }).filter(($) => $[vertexIndex] >= 0);
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
var UpdateClothDrag = (concepts) => ({ position, drag, origin, target }) => {
  const { Interaction, Scene: Scene2, Cloth } = concepts;
  return {
    when: actions(
      [Interaction.mouseMove, {}, { position }]
    ),
    where: (frames) => {
      return frames.query(Interaction._getActiveDrag, {}, { drag, target }).filter(($) => $[target] === "cloth").query(Scene2._getRaycaster, { x: position.x, y: position.y }, { origin });
    },
    then: actions(
      [Interaction.updateDrag, { drag, position }],
      [Cloth.anchorVertex, {
        anchor: "drag_anchor",
        cloth: "main_cloth",
        vertexIndex: -1,
        // Will be updated with actual vertex
        position: origin
      }]
    )
  };
};
var EndClothDrag = (concepts) => ({ drag }) => {
  const { Interaction, Cloth } = concepts;
  return {
    when: actions(
      [Interaction.mouseUp, { button: 0 }, {}]
    ),
    where: (frames) => {
      return frames.query(Interaction._getActiveDrag, {}, { drag });
    },
    then: actions(
      [Interaction.endDrag, { drag }],
      [Cloth.releaseAnchor, { anchor: "drag_anchor" }]
    )
  };
};
var ShootProjectile = (concepts) => ({
  key,
  object,
  position,
  direction,
  velocity,
  mesh,
  body,
  target
}) => {
  const { Interaction, Scene: Scene2, Entity, Physics } = concepts;
  return {
    when: actions(
      [Interaction.keyDown, { key: " " }, { key }]
    ),
    where: (frames) => {
      return frames.query(Scene2._getCamera, {}, { position, target }).map(($) => {
        const pos = $[position];
        const tgt = $[target];
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
      [Scene2.createMesh, {
        mesh,
        geometry: JSON.stringify({ type: "sphere", radius: 0.2 }),
        material: JSON.stringify({
          color: 16711680,
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
var CleanupProjectiles = (concepts) => ({ object, mesh, body, count, position }) => {
  const { Entity, Scene: Scene2, Physics } = concepts;
  return {
    when: actions(
      [Entity.cleanup, {}, { count }]
    ),
    where: (frames) => {
      return frames.filter(($) => $[count] > 0).query(Entity._getAllObjects, {}, { object, mesh, body, position }).filter(($) => {
        const pos = $[position];
        return pos && pos.y < -10;
      });
    },
    then: actions(
      [Entity.remove, { object }],
      [Scene2.removeMesh, { mesh }],
      [Physics.removeBody, { body }]
    )
  };
};
var TriggerCleanup = (concepts) => ({}) => {
  const { Scene: Scene2, Entity } = concepts;
  return {
    when: actions(
      [Scene2.render, {}, { scene: "main_scene" }]
    ),
    where: (frames) => {
      return frames.filter(() => Math.random() < 0.016);
    },
    then: actions(
      [Entity.cleanup, {}]
    )
  };
};

// syncs/index.ts
function setupEngine() {
  const Sync = new SyncConcept();
  Sync.logging = 0 /* OFF */;
  const concepts = {
    Physics: new PhysicsConcept(),
    Cloth: new ClothConcept(),
    Scene: new SceneConcept(),
    Interaction: new InteractionConcept(),
    Entity: new EntityConcept(),
    API: new APIConcept()
  };
  const instrumentedConcepts = Sync.instrument(concepts);
  const g = globalThis;
  g.Sync = Sync;
  g.Logging = Logging;
  g.Physics = instrumentedConcepts.Physics;
  g.Cloth = instrumentedConcepts.Cloth;
  g.Scene = instrumentedConcepts.Scene;
  g.Interaction = instrumentedConcepts.Interaction;
  g.Entity = instrumentedConcepts.Entity;
  g.API = instrumentedConcepts.API;
  const createSyncs = (concepts2) => ({
    // Initialization syncs
    InitializeSimulation: InitializeSimulation(concepts2),
    SetupScene: SetupScene(concepts2),
    SetupPhysicsBodies: SetupPhysicsBodies(concepts2),
    AnchorClothCorners: AnchorClothCorners(concepts2),
    // Physics syncs
    PhysicsStep: PhysicsStep(concepts2),
    UpdateMeshFromPhysics: UpdateMeshFromPhysics(concepts2),
    UpdateClothMesh: UpdateClothMesh(concepts2),
    ApplyClothAnchorsToPhysics: ApplyClothAnchorsToPhysics(concepts2),
    ReleaseClothAnchorsFromPhysics: ReleaseClothAnchorsFromPhysics(concepts2),
    CheckClothTearing: CheckClothTearing(concepts2),
    // Interaction syncs
    StartClothDrag: StartClothDrag(concepts2),
    UpdateClothDrag: UpdateClothDrag(concepts2),
    EndClothDrag: EndClothDrag(concepts2),
    ShootProjectile: ShootProjectile(concepts2),
    CleanupProjectiles: CleanupProjectiles(concepts2),
    TriggerCleanup: TriggerCleanup(concepts2)
  });
  const syncs = createSyncs(instrumentedConcepts);
  Sync.register(syncs);
  return Sync;
}
function startSimulation(sync) {
  const API = globalThis.API;
  console.log("Starting simulation, API available?", !!API);
  if (!API) {
    console.error("API concept not available!");
    return;
  }
  const Physics = globalThis.Physics;
  const Scene2 = globalThis.Scene;
  const Cloth = globalThis.Cloth;
  if (!Physics || !Scene2 || !Cloth) {
    console.error("Required concepts not available:", { Physics: !!Physics, Scene: !!Scene2, Cloth: !!Cloth });
    return;
  }
  console.log("Initializing physics world...");
  Physics.initialize({ gravity: { x: 0, y: -9.8, z: 0 } });
  console.log("Initializing scene...");
  Scene2.initialize({ width: window.innerWidth, height: window.innerHeight });
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
  Scene2.addLight({
    light: "ambient",
    type: "ambient",
    color: 16777215,
    intensity: 0.6,
    position: { x: 0, y: 0, z: 0 }
  });
  Scene2.addLight({
    light: "directional",
    type: "directional",
    color: 16777215,
    intensity: 0.5,
    position: { x: 5, y: 10, z: 5 }
  });
  Scene2.createMesh({
    mesh: "ground",
    geometry: JSON.stringify({ type: "plane", width: 100, height: 100 }),
    material: "ground",
    position: { x: 0, y: -5, z: 0 }
  });
  Scene2.updateMesh({
    mesh: "ground",
    rotation: { x: -0.7071068, y: 0, z: 0, w: 0.7071068 }
  });
  Scene2.createMesh({
    mesh: "sphere",
    geometry: JSON.stringify({ type: "sphere", radius: 2 }),
    material: "standard",
    position: { x: 0, y: 0, z: 0 }
  });
  Scene2.createMesh({
    mesh: "cloth_mesh",
    geometry: JSON.stringify({
      vertices: clothResult.vertices,
      indices: clothResult.indices
    }),
    material: JSON.stringify({
      color: 16742144,
      doubleSide: true,
      roughness: 0.8,
      metalness: 0.2
    }),
    position: { x: 0, y: 0, z: 0 }
  });
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
  let frameCount = 0;
  function animate() {
    requestAnimationFrame(animate);
    Physics.step({});
    const softBodyNodes = Physics._getSoftBodyNodes({ body: "cloth_body" });
    if (softBodyNodes && softBodyNodes.length > 0 && softBodyNodes[0].vertices) {
      Scene2.updateMesh({
        mesh: "cloth_mesh",
        vertices: softBodyNodes[0].vertices
      });
      Cloth.updateVertices({
        cloth: "main_cloth",
        vertices: softBodyNodes[0].vertices
      });
    }
    Scene2.render({});
    frameCount++;
    if (frameCount % 60 === 0) {
      console.log(`Animation running: ${frameCount} frames`);
    }
  }
  console.log("Starting animation loop");
  animate();
}

// main.ts
var loadingDiv = document.createElement("div");
loadingDiv.className = "loading";
loadingDiv.textContent = "Loading physics engine...";
document.body.appendChild(loadingDiv);
Ammo().then(() => {
  console.log("Ammo.js physics engine loaded");
  loadingDiv.remove();
  const engine = setupEngine();
  globalThis.Sync.logging = globalThis.Logging.OFF;
  console.log("About to call startSimulation...");
  startSimulation(engine);
  console.log("API concept available:", !!globalThis.API);
  console.log("All global concepts:", Object.keys(globalThis).filter((k) => k.includes("Concept") || ["Physics", "Cloth", "Scene", "Interaction", "Entity", "API", "Sync"].includes(k)));
  globalThis.manualInit = () => {
    console.log("Manual initialization triggered");
    const API = globalThis.API;
    const Physics = globalThis.Physics;
    const Scene2 = globalThis.Scene;
    const Cloth = globalThis.Cloth;
    if (API && Physics && Scene2 && Cloth) {
      console.log("All concepts available, triggering manual init");
      Physics.initialize({ gravity: { x: 0, y: -9.8, z: 0 } });
      Scene2.initialize({ width: 800, height: 600 });
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
  setTimeout(() => {
    console.log("Checking for concepts before setupEventListeners:");
    console.log("Interaction available:", !!globalThis.Interaction);
    console.log("Scene available:", !!globalThis.Scene);
    console.log("Entity available:", !!globalThis.Entity);
    setupEventListeners(0);
  }, 500);
  let lastTime = performance.now();
  let frames = 0;
  const fpsElement = document.querySelector("#fps span");
  const objectsElement = document.querySelector("#objects span");
  function updateStats() {
    frames++;
    const currentTime = performance.now();
    if (currentTime >= lastTime + 1e3) {
      if (fpsElement) {
        fpsElement.textContent = Math.round(frames * 1e3 / (currentTime - lastTime)).toString();
      }
      frames = 0;
      lastTime = currentTime;
    }
    const Scene2 = globalThis.Scene;
    const Entity = globalThis.Entity;
    let totalObjects = 0;
    if (Scene2 && Scene2._getAllMeshes) {
      const allMeshes = Scene2._getAllMeshes({});
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
function setupEventListeners(retryCount = 0) {
  const maxRetries = 10;
  const canvas = document.querySelector("canvas");
  const Interaction = globalThis.Interaction;
  if (!canvas) {
    if (retryCount < maxRetries) {
      console.log(`Canvas not found in DOM, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
      setTimeout(() => setupEventListeners(retryCount + 1), 500);
    } else {
      console.error("Canvas not found after maximum retries. Scene may not have initialized properly.");
    }
    return;
  }
  if (!Interaction) {
    if (retryCount < maxRetries) {
      console.log(`Interaction concept not found, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
      console.log("Available on globalThis:", Object.keys(globalThis).filter((k) => k.endsWith("Concept") || ["Physics", "Cloth", "Scene", "Interaction", "Entity", "API", "Sync"].includes(k)));
      setTimeout(() => setupEventListeners(retryCount + 1), 500);
    } else {
      console.error("Interaction concept not found after maximum retries.");
    }
    return;
  }
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      Interaction.mouseDown({
        event: `mouse_down_${Date.now()}`,
        position: { x, y },
        button: e.button
      });
    }
  });
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    Interaction.mouseMove({
      event: `mouse_move_${Date.now()}`,
      position: { x, y }
    });
  });
  canvas.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      Interaction.mouseUp({
        event: `mouse_up_${Date.now()}`,
        position: { x, y },
        button: e.button
      });
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      Interaction.keyDown({
        event: `key_down_${Date.now()}`,
        key: e.key
      });
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      Interaction.keyUp({
        event: `key_up_${Date.now()}`,
        key: e.key
      });
    }
  });
  window.addEventListener("resize", () => {
    const Scene2 = globalThis.Scene;
    if (Scene2) {
      Scene2.resize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }
  });
  console.log(`Event listeners setup complete (after ${retryCount} retries)`);
}
