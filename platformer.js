// Constants
const MAP = { tw: 64, th: 48 };
const TILE = 32;
const METER = TILE;
const GRAVITY = 9.8 * 6;
const MAXDX = 15;
const MAXDY = 60;
const ACCEL = 1 / 2;
const FRICTION = 1 / 6;
const IMPULSE = 1500;
const COLOR = {
  BLACK: '#000000',
  YELLOW: '#ECD078',
  BRICK: '#D95B43',
  PINK: '#C02942',
  PURPLE: '#542437',
  GREY: '#333',
  SLATE: '#53777A',
  GOLD: 'gold'
};
const COLORS = [COLOR.YELLOW, COLOR.BRICK, COLOR.PINK, COLOR.PURPLE, COLOR.GREY];
const KEY = { SPACE: 32, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40 };

// Utility functions
const timestamp = () => window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
const bound = (x, min, max) => Math.max(min, Math.min(max, x));
const overlap = (x1, y1, w1, h1, x2, y2, w2, h2) => !(
  ((x1 + w1 - 1) < x2) ||
  ((x2 + w2 - 1) < x1) ||
  ((y1 + h1 - 1) < y2) ||
  ((y2 + h2 - 1) < y1)
);

const t2p = t => t * TILE;
const p2t = p => Math.floor(p / TILE);

class Game {
  constructor() {
    this.fps = 60;
    this.step = 1 / 60;
    this.width = MAP.tw * TILE;
    this.height = MAP.th * TILE;
    this.player = null;
    this.monsters = [];
    this.treasure = [];
    this.cells = [];
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.init();
  }

  async init() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    document.addEventListener('keydown', (ev) => this.handleKeyEvent(ev, true));
    document.addEventListener('keyup', (ev) => this.handleKeyEvent(ev, false));

    try {
      const mapData = await this.getJSON('level.json');
      this.setup(mapData);
      this.gameLoop();
    } catch (error) {
      console.error("Failed to load level data:", error);
    }
  }

  async getJSON(url) {
    const response = await fetch(url);
    return response.json();
  }

  handleKeyEvent(ev, down) {
    switch (ev.keyCode) {
      case KEY.LEFT:
        this.player.left = down;
        ev.preventDefault();
        break;
      case KEY.RIGHT:
        this.player.right = down;
        ev.preventDefault();
        break;
      case KEY.SPACE:
        this.player.jump = down;
        ev.preventDefault();
        break;
    }
  }

  setup(map) {
    const data = map.layers[0].data;
    const objects = map.layers[1].objects;

    objects.forEach(obj => {
      const entity = this.setupEntity(obj);
      switch (obj.type) {
        case 'player':
          this.player = entity;
          break;
        case 'monster':
          this.monsters.push(entity);
          break;
        case 'treasure':
          this.treasure.push(entity);
          break;
      }
    });

    this.cells = data;
  }

  setupEntity(obj) {
    return {
      x: obj.x,
      y: obj.y,
      dx: 0,
      dy: 0,
      gravity: METER * (obj.properties.gravity || GRAVITY),
      maxdx: METER * (obj.properties.maxdx || MAXDX),
      maxdy: METER * (obj.properties.maxdy || MAXDY),
      impulse: METER * (obj.properties.impulse || IMPULSE),
      accel: METER * (obj.properties.maxdx || MAXDX) / (obj.properties.accel || ACCEL),
      friction: METER * (obj.properties.maxdx || MAXDX) / (obj.properties.friction || FRICTION),
      monster: obj.type === "monster",
      player: obj.type === "player",
      treasure: obj.type === "treasure",
      left: obj.properties.left,
      right: obj.properties.right,
      start: { x: obj.x, y: obj.y },
      killed: 0,
      collected: 0
    };
  }

  gameLoop() {
    let last = timestamp();
    let counter = 0;
    let dt = 0;

    const frame = () => {
      const now = timestamp();
      dt = dt + Math.min(1, (now - last) / 1000);
      while (dt > this.step) {
        dt = dt - this.step;
        this.update(this.step);
      }
      this.render(this.ctx, counter, dt);
      last = now;
      counter++;
      requestAnimationFrame(frame);
    };

    frame();
  }

  update(dt) {
    this.updateEntity(this.player, dt);
    this.monsters.forEach(monster => this.updateMonster(monster, dt));
    this.checkTreasure();
  }

  updateEntity(entity, dt) {
    const wasLeft = entity.dx < 0;
    const wasRight = entity.dx > 0;
    const falling = entity.falling;
    const friction = entity.friction * (falling ? 0.5 : 1);
    const accel = entity.accel * (falling ? 0.5 : 1);

    // Apply acceleration
    entity.ddx = 0;
    entity.ddy = entity.gravity;

    if (entity.left) {
        entity.ddx -= accel;
    } else if (wasLeft) {
        entity.ddx += friction;
    }

    if (entity.right) {
        entity.ddx += accel;
    } else if (wasRight) {
        entity.ddx -= friction;
    }

    // Jumping logic
    if (entity.jump && !entity.jumping && !falling) {
        entity.ddy -= entity.impulse;  // Apply impulse force for jump
        entity.jumping = true;
    }

    // Apply physics to position
    entity.x += dt * entity.dx;
    entity.y += dt * entity.dy;
    entity.dx = bound(entity.dx + dt * entity.ddx, -entity.maxdx, entity.maxdx);
    entity.dy = bound(entity.dy + dt * entity.ddy, -entity.maxdy, entity.maxdy);

    // Stop horizontal movement when switching directions
    if ((wasLeft && entity.dx > 0) || (wasRight && entity.dx < 0)) {
        entity.dx = 0;
    }

    // Tile collision detection
    let tx = p2t(entity.x);d
    let ty = p2t(entity.y);
    let nx = entity.x % TILE;
    let ny = entity.y % TILE;
    let cell = this.cells[tx + ty * MAP.tw];
    let cellRight = this.cells[(tx + 1) + ty * MAP.tw];
    let cellDown = this.cells[tx + (ty + 1) * MAP.tw];
    let cellDiag = this.cells[(tx + 1) + (ty + 1) * MAP.tw];

    // Vertical collisions
    if (entity.dy > 0) {
        if ((cellDown && !cell) || (cellDiag && !cellRight && nx)) {
            entity.y = t2p(ty);
            entity.dy = 0;
            entity.falling = false;
            entity.jumping = false;
            ny = 0;
        }
    } else if (entity.dy < 0) {
        if ((cell && !cellDown) || (cellRight && !cellDiag && nx)) {
            entity.y = t2p(ty + 1);
            entity.dy = 0;
            cell = cellDown;
            cellRight = cellDiag;
            ny = 0;
        }
    }

    // Horizontal collisions
    if (entity.dx > 0) {
        if ((cellRight && !cell) || (cellDiag && !cellDown && ny)) {
            entity.x = t2p(tx);
            entity.dx = 0;
        }
    } else if (entity.dx < 0) {
        if ((cell && !cellRight) || (cellDown && !cellDiag && ny)) {
            entity.x = t2p(tx + 1);
            entity.dx = 0;
        }
    }

    // Monster AI logic for movement
    if (entity.monster) {
        if (entity.left && (cell || !cellDown)) {
            entity.left = false;
            entity.right = true;
        } else if (entity.right && (cellRight || !cellDiag)) {
            entity.right = false;
            entity.left = true;
        }
    }

    // Determine if the entity is falling
    entity.falling = !(cellDown || (nx && cellDiag));
}

  updateMonster(monster, dt) {
    if (!monster.dead) {
      this.updateEntity(monster, dt);
      if (overlap(this.player.x, this.player.y, TILE, TILE, monster.x, monster.y, TILE, TILE)) {
        if ((this.player.dy > 0) && (monster.y - this.player.y > TILE / 2)) {
          this.killMonster(monster);
        } else {
          this.killPlayer(this.player);
        }
      }
    }
  }

  checkTreasure() {
    this.treasure.forEach(t => {
      if (!t.collected && overlap(this.player.x, this.player.y, TILE, TILE, t.x, t.y, TILE, TILE)) {
        this.collectTreasure(t);
      }
    });
  }

  killMonster(monster) {
    this.player.killed++;
    monster.dead = true;
  }

  killPlayer(player) {
    player.x = player.start.x;
    player.y = player.start.y;
    player.dx = player.dy = 0;
  }

  collectTreasure(t) {
    this.player.collected++;
    t.collected = true;
  }

  render(ctx, frame, dt) {
    ctx.clearRect(0, 0, this.width, this.height);
    this.renderMap(ctx);
    this.renderTreasure(ctx, frame);
    this.renderPlayer(ctx, dt);
    this.renderMonsters(ctx, dt);
  }

  renderMap(ctx) {
    for (let y = 0; y < MAP.th; y++) {
      for (let x = 0; x < MAP.tw; x++) {
        const cell = this.cells[x + (y * MAP.tw)];
        if (cell) {
          ctx.fillStyle = COLORS[cell - 1];
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
  }

  renderPlayer(ctx, dt) {
    ctx.fillStyle = COLOR.YELLOW;
    ctx.fillRect(
      this.player.x + (this.player.dx * dt),
      this.player.y + (this.player.dy * dt),
      TILE,
      TILE
    );

    ctx.fillStyle = COLOR.GOLD;
    for (let n = 0; n < this.player.collected; n++) {
      ctx.fillRect(t2p(2 + n), t2p(2), TILE / 2, TILE / 2);
    }

    ctx.fillStyle = COLOR.SLATE;
    for (let n = 0; n < this.player.killed; n++) {
      ctx.fillRect(t2p(2 + n), t2p(3), TILE / 2, TILE / 2);
    }
  }

  renderMonsters(ctx, dt) {
    ctx.fillStyle = COLOR.SLATE;
    this.monsters.forEach(monster => {
      if (!monster.dead) {
        ctx.fillRect(
          monster.x + (monster.dx * dt),
          monster.y + (monster.dy * dt),
          TILE,
          TILE
        );
      }
    });
  }

  renderTreasure(ctx, frame) {
    ctx.fillStyle = COLOR.GOLD;
    ctx.globalAlpha = 0.25 + this.tweenTreasure(frame, 60);
    this.treasure.forEach(t => {
      if (!t.collected) {
        ctx.fillRect(t.x, t.y + TILE / 3, TILE, TILE * 2 / 3);
      }
    });
    ctx.globalAlpha = 1;
  }

  tweenTreasure(frame, duration) {
    const half = duration / 2;
    const pulse = frame % duration;
    return pulse < half ? (pulse / half) : 1 - (pulse - half) / half;
  }
}

// Start the game
new Game();
