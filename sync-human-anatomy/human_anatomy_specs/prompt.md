Initial Prompt

Interactive Human Anatomy Simulation

Carefully reason through, plan, and build the following: A complete working application for Anatome, an interactive 3D human anatomy viewer with real-time physiological simulations.

The application will feature a three.js frontend to render the 3D anatomy models and a FastAPI Python backend to serve data and run physiological simulations, communicating via WebSockets.

Frontend Main View: The core user interface will be built in ./client/src/views/HumanAnatomy.jsx.

Backend Simulation Logic: The Python code controlling the simulations will reside in ./api/simulations/human_anatomy.py.

Industry-Standard Libraries: The backend simulation should leverage industry-standard Python libraries for scientific computing and modeling, such as NumPy for numerical data, SciPy for complex scientific algorithms, and libRoadRunner for running Systems Biology Markup Language (SBML) models.

Core Requirements
The application should visualize a 3D human model and allow users to interact with it and run basic physiological simulations.

1. Main 3D View (HumanAnatomy.jsx)
This is the central component where users interact with the anatomical model.

Initial State & Controls:

On load, the application should display a default view of the human body (e.g., the skeletal and circulatory systems).

Implement intuitive camera controls:

Orbit: Rotate the model by dragging the mouse.

Zoom: Zoom in and out using the mouse wheel.

Pan: Move the model across the screen (e.g., by right-clicking and dragging).

UI Panels:

Systems Panel: A UI menu with toggles to show/hide different anatomical systems (e.g., Skeletal, Muscular, Nervous, Circulatory, Digestive).

Information Panel: When a user clicks on a specific organ or part (e.g., the heart, a femur, the liver), this panel appears and displays its name and a brief functional description.

Simulation Panel: Provides buttons to start and stop backend-driven simulations.

2. Backend Simulation (human_anatomy.py)
This module manages the simulation logic and streams data to the frontend.

WebSocket Communication:

The backend establishes a WebSocket connection with the frontend to enable real-time, bidirectional communication.

The frontend sends messages to start/stop specific simulations (e.g., {"action": "start", "simulation": "heartbeat"}).

The backend runs the requested simulation and continuously streams data packets back to the frontend.

Example Simulations:

Heartbeat Simulation:

Backend: Generates a timed sequence of events representing the heart's electrical conduction (SA node → AV node → His-Purkinje system). It streams data like {"part": "sa_node", "status": "active"} followed by other parts in the correct sequence and timing.

Frontend: Receives the data and visually highlights the corresponding parts of the 3D heart model in sequence, simulating the wave of contraction. It could also plot a simplified ECG trace based on the data stream.

Nerve Impulse Simulation:

Backend: When a user selects a nerve pathway, the backend simulates the propagation of an action potential. It might calculate this using a simplified Hodgkin-Huxley model, where voltage V(t) changes over time. It sends packets like {"nerve_segment": "id_001", "voltage": -70}, {"nerve_segment": "id_002", "voltage": 30}, etc., along the nerve's path.

Frontend: Visualizes the impulse as a glowing pulse of light that travels along the selected 3D nerve path.

Fixing Underspecification
Here are some potential issues and how to proactively address them.

1. Initial Load Time and Performance
Problem: Loading a single, high-poly 3D model with all anatomical systems at once will be slow and resource-intensive, leading to a long initial load time and poor rendering performance (low FPS).

Solution:

Progressive & On-Demand Loading: Load a low-resolution base model first for a fast initial view. Then, asynchronously load high-resolution models for individual systems only when the user selects them via the UI toggle.

Mesh Compression: Use glTF with Draco compression (.glb format) for the 3D models to significantly reduce file sizes and GPU memory usage.

2. Jerky or Unsynchronized Animations
Problem: The backend simulation might run at a different rate than the frontend's render loop (requestAnimationFrame). If the frontend simply visualizes data packets as they arrive, the animation will appear jerky and unsynchronized.

Solution:

Timestamping and Interpolation: The backend should timestamp every data packet it sends. The frontend will maintain a small buffer of these time-stamped states. In each render frame, it will calculate the ideal visual state by interpolating between the two nearest data points in the buffer, ensuring a smooth animation that is decoupled from the network latency or simulation rate.

3. Selecting Overlapping or Internal Objects
Problem: It's difficult for a user to select an internal organ like the heart when it's obscured by the ribcage and lungs. Simple raycasting will just hit the outermost object.

Solution:

Selective Transparency & Raycasting: When the user hovers over the model, make the outermost mesh layer semi-transparent to reveal the structures underneath.

Multi-Hit Raycasting: Modify the click handler to not stop at the first object hit. Instead, get a list of all objects along the ray's path and present the user with a small context menu to choose which object they intended to select (e.g., "Select: Ribs or Lung?").