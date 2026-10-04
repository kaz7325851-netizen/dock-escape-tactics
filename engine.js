(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DockTactics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAP = [
    '~~~~~~~~~~~~~',
    '~...#.......~',
    '~...........~',
    '~...##.##...~',
    '~...........~',
    '~...##.##...~',
    '~...........~',
    '~...#...#...~',
    '~~~~~~~~~~~~~',
  ];
  const SKILLS = {
    bash: { name: '盾击', type: 'enemy', range: 2, cd: 4, power: 10, desc: '射程2格，基础物理伤害10，推退1格并眩晕。目标下次敌方阶段无法移动、普攻或使用技能。推退受阻不影响眩晕。' },
    cover: { name: '掩护', type: 'ally', range: 3, cd: 2, desc: '保护3格内一名队友，至下个我方阶段开始前承接其所有单体攻击和附带效果，不限次数。按守卫防御结算后伤害减少45%；施放后不受距离变化影响。守卫离场即失效，不转移环境伤害。' },
    regen: { name: '坚守再生', type: 'self', range: 0, cd: 5, healing: 8, duration: 3, desc: '自身获得再生：从本回合起，连续3次我方回合结束时各恢复8点生命。不超过生命上限，不能复活。' },
    pierce: { name: '穿甲射击', type: 'enemy', range: 4, cd: 4, power: 14, ignoreDefense: true, desc: '射程4格，基础物理伤害14，无视目标物防。' },
    heal: { name: '战地救护', type: 'ally', range: 4, cd: 4, healing: 12, desc: '射程4格，恢复自己或队友12点生命，不超过生命上限，不能复活。' },
    suppress: { name: '牵制射击', type: 'enemy', range: 4, cd: 3, power: 9, desc: '射程4格，基础物理伤害9，目标下次敌方阶段移动力降低2点，最低为0；不影响攻击。' },
    fireball: { name: '火球', type: 'enemy', range: 4, cd: 5, power: 14, damageType: 'magic', splash: 6, desc: '射程4格，对目标造成14点基础魔法伤害，相邻敌人受到6点基础魔法溅射。不伤害友军。' },
    freeze: { name: '冰缚', type: 'enemy', range: 4, cd: 4, power: 8, damageType: 'magic', desc: '射程4格，基础魔法伤害8。目标下次敌方阶段无法移动，仍可攻击和使用技能。' },
    teleport: { name: '传送', type: 'unit', range: 4, cd: 5, landingRange: 3, desc: '选取4格内一个队友或敌人（不含自身，选取受货箱遮挡），传送至该单位原位置3格内的可通行空地。传送可跨越货箱，不造成伤害，不扣被传送者移动力或行动次数。不能落在水面、货箱或已有单位的地格；不会自动登艇。' },
  };
  const HEROES = [
    { id: 'guard', name: '守卫', glyph: '盾', team: 'ally', x: 1, y: 4, hp: 34, atk: 9, def: 3, mdef: 2, move: 3, range: 1, damage: 'physical', skills: ['bash', 'cover', 'regen'], role: '物理近战', color: '#72bece' },
    { id: 'scout', name: '游击手', glyph: '弓', team: 'ally', x: 1, y: 3, hp: 24, atk: 8, def: 1, mdef: 1, move: 4, range: 3, damage: 'physical', skills: ['pierce', 'heal', 'suppress'], role: '物理远程', color: '#e8bf75' },
    { id: 'mage', name: '术师', glyph: '术', team: 'ally', x: 1, y: 5, hp: 25, atk: 8, def: 1, mdef: 3, move: 3, range: 3, damage: 'magic', skills: ['fireball', 'freeze', 'teleport'], role: '魔法远程', color: '#b2a0e7' },
  ];
  const ENEMIES = [
    { id: 'heavy1', name: '重甲守卫甲', glyph: '甲', x: 5, y: 4, hp: 20, atk: 9, def: 5, mdef: 1, move: 1, range: 1, kind: 'heavy', role: '中央守卫 · 物理近战' },
    { id: 'heavy2', name: '重甲守卫乙', glyph: '甲', x: 8, y: 4, hp: 20, atk: 9, def: 5, mdef: 1, move: 1, range: 1, kind: 'heavy', patrol: 'rear', role: '接驳区前守卫 · 物理近战' },
    { id: 'bow1', name: '栈道弩手甲', glyph: '弩', x: 8, y: 2, hp: 14, atk: 7, def: 1, mdef: 4, move: 2, range: 3, kind: 'bow', role: '上侧栈道射手 · 物理远程' },
    { id: 'bow2', name: '栈道弩手乙', glyph: '弩', x: 5, y: 7, hp: 14, atk: 7, def: 1, mdef: 4, move: 2, range: 3, kind: 'bow', role: '下侧栈道射手 · 物理远程' },
    { id: 'chaser', name: '追击者', glyph: '追', x: null, y: null, hp: 20, atk: 10, def: 2, mdef: 2, move: 4, range: 1, kind: 'chaser', role: '延迟登场 · 物理近战' },
  ];
  const ENEMY_SKILLS = {
    hook: { name: '拖拽钩索', range: 3, cd: 3, power: 6, desc: '3格内造成6点基础物理伤害，将目标拉近1格，降低其下回合移动力1点。货箱阻挡钩索。' },
    slam: { name: '盾震', range: 1, cd: 3, power: 10, desc: '相邻目标受到10点基础物理伤害并被推退1格。' },
    pin: { name: '压制箭', range: 4, cd: 3, power: 7, desc: '4格内造成7点基础物理伤害，降低目标下回合移动力1点。货箱阻挡射线。' },
    stealth: { name: '潜行', spawnOnly: true, desc: '登场时施放一次，持续至下一回合结束。期间无法被普攻或技能选中，只受环境和溅射伤害；期间首次造成伤害额外增加4点。' },
    hamstring: { name: '割筋', range: 1, cd: 3, desc: '相邻目标受到10点基础物理伤害，下回合移动力降低1点。' },
  };
  const BOMBARDMENT = { start: 3, interval: 2, damage: 8, radius: 2, maxTargets: 4, fireDuration: 3 };
  const FIRE_DAMAGE = 5;
  const INITIAL_FIRE = [[5, 1], [5, 2], [5, 6]];
  const LIMIT = 8;
  const CHASER_SPAWNS = [[1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5]];
  const key = (x, y) => `${x},${y}`;
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const dirs = [[1, 0], [0, -1], [0, 1], [-1, 0]];
  // Roll once per damage event, after defense, bonuses and cover reduction.
  const damageBounds = value => {
    const nominal = Math.max(1, Math.ceil(value));
    return { min: Math.max(1, Math.round(nominal * .8)), max: Math.max(1, Math.round(nominal * 1.2)) };
  };
  const formatDamage = value => {
    const { min, max } = damageBounds(value);
    return min === max ? `${min}` : `${min}—${max}`;
  };
  const expectedDamage = (value, hp = Infinity) => {
    const { min, max } = damageBounds(value);
    let total = 0;
    for (let n = min; n <= max; n++) total += Math.min(hp, n);
    return total / (max - min + 1);
  };

  class Game {
    constructor(seed) { this.reset(seed); }
    reset(seed) {
      this.seed = (Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 4294967296)) >>> 0;
      this.rng = this.seed;
      this.round = 1; this.phase = 'player'; this.status = 'playing'; this.reason = '';
      this.units = [...HEROES.map(h => ({ ...clone(h), maxHp: h.hp, moveLeft: h.move, moved: false, acted: false, ended: false, cooldowns: {}, evacuated: false, regenRemaining: 0 })),
        ...ENEMIES.map(e => ({ ...clone(e), team: 'enemy', maxHp: e.hp, damage: 'physical', rooted: false, stunned: false, slow: false,
          spawned: e.kind !== 'chaser', x: e.kind === 'chaser' ? null : e.x, y: e.kind === 'chaser' ? null : e.y,
          stealthed: false, ambushBonus: 0, cooldowns: {}, skills: e.kind === 'heavy' ? ['hook', 'slam'] : e.kind === 'bow' ? ['pin'] : ['stealth', 'hamstring'] }))];
      this.permanentFire = new Set(INITIAL_FIRE.map(([x, y]) => key(x, y)));
      this.fire = new Set(this.permanentFire); this.fireExpiry = {};
      this.boost = new Set([key(6, 4), key(6, 6), key(6, 7)]);
      this.warn = []; this.cover = null; this.undo = null; this.history = []; this.serial = 0; this.effects = [];
      this.stats = { turns: 0, kills: 0, attacks: 0, skills: {}, routeVisits: { center: 0, outer: 0, upper: 0, lower: 0 }, damageTaken: 0, started: Date.now() };
      this.log(`三名队员全部登艇即可撤离。第${LIMIT}回合结束前完成任务。`, 'info');
      this.log('每回合一次普攻、技能或登艇；普通移动力独立累计消耗。任一队员阵亡则失败。', 'info');
    }
    log(text, type = 'info') { const event = { id: ++this.serial, round: this.round, phase: this.phase, text, type }; this.history.push(event); return event; }
    fx(type, data) { this.effects.push({ type, ...data }); }
    takeEffects() { const events = this.effects; this.effects = []; return events; }
    random() { this.rng = (Math.imul(1664525, this.rng) + 1013904223) >>> 0; return this.rng / 4294967296; }
    shuffle(items) {
      const result = items.slice();
      for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
      return result;
    }
    bombardmentTargets() {
      const heroes = this.active('ally');
      if (this.round < BOMBARDMENT.start || (this.round - BOMBARDMENT.start) % BOMBARDMENT.interval !== 0 || !heroes.length) return [];
      const count = Math.min(BOMBARDMENT.maxTargets, heroes.length + 1), result = [], marked = new Set();
      // Never telegraph every reachable landing tile of an active hero.
      const escapes = heroes.map(h => this.reach(h));
      const add = p => {
        const k = key(p.x, p.y); if (marked.has(k)) return false;
        if (escapes.some(cells => !cells.some(c => !marked.has(key(c.x, c.y)) && key(c.x, c.y) !== k))) return false;
        marked.add(k); result.push({ x: p.x, y: p.y }); return true;
      };
      for (const h of this.shuffle(heroes).slice(0, 2)) add(h);
      const candidates = [];
      for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[y].length; x++) {
        if (this.walkable(x, y) && heroes.some(h => dist(h, { x, y }) <= BOMBARDMENT.radius)) candidates.push({ x, y });
      }
      for (const p of this.shuffle(candidates)) { if (result.length >= count) break; add(p); }
      return result;
    }
    speed(u) { return Math.max(u.team === 'ally' ? 1 : 0, u.move - (u.slow ? (u.team === 'ally' ? 1 : 2) : 0)); }
    enemyReady(e, id) { return (e.cooldowns[id] || 0) <= this.round; }
    enemyRange(e) { return e.stunned ? 0 : e.kind === 'heavy' && this.enemyReady(e, 'hook') ? 3 : e.kind === 'bow' && this.enemyReady(e, 'pin') ? 4 : e.range; }
    enemyBudget(e) { return e.rooted || e.stunned ? 0 : this.speed(e); }
    get(id) { return this.units.find(u => u.id === id); }
    active(team) { return this.units.filter(u => u.team === team && u.spawned !== false && u.hp > 0 && !u.evacuated); }
    at(x, y) { return this.units.find(u => u.spawned !== false && u.hp > 0 && !u.evacuated && u.x === x && u.y === y); }
    tile(x, y) {
      if (!MAP[y] || !MAP[y][x] || MAP[y][x] === '~') return 'water';
      if (MAP[y][x] === '#') return 'wall';
      if (this.isExit(x, y)) return 'exit';
      if (this.fire.has(key(x, y))) return 'fire';
      if (this.boost.has(key(x, y))) return 'boost';
      return 'deck';
    }
    isExit(x, y) { return x >= 10 && x <= 11 && y >= 3 && y <= 5; }
    walkable(x, y) { const t = this.tile(x, y); return t !== 'water' && t !== 'wall'; }
    cost(x, y) { return this.fire.has(key(x, y)) ? 2 : 1; }
    stepCost(u, x, y) { return this.cost(x, y); }
    canPlay(u) { return !!(u && u.team === 'ally' && u.hp > 0 && !u.evacuated && !u.ended && this.phase === 'player' && this.status === 'playing'); }
    canUse(u) { return this.canPlay(u) && !u.acted; }
    canMove(u) { return this.canPlay(u) && u.moveLeft > 0; }
    done(u) { return u.evacuated || u.hp <= 0 || u.ended || (u.moveLeft <= 0 && u.acted); }
    pending(u) { return this.canPlay(u) && !this.done(u); }
    available(u, skill) { return this.canUse(u) && u.skills.includes(skill) && (u.cooldowns[skill] || 0) <= this.round; }
    reach(u, budget = u.team === 'ally' ? u.moveLeft : this.speed(u), unrestricted = false) {
      const search = swapMode => {
        const best = new Map([[key(u.x, u.y), { x: u.x, y: u.y, cost: 0, path: [], swapMode }]]);
        const queue = [best.get(key(u.x, u.y))];
        while (queue.length) {
          queue.sort((a, b) => a.cost - b.cost); const p = queue.shift();
          if (p.cost !== best.get(key(p.x, p.y)).cost) continue;
          for (const [dx, dy] of dirs) {
            const x = p.x + dx, y = p.y + dy; if (!this.walkable(x, y)) continue;
            const occ = this.at(x, y); if (!unrestricted && occ && occ.team !== u.team) continue;
            const exchange = swapMode && occ && occ.id !== u.id && occ.team === u.team;
            const cost = p.cost + (exchange ? 1 : this.cost(x, y)); if (cost > budget) continue;
            const k = key(x, y); if (best.has(k) && best.get(k).cost <= cost) continue;
            const next = { x, y, cost, path: [...p.path, [x, y]], swapMode }; best.set(k, next); queue.push(next);
          }
        }
        return best;
      };
      // The destination selects the mode for the whole path, not only its last step.
      const normal = search(false), exchange = search(true), results = [];
      for (const k of new Set([...normal.keys(), ...exchange.keys()])) {
        const candidate = normal.get(k) || exchange.get(k), occ = this.at(candidate.x, candidate.y);
        const swapMode = !!(occ && occ.id !== u.id && occ.team === u.team);
        const p = (swapMode ? exchange : normal).get(k); if (!p) continue;
        const swaps = swapMode ? p.path.filter(([x, y]) => { const friend = this.at(x, y); return friend && friend.id !== u.id && friend.team === u.team; }).length : 0;
        results.push({ ...p, swaps });
      }
      return results;
    }
    lineOfSight(a, b) {
      let x = a.x, y = a.y; const dx = Math.abs(b.x - x), dy = Math.abs(b.y - y);
      const sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1; let err = dx - dy;
      while (x !== b.x || y !== b.y) {
        const e = 2 * err; if (e > -dy) { err -= dy; x += sx; } if (e < dx) { err += dx; y += sy; }
        if (x === b.x && y === b.y) return true;
        if (!this.walkable(x, y)) return false;
      }
      return true;
    }
    inRange(a, b, range) { return dist(a, b) <= range && this.lineOfSight(a, b); }
    actionRange(u, mode) {
      if (!this.canUse(u)) return [];
      const skill = SKILLS[mode];
      if (mode !== 'attack' && (!skill || !this.available(u, mode))) return [];
      if (skill?.type === 'self') return [{ x: u.x, y: u.y }];
      const range = mode === 'attack' ? u.range : skill.range, cells = [];
      for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[y].length; x++) {
        if (x === u.x && y === u.y && !(skill?.type === 'ally' && mode !== 'cover')) continue;
        if (this.walkable(x, y) && this.inRange(u, { x, y }, range)) cells.push({ x, y });
      }
      return cells;
    }
    targets(u, mode) {
      if (!this.canUse(u)) return [];
      if (mode === 'attack') return this.active('enemy').filter(t => !t.stealthed && this.inRange(u, t, u.range));
      const skill = SKILLS[mode]; if (!skill || !this.available(u, mode)) return [];
      if (skill.type === 'self') return [u];
      if (skill.type === 'unit') return [...this.active('ally'), ...this.active('enemy')].filter(t => !t.stealthed && t.id !== u.id && this.inRange(u, t, skill.range));
      const team = skill.type === 'enemy' ? 'enemy' : 'ally';
      return this.active(team).filter(t => !t.stealthed && (mode !== 'cover' || t.id !== u.id) && this.inRange(u, t, skill.range));
    }
    teleportArea(t) {
      if (!t || t.hp <= 0 || t.evacuated) return [];
      const out = [];
      for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[y].length; x++) {
        if (this.walkable(x, y) && dist(t, { x, y }) <= SKILLS.teleport.landingRange) out.push({ x, y });
      }
      return out;
    }
    teleportDestinations(u, t) {
      if (!this.targets(u, 'teleport').some(p => p.id === t?.id)) return [];
      return this.teleportArea(t).filter(p => !this.at(p.x, p.y));
    }
    defense(t, type) { return type === 'magic' ? t.mdef : Math.max(0, t.def); }
    damage(a, t, base, type, ignore = false) {
      const bonus = this.boost.has(key(a.x, a.y)) && !this.fire.has(key(a.x, a.y)) ? 2 : 0;
      return Math.max(1, base + bonus - (ignore ? 0 : this.defense(t, type)));
    }
    enemyDamage(a, t, base, multiplier = 1, bonus = a.ambushBonus || 0) {
      // Apply the balance reduction to the complete nominal hit, including ambush and cover.
      const previous = Math.max(1, Math.ceil((this.damage(a, t, base, 'physical') + bonus) * multiplier));
      return Math.max(1, Math.round(previous * .9));
    }
    rollDamage(value) {
      const { min, max } = damageBounds(value);
      return min + Math.floor(this.random() * (max - min + 1));
    }
    preview(u, t, mode) {
      if (mode === 'cover') return '至下个我方阶段，所有单体攻击与附带效果由守卫承接；伤害减45%，不限次数';
      if (mode === 'heal') return `恢复 ${Math.min(SKILLS.heal.healing, t.maxHp - t.hp)} 点生命`;
      if (mode === 'regen') return '再生：从本回合起，连续3次我方回合结束各回复8点生命';
      if (mode === 'teleport') return `${t.name} · 可传送至原位置3格内空地；不消耗其移动力或行动次数`;
      const s = SKILLS[mode];
      const base = s?.power ?? u.atk, type = s?.damageType ?? u.damage, ignore = !!s?.ignoreDefense;
      const dmg = this.damage(u, t, base, type, ignore);
      const { min, max } = damageBounds(dmg);
      const suffix = { bash: ' · 推退1格 · 下次敌方阶段完全无法行动', suppress: ' · 下次敌人移动力−2', freeze: ' · 下次不能移动，仍可攻击', fireball: ' · 相邻敌人受到溅射' }[mode] || '';
      return `${type === 'magic' ? '魔法' : '物理'}伤害 ${formatDamage(dmg)}${min >= t.hp ? ' · 必定击败' : max >= t.hp ? ' · 可能击败' : ''}${suffix}`;
    }
    move(id, x, y) {
      const u = this.get(id); if (!this.canMove(u)) return { ok: false, error: '该单位移动力已耗尽，或本回合已结束操作。' };
      const p = this.reach(u).find(t => t.x === x && t.y === y); if (!p || !p.path.length) return { ok: false, error: '无法到达该地格。' };
      this.undo = { id, positions: this.units.map(t => ({ id: t.id, x: t.x, y: t.y })), moveLeft: u.moveLeft, moved: u.moved, historyLength: this.history.length, serial: this.serial, routeVisits: { ...this.stats.routeVisits } };
      this.followPath(u, p.path, p.swapMode);
      u.moved = true; u.moveLeft -= p.cost;
      this.recordRoute(u, p.path); this.log(`${u.name}移动到 ${x + 1}列${y + 1}行，消耗${p.cost}点移动力，剩余${u.moveLeft}点。`);
      return { ok: true, path: p.path, remaining: u.moveLeft };
    }
    followPath(u, path, swapMode) {
      if (!path.length) return;
      const from = [u.x, u.y], to = path[path.length - 1];
      for (const [x, y] of path) {
        const occ = this.at(x, y);
        if (!this.walkable(x, y) || (occ && occ.team !== u.team)) throw new Error('移动路径不可跨越障碍或敌方单位');
      }
      if (swapMode === undefined) swapMode = !!this.at(...to);
      if (!swapMode) {
        this.fx('move', { id: u.id, from, path, label: `${u.name} · 移动` });
        u.x = to[0]; u.y = to[1]; return;
      }
      let segmentFrom = from, segment = [];
      const flush = () => {
        if (segment.length) this.fx('move', { id: u.id, from: segmentFrom, path: segment, label: `${u.name} · 移动` });
        segment = [];
      };
      for (const [x, y] of path) {
        const other = this.at(x, y), old = [u.x, u.y];
        if (other && other.id !== u.id) {
          flush();
          this.fx('swap', { id: u.id, other: other.id, from: old, to: [x, y], label: `${u.name}与${other.name}换位` });
          other.x = old[0]; other.y = old[1];
          if (other.team === 'ally') this.recordRoute(other, [old]);
          this.log(`${u.name}与${other.name}逐格换位；仅${u.name}消耗1点移动力。`);
          segmentFrom = [x, y];
        } else segment.push([x, y]);
        u.x = x; u.y = y;
      }
      flush();
    }
    recordRoute(u, path) {
      for (const [x, y] of path) if (x >= 4 && x <= 8) {
        this.stats.routeVisits[y === 4 ? 'center' : 'outer']++;
        if (y < 4) this.stats.routeVisits.upper++;
        if (y > 4) this.stats.routeVisits.lower++;
      }
    }
    undoMove() {
      if (!this.undo || this.phase !== 'player' || this.status !== 'playing') return false;
      const u = this.get(this.undo.id); if (!u || u.evacuated || u.hp <= 0 || u.ended) return false;
      for (const p of this.undo.positions) { const t = this.get(p.id); t.x = p.x; t.y = p.y; }
      u.moved = this.undo.moved; u.moveLeft = this.undo.moveLeft;
      this.stats.routeVisits = this.undo.routeVisits; this.history.length = this.undo.historyLength; this.serial = this.undo.serial;
      this.undo = null; return true;
    }
    attackRecipient(target) {
      if (target.team === 'ally' && this.cover && this.cover.target === target.id) {
        const guard = this.get(this.cover.guard);
        if (guard && guard.hp > 0 && !guard.evacuated) {
          this.log(`${guard.name}替${target.name}承受本次攻击及附带效果，掩护仍有效。`, 'skill');
          this.fx('attack', { id: guard.id, from: [target.x, target.y], to: [guard.x, guard.y], mode: 'cover', label: `${guard.name} · 代受攻击与附带效果` });
          return { unit: guard, multiplier: .55 };
        }
      }
      return { unit: target, multiplier: 1 };
    }
    hurt(target, value, source, single = false) {
      const recipient = single ? this.attackRecipient(target) : { unit: target, multiplier: 1 };
      const t = recipient.unit, nominal = Math.max(1, Math.ceil(value * recipient.multiplier));
      if (t.hp <= 0) return 0;
      const rolled = this.rollDamage(nominal), bounds = damageBounds(nominal);
      let amount = rolled;
      amount = Math.min(t.hp, amount); t.hp = Math.max(0, t.hp - amount);
      this.fx('damage', { id: t.id, x: t.x, y: t.y, value: amount, nominal, rolled, bounds, dead: t.hp === 0, label: `${source} → ${t.name} −${amount}` });
      if (t.team === 'ally') this.stats.damageTaken += amount;
      this.log(`${source}：${t.name}受到${amount}点伤害${t.hp === 0 ? '，已被击败' : ''}。`, t.team === 'ally' ? 'danger' : 'hit');
      if (t.hp === 0 && t.team === 'enemy') this.stats.kills++;
      if (t.hp === 0 && this.cover && (this.cover.guard === t.id || this.cover.target === t.id)) this.cover = null;
      if (t.hp === 0 && t.team === 'ally') this.lose(`${t.name}阵亡，撤离行动失败。`);
      return amount;
    }
    finishAction(u, skill) {
      u.acted = true; this.undo = null;
      if (skill && SKILLS[skill]) { u.cooldowns[skill] = this.round + SKILLS[skill].cd; this.stats.skills[skill] = (this.stats.skills[skill] || 0) + 1; }
    }
    act(id, mode, target) {
      const u = this.get(id);
      if (mode === 'wait') {
        if (!this.pending(u)) return { ok: false, error: '该单位本回合没有剩余操作。' };
        u.moveLeft = 0; u.ended = true; this.finishAction(u); this.log(`${u.name}待机，放弃本回合剩余移动与行动。`); return { ok: true };
      }
      if (!this.canUse(u)) return { ok: false, error: '该单位本回合的攻击或技能次数已用尽；有剩余移动力时仍可移动。' };
      if (mode === 'board') {
        if (!this.isExit(u.x, u.y)) return { ok: false, error: '进入绿色撤离区后才能登艇。' };
        u.evacuated = true; u.moveLeft = 0; this.finishAction(u); if (this.cover && (this.cover.guard === u.id || this.cover.target === u.id)) this.cover = null;
        this.fx('board', { id, x: u.x, y: u.y, label: `${u.name} · 安全登艇` });
        this.log(`${u.name}登上逃生艇。`, 'success');
        if (this.units.filter(h => h.team === 'ally').every(h => h.evacuated)) {
          this.status = 'won'; this.phase = 'over'; this.reason = '三名队员全部登艇，撤离成功。'; this.log(this.reason, 'success');
        }
        return { ok: true };
      }
      const choices = this.targets(u, mode);
      if (mode === 'teleport') {
        const t = target && this.get(target.unit);
        const p = this.teleportDestinations(u, t).find(p => p.x === target?.x && p.y === target?.y);
        if (!p) return { ok: false, error: '传送目标或落点无效：目标须在选取范围内，落点须在目标3格内且为空地。' };
        this.fx('cast', { id, x: u.x, y: u.y, name: SKILLS[mode].name, label: `${u.name} · ${SKILLS[mode].name}` });
        this.fx('teleport', { id: t.id, from: [t.x, t.y], to: [p.x, p.y], label: `${u.name} · 传送${t.name}` });
        t.x = p.x; t.y = p.y;
        if (t.team === 'ally') this.recordRoute(t, [[p.x, p.y]]);
        this.log(`${u.name}将${t.name}传送至${p.x + 1}列${p.y + 1}行；目标移动力与行动次数不变。`, 'skill');
        this.finishAction(u, mode); return { ok: true };
      }
      const t = typeof target === 'string' ? this.get(target) : target;
      if (!t || !choices.some(p => p.id === t.id)) return { ok: false, error: '目标不在有效范围内，或技能仍在冷却。' };
      this.fx('cast', { id, x: u.x, y: u.y, name: mode === 'attack' ? '普通攻击' : SKILLS[mode].name, label: `${u.name} · ${mode === 'attack' ? '普通攻击' : SKILLS[mode].name}` });
      if (mode !== 'regen') this.fx('attack', { id, from: [u.x, u.y], to: [t.x, t.y], mode, label: `${u.name} · ${mode === 'attack' ? '普通攻击' : SKILLS[mode].name} → ${t.name}` });
      if (mode === 'heal') this.restoreHealth(t, SKILLS.heal.healing, `${u.name}·战地救护`);
      else if (mode === 'regen') {
        u.regenRemaining = SKILLS.regen.duration;
        this.fx('status', { id, x: u.x, y: u.y, value: '再生 ×3', positive: true, label: `${u.name} · 再生3次` });
        this.log(`${u.name}获得再生，从本回合起连续3次我方回合结束各回复8点生命。`, 'skill');
      }
      else if (mode === 'cover') { this.cover = { guard: u.id, target: t.id }; this.fx('status', { x: t.x, y: t.y, value: '掩护', positive: true, label: `${t.name}获得掩护` }); this.log(`${u.name}掩护${t.name}，持续至下个我方阶段。`, 'skill'); }
      else {
        const s = SKILLS[mode], base = s?.power ?? u.atk, type = s?.damageType ?? u.damage, ignore = !!s?.ignoreDefense;
        if (mode === 'attack') this.stats.attacks++;
        this.hurt(t, this.damage(u, t, base, type, ignore), `${u.name}·${mode === 'attack' ? '普攻' : SKILLS[mode].name}`);
        if (mode === 'bash' && t.hp > 0) {
          const dx = Math.abs(t.x - u.x) >= Math.abs(t.y - u.y) ? Math.sign(t.x - u.x) : 0;
          const dy = dx ? 0 : Math.sign(t.y - u.y), x = t.x + dx, y = t.y + dy;
          if (this.walkable(x, y) && !this.at(x, y)) { this.fx('move', { id: t.id, from: [t.x, t.y], path: [[x, y]], label: `${t.name} · 被推退` }); t.x = x; t.y = y; this.log(`${t.name}被推开1格。`, 'skill'); }
          else this.log('前方有阻挡，目标未被推开。');
          t.stunned = true;
          this.fx('status', { id: t.id, x: t.x, y: t.y, value: '眩晕', label: `${t.name} · 下次敌方阶段完全无法行动` });
          this.log(`${t.name}眩晕：下次敌方阶段不能移动、普攻或使用技能。`, 'skill');
        }
        if (mode === 'suppress' && t.hp > 0) { t.slow = true; this.fx('status', { x: t.x, y: t.y, value: '减速 −2', label: `${t.name} · 下次移动力−2` }); }
        if (mode === 'freeze' && t.hp > 0) { t.rooted = true; this.fx('status', { x: t.x, y: t.y, value: '定身', label: `${t.name} · 下次不能移动，仍可攻击` }); this.log(`${t.name}定身：下次敌方阶段不能移动，仍可攻击和使用技能。`, 'skill'); }
        if (mode === 'fireball') for (const e of this.active('enemy').filter(e => e.id !== t.id && dist(e, t) === 1)) this.hurt(e, this.damage(u, e, SKILLS.fireball.splash, 'magic'), '火球溅射');
      }
      this.finishAction(u, mode === 'attack' ? null : mode); return { ok: true };
    }
    restoreHealth(t, amount, source) {
      const hp = Math.min(amount, t.maxHp - t.hp); t.hp += hp;
      this.fx('status', { id: t.id, x: t.x, y: t.y, value: `+${hp}`, positive: true, label: `${source} · ${t.name}回复${hp}` });
      this.log(`${source}：${t.name}恢复${hp}点生命。`, 'skill'); return hp;
    }
    lose(reason) { if (this.status !== 'playing') return; this.status = 'lost'; this.phase = 'over'; this.reason = reason; this.log(reason, 'danger'); }
    beginEnemyPhase() {
      if (this.phase !== 'player' || this.status !== 'playing') return false;
      this.phase = 'enemy'; this.undo = null;
      for (const u of this.active('ally')) {
        u.slow = false;
        if (u.regenRemaining > 0) {
          this.restoreHealth(u, SKILLS.regen.healing, '坚守再生');
          if (--u.regenRemaining === 0) this.log(`${u.name}的再生效果结束。`);
        }
      }
      this.log('敌方阶段开始。'); return true;
    }
    enemyIntent(e) {
      return '本回合移动后能攻击就优先攻击，优先选择离自己最近的可攻击队员；无人可攻击时向最近队员靠近。';
    }
    exitDistance(u) { return Math.max(10 - u.x, u.x - 11, 0) + Math.max(3 - u.y, u.y - 5, 0); }
    priorityTargets(e) {
      return this.active('ally').sort((a, b) =>
        dist(e, a) - dist(e, b) || a.hp - b.hp || a.id.localeCompare(b.id));
    }
    bestEnemyAttack(e, pos, target) {
      const options = [{ skill: null, range: e.range, base: e.atk }];
      if (e.kind === 'heavy') options.push({ skill: 'hook', range: 3, base: ENEMY_SKILLS.hook.power }, { skill: 'slam', range: 1, base: ENEMY_SKILLS.slam.power });
      if (e.kind === 'bow') options.push({ skill: 'pin', range: 4, base: ENEMY_SKILLS.pin.power });
      if (e.kind === 'chaser') options.push({ skill: 'hamstring', range: 1, base: e.atk });
      // Pure prediction: evaluating cover must not emit logs or consume any effect.
      const guard = this.cover?.target === target.id && this.get(this.cover.guard);
      const protectedTarget = guard && guard.hp > 0 && !guard.evacuated;
      const recipient = protectedTarget ? guard : target, multiplier = protectedTarget ? .55 : 1;
      const actor = { ...e, x: pos.x, y: pos.y };
      return options.filter(a => (!a.skill || this.enemyReady(e, a.skill)) && this.inRange(pos, target, a.range)).map(a => ({
        ...a, damage: expectedDamage(this.enemyDamage(actor, recipient, a.base, multiplier), recipient.hp)
      })).sort((a, b) => b.damage - a.damage || Number(!!b.skill) - Number(!!a.skill))[0];
    }
    attackDistanceField(e, target, range) {
      // Reverse Dijkstra measures movement to an actual unobstructed firing cell, not through cargo.
      const field = new Map(), queue = [];
      for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[y].length; x++) {
        const occ = this.at(x, y);
        if (this.walkable(x, y) && (!occ || occ.team === e.team) && this.inRange({ x, y }, target, range)) {
          field.set(key(x, y), 0); queue.push({ x, y, cost: 0 });
        }
      }
      while (queue.length) {
        queue.sort((a, b) => a.cost - b.cost); const p = queue.shift();
        if (field.get(key(p.x, p.y)) !== p.cost) continue;
        for (const [dx, dy] of dirs) {
          const x = p.x + dx, y = p.y + dy, occ = this.at(x, y);
          if (!this.walkable(x, y) || (occ && occ.team !== e.team)) continue;
          const cost = p.cost + this.stepCost(e, p.x, p.y), k = key(x, y);
          if (field.has(k) && field.get(k) <= cost) continue;
          field.set(k, cost); queue.push({ x, y, cost });
        }
      }
      return field;
    }
    spawnChaser() {
      const e = this.get('chaser');
      if (e.spawned || e.hp <= 0) return;
      const positions = CHASER_SPAWNS.filter(([x, y]) => !this.at(x, y));
      if (!positions.length) { this.log('追击者登场位置全部被占用，延后至下一次敌方行动结束。', 'event'); return; }
      const [x, y] = positions[Math.floor(this.random() * positions.length)];
      Object.assign(e, { x, y, spawned: true, stealthed: true, stealthUntilRound: this.round + 1, ambushBonus: 4 });
      this.fx('spawn', { id: e.id, x, y, label: `追击者 · 从${x + 1}列${y + 1}行登场` });
      this.fx('cast', { id: e.id, x, y, name: '潜行', label: '追击者 · 潜行' });
      this.log(`追击者从${x + 1}列${y + 1}行登场并施放潜行，持续至第${e.stealthUntilRound}回合结束：无法被普攻或技能选中，期间首次伤害+4。`, 'event');
    }
    enemyAct(id) {
      const e = this.get(id); if (!e || e.spawned === false || e.hp <= 0 || this.status !== 'playing') return;
      const heroes = this.active('ally'); if (!heroes.length) return;
      this.fx('focus', { id, x: e.x, y: e.y, label: `${e.name} · 正在行动` });
      if (e.stunned) {
        this.fx('status', { id, x: e.x, y: e.y, value: '无法行动', label: `${e.name} · 眩晕，跳过本次行动` });
        this.log(`${e.name}眩晕，本次敌方阶段无法移动、攻击或使用技能。`, 'skill');
        e.stunned = false; e.rooted = false; e.slow = false; return;
      }
      const range = this.enemyRange(e);
      const priority = this.priorityTargets(e), primary = priority[0];
      let target, attack;
      const dangerous = p => (this.fire.has(key(p.x, p.y)) ? 5 : 0) + (this.warn.some(w => w.x === p.x && w.y === p.y) ? 6 : 0);
      const choices = this.reach(e, this.enemyBudget(e)), attacks = [];
      for (const p of choices) for (const [rank, hero] of priority.entries()) {
        const action = this.bestEnemyAttack(e, p, hero);
        if (action) attacks.push({ p, target: hero, attack: action, rank });
      }
      let destination;
      if (attacks.length) {
        attacks.sort((a, b) => a.rank - b.rank || b.attack.damage - a.attack.damage || dangerous(a.p) - dangerous(b.p) || a.p.cost - b.p.cost);
        const chosen = attacks[0]; destination = chosen.p; target = chosen.target; attack = chosen.attack;
      } else if (!e.rooted) {
        const field = this.attackDistanceField(e, primary, range);
        choices.sort((a, b) => {
          const ad = field.get(key(a.x, a.y)) ?? 1000 + dist(a, primary), bd = field.get(key(b.x, b.y)) ?? 1000 + dist(b, primary);
          return ad - bd || dangerous(a) - dangerous(b) || a.cost - b.cost;
        });
        destination = choices[0];
      }
      if (destination) {
        this.followPath(e, destination.path, destination.swapMode);
        if (destination.path.length) this.log(`${e.name}移动到${e.x + 1}列${e.y + 1}行，${target ? '攻击' : '接近'}${(target || primary).name}。`);
      }
      if (target) {
        const { skill, base } = attack;
        const label = `${e.name} · ${skill ? ENEMY_SKILLS[skill].name : '普通攻击'}`;
        this.fx('cast', { id, x: e.x, y: e.y, name: skill ? ENEMY_SKILLS[skill].name : '普通攻击', label });
        this.fx('attack', { id, from: [e.x, e.y], to: [target.x, target.y], mode: skill || 'attack', label: `${label} → ${target.name}` });
        const recipient = this.attackRecipient(target);
        target = recipient.unit;
        const bonus = e.ambushBonus || 0;
        if (bonus) {
          e.ambushBonus = 0;
          this.fx('status', { id, x: e.x, y: e.y, value: '伤害+4', label: '追击者 · 潜行攻击' });
          this.log('追击者消耗潜行增伤，本次伤害额外增加4点。', 'skill');
        }
        this.hurt(target, this.enemyDamage(e, target, base, recipient.multiplier, bonus), label);
        if (skill) e.cooldowns[skill] = this.round + ENEMY_SKILLS[skill].cd;
        if (target.hp > 0 && (skill === 'pin' || skill === 'hook' || skill === 'hamstring')) {
          target.slow = true;
          this.fx('status', { x: target.x, y: target.y, value: '减速 −1', label: `${target.name} · 下回合移动力−1` });
          this.log(`${target.name}下个我方阶段移动力降低1点（同类减速不叠加）。`, 'danger');
        }
        if (target.hp > 0 && (skill === 'hook' || skill === 'slam')) {
          const dx = Math.abs(target.x - e.x) >= Math.abs(target.y - e.y) ? Math.sign(target.x - e.x) : 0;
          const dy = dx ? 0 : Math.sign(target.y - e.y);
          const dir = skill === 'hook' ? -1 : 1, x = target.x + dx * dir, y = target.y + dy * dir;
          if (this.walkable(x, y) && !this.at(x, y)) {
            this.fx('move', { id: target.id, from: [target.x, target.y], path: [[x, y]], label: `${target.name} · ${skill === 'hook' ? '被拉近' : '被推退'}` });
            target.x = x; target.y = y; this.log(`${target.name}${skill === 'hook' ? '被拉近' : '被推退'}1格。`, 'danger');
          } else this.log('位移落点受阻，目标位置不变。');
        }
      } else {
        const text = e.rooted ? `${e.name}被冰缚限制，未能接近队员。` : `${e.name}调整防线，本次没有可攻击目标。`;
        this.log(text); this.fx('status', { x: e.x, y: e.y, value: e.rooted ? '无法移动' : '警戒', label: text });
      }
      e.rooted = false; e.slow = false;
    }
    finishRound() {
      if (this.status !== 'playing' || this.phase !== 'enemy') return;
      for (const e of this.active('enemy')) if (e.stealthed && e.stealthUntilRound <= this.round) {
        e.stealthed = false; e.ambushBonus = 0;
        this.fx('status', { id: e.id, x: e.x, y: e.y, value: '现身', label: `${e.name} · 潜行到期` });
        this.log(`${e.name}的潜行持续时间结束，恢复为可直接选取的目标。`, 'event');
      }
      this.spawnChaser();
      const impactTiles = this.warn.map(p => ({ ...p }));
      for (const p of this.warn) {
        this.fx('bomb', { x: p.x, y: p.y, label: `岸防炮击 · ${p.x + 1}列${p.y + 1}行` });
        const u = this.at(p.x, p.y); if (u) this.hurt(u, BOMBARDMENT.damage, '船坞炮击');
      }
      if (this.warn.length) this.log(`炮击落地：每处${formatDamage(BOMBARDMENT.damage)}点浮动伤害；落点下回合起火，持续3次回合末。已有火场仍正常结算。`, 'danger');
      // Only fire already present this round deals damage; new impacts ignite next round.
      for (const u of this.units.filter(u => u.spawned !== false && u.hp > 0 && !u.evacuated)) {
        if (this.fire.has(key(u.x, u.y))) this.hurt(u, FIRE_DAMAGE, '火场');
        if (this.status !== 'playing') return;
      }
      this.stats.turns++; if (this.status !== 'playing') return;
      if (this.round >= LIMIT) { this.lose(`撤离窗口关闭：第${LIMIT}回合结束，仍有队员未登艇。`); return; }
      this.round++; this.phase = 'player'; this.cover = null;
      for (const p of impactTiles) {
        const k = key(p.x, p.y), newlyLit = !this.fire.has(k);
        this.fire.add(k);
        if (!this.permanentFire.has(k)) this.fireExpiry[k] = this.round + BOMBARDMENT.fireDuration;
        if (newlyLit) this.fx('status', { x: p.x, y: p.y, value: '起火', label: `炮击落点起火 · ${p.x + 1}列${p.y + 1}行` });
      }
      let extinguished = 0;
      for (const [k, expires] of Object.entries(this.fireExpiry)) if (expires <= this.round) { this.fire.delete(k); delete this.fireExpiry[k]; extinguished++; }
      if (extinguished) this.log(`${extinguished}处炮击火场熄灭，地格恢复原有移动消耗与强化效果。`);
      for (const u of this.active('ally')) {
        u.moveLeft = this.speed(u); u.moved = false; u.acted = false; u.ended = false;
      }
      this.warn = this.bombardmentTargets();
      if (this.round === BOMBARDMENT.start) this.log('局势变化：岸防炮启动，每2回合炮击一次（第3、5、7回合）。本回合敌方行动结束后轰炸预告落点。', 'event');
      if (this.warn.length) this.log(`第${this.round}回合炮击预告：${this.warn.map(p => `${p.x + 1}列${p.y + 1}行`).join('、')}。本回合敌方阶段结束后落地。`, 'danger');
      this.log(`第${this.round}回合 · 我方阶段。`);
    }
    endTurn() { if (!this.beginEnemyPhase()) return false; for (const e of this.active('enemy')) this.enemyAct(e.id); this.finishRound(); return true; }
    result() {
      return { outcome: this.status, seed: this.seed, round: this.round, evacuated: this.units.filter(u => u.evacuated).length, kills: this.stats.kills,
        attacks: this.stats.attacks, skills: { ...this.stats.skills }, routes: { ...this.stats.routeVisits }, damageTaken: this.stats.damageTaken,
        elapsedSeconds: Math.floor((Date.now() - this.stats.started) / 1000), cleanSweep: this.status === 'won' && this.units.filter(u => u.team === 'enemy').every(u => u.hp <= 0),
        reason: this.reason, history: this.history.map(e => ({ ...e })) };
    }
  }
  return { Game, MAP, SKILLS, ENEMY_SKILLS, HEROES, ENEMIES, BOMBARDMENT, FIRE_DAMAGE, LIMIT, CHASER_SPAWNS, key, dist, damageBounds, formatDamage, expectedDamage };
});
