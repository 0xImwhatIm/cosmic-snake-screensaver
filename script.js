// ==========================================
// 系統核心配置
// ==========================================
const CONFIG = {
    gridSize: 20,
    baseBPM: 100,
    maxBPM: 500,
    bpmStep: 2,
    measuresPerChange: 1,
    starCount: 200,
    colors: {
        snakeHead: '#ffffff',
        snakeBody: '#a5f3fc',
        food: '#e879f9',
        bg: '#050510'
    }
};

// ==========================================
// 音效引擎 - Crystal Melody Edition
// ==========================================
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isReady = false;
        this.melodyIndex = 0;

        const N = {
            Fs3: 185.00, Gs3: 207.65, A3: 220.00, B3: 246.94,
            Cs4: 277.18, D4: 293.66, E4: 329.63,
            Fs4: 369.99, Gs4: 415.30, A4: 440.00, B4: 493.88,
            Cs5: 554.37, D5: 587.33, E5: 659.25, Fs5: 739.99
        };

        this.melody = [
            N.Fs4, N.Fs4, N.A4, N.B4,
            N.Cs5, N.B4, N.A4, N.B4,

            N.Cs5, N.E5, N.D5, N.Cs5,
            N.B4, N.Cs5, N.B4, N.A4,

            N.Fs4, N.Fs4, N.A4, N.B4,
            N.Cs5, N.B4, N.A4, N.B4,

            N.Cs5, N.E5, N.Cs5, N.E5,
            N.Fs5, N.Cs5, N.B4, N.A4
        ];
    }

    init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.isReady = true;
    }

    playCrystalNote(freq, time, duration = 0.3) {
        if (!freq) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + duration + 0.1);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, time);

        gain2.gain.setValueAtTime(0, time);
        gain2.gain.linearRampToValueAtTime(0.05, time + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);

        osc2.start(time);
        osc2.stop(time + 0.2);
    }

    playBass(time, index) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';

        let freq = 185.00; // F#3
        const section = Math.floor(index / 8) % 4;

        if (section === 1) freq = 146.83;
        if (section === 2) freq = 164.81;
        if (section === 3) freq = 138.59;

        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.4);
    }

    playStep(bpmRatio) {
        if (!this.isReady) return;

        const t = this.ctx.currentTime;

        const noteFreq = this.melody[this.melodyIndex % this.melody.length];
        const duration = 0.5 - (bpmRatio * 0.4);

        this.playCrystalNote(noteFreq, t, duration);

        if (this.melodyIndex % 4 === 0) {
            this.playBass(t, this.melodyIndex);
        }

        this.melodyIndex++;
    }
}

// ==========================================
// 遊戲邏輯與 AI
// ==========================================
class Game {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audio = audio;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.currentBPM = CONFIG.baseBPM;
        this.bpmDirection = 1;
        this.beatCount = 0;

        this.snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 },
            { x: 7, y: 10 },
            { x: 6, y: 10 }
        ];

        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };

        this.food = this.getRandomPos();

        this.stars = [];
        this.initStars();

        this.lastTime = 0;
        this.accumulatedTime = 0;

        this.isPlaying = false;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.cols = Math.floor(this.canvas.width / CONFIG.gridSize);
        this.rows = Math.floor(this.canvas.height / CONFIG.gridSize);
    }

    initStars() {
        for (let i = 0; i < CONFIG.starCount; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2,
                alpha: Math.random(),
                speed: Math.random() * 0.5 + 0.1
            });
        }
    }

    getRandomPos() {
        return {
            x: Math.floor(Math.random() * this.cols),
            y: Math.floor(Math.random() * this.rows)
        };
    }

    aiThink() {
        const head = this.snake[0];

        const moves = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 }
        ];

        const safeMoves = moves.filter(move => {
            const nextX = (head.x + move.x + this.cols) % this.cols;
            const nextY = (head.y + move.y + this.rows) % this.rows;

            for (let part of this.snake) {
                if (part.x === nextX && part.y === nextY) return false;
            }

            if (move.x === -this.direction.x && move.y === -this.direction.y)
                return false;

            return true;
        });

        if (safeMoves.length === 0) return;

        let bestMove = safeMoves[0];
        let minDist = Infinity;

        safeMoves.forEach(move => {
            const nextX = (head.x + move.x + this.cols) % this.cols;
            const nextY = (head.y + move.y + this.rows) % this.rows;

            const dist =
                Math.abs(nextX - this.food.x) +
                Math.abs(nextY - this.food.y);

            if (dist < minDist) {
                minDist = dist;
                bestMove = move;
            }
        });

        this.nextDirection = bestMove;
    }

    update() {
        this.aiThink();
        this.direction = this.nextDirection;

        const head = {
            x: (this.snake[0].x + this.direction.x + this.cols) % this.cols,
            y: (this.snake[0].y + this.direction.y + this.rows) % this.rows
        };

        for (let part of this.snake) {
            if (part.x === head.x && part.y === head.y) {
                this.resetGame();
                return;
            }
        }

        this.snake.unshift(head);

        if (head.x === this.food.x && head.y === this.food.y) {
            this.food = this.getRandomPos();
        } else {
            this.snake.pop();
        }

        this.handleMusicLogic();
    }

    resetGame() {
        this.snake = [
            { x: Math.floor(this.cols / 2), y: Math.floor(this.rows / 2) }
        ];

        this.currentBPM = CONFIG.baseBPM;
        this.audio.melodyIndex = 0;
    }

    handleMusicLogic() {
        const bpmRatio =
            (this.currentBPM - CONFIG.baseBPM) /
            (CONFIG.maxBPM - CONFIG.baseBPM);

        this.audio.playStep(bpmRatio);

        this.beatCount++;

        if (this.beatCount % 8 === 0) {
            if (this.bpmDirection === 1) {
                this.currentBPM += CONFIG.bpmStep * (1 + bpmRatio * 2);

                if (this.currentBPM >= CONFIG.maxBPM) {
                    this.currentBPM = CONFIG.maxBPM;
                    this.bpmDirection = -1;
                }
            } else {
                this.currentBPM -= CONFIG.bpmStep * 2;

                if (this.currentBPM <= CONFIG.baseBPM) {
                    this.currentBPM = CONFIG.baseBPM;
                    this.bpmDirection = 1;
                }
            }

            document.getElementById("bpm-display").innerText =
                Math.floor(this.currentBPM);

            document.getElementById("phase-display").innerText =
                this.bpmDirection === 1 ? "ACCELERATING" : "DECELERATING";
        }
    }

    draw() {
        this.ctx.fillStyle = "rgba(5, 5, 16, 0.25)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawStars();

        this.drawGlowingRect(
            this.food.x,
            this.food.y,
            CONFIG.colors.food,
            15
        );

        const bpmRatio =
            (this.currentBPM - CONFIG.baseBPM) /
            (CONFIG.maxBPM - CONFIG.baseBPM);

        this.snake.forEach((part, index) => {
            const isHead = index === 0;
            const color = isHead
                ? CONFIG.colors.snakeHead
                : CONFIG.colors.snakeBody;

            const glowBase = isHead ? 20 : 5;
            const pulse = Math.sin(this.beatCount * 0.5 + index) * 5;
            const glow = glowBase + pulse + bpmRatio * 15;

            this.drawGlowingRect(part.x, part.y, color, Math.max(0, glow));
        });
    }

    drawStars() {
        const bpmRatio =
            (this.currentBPM - CONFIG.baseBPM) /
            (CONFIG.maxBPM - CONFIG.baseBPM);

        this.stars.forEach(star => {
            this.ctx.beginPath();

            const tail = star.size * (1 + bpmRatio * 30);

            this.ctx.moveTo(star.x, star.y);
            this.ctx.lineTo(star.x - tail, star.y);

            this.ctx.strokeStyle = `rgba(255,255,255,${star.alpha})`;
            this.ctx.lineWidth = star.size;
            this.ctx.stroke();

            star.x -= star.speed * (1 + bpmRatio * 20);

            if (star.x < 0) {
                star.x = this.canvas.width;
                star.y = Math.random() * this.canvas.height;
            }
        });
    }

    drawGlowingRect(gx, gy, color, blur) {
        const x = gx * CONFIG.gridSize;
        const y = gy * CONFIG.gridSize;
        const s = CONFIG.gridSize - 2;

        this.ctx.shadowBlur = blur;
        this.ctx.shadowColor = color;

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x + 1, y + 1, s, s);

        this.ctx.shadowBlur = 0;
    }

    start() {
        this.isPlaying = true;
        this.lastTime = performance.now();

        this.audio.init();

        requestAnimationFrame(t => this.loop(t));
    }

    loop(currentTime) {
        if (!this.isPlaying) return;

        const delta = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.accumulatedTime += delta;

        const interval = 60000 / this.currentBPM;

        if (this.accumulatedTime > interval) {
            this.update();
            this.accumulatedTime -= interval;
        }

        this.draw();

        requestAnimationFrame(t => this.loop(t));
    }
}

window.onload = () => {
    const canvas = document.getElementById("gameCanvas");

    const audio = new AudioEngine();
    const game = new Game(canvas, audio);

    document.getElementById("start-btn").addEventListener("click", () => {
        document.getElementById("intro-screen").classList.add("hidden");
        document.getElementById("hud").classList.remove("hidden");

        game.start();
    });
};
