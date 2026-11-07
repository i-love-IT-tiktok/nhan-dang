/**
 * Xử lý logic nhận diện cử chỉ từ landmarks.
 */
export class GestureEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.currentGesture = 'none';
        this.lastGesture = 'none';
        this.holdCounter = 0;
        this.lastTriggerTime = 0;
    }

    /**
     * Tính khoảng cách Euclidean giữa 2 điểm landmark (chuẩn hóa 0-1)
     */
    dist(p1, p2) {
        return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    /**
     * Kiểm tra ngón tay có duỗi không dựa trên góc và khoảng cách (Heuristic)
     * Trả về boolean: true nếu ngón tay duỗi thẳng.
     */
    isFingerExtended(landmarks, tipIdx, pipIdx, mcpIdx) {
        // Vector từ MCP đến PIP, và từ PIP đến TIP
        const v1 = { x: landmarks[pipIdx].x - landmarks[mcpIdx].x, y: landmarks[pipIdx].y - landmarks[mcpIdx].y };
        const v2 = { x: landmarks[tipIdx].x - landmarks[pipIdx].x, y: landmarks[tipIdx].y - landmarks[pipIdx].y };
        
        // Tích vô hướng
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.hypot(v1.x, v1.y);
        const mag2 = Math.hypot(v2.x, v2.y);
        
        if (mag1 === 0 || mag2 === 0) return false;
        
        const cosAngle = dot / (mag1 * mag2);
        // Nếu góc < ~45 độ (cos > 0.7) và khoảng cách tip-pip đủ lớn => duỗi
        return cosAngle > 0.7;
    }

    /**
     * Nhận diện Thumbs Up: Ngón cái duỗi, 4 ngón còn lại gập.
     */
    isThumbsUp(landmarks, handedness) {
        // Landmark indices: 
        // Thumb: 1(CMC), 2(MCP), 3(IP), 4(TIP)
        // Index: 5(MCP), 6(PIP), 7(DIP), 8(TIP)
        // Middle: 9, 10, 11, 12
        // Ring: 13, 14, 15, 16
        // Pinky: 17, 18, 19, 20

        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const thumbMcp = landmarks[2];
        
        // Kiểm tra 4 ngón kia có gập không
        const indexExt = this.isFingerExtended(landmarks, 8, 6, 5);
        const middleExt = this.isFingerExtended(landmarks, 12, 10, 9);
        const ringExt = this.isFingerExtended(landmarks, 16, 14, 13);
        const pinkyExt = this.isFingerExtended(landmarks, 20, 18, 17);

        // Ngón cái: Cần duỗi và hướng lên. 
        const thumbExtended = (thumbTip.y < thumbMcp.y) && (this.dist(thumbTip, wrist) > this.dist(thumbMcp, wrist));
        
        // Nếu 4 ngón gập và ngón cái duỗi => Thumbs Up
        const isGathered = !indexExt && !middleExt && !ringExt && !pinkyExt;
        
        return thumbExtended && isGathered;
    }

    /**
     * Kiểm tra xem hai bàn tay có đang tạo hình trái tim không.
     * Điều kiện: Hai tay gần nhau, ngón trỏ và ngón cái của hai tay chạm nhau hoặc gần nhau.
     */
    isHeartShape(hand1, hand2) {
        // 1. Kiểm tra khoảng cách tổng thể giữa hai cổ tay (wrist - index 0)
        const wristDist = this.dist(hand1[0], hand2[0]);
        
        // Nếu quá xa => không thể tạo hình tim
        if (wristDist > 0.4) return false;

        // 2. Kiểm tra các đầu ngón tay chạm nhau: 
        // Ngón trỏ (8) và ngón cái (4) của tay 1 với tay 2.
        const tips1 = [hand1[4], hand1[8]]; // Thumb tip, Index tip
        const tips2 = [hand2[4], hand2[8]];
        
        // Tìm khoảng cách nhỏ nhất giữa các cặp tip
        let minDist = 1.0;
        for (let t1 of tips1) {
            for (let t2 of tips2) {
                const d = this.dist(t1, t2);
                if (d < minDist) minDist = d;
            }
        }
        
        // Nếu khoảng cách nhỏ nhất < 0.12 => coi như chạm
        if (minDist > 0.12) return false;
        
        return true;
    }

    /**
     * Hàm chính: Nhận đầu vào là mảng các bàn tay (mỗi bàn tay là object { landmarks, handedness })
     * Trả về: { gesture: 'heart' | 'thumbs_up' | 'none', confirmed: boolean }
     */
    detect(hands) {
        let detectedGesture = 'none';

        // 1. Kiểm tra Thumbs Up (cần 2 tay cùng lúc)
        if (hands.length >= 2) {
            const isLeftThumbsUp = this.isThumbsUp(hands[0].landmarks, hands[0].handedness);
            const isRightThumbsUp = this.isThumbsUp(hands[1].landmarks, hands[1].handedness);
            
            if (isLeftThumbsUp && isRightThumbsUp) {
                detectedGesture = 'thumbs_up';
            }
        }

        // 2. Kiểm tra Heart (cần đúng 2 tay)
        if (detectedGesture === 'none' && hands.length === 2) {
            if (this.isHeartShape(hands[0].landmarks, hands[1].landmarks)) {
                detectedGesture = 'heart';
            }
        }

        // Logic xác nhận cử chỉ (Hold frames) để tránh nhầm lẫn
        if (detectedGesture === this.currentGesture && detectedGesture !== 'none') {
            this.holdCounter++;
        } else {
            this.holdCounter = 0;
            this.currentGesture = detectedGesture;
        }

        // Nếu giữ đủ lâu, trả về gesture đã xác nhận
        if (this.holdCounter >= 5) {
            return { gesture: this.currentGesture, confirmed: true };
        }

        return { gesture: this.currentGesture, confirmed: false };
    }
}
