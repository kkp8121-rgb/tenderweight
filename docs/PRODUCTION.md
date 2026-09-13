# Production decisions

## Selection

The preceding games explored a rewind platformer, illustrated 3D party RPG, cooking rhythm, 3D delivery racing, memory-pawn deck management, and first-person supernatural stealth. Candidate ritual fencing would repeat recent timing emphasis; acoustic exploration would repeat perception-driven heist structure. TENDERWEIGHT instead combines spatial construction with continuous two-axis physical ballast control, a fixed elevated frontal camera, sequential rescue storms, and population capacity as the objective.

## Theme and player fantasy

Care has weight. Every arriving person changes the boat's mass and moment while walking to a shelter. Adding shelter creates both capacity and weight; pontoon placement adds buoyancy and an opposing moment; pumps counter accumulated flooding. Preparing the village and surviving the storm are two phases of one physical system. Mira is an original adult rescue engineer, age 30. The image direction and miniature models use warm coral, sea-glass teal, navy framing and yellow engineering equipment.

## Scope and readability

Three voyages contain eight storms and 340 seconds of storm time, plus construction and repair phases. Rescues total 10, 18 and 24. Standard and gentle modes share authored content; gentle reduces complete wind forces and flood gain. The first boat already has sufficient shelter so the player can start immediately. Later voyages require deliberate capacity expansion. Stable completed records and settings are saved, not an unfinished simulation.

The camera keeps screen-right as +X and the far deck edge as -Z. A roof-clearing overhead gantry allows the physical ballast to move across the entire working area. Raised shelters allow small residents to walk beneath them. Models inherit the exact boat pitch, roll and freeboard, while the sea stays horizontal. Construction can be performed with keyboard, mouse or touch; storms use continuous directional input and optional fine control.

## Implementation and release

The deterministic engine has no DOM, Three.js or audio dependencies. Rendering does not drive the simulation. The app uses fixed steps, queues events once, copies inspection state and pauses inputs/time/audio when hidden. Three.js is bundled into a classic IIFE, with relative assets and no network dependency. Software rendering and physical GPU results are measured separately; package entries are verified by SHA-256 against the actual release files.

Public repository: `kkp8121-rgb/tenderweight`. A push and GitHub Pages deployment require the user's approval for that specific push. A created empty repository is not a deployment.
