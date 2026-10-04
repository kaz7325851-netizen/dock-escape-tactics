(function () {
  'use strict';
  const { Game, MAP, SKILLS, ENEMY_SKILLS, BOMBARDMENT, formatDamage, LIMIT, key, dist } = DockTactics;
  const seedParam = new URLSearchParams(location.search).get('seed');
  const game = new Game(seedParam === null ? undefined : Number(seedParam));
  let selected = 'guard', mode = 'move', teleportTarget = null, inspected = null, hover = null, showThreats = false, busy = false, started = false, confirmAction = null, rulesReturnIntro = false;
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = ms => reducedMotion ? Math.max(90, ms * .3) : ms / Number($('animation-speed').value);
  async function animate(element, frames, ms, options = {}) {
    if (!element) return;
    const animation = element.animate(frames, { duration: duration(ms), easing: 'ease-out', fill: 'forwards', ...options });
    await animation.finished.catch(() => {});
  }
  function cellCenter(x, y) {
    const rect = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`).getBoundingClientRect(), frame = $('fx-layer').getBoundingClientRect();
    return { x: rect.left - frame.left + rect.width / 2, y: rect.top - frame.top + rect.height / 2, size: rect.width };
  }
  function visual(type, x, y, text = '') {
    const point = cellCenter(x, y), node = document.createElement('div');
    node.className = `fx ${type}`; node.textContent = text; node.style.left = `${point.x}px`; node.style.top = `${point.y}px`;
    $('fx-layer').append(node); return node;
  }
  async function playEffects(events) {
    const ghosts = new Map(), layer = $('fx-layer');
    async function moveGhost(id, from, path) {
      const token = document.querySelector(`.unit[data-id="${id}"]`), start = cellCenter(...from);
      let ghost = ghosts.get(id);
      if (!ghost && token) {
        ghost = token.cloneNode(true); ghost.className += ' fx-mover';
        ghost.style.width = `${start.size * .72}px`; ghost.style.height = `${start.size * .78}px`;
        layer.append(ghost); ghosts.set(id, ghost); token.style.visibility = 'hidden';
      }
      if (!ghost) return;
      ghost.getAnimations().forEach(a => a.cancel());
      ghost.style.left = `${start.x}px`; ghost.style.top = `${start.y}px`;
      const frames = [from, ...path].map(([x, y]) => {
        const point = cellCenter(x, y); return { transform: `translate(calc(-50% + ${point.x - start.x}px), calc(-50% + ${point.y - start.y}px))` };
      });
      await animate(ghost, frames, Math.min(900, 145 * path.length));
    }
    $('board').classList.add('locked');
    for (const effect of events) {
      $('activity-text').textContent = effect.label;
      $('activity-bar').classList.add('playing');
      const token = document.querySelector(`.unit[data-id="${effect.id}"]`), current = ghosts.get(effect.id) || token;
      if (effect.type === 'cast') {
        if (current) {
          let badge = current.querySelector('.cast-label');
          if (!badge) { badge = document.createElement('span'); badge.className = 'cast-label'; current.append(badge); }
          badge.textContent = effect.name; current.classList.add('casting');
          await animate(badge, [{ opacity: 0, transform: 'translate(-50%,4px) scale(.85)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], 180);
        }
        await sleep(duration(320));
      } else if (effect.type === 'focus') {
        token?.classList.add('acting'); await sleep(duration(260));
      } else if (effect.type === 'move') {
        await moveGhost(effect.id, effect.from, effect.path);
      } else if (effect.type === 'swap') {
        await Promise.all([moveGhost(effect.id, effect.from, effect.path || [effect.to]), moveGhost(effect.other, effect.to, effect.reversePath || [effect.from])]);
      } else if (effect.type === 'spawn') {
        const point = cellCenter(effect.x, effect.y), ghost = pawn(game.get(effect.id));
        ghost.className += ' fx-mover'; ghost.style.width = `${point.size * .72}px`; ghost.style.height = `${point.size * .78}px`;
        ghost.style.left = `${point.x}px`; ghost.style.top = `${point.y}px`;
        layer.append(ghost); ghosts.set(effect.id, ghost);
        await animate(ghost, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], 400);
      } else if (effect.type === 'teleport') {
        const origin = visual('fx-portal', ...effect.from), exit = visual('fx-portal', ...effect.to);
        await Promise.all([animate(origin, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], 360),
          animate(current, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.2)' }], 250)]);
        if (token) {
          const dest = cellCenter(...effect.to), ghost = token.cloneNode(true);
          ghost.className += ' fx-mover'; ghost.style.visibility = 'visible';
          ghost.style.width = `${dest.size * .72}px`; ghost.style.height = `${dest.size * .78}px`;
          ghost.style.left = `${dest.x}px`; ghost.style.top = `${dest.y}px`;
          layer.append(ghost); ghosts.set(effect.id, ghost); token.style.visibility = 'hidden';
          await animate(ghost, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.2)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], 300);
        }
        await animate(exit, [{ transform: 'translate(-50%,-50%) scale(1.5)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }], 250);
        origin.remove(); exit.remove();
      } else if (effect.type === 'attack') {
        const start = cellCenter(...effect.from), end = cellCenter(...effect.to);
        current?.classList.add('acting');
        const shot = visual('fx-shot ' + effect.mode, ...effect.from);
        const trail = visual('fx-trail ' + effect.mode, ...effect.from);
        const dx = end.x - start.x, dy = end.y - start.y;
        trail.style.width = `${Math.hypot(dx, dy)}px`; trail.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
        await Promise.all([animate(shot, [{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 }, { opacity: 1, offset: .15 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.3)`, opacity: 1 }], 320),
          animate(trail, [{ opacity: 0 }, { opacity: .75, offset: .25 }, { opacity: 0 }], 400)]);
        shot.remove(); trail.remove();
      } else if (effect.type === 'damage' || effect.type === 'status') {
        const text = visual(`fx-number ${effect.type === 'status' ? effect.positive ? 'positive' : 'control' : 'negative'}`, effect.x, effect.y, effect.type === 'damage' ? `−${effect.value}` : effect.value);
        if (effect.type === 'damage') {
          const ring = visual('fx-impact', effect.x, effect.y);
          animate(ring, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: .9 }, { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0 }], 350).then(() => ring.remove());
          animate(current?.querySelector('.pawn'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], 230);
          if (effect.dead) animate(current, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.5)' }], 380);
        }
        await animate(text, [{ transform: 'translate(-50%,-20%)', opacity: 1 }, { transform: 'translate(-50%,-150%)', opacity: 0 }], 520); text.remove();
      } else if (effect.type === 'bomb') {
        const ring = visual('fx-explosion', effect.x, effect.y);
        const flash = visual('fx-number negative', effect.x, effect.y, '炮击');
        await Promise.all([animate(ring, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(2.8)', opacity: 0 }], 480),
          animate(flash, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-120%)', opacity: 0 }], 550)]);
        ring.remove(); flash.remove();
      } else if (effect.type === 'board') {
        await animate(current, [{ opacity: 1 }, { opacity: 0, transform: 'translate(20px,-12px) scale(.6)' }], 400);
        const text = visual('fx-number positive', effect.x, effect.y, '已撤离');
        await animate(text, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-120%)', opacity: 0 }], 350); text.remove();
      }
    }
    layer.replaceChildren(); $('activity-bar').classList.remove('playing');
  }
  async function playerPlayback(after) {
    busy = true; $('end-turn').disabled = true; $('undo-button').disabled = true; $('wait-button').disabled = true;
    document.querySelectorAll('#action-buttons button').forEach(b => b.disabled = true);
    $('phase-label').textContent = '行动播放中';
    await playEffects(game.takeEffects());
    busy = false; after?.(); render(); checkResult();
  }
  let toastTimer;
  const tileNames = { water: '水面 · 无法通行', wall: '堆放货箱 · 无法通行 / 阻挡射线', deck: '木质栈道', exit: '逃生艇接驳区', fire: '持续火场', boost: '强化伤害地格' };
  const tileDesc = { water: '水面无法通行。', wall: '货箱阻挡移动与远程技能，攻击需要无遮挡的视线。', deck: '每进入1格消耗1点移动力。', exit: '登艇消耗一次行动，仅能在绿色接驳区执行。三名队员全部登艇即胜利。', fire: '进入消耗2点移动力；回合末受到4—6点浮动伤害。初始火场持续整关，炮击火场从落地后的下回合起燃烧3次回合末，重复炮击刷新时长。', boost: '站在该地格时，物理和魔法伤害提高2点。没有防御加成。燃烧期间加成失效，火熄灭后恢复。' };
  function toast(text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400); }
  function clearToast() { clearTimeout(toastTimer); $('toast').classList.remove('show'); $('toast').textContent = ''; }
  function confirm(title, message, action) { $('confirm-title').textContent = title; $('confirm-message').textContent = message; confirmAction = action; $('confirm-dialog').showModal(); }
  function pick(id) {
    const u = game.get(id); if (!u || u.team !== 'ally') return;
    clearToast(); selected = id; teleportTarget = null; inspected = null; hover = null; mode = game.canMove(u) ? 'move' : game.canUse(u) ? 'attack' : null; render();
  }
  function nextActor() {
    teleportTarget = null;
    const current = game.get(selected), u = game.pending(current) ? current : game.active('ally').find(u => game.pending(u));
    if (u) { selected = u.id; mode = game.canMove(u) ? 'move' : game.canUse(u) ? 'attack' : null; }
    else mode = null;
  }
  function resourceState(u) {
    if (u.evacuated) return '已登艇';
    if (u.hp <= 0) return '阵亡';
    if (game.done(u)) return '已完成';
    return `移动 ${u.moveLeft} · 行动 ${u.acted ? '已用' : '可用'}`;
  }
  function targets() {
    const u = game.get(selected); if (!u || !mode || mode === 'move' || mode === 'swap') return [];
    return mode === 'teleport' && teleportTarget ? game.teleportDestinations(u, game.get(teleportTarget)) : game.targets(u, mode);
  }
  function moveTiles() {
    const u = game.get(selected);
    return u && (mode === 'move' || mode === 'swap') && game.canMove(u)
      ? game.reach(u).filter(p => p.path.length && p.swapMode === (mode === 'swap')) : [];
  }
  function movementPreview(u, p) {
    const positions = new Map([...game.active('ally'), ...game.active('enemy')].map(t => [t.id, { x: t.x, y: t.y }]));
    const origin = new Map([...positions].map(([id, pos]) => [id, { ...pos }]));
    for (const [x, y] of p.path) {
      const old = positions.get(u.id);
      if (p.swapMode) {
        const friend = [...positions].find(([id, pos]) => id !== u.id && pos.x === x && pos.y === y);
        if (friend) positions.set(friend[0], { ...old });
      }
      positions.set(u.id, { x, y });
    }
    const changes = [...positions].filter(([id, pos]) => pos.x !== origin.get(id).x || pos.y !== origin.get(id).y);
    changes.sort(([a], [b]) => a === u.id ? -1 : b === u.id ? 1 : 0);
    const detail = changes.map(([id, pos]) => {
      const from = origin.get(id);
      return `${game.get(id).name}：${from.x + 1}·${from.y + 1} → ${pos.x + 1}·${pos.y + 1}`;
    }).join('；');
    return `消耗${u.name}${p.cost}点移动力，移动后剩${u.moveLeft - p.cost}点${p.swaps ? ` · ${p.swaps}次换位，其他单位移动力和行动次数不变` : ''}。\n${detail}`;
  }
  function threatTiles(enemy) {
    const out = new Set();
    if (enemy.stunned) return out;
    for (const pos of game.reach(enemy, game.enemyBudget(enemy))) {
      for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[y].length; x++) {
        if (game.walkable(x, y) && game.inRange(pos, { x, y }, game.enemyRange(enemy))) out.add(key(x, y));
      }
    }
    return out;
  }
  function pawn(u) {
    const token = document.createElement('div'); token.className = `unit ${u.team === 'enemy' ? 'enemy' : 'ally'}${u.team === 'ally' && game.done(u) ? ' acted' : ''}${selected === u.id ? ' selected' : ''}`;
    token.dataset.id = u.id;
    token.style.setProperty('--unit-color', u.color || '#d48179');
    const emblem = document.createElement('span'); emblem.className = 'pawn'; emblem.textContent = u.glyph; token.append(emblem);
    const name = document.createElement('span'); name.className = 'unit-name'; name.textContent = u.team === 'enemy' ? ({ heavy: '重甲', bow: '弩手', chaser: '追击' }[u.kind]) : u.name; token.append(name);
    const bar = document.createElement('span'); bar.className = 'hp-mini'; const fill = document.createElement('i'); fill.style.width = `${u.hp / u.maxHp * 100}%`; bar.append(fill); token.append(bar);
    const statuses = [];
    if (u.stunned) statuses.push(['晕', '眩晕：下次敌方阶段无法移动、普攻或使用技能']);
    if (u.rooted) statuses.push(['缚', '定身：下次不能移动，仍可攻击和使用技能']);
    if (u.slow) statuses.push(['缓', `下次移动力−${u.team === 'ally' ? 1 : 2}`]);
    if (game.cover?.target === u.id) statuses.push(['护', '本回合所有单体攻击与附带效果由守卫承接，不限次数']);
    if (u.regenRemaining > 0) statuses.push(['生', `再生：剩余${u.regenRemaining}次我方回合结束，各回复8`]);
    if (u.stealthed) { statuses.push(['隐', `潜行至第${u.stealthUntilRound}回合结束：无法被普攻或技能选中${u.ambushBonus ? '，首次伤害+4' : ''}`]); token.classList.add('stealthed'); }
    for (const [i, [text, title]] of statuses.entries()) {
      const status = document.createElement('span'); status.className = 'status-icon'; status.textContent = text; status.title = title;
      status.style.bottom = `${8 + i * 15}px`; token.append(status);
    }
    if (teleportTarget === u.id) token.classList.add('teleport-selected');
    return token;
  }
  function renderBoard() {
    const board = $('board'); board.replaceChildren(); board.classList.toggle('locked', busy || game.status !== 'playing');
    const moves = moveTiles(), ts = targets(), reachSet = new Set(moves.map(p => key(p.x, p.y))), targetSet = new Set(ts.map(p => key(p.x, p.y)));
    const actor = game.get(selected), rangeCells = mode === 'teleport' && teleportTarget ? game.teleportArea(game.get(teleportTarget)) : game.actionRange(actor, mode);
    const rangeSet = new Set(mode && mode !== 'move' && mode !== 'swap' && !busy ? rangeCells.map(p => key(p.x, p.y)) : []);
    const splashSet = new Set();
    if (mode === 'fireball' && hover && targetSet.has(key(hover.x, hover.y))) {
      for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) if (game.walkable(hover.x + dx, hover.y + dy)) splashSet.add(key(hover.x + dx, hover.y + dy));
    }
    $('range-caption').textContent = mode === 'teleport' && teleportTarget ? `传送 · 目标：${game.get(teleportTarget).name} · 落点距离3格` : mode === 'attack' ? `普通攻击 · 射程${actor.range}格 · ${actor.damage === 'magic' ? '魔法' : '物理'}` : SKILLS[mode] ? `${SKILLS[mode].name} · ${SKILLS[mode].type === 'self' ? '自身' : '射程' + SKILLS[mode].range + '格'}${mode === 'fireball' ? ' · 相邻1格溅射' : ''}` : mode === 'move' ? `普通移动 · 剩余${actor.moveLeft}点` : '当前没有选中的行动';
    if (mode === 'swap') $('range-caption').textContent = `换位 · 剩余${actor.moveLeft}点 · 可换位友军${moves.length}名`;
    if (mode === 'attack' || SKILLS[mode]) $('range-caption').textContent += ` · 有效目标${ts.length}`;
    const warnSet = new Set(game.warn.map(p => key(p.x, p.y)));
    let threats = new Set(); const enemy = inspected && inspected.id && game.get(inspected.id);
    if (enemy && enemy.team === 'enemy' && enemy.hp > 0) threats = threatTiles(enemy);
    else if (showThreats) for (const e of game.active('enemy')) for (const k of threatTiles(e)) threats.add(k);
    let pathSet = new Set();
    if (hover) { const p = moves.find(p => p.x === hover.x && p.y === hover.y); if (p && p.path) pathSet = new Set(p.path.map(([x, y]) => key(x, y))); }
    for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[y].length; x++) {
      const k = key(x, y), tile = game.tile(x, y), u = game.at(x, y);
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = `cell ${tile}`; cell.dataset.x = x; cell.dataset.y = y;
      if (game.fire.has(k)) cell.classList.add('burning');
      cell.tabIndex = tile === 'water' || tile === 'wall' ? -1 : 0;
      cell.setAttribute('aria-label', `${x + 1}列${y + 1}行 ${tileNames[tile]}${game.fire.has(k) ? ' 燃烧中' : ''}${u ? ` ${u.name} 生命${u.hp}/${u.maxHp}` : ''}${rangeSet.has(k) ? ' 行动范围内' : ''}${targetSet.has(k) ? ' 有效目标' : ''}${warnSet.has(k) ? ' 本回合末炮击' : ''}`);
      cell.title = `${x + 1}列${y + 1}行 · ${tileNames[tile]}${game.fire.has(k) ? ' · 燃烧中，进入耗2移动力，回合末伤害4—6' : ''}${u ? ` · ${u.name} ${u.hp}/${u.maxHp}` : ''}${rangeSet.has(k) ? ' · 行动范围内' : ''}${targetSet.has(k) ? ' · 有效目标' : ''}`;
      if (reachSet.has(k)) cell.classList.add('reachable'); if (targetSet.has(k)) cell.classList.add('targetable');
      if (mode === 'swap' && reachSet.has(k)) cell.classList.add('swap-target');
      if (rangeSet.has(k)) cell.classList.add('cast-range'); if (splashSet.has(k)) cell.classList.add('splash-range');
      if (threats.has(k)) cell.classList.add('threat'); if (warnSet.has(k)) cell.classList.add('bomb'); if (pathSet.has(k)) cell.classList.add('path');
      if (inspected && inspected.x === x && inspected.y === y) cell.classList.add('inspected');
      if (tile !== 'water' && tile !== 'wall') {
        const coord = document.createElement('span'); coord.className = 'coord'; coord.textContent = `${x + 1}·${y + 1}`; cell.append(coord);
        const icon = document.createElement('span'); icon.className = 'terrain-icon'; icon.textContent = tile === 'exit' && game.fire.has(k) ? '↗ ♨' : { fire: '♨', boost: '+2', exit: '↗' }[tile] || ''; cell.append(icon);
      }
      if (u) cell.append(pawn(u));
      if (warnSet.has(k)) { const tag = document.createElement('span'); tag.className = 'bomb-tag'; tag.textContent = '回合末'; cell.append(tag); }
      cell.addEventListener('click', event => clickTile(x, y, !!event.target.closest('.unit')));
      cell.addEventListener('pointerenter', () => updateHover(x, y)); cell.addEventListener('focus', () => updateHover(x, y));
      board.append(cell);
    }
  }
  function updateHover(x, y) {
    if (busy) return;
    hover = { x, y }; const u = game.get(selected), t = game.at(x, y);
    const choices = mode === 'move' || mode === 'swap' ? moveTiles() : targets();
    const p = choices.find(p => p.x === x && p.y === y);
    document.querySelectorAll('.cell.path').forEach(c => c.classList.remove('path'));
    document.querySelectorAll('.cell.splash-range').forEach(c => c.classList.remove('splash-range'));
    if (mode === 'fireball' && p && t && t.team === 'enemy') {
      for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
        if (game.walkable(x + dx, y + dy)) document.querySelector(`.cell[data-x="${x + dx}"][data-y="${y + dy}"]`)?.classList.add('splash-range');
      }
    }
    if (mode === 'teleport' && teleportTarget && p) {
      $('preview').textContent = `${game.get(teleportTarget).name} → ${x + 1}列${y + 1}行。目标移动力与行动次数不变${game.fire.has(key(x,y)) ? ' · 回合末火场伤害4—6' : ''}${game.warn.some(w=>w.x===x && w.y===y) ? ' · 本回合末炮击伤害6—10' : ''}。`;
    } else if (p && p.path) {
      for (const [px, py] of p.path) { const cell = document.querySelector(`.cell[data-x="${px}"][data-y="${py}"]`); if (cell) cell.classList.add('path'); }
      $('preview').textContent = `${movementPreview(u, p)}${game.fire.has(key(x, y)) ? '\n回合末火场伤害4—6点。' : ''}${game.warn.some(w => w.x === x && w.y === y) ? `\n本回合末炮击伤害${formatDamage(BOMBARDMENT.damage)}点。` : ''}`;
    } else if (u && t && p) $('preview').textContent = game.preview(u, t, mode);
    else if (!p) $('preview').textContent = `${tileNames[game.tile(x, y)]}。${t ? `${t.name} · 生命${t.hp}/${t.maxHp}。` : ''}${mode === 'swap' ? t && t.team === 'ally' && t.id !== selected ? '当前移动力不足或路径被阻挡，无法换位。' : '换位终点必须为其他友军头像。' : t && t.team === 'ally' ? '点击头像切换操控单位。' : ''}${game.warn.some(w => w.x === x && w.y === y) ? '本回合敌方行动结束后炮击。' : ''}`;
  }
  function clickTile(x, y, unitClicked = false) {
    if (busy || !started || game.status !== 'playing') return;
    const t = game.at(x, y), u = game.get(selected);
    if (unitClicked && t && t.team === 'ally' && (mode !== 'swap' || t.id === selected)) { pick(t.id); return; }
    if (mode === 'swap') {
      if (unitClicked && t && t.team === 'ally') {
        const p = moveTiles().find(p => p.x === x && p.y === y);
        if (!p) { toast('当前移动力不足或路径被阻挡，无法换位。'); updateHover(x, y); return; }
        const res = game.move(selected, x, y);
        if (!res.ok) toast(res.error);
        else { inspected = null; hover = null; playerPlayback(() => { if (!game.pending(game.get(selected))) nextActor(); }); }
      } else { inspected = { x, y, id: t ? t.id : null }; render(); updateHover(x, y); }
      return;
    }
    const isTarget = targets().some(p => p.x === x && p.y === y);
    if (mode === 'teleport') {
      if (teleportTarget && isTarget) { execute(mode, { unit: teleportTarget, x, y }); return; }
      if (t && game.targets(u, 'teleport').some(p => p.id === t.id)) {
        teleportTarget = t.id; inspected = null; hover = null; render(); return;
      }
    } else if (u && isTarget) { execute(mode, t.id); return; }
    if (mode === 'move' && !t && moveTiles().some(p => p.x === x && p.y === y)) {
      const res = game.move(selected, x, y);
      if (!res.ok) toast(res.error);
      else { inspected = null; hover = null; playerPlayback(() => { const actor = game.get(selected); if (game.pending(actor)) mode = game.canUse(actor) ? 'attack' : 'move'; else nextActor(); }); }
      return;
    }
    if (t && t.team === 'ally') { pick(t.id); return; }
    inspected = { x, y, id: t ? t.id : null }; render();
    if (mode && mode !== 'move' && t && t.team === 'enemy' && !isTarget && game.canUse(u)) toast(t.stealthed ? '目标处于潜行，无法被普攻或技能选中。' : '目标不在当前范围内，或被货箱遮挡。');
  }
  function execute(action, target) {
    if (busy) return; const res = game.act(selected, action, target);
    if (!res.ok) { toast(res.error); return; }
    teleportTarget = null; inspected = null; hover = null;
    playerPlayback(nextActor);
  }
  function button(text, sub, action, disabled = false, className = '', kind = '') {
    const b = document.createElement('button'); b.type = 'button'; b.className = `action-button ${className}`; b.disabled = disabled;
    const title = document.createElement('strong'); title.textContent = text; b.append(title);
    if (kind) { const label = document.createElement('span'); label.className = 'action-kind'; label.textContent = kind; b.append(label); }
    const hint = document.createElement('span'); hint.textContent = sub; b.append(hint); b.addEventListener('click', action); return b;
  }
  function chooseMode(next) { clearToast(); mode = next; teleportTarget = null; hover = null; inspected = null; render(); }
  function renderUnit() {
    const u = game.get(selected), info = $('unit-info'), buttons = $('action-buttons'); info.replaceChildren(); buttons.replaceChildren();
    if (!u) return;
    const panel = info.closest('.unit-panel');
    panel.style.setProperty('--hero-accent', u.color);
    panel.style.setProperty('--hero-tint', `${u.color}30`);
    panel.dataset.hero = u.id;
    const title = document.createElement('div'); title.className = 'unit-title'; const symbol = document.createElement('span'); symbol.className = 'hero-symbol'; symbol.style.setProperty('--unit-color', u.color); symbol.textContent = u.glyph; title.append(symbol, document.createTextNode(u.name)); info.append(title);
    const role = document.createElement('div'); role.className = 'unit-role'; role.textContent = u.role; info.append(role);
    const health = document.createElement('div'); health.className = 'health-bar'; const fill = document.createElement('i'); fill.style.width = `${u.hp / u.maxHp * 100}%`; health.append(fill); info.append(health);
    const metrics = document.createElement('div'); metrics.className = 'unit-metrics'; metrics.textContent = `生命 ${u.hp}/${u.maxHp}　剩余移动 ${u.moveLeft}/${game.speed(u)}${u.slow ? '（减速−1）' : ''}　物防 ${game.defense(u, 'physical')}　魔防 ${u.mdef}`; info.append(metrics);
    const resources = document.createElement('div'); resources.className = 'resource-summary';
    resources.textContent = `移动力：${u.moveLeft}　攻击 / 技能：${u.acted || u.evacuated ? '0' : '1'}次`;
    info.append(resources);
    const disabled = busy || !game.canUse(u);
    $('unit-action-state').textContent = resourceState(u);
    const movementHeading = document.createElement('div'); movementHeading.className = 'action-group-heading'; movementHeading.textContent = '移动方式 · 共用移动力'; buttons.append(movementHeading);
    buttons.append(button('移动', `剩余${u.moveLeft}点 · 可分段移动`, () => chooseMode('move'), busy || !game.canMove(u), mode === 'move' ? 'active' : ''));
    buttons.append(button('换位', '沿路径换位 · 仅自身耗移动力', () => chooseMode('swap'), busy || !game.canMove(u), mode === 'swap' ? 'active' : ''));
    const skillHeading = document.createElement('div'); skillHeading.className = 'action-group-heading skill-group-heading'; skillHeading.textContent = '攻击与技能 · 每回合共1次'; buttons.append(skillHeading);
    buttons.append(button('普通攻击', `${u.damage === 'magic' ? '魔法' : '物理'} · 射程${u.range}`, () => chooseMode('attack'), disabled, `attack-button ${mode === 'attack' ? 'active' : ''}`, '普攻'));
    for (const id of u.skills) {
      const s = SKILLS[id], cd = Math.max(0, (u.cooldowns[id] || 0) - game.round);
      buttons.append(button(s.name, cd > 0 ? `${cd}回合后可用` : u.acted ? '本回合行动已用' : `冷却${s.cd}回合 · ${s.type === 'self' ? '自身' : '射程' + s.range}`, () => chooseMode(id), disabled || cd > 0, `skill-button ${mode === id ? 'active' : ''}`, '技能'));
    }
    buttons.append(button('登艇撤离', u.acted ? '行动已用 · 下回合才能登艇' : '位于绿色区域 · 消耗一次行动', () => execute('board'), disabled || !game.isExit(u.x, u.y), 'board-button'));
    $('undo-button').disabled = busy || !game.undo || game.status !== 'playing';
    $('wait-button').disabled = busy || !game.pending(u);
    if (u.evacuated) $('action-hint').textContent = '该队员已登艇，不再占据地格或参与战斗。';
    else if (game.done(u)) $('action-hint').textContent = '该队员本回合已完成，无剩余移动或行动机会。';
    else if (mode === 'move') $('action-hint').textContent = '移动与换位共用剩余移动力，不消耗攻击 / 技能次数。普通移动以空格为终点，可穿过友军，沿途单位位置不变；普通格每格1点，火场每格2点。点击友军头像切换操控单位。';
    else if (mode === 'swap') $('action-hint').textContent = '换位以其他友军头像为终点，沿整段路径逐格交换位置，每次交换仅移动者消耗1点移动力。空格路段按地形计费，其他单位的移动力和行动次数不变；敌我不能换位或跨越。';
    else if (u.acted) $('action-hint').textContent = `本回合攻击 / 技能次数已用尽。剩余普通移动力：${u.moveLeft}点。`;
    else if (mode === 'attack') $('action-hint').textContent = `基础${u.damage === 'magic' ? '魔法' : '物理'}伤害${u.atk}点，射程${u.range}格，扣除对应防御后，伤害在80%—120%之间浮动。货箱阻挡射线。`;
    else if (SKILLS[mode]) $('action-hint').textContent = SKILLS[mode].desc + (['ally', 'self', 'unit'].includes(SKILLS[mode].type) ? ' 选择友军技能目标时点击其所在格的空白处；点击头像切换操控单位。' : '');
    else $('action-hint').textContent = '每回合一次普攻、技能或登艇。';
    $('preview').textContent = mode === 'swap' ? '预览可换位的友军：显示沿途各单位的新位置及移动力消耗。' : mode === 'move' ? '预览可移动的空格：显示路径与移动力消耗；沿途友军位置不变。' : mode === 'teleport' && teleportTarget ? `传送目标：${game.get(teleportTarget).name}。紫色地格为落点范围，金色边框为空闲有效落点；选取目标阶段未消耗行动或冷却。` : '紫色地格：行动范围；金色边框：有效目标；粉色虚线：火球溅射区域。友方技能选择目标地格生效，点击友军头像则切换操控单位。';
    if (u.regenRemaining > 0) {
      const buff = document.createElement('div'); buff.className = 'buff-summary'; buff.textContent = `再生：剩余${u.regenRemaining}次我方回合结束，各回复8`; info.append(buff);
    }
    if (game.cover?.target === u.id) {
      const buff = document.createElement('div'); buff.className = 'buff-summary'; buff.textContent = '掩护：至下个我方阶段开始，单体攻击不限次数代受'; info.append(buff);
    }
  }
  function renderRoster() {
    const list = $('roster'); list.replaceChildren();
    for (const u of game.units.filter(u => u.team === 'ally')) {
      const card = document.createElement('button'); card.type = 'button'; card.className = `hero-card${u.id === selected && !u.evacuated && u.hp > 0 ? ' selected' : ''}${u.evacuated ? ' evacuated' : ''}`; card.style.setProperty('--unit-color', u.color);
      const controlling = u.id === selected && !u.evacuated && u.hp > 0;
      card.dataset.id = u.id;
      card.disabled = busy || u.evacuated || u.hp <= 0;
      card.setAttribute('aria-pressed', String(controlling));
      card.setAttribute('aria-label', `${controlling ? '正在操控' : u.evacuated || u.hp <= 0 ? '' : '点击操控'} ${u.name} ${u.evacuated ? '已撤离' : `${u.hp}/${u.maxHp}生命 ${resourceState(u)}`}`);
      card.title = u.evacuated ? `${u.name}已登艇` : controlling ? `当前操控：${u.name}` : `点击切换至${u.name}`;
      const symbol = document.createElement('span'); symbol.className = 'hero-symbol'; symbol.textContent = u.glyph; card.append(symbol);
      const info = document.createElement('div'); info.className = 'hero-card-info'; const name = document.createElement('strong'); name.textContent = u.name; info.append(name);
      const role = document.createElement('small'); role.textContent = u.role; info.append(role);
      const hp = document.createElement('div'); hp.className = 'hp-row'; hp.textContent = `${u.hp} / ${u.maxHp} HP`; info.append(hp); card.append(info);
      const meta = document.createElement('span'); meta.className = 'card-meta';
      const choice = document.createElement('span'); choice.className = 'control-tag';
      choice.textContent = u.evacuated ? '已登艇' : u.hp <= 0 ? '阵亡' : controlling ? '正在操控' : '点击操控 →';
      meta.append(choice);
      const state = document.createElement('span'); state.className = 'card-state';
      state.textContent = game.done(u) ? resourceState(u) : `移动 ${u.moveLeft}\n行动 ${u.acted ? '已用' : '可用'}`;
      state.style.whiteSpace = 'pre-line'; meta.append(state); card.append(meta);
      card.addEventListener('click', () => { if (!busy) pick(u.id); }); list.append(card);
    }
  }
  function renderTarget() {
    const panel = $('target-info'); panel.replaceChildren();
    if (!inspected) { panel.textContent = '物理伤害由物防减免，魔法伤害由魔防减免；全部伤害在防御、加成及减伤结算后按80%—120%浮动，区间四舍五入，最低1点；治疗不浮动。红色边缘表示敌方移动后可攻击的潜在范围。'; return; }
    const t = inspected.id && game.get(inspected.id), tile = game.tile(inspected.x, inspected.y);
    const title = document.createElement('div'); title.className = 'target-name'; title.textContent = t ? t.name : tileNames[tile]; panel.append(title);
    if (t) {
      const metrics = document.createElement('div'); metrics.className = 'target-metrics'; metrics.textContent = `生命 ${t.hp}/${t.maxHp} · 物防 ${game.defense(t, 'physical')} · 魔防 ${t.mdef}\n移动 ${t.move} · 射程 ${t.range}`; panel.append(metrics);
      if (t.team === 'ally') { const role = document.createElement('div'); role.textContent = t.role; panel.append(role); }
      if (t.stunned || t.rooted || t.stealthed || t.regenRemaining > 0 || game.cover?.target === t.id) {
        const statuses = document.createElement('div'); statuses.className = 'target-intent'; statuses.textContent = [
          t.stunned ? '眩晕：下次敌方阶段不能移动、普攻或施放技能' : '',
          t.rooted ? '定身：下次不能移动，仍可攻击和使用技能' : '',
          t.stealthed ? `潜行至第${t.stealthUntilRound}回合结束：无法被普攻或技能选中${t.ambushBonus ? '，首次伤害+4' : ''}` : '',
          t.regenRemaining > 0 ? `再生：剩余${t.regenRemaining}次我方回合结束回复8` : '',
          game.cover?.target === t.id ? '掩护：本回合所有单体攻击由守卫承接' : ''
        ].filter(Boolean).join('；'); panel.append(statuses);
      }
      if (t.team === 'enemy') {
        for (const id of t.skills) {
          const s = ENEMY_SKILLS[id], cd = Math.max(0, (t.cooldowns[id] || 0) - game.round);
          const skill = document.createElement('div'); skill.className = 'enemy-skill'; skill.textContent = `${s.name} · ${s.spawnOnly ? t.stealthed ? '生效中' : '已结束' : cd ? `冷却${cd}回合` : '可用'}：${s.desc}`; panel.append(skill);
        }
        const intent = document.createElement('div'); intent.className = 'target-intent'; intent.textContent = `行动倾向：${game.enemyIntent(t)}`; panel.append(intent);
      }
      const u = game.get(selected);
      if (mode && targets().some(p => p.id === t.id)) { const preview = document.createElement('div'); preview.className = 'target-intent'; preview.textContent = game.preview(u, t, mode); panel.append(preview); }
    }
    const desc = document.createElement('div'); desc.className = 'target-metrics'; desc.textContent = tileDesc[tile]; panel.append(desc);
    if (game.fire.has(key(inspected.x, inspected.y))) {
      const time = document.createElement('div'); time.className = 'target-intent';
      const expiry = game.fireExpiry[key(inspected.x, inspected.y)];
      time.textContent = expiry ? `火场剩余：${expiry - game.round}次回合末。` : '初始火场：持续整关。'; panel.append(time);
    }
    if (game.warn.some(p => p.x === inspected.x && p.y === inspected.y)) { const warning = document.createElement('div'); warning.className = 'target-intent'; warning.textContent = `炮击预告：本回合敌方行动结束后造成${formatDamage(BOMBARDMENT.damage)}点浮动伤害，落点下回合起火，持续3次回合末；已有火场仍正常结算。`; panel.append(warning); }
  }
  function renderLog() {
    const log = $('log'); log.replaceChildren();
    for (const e of game.history.slice(-45)) { const entry = document.createElement('div'); entry.className = `log-entry ${e.type}`; const round = document.createElement('span'); round.className = 'log-round'; round.textContent = `R${e.round}`; entry.append(round, document.createTextNode(e.text)); log.append(entry); }
    log.scrollTop = log.scrollHeight;
  }
  function render() {
    $('round-label').textContent = `第 ${game.round} / ${LIMIT} 回合`;
    $('phase-label').textContent = game.status !== 'playing' ? '任务结束' : game.phase === 'enemy' ? '敌方阶段' : busy ? '行动播放中' : '我方阶段';
    $('phase-label').classList.toggle('enemy-phase', game.phase === 'enemy');
    const evacuated = game.units.filter(u => u.evacuated).length; $('objective-progress').textContent = `已撤离 ${evacuated} / 3`;
    $('event-banner').classList.toggle('danger', game.status === 'playing' && game.warn.length > 0);
    $('event-text').textContent = game.status !== 'playing' ? `任务结束：${game.reason}` : game.warn.length ? `岸防炮 · 队伍周边随机预告${game.warn.length}处，本回合敌方行动后各造成${formatDamage(BOMBARDMENT.damage)}点浮动伤害；下回合起火，持续3次回合末。` : `胜利条件：第${LIMIT}回合结束前，三名队员全部登艇。任一队员阵亡则失败。`;
    const remaining = game.active('ally').filter(u => game.pending(u)).length;
    $('remaining-actions').textContent = busy ? '正在播放行动…' : remaining ? `还有${remaining}名队员可移动或行动` : '全队已完成本回合操作';
    $('end-turn').disabled = busy || game.status !== 'playing'; $('range-button').textContent = showThreats ? '隐藏敌方威胁' : '显示敌方威胁';
    renderUnit(); renderRoster(); renderBoard(); renderTarget(); renderLog();
  }
  async function endTurn() {
    if (busy || game.status !== 'playing') return;
    busy = true; if (!game.beginEnemyPhase()) { busy = false; return; } mode = null; teleportTarget = null; inspected = null; hover = null; render();
    await playEffects(game.takeEffects()); render();
    await sleep(duration(200));
    for (const e of game.active('enemy')) {
      if (game.status !== 'playing') break;
      game.enemyAct(e.id); await playEffects(game.takeEffects()); render();
    }
    game.finishRound(); await playEffects(game.takeEffects()); busy = false; nextActor(); render(); checkResult();
    if (game.round === 3 && game.status === 'playing') toast('岸防炮启动。预告落点将在本回合敌方阶段结束后受到炮击。');
  }
  function checkResult() {
    if (game.status === 'playing' || $('result-dialog').open) return;
    const r = game.result(); $('result-eyebrow').textContent = game.status === 'won' ? '行动成功 / 三人安全登艇' : '行动失败 / 撤离条件未达成';
    $('result-title').textContent = game.status === 'won' ? '脱离封锁，撤离成功。' : '撤离行动未能完成。'; $('result-reason').textContent = r.reason;
    const stats = $('result-stats'); stats.replaceChildren();
    for (const [value, label] of [[`${r.evacuated}/3`, '安全撤离'], [`${r.round}/${LIMIT}`, '使用回合'], [`${r.kills}/5`, '击败敌人']]) { const stat = document.createElement('div'); stat.className = 'stat'; const number = document.createElement('strong'); number.textContent = value; const desc = document.createElement('span'); desc.textContent = label; stat.append(number, desc); stats.append(stat); }
    $('result-details').textContent = r.cleanSweep ? '隐藏成就「清除封锁」已达成：全部敌人被击败，三名队员全部登艇。' : `胜利条件：第${LIMIT}回合结束前三名队员全部登艇。失败条件：任一队员阵亡，或撤离期限结束仍有人未登艇。`;
    $('result-dialog').showModal();
  }
  function reset() {
    clearToast();
    rulesReturnIntro = false;
    for (const id of ['result-dialog', 'confirm-dialog', 'intro-dialog', 'rules-dialog']) if ($(id).open) $(id).close();
    game.reset(seedParam === null ? undefined : Number(seedParam)); game.stats.started = Date.now(); selected = 'guard'; mode = 'move'; teleportTarget = null; inspected = null; hover = null; busy = false; started = true; $('fx-layer').replaceChildren(); $('activity-text').textContent = '当前无行动播放'; render();
  }
  function exportRecord() {
    const r = game.result(); const names = Object.fromEntries(Object.entries(SKILLS).map(([id, s]) => [id, s.name]));
    const text = [`船坞脱困 · 原型试玩记录`, `记录时间：${new Date().toLocaleString('zh-CN')}`, `版本：0.15　战斗种子：${r.seed}`, `状态：${{ playing: '进行中', won: '撤离成功', lost: '撤离失败' }[r.outcome]}`, `回合：${r.round}/${LIMIT}　撤离：${r.evacuated}/3　击败敌人：${r.kills}/5`, `实际耗时：${r.elapsedSeconds}秒（包含思考与停留）`, `队伍承受伤害：${r.damageTaken}　普通攻击：${r.attacks}次`, `中央路径格数：${r.routes.center}　上侧路径格数：${r.routes.upper}　下侧路径格数：${r.routes.lower}`, `技能使用：${Object.entries(r.skills).map(([id, n]) => `${names[id]} ${n}次`).join('；') || '暂无'}`, `隐藏成就：${r.cleanSweep ? '已达成' : '未达成'}`, '', '——行动记录——', ...r.history.map(e => `[回合${e.round}] ${e.text}`)].join('\n');
    const blob = new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `船坞脱困_试玩记录_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('start-button').addEventListener('click', () => { $('intro-dialog').close(); if (!started) { started = true; game.stats.started = Date.now(); } render(); });
  function openRules() {
    rulesReturnIntro = $('intro-dialog').open;
    if (rulesReturnIntro) $('intro-dialog').close();
    $('rules-dialog').showModal(); $('rules-dialog').scrollTop = 0; $('rules-title').focus();
  }
  $('help-button').addEventListener('click', openRules);
  $('intro-details-button').addEventListener('click', openRules);
  for (const id of ['rules-close-button', 'rules-done-button']) $(id).addEventListener('click', () => $('rules-dialog').close());
  $('rules-dialog').addEventListener('close', () => {
    if (rulesReturnIntro && !started) { $('intro-dialog').showModal(); $('intro-details-button').focus(); }
    else $('help-button').focus();
    rulesReturnIntro = false;
  });
  $('restart-button').addEventListener('click', () => { if (busy) return; confirm('重新开始？', '重新开始会清空本局战斗状态与行动记录。', reset); });
  $('result-restart').addEventListener('click', reset);
  $('confirm-cancel').addEventListener('click', () => { $('confirm-dialog').close(); confirmAction = null; });
  $('confirm-ok').addEventListener('click', () => { $('confirm-dialog').close(); const f = confirmAction; confirmAction = null; if (f) f(); });
  $('end-turn').addEventListener('click', () => {
    if (busy || game.status !== 'playing') return;
    const left = game.active('ally').filter(u => game.pending(u)).map(u => `${u.name}（移动${u.moveLeft}，行动${u.acted ? '已用' : '可用'}）`);
    if (left.length) confirm('结束我方回合？', `${left.join('、')}仍有剩余移动或行动。继续会放弃这些机会，并进入敌方阶段。`, endTurn); else endTurn();
  });
  $('range-button').addEventListener('click', () => { if (busy) return; showThreats = !showThreats; inspected = null; render(); });
  $('undo-button').addEventListener('click', () => { if (busy) return; if (game.undo) selected = game.undo.id; if (game.undoMove()) { mode = 'move'; teleportTarget = null; render(); } });
  $('wait-button').addEventListener('click', () => execute('wait'));
  for (const id of ['export-button', 'result-export']) $(id).addEventListener('click', exportRecord);
  document.addEventListener('keydown', e => {
    if (busy || !started || document.querySelector('dialog[open]')) return;
    if (['1', '2', '3'].includes(e.key)) pick(['guard', 'scout', 'mage'][Number(e.key) - 1]);
    if (e.key === 'Escape') {
      inspected = null; hover = null;
      if (mode === 'teleport' && teleportTarget) teleportTarget = null;
      else { const u = game.get(selected); mode = game.canMove(u) ? 'move' : game.canUse(u) ? 'attack' : null; }
      render();
    }
  });
  $('intro-dialog').addEventListener('cancel', () => { if (!started) { started = true; game.stats.started = Date.now(); } });
  window.dockGame = game;
  Object.defineProperty(window, 'dockBusy', { get: () => busy });
  render(); $('intro-dialog').showModal(); $('intro-title').focus();
})();
