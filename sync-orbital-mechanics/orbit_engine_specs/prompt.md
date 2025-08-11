Initial Prompt
Carefully reason through, plan, and build the following: A complete working application for Orbit Engine, a real-time solar system simulator that visualizes planetary motion and calculates interplanetary transfer trajectories.

The application will use a Three.js frontend to render the 3D environment and a Python backend to perform realistic orbital mechanics calculations. The frontend and backend will communicate in real time via WebSockets.

Write .concept specifications for the core features under ./specs.

Write .py modules for the physics engine under ./api.

Write .js or .ts files for the Three.js frontend under ./client.

You may use any other structure to set up the full-stack application and WebSocket communication.

The specific requirements and views are as follows:

Main View (Solar System)
This is the primary interface, showing a view of the solar system with planets orbiting the Sun.

Actions:

Time Controls: Play, pause, and adjust the simulation speed (e.g., 1x, 10x, 100x).

Camera Controls: Pan, zoom, and rotate the view.

Select Body: Clicking on a planet or the Sun focuses the camera on it and displays key information (e.g., name, diameter, mass).

Plan Mission: A button that opens the Trajectory Planner view.

Navigation:

The default view upon loading the application.

Trajectory Planner View
This interface allows the user to calculate an optimal trajectory from Earth to another planet.

Actions:

Select Target: A dropdown menu to choose the destination planet.

Set Departure Window: Two date inputs to define a range of possible launch dates from Earth.

Calculate Transfer: A button that triggers the Python backend to calculate the optimal launch windows within the specified date range. The results should display:

Optimal Launch Date

Total Travel Time

Required launch energy, expressed as characteristic energy (C_3) or delta-v (
Deltav).

Launch Mission: Clicking on a calculated result visualizes that specific trajectory in the Main View.

Navigation:

Accessed by clicking the "Plan Mission" button in the Main View.

A "Back" or "Close" button should return the user to the Main View.

Mission View
This is not a separate page, but a state of the Main View after a mission has been "launched" from the planner.

Features:

Spacecraft Visualization: A small icon or model representing the spacecraft is added to the simulation.

Trajectory Path: The calculated interplanetary trajectory is drawn as a visible path from Earth's orbit to the target planet's orbit.

Mission Clock: A display shows the elapsed time since the mission's launch date.

The simulation animates the spacecraft moving along its path and the planets moving in their orbits.

Fixing Underspecification
The initial specification could lead to several issues. Here are some examples of iterative refinements to improve the model's accuracy and usability.

Original model uses a simplified 2-body simulation, leading to inaccurate trajectories.
The initial physics engine might only consider the gravitational pull between the Sun and a single planet (or spacecraft), ignoring the significant gravitational influence of other bodies like Jupiter. This makes the calculated trajectories and timings unrealistic for real mission planning.

Response:

I've upgraded the physics backend. The original implementation used a simple patched conic approximation. While fast, it ignores third-body perturbations.

What I changed:
- I replaced the simple 2-body solver in `api/simulations/engine.py` with a full n-body numerical integrator using libraries like `Poliastro` or `SPICEyPy`.
- The simulation now accounts for the gravitational pull of all major planets and the Sun when propagating the spacecraft's state vector (`position`, `velocity`).
- The WebSocket payload in `api/main.py` was updated to transmit these higher-fidelity state vectors for the spacecraft.

Impact:
The trajectories calculated and displayed are now significantly more accurate, reflecting the complex gravitational environment of the solar system.
The trajectory planner only calculates a single 'best' launch date, which is impractical.
A single optimal date is too rigid. Real mission planning requires understanding the trade-offs across a range of dates. A slightly later launch might be nearly as efficient and offer more flexibility.

Response:

I've enhanced the Trajectory Planner to provide a more comprehensive overview of the launch opportunities.

What I changed:
- The backend function in `api/simulations/engine.py` no longer returns a single date. It now generates data for a **Porkchop Plot**. This plot visualizes key metrics (like C₃ energy and travel time) across a 2D grid of departure and arrival dates.
- The frontend in `client/src/views/Simulator.js` now renders this data as an interactive contour plot. Colors or contour lines represent the required launch energy.
- Users can click anywhere on the Porkchop Plot to select a specific departure/arrival date combination, and the UI will update with the corresponding travel time and energy requirements.

Impact:
Mission planners can now visualize the entire launch window, allowing them to make informed trade-offs between launch date, travel duration, and fuel efficiency.
The real-time n-body simulation is too slow, causing the frontend to stutter.
Running a high-fidelity n-body simulation for all planets and the spacecraft in real-time is computationally expensive and can overwhelm the backend, leading to choppy animations in the Three.js frontend as it waits for WebSocket updates.

Response:

I've optimized the simulation loop to ensure a smooth frontend experience without sacrificing physics accuracy.

What I changed:
- **Backend (`api/simulations/engine.py`):** The backend now pre-calculates planetary positions for a long duration (e.g., several years) using a high-precision ephemeris model. This data is sent to the frontend as a large, one-time package upon connection. The expensive n-body integration is now only performed for the active spacecraft, not for the planets on every tick.
- **Frontend (`client/src/views/Simulator.jsx`):** The frontend stores the pre-calculated planetary ephemerides. It uses interpolation to calculate the positions of planets between frames, resulting in perfectly smooth orbits. It only relies on the WebSocket stream for the state vector of the spacecraft.
- **Sync (`api/main.py`):** The WebSocket no longer streams all planetary positions every few milliseconds. It sends the ephemeris data once, and then only provides a high-frequency stream for the spacecraft's data.

Impact:
The frontend animation is now decoupled from the backend's heavy computation, ensuring a smooth 60 FPS visualization, while the spacecraft's trajectory remains physically accurate.