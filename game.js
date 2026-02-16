/**
 * 16-BIT MARIO KART STYLE RACING GAME ENGINE
 * No external libraries - pure JavaScript
 * Focus: Tight, responsive controls with retro aesthetic
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Canvas
  WIDTH: 800,
  HEIGHT: 600,
  
  // Physics
  MAX_SPEED: 200,           // km/h
  ACCELERATION: 120,        // km/h per second
  DECELERATION: 80,         // natural slowdown
  BRAKE_POWER: 200,         // brake deceleration
  STEERING_BASE: 3.5,       // base turn rate (radians/sec)
  STEERING_SPEED_FACTOR: 0.7, // how much speed affects steering
  FRICTION: 0.98,           // per-frame multiplier
  
  // Drift
  DRIFT_GRIP: 0.92,         // grip while drifting
  DRIFT_BOOST_RATE: 40,     // boost charge per second
  DRIFT_BOOST_MAX: 100,     // max boost charge
  DRIFT_BOOST_SPEED: 50,    // speed bonus from boost
  DRIFT_BOOST_DURATION: 1.5,// seconds
  
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
  PIXEL_SIZE: 2,            // retro pixel scaling
};

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

function initInput() {
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
    // Prevent scrolling
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
}

// ============================================================================
// KART CLASS
// ============================================================================

class Kart {
  constructor(x, y, angle, color, isPlayer = false, name = 'CPU') {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;              // km/h
    this.velocity = { x: 0, y: 0 };
    
    this.color = color;
    this.isPlayer = isPlayer;
    this.name = name;
    
    // Drift state
    this.drifting = false;
    this.driftDirection = 0;     // -1 left, 1 right
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
  }
  
  hit() {
    if (this.shielded) {
      this.shielded = false;
      this.shieldTimer = 0;
      return false;
    }
    // Spin out
    this.speed *= 0.3;
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
      // Slight variation to make AI more interesting
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
  
  // Check if point is on track
  isOnTrack(x, y) {
    // Normalize to ellipse space
    const dx = (x - this.centerX) / this.radiusX;
    const dy = (y - this.centerY) / this.radiusY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const innerRadius = 1 - (this.width / 2) / Math.min(this.radiusX, this.radiusY);
    const outerRadius = 1 + (this.width / 2) / Math.min(this.radiusX, this.radiusY);
    
    return dist >= innerRadius && dist <= outerRadius;
  }
  
  // Get distance from track center (for wall collision)
  getTrackDistance(x, y) {
    const dx = (x - this.centerX) / this.radiusX;
    const dy = (y - this.centerY) / this.radiusY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // Get nearest point on racing line
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
  
  // Check checkpoint crossing
  checkCheckpoint(kart, prevX, prevY) {
    const checkpoint = this.checkpoints[kart.checkpoint];
    
    // Simple distance-based check
    const dist = Math.hypot(kart.x - checkpoint.x, kart.y - checkpoint.y);
    
    if (dist < 50 && kart.lastCheckpoint !== kart.checkpoint) {
      kart.lastCheckpoint = kart.checkpoint;
      kart.checkpoint = (kart.checkpoint + 1) % CONFIG.CHECKPOINT_COUNT;
      
      // Completed a lap?
      if (kart.checkpoint === 0 && kart.lastCheckpoint === CONFIG.CHECKPOINT_COUNT - 1) {
        kart.lap++;
        if (kart.lap >= CONFIG.TOTAL_LAPS && !kart.finished) {
          kart.finished = true;
          kart.finishTime = gameState.raceTime;
        }
      }
    }
    
    // Calculate total progress for position
    kart.totalProgress = kart.lap * CONFIG.CHECKPOINT_COUNT + kart.checkpoint + 
      (1 - Math.hypot(kart.x - checkpoint.x, kart.y - checkpoint.y) / 200);
  }
  
  render(ctx) {
    // Draw grass background
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    
    // Draw outer track edge
    ctx.fillStyle = '#CD853F';
    ctx.beginPath();
    ctx.ellipse(
      this.centerX, this.centerY,
      this.radiusX + this.width / 2 + 10,
      this.radiusY + this.width / 2 + 10,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Draw track surface
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.ellipse(
      this.centerX, this.centerY,
      this.radiusX + this.width / 2,
      this.radiusY + this.width / 2,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Draw inner grass
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.ellipse(
      this.centerX, this.centerY,
      this.radiusX - this.width / 2,
      this.radiusY - this.width / 2,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Draw inner track edge
    ctx.fillStyle = '#CD853F';
    ctx.beginPath();
    ctx.ellipse(
      this.centerX, this.centerY,
      this.radiusX - this.width / 2 + 5,
      this.radiusY - this.width / 2 + 5,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.ellipse(
      this.centerX, this.centerY,
      this.radiusX - this.width / 2 - 5,
      this.radiusY - this.width / 2 - 5,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Draw racing stripes (dashed center line)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 20]);
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
    const segments = 8;
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;
    
    for (let i = 0; i < segments; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#000000';
      ctx.fillRect(x1 + dx * i - 2, y1 + dy * i - 5, 8, 10);
    }
    
    // Draw checkpoints (subtle markers)
    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
    for (const cp of this.checkpoints) {
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 8, 0, Math.PI * 2);
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
    this.size = 24;
    this.bobOffset = Math.random() * Math.PI * 2;
  }
  
  update(dt) {
    if (!this.active) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.active = true;
      }
    }
    this.bobOffset += dt * 3;
  }
  
  collect() {
    this.active = false;
    this.respawnTimer = 5; // Respawn after 5 seconds
    
    // Random power-up
    const types = ['boost', 'shield', 'slow'];
    return types[Math.floor(Math.random() * types.length)];
  }
  
  render(ctx) {
    if (!this.active) return;
    
    const bob = Math.sin(this.bobOffset) * 3;
    const y = this.y + bob;
    
    // Question mark box style
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(this.x - this.size/2, y - this.size/2, this.size, this.size);
    
    ctx.fillStyle = '#B8860B';
    ctx.fillRect(this.x - this.size/2, y - this.size/2, this.size, 3);
    ctx.fillRect(this.x - this.size/2, y + this.size/2 - 3, this.size, 3);
    ctx.fillRect(this.x - this.size/2, y - this.size/2, 3, this.size);
    ctx.fillRect(this.x + this.size/2 - 3, y - this.size/2, 3, this.size);
    
    // Question mark
    ctx.fillStyle = '#8B4513';
    ctx.font = 'bold 14px monospace';
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
  
  // Acceleration
  if (keys.up) {
    kart.speed += CONFIG.ACCELERATION * dt;
  } else if (keys.down) {
    kart.speed -= CONFIG.BRAKE_POWER * dt;
  } else {
    // Natural deceleration
    kart.speed -= CONFIG.DECELERATION * dt * 0.5;
  }
  
  // Clamp speed
  kart.speed = Math.max(0, Math.min(maxSpeed, kart.speed));
  
  // Steering - tighter at low speeds
  const speedFactor = 1 - (kart.speed / CONFIG.MAX_SPEED) * CONFIG.STEERING_SPEED_FACTOR;
  const steerRate = CONFIG.STEERING_BASE * speedFactor;
  
  let steering = 0;
  if (keys.left) steering = -1;
  if (keys.right) steering = 1;
  
  // Drift mechanics
  if (keys.drift && kart.speed > 50 && steering !== 0) {
    if (!kart.drifting) {
      kart.drifting = true;
      kart.driftDirection = steering;
    }
    
    // Build boost while drifting
    kart.driftBoost = Math.min(CONFIG.DRIFT_BOOST_MAX, kart.driftBoost + CONFIG.DRIFT_BOOST_RATE * dt);
    
    // Drift has looser grip - kart slides
    kart.driftAngleOffset += kart.driftDirection * steerRate * 0.5 * dt;
    kart.driftAngleOffset = Math.max(-0.5, Math.min(0.5, kart.driftAngleOffset));
    
    // Apply steering with drift modifier
    kart.angle += steering * steerRate * 0.7 * dt;
    
    // Reduce speed slightly while drifting
    kart.speed *= CONFIG.DRIFT_GRIP;
    
  } else {
    // Release drift - apply boost if charged enough
    if (kart.drifting) {
      if (kart.driftBoost > 30) {
        kart.applyBoost();
      }
      kart.drifting = false;
      kart.driftAngleOffset = 0;
      kart.driftBoost = 0;
    }
    
    // Normal steering
    kart.angle += steering * steerRate * dt;
  }
  
  // Calculate velocity from speed and angle
  const moveAngle = kart.angle + kart.driftAngleOffset;
  kart.velocity.x = Math.cos(moveAngle) * kart.speed * 0.5; // Scale for pixels
  kart.velocity.y = Math.sin(moveAngle) * kart.speed * 0.5;
  
  // Apply velocity
  kart.x += kart.velocity.x * dt;
  kart.y += kart.velocity.y * dt;
  
  // Use item
  if (keys.useItem && kart.item) {
    useItem(kart);
    keys.useItem = false; // Prevent holding
  }
  
  kart.update(dt);
}

function updateAIKart(kart, dt, track, playerKart, allKarts) {
  if (kart.finished) return;
  
  // Get target waypoint
  const currentWaypoint = track.getNearestWaypoint(kart.x, kart.y);
  const targetIndex = (currentWaypoint + 3) % track.waypoints.length;
  const target = track.waypoints[targetIndex];
  
  // Calculate angle to target
  const targetAngle = Math.atan2(target.y - kart.y, target.x - kart.x);
  
  // Smooth steering towards target
  let angleDiff = targetAngle - kart.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  
  // Steer towards target
  const steerRate = CONFIG.STEERING_BASE * 0.8;
  if (Math.abs(angleDiff) > 0.1) {
    kart.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), steerRate * dt);
  }
  
  // Rubber-banding: adjust speed based on position relative to player
  let targetSpeed = CONFIG.MAX_SPEED * 0.85;
  
  if (playerKart) {
    const positionDiff = kart.totalProgress - playerKart.totalProgress;
    
    if (positionDiff > 0.5) {
      // AI is ahead - slow down slightly
      targetSpeed *= (1 - CONFIG.RUBBER_BAND_STRENGTH * 0.5);
    } else if (positionDiff < -0.5) {
      // AI is behind - speed up
      targetSpeed *= (1 + CONFIG.RUBBER_BAND_STRENGTH);
    }
  }
  
  // Collision avoidance with other karts
  for (const other of allKarts) {
    if (other === kart) continue;
    
    const dist = Math.hypot(other.x - kart.x, other.y - kart.y);
    if (dist < 60) {
      // Steer away from other kart
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
  
  // Accelerate/decelerate towards target speed
  if (kart.speed < targetSpeed) {
    kart.speed += CONFIG.ACCELERATION * 0.8 * dt;
  } else {
    kart.speed -= CONFIG.DECELERATION * 0.5 * dt;
  }
  
  kart.speed = Math.max(0, Math.min(kart.getMaxSpeed(), kart.speed));
  
  // Calculate velocity
  kart.velocity.x = Math.cos(kart.angle) * kart.speed * 0.5;
  kart.velocity.y = Math.sin(kart.angle) * kart.speed * 0.5;
  
  // Apply velocity
  kart.x += kart.velocity.x * dt;
  kart.y += kart.velocity.y * dt;
  
  // Random item usage
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
    // Track boundary collision
    const trackDist = track.getTrackDistance(kart.x, kart.y);
    const innerLimit = 1 - (track.width / 2 - 15) / Math.min(track.radiusX, track.radiusY);
    const outerLimit = 1 + (track.width / 2 - 15) / Math.min(track.radiusX, track.radiusY);
    
    if (trackDist < innerLimit || trackDist > outerLimit) {
      // Hit wall - slow down and push back
      kart.speed *= 0.7;
      
      // Calculate push direction
      const angle = Math.atan2(kart.y - track.centerY, kart.x - track.centerX);
      const targetDist = trackDist < innerLimit ? innerLimit : outerLimit;
      
      kart.x = track.centerX + Math.cos(angle) * targetDist * track.radiusX;
      kart.y = track.centerY + Math.sin(angle) * targetDist * track.radiusY;
    }
    
    // Check checkpoint
    track.checkCheckpoint(kart, kart.x - kart.velocity.x * 0.016, kart.y - kart.velocity.y * 0.016);
    
    // Power-up collision
    for (const powerUp of powerUps) {
      if (!powerUp.active) continue;
      if (kart.item) continue; // Already has item
      
      const dist = Math.hypot(powerUp.x - kart.x, powerUp.y - kart.y);
      if (dist < powerUp.size + 10) {
        kart.item = powerUp.collect();
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
        // Bump!
        const angle = Math.atan2(k2.y - k1.y, k2.x - k1.x);
        const overlap = minDist - dist;
        
        // Push apart
        k1.x -= Math.cos(angle) * overlap / 2;
        k1.y -= Math.sin(angle) * overlap / 2;
        k2.x += Math.cos(angle) * overlap / 2;
        k2.y += Math.sin(angle) * overlap / 2;
        
        // Transfer some momentum
        const speedDiff = k1.speed - k2.speed;
        k1.speed -= speedDiff * 0.3;
        k2.speed += speedDiff * 0.3;
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
      break;
      
    case 'shield':
      kart.shielded = true;
      kart.shieldTimer = CONFIG.SHIELD_DURATION;
      break;
      
    case 'slow':
      // Slow all other karts
      for (const other of game.karts) {
        if (other !== kart && !other.shielded) {
          other.slowed = true;
          other.slowTimer = CONFIG.SLOW_DURATION;
        }
      }
      break;
  }
}

// ============================================================================
// POSITION CALCULATION
// ============================================================================

function calculatePositions(karts) {
  // Sort by progress (descending)
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
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(-kart.width/2 + 2, -kart.height/2 + 4, kart.width, kart.height);
  
  // Kart body
  ctx.fillStyle = kart.color;
  ctx.fillRect(-kart.width/2, -kart.height/2, kart.width, kart.height);
  
  // Kart outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(-kart.width/2, -kart.height/2, kart.width, kart.height);
  
  // Driver (small circle)
  ctx.fillStyle = '#FFE4C4';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Wheels
  ctx.fillStyle = '#333333';
  ctx.fillRect(-kart.width/2 - 2, -kart.height/2 - 2, 6, 5);
  ctx.fillRect(-kart.width/2 - 2, kart.height/2 - 3, 6, 5);
  ctx.fillRect(kart.width/2 - 4, -kart.height/2 - 2, 6, 5);
  ctx.fillRect(kart.width/2 - 4, kart.height/2 - 3, 6, 5);
  
  ctx.restore();
  
  // Drift sparks
  if (kart.drifting) {
    const sparkPhase = Math.floor(kart.sparkTimer * 10) % 3;
    const colors = ['#FFFF00', '#FF8C00', '#FF0000'];
    const boostLevel = kart.driftBoost / CONFIG.DRIFT_BOOST_MAX;
    
    ctx.fillStyle = colors[Math.min(2, Math.floor(boostLevel * 3))];
    
    const sparkX = kart.x - Math.cos(kart.angle) * 15;
    const sparkY = kart.y - Math.sin(kart.angle) * 15;
    
    for (let i = 0; i < 3; i++) {
      const ox = (Math.random() - 0.5) * 10;
      const oy = (Math.random() - 0.5) * 10;
      ctx.fillRect(sparkX + ox, sparkY + oy, 4, 4);
    }
  }
  
  // Boost flames
  if (kart.boosting) {
    const flameColors = ['#FF0000', '#FF8C00', '#FFFF00'];
    const flameX = kart.x - Math.cos(kart.angle) * 18;
    const flameY = kart.y - Math.sin(kart.angle) * 18;
    
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = flameColors[i % 3];
      const ox = (Math.random() - 0.5) * 8;
      const oy = (Math.random() - 0.5) * 8;
      const size = 4 + Math.random() * 4;
      ctx.fillRect(flameX + ox - size/2, flameY + oy - size/2, size, size);
    }
  }
  
  // Shield effect
  if (kart.shielded) {
    ctx.strokeStyle = `rgba(0, 200, 255, ${0.5 + Math.sin(Date.now() / 100) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(kart.x, kart.y, 20, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Slow effect
  if (kart.slowed) {
    ctx.fillStyle = 'rgba(128, 0, 128, 0.5)';
    ctx.beginPath();
    ctx.arc(kart.x, kart.y, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderUI(ctx, playerKart) {
  // Semi-transparent background for UI
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, 10, 180, 110);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  
  // Position
  const positionText = ['1ST', '2ND', '3RD', '4TH'][playerKart.position - 1];
  ctx.fillStyle = playerKart.position === 1 ? '#FFD700' : '#FFFFFF';
  ctx.fillText(`POS: ${positionText}`, 20, 35);
  
  // Lap
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`LAP: ${Math.min(playerKart.lap + 1, CONFIG.TOTAL_LAPS)}/${CONFIG.TOTAL_LAPS}`, 20, 55);
  
  // Speed
  const speedDisplay = Math.round(playerKart.speed);
  ctx.fillText(`SPD: ${speedDisplay} km/h`, 20, 75);
  
  // Time
  const minutes = Math.floor(gameState.raceTime / 60);
  const seconds = Math.floor(gameState.raceTime % 60);
  const ms = Math.floor((gameState.raceTime % 1) * 100);
  ctx.fillText(`TIME: ${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`, 20, 95);
  
  // Item box
  if (playerKart.item) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(CONFIG.WIDTH - 80, 10, 70, 50);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ITEM', CONFIG.WIDTH - 45, 28);
    
    // Item icon
    const itemColors = { boost: '#FF0000', shield: '#00BFFF', slow: '#800080' };
    ctx.fillStyle = itemColors[playerKart.item] || '#FFFFFF';
    ctx.fillRect(CONFIG.WIDTH - 60, 35, 30, 18);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(playerKart.item.toUpperCase().slice(0, 3), CONFIG.WIDTH - 45, 48);
  }
  
  // Drift boost meter
  if (playerKart.drifting) {
    const boostWidth = 100;
    const boostHeight = 10;
    const boostX = CONFIG.WIDTH / 2 - boostWidth / 2;
    const boostY = CONFIG.HEIGHT - 40;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(boostX - 5, boostY - 5, boostWidth + 10, boostHeight + 10);
    
    ctx.fillStyle = '#333333';
    ctx.fillRect(boostX, boostY, boostWidth, boostHeight);
    
    const fillPercent = playerKart.driftBoost / CONFIG.DRIFT_BOOST_MAX;
    const fillColor = fillPercent < 0.33 ? '#FFFF00' : fillPercent < 0.66 ? '#FF8C00' : '#FF0000';
    ctx.fillStyle = fillColor;
    ctx.fillRect(boostX, boostY, boostWidth * fillPercent, boostHeight);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BOOST', CONFIG.WIDTH / 2, boostY - 8);
  }
  
  // Mini-map
  renderMiniMap(ctx);
}

function renderMiniMap(ctx) {
  const mapX = CONFIG.WIDTH - 120;
  const mapY = CONFIG.HEIGHT - 100;
  const mapSize = 90;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(mapX - 5, mapY - 5, mapSize + 10, mapSize + 10);
  
  // Track outline
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(
    mapX + mapSize / 2,
    mapY + mapSize / 2,
    35, 25, 0, 0, Math.PI * 2
  );
  ctx.stroke();
  
  // Karts on mini-map
  for (const kart of game.karts) {
    const mx = mapX + mapSize / 2 + ((kart.x - CONFIG.TRACK_CENTER_X) / CONFIG.TRACK_RADIUS_X) * 35;
    const my = mapY + mapSize / 2 + ((kart.y - CONFIG.TRACK_CENTER_Y) / CONFIG.TRACK_RADIUS_Y) * 25;
    
    ctx.fillStyle = kart.color;
    ctx.beginPath();
    ctx.arc(mx, my, kart.isPlayer ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    
    if (kart.isPlayer) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function renderCountdown(ctx) {
  if (gameState.countdown > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = Math.ceil(gameState.countdown);
    ctx.fillText(text, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2);
    
    ctx.font = 'bold 24px monospace';
    ctx.fillText('GET READY!', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 60);
  }
}

function renderFinish(ctx, playerKart) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (playerKart.finished) {
    ctx.fillStyle = playerKart.position === 1 ? '#FFD700' : '#FFFFFF';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('FINISH!', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 50);
    
    const posText = ['1ST PLACE!', '2ND PLACE!', '3RD PLACE!', '4TH PLACE!'][playerKart.position - 1];
    ctx.fillText(posText, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2);
    
    const minutes = Math.floor(playerKart.finishTime / 60);
    const seconds = Math.floor(playerKart.finishTime % 60);
    const ms = Math.floor((playerKart.finishTime % 1) * 100);
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`TIME: ${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 60);
    
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Press SPACE to restart', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 100);
  }
}

function renderControls(ctx) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(10, CONFIG.HEIGHT - 55, 280, 45);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('↑/W: Accelerate  ↓/S: Brake', 20, CONFIG.HEIGHT - 38);
  ctx.fillText('←/A →/D: Steer  SHIFT: Drift  SPACE: Item', 20, CONFIG.HEIGHT - 20);
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
    // Create canvas
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'gameCanvas';
      document.body.appendChild(this.canvas);
    }
    
    this.canvas.width = CONFIG.WIDTH;
    this.canvas.height = CONFIG.HEIGHT;
    this.ctx = this.canvas.getContext('2d');
    
    // Disable image smoothing for pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false;
    
    initInput();
    this.reset();
  },
  
  reset() {
    // Create track
    this.track = new Track();
    
    // Create karts at starting positions
    this.karts = [];
    
    const startAngle = -Math.PI / 2;
    const kartColors = ['#E60012', '#0072BC', '#009944', '#F39800']; // Mario colors
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
    
    // Create power-ups around the track
    this.powerUps = [];
    for (let i = 0; i < CONFIG.POWERUP_COUNT; i++) {
      const angle = (i / CONFIG.POWERUP_COUNT) * Math.PI * 2 + Math.PI / 4;
      const variation = (Math.random() - 0.5) * 40;
      const x = this.track.centerX + Math.cos(angle) * (this.track.radiusX + variation);
      const y = this.track.centerY + Math.sin(angle) * (this.track.radiusY + variation);
      this.powerUps.push(new PowerUp(x, y));
    }
    
    // Reset game state
    gameState.running = false;
    gameState.countdown = 3;
    gameState.raceTime = 0;
    gameState.finished = false;
    gameState.winner = null;
    
    this.lastTime = performance.now();
  },
  
  update(dt) {
    // Countdown
    if (gameState.countdown > 0) {
      gameState.countdown -= dt;
      if (gameState.countdown <= 0) {
        gameState.running = true;
      }
      return;
    }
    
    if (!gameState.running) return;
    
    // Update race time
    gameState.raceTime += dt;
    
    // Find player kart
    const playerKart = this.karts.find(k => k.isPlayer);
    
    // Update all karts
    for (const kart of this.karts) {
      if (kart.isPlayer) {
        updatePlayerKart(kart, dt);
      } else {
        updateAIKart(kart, dt, this.track, playerKart, this.karts);
      }
    }
    
    // Handle collisions
    handleCollisions(this.karts, this.track, this.powerUps);
    
    // Update power-ups
    for (const powerUp of this.powerUps) {
      powerUp.update(dt);
    }
    
    // Calculate positions
    calculatePositions(this.karts);
    
    // Check for race end
    if (playerKart.finished) {
      gameState.finished = true;
    }
    
    // Handle restart
    if (gameState.finished && keys.useItem) {
      this.reset();
      keys.useItem = false;
    }
  },
  
  render() {
    // Clear
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    
    // Draw track
    this.track.render(this.ctx);
    
    // Draw power-ups
    for (const powerUp of this.powerUps) {
      powerUp.render(this.ctx);
    }
    
    // Sort karts by Y position for proper layering
    const sortedKarts = [...this.karts].sort((a, b) => a.y - b.y);
    
    // Draw karts
    for (const kart of sortedKarts) {
      renderKart(this.ctx, kart);
    }
    
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
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05); // Cap at 50ms
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

// ============================================================================
// START GAME
// ============================================================================

// Auto-start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => game.start());
} else {
  game.start();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { game, CONFIG };
}
