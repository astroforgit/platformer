// Modern JavaScript Game Code using Class structure

class Game {
  // Constants
  static MAP = { tw: 64, th: 48 };
  static TILE = 32;
  static METER = Game.TILE;
  static GRAVITY = 9.8 * 6;
  static MAXDX = 15;
  static MAXDY = 60;
  static ACCEL = 1/2;
  static FRICTION = 1/6;
  static IMPULSE = 1500;
  static COLOR = {
    BLACK: '#000000',
    YELLOW: '#ECD078',
    BRICK: '#D95B43',
    PINK: '#C02942',
    PURPLE: '#542437',
    GREY: '#333',
    SLATE: '#53777A',
    GOLD: 'gold'
  };
  static COLORS = [Game.COLOR.YELLOW, Game.COLOR.BRICK, Game.COLOR.PINK, Game.COLOR.PURPLE, Game.COLOR.GREY];
  static KEY = { SPACE: 32, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40 };

  constructor() {
    this.fps = 60;
    this.step = 1/60;
    this.width = Game.MAP.tw * Game.TILE;
    this.height = Game.MAP.th * Game.TILE;
    this.player = {};
    this.monsters = [];
    this.treasure = [];
    this.cells = [];
    this.ctx = null;
    this.dt = 0;
    this.last = 0;
    this.counter = 0;
  }

  // Utility methods
  static timestamp() {
    return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
  }

  static bound(x, min, max) {
    return Math.max(min, Math.min(max, x));
  }

  static overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(
      ((x1 + w1 - 1) < x2) ||
      ((x2 + w2 - 1) < x1) ||
      ((y1 + h1 - 1) < y2) ||
      ((y2 + h2 - 1) < y1)
    );
  }

  t2p(t) { return t * Game.TILE; }
  p2t(p) { return Math.floor(p / Game.TILE); }
  cell(x, y) { return this.tcell(this.p2t(x), this.p2t(y)); }
  tcell(tx, ty) { return this.cells[tx + (ty * Game.MAP.tw)]; }

  // Async method to get JSON data
  async getJSON(url) {
    const response = await fetch(url);
    return response.json();
  }

  // Event handlers
  handleKeyEvent(ev, down) {
    switch(ev.keyCode) {
      case Game.KEY.LEFT:
        this.player.left = down;
        ev.preventDefault();
        return false;
      case Game.KEY.RIGHT:
        this.player.right = down;
        ev.preventDefault();
        return false;
      case Game.KEY.SPACE:
        this.player.jump = down;
        ev.preventDefault();
        return false;
    }
  }

  // Game logic methods
  updateEntity(entity) {
    const wasleft = entity.dx < 0;
    const wasright = entity.dx > 0;
    const falling = entity.falling;
    const friction = entity.friction * (falling ? 0.5 : 1);
    const accel = entity.accel * (falling ? 0.5 : 1);

    entity.ddx = 0;
    entity.ddy = entity.gravity;

    if (entity.left) {
      entity.ddx = entity.ddx - accel;
    } else if (wasleft) {
      entity.ddx = entity.ddx + friction;
    }

    if (entity.right) {
      entity.ddx = entity.ddx + accel;
    } else if (wasright) {
      entity.ddx = entity.ddx - friction;
    }

    if (entity.jump && !entity.jumping && !falling) {
      entity.ddy = entity.ddy - entity.impulse;
      entity.jumping = true;
    }

    entity.x = entity.x + (this.dt * entity.dx);
    entity.y = entity.y + (this.dt * entity.dy);
    entity.dx = Game.bound(entity.dx + (this.dt * entity.ddx), -entity.maxdx, entity.maxdx);
    entity.dy = Game.bound(entity.dy + (this.dt * entity.ddy), -entity.maxdy, entity.maxdy);

    if ((wasleft && (entity.dx > 0)) || (wasright && (entity.dx < 0))) {
      entity.dx = 0; // clamp at zero to prevent friction from making us jiggle side to side
    }

    let tx = this.p2t(entity.x);
    let ty = this.p2t(entity.y);
    let nx = entity.x % Game.TILE;
    let ny = entity.y % Game.TILE;
    let cell = this.tcell(tx, ty);
    let cellright = this.tcell(tx + 1, ty);
    let celldown = this.tcell(tx, ty + 1);
    let celldiag = this.tcell(tx + 1, ty + 1);

    if (entity.dy > 0) {
      if ((celldown && !cell) || (celldiag && !cellright && nx)) {
        entity.y = this.t2p(ty);
        entity.dy = 0;
        entity.falling = false;
        entity.jumping = false;
        ny = 0;
      }
    } else if (entity.dy < 0) {
      if ((cell && !celldown) || (cellright && !celldiag && nx)) {
        entity.y = this.t2p(ty + 1);
        entity.dy = 0;
        cell = celldown;
        cellright = celldiag;
        ny = 0;
      }
    }

    if (entity.dx > 0) {
      if ((cellright && !cell) || (celldiag && !celldown && ny)) {
        entity.x = this.t2p(tx);
        entity.dx = 0;
      }
    } else if (entity.dx < 0) {
      if ((cell && !cellright) || (celldown && !celldiag && ny)) {
        entity.x = this.t2p(tx + 1);
        entity.dx = 0;
      }
    }

    if (entity.monster) {
      if (entity.left && (cell || !celldown)) {
        entity.left = false;
        entity.right = true;
      }      
      else if (entity.right && (cellright || !celldiag)) {
        entity.right = false;
        entity.left = true;
      }
    }

    entity.falling = !(celldown || (nx && celldiag));
  }

  update() {
    this.updateEntity(this.player);
    this.monsters.forEach(monster => this.updateMonster(monster));
    this.checkTreasure();
  }

  updateMonster(monster) {
    if (!monster.dead) {
      this.updateEntity(monster);
      if (Game.overlap(this.player.x, this.player.y, Game.TILE, Game.TILE, monster.x, monster.y, Game.TILE, Game.TILE)) {
        if ((this.player.dy > 0) && (monster.y - this.player.y > Game.TILE/2)) {
          this.killMonster(monster);
        } else {
          this.killPlayer(this.player);
        }
      }
    }
  }

  checkTreasure() {
    this.treasure.forEach(t => {
      if (!t.collected && Game.overlap(this.player.x, this.player.y, Game.TILE, Game.TILE, t.x, t.y, Game.TILE, Game.TILE)) {
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

  // Rendering methods
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.renderMap();
    this.renderTreasure();
    this.renderPlayer();
    this.renderMonsters();
  }

  renderMap() {
    for (let y = 0; y < Game.MAP.th; y++) {
      for (let x = 0; x < Game.MAP.tw; x++) {
        const cell = this.tcell(x, y);
        if (cell) {
          this.ctx.fillStyle = Game.COLORS[cell - 1];
          this.ctx.fillRect(x * Game.TILE, y * Game.TILE, Game.TILE, Game.TILE);
        }
      }
    }
  }

  renderPlayer() {
    this.ctx.fillStyle = Game.COLOR.YELLOW;
    this.ctx.fillRect(
      this.player.x + (this.player.dx * this.dt),
      this.player.y + (this.player.dy * this.dt),
      Game.TILE,
      Game.TILE
    );

    this.ctx.fillStyle = Game.COLOR.GOLD;
    for (let n = 0; n < this.player.collected; n++) {
      this.ctx.fillRect(this.t2p(2 + n), this.t2p(2), Game.TILE/2, Game.TILE/2);
    }

    this.ctx.fillStyle = Game.COLOR.SLATE;
    for (let n = 0; n < this.player.killed; n++) {
      this.ctx.fillRect(this.t2p(2 + n), this.t2p(3), Game.TILE/2, Game.TILE/2);
    }
  }

  renderMonsters() {
    this.ctx.fillStyle = Game.COLOR.SLATE;
    this.monsters.forEach(monster => {
      if (!monster.dead) {
        this.ctx.fillRect(
          monster.x + (monster.dx * this.dt),
          monster.y + (monster.dy * this.dt),
          Game.TILE,
          Game.TILE
        );
      }
    });
  }

  renderTreasure() {
    this.ctx.fillStyle = Game.COLOR.GOLD;
    this.ctx.globalAlpha = 0.25 + this.tweenTreasure();
    this.treasure.forEach(t => {
      if (!t.collected) {
        this.ctx.fillRect(t.x, t.y + Game.TILE/3, Game.TILE, Game.TILE*2/3);
      }
    });
    this.ctx.globalAlpha = 1;
  }

  tweenTreasure() {
    const duration = 60;
    const half = duration / 2;
    const pulse = this.counter % duration;
    return pulse < half ? (pulse / half) : 1 - (pulse - half) / half;
  }

  // Setup methods
  setupEntity(obj) {
    return {
      x: obj.x,
      y: obj.y,
      dx: 0,
      dy: 0,
      gravity: Game.METER * (obj.properties.gravity || Game.GRAVITY),
      maxdx: Game.METER * (obj.properties.maxdx || Game.MAXDX),
      maxdy: Game.METER * (obj.properties.maxdy || Game.MAXDY),
      impulse: Game.METER * (obj.properties.impulse || Game.IMPULSE),
      accel: Game.METER * (obj.properties.maxdx || Game.MAXDX) / (obj.properties.accel || Game.ACCEL),
      friction: Game.METER * (obj.properties.maxdx || Game.MAXDX) / (obj.properties.friction || Game.FRICTION),
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

  setup(map) {
    const data = map.layers[0].data;
    const objects = map.layers[1].objects;

    objects.forEach(obj => {
      const entity = this.setupEntity(obj);
      switch(obj.type) {
        case "player":
          this.player = entity;
          break;
        case "monster":
          this.monsters.push(entity);
          break;
        case "treasure":
          this.treasure.push(entity);
          break;
      }
    });

    this.cells = data;
  }

  // Game loop
  gameLoop() {
    const now = Game.timestamp();
    this.dt = this.dt + Math.min(1, (now - this.last) / 1000);
    while (this.dt > this.step) {
      this.dt = this.dt - this.step;
      this.update();
    }
    this.render();
    this.last = now;
    this.counter++;
    requestAnimationFrame(() => this.gameLoop());
  }

  // Initialization
  async init() {
    const canvas = document.getElementById('canvas');
    this.ctx = canvas.getContext('2d');
    canvas.width = this.width;
    canvas.height = this.height;

    document.addEventListener('keydown', (ev) => this.handleKeyEvent(ev, true));
    document.addEventListener('keyup', (ev) => this.handleKeyEvent(ev, false));

    try {
      const mapData = await this.getJSON("level.json");
      this.setup(mapData);
      this.last = Game.timestamp();
      this.gameLoop();
    } catch (error) {
      console.error("Failed to load level data:", error);
    }
  }
}

// Start the game
const game = new Game();
game.init();