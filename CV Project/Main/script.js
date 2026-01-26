// Configuration object
const defaultConfig = {
  game_title: "🐍 Neon Snake Game",
  player_name: "Player",
  background_color: "#0a0a0a",
  snake_color: "#00ffff",
  food_color: "#ff00ff",
  border_color: "#ffff00",
  text_color: "#ffffff"
};

// ตัวแปรเกม
let canvas, ctx;
let snake = [{x: 200, y: 200}]; // งูเริ่มต้นที่ตำแหน่ง 200,200
let direction = {x: 0, y: 0}; // ทิศทางเริ่มต้น (ไม่เคลื่อนที่)
let food = {x: 0, y: 0}; // อาหาร
let score = 0; // คะแนนปัจจุบัน
let highScore = 0; // คะแนนสูงสุด
let gameRunning = false; // สถานะการทำงานของเกม
let gamePaused = false; // สถานะหยุดชั่วคราว
let gameLoop; // ตัวแปรเก็บ interval ของเกมลูป
let currentRecords = []; // เก็บประวัติการเล่น

// ตัวแปรระบบเลเวล
let currentLevel = 1; // เลเวลปัจจุบัน
let foodCollected = 0; // จำนวนอาหารที่เก็บได้
let foodPerLevel = 10; // จำนวนอาหารที่ต้องเก็บเพื่อเลเวลอัพ
let gameSpeed = 150; // ความเร็วเกม (มิลลิวินาที)

// ตัวแปรลูกบอลไฟฟ้า (สิ่งกีดขวาง)
let electricOrb = {
  x: 0,
  y: 0,
  active: false
};

// การตั้งค่าความยาก
let difficulty = 'medium'; // 'easy' | 'medium' | 'hard'
let electricOrbChance = 0.3; // โอกาสที่ลูกบอลไฟฟ้าจะปรากฏหลังจากกินอาหาร

// ตั้งค่าพารามิเตอร์พื้นฐานตามระดับความยาก
function setDifficulty(level) {
  difficulty = level;
  switch (level) {
    case 'easy':
      gameSpeed = 180; // ช้าลง
      foodPerLevel = 8; // ต้องการอาหารน้อยลงเพื่อเลเวลอัพ
      electricOrbChance = 0.15; // สิ่งกีดขวางน้อยลง
      break;
    case 'hard':
      gameSpeed = 100; // เร็วขึ้น
      foodPerLevel = 12; // ต้องการอาหารมากขึ้นเพื่อเลเวลอัพ
      electricOrbChance = 0.45; // สิ่งกีดขวางมากขึ้น
      break;
    case 'medium':
    default:
      gameSpeed = 140; // สมดุล
      foodPerLevel = 10;
      electricOrbChance = 0.3;
      break;
  }

  // อัพเดทการเลือกใน UI
  try {
    const elEasy = document.getElementById('diffEasy');
    const elMed = document.getElementById('diffMedium');
    const elHard = document.getElementById('diffHard');
    if (elEasy && elMed && elHard) {
      elEasy.style.boxShadow = level === 'easy' ? '0 0 12px rgba(34,197,94,0.6)' : 'none';
      elMed.style.boxShadow = level === 'medium' ? '0 0 12px rgba(59,130,246,0.6)' : 'none';
      elHard.style.boxShadow = level === 'hard' ? '0 0 12px rgba(239,68,68,0.6)' : 'none';
    }
  } catch (e) {
    // ไม่ต้องทำอะไรถ้า DOM ยังไม่พร้อม
  }

  // ถ้าเกมกำลังทำงานอยู่ ให้รีสตาร์ทลูปด้วยความเร็วใหม่
  if (gameRunning && !gamePaused) {
    clearInterval(gameLoop);
    gameLoop = setInterval(updateGame, gameSpeed);
  }
}

// Audio context สำหรับเอฟเฟกต์เสียง
let audioContext;
let soundEnabled = true;

// ตัวแปรการติดตามมือ
let hands, camera, handCanvas, handCtx, faceCanvas, faceCtx;
let lastFingerPosition = {x: 0.5, y: 0.5};
let handTrackingActive = false;

// ตัวแปรสำหรับโหมดถ่ายภาพเปลี่ยนด่าน
let levelUpFaceDetection = null;
let currentLevelUpPose = null;
let levelUpCameraUtil = null;
let faceApiModelsLoaded = false;

// Data handler สำหรับ SDK
const dataHandler = {
  onDataChanged(data) {
    currentRecords = data;
    if (data.length > 0) {
      // หาคะแนนสูงสุด
      const scores = data.map(record => record.score || 0);
      highScore = Math.max(...scores);
      document.getElementById('highScore').textContent = highScore;
    }
  }
};

// ฟังก์ชันเอฟเฟกต์เสียง
function initAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.log("Audio not supported");
    soundEnabled = false;
  }
}

function playSound(frequency, duration, type = 'sine') {
  if (!soundEnabled || !audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.type = type;
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function playFoodSound() {
  // เสียงกินอาหาร - โน้ตเสียงสูงขึ้น
  playSound(523, 0.1); // C5
  setTimeout(() => playSound(659, 0.1), 50); // E5
  setTimeout(() => playSound(784, 0.1), 100); // G5
}

function playElectricSound() {
  // เสียงไฟฟ้า - เสียงรุนแรงและเตือน
  playSound(200, 0.2, 'sawtooth');
  setTimeout(() => playSound(150, 0.2, 'square'), 100);
}

function playLevelUpSound() {
  // เสียงชนะเลิศ
  playSound(523, 0.2); // C5
  setTimeout(() => playSound(659, 0.2), 100); // E5
  setTimeout(() => playSound(784, 0.2), 200); // G5
  setTimeout(() => playSound(1047, 0.3), 300); // C6
}

// เริ่มต้น SDK และเกม
async function initializeGame() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  handCanvas = document.getElementById('handCanvas');
  handCtx = handCanvas.getContext('2d');
  faceCanvas = document.getElementById('faceCanvas');
  faceCtx = faceCanvas ? faceCanvas.getContext('2d') : null;
  // ข้อความเริ่มต้นบนจอเล็ก
  showFaceSkeletonStatus("Face skeleton จะทำงานตอน Level Up");

  // เริ่มต้นเสียง
  initAudio();
  
  // เริ่มต้นการติดตามมือ
  await initializeHandTracking();
  
  if (window.dataSdk) {
    const initResult = await window.dataSdk.init(dataHandler);
    if (!initResult.isOk) {
      console.error("Failed to initialize data SDK");
    }
  }
  
  if (window.elementSdk) {
    await window.elementSdk.init({
      defaultConfig,
      onConfigChange: async (config) => {
        document.getElementById('gameTitle').textContent = config.game_title || defaultConfig.game_title;
        
        // ใช้สีกับ canvas และ UI
        const canvasElement = document.getElementById('gameCanvas');
        canvasElement.style.borderColor = config.border_color || defaultConfig.border_color;
        
        // อัพเดทพื้นหลัง body
        document.body.style.background = `linear-gradient(135deg, ${config.background_color || defaultConfig.background_color} 0%, #1a0a2e 50%, #16213e 100%)`;
      },
      mapToCapabilities: (config) => ({
        recolorables: [
          {
            get: () => config.background_color || defaultConfig.background_color,
            set: (value) => {
              if (window.elementSdk) {
                window.elementSdk.setConfig({ background_color: value });
              }
            }
          },
          {
            get: () => config.snake_color || defaultConfig.snake_color,
            set: (value) => {
              if (window.elementSdk) {
                window.elementSdk.setConfig({ snake_color: value });
              }
            }
          },
          {
            get: () => config.food_color || defaultConfig.food_color,
            set: (value) => {
              if (window.elementSdk) {
                window.elementSdk.setConfig({ food_color: value });
              }
            }
          },
          {
            get: () => config.border_color || defaultConfig.border_color,
            set: (value) => {
              if (window.elementSdk) {
                window.elementSdk.setConfig({ border_color: value });
              }
            }
          },
          {
            get: () => config.text_color || defaultConfig.text_color,
            set: (value) => {
              if (window.elementSdk) {
                window.elementSdk.setConfig({ text_color: value });
              }
            }
          }
        ],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
      }),
      mapToEditPanelValues: (config) => new Map([
        ["game_title", config.game_title || defaultConfig.game_title],
        ["player_name", config.player_name || defaultConfig.player_name]
      ])
    });
  }
  
    // ใช้ความยากเริ่มต้นก่อนสร้างไอเท็ม
    setDifficulty(difficulty);
    generateFood();
  setupKeyboardControls();
  setupMouseControls();
  setupTouchControls();
  drawGame();
}

// ฟังก์ชันแสดงสถานะโครงหน้า
function showFaceSkeletonStatus(message) {
  if (!faceCanvas || !faceCtx) return;
  faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
  faceCtx.fillStyle = '#ffff00';
  faceCtx.font = '12px Arial';
  faceCtx.textAlign = 'center';
  faceCtx.fillText(message, faceCanvas.width / 2, faceCanvas.height / 2);
  faceCtx.font = '24px Arial';
  faceCtx.fillText('🙂', faceCanvas.width / 2, faceCanvas.height / 2 - 30);
}

// เริ่มต้นการติดตามมือ
async function initializeHandTracking() {
  if (typeof Hands === 'undefined') {
    console.log("MediaPipe not loaded, using keyboard controls only");
    showHandTrackingStatus("MediaPipe not available - Using keyboard controls");
    return;
  }

  try {
    hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults(onHandResults);

    const videoElement = document.getElementById('videoElement');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 220 },
          height: { ideal: 165 },
          facingMode: "user" 
        } 
      });
      videoElement.srcObject = stream;
      
      camera = new Camera(videoElement, {
        onFrame: async () => {
          if (handTrackingActive && gameRunning && !gamePaused) {
            try {
              await hands.send({image: videoElement});
            } catch (error) {
              console.error("Error sending frame to hands model:", error);
            }
          }
        },
        width: 220,
        height: 165
      });
      
      handTrackingActive = true;
      console.log("Hand tracking initialized successfully");
      showHandTrackingStatus("Hand tracking active - Point your finger!");
      
    } catch (error) {
      console.log("Camera access denied, using keyboard controls only");
      showHandTrackingStatus("Camera denied - Using keyboard controls");
    }
  } catch (error) {
    console.error("Error initializing MediaPipe Hands:", error);
    showHandTrackingStatus("Hand tracking failed - Using keyboard controls");
  }
}

// ฟังก์ชันแสดงสถานะการติดตามมือ
function showHandTrackingStatus(message) {
  const handCanvas = document.getElementById('handCanvas');
  const ctx = handCanvas.getContext('2d');
  
  // ล้าง canvas
  ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  
  // วาดข้อความสถานะ
  ctx.fillStyle = '#ffff00';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(message, handCanvas.width / 2, handCanvas.height / 2);
  
  // วาดไอคอนมือ
  ctx.font = '24px Arial';
  ctx.fillText('🖐️', handCanvas.width / 2, handCanvas.height / 2 - 30);
}

// ตั้งค่าระบบควบคุมด้วยเมาส์เป็น fallback
function setupMouseControls() {
  const gameCanvas = document.getElementById('gameCanvas');
  
  gameCanvas.addEventListener('mousemove', (e) => {
    if (!gameRunning || gamePaused || handTrackingActive) return;
    
    const rect = gameCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    controlSnakeWithMouse(mouseX, mouseY);
  });
  
  gameCanvas.addEventListener('click', (e) => {
    if (!gameRunning || gamePaused) return;
    
    // เริ่มเคลื่อนที่เมื่อคลิก (ถ้ายังไม่เคลื่อนที่)
    if (direction.x === 0 && direction.y === 0) {
      changeDirection('right'); // เริ่มเคลื่อนที่ไปทางขวา
    }
  });
}

// ควบคุมงูด้วยเมาส์
function controlSnakeWithMouse(mouseX, mouseY) {
  if (direction.x === 0 && direction.y === 0) return; // ยังไม่เริ่มเคลื่อนที่
  
  const head = snake[0];
  const centerX = head.x + 10; // ศูนย์กลางหัวงู
  const centerY = head.y + 10;
  
  const deltaX = mouseX - centerX;
  const deltaY = mouseY - centerY;
  
  // กำหนดทิศทางตามตำแหน่งเมาส์
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // การเคลื่อนที่ในแนวนอน
    if (deltaX > 20 && direction.x === 0) { // threshold 20 pixels
      changeDirection('right');
    } else if (deltaX < -20 && direction.x === 0) {
      changeDirection('left');
    }
  } else {
    // การเคลื่อนที่ในแนวตั้ง
    if (deltaY > 20 && direction.y === 0) {
      changeDirection('down');
    } else if (deltaY < -20 && direction.y === 0) {
      changeDirection('up');
    }
  }
}

// ตั้งค่าระบบควบคุมด้วย Touch สำหรับมือถือ
function setupTouchControls() {
  const gameCanvas = document.getElementById('gameCanvas');
  
  gameCanvas.addEventListener('touchstart', (e) => {
    if (!gameRunning || gamePaused) return;
    e.preventDefault();
    
    // เริ่มเคลื่อนที่เมื่อแตะ (ถ้ายังไม่เคลื่อนที่)
    if (direction.x === 0 && direction.y === 0) {
      changeDirection('right');
    }
  });
  
  gameCanvas.addEventListener('touchmove', (e) => {
    if (!gameRunning || gamePaused || handTrackingActive) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = gameCanvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    controlSnakeWithMouse(touchX, touchY);
  });
}

// ฟังก์ชันลองเริ่มต้นการติดตามมือใหม่
async function retryHandTracking() {
  if (camera) {
    camera.stop();
  }
  
  const videoElement = document.getElementById('videoElement');
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
  }
  
  showHandTrackingStatus("Retrying hand tracking...");
  
  // รอสักครู่แล้วลองใหม่
  setTimeout(async () => {
    try {
      await initializeHandTracking();
    } catch (error) {
      console.error("Failed to retry hand tracking:", error);
      showHandTrackingStatus("Hand tracking unavailable - Use mouse/keyboard");
    }
  }, 1000);
}

// ตัวจัดการผลลัพธ์การติดตามมือ
function onHandResults(results) {
  if (!handCtx || !handCanvas) return;
  
  // ล้าง canvas มือ
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  
  // วาดข้อความสถานะ
  handCtx.fillStyle = '#00ffff';
  handCtx.font = '12px Arial';
  handCtx.textAlign = 'center';
  
  try {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // วาดจุดสังเกตมือ
      if (typeof drawConnectors !== 'undefined' && typeof drawLandmarks !== 'undefined') {
        drawConnectors(handCtx, landmarks, HAND_CONNECTIONS, {color: '#00ffff', lineWidth: 2});
        drawLandmarks(handCtx, landmarks, {color: '#ff00ff', lineWidth: 1, radius: 3});
      } else {
        // Fallback: วาดจุด landmarks เอง
        drawCustomHandLandmarks(handCtx, landmarks);
      }
      
      // รับตำแหน่งปลายนิ้วชี้ (landmark 8)
      const indexFingerTip = landmarks[8];
      
      // อัพเดทตำแหน่งนิ้ว
      lastFingerPosition = {
        x: indexFingerTip.x,
        y: indexFingerTip.y
      };
      
      // วาดตัวบ่งชี้ตำแหน่งนิ้ว
      handCtx.fillStyle = '#ffff00';
      handCtx.beginPath();
      handCtx.arc(
        indexFingerTip.x * handCanvas.width,
        indexFingerTip.y * handCanvas.height,
        8, 0, 2 * Math.PI
      );
      handCtx.fill();
      
      // วาดสถานะ
      handCtx.fillStyle = '#00ff00';
      handCtx.fillText('Hand Detected ✓', handCanvas.width / 2, 20);
      
      // ควบคุมงูตามตำแหน่งนิ้ว
      if (gameRunning && !gamePaused) {
        controlSnakeWithFinger(indexFingerTip);
      }
    } else {
      // ไม่พบมือ
      handCtx.fillStyle = '#ffff00';
      handCtx.fillText('Show your hand to camera', handCanvas.width / 2, handCanvas.height / 2 - 10);
      handCtx.fillText('Use mouse/keyboard/buttons', handCanvas.width / 2, handCanvas.height / 2 + 10);
    }
  } catch (error) {
    console.error("Error in hand results handler:", error);
    handCtx.fillStyle = '#ff0000';
    handCtx.fillText('Hand tracking error', handCanvas.width / 2, handCanvas.height / 2);
    handCtx.fillText('Using fallback controls', handCanvas.width / 2, handCanvas.height / 2 + 15);
  }
}

// ฟังก์ชัน fallback สำหรับวาด hand landmarks
function drawCustomHandLandmarks(ctx, landmarks) {
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#ff00ff';

  for (const landmark of landmarks) {
    ctx.beginPath();
    ctx.arc(
      landmark.x * ctx.canvas.width,
      landmark.y * ctx.canvas.height,
      3, 0, 2 * Math.PI
    );
    ctx.fill();
  }
  ctx.beginPath();
  for (let i = 0; i < landmarks.length - 1; i++) {
    if (i % 4 === 0) {
      const current = landmarks[i];
      const next = landmarks[i + 1];
      ctx.moveTo(current.x * ctx.canvas.width, current.y * ctx.canvas.height);
      ctx.lineTo(next.x * ctx.canvas.width, next.y * ctx.canvas.height);
    }
  }
  ctx.stroke();
}

// ควบคุมงูด้วยตำแหน่งนิ้ว
function controlSnakeWithFinger(fingerTip) {
  const centerX = 0.5;
  const centerY = 0.5;
  const threshold = 0.15; // ความไวที่ปรับแล้ว
  
  const deltaX = fingerTip.x - centerX;
  const deltaY = fingerTip.y - centerY;
  
  // กำหนดทิศทางตามตำแหน่งนิ้วเทียบกับศูนย์กลาง
  // การแมปทิศทางที่แก้ไขแล้ว - ตอนนี้ตรงกับความคาดหวังทางภาพ
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // การเคลื่อนที่ในแนวนอน - FIXED: left/right mapping
    if (deltaX > threshold && direction.x === 0) {
      changeDirection('left'); // ชี้นิ้วไปทางขวา = เคลื่อนที่ไปทางซ้าย (เหมือนกล้องเซลฟี่)
    } else if (deltaX < -threshold && direction.x === 0) {
      changeDirection('right'); // ชี้นิ้วไปทางซ้าย = เคลื่อนที่ไปทางขวา
    }
  } else {
    // การเคลื่อนที่ในแนวตั้ง
    if (deltaY > threshold && direction.y === 0) {
      changeDirection('down'); // ชี้ลง = เคลื่อนที่ลง
    } else if (deltaY < -threshold && direction.y === 0) {
      changeDirection('up'); // ชี้ขึ้น = เคลื่อนที่ขึ้น
    }
  }
}

function setupKeyboardControls() {
  const isTypingTarget = (el) =>
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;

  document.addEventListener('keydown', (e) => {
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (arrows.includes(e.key) && !isTypingTarget(e.target)) {
      e.preventDefault();
    }
    if (!gameRunning || gamePaused) return;
    
    switch(e.key) {
      case 'ArrowUp':
        if (direction.y === 0) changeDirection('up');
        break;
      case 'ArrowDown':
        if (direction.y === 0) changeDirection('down');
        break;
      case 'ArrowLeft':
        if (direction.x === 0) changeDirection('left');
        break;
      case 'ArrowRight':
        if (direction.x === 0) changeDirection('right');
        break;
    }
  });
}

function changeDirection(dir) {
  if (!gameRunning || gamePaused) return;
  
  switch(dir) {
    case 'up':
      if (direction.y === 0) direction = {x: 0, y: -20};
      break;
    case 'down':
      if (direction.y === 0) direction = {x: 0, y: 20};
      break;
    case 'left':
      if (direction.x === 0) direction = {x: -20, y: 0};
      break;
    case 'right':
      if (direction.x === 0) direction = {x: 20, y: 0};
      break;
  }
}

function generateFood() {
  food = {
    x: Math.floor(Math.random() * (canvas.width / 20)) * 20,
    y: Math.floor(Math.random() * (canvas.height / 20)) * 20
  };
  for (let segment of snake) {
    if (segment.x === food.x && segment.y === food.y) {
      generateFood();
      return;
    }
  }
}

function generateElectricOrb() {
  if (currentLevel < 2 || Math.random() > electricOrbChance) {
    electricOrb.active = false;
    return;
  }
  electricOrb = {
    x: Math.floor(Math.random() * (canvas.width / 20)) * 20,
    y: Math.floor(Math.random() * (canvas.height / 20)) * 20,
    active: true
  };
  for (let segment of snake) {
    if (segment.x === electricOrb.x && segment.y === electricOrb.y) {
      generateElectricOrb();
      return;
    }
  }
  if (electricOrb.x === food.x && electricOrb.y === food.y) {
    generateElectricOrb();
    return;
  }
}

// ฟังก์ชันวาดพื้นหลังแบบตาราง
function drawGridBackground() {
  const gridSize = 20; // ขนาดช่องตารางเท่ากับขนาดของงู
  const gridColor = 'rgba(0, 255, 255, 0.1)';
  const gridLineWidth = 1;
  
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = gridLineWidth;
  
  // วาดเส้นแนวตั้ง
  for (let x = 0; x <= canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  // วาดเส้นแนวนอน
  for (let y = 0; y <= canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // วาดจุดที่มุมตาราง (optional)
  ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
  for (let x = 0; x <= canvas.width; x += gridSize) {
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

function drawGame() {
  // ล้าง canvas
  ctx.fillStyle = window.elementSdk?.config?.background_color || defaultConfig.background_color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // วาดพื้นหลังแบบตาราง
  drawGridBackground();
  
  // วาดงูด้วยส่วนวงกลมและตา
  ctx.fillStyle = window.elementSdk?.config?.snake_color || defaultConfig.snake_color;
  ctx.shadowColor = window.elementSdk?.config?.snake_color || defaultConfig.snake_color;
  ctx.shadowBlur = 10;
  
  for (let i = 0; i < snake.length; i++) {
    const segment = snake[i];
    const radius = i === 0 ? 12 : 9; // หัวใหญ่กว่าลำตัว
    
    ctx.beginPath();
    ctx.arc(segment.x + 10, segment.y + 10, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    // วาดตาบนหัว
    if (i === 0) {
      ctx.fillStyle = '#000000';
      ctx.shadowBlur = 0;
      
      // ตำแหน่งตาตามทิศทาง
      if (direction.x > 0) { // เคลื่อนที่ไปทางขวา
        ctx.beginPath();
        ctx.arc(segment.x + 15, segment.y + 7, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(segment.x + 15, segment.y + 13, 2, 0, 2 * Math.PI);
        ctx.fill();
      } else if (direction.x < 0) { // เคลื่อนที่ไปทางซ้าย
        ctx.beginPath();
        ctx.arc(segment.x + 5, segment.y + 7, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(segment.x + 5, segment.y + 13, 2, 0, 2 * Math.PI);
        ctx.fill();
      } else if (direction.y > 0) { // เคลื่อนที่ลง
        ctx.beginPath();
        ctx.arc(segment.x + 7, segment.y + 15, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(segment.x + 13, segment.y + 15, 2, 0, 2 * Math.PI);
        ctx.fill();
      } else if (direction.y < 0) { // เคลื่อนที่ขึ้น
        ctx.beginPath();
        ctx.arc(segment.x + 7, segment.y + 5, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(segment.x + 13, segment.y + 5, 2, 0, 2 * Math.PI);
        ctx.fill();
      } else { // ไม่เคลื่อนที่ - ตาเริ่มต้น
        ctx.beginPath();
        ctx.arc(segment.x + 7, segment.y + 7, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(segment.x + 13, segment.y + 7, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      ctx.fillStyle = window.elementSdk?.config?.snake_color || defaultConfig.snake_color;
      ctx.shadowBlur = 10;
    }
  }
  
  // วาดอาหารเป็นเพชรประกาย
  ctx.fillStyle = window.elementSdk?.config?.food_color || defaultConfig.food_color;
  ctx.shadowColor = window.elementSdk?.config?.food_color || defaultConfig.food_color;
  ctx.shadowBlur = 15;
  
  const foodCenterX = food.x + 10;
  const foodCenterY = food.y + 10;
  
  ctx.beginPath();
  ctx.moveTo(foodCenterX, foodCenterY - 8); // บน
  ctx.lineTo(foodCenterX + 8, foodCenterY); // ขวา
  ctx.lineTo(foodCenterX, foodCenterY + 8); // ล่าง
  ctx.lineTo(foodCenterX - 8, foodCenterY); // ซ้าย
  ctx.closePath();
  ctx.fill();
  
  // เพิ่มเอฟเฟกต์ประกาย
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(foodCenterX - 3, foodCenterY - 3, 1.5, 0, 2 * Math.PI);
  ctx.fill();
  
  // วาดลูกบอลไฟฟ้า (สิ่งกีดขวาง) ถ้ามี
  if (electricOrb.active) {
    // ลูกบอลไฟฟ้าพร้อมเอฟเฟกต์สายฟ้า
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    
    const orbCenterX = electricOrb.x + 10;
    const orbCenterY = electricOrb.y + 10;
    
    // ลูกบอลหลัก
    ctx.beginPath();
    ctx.arc(orbCenterX, orbCenterY, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // สายฟ้ารอบลูกบอล
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    
    const time = Date.now() * 0.01;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI * 2 / 6) + time;
      const startX = orbCenterX + Math.cos(angle) * 8;
      const startY = orbCenterY + Math.sin(angle) * 8;
      const endX = orbCenterX + Math.cos(angle) * 15;
      const endY = orbCenterY + Math.sin(angle) * 15;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    
    // สัญลักษณ์เตือนตรงกลาง
    ctx.fillStyle = '#ffff00';
    ctx.shadowBlur = 5;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', orbCenterX, orbCenterY + 4);
  }
  
  ctx.shadowBlur = 0;
}

function updateGame() {
  if (!gameRunning || gamePaused) return;
  
  // เคลื่อนที่เฉพาะเมื่อมีการกำหนดทิศทาง (ป้องกันเกมโอเวอร์เมื่อไม่มีอินพุต)
  if (direction.x === 0 && direction.y === 0) {
    drawGame(); // ยังคงวาดเกมแม้ไม่เคลื่อนที่
    return; // ไม่เคลื่อนที่ถ้าไม่มีการกำหนดทิศทาง
  }
  
  // เคลื่อนย้ายงู
  const head = {x: snake[0].x + direction.x, y: snake[0].y + direction.y};
  
  // การห่อหุ้มผนัง - งูทะลุผ่านผนังแทนที่จะตาย
  if (head.x < 0) {
    head.x = canvas.width - 20;
  } else if (head.x >= canvas.width) {
    head.x = 0;
  }
  
  if (head.y < 0) {
    head.y = canvas.height - 20;
  } else if (head.y >= canvas.height) {
    head.y = 0;
  }
  
  // ตรวจสอบการชนตัวเอง - ข้ามหัว (ดัชนี 0) เนื่องจากเรากำลังเปรียบเทียบกับตำแหน่งหัวใหม่
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      gameOver();
      return;
    }
  }
  
  snake.unshift(head);
  
  // ตรวจสอบการชนอาหาร
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    foodCollected++;
    
    // เล่นเอฟเฟกต์เสียงอาหาร
    playFoodSound();
    
    // อัพเดท UI
    document.getElementById('currentScore').textContent = score;
    document.getElementById('snakeLength').textContent = snake.length;
    document.getElementById('foodCount').textContent = foodCollected;
    
    // อัพเดทความคืบหน้าเลเวล
    const progress = (foodCollected % foodPerLevel) / foodPerLevel * 100;
    document.getElementById('levelProgress').style.width = progress + '%';
    
    // ตรวจสอบการเลเวลอัพ
    if (foodCollected % foodPerLevel === 0) {
      levelUp();
    } else {
      const remaining = foodPerLevel - (foodCollected % foodPerLevel);
      document.getElementById('progressText').textContent = `Collect ${remaining} more food to advance to Level ${currentLevel + 1}`;
    }
    
    generateFood();
    generateElectricOrb(); // สร้างลูกบอลไฟฟ้าหลังจากกินอาหาร
    
    // การตรวจสอบความสำเร็จ
    if (score === 50) {
      showAchievement("First Milestone!", "You scored 50 points!");
    } else if (score === 100) {
      showAchievement("Century!", "You reached 100 points!");
    } else if (score === 200) {
      showAchievement("Snake Master!", "200 points achieved!");
    }
  } 
  // ตรวจสอบการชนลูกบอลไฟฟ้า
  else if (electricOrb.active && head.x === electricOrb.x && head.y === electricOrb.y) {
    // เอฟเฟกต์ลูกบอลไฟฟ้า: เสีย 1 คะแนนและหดสั้นลง 1 ปล้อง
    score = Math.max(0, score - 1);
    
    // เล่นเอฟเฟกต์เสียงไฟฟ้า
    playElectricSound();
    
    // หดงูสั้นลง 1 ปล้องถ้าเป็นไปได้
    if (snake.length > 1) {
      snake.pop();
    }
    
    // อัพเดท UI
    document.getElementById('currentScore').textContent = score;
    document.getElementById('snakeLength').textContent = snake.length;
    
    // ปิดใช้งานลูกบอลไฟฟ้า
    electricOrb.active = false;
    
    // แสดงความสำเร็จเตือน
    showAchievement("⚡ Electric Shock!", "Lost 1 point and 1 segment!");
    
    // ไม่ทำให้งูยาวขึ้น (ไม่มี else clause)
  } else {
    snake.pop();
  }
  
  drawGame();
}

function levelUp() {
  currentLevel++;
  gameSpeed = Math.max(80, gameSpeed - 10); // เพิ่มความเร็ว ขั้นต่ำ 80ms
  
  // เล่นเสียงเลเวลอัพ
  playLevelUpSound();
  
  // อัพเดท UI
  document.getElementById('currentLevel').textContent = currentLevel;
  document.getElementById('levelProgress').style.width = '0%';
  document.getElementById('progressText').textContent = `Collect ${foodPerLevel} food to advance to Level ${currentLevel + 1}`;
  
  // แสดงโหมดถ่ายภาพแทนการแจ้งเตือนแบบเดิม
  showPoseChallengeForLevelUp();
  
  // รีสตาร์ทเกมลูปด้วยความเร็วใหม่หลังจากผู้เล่นผ่านโหมดถ่ายภาพ
  // (จะเริ่มใหม่หลังจากผู้เล่นผ่านโหมดถ่ายภาพ)
}

// ฟังก์ชันแสดงโหมดถ่ายภาพตอนเปลี่ยนด่าน
async function showPoseChallengeForLevelUp() {
  // หยุดเกมชั่วคราว
  gamePaused = true;
  clearInterval(gameLoop);
  
  // สุ่มเลือกรูปสำหรับด่านนี้
  const levelPoses = [
    {
      image: "picture/ท่าที่1.png",
      description: "ทำตาให้โตที่สุด เปิดให้เห็นตาขาวให้มากๆ ท่านี้ช่วยออกกำลังกายดวงตา และหน้าผาก ป้องกันริ้วร้อยช่วงหน้าผากด้วย",
      requiredSimilarity: 70
    },
    {
      image: "picture/ท่าที่2.png",
      description: "หายใจเข้านำอากาศเก็บไว้ในกระพุ้งแก้มให้พองที่สุด กล้ามเนื้อแก้มของคุณจะแข็งแรงขึ้น ช่วยให้แก้มเต่งตึง",
      requiredSimilarity: 75
    },
    {
      image: "picture/ท่าที่3.png",
      description: "ดูดกระพุ้งแก้มเข้าไปด้านในและทำปากยื่นออกมา ทำประมาณห้าครั้ง ช่วยกระชับริมฝีปาก และแก้ม",
      requiredSimilarity: 65
    },
    {
      image: "picture/ท่าที่4.png",
      description: "อมริมฝีปากทั้งบนและล่างเข้าไปในปากจนมิดชิด ในขณะที่ยังซ่อนริมฝีปากอยู่ ให้ยืดมุมปากทั้งสองข้างออกไปทางซ้ายและขวาให้กว้างที่สุด เหมือนคุณกำลัง ยิ้ม โดยไม่ให้เห็นริมฝีปาก",
      requiredSimilarity: 70
    },
    {
      image: "picture/ท่าที่5.png",
      description: "อ้าปากเป็นรูปตัว O ให้กว้างที่สุด ค้างไว้ 5 วินาที ท่านี้ช่วยบริหารกล้ามเนื้อรอบปากและคาง ลดเหนียงใต้คาง",
      requiredSimilarity: 80
    },
    {
      image: "picture/ท่าที่6.png",
      description: "ใช้นิ้วชี้และนิ้วกลางยกผิวบริเวณหางคิ้วขึ้น",
      requiredSimilarity: 70
    },
    {
      image: "picture/ท่าที่7.png",
      description: "ใช้นิ้วชี้ดันมุมปากทั้งสองข้างให้ยืดออก (เหมือนยิ้มกว้างๆ)",
      requiredSimilarity: 75
    },
    {
      image: "picture/ท่าที่8.png",
      description: "วางนิ้วมือทั้งสองข้างทาบลงบนหน้าผาก (พยายามอย่าเลิกคิ้ว!)",
      requiredSimilarity: 65
    },
    {
      image: "picture/ท่าที่9.png",
      description: "เอียงศีรษะไปด้านข้าง ใช้มือวางบนศีรษะเพื่อช่วยยืดกล้ามเนื้อคอ (หลับตาผ่อนคลาย)",
      requiredSimilarity: 60
    },
    {
      image: "picture/ท่าที่10.png",
      description: "ใช้ข้อนิ้วทั้งสองข้างนวดบริเวณใต้คางและแนวกราม (หลับตาผ่อนคลาย)",
      requiredSimilarity: 65
    }
  ];
  
  // สุ่มเลือกรูปตามด่าน (ใช้ด่านปัจจุบันเป็น seed)
  const poseIndex = (currentLevel - 2) % levelPoses.length;
  const currentPose = levelPoses[poseIndex];
  
  // แสดง modal พิเศษสำหรับเปลี่ยนด่าน
  showLevelUpPoseChallenge(currentPose);
  
  // แสดงสถานะเริ่มต้นในจอเล็ก
  showLevelUpMiniFaceStatus("Starting Level-Up camera...");
}

// แสดง modal โหมดถ่ายภาพสำหรับเปลี่ยนด่าน
function showLevelUpPoseChallenge(pose) {
  // สร้าง modal พิเศษสำหรับเปลี่ยนด่าน
  const modalHTML = `
    <div id="levelUpPoseModal" style="display: block; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 2000; padding: 20px; overflow-y: auto;">
      <div style="max-width: 900px; margin: 0 auto; background: linear-gradient(135deg, rgba(0, 100, 200, 0.9), rgba(200, 0, 100, 0.9)); border-radius: 20px; padding: 30px; border: 3px solid #00ffff; box-shadow: 0 0 40px rgba(0, 255, 255, 0.5);">
        
        <!-- Header พิเศษสำหรับเปลี่ยนด่าน -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="font-family: 'Orbitron', monospace; font-size: 3rem; color: #00ffff; text-shadow: 0 0 20px #00ffff; margin-bottom: 10px;">
            🎉 LEVEL ${currentLevel} UNLOCKED! 🎉
          </div>
          <div style="font-size: 1.5rem; color: #ffff00; margin-bottom: 20px;">
            Complete the pose challenge to continue!
          </div>
          <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #ffff00;">
            <p style="color: #ffffff; margin: 0; font-size: 1.1rem;">
              <strong>🎯 Mission:</strong> Copy the pose below to advance to Level ${currentLevel}
            </p>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px;">
          <!-- ภาพตัวอย่าง -->
          <div style="text-align: center;">
            <h3 style="color: #ffff00; margin-bottom: 15px; font-family: 'Orbitron', monospace;">🎯 TARGET POSE</h3>
            <img src="${pose.image}" alt="Pose Example" style="max-width: 100%; border: 3px solid #ffff00; border-radius: 15px; box-shadow: 0 0 25px rgba(255, 255, 0, 0.5);">
            <p style="color: #cccccc; margin-top: 15px; font-size: 1.2rem; background: rgba(255,255,0,0.1); padding: 10px; border-radius: 8px;">
              ${pose.description}
            </p>
            <div style="margin-top: 15px; padding: 10px; background: rgba(255,0,0,0.1); border-radius: 8px; border-left: 3px solid #ff0000;">
              <p style="color: #ff9999; margin: 0; font-size: 0.9rem;">
                <strong>⚠️ Requirement:</strong> Need ${pose.requiredSimilarity}% similarity to continue
              </p>
            </div>
          </div>
          
          <!-- กล้องผู้เล่น -->
          <div style="text-align: center;">
            <h3 style="color: #00ffff; margin-bottom: 15px; font-family: 'Orbitron', monospace;">📸 YOUR CAMERA</h3>
            <div style="position: relative; background: #000; border-radius: 15px; overflow: hidden;">
              <video id="levelUpVideoElement" autoplay muted playsinline style="border: 3px solid #00ffff; border-radius: 15px; width: 100%; height: auto;"></video>
              <canvas id="levelUpPoseCanvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
            </div>

            <!-- Mini Face Skeleton -->
            <div style="height: 12px;"></div>
            <div style="position: relative; background: #000; border-radius: 15px; overflow: hidden;">
              <canvas id="levelUpFaceCanvasMini" width="320" height="220"
        style="border: 2px solid #ffff00; border-radius: 10px; 
               background: rgba(0,0,0,0.55); 
               width: 100%; height: auto; display: block;">
</canvas>
              <div style="position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,0.75); color: #ffff00; padding: 4px 8px; border-radius: 6px; font-size: 12px;">
                Face Skeleton (Mini)
              </div>
            </div>

            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
              <button class="btn" onclick="initLevelUpCamera()" style="background: linear-gradient(45deg, #0080ff, #00ffff);">
                📷 Start Camera
              </button>
              <button class="btn" onclick="retryLevelUpPose()" style="background: linear-gradient(45deg, #ffff00, #ff8000);">
                🔄 Try Again
              </button>
            </div>
          </div>
        </div>
        
        <!-- คะแนนและความคืบหน้า -->
        <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="color: #cccccc; font-size: 1.1rem;">Similarity Score:</span>
            <span id="levelUpSimilarityScore" style="color: #00ff00; font-weight: bold; font-size: 1.3rem; font-family: 'Orbitron', monospace;">0%</span>
          </div>
          <div class="level-progress">
            <div class="level-fill" id="levelUpPoseProgress" style="width: 0%; background: linear-gradient(90deg, #ff00ff, #ffff00);"></div>
          </div>
          <p id="levelUpPoseFeedback" style="text-align: center; color: #cccccc; margin-top: 10px; font-size: 1.1rem;">
            Get ready to copy the pose! Click "Start Camera" to begin.
          </p>
        </div>
        
        <!-- ปุ่มควบคุม -->
        <div style="display: flex; justify-content: center; gap: 20px;">
          <button class="btn btn-primary" onclick="captureLevelUpPose()" id="levelUpCaptureBtn" disabled style="padding: 15px 30px; font-size: 1.2rem;">
            🚀 CAPTURE & CONTINUE
          </button>
          <button class="btn" onclick="skipPoseChallenge()" style="background: linear-gradient(45deg, #ff0000, #ff8000); padding: 15px 30px; font-size: 1.2rem;">
            ⏩ Skip Challenge
          </button>
        </div>
        
        <!-- ข้อความแนะนำ -->
        <div style="text-align: center; margin-top: 25px; padding: 15px; background: rgba(0,255,255,0.1); border-radius: 10px;">
          <p style="color: #00ffff; margin: 0; font-size: 0.9rem;">
            <strong>💡 Tip:</strong> Make sure your face and pose are clearly visible in the camera
          </p>
        </div>
      </div>
    </div>
  `;
  
  // เพิ่ม modal ลงใน body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // เริ่มต้นกล้องอัตโนมัติหลังจาก modal โหลด
  setTimeout(() => {
    initLevelUpCamera();
  }, 500);
}

// ฟังก์ชันสำหรับโหลดโมเดลของ face-api.js
async function loadFaceApiModels() {
  if (faceApiModelsLoaded) return true; // ถ้าโหลดแล้ว ก็ข้าม
  
  // ใช้ URL จาก CDN เดียวกันกับที่คุณโหลดใน HTML
  const MODEL_URL = './weights';
  
  try {
    console.log("Loading face-api.js models...");
    // เราจะใช้ Tiny models เพื่อความรวดเร็ว
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL); // โหลด Landmark 68 จุด (สำหรับ skeleton)
    
    console.log("FaceAPI models loaded successfully");
    faceApiModelsLoaded = true;
    return true;
  } catch (e) {
    console.error("Error loading FaceAPI models", e);
    return false;
  }
}

// เริ่มต้นกล้องสำหรับเลเวลอัพ
async function initLevelUpCamera() {
  const videoElement = document.getElementById('levelUpVideoElement');
  const canvasElement = document.getElementById('levelUpPoseCanvas');
  const canvasCtx = canvasElement.getContext('2d');
  const miniCanvas = document.getElementById('levelUpFaceCanvasMini');
  const miniCtx = miniCanvas ? miniCanvas.getContext('2d') : null;
  const feedbackEl = document.getElementById('levelUpPoseFeedback');

  if (!videoElement || !canvasElement || !miniCtx || !feedbackEl) {
    console.error("Level up modal elements not found!");
    return;
  }
  console.log("RUNNING FACE-API.JS: Initializing Level Up Camera...");

  // 1. ⭐️ โหลดโมเดลของ face-api.js ⭐️
  const modelsLoaded = await loadFaceApiModels();
  if (!modelsLoaded) {
    feedbackEl.innerHTML = "❌ <strong>AI Models (face-api) Failed</strong>";
    return;
  }
  feedbackEl.innerHTML = "Models loaded. Starting camera...";

  // 2. ⭐️ (ไม่เปลี่ยนแปลง) หยุดกล้องเก่า (ถ้ามี) ⭐️
  if (levelUpCameraUtil) {
    levelUpCameraUtil.stop();
    levelUpCameraUtil = null;
  }
  
  // 3. ⭐️ (ไม่เปลี่ยนแปลง) สร้าง Camera Utility (เรายังใช้ตัวนี้ในการดึงเฟรม) ⭐️
  levelUpCameraUtil = new Camera(videoElement, {
    // 4. ⭐️⭐️⭐️ เปลี่ยน onFrame ใหม่ทั้งหมด ⭐️⭐️⭐️
    onFrame: async () => {
      // เช็คว่า modal ยังเปิดอยู่ (gamePaused)
      if (!gamePaused) return; 

      // ปรับขนาด canvas ให้ตรงกับ video (เหมือนเดิม)
      if (canvasElement.width !== videoElement.videoWidth) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
      }

      // 5. ⭐️⭐️⭐️ เรียกใช้ face-api.js ⭐️⭐️⭐️
      // ใช้ TinyFaceDetector เพื่อความเร็ว และ FaceLandmark68TinyNet สำหรับ skeleton
      const detections = await faceapi.detectAllFaces(
        videoElement,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
      ).withFaceLandmarks(true); // <-- ✅ แก้ไขเป็น .withFaceLandmarks(true)
      // 6. ⭐️⭐️⭐️ วาดผลลัพธ์ด้วย face-api.js ⭐️⭐️⭐️
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      if (miniCtx) miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);

      if (detections && detections.length > 0) {
        // --- วาดบน Canvas ใหญ่ ---
        // ปรับขนาดผลลัพธ์ให้ตรงกับ canvas ใหญ่
        const resizedDetections = faceapi.resizeResults(detections, {
          width: canvasElement.width,
          height: canvasElement.height
        });
        // ใช้วิธีวาดของ face-api.js (จะวาด skeleton 68 จุด)
        faceapi.draw.drawFaceLandmarks(canvasElement, resizedDetections);

        // --- วาดบน Canvas เล็ก (Mini) ---
        if (miniCtx) {
          // ปรับขนาดผลลัพธ์ให้ตรงกับ canvas เล็ก
          const resizedDetectionsMini = faceapi.resizeResults(detections, {
            width: miniCanvas.width,
            height: miniCanvas.height
          });
          // วาดลง canvas เล็ก
          faceapi.draw.drawFaceLandmarks(miniCanvas, resizedDetectionsMini);
        }
        
        // อัปเดต Feedback (เหมือนเดิม)
        if (feedbackEl.style.color !== "#00ff00") {
          feedbackEl.innerHTML = "✅ <strong>Face Detected!</strong><br>Skeleton active!";
          feedbackEl.style.color = "#00ff00";
        }
      } else {
        // ไม่เจอหน้า (เหมือนเดิม)
        showLevelUpMiniFaceStatus("No face detected");
        canvasCtx.fillStyle = '#ffff00';
        canvasCtx.font = '16px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('No face detected', canvasElement.width / 2, canvasElement.height / 2);
      }
    },
    width: 640, // (เหมือนเดิม)
    height: 480
  });

  // 7. ⭐️ (ไม่เปลี่ยนแปลง) เริ่มกล้อง ⭐️
  try {
    await levelUpCameraUtil.start();
    console.log("FaceAPI Camera utility (Replaced MediaPipe) started successfully.");
    document.getElementById('levelUpCaptureBtn').disabled = false;
    feedbackEl.innerHTML = "📸 <strong>AI Ready! (face-api.js)</strong><br>Face skeleton active!";
    feedbackEl.style.color = "#00ff00";

  } catch (error) {
    console.error("Error accessing camera or starting Camera utility:", error);
    feedbackEl.innerHTML = "❌ <strong>Camera Failed</strong><br>Check permissions.";
  }
}

// จับภาพและตรวจสอบความคล้าย
function captureLevelUpPose() {
  const video = document.getElementById('levelUpVideoElement');
  const canvas = document.getElementById('levelUpPoseCanvas');
  const context = canvas.getContext('2d');
  
  // วาดเฟรมปัจจุบัน
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // วิเคราะห์ความคล้าย (จำลอง)
  analyzeLevelUpPose();
}

// วิเคราะห์ความคล้ายสำหรับเปลี่ยนด่าน
function analyzeLevelUpPose() {
  const requiredSimilarity = 70; // ค่าความคล้ายขั้นต่ำ
  const minSimilarity = 40; // ลดค่าต่ำสุดเพื่อให้มีโอกาสไม่ผ่านมากขึ้น
  const maxSimilarity = 95;
  
  // สุ่มคะแนนความคล้าย (เพิ่มโอกาสไม่ผ่าน)
  let similarity = Math.floor(Math.random() * (maxSimilarity - minSimilarity + 1)) + minSimilarity;
  
  // ให้มีโอกาสผ่าน 60% (ลดจาก 80%)
  const attempts = localStorage.getItem('poseAttempts') || 0;
  const attemptCount = parseInt(attempts);
  
  // ถ้าลองน้อยกว่า 3 ครั้ง ให้มีโอกาสไม่ผ่าน 40%
  if (attemptCount < 3 && Math.random() < 0.4) {
    similarity = Math.min(requiredSimilarity - 5, similarity); // บังคับให้ไม่ผ่าน
  }
  
  localStorage.setItem('poseAttempts', attemptCount + 1);
  
  // อัพเดท UI
  document.getElementById('levelUpSimilarityScore').textContent = `${similarity}%`;
  document.getElementById('levelUpPoseProgress').style.width = `${similarity}%`;
  
  // ตรวจสอบว่าผ่านหรือไม่
  if (similarity >= requiredSimilarity) {
    // ผ่าน!
    document.getElementById('levelUpPoseFeedback').innerHTML = "🎉 <strong>SUCCESS!</strong> Pose matched! Advancing to Level " + currentLevel;
    document.getElementById('levelUpPoseFeedback').style.color = "#00ff00";
    document.getElementById('levelUpCaptureBtn').style.background = "linear-gradient(45deg, #00ff00, #00cc00)";
    document.getElementById('levelUpCaptureBtn').innerHTML = "🎊 CONTINUE TO LEVEL " + currentLevel;
    
    // ปิด modal และดำเนินการต่อ
    setTimeout(() => {
      completeLevelUpPoseChallenge();
    }, 2000);
    
    // แสดง achievement
    showAchievement(`Level ${currentLevel} Unlocked!`, "Pose challenge completed!");
    
  } else {
    // ไม่ผ่าน - แสดงการแจ้งเตือนที่ชัดเจน
    document.getElementById('levelUpPoseFeedback').innerHTML = 
      "❌ <strong>POSE NOT MATCHED!</strong><br>" +
      "Need " + requiredSimilarity + "% similarity, but you got " + similarity + "%<br>" +
      "<span style='color: #ffff00; font-size: 0.9em;'>Try to copy the expression more accurately!</span>";
    document.getElementById('levelUpPoseFeedback').style.color = "#ff0000";
    document.getElementById('levelUpPoseFeedback').style.background = "rgba(255,0,0,0.1)";
    document.getElementById('levelUpPoseFeedback').style.padding = "15px";
    document.getElementById('levelUpPoseFeedback').style.borderRadius = "8px";
    document.getElementById('levelUpPoseFeedback').style.border = "2px solid #ff0000";
    
    document.getElementById('levelUpCaptureBtn').style.background = "linear-gradient(45deg, #ff0000, #cc0000)";
    document.getElementById('levelUpCaptureBtn').innerHTML = "🔄 TRY AGAIN";
    
    // แสดงคำแนะนำเพิ่มเติม
    showPoseTips();
    
    // เปิดใช้งานปุ่มลองใหม่
    document.getElementById('levelUpCaptureBtn').disabled = false;
    
    // แสดง achievement เตือน
    showAchievement("Keep Trying!", "Adjust your pose and try again!");
  }
}

// เพิ่มฟังก์ชันแสดงคำแนะนำการทำโพส
function showPoseTips() {
  const tips = [
    "👀 Make sure your eyes are expressing the same emotion",
    "😊 Pay attention to your mouth shape and smile",
    "✌️ Position your hands exactly like the example",
    "📱 Move closer to the camera for better detection",
    "💡 Make sure your face is well lit"
  ];
  
  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  
  // สร้าง element สำหรับแสดงคำแนะนำ
  const tipElement = document.createElement('div');
  tipElement.style.cssText = `
    background: linear-gradient(45deg, #ffff00, #ff8000);
    color: #000;
    padding: 12px;
    border-radius: 8px;
    margin-top: 15px;
    text-align: center;
    font-weight: bold;
    border: 2px solid #ffff00;
    animation: pulse 2s infinite;
  `;
  tipElement.innerHTML = `💡 TIP: ${randomTip}`;
  
  const feedbackContainer = document.getElementById('levelUpPoseFeedback');
  feedbackContainer.parentNode.insertBefore(tipElement, feedbackContainer.nextSibling);
  
  // ลบคำแนะนำหลังจาก 5 วินาที
  setTimeout(() => {
    if (tipElement.parentNode) {
      tipElement.parentNode.removeChild(tipElement);
    }
  }, 5000);
}

// ลองโพสท่าใหม่
function retryLevelUpPose() {
  document.getElementById('levelUpSimilarityScore').textContent = "0%";
  document.getElementById('levelUpPoseProgress').style.width = "0%";
  document.getElementById('levelUpPoseFeedback').textContent = "Try copying the pose more accurately!";
  document.getElementById('levelUpPoseFeedback').style.color = "#ffff00";
  document.getElementById('levelUpCaptureBtn').disabled = false;
}

// ข้ามโหมดถ่ายภาพ
function skipPoseChallenge() {
  if (confirm("Are you sure you want to skip the pose challenge? You'll miss the bonus points!")) {
    completeLevelUpPoseChallenge();
    showAchievement("Challenge Skipped", "You advanced to Level " + currentLevel + " without completing the pose");
  }
}

// เสร็จสิ้นโหมดถ่ายภาพและดำเนินการต่อ
function completeLevelUpPoseChallenge() {
  if (levelUpCameraUtil) {
    levelUpCameraUtil.stop();
    levelUpCameraUtil = null;
  }
  // ปิด modal
  const modal = document.getElementById('levelUpPoseModal');
  if (modal) {
    modal.remove();
  }
  
  // ปิดกล้อง
  const video = document.getElementById('levelUpVideoElement');
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
  
  // รีสตาร์ทเกม
  gamePaused = false;
  gameLoop = setInterval(updateGame, gameSpeed);
  
  // แสดงข้อความระดับใหม่
  showLevelUpNotification();
  
  // รีเซ็ตจำนวนครั้งที่ลอง
  localStorage.setItem('poseAttempts', 0);
}

async function startGame() {
  if (currentRecords.length >= 999) {
    showAchievement("Maximum Games Reached", "You've reached the limit of 999 game records!");
    return;
  }

  const btn = document.getElementById('playBtn');
  const spinner = document.getElementById('playLoadingSpinner');
  const btnText = document.getElementById('playBtnText');
  
  btn.disabled = true;
  spinner.style.display = 'inline-block';
  btnText.textContent = 'Starting...';

  // รีเซ็ตสถานะเกม
  snake = [{x: 200, y: 200}];
  direction = {x: 0, y: 0};
  score = 0;
  currentLevel = 1;
  foodCollected = 0;
  gameSpeed = 150;
  gameRunning = true;
  gamePaused = false;
  electricOrb.active = false;
  
  document.getElementById('currentScore').textContent = score;
  document.getElementById('snakeLength').textContent = snake.length;
  document.getElementById('foodCount').textContent = 0;
  document.getElementById('currentLevel').textContent = currentLevel;
  document.getElementById('targetFood').textContent = foodPerLevel;
  document.getElementById('levelProgress').style.width = '0%';
  document.getElementById('progressText').textContent = `Collect ${foodPerLevel} food to advance to Level 2`;
  document.getElementById('gameOverlay').style.display = 'none';
  document.getElementById('pauseBtn').disabled = false;
  
  generateFood();
  drawGame();
  
  // เริ่มกล้องถ้ามี
  if (camera && handTrackingActive) {
    camera.start();
  }
  
  gameLoop = setInterval(updateGame, gameSpeed);

  btn.disabled = false;
  spinner.style.display = 'none';
  btnText.textContent = 'New Game';
}

function pauseGame() {
  if (!gameRunning) return;
  
  gamePaused = !gamePaused;
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseBtnText = document.getElementById('pauseBtnText');
  
  if (gamePaused) {
    pauseBtnText.textContent = 'Resume';
    document.getElementById('overlayTitle').textContent = '⏸️ Game Paused';
    document.getElementById('overlayText').textContent = 'Click Resume to continue playing';
    document.getElementById('startBtn').textContent = 'Resume';
    document.getElementById('startBtn').onclick = () => {
      gamePaused = false;
      pauseBtnText.textContent = 'Pause';
      document.getElementById('gameOverlay').style.display = 'none';
    };
    document.getElementById('gameOverlay').style.display = 'flex';
  } else {
    pauseBtnText.textContent = 'Pause';
    document.getElementById('gameOverlay').style.display = 'none';
  }
}

async function gameOver() {
  gameRunning = false;
  clearInterval(gameLoop);
  
  // บันทึกคะแนนไปยัง data SDK
  if (window.dataSdk && score > 0) {
    const result = await window.dataSdk.create({
      score: score,
      level: currentLevel,
      food_collected: foodCollected,
      game_time: Date.now(),
      completed_at: new Date().toISOString()
    });
    
    if (!result.isOk) {
      console.error("Failed to save game score");
    }
  }
  
  // อัพเดทคะแนนสูงสุด
  if (score > highScore) {
    highScore = score;
    document.getElementById('highScore').textContent = highScore;
    showAchievement("New High Score!", `Amazing! You scored ${score} points!`);
  }
  
  // แสดงหน้าจอเกมโอเวอร์
  document.getElementById('overlayTitle').textContent = '🐍 Game Over!';
  document.getElementById('overlayText').textContent = `Final Score: ${score} points`;
  document.getElementById('startBtn').textContent = 'Play Again';
  document.getElementById('startBtn').onclick = startGame;
  document.getElementById('gameOverlay').style.display = 'flex';
  document.getElementById('pauseBtn').disabled = true;
}

function showAchievement(title, description) {
  const achievementsContainer = document.getElementById('achievements');
  const achievement = document.createElement('div');
  achievement.className = 'achievement';
  achievement.innerHTML = `
    <div class="achievement-title">${title}</div>
    <div>${description}</div>
  `;
  
  achievementsContainer.appendChild(achievement);
  
  setTimeout(() => {
    achievement.style.opacity = '0';
    setTimeout(() => achievement.remove(), 500);
  }, 3000);
}

function showLevelUpNotification() {
  // สร้าง overlay แจ้งเตือนระดับใหม่
  const levelUpOverlay = document.createElement('div');
  levelUpOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1999;
    animation: fadeIn 0.5s ease-in-out;
  `;
  
  levelUpOverlay.innerHTML = `
    <div style="text-align: center; color: white; animation: bounceIn 0.8s ease-out;">
      <div style="font-family: 'Orbitron', monospace; font-size: 3rem; color: #00ffff; text-shadow: 0 0 30px #00ffff; margin-bottom: 20px; animation: glow 1s ease-in-out infinite alternate;">
        🚀 LEVEL ${currentLevel} 🚀
      </div>
      <div style="font-size: 1.5rem; color: #ffff00; margin-bottom: 30px;">
        ${getLevelMessage()}
      </div>
      <div style="font-size: 1.2rem; color: #ff00ff; margin-bottom: 20px;">
        ${getLevelObstacle()}
      </div>
      <div style="background: rgba(0,255,255,0.2); padding: 15px; border-radius: 10px; margin-top: 20px;">
        <p style="color: #00ffff; margin: 0; font-size: 1rem;">
          ⚡ Game speed increased! ⚡
        </p>
      </div>
    </div>
  `;
  
  document.body.appendChild(levelUpOverlay);
  
  // ลบหลังจาก 2 วินาที
  setTimeout(() => {
    levelUpOverlay.style.animation = 'fadeOut 0.5s ease-in-out';
    setTimeout(() => {
      if (levelUpOverlay.parentNode) {
        levelUpOverlay.parentNode.removeChild(levelUpOverlay);
      }
    }, 500);
  }, 2000);
}

function getLevelMessage() {
  const messages = [
    "🚀 Speed Boost Activated!",
    "⚡ Lightning Fast Mode!",
    "🔥 Turbo Speed Engaged!",
    "💨 Supersonic Snake!",
    "🌟 Master Level Unlocked!",
    "🎯 Expert Mode Active!",
    "👑 Snake Champion!",
    "🏆 Legend Status!",
    "💎 Diamond Tier!",
    "🌈 Rainbow Speed!"
  ];
  return messages[Math.min(currentLevel - 2, messages.length - 1)] || "🎊 Ultimate Level!";
}

function getLevelObstacle() {
  const obstacles = [
    "⚠️ Snake moves faster now!",
    "🎮 Reflexes required!",
    "⏰ Quick thinking needed!",
    "🧠 Master your skills!",
    "🎯 Precision is key!",
    "💪 Challenge accepted!",
    "🔥 Feel the heat!",
    "⚡ Lightning reflexes!",
    "🌪️ Tornado speed!",
    "🚀 Rocket mode!"
  ];
  return obstacles[Math.min(currentLevel - 2, obstacles.length - 1)] || "🏅 You're unstoppable!";
}

function showTutorial() {
  document.getElementById('tutorialModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeTutorial() {
  document.getElementById('tutorialModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ฟังก์ชันสลับกลับไปเกมงู
function switchToSnakeGame() {
  // ถ้าเกมไม่ทำงาน ให้เริ่มเกม; มิฉะนั้นแค่ให้แน่ใจว่า overlay ซ่อนอยู่
  const overlay = document.getElementById('gameOverlay');
  if (overlay) overlay.style.display = 'none';
  if (!gameRunning) startGame();
}

// เริ่มต้นเมื่อหน้าโหลด
document.addEventListener('DOMContentLoaded', initializeGame);