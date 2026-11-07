import { CONFIG } from './config.js';

/**
 * Quản lý hiệu ứng hạt (Particles) trên Canvas.
 * Bao gồm: Trái tim bay lên và Pháo hoa.
 */
export class EffectsEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.enabled = true;
        this.lastFrameTime = 0;
        this.animationId = null;
        
        // Resize canvas
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Bắt đầu vòng lặp render
        this.loop = this.loop.bind(this);
        this.animationId = requestAnimationFrame(this.loop);
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        // Giới hạn resolution để tối ưu hiệu năng trên mobile
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.cssWidth = rect.width;
        this.cssHeight = rect.height;
    }

    toggle(state) {
        this.enabled = state;
        if (!state) this.clear();
    }

    clear() {
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Tạo hiệu ứng trái tim bay lên từ vị trí (x, y) trong không gian CSS pixel.
     */
    spawnHearts(x, y) {
        if (!this.enabled) return;
        
        // Giới hạn số lượng hạt tối đa
        if (this.particles.length > CONFIG.MAX_HEARTS) {
            this.particles = this.particles.filter(p => p.type !== 'heart' || p.life > 0.5);
        }

        const count = 3 + Math.floor(Math.random() * 3); // 3-5 trái tim mỗi lần
        const colors = ['#ff00a0', '#ff3366', '#bc13fe', '#ffffff', '#ff0044'];
        
        for (let i = 0; i < count; i++) {
            const size = 8 + Math.random() * 12;
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push({
                type: 'heart',
                x: x + (Math.random() - 0.5) * 60,
                y: y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -1.5 - Math.random() * 2.5,
                size: size,
                color: color,
                life: 1.0,
                decay: 0.008 + Math.random() * 0.01,
                rotation: (Math.random() - 0.5) * 0.5,
                rotSpeed: (Math.random() - 0.5) * 0.05,
                glow: true
            });
        }
    }

    /**
     * Tạo hiệu ứng pháo hoa tại vị trí (x, y).
     */
    spawnFireworks(x, y) {
        if (!this.enabled) return;

        // Giới hạn số lượng hạt
        if (this.particles.filter(p => p.type === 'firework').length > CONFIG.MAX_FIREWORK_PARTICLES) {
            return;
        }

        const count = 40 + Math.floor(Math.random() * 30); // 40-70 hạt
        const colors = ['#00f3ff', '#bc13fe', '#ff00a0', '#ffff00', '#00ff88', '#ff6600'];
        const baseColor = colors[Math.floor(Math.random() * colors.length)];

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            this.particles.push({
                type: 'firework',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 3,
                color: Math.random() > 0.5 ? baseColor : colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                decay: 0.015 + Math.random() * 0.02,
                gravity: 0.08,
                friction: 0.98,
                glow: true
            });
        }
    }

    loop(timestamp) {
        // Giới hạn FPS cho hiệu ứng
        if (timestamp - this.lastFrameTime < 1000 / CONFIG.EFFECT_FPS_LIMIT) {
            this.animationId = requestAnimationFrame(this.loop);
            return;
        }
        this.lastFrameTime = timestamp;

        const w = this.cssWidth;
        const h = this.cssHeight;
        
        // Trail effect cho pháo hoa
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        this.ctx.fillRect(0, 0, w, h);

        // Cập nhật và vẽ từng hạt
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Cập nhật vị trí
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.type === 'heart') {
                p.vy -= 0.02;
                p.rotation += p.rotSpeed;
            } else if (p.type === 'firework') {
                p.vy += p.gravity;
                p.vx *= p.friction;
                p.vy *= p.friction;
            }
            
            p.life -= p.decay;
            
            // Xóa hạt nếu hết life hoặc ra khỏi màn hình
            if (p.life <= 0 || p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) {
                this.particles.splice(i, 1);
                continue;
            }

            // Vẽ
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            
            if (p.glow) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = p.color;
            }
            
            this.ctx.fillStyle = p.color;
            
            if (p.type === 'heart') {
                this.drawHeart(p.x, p.y, p.size, p.rotation);
            } else {
                // Firework: hình tròn
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        }

        // Xóa canvas nếu không có hạt nào
        if (this.particles.length === 0) {
            this.ctx.clearRect(0, 0, w, h);
        }

        this.animationId = requestAnimationFrame(this.loop);
    }

    drawHeart(x, y, size, rotation) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);
        this.ctx.beginPath();
        // Vẽ hình trái tim bằng bezier curves
        const topCurveHeight = size * 0.3;
        this.ctx.moveTo(0, topCurveHeight);
        // Left curve
        this.ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurveHeight);
        // Left bottom
        this.ctx.bezierCurveTo(-size / 2, (size + topCurveHeight) / 2, 0, (size + topCurveHeight) / 1.5, 0, size);
        // Right bottom
        this.ctx.bezierCurveTo(0, (size + topCurveHeight) / 1.5, size / 2, (size + topCurveHeight) / 2, size / 2, topCurveHeight);
        // Right curve
        this.ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurveHeight);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}
