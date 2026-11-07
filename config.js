export const CONFIG = {
    // MediaPipe model
    MODEL_URL: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    WASM_URL: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    
    // Detection params
    MAX_HANDS: 2,
    MIN_DETECTION_CONFIDENCE: 0.6,
    MIN_PRESENCE_CONFIDENCE: 0.6,
    MIN_TRACKING_CONFIDENCE: 0.5,

    // Gesture Logic
    GESTURE_COOLDOWN_MS: 3000, // 3 giây hồi chiêu cho hiệu ứng
    HEART_DISTANCE_THRESHOLD: 0.15, // Khoảng cách tương đối giữa 2 tay để coi là gần nhau
    GESTURE_HOLD_FRAMES: 5, // Số frame cần giữ để xác nhận cử chỉ (tránh nhầm lẫn)

    // Effects Performance
    MAX_HEARTS: 60,
    MAX_FIREWORK_PARTICLES: 400,
    EFFECT_FPS_LIMIT: 45, // Giới hạn FPS cho hiệu ứng để đỡ tốn tài nguyên
    
    // Camera
    VIDEO_WIDTH_IDEAL: 640,
    VIDEO_HEIGHT_IDEAL: 480,
};
