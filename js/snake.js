(() => {
    const GRID = 20;
    const BASE_TICK_MS = 140;
    const MIN_TICK_MS = 60;
    const SPEEDUP_PER_BEAN = 3;
    const BEST_KEY = "bean-snake-best";

    const DIRECTIONS = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
    };

    const KEY_TO_DIR = {
        ArrowUp: "up", w: "up", W: "up",
        ArrowDown: "down", s: "down", S: "down",
        ArrowLeft: "left", a: "left", A: "left",
        ArrowRight: "right", d: "right", D: "right",
    };

    const canvas = document.getElementById("board");
    const ctx = canvas.getContext("2d");
    const cell = canvas.width / GRID;

    const scoreEl = document.getElementById("score");
    const lengthEl = document.getElementById("length");
    const bestEl = document.getElementById("best");
    const overlay = document.getElementById("overlay");
    const overlayTitle = document.getElementById("overlay-title");
    const overlayText = document.getElementById("overlay-text");
    const playBtn = document.getElementById("play-btn");
    const pauseBtn = document.getElementById("pause-btn");

    let snake;
    let direction;
    let queuedDirections;
    let food;
    let score;
    let best = Number(localStorage.getItem(BEST_KEY)) || 0;
    let state = "idle"; // idle | running | paused | over
    let lastTick = 0;
    let rafId = null;

    bestEl.textContent = best;

    function reset() {
        const mid = Math.floor(GRID / 2);
        snake = [
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
            { x: mid - 2, y: mid },
        ];
        direction = DIRECTIONS.right;
        queuedDirections = [];
        score = 0;
        food = spawnFood();
        updateHud();
    }

    function spawnFood() {
        const occupied = new Set(snake.map((p) => p.x + "," + p.y));
        const free = [];
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if (!occupied.has(x + "," + y)) free.push({ x, y });
            }
        }
        return free.length ? free[Math.floor(Math.random() * free.length)] : null;
    }

    function tickInterval() {
        return Math.max(MIN_TICK_MS, BASE_TICK_MS - score * SPEEDUP_PER_BEAN);
    }

    function queueDirection(name) {
        const next = DIRECTIONS[name];
        const last = queuedDirections[queuedDirections.length - 1] || direction;
        const isSameAxis = next.x === -last.x && next.y === -last.y;
        if (next === last || isSameAxis || queuedDirections.length >= 2) return;
        queuedDirections.push(next);
    }

    function step() {
        if (queuedDirections.length) direction = queuedDirections.shift();

        const head = snake[0];
        const newHead = { x: head.x + direction.x, y: head.y + direction.y };
        const willEat = food && newHead.x === food.x && newHead.y === food.y;

        const hitWall = newHead.x < 0 || newHead.y < 0 || newHead.x >= GRID || newHead.y >= GRID;
        const body = willEat ? snake : snake.slice(0, -1);
        const hitSelf = body.some((p) => p.x === newHead.x && p.y === newHead.y);

        if (hitWall || hitSelf) {
            gameOver();
            return;
        }

        snake.unshift(newHead);
        if (willEat) {
            score++;
            food = spawnFood();
            if (!food) {
                win();
                return;
            }
        } else {
            snake.pop();
        }
        updateHud();
    }

    function updateHud() {
        scoreEl.textContent = score;
        lengthEl.textContent = snake.length;
        if (score > best) {
            best = score;
            bestEl.textContent = best;
            localStorage.setItem(BEST_KEY, String(best));
        }
    }

    function drawBean(x, y) {
        const cx = x * cell + cell / 2;
        const cy = y * cell + cell / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 5);
        ctx.fillStyle = "#8b4a25";
        ctx.beginPath();
        ctx.ellipse(0, 0, cell * 0.32, cell * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f9c06a";
        ctx.lineWidth = Math.max(1.5, cell * 0.08);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, -cell * 0.3);
        ctx.quadraticCurveTo(cell * 0.12, 0, 0, cell * 0.3);
        ctx.stroke();
        ctx.restore();
    }

    function roundedRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function draw() {
        ctx.fillStyle = "#3a271c";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#412c20";
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
            }
        }

        if (food) drawBean(food.x, food.y);

        const pad = cell * 0.08;
        snake.forEach((part, i) => {
            const t = i / Math.max(1, snake.length - 1);
            const light = 72 - t * 22;
            ctx.fillStyle = i === 0 ? "#f9c06a" : "hsl(35, 70%, " + light + "%)";
            roundedRect(part.x * cell + pad, part.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.28);
            ctx.fill();
        });

        const head = snake[0];
        const eyeOffset = cell * 0.18;
        const eyeR = cell * 0.08;
        const hx = head.x * cell + cell / 2;
        const hy = head.y * cell + cell / 2;
        const px = -direction.y;
        const py = direction.x;
        ctx.fillStyle = "#1c120d";
        [1, -1].forEach((side) => {
            ctx.beginPath();
            ctx.arc(
                hx + direction.x * eyeOffset + px * eyeOffset * side,
                hy + direction.y * eyeOffset + py * eyeOffset * side,
                eyeR, 0, Math.PI * 2
            );
            ctx.fill();
        });
    }

    function loop(time) {
        if (state !== "running") return;
        if (time - lastTick >= tickInterval()) {
            lastTick = time;
            step();
            draw();
        }
        if (state === "running") rafId = requestAnimationFrame(loop);
    }

    function showOverlay(title, text, buttonLabel) {
        overlayTitle.textContent = title;
        overlayText.textContent = text;
        playBtn.textContent = buttonLabel;
        overlay.hidden = false;
        playBtn.focus();
    }

    function start() {
        if (state === "idle" || state === "over") reset();
        state = "running";
        overlay.hidden = true;
        pauseBtn.textContent = "II";
        lastTick = performance.now();
        draw();
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(loop);
    }

    function togglePause() {
        if (state === "running") {
            state = "paused";
            cancelAnimationFrame(rafId);
            pauseBtn.textContent = "\u25B6";
            showOverlay("Paused", "Take a sip. Press Space to resume.", "Resume");
        } else if (state === "paused") {
            start();
        }
    }

    function gameOver() {
        state = "over";
        cancelAnimationFrame(rafId);
        draw();
        showOverlay("Game over", "You ate " + score + " bean" + (score === 1 ? "" : "s") + ". Best: " + best + ".", "Play Again");
    }

    function win() {
        state = "over";
        cancelAnimationFrame(rafId);
        draw();
        showOverlay("You filled the cup!", "Perfect game with " + score + " beans.", "Play Again");
    }

    document.addEventListener("keydown", (e) => {
        const dir = KEY_TO_DIR[e.key];
        if (dir) {
            e.preventDefault();
            if (state === "idle" || state === "over") start();
            if (state === "running") queueDirection(dir);
            return;
        }
        if (e.key === " " || e.key === "Escape" || e.key === "p" || e.key === "P") {
            if (state === "running" || state === "paused") {
                e.preventDefault();
                togglePause();
            }
        } else if (e.key === "Enter" && (state === "idle" || state === "over") && document.activeElement !== playBtn) {
            start();
        }
    });

    playBtn.addEventListener("click", start);
    pauseBtn.addEventListener("click", () => {
        if (state === "idle" || state === "over") start();
        else togglePause();
    });

    document.querySelectorAll(".ctrl[data-dir]").forEach((btn) => {
        btn.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (state === "idle" || state === "over") start();
            if (state === "running") queueDirection(btn.dataset.dir);
        });
    });

    let touchStart = null;
    canvas.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    canvas.addEventListener("touchend", (e) => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;
        touchStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24 || state !== "running") return;
        queueDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    });

    reset();
    draw();
})();
