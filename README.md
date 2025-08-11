# Sync-Physics: Concept Design for Physics and RL Simulations

This repo contains a collection of physics and RL simulations created to explore using Concept Design for building simulations.

We believe this is an important concept in the future of game engines and physics simulations as the environments become easier to create--and these environments are more an composition of well-designed independent concepts.

Part of 10 Aug 25 Sundai Hack: https://www.sundai.club/ 

## Considerations

Through building the physics simulations in this repository, we learned about structuring concepts to match the underlying dynamics of physical environments in place of a traditional data model. We came into challenges of separating the concerns of the concepts for modularity in some environments increased the latency of the syncs during simulation. 

Similarly, we found new ideas of Concepts through the shortcomings of the language models we were using to write Three.js and Python code, such as a Spatial Layout concept.

So moving forward when creating simulations or environments with concept design, one must design their concepts mindfully around the performance of the sync. The boundaries, state, and actions of each concept must be primarily shaped by the need to minimize communication overhead and manage synchronization delays between distributed or parallel processes. This may lead to different conceptual breakdowns than one would arrive at otherwise.

Ultimately, it seems like Concept Design is a great fit for building simulations especially as it creates an intelligibility between different environments: for example, when I want the same CfD environment simulations in Mujoco, Gazebo, and Unreal, it could be not too far off that I'm able to bundle well-articulated Concepts for each for an expression of the environment and simulation to be created. 

The simulations in this repo serve as case studies demonstrating our work.

<img width="1293" height="999" alt="pendulum" src="https://github.com/user-attachments/assets/6db00d8b-a52e-469a-9ca9-d6424c8150a0" />
<img width="1299" height="998" alt="cfd" src="https://github.com/user-attachments/assets/ba3d460b-9371-40f9-ad8c-3ccb48a802fa" />
<img width="1340" height="998" alt="anatomy" src="https://github.com/user-attachments/assets/4cbff6fb-b75d-4ca7-a910-5a6f9a852bf6" />
<img width="1697" height="998" alt="orbit" src="https://github.com/user-attachments/assets/e4272e62-6268-4af8-8b59-74d4c576b132" />
<img width="1364" height="997" alt="drone" src="https://github.com/user-attachments/assets/7740af73-7898-4be2-b632-cde5ab0bb443" />
