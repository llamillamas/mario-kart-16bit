/**
 * 16-BIT MARIO KART STYLE RACING GAME ENGINE
 * Mobile-Ready with Touch Controls & Enhanced UI/UX
 * No external libraries - pure JavaScript
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Canvas
  WIDTH: 800,
  HEIGHT: 600,
  
  // Physics
  MAX_SPEED: 200,
  ACCELERATION: 120,
  DECELERATION: 80,
  BRAKE_POWER: 200,
  STEERING_BASE: 3.5,
  STEERING_SPEED_FACTOR: 0.7,
  FRICTION: 0.98,
  
  // Drift
  DRIFT_GRIP: 0.92,
  DRIFT_BOOST_RATE: 40,
  DRIFT_BOOST_MAX: 100,
  DRIFT_BOOST_SPEED: 50,
  DRIFT_BOOST_DURATION: 1.5,
  
  // Track
  TRACK_CENTER_X: 400,
  TRACK_CENTER_Y: 300,
  TRACK_RADIUS_X: 320,
  TRACK_RADIUS_Y: 220,
  TRACK_WIDTH: 120,
  
  // Race
  TOTAL_LAPS: 3,
  CHECKPOINT_COUNT: 4,
  
  // AI
  AI_COUNT: 3,
  RUBBER_BAND_STRENGTH: 0.3,
  
  // Power-ups
  POWERUP_COUNT: 4,
  BOOST_DURATION: 2,
  SHIELD_DURATION: 5,
  SLOW_DURATION: 3,
  SLOW_FACTOR: 0.5,
  
  // Visuals
  PIXEL_SIZE: 2,
  
  // Mobile
  MOBILE_PARTICLE_REDUCTION: 0.5,
  TOUCH_THRESHOLD: 10,
  JOYSTICK_RADIUS: 40,
};

// ============================================================================
// MOBILE DETECTION & SETUP
// ============================================================================

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const supportsVibration = 'vibrate' in navigator;

// Add touch-device class to body
if (isTouchDevice) {
  document.body.classList.add('touch-device');
}

// ============================================================================
// SCREEN SHAKE SYSTEM
// ============================================================================

const screenShake = {
  intensity: 0,
  duration: 0,
  x: 0,
  y: 0,
  
  trigger(intensity, duration) {
    this.intensity = intensity;
    this.duration = duration;
    if (supportsVibration && intensity > 5) {
      navigator.vibrate(Math.min(100, intensity * 10));
    }
  },
  
  update(dt) {
    if (this.duration > 0) {
      this.duration -= dt;
      this.x = (Math.random() - 0.5) * this.intensity;
      this.y = (Math.random() - 0.5) * this.intensity;
      this.intensity *= 0.9;
    } else {
      this.x = 0;
      this.y = 0;
    }
  }
};

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.active = true;
  }
  
  update(dt) {
    if (!this.active) return;
    
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.vx *= 0.98;
    this.vy *= 0.98;
    
    if (this.life <= 0) {
      this.active = false;
    }
  }
  
  render(ctx) {
    if (!this.active) return;
    
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

const particles = [];
const MAX_PARTICLES = isMobile ? 50 : 100;

function spawnParticles(x, y, count, colors, speedRange, lifeRange, sizeRange) {
  const actualCount = isMobile ? Math.ceil(count * CONFIG.MOBILE_PARTICLE_REDUCTION) : count;
  
  for (let i = 0; i < actualCount && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
    const life = lifeRange[0] + Math.random() * (lifeRange[1] - lifeRange[0]);
    const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      color, life, size
    ));
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (!particles[i].active) {
      particles.splice(i, 1);
    }
  }
}

function renderParticles(ctx) {
  for (const particle of particles) {
    particle.render(ctx);
  }
}

// ============================================================================
// GAME STATE
// ============================================================================

const gameState = {
  running: false,
  countdown: 3,
  raceTime: 0,
  finished: false,
  winner: null,
};

// ============================================================================
// INPUT HANDLING
// ============================================================================

const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  drift: false,
  useItem: false,
};

// Touch state
const touchState = {
  joystick: {
    active: false,
    touchId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    angle: 0,
    magnitude: 0,
  },
  buttons: {
    gas: false,
    brake: false,
    drift: false,
    item: false,
  }
};

function initInput() {
  // Keyboard input
  window.addEventListener('keydown', (e) => {
    switch(e.code) {
      case 'ArrowUp':
      case 'KeyW':
        keys.up = true; break;
      case 'ArrowDown':
      case 'KeyS':
        keys.down = true; break;
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = true; break;
      case 'ArrowRight':
      case 'KeyD':
        keys.right = true; break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.drift = true; break;
      case 'Space':
        keys.useItem = true; break;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    switch(e.code) {
      case 'ArrowUp':
      case 'KeyW':
        keys.up = false; break;
      case 'ArrowDown':
      case 'KeyS':
        keys.down = false; break;
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = false; break;
      case 'ArrowRight':
      case 'KeyD':
        keys.right = false; break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.drift = false; break;
      case 'Space':
        keys.useItem = false; break;
    }
  });
  
  // Touch controls
  if (isTouchDevice) {
    initTouchControls();
  }
}

function initTouchControls() {
  const joystickArea = document.getElementById('joystickArea');
  const joystickKnob = document.getElementById('joystickKnob');
  const joystickBase = document.getElementById('joystickBase');
  
  const gasBtn = document.getElementById('gasBtn');
  const brakeBtn = document.getElementById('brakeBtn');
  const driftBtn = document.getElementById('driftBtn');
  const itemBtn = document.getElementById('itemBtn');
  
  // Joystick touch handling
  joystickArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = joystickArea.getBoundingClientRect();
    
    touchState.joystick.active = true;
    touchState.joystick.touchId = touch.identifier;
    touchState.joystick.startX = rect.left + rect.width / 2;
    touchState.joystick.startY = rect.top + rect.height / 2;
    touchState.joystick.currentX = touch.clientX;
    touchState.joystick.currentY = touch.clientY;
    
    joystickKnob.classList.add('active');
    updateJoystick();
  }, { passive: false });
  
  joystickArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchState.joystick.touchId) {
        touchState.joystick.currentX = touch.clientX;
        touchState.joystick.currentY = touch.clientY;
        updateJoystick();
      }
    }
  }, { passive: false });
  
  joystickArea.addEventListener('touchend', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchState.joystick.touchId) {
        touchState.joystick.active = false;
        touchState.joystick.touchId = null;
        touchState.joystick.magnitude = 0;
        keys.left = false;
        keys.right = false;
        
        joystickKnob.classList.remove('active');
        joystickKnob.style.transform = 'translate(0, 0)';
      }
    }
  });
  
  joystickArea.addEventListener('touchcancel', (e) => {
    touchState.joystick.active = false;
    touchState.joystick.touchId = null;
    touchState.joystick.magnitude = 0;
    keys.left = false;
    keys.right = false;
    
    joystickKnob.classList.remove('active');
    joystickKnob.style.transform = 'translate(0, 0)';
  });
  
  function updateJoystick() {
    const dx = touchState.joystick.currentX - touchState.joystick.startX;
    const dy = touchState.joystick.currentY - touchState.joystick.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = CONFIG.JOYSTICK_RADIUS;
    
    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);
    
    touchState.joystick.angle = angle;
    touchState.joystick.magnitude = clampedDistance / maxDistance;
    
    // Update knob position
    const knobX = Math.cos(angle) * clampedDistance;
    const knobY = Math.sin(angle) * clampedDistance;
    joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    
    // Update keys based on horizontal position
    const horizontalMagnitude = Math.abs(Math.cos(angle)) * touchState.joystick.magnitude;
    
    if (dx < -CONFIG.TOUCH_THRESHOLD && horizontalMagnitude > 0.2) {
      keys.left = true;
      keys.right = false;
    } else if (dx > CONFIG.TOUCH_THRESHOLD && horizontalMagnitude > 0.2) {
      keys.right = true;
      keys.left = false;
    } else {
      keys.left = false;
      keys.right = false;
    }
  }
  
  // Button handlers
  function setupButton(btn, keyName, stateKey) {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      keys[keyName] = true;
      touchState.buttons[stateKey] = true;
      btn.classList.add('active');
      
      if (supportsVibration) {
        navigator.vibrate(10);
      }
    }, { passive: false });
    
    btn.addEventListener('touchend', (e) => {
      keys[keyName] = false;
      touchState.buttons[stateKey] = false;
      btn.classList.remove('active');
    });
    
    btn.addEventListener('touchcancel', (e) => {
      keys[keyName] = false;
      touchState.buttons[stateKey] = false;
      btn.classList.remove('active');
    });
  }
  
  setupButton(gasBtn, 'up', 'gas');
  setupButton(brakeBtn, 'down', 'brake');
  setupButton(driftBtn, 'drift', 'drift');
  setupButton(itemBtn, 'useItem', 'item');
  
  // Prevent default touch behaviors on game area
  document.body.addEventListener('touchmove', (e) => {
    if (e.target.closest('#gameContainer')) {
      e.preventDefault();
    }
  }, { passive: false });
}

// ============================================================================
// KART CLASS
// ============================================================================

class Kart {
  constructor(x, y, angle, color, isPlayer = false, name = 'CPU') {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.velocity = { x: 0, y: 0 };
    
    this.color = color;
    this.isPlayer = isPlayer;
    this.name = name;
    
    // Drift state
    this.drifting = false;
    this.driftDirection = 0;
    this.driftBoost = 0;
    this.driftAngleOffset = 0;
    
    // Boost state
    this.boosting = false;
    this.boostTimer = 0;
    
    // Effects
    this.slowed = false;
    this.slowTimer = 0;
    this.shielded = false;
    this.shieldTimer = 0;
    
    // Power-up
    this.item = null;
    
    // Race progress
    this.lap = 0;
    this.checkpoint = 0;
    this.lastCheckpoint = -1;
    this.totalProgress = 0;
    this.position = 1;
    this.finished = false;
    this.finishTime = 0;
    
    // AI state
    this.targetAngle = angle;
    this.aiWaypointIndex = 0;
    
    // Visual
    this.width = 24;
    this.height = 16;
    this.sparkTimer = 0;
    
    // Collision flash
    this.flashTimer = 0;
  }
  
  getMaxSpeed() {
    let max = CONFIG.MAX_SPEED;
    if (this.boosting) max += CONFIG.DRIFT_BOOST_SPEED;
    if (this.slowed) max *= CONFIG.SLOW_FACTOR;
    return max;
  }
  
  update(dt, track) {
    // Update timers
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) this.boosting = false;
    }
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowed = false;
    }
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this.shielded = false;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
    
    // Update spark animation
    if (this.drifting) {
      this.sparkTimer += dt;
    } else {
      this.sparkTimer = 0;
    }
  }
  
  applyBoost() {
    this.boosting = true;
    this.boostTimer = CONFIG.DRIFT_BOOST_DURATION;
    this.driftBoost = 0;
    
    // Spawn boost particles
    spawnParticles(
      this.x - Math.cos(this.angle) * 15,
      this.y - Math.sin(this.angle) * 15,
      15,
      ['#FF6B35', '#FFD93D', '#FF0000'],
      [50, 150],
      [0.3, 0.6],
      [3, 6]
    );
  }
  
  hit() {
    if (this.shielded) {
      this.shielded = false;
      this.shieldTimer = 0;
      // Shield break particles
      spawnParticles(this.x, this.y, 20, ['#00BFFF', '#87CEEB', '#FFFFFF'], [100, 200], [0.3, 0.5], [4, 8]);
      return false;
    }
    
    // Spin out
    this.speed *= 0.3;
    this.flashTimer = 0.5;
    
    // Collision particles
    spawnParticles(this.x, this.y, 10, ['#FFD700', '#FFFFFF', '#FFA500'], [80, 150], [0.2, 0.4], [2, 5]);
    
    // Screen shake for player
    if (this.isPlayer) {
      screenShake.trigger(8, 0.3);
    }
    
    return true;
  }
}

// ============================================================================
// TRACK
// ============================================================================

class Track {
  constructor() {
    this.centerX = CONFIG.TRACK_CENTER_X;
    this.centerY = CONFIG.TRACK_CENTER_Y;
    this.radiusX = CONFIG.TRACK_RADIUS_X;
    this.radiusY = CONFIG.TRACK_RADIUS_Y;
    this.width = CONFIG.TRACK_WIDTH;
    
    // Generate checkpoints around the track
    this.checkpoints = [];
    for (let i = 0; i < CONFIG.CHECKPOINT_COUNT; i++) {
      const angle = (i / CONFIG.CHECKPOINT_COUNT) * Math.PI * 2 - Math.PI / 2;
      this.checkpoints.push({
        x: this.centerX + Math.cos(angle) * this.radiusX,
        y: this.centerY + Math.sin(angle) * this.radiusY,
        angle: angle,
        index: i,
      });
    }
    
    // Generate racing line waypoints for AI
    this.waypoints = [];
    const waypointCount = 32;
    for (let i = 0; i < waypointCount; i++) {
      const angle = (i / waypointCount) * Math.PI * 2 - Math.PI / 2;
      const variation = Math.sin(angle * 3) * 15;
      this.waypoints.push({
        x: this.centerX + Math.cos(angle) * (this.radiusX + variation),
        y: this.centerY + Math.sin(angle) * (this.radiusY + variation),
        angle: angle,
      });
    }
    
    // Start/finish line position
    this.startLine = {
      x: this.centerX,
      y: this.centerY - this.radiusY,
    };
  }
  
  isOnTrack(x, y) {
    const dx = (x - this.centerX) / this.radiusX;
    const dy = (y - this.centerY) / this.radiusY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const innerRadius = 1 - (this.width / 2) / Math.min(this.radiusX, this.radiusY);
    const outerRadius = 1 + (this.width / 2) / Math.min(this.radiusX, this.radiusY);
    
    return dist >= innerRadius && dist <= outerRadius;
  }
  
  getTrackDistance(x, y) {
    const dx = (x - this.centerX) / this.radiusX;
    const dy = (y - this.centerY) / this.radiusY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  getNearestWaypoint(x, y) {
    let nearest = 0;
    let minDist = Infinity;
    
    for (let i = 0; i < this.waypoints.length; i++) {
      const wp = this.waypoints[i];
      const dist = Math.hypot(x - wp.x, y - wp.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    
    return nearest;
  }
  
  checkCheckpoint(kart, prevX, prevY) {
    const checkpoint = this.checkpoints[kart.checkpoint];
    const dist = Math.hypot(kart.x - checkpoint.x, kart.y - checkpoint.y);
    
    if (dist < 50 && kart.lastCheckpoint !== kart.checkpoint) {
      kart.lastCheckpoint = kart.checkpoint;
      kart.checkpoint = (kart.checkpoint + 1) % CONFIG.CHECKPOINT_COUNT;
      
      if (kart.checkpoint === 0 && kart.lastCheckpoint === CONFIG.CHECKPOINT_COUNT - 1) {
        kart.lap++;
        
        // Lap completion effects
        if (kart.isPlayer) {
          screenShake.trigger(3, 0.2);
          if (supportsVibration) navigator.vibrate([50, 50, 50]);
        }
        
        if (kart.lap >= CONFIG.TOTAL_LAPS && !kart.finished) {
          kart.finished = true;
          kart.finishTime = gameState.raceTime;
        }
      }
    }
    
    kart.totalProgress = kart.lap * CONFIG.CHECKPOINT_COUNT + kart.checkpoint + 
      (1 - Math.hypot(kart.x - checkpoint.x, kart.y - checkpoint.y) / 200);
  }
  
  render(ctx) {
    // Draw vibrant grass background with gradient
    const grassGradient = ctx.createRadialGradient(
      this.centerX, this.centerY, 0,
      this.centerX, this.centerY, 400
    );
    grassGradient.addColorStop(0, '#2ECC71');
    grassGradient.addColorStop(1, '#1E8449');
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    
    // Decorative grass pattern
    ctx.fillStyle = 'rgba(39, 174, 96, 0.3)';
    for (let i = 0; i < 50; i++) {
      const x = (i * 47) % CONFIG.WIDTH;
      const y = (i * 31) % CONFIG.HEIGHT;
      ctx.fillRect(x, y, 8, 8);
    }
    
    // Draw outer track edge (dirt/sand)
    const outerGradient = ctx.createRadialGradient(
      this.centerX, this.centerY, 0,
      this.centerX, this.centerY, this.radiusX + this.width
    );
    outerGradient.addColorStop(0.7, '#D4A574');
    outerGradient.addColorStop(1, '#C49A6C');
    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.ellipse(
      this.centerX, this.centerY,
      this.radiusX + this.width / 2 + 10,
      this.radiusY + this.width / 2 + 10,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Draw track surface with better color
    ctx.fillStyle = '#4A4A4A';
    ctx.beginPath();
    ctx.ellipse(
      this.centerX, this.centerY,
      this.radiusX + this.width / 2,
      this.radiusY + this.width / 2,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Track texture (subtle stripes)
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const r = this.radiusX - this.width/2 + (this.width / 8) * i + 8;
      const rY = this.radiusY - this.width/2 + (this.width / 8) * i + 8;
      ctx.beginPath();
      ctx.ellipse(this.centerX, this.centerY, r, rY, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw inner grass
    ctx.fillStyle = '#2ECC71';
    ctx.beginPath();
    ctx.ellipse(
      this.centerX, this.centerY,
      this.radiusX - this.width / 2,
      this.radiusY - this.width / 2,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Inner grass decoration
    ctx.fillStyle = '#27AE60';
    ctx.beginPath();
    ctx.ellipse(
      this.centerX, this.centerY,
      this.radiusX - this.width / 2 - 20,
      this.radiusY - this.width / 2 - 20,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Draw inner track edge (curb - red/white)
    const curbSegments = 24;
    for (let i = 0; i < curbSegments; i++) {
      const startAngle = (i / curbSegments) * Math.PI * 2;
      const endAngle = ((i + 1) / curbSegments) * Math.PI * 2;
      
      ctx.fillStyle = i % 2 === 0 ? '#E74C3C' : '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(
        this.centerX, this.centerY,
        this.radiusX - this.width / 2 + 6,
        this.radiusY - this.width / 2 + 6,
        0, startAngle, endAngle
      );
      ctx.lineTo(
        this.centerX + Math.cos(endAngle) * (this.radiusX - this.width / 2),
        this.centerY + Math.sin(endAngle) * (this.radiusY - this.width / 2)
      );
      ctx.ellipse(
        this.centerX, this.centerY,
        this.radiusX - this.width / 2,
        this.radiusY - this.width / 2,
        0, endAngle, startAngle, true
      );
      ctx.closePath();
      ctx.fill();
    }
    
    // Draw racing stripes (dashed center line)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.ellipse(this.centerX, this.centerY, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw start/finish line
    const startAngle = -Math.PI / 2;
    const x1 = this.centerX + Math.cos(startAngle) * (this.radiusX - this.width / 2);
    const y1 = this.centerY + Math.sin(startAngle) * (this.radiusY - this.width / 2);
    const x2 = this.centerX + Math.cos(startAngle) * (this.radiusX + this.width / 2);
    const y2 = this.centerY + Math.sin(startAngle) * (this.radiusY + this.width / 2);
    
    // Checkered pattern
    const segments = 10;
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;
    
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#FFFFFF' : '#1a1a2e';
        ctx.fillRect(x1 + dx * i - 4, y1 + dy * i - 4 + j * 4, 8, 4);
      }
    }
    
    // Draw checkpoint markers (subtle)
    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    for (const cp of this.checkpoints) {
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// POWER-UPS
// ============================================================================

class PowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.active = true;
    this.respawnTimer = 0;
    this.size = 28;
    this.bobOffset = Math.random() * Math.PI * 2;
    this.rotationOffset = Math.random() * Math.PI * 2;
  }
  
  update(dt) {
    if (!this.active) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.active = true;
      }
    }
    this.bobOffset += dt * 3;
    this.rotationOffset += dt * 2;
  }
  
  collect() {
    this.active = false;
    this.respawnTimer = 5;
    
    // Collection particles
    spawnParticles(this.x, this.y, 12, ['#FFD700', '#FFA500', '#FFFFFF'], [60, 120], [0.3, 0.5], [4, 8]);
    
    const types = ['boost', 'shield', 'slow'];
    return types[Math.floor(Math.random() * types.length)];
  }
  
  render(ctx) {
    if (!this.active) return;
    
    const bob = Math.sin(this.bobOffset) * 4;
    const y = this.y + bob;
    const glow = 0.5 + Math.sin(this.bobOffset * 2) * 0.2;
    
    // Glow effect
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15 * glow;
    
    // Question mark box style with gradient
    const boxGradient = ctx.createLinearGradient(
      this.x - this.size/2, y - this.size/2,
      this.x + this.size/2, y + this.size/2
    );
    boxGradient.addColorStop(0, '#FFD700');
    boxGradient.addColorStop(0.5, '#FFA500');
    boxGradient.addColorStop(1, '#FF8C00');
    
    ctx.fillStyle = boxGradient;
    ctx.fillRect(this.x - this.size/2, y - this.size/2, this.size, this.size);
    
    // Box border
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x - this.size/2, y - this.size/2, this.size, this.size);
    
    // Question mark
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', this.x, y);
  }
}

// ============================================================================
// PHYSICS ENGINE
// ============================================================================

function updatePlayerKart(kart, dt) {
  if (kart.finished) return;
  
  const maxSpeed = kart.getMaxSpeed();
  
  // Acceleration (including touch joystick for vertical movement if needed)
  if (keys.up) {
    kart.speed += CONFIG.ACCELERATION * dt;
  } else if (keys.down) {
    kart.speed -= CONFIG.BRAKE_POWER * dt;
  } else {
    kart.speed -= CONFIG.DECELERATION * dt * 0.5;
  }
  
  kart.speed = Math.max(0, Math.min(maxSpeed, kart.speed));
  
  // Steering
  const speedFactor = 1 - (kart.speed / CONFIG.MAX_SPEED) * CONFIG.STEERING_SPEED_FACTOR;
  let steerRate = CONFIG.STEERING_BASE * speedFactor;
  
  // Apply joystick magnitude for more nuanced steering
  if (touchState.joystick.active) {
    steerRate *= Math.min(1, touchState.joystick.magnitude * 1.5);
  }
  
  let steering = 0;
  if (keys.left) steering = -1;
  if (keys.right) steering = 1;
  
  // Drift mechanics
  if (keys.drift && kart.speed > 50 && steering !== 0) {
    if (!kart.drifting) {
      kart.drifting = true;
      kart.driftDirection = steering;
      if (supportsVibration) navigator.vibrate(30);
    }
    
    kart.driftBoost = Math.min(CONFIG.DRIFT_BOOST_MAX, kart.driftBoost + CONFIG.DRIFT_BOOST_RATE * dt);
    kart.driftAngleOffset += kart.driftDirection * steerRate * 0.5 * dt;
    kart.driftAngleOffset = Math.max(-0.5, Math.min(0.5, kart.driftAngleOffset));
    kart.angle += steering * steerRate * 0.7 * dt;
    kart.speed *= CONFIG.DRIFT_GRIP;
    
    // Drift sparks
    if (Math.random() < 0.3) {
      const boostLevel = kart.driftBoost / CONFIG.DRIFT_BOOST_MAX;
      const colors = boostLevel < 0.33 ? ['#FFFF00', '#FFA500'] : 
                     boostLevel < 0.66 ? ['#FFA500', '#FF4500'] : 
                     ['#FF0000', '#FF4500', '#FFFFFF'];
      spawnParticles(
        kart.x - Math.cos(kart.angle) * 12,
        kart.y - Math.sin(kart.angle) * 12,
        2, colors, [30, 80], [0.1, 0.3], [2, 4]
      );
    }
    
  } else {
    if (kart.drifting) {
      if (kart.driftBoost > 30) {
        kart.applyBoost();
        if (supportsVibration) navigator.vibrate([30, 20, 50]);
      }
      kart.drifting = false;
      kart.driftAngleOffset = 0;
      kart.driftBoost = 0;
    }
    
    kart.angle += steering * steerRate * dt;
  }
  
  // Calculate velocity
  const moveAngle = kart.angle + kart.driftAngleOffset;
  kart.velocity.x = Math.cos(moveAngle) * kart.speed * 0.5;
  kart.velocity.y = Math.sin(moveAngle) * kart.speed * 0.5;
  
  // Apply velocity
  kart.x += kart.velocity.x * dt;
  kart.y += kart.velocity.y * dt;
  
  // Use item
  if (keys.useItem && kart.item) {
    useItem(kart);
    keys.useItem = false;
  }
  
  kart.update(dt);
}

function updateAIKart(kart, dt, track, playerKart, allKarts) {
  if (kart.finished) return;
  
  const currentWaypoint = track.getNearestWaypoint(kart.x, kart.y);
  const targetIndex = (currentWaypoint + 3) % track.waypoints.length;
  const target = track.waypoints[targetIndex];
  
  const targetAngle = Math.atan2(target.y - kart.y, target.x - kart.x);
  
  let angleDiff = targetAngle - kart.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  
  const steerRate = CONFIG.STEERING_BASE * 0.8;
  if (Math.abs(angleDiff) > 0.1) {
    kart.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), steerRate * dt);
  }
  
  let targetSpeed = CONFIG.MAX_SPEED * 0.85;
  
  if (playerKart) {
    const positionDiff = kart.totalProgress - playerKart.totalProgress;
    
    if (positionDiff > 0.5) {
      targetSpeed *= (1 - CONFIG.RUBBER_BAND_STRENGTH * 0.5);
    } else if (positionDiff < -0.5) {
      targetSpeed *= (1 + CONFIG.RUBBER_BAND_STRENGTH);
    }
  }
  
  for (const other of allKarts) {
    if (other === kart) continue;
    
    const dist = Math.hypot(other.x - kart.x, other.y - kart.y);
    if (dist < 60) {
      const avoidAngle = Math.atan2(kart.y - other.y, kart.x - other.x);
      let avoidDiff = avoidAngle - kart.angle;
      while (avoidDiff > Math.PI) avoidDiff -= Math.PI * 2;
      while (avoidDiff < -Math.PI) avoidDiff += Math.PI * 2;
      
      kart.angle += Math.sign(avoidDiff) * 0.5 * dt;
    }
    if (dist < 40) {
      targetSpeed *= 0.9;
    }
  }
  
  if (kart.speed < targetSpeed) {
    kart.speed += CONFIG.ACCELERATION * 0.8 * dt;
  } else {
    kart.speed -= CONFIG.DECELERATION * 0.5 * dt;
  }
  
  kart.speed = Math.max(0, Math.min(kart.getMaxSpeed(), kart.speed));
  
  kart.velocity.x = Math.cos(kart.angle) * kart.speed * 0.5;
  kart.velocity.y = Math.sin(kart.angle) * kart.speed * 0.5;
  
  kart.x += kart.velocity.x * dt;
  kart.y += kart.velocity.y * dt;
  
  if (kart.item && Math.random() < 0.01) {
    useItem(kart);
  }
  
  kart.update(dt);
}

// ============================================================================
// COLLISION DETECTION
// ============================================================================

function handleCollisions(karts, track, powerUps) {
  for (const kart of karts) {
    const trackDist = track.getTrackDistance(kart.x, kart.y);
    const innerLimit = 1 - (track.width / 2 - 15) / Math.min(track.radiusX, track.radiusY);
    const outerLimit = 1 + (track.width / 2 - 15) / Math.min(track.radiusX, track.radiusY);
    
    if (trackDist < innerLimit || trackDist > outerLimit) {
      const wasOnTrack = kart.speed > 20;
      kart.speed *= 0.7;
      
      if (wasOnTrack && kart.isPlayer) {
        screenShake.trigger(5, 0.2);
        spawnParticles(kart.x, kart.y, 5, ['#8B4513', '#A0522D', '#CD853F'], [40, 80], [0.2, 0.4], [3, 6]);
      }
      
      const angle = Math.atan2(kart.y - track.centerY, kart.x - track.centerX);
      const targetDist = trackDist < innerLimit ? innerLimit : outerLimit;
      
      kart.x = track.centerX + Math.cos(angle) * targetDist * track.radiusX;
      kart.y = track.centerY + Math.sin(angle) * targetDist * track.radiusY;
    }
    
    track.checkCheckpoint(kart, kart.x - kart.velocity.x * 0.016, kart.y - kart.velocity.y * 0.016);
    
    for (const powerUp of powerUps) {
      if (!powerUp.active) continue;
      if (kart.item) continue;
      
      const dist = Math.hypot(powerUp.x - kart.x, powerUp.y - kart.y);
      if (dist < powerUp.size + 10) {
        kart.item = powerUp.collect();
        if (kart.isPlayer && supportsVibration) navigator.vibrate(20);
      }
    }
  }
  
  // Kart-to-kart collision
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const k1 = karts[i];
      const k2 = karts[j];
      
      const dist = Math.hypot(k2.x - k1.x, k2.y - k1.y);
      const minDist = 25;
      
      if (dist < minDist) {
        const angle = Math.atan2(k2.y - k1.y, k2.x - k1.x);
        const overlap = minDist - dist;
        
        k1.x -= Math.cos(angle) * overlap / 2;
        k1.y -= Math.sin(angle) * overlap / 2;
        k2.x += Math.cos(angle) * overlap / 2;
        k2.y += Math.sin(angle) * overlap / 2;
        
        const speedDiff = k1.speed - k2.speed;
        k1.speed -= speedDiff * 0.3;
        k2.speed += speedDiff * 0.3;
        
        // Collision effects
        const midX = (k1.x + k2.x) / 2;
        const midY = (k1.y + k2.y) / 2;
        spawnParticles(midX, midY, 6, ['#FFFFFF', '#FFD700'], [50, 100], [0.1, 0.3], [2, 4]);
        
        if (k1.isPlayer || k2.isPlayer) {
          screenShake.trigger(4, 0.15);
          if (supportsVibration) navigator.vibrate(15);
        }
      }
    }
  }
}

// ============================================================================
// ITEM USAGE
// ============================================================================

function useItem(kart) {
  const item = kart.item;
  kart.item = null;
  
  switch (item) {
    case 'boost':
      kart.boosting = true;
      kart.boostTimer = CONFIG.BOOST_DURATION;
      spawnParticles(kart.x, kart.y, 15, ['#FF6B35', '#FFD93D', '#FF0000'], [80, 150], [0.3, 0.6], [4, 8]);
      if (kart.isPlayer && supportsVibration) navigator.vibrate([50, 30, 50]);
      break;
      
    case 'shield':
      kart.shielded = true;
      kart.shieldTimer = CONFIG.SHIELD_DURATION;
      spawnParticles(kart.x, kart.y, 12, ['#00BFFF', '#87CEEB', '#FFFFFF'], [60, 100], [0.3, 0.5], [3, 6]);
      break;
      
    case 'slow':
      for (const other of game.karts) {
        if (other !== kart && !other.shielded) {
          other.slowed = true;
          other.slowTimer = CONFIG.SLOW_DURATION;
          spawnParticles(other.x, other.y, 8, ['#9B59B6', '#8E44AD'], [40, 80], [0.3, 0.5], [3, 5]);
        }
      }
      break;
  }
}

// ============================================================================
// POSITION CALCULATION
// ============================================================================

function calculatePositions(karts) {
  const sorted = [...karts].sort((a, b) => b.totalProgress - a.totalProgress);
  
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].position = i + 1;
  }
}

// ============================================================================
// RENDERING
// ============================================================================

function renderKart(ctx, kart) {
  ctx.save();
  ctx.translate(kart.x, kart.y);
  ctx.rotate(kart.angle);
  
  // Flash effect on hit
  if (kart.flashTimer > 0 && Math.floor(kart.flashTimer * 10) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(-kart.width/2 + 3, -kart.height/2 + 5, kart.width, kart.height);
  
  // Kart body with gradient
  const bodyGradient = ctx.createLinearGradient(-kart.width/2, 0, kart.width/2, 0);
  bodyGradient.addColorStop(0, kart.color);
  bodyGradient.addColorStop(0.5, lightenColor(kart.color, 30));
  bodyGradient.addColorStop(1, kart.color);
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(-kart.width/2, -kart.height/2, kart.width, kart.height);
  
  // Kart outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(-kart.width/2, -kart.height/2, kart.width, kart.height);
  
  // Driver (small circle with helmet)
  ctx.fillStyle = '#FFE4C4';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  
  // Helmet
  ctx.fillStyle = kart.color;
  ctx.beginPath();
  ctx.arc(0, -2, 4, Math.PI, 0);
  ctx.fill();
  
  // Wheels
  ctx.fillStyle = '#2C2C2C';
  ctx.fillRect(-kart.width/2 - 3, -kart.height/2 - 2, 7, 6);
  ctx.fillRect(-kart.width/2 - 3, kart.height/2 - 4, 7, 6);
  ctx.fillRect(kart.width/2 - 4, -kart.height/2 - 2, 7, 6);
  ctx.fillRect(kart.width/2 - 4, kart.height/2 - 4, 7, 6);
  
  ctx.restore();
  ctx.globalAlpha = 1;
  
  // Boost flames (rendered separately so they're not rotated weirdly)
  if (kart.boosting) {
    const flameX = kart.x - Math.cos(kart.angle) * 18;
    const flameY = kart.y - Math.sin(kart.angle) * 18;
    
    for (let i = 0; i < 5; i++) {
      const flameColors = ['#FF0000', '#FF6B35', '#FFD93D'];
      ctx.fillStyle = flameColors[i % 3];
      const ox = (Math.random() - 0.5) * 10;
      const oy = (Math.random() - 0.5) * 10;
      const size = 5 + Math.random() * 5;
      ctx.fillRect(flameX + ox - size/2, flameY + oy - size/2, size, size);
    }
  }
  
  // Shield effect
  if (kart.shielded) {
    const pulse = 0.5 + Math.sin(Date.now() / 80) * 0.3;
    ctx.strokeStyle = `rgba(52, 152, 219, ${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(kart.x, kart.y, 22, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  // Slow effect
  if (kart.slowed) {
    ctx.fillStyle = `rgba(142, 68, 173, ${0.3 + Math.sin(Date.now() / 100) * 0.2})`;
    ctx.beginPath();
    ctx.arc(kart.x, kart.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Position indicator for player
  if (kart.isPlayer) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(kart.x, kart.y - 25);
    ctx.lineTo(kart.x - 5, kart.y - 32);
    ctx.lineTo(kart.x + 5, kart.y - 32);
    ctx.closePath();
    ctx.fill();
  }
}

// Helper function to lighten colors
function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function renderUI(ctx, playerKart) {
  // Semi-transparent background for UI
  ctx.fillStyle = 'rgba(26, 26, 46, 0.85)';
  ctx.strokeStyle = '#e94560';
  ctx.lineWidth = 2;
  
  // Rounded rect helper
  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  
  // Main stats panel
  roundedRect(10, 10, 180, 105, 8);
  
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px system-ui, sans-serif';
  
  // Position with medal/badge
  const posColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#FFFFFF'];
  const posEmoji = ['🥇', '🥈', '🥉', ''];
  const posText = ['1ST', '2ND', '3RD', '4TH'][playerKart.position - 1];
  
  ctx.fillStyle = posColors[playerKart.position - 1];
  ctx.fillText(`${posEmoji[playerKart.position - 1]} ${posText}`, 20, 35);
  
  // Lap
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`🏁 LAP ${Math.min(playerKart.lap + 1, CONFIG.TOTAL_LAPS)}/${CONFIG.TOTAL_LAPS}`, 20, 55);
  
  // Speed with color coding
  const speedPercent = playerKart.speed / CONFIG.MAX_SPEED;
  ctx.fillStyle = speedPercent > 0.8 ? '#E74C3C' : speedPercent > 0.5 ? '#F39C12' : '#2ECC71';
  const speedDisplay = Math.round(playerKart.speed);
  ctx.fillText(`⚡ ${speedDisplay} km/h`, 20, 75);
  
  // Time
  ctx.fillStyle = '#FFFFFF';
  const minutes = Math.floor(gameState.raceTime / 60);
  const seconds = Math.floor(gameState.raceTime % 60);
  const ms = Math.floor((gameState.raceTime % 1) * 100);
  ctx.fillText(`⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`, 20, 95);
  
  // Item box
  if (playerKart.item) {
    roundedRect(CONFIG.WIDTH - 85, 10, 75, 55, 8);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ITEM', CONFIG.WIDTH - 47, 28);
    
    const itemColors = { boost: '#E74C3C', shield: '#3498DB', slow: '#9B59B6' };
    const itemEmoji = { boost: '🚀', shield: '🛡️', slow: '🐌' };
    
    ctx.fillStyle = itemColors[playerKart.item] || '#FFFFFF';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(itemEmoji[playerKart.item] || '?', CONFIG.WIDTH - 47, 52);
  }
  
  // Drift boost meter
  if (playerKart.drifting) {
    const boostWidth = 120;
    const boostHeight = 12;
    const boostX = CONFIG.WIDTH / 2 - boostWidth / 2;
    const boostY = CONFIG.HEIGHT - 50;
    
    roundedRect(boostX - 8, boostY - 20, boostWidth + 16, boostHeight + 28, 6);
    
    // Background bar
    ctx.fillStyle = '#333333';
    ctx.fillRect(boostX, boostY, boostWidth, boostHeight);
    
    // Fill bar with gradient
    const fillPercent = playerKart.driftBoost / CONFIG.DRIFT_BOOST_MAX;
    const fillGradient = ctx.createLinearGradient(boostX, 0, boostX + boostWidth * fillPercent, 0);
    
    if (fillPercent < 0.33) {
      fillGradient.addColorStop(0, '#F1C40F');
      fillGradient.addColorStop(1, '#F39C12');
    } else if (fillPercent < 0.66) {
      fillGradient.addColorStop(0, '#E67E22');
      fillGradient.addColorStop(1, '#D35400');
    } else {
      fillGradient.addColorStop(0, '#E74C3C');
      fillGradient.addColorStop(1, '#C0392B');
    }
    
    ctx.fillStyle = fillGradient;
    ctx.fillRect(boostX, boostY, boostWidth * fillPercent, boostHeight);
    
    // Border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(boostX, boostY, boostWidth, boostHeight);
    
    // Label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOOST', CONFIG.WIDTH / 2, boostY - 6);
  }
  
  // Mini-map
  renderMiniMap(ctx);
}

function renderMiniMap(ctx) {
  const mapX = CONFIG.WIDTH - 115;
  const mapY = CONFIG.HEIGHT - 105;
  const mapSize = 95;
  
  // Map background
  ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
  ctx.strokeStyle = '#e94560';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Track outline
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(
    mapX + mapSize / 2,
    mapY + mapSize / 2,
    32, 24, 0, 0, Math.PI * 2
  );
  ctx.stroke();
  
  // Track surface
  ctx.strokeStyle = '#4A4A4A';
  ctx.lineWidth = 8;
  ctx.stroke();
  
  // Karts on mini-map
  for (const kart of game.karts) {
    const mx = mapX + mapSize / 2 + ((kart.x - CONFIG.TRACK_CENTER_X) / CONFIG.TRACK_RADIUS_X) * 32;
    const my = mapY + mapSize / 2 + ((kart.y - CONFIG.TRACK_CENTER_Y) / CONFIG.TRACK_RADIUS_Y) * 24;
    
    ctx.fillStyle = kart.color;
    ctx.beginPath();
    ctx.arc(mx, my, kart.isPlayer ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    
    if (kart.isPlayer) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function renderCountdown(ctx) {
  if (gameState.countdown > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    
    const countNum = Math.ceil(gameState.countdown);
    const scale = 1 + (1 - (gameState.countdown % 1)) * 0.2;
    
    ctx.save();
    ctx.translate(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2);
    ctx.scale(scale, scale);
    
    // Countdown number with glow
    ctx.shadowColor = '#e94560';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 100px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(countNum.toString(), 0, -20);
    
    ctx.shadowBlur = 0;
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillStyle = '#e94560';
    ctx.fillText('GET READY!', 0, 60);
    
    ctx.restore();
  }
}

function renderFinish(ctx, playerKart) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (playerKart.finished) {
    // Trophy/medal based on position
    const trophies = ['🏆', '🥈', '🥉', ''];
    const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#FFFFFF'];
    
    ctx.font = '80px system-ui, sans-serif';
    ctx.fillText(trophies[playerKart.position - 1], CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 80);
    
    ctx.fillStyle = colors[playerKart.position - 1];
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.shadowColor = colors[playerKart.position - 1];
    ctx.shadowBlur = 20;
    ctx.fillText('FINISH!', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 10);
    
    ctx.shadowBlur = 0;
    const posText = ['1ST PLACE!', '2ND PLACE!', '3RD PLACE!', '4TH PLACE!'][playerKart.position - 1];
    ctx.fillText(posText, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 50);
    
    const minutes = Math.floor(playerKart.finishTime / 60);
    const seconds = Math.floor(playerKart.finishTime % 60);
    const ms = Math.floor((playerKart.finishTime % 1) * 100);
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`TIME: ${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 100);
    
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#a0a0a0';
    const restartText = isTouchDevice ? 'Tap to restart' : 'Press SPACE to restart';
    ctx.fillText(restartText, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 140);
  }
}

function renderControls(ctx) {
  // Only show on desktop
  if (isTouchDevice) return;
  
  ctx.fillStyle = 'rgba(26, 26, 46, 0.8)';
  ctx.strokeStyle = 'rgba(233, 69, 96, 0.5)';
  ctx.lineWidth = 1;
  
  const y = CONFIG.HEIGHT - 48;
  ctx.beginPath();
  ctx.roundRect(10, y - 5, 300, 40, 6);
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('↑ W: Gas  ↓ S: Brake  ← A → D: Steer', 20, y + 10);
  ctx.fillText('SHIFT: Drift  SPACE: Use Item', 20, y + 25);
}

// ============================================================================
// RESPONSIVE CANVAS SCALING
// ============================================================================

function resizeCanvas() {
  const canvas = game.canvas;
  const container = document.getElementById('canvasWrapper');
  
  if (!canvas || !container) return;
  
  const maxWidth = window.innerWidth - 40;
  const maxHeight = window.innerHeight - (isTouchDevice ? 40 : 120);
  
  const aspectRatio = CONFIG.WIDTH / CONFIG.HEIGHT;
  
  let newWidth = maxWidth;
  let newHeight = newWidth / aspectRatio;
  
  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = newHeight * aspectRatio;
  }
  
  canvas.style.width = `${newWidth}px`;
  canvas.style.height = `${newHeight}px`;
}

function checkOrientation() {
  const portraitWarning = document.getElementById('portraitWarning');
  if (!portraitWarning) return;
  
  if (isMobile && window.innerHeight > window.innerWidth) {
    portraitWarning.style.display = 'flex';
  } else {
    portraitWarning.style.display = 'none';
  }
}

// ============================================================================
// FULLSCREEN HANDLING
// ============================================================================

function initFullscreen() {
  const btn = document.getElementById('fullscreenBtn');
  if (!btn) return;
  
  btn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.() ||
      document.documentElement.webkitRequestFullscreen?.() ||
      document.documentElement.msRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() ||
      document.webkitExitFullscreen?.() ||
      document.msExitFullscreen?.();
    }
  });
  
  document.addEventListener('fullscreenchange', () => {
    btn.textContent = document.fullscreenElement ? '⛶' : '⛶';
    setTimeout(resizeCanvas, 100);
  });
}

// ============================================================================
// GAME OBJECT
// ============================================================================

const game = {
  canvas: null,
  ctx: null,
  track: null,
  karts: [],
  powerUps: [],
  lastTime: 0,
  
  init() {
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'gameCanvas';
      document.body.appendChild(this.canvas);
    }
    
    this.canvas.width = CONFIG.WIDTH;
    this.canvas.height = CONFIG.HEIGHT;
    this.ctx = this.canvas.getContext('2d');
    
    this.ctx.imageSmoothingEnabled = false;
    
    initInput();
    initFullscreen();
    
    // Handle window resize
    window.addEventListener('resize', () => {
      resizeCanvas();
      checkOrientation();
    });
    
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        resizeCanvas();
        checkOrientation();
      }, 100);
    });
    
    resizeCanvas();
    checkOrientation();
    
    // Touch restart on finish screen
    if (isTouchDevice) {
      this.canvas.addEventListener('touchstart', () => {
        if (gameState.finished) {
          this.reset();
        }
      });
    }
    
    this.reset();
    
    // Hide loading screen
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  },
  
  reset() {
    this.track = new Track();
    this.karts = [];
    
    const startAngle = -Math.PI / 2;
    const kartColors = ['#E60012', '#F472B6', '#22C55E', '#3B82F6'];
    const kartNames = ['Player', 'Peach', 'Luigi', 'Toad'];
    
    for (let i = 0; i < 4; i++) {
      const offset = (i - 1.5) * 30;
      const rowOffset = Math.floor(i / 2) * 40;
      const x = this.track.centerX + Math.cos(startAngle - 0.1) * (this.track.radiusX + offset);
      const y = this.track.centerY + Math.sin(startAngle - 0.1) * (this.track.radiusY + offset) + rowOffset;
      
      const kart = new Kart(
        x, y,
        startAngle + Math.PI / 2,
        kartColors[i],
        i === 0,
        kartNames[i]
      );
      this.karts.push(kart);
    }
    
    this.powerUps = [];
    for (let i = 0; i < CONFIG.POWERUP_COUNT; i++) {
      const angle = (i / CONFIG.POWERUP_COUNT) * Math.PI * 2 + Math.PI / 4;
      const variation = (Math.random() - 0.5) * 40;
      const x = this.track.centerX + Math.cos(angle) * (this.track.radiusX + variation);
      const y = this.track.centerY + Math.sin(angle) * (this.track.radiusY + variation);
      this.powerUps.push(new PowerUp(x, y));
    }
    
    // Clear particles
    particles.length = 0;
    
    gameState.running = false;
    gameState.countdown = 3;
    gameState.raceTime = 0;
    gameState.finished = false;
    gameState.winner = null;
    
    this.lastTime = performance.now();
  },
  
  update(dt) {
    // Update screen shake
    screenShake.update(dt);
    
    // Countdown
    if (gameState.countdown > 0) {
      gameState.countdown -= dt;
      if (gameState.countdown <= 0) {
        gameState.running = true;
        if (supportsVibration) navigator.vibrate([100, 50, 100, 50, 200]);
      }
      return;
    }
    
    if (!gameState.running) return;
    
    gameState.raceTime += dt;
    
    const playerKart = this.karts.find(k => k.isPlayer);
    
    for (const kart of this.karts) {
      if (kart.isPlayer) {
        updatePlayerKart(kart, dt);
      } else {
        updateAIKart(kart, dt, this.track, playerKart, this.karts);
      }
    }
    
    handleCollisions(this.karts, this.track, this.powerUps);
    
    for (const powerUp of this.powerUps) {
      powerUp.update(dt);
    }
    
    updateParticles(dt);
    calculatePositions(this.karts);
    
    if (playerKart.finished) {
      gameState.finished = true;
      if (supportsVibration && !gameState.vibratedFinish) {
        navigator.vibrate([100, 100, 100, 100, 300]);
        gameState.vibratedFinish = true;
      }
    }
    
    if (gameState.finished && keys.useItem) {
      this.reset();
      keys.useItem = false;
    }
    
    // Update DOM UI (for desktop)
    if (!isTouchDevice) {
      updateDOMUI(playerKart);
    }
  },
  
  render() {
    this.ctx.save();
    
    // Apply screen shake
    this.ctx.translate(screenShake.x, screenShake.y);
    
    // Clear
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(-10, -10, CONFIG.WIDTH + 20, CONFIG.HEIGHT + 20);
    
    // Draw track
    this.track.render(this.ctx);
    
    // Draw power-ups
    for (const powerUp of this.powerUps) {
      powerUp.render(this.ctx);
    }
    
    // Draw particles (behind karts)
    renderParticles(this.ctx);
    
    // Sort karts by Y position for proper layering
    const sortedKarts = [...this.karts].sort((a, b) => a.y - b.y);
    
    // Draw karts
    for (const kart of sortedKarts) {
      renderKart(this.ctx, kart);
    }
    
    this.ctx.restore();
    
    // Find player kart for UI
    const playerKart = this.karts.find(k => k.isPlayer);
    
    // Draw UI
    renderUI(this.ctx, playerKart);
    renderControls(this.ctx);
    
    // Countdown overlay
    if (gameState.countdown > 0) {
      renderCountdown(this.ctx);
    }
    
    // Finish overlay
    if (gameState.finished) {
      renderFinish(this.ctx, playerKart);
    }
  },
  
  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;
    
    this.update(dt);
    this.render();
    
    requestAnimationFrame((t) => this.loop(t));
  },
  
  start() {
    this.init();
    requestAnimationFrame((t) => this.loop(t));
  }
};

// Update DOM UI elements (desktop only)
function updateDOMUI(playerKart) {
  const lapEl = document.getElementById('lap');
  const speedEl = document.getElementById('speed');
  const positionEl = document.getElementById('position');
  const timeEl = document.getElementById('time');
  
  if (lapEl) lapEl.textContent = `${Math.min(playerKart.lap + 1, CONFIG.TOTAL_LAPS)}/${CONFIG.TOTAL_LAPS}`;
  if (speedEl) speedEl.textContent = Math.round(playerKart.speed);
  if (positionEl) {
    const posText = ['1st', '2nd', '3rd', '4th'][playerKart.position - 1];
    positionEl.textContent = `${posText}/4`;
  }
  if (timeEl) {
    const minutes = Math.floor(gameState.raceTime / 60);
    const seconds = Math.floor(gameState.raceTime % 60);
    const ms = Math.floor((gameState.raceTime % 1) * 100);
    timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
}

// ============================================================================
// START GAME
// ============================================================================

function startGame() {
  const startScreen = document.getElementById('startScreen');
  if (startScreen) {
    startScreen.style.display = 'none';
  }
  
  game.reset();
  gameState.countdown = 3;
  
  // Resize after hiding start screen
  setTimeout(resizeCanvas, 50);
}

// Make startGame globally accessible
window.startGame = startGame;

// Auto-start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    game.start();
    // Remove loading screen
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.style.display = 'none';
  });
} else {
  game.start();
  // Remove loading screen
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) loadingScreen.style.display = 'none';
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { game, CONFIG };
}
