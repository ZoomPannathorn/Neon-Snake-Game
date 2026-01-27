Introduction
Currently, computer vision technology is a key driver transforming user experiences in the gaming and interactive software industries. Neon Snake Game is a project aimed at developing a fun and accessible web-based snake game. It utilizes hand tracking via MediaPipe Hands and facial recognition with face-api.js, allowing players to control the snake's direction by pointing their fingers directly within the game. It also includes a Face Yoga Challenge where players pose using the camera. The system is designed with special features such as an electric orb, achievements, and real-time statistics to promote both challenge and learning simultaneously.

Development structure and work processes
The Neon Snake Game project uses the SDLC development process, covering analysis, design, development, testing, and evaluation. The system is divided into three main parts:
1. Hand/Face Gesture Detection: Uses MediaPipe Hands to detect finger positions for directional control and a face-api.js file for the Face Yoga Challenge.
2. Game Mechanics and Features: Developed a game loop to control the snake, food, and electric orb, along with an achievement and level-up system to increase the challenge.
3. Interface and Statistics: Designed a neon-style UI/UX, displaying real-time scores and gameplay results, along with a system for recording player data for analysis and further development.

Tools and technology
Development Language and Tools: HTML5, CSS3, JavaScript, and WebGL/Canvas are used for the structure, styling, and real-time rendering of the game.
Core Technologies:
1. MediaPipe Hands for detecting 21 hand gestures.
2. face-api.js for detecting face landmarks in the Face Yoga Challenge.
3. Supplementary Framework/Library: TailwindCSS, Orbitron/Exo2 fonts, and Web Audio API for sound and effects.
4. Platform: Compatible with PCs that have a webcam and Chrome, Firefox, or Edge browsers.
5. Core File Structure: index.html, style.css, script.js, /weights/ and /picture/ folders.
