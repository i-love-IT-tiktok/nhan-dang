import { CONFIG } from './config.js';
import { GestureEngine } from './gesture.js';
import { EffectsEngine } from './effects.js';

// DOM Elements
const video = document.getElementById('webcam');
const overlayCanvas = document.getElementById('overlayCanvas');
const fxCanvas = document.getElementById('fxCanvas');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnSwitch = document.getElementById('btnSwitch');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnToggleFx = document.getElementById('btnToggleFx');
const camStatus = document.getElementById('camStatus');
const fpsDisplay = document.getElementById('fpsDisplay');
const handCount = document.getElementById('handCount');
const gestureName = document.getElementById('gestureName');
const errorMsg = document.getElementById('errorMsg');

// State
let handLandmarker = null;
let stream = null;
let isRunning = false;
let animationFrameId = null;
let lastVideoTime = -1;
let lastGestureTriggerTime = 0;
let currentFacingMode = 'user'; // 'user' or 'environment'
let lastFpsUpdate = 0;
let frameCount = 0;
let fps = 0;

// Engines
const gestureEngine = new GestureEngine();
let effectsEngine = null;

// Khởi tạo Effects Engine sau khi DOM load xong
window.addEventListener('DOMContentLoaded', () => {
    effectsEngine = new EffectsEngine(fxCanvas);
    effectsEngine.toggle(true);
});

// Hàm khởi tạo MediaPipe
async function initMediaPipe() {
    if (handLandmarker) return;

    try {
        camStatus.textContent = 'Đang tải model...';
        
        // Đợi MediaPipe được import
        let retries = 0;
        while (!window.MediaPipe && retries < 20) {
            await new Promise(r => setTimeout(r, 300));
            retries++;
        }
        if (!window.MediaPipe) throw new Error("MediaPipe không tải được.");

        const vision = await window.MediaPipe.FilesetResolver.forVisionTasks(CONFIG.WASM_URL);
        
        handLandmarker = await window.MediaPipe.HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: CONFIG.MODEL_URL,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: CONFIG.MAX_HANDS,
            minHandDetectionConfidence: CONFIG.MIN_DETECTION_CONFIDENCE,
            minHandPresenceConfidence: CONFIG.MIN_PRESENCE_CONFIDENCE,
            minTrackingConfidence: CONFIG.MIN_TRACKING_CONFIDENCE
        });
        console.log("MediaPipe HandLandmarker ready");
    } catch (error) {
        console.error("Lỗi khởi tạo MediaPipe:", error);
        errorMsg.textContent = "Không thể tải model nhận diện. Vui lòng kiểm tra kết nối mạng.";
        throw error;
    }
}

// Bật Camera
async function startCamera() {
    if (isRunning) return;
    errorMsg.textContent = '';

    try {
        btnStart.disabled = true;
        camStatus.textContent = 'Đang khởi động...';

        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: CONFIG.VIDEO_WIDTH_IDEAL },
                height: { ideal: CONFIG.VIDEO_HEIGHT_IDEAL }
            },
            audio: false
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });

        if (!handLandmarker) {
            await initMediaPipe();
        }

        isRunning = true;
        btnStart.disabled = true;
        btnStop.disabled = false;
        btnSwitch.disabled = false;
        camStatus.textContent = 'Camera: Bật';
        
        gestureEngine.reset();
        lastGestureTriggerTime = 0;

        detectLoop();

    } catch (err) {
        console.error("Lỗi camera:", err);
        let msg = "Không thể truy cập camera.";
        if (err.name === 'NotAllowedError') {
            msg = "Bạn đã từ chối quyền truy cập camera. Vui lòng làm mới trang và cấp quyền.";
        } else if (err.name === 'NotFoundError') {
            msg = "Không tìm thấy thiết bị camera nào trên máy.";
        } else if (err.name === 'NotReadableError') {
            msg = "Camera đang được sử dụng bởi ứng dụng khác.";
        }
        errorMsg.textContent = msg;
        camStatus.textContent = 'Camera: Lỗi';
        btnStart.disabled = false;
    }
}

// Tắt Camera
function stopCamera() {
    if (!isRunning) return;
    isRunning = false;
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    video.srcObject = null;
    
    if (effectsEngine) {
        effectsEngine.clear();
    }
    
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    btnStart.disabled = false;
    btnStop.disabled = true;
    btnSwitch.disabled = true;
    camStatus.textContent = 'Camera: Tắt';
    handCount.textContent = 'Tay: 0';
    fpsDisplay.textContent = 'FPS: 0';
    gestureName.textContent = 'Cử chỉ: --';
    
    gestureEngine.reset();
}

// Đổi Camera (trước/sau)
async function switchCamera() {
    if (!isRunning) return;
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    try {
        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: CONFIG.VIDEO_WIDTH_IDEAL },
                height: { ideal: CONFIG.VIDEO_HEIGHT_IDEAL }
            },
            audio: false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        await video.play();
    } catch (err) {
        console.error("Lỗi đổi camera:", err);
        errorMsg.textContent = "Không thể đổi camera. Thiết bị có thể không hỗ trợ.";
        stopCamera();
    }
}

// Vòng lặp nhận diện chính
function detectLoop() {
    if (!isRunning) return;

    // Cập nhật FPS
    const now = performance.now();
    if (now - lastFpsUpdate >= 1000) {
        fps = frameCount;
        fpsDisplay.textContent = `FPS: ${fps}`;
        frameCount = 0;
        lastFpsUpdate = now;
    }
    frameCount++;

    // Chỉ xử lý khi video có frame mới
    if (video.currentTime !== lastVideoTime && handLandmarker) {
        lastVideoTime = video.currentTime;
        
        try {
            const results = handLandmarker.detectForVideo(video, performance.now());
            drawLandmarks(results);
            processGestures(results);
        } catch (err) {
            console.error("Lỗi detect:", err);
        }
    }

    animationFrameId = requestAnimationFrame(detectLoop);
}

// Vẽ landmarks lên overlay canvas
function drawLandmarks(results) {
    const ctx = overlayCanvas.getContext('2d');
    const rect = overlayCanvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    // Đảm bảo canvas kích thước đúng
    if (overlayCanvas.width !== rect.width * dpr) {
        overlayCanvas.width = rect.width * dpr;
        overlayCanvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    }
    
    const w = rect.width;
    const h = rect.height;
    
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    if (!results || !results.landmarks || results.landmarks.length === 0) return;
    
    // Cấu hình nét vẽ
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#00f3ff';
    ctx.fillStyle = '#ff00a0';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00f3ff';
    
    for (const hand of results.landmarks) {
        // Vẽ các điểm landmark
        for (const lm of hand) {
            const x = lm.x * w;
            const y = lm.y * h;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }
        
        // Vẽ đường nối (connections)
        const connections = [
            [0,1],[1,2],[2,3],[3,4],       // Thumb
            [0,5],[5,6],[6,7],[7,8],       // Index
            [5,9],[9,10],[10,11],[11,12],   // Middle
            [9,13],[13,14],[14,15],[15,16], // Ring
            [13,17],[17,18],[18,19],[19,20],// Pinky
            [0,17]                          // Palm base
        ];
        
        ctx.beginPath();
        for (const [i, j] of connections) {
            const p1 = hand[i];
            const p2 = hand[j];
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
        }
        ctx.stroke();
    }
    
    ctx.shadowBlur = 0;
}

// Xử lý gesture và kích hoạt hiệu ứng
function processGestures(results) {
    const hands = results.landmarks || [];
    const handedness = results.handednesses || [];
    
    handCount.textContent = `Tay: ${hands.length}`;
    
    if (hands.length === 0) {
        gestureName.textContent = 'Cử chỉ: --';
        return;
    }
    
    const handData = hands.map((landmarks, idx) => ({
        landmarks: landmarks,
        handedness: handedness[idx] ? handedness[idx][0].categoryName : 'Unknown'
    }));
    
    const result = gestureEngine.detect(handData);
    
    if (result.gesture === 'heart') {
        gestureName.textContent = 'Cử chỉ: ❤️ Trái Tim';
    } else if (result.gesture === 'thumbs_up') {
        gestureName.textContent = 'Cử chỉ: 👍👍 Thumbs Up';
    } else {
        gestureName.textContent = 'Cử chỉ: --';
    }
    
    // Kích hoạt hiệu ứng nếu được xác nhận và hết cooldown
    if (result.confirmed && result.gesture !== 'none') {
        const now = Date.now();
        if (now - lastGestureTriggerTime > CONFIG.GESTURE_COOLDOWN_MS) {
            lastGestureTriggerTime = now;
            triggerEffect(result.gesture, hands);
        }
    }
}

// Kích hoạt hiệu ứng tương ứng
function triggerEffect(gesture, hands) {
    if (!effectsEngine) return;
    
    const rect = fxCanvas.parentElement.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    
    if (gesture === 'heart') {
        if (hands.length >= 2) {
            const h1 = hands[0][0];
            const h2 = hands[1][0];
            const midX = ((h1.x + h2.x) / 2) * cw;
            const midY = ((h1.y + h2.y) / 2) * ch;
            effectsEngine.spawnHearts(midX, midY - 30);
        }
    } else if (gesture === 'thumbs_up') {
        if (hands.length >= 2) {
            const h1 = hands[0][0];
            const h2 = hands[1][0];
            const midX = ((h1.x + h2.x) / 2) * cw;
            const midY = ((h1.y + h2.y) / 2) * ch - 50;
            
            effectsEngine.spawnFireworks(midX - 60, midY);
            setTimeout(() => {
                if (effectsEngine) effectsEngine.spawnFireworks(midX + 60, midY - 20);
            }, 150);
            setTimeout(() => {
                if (effectsEngine) effectsEngine.spawnFireworks(midX, midY - 80);
            }, 300);
        }
    }
}

// Event Listeners
btnStart.addEventListener('click', startCamera);
btnStop.addEventListener('click', stopCamera);
btnSwitch.addEventListener('click', switchCamera);

btnFullscreen.addEventListener('click', () => {
    const elem = document.querySelector('.video-container');
    if (!document.fullscreenElement) {
        elem.requestFullscreen().catch(err => {
            errorMsg.textContent = "Trình duyệt không hỗ trợ toàn màn hình.";
        });
    } else {
        document.exitFullscreen();
    }
});

btnToggleFx.addEventListener('click', () => {
    if (!effectsEngine) return;
    const newState = !effectsEngine.enabled;
    effectsEngine.toggle(newState);
    btnToggleFx.textContent = `Hiệu Ứng: ${newState ? 'BẬT' : 'TẮT'}`;
    btnToggleFx.classList.toggle('active', newState);
});

window.addEventListener('beforeunload', () => {
    stopCamera();
});
