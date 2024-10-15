// Modern JavaScript Game Code

// Constants
const MAP = { tw: 64, th: 48 };
const TILE = 32;
const METER = TILE;
const GRAVITY = 9.8 * 6;
const MAXDX = 15;
const MAXDY = 60;
const ACCEL = 1/2;
const FRICTION = 1/6;
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

// Game state
const gameState = {
  fps: 60,
  step: 1/60,
  width: MAP.tw * TILE,
  height: MAP.th * TILE,
  player: {},
  monsters: [],
  treasure: [],
  cells: []
};

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
const cell = (x, y) => tcell(p2t(x), p2t(y));
const tcell = (tx, ty) => gameState.cells[tx + (ty * MAP.tw)];

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Async function to get JSON data
const getJSON = async (url) => {
  const response = await fetch(url);
  return response.json();
};

// Event handlers
const handleKeyEvent = (ev, down) => {
  switch(ev.keyCode) {
    case KEY.LEFT:
      gameState.player.left = down;
      ev.preventDefault();
      return false;
    case KEY.RIGHT:
      gameState.player.right = down;
      ev.preventDefault();
      return false;
    case KEY.SPACE:
      gameState.player.jump = down;
      ev.preventDefault();
      return false;
  }
};

// Game logic
const updateEntity = (entity, dt) => {
  var wasleft    = entity.dx  < 0,
  wasright   = entity.dx  > 0,
  falling    = entity.falling,
  friction   = entity.friction * (falling ? 0.5 : 1),
  accel      = entity.accel    * (falling ? 0.5 : 1);

entity.ddx = 0;
entity.ddy = entity.gravity;

if (entity.left)
entity.ddx = entity.ddx - accel;
else if (wasleft)
entity.ddx = entity.ddx + friction;

if (entity.right)
entity.ddx = entity.ddx + accel;
else if (wasright)
entity.ddx = entity.ddx - friction;

if (entity.jump && !entity.jumping && !falling) {
entity.ddy = entity.ddy - entity.impulse; // an instant big force impulse
entity.jumping = true;
}

entity.x  = entity.x  + (dt * entity.dx);
entity.y  = entity.y  + (dt * entity.dy);
entity.dx = bound(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx);
entity.dy = bound(entity.dy + (dt * entity.ddy), -entity.maxdy, entity.maxdy);

if ((wasleft  && (entity.dx > 0)) ||
  (wasright && (entity.dx < 0))) {
entity.dx = 0; // clamp at zero to prevent friction from making us jiggle side to side
}

var tx        = p2t(entity.x),
  ty        = p2t(entity.y),
  nx        = entity.x%TILE,
  ny        = entity.y%TILE,
  cell      = tcell(tx,     ty),
  cellright = tcell(tx + 1, ty),
  celldown  = tcell(tx,     ty + 1),
  celldiag  = tcell(tx + 1, ty + 1);

if (entity.dy > 0) {
if ((celldown && !cell) ||
    (celldiag && !cellright && nx)) {
  entity.y = t2p(ty);
  entity.dy = 0;
  entity.falling = false;
  entity.jumping = false;
  ny = 0;
}
}
else if (entity.dy < 0) {
if ((cell      && !celldown) ||
    (cellright && !celldiag && nx)) {
  entity.y = t2p(ty + 1);
  entity.dy = 0;
  cell      = celldown;
  cellright = celldiag;
  ny        = 0;
}
}

if (entity.dx > 0) {
if ((cellright && !cell) ||
    (celldiag  && !celldown && ny)) {
  entity.x = t2p(tx);
  entity.dx = 0;
}
}
else if (entity.dx < 0) {
if ((cell     && !cellright) ||
    (celldown && !celldiag && ny)) {
  entity.x = t2p(tx + 1);
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
  entity.left  = true;
}
}

entity.falling = ! (celldown || (nx && celldiag));

};

const update = (dt) => {
  updateEntity(gameState.player, dt);
  gameState.monsters.forEach(monster => updateMonster(monster, dt));
  checkTreasure();
};

const updateMonster = (monster, dt) => {
  if (!monster.dead) {
    updateEntity(monster, dt);
    if (overlap(gameState.player.x, gameState.player.y, TILE, TILE, monster.x, monster.y, TILE, TILE)) {
      if ((gameState.player.dy > 0) && (monster.y - gameState.player.y > TILE/2)) {
        killMonster(monster);
      } else {
        killPlayer(gameState.player);
      }
    }
  }
};

const checkTreasure = () => {
  gameState.treasure.forEach(t => {
    if (!t.collected && overlap(gameState.player.x, gameState.player.y, TILE, TILE, t.x, t.y, TILE, TILE)) {
      collectTreasure(t);
    }
  });
};

const killMonster = (monster) => {
  gameState.player.killed++;
  monster.dead = true;
};

const killPlayer = (player) => {
  player.x = player.start.x;
  player.y = player.start.y;
  player.dx = player.dy = 0;
};

const collectTreasure = (t) => {
  gameState.player.collected++;
  t.collected = true;
};

// Rendering
const render = (ctx, frame, dt) => {
  ctx.clearRect(0, 0, gameState.width, gameState.height);
  renderMap(ctx);
  renderTreasure(ctx, frame);
  renderPlayer(ctx, dt);
  renderMonsters(ctx, dt);
};

const renderMap = (ctx) => {
  for (let y = 0; y < MAP.th; y++) {
    for (let x = 0; x < MAP.tw; x++) {
      const cell = tcell(x, y);
      if (cell) {
        ctx.fillStyle = COLORS[cell - 1];
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
};

const renderPlayer = (ctx, dt) => {
  ctx.fillStyle = COLOR.YELLOW;
  ctx.fillRect(
    gameState.player.x + (gameState.player.dx * dt),
    gameState.player.y + (gameState.player.dy * dt),
    TILE,
    TILE
  );

  ctx.fillStyle = COLOR.GOLD;
  for (let n = 0; n < gameState.player.collected; n++) {
    ctx.fillRect(t2p(2 + n), t2p(2), TILE/2, TILE/2);
  }

  ctx.fillStyle = COLOR.SLATE;
  for (let n = 0; n < gameState.player.killed; n++) {
    ctx.fillRect(t2p(2 + n), t2p(3), TILE/2, TILE/2);
  }
};

const renderMonsters = (ctx, dt) => {
  ctx.fillStyle = COLOR.SLATE;
  gameState.monsters.forEach(monster => {
    if (!monster.dead) {
      ctx.fillRect(
        monster.x + (monster.dx * dt),
        monster.y + (monster.dy * dt),
        TILE,
        TILE
      );
    }
  });
};

const renderTreasure = (ctx, frame) => {
  ctx.fillStyle = COLOR.GOLD;
  ctx.globalAlpha = 0.25 + tweenTreasure(frame, 60);
  gameState.treasure.forEach(t => {
    if (!t.collected) {
      ctx.fillRect(t.x, t.y + TILE/3, TILE, TILE*2/3);
    }
  });
  ctx.globalAlpha = 1;
};

const tweenTreasure = (frame, duration) => {
  const half = duration / 2;
  const pulse = frame % duration;
  return pulse < half ? (pulse / half) : 1 - (pulse - half) / half;
};

// Setup
const setupEntity = (obj) => ({
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
});

const setup = (map) => {
  const data = map.layers[0].data;
  const objects = map.layers[1].objects;

  objects.forEach(obj => {
    const entity = setupEntity(obj);
    switch(obj.type) {
      case "player":
        gameState.player = entity;
        break;
      case "monster":
        gameState.monsters.push(entity);
        break;
      case "treasure":
        gameState.treasure.push(entity);
        break;
    }
  });

  gameState.cells = data;
};

// Game loop
const gameLoop = () => {
  let last = timestamp();
  let counter = 0;
  let dt = 0;

  const frame = () => {
    const now = timestamp();
    dt = dt + Math.min(1, (now - last) / 1000);
    while (dt > gameState.step) {
      dt = dt - gameState.step;
      update(gameState.step);
    }
    render(ctx, counter, dt);
    last = now;
    counter++;
    requestAnimationFrame(frame);
  };

  frame();
};

// Initialization
const init = async () => {
  canvas.width = gameState.width;
  canvas.height = gameState.height;

  document.addEventListener('keydown', (ev) => handleKeyEvent(ev, true));
  document.addEventListener('keyup', (ev) => handleKeyEvent(ev, false));

  try {
    const mapData = await getJSON("level.json");
    setup(mapData);
    gameLoop();
  } catch (error) {
    console.error("Failed to load level data:", error);
  }
};

// Start the game
init();