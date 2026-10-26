// Automatischer Kampf: beide Rucksäcke laden ihre Items auf und lösen sie aus.
import { baseHp } from './logic.js';

export const STEP = 0.05;          // Sekunden pro Simulationsschritt
const COLD_SLOW = 0.6;             // Kälte: Items laden nur mit 60 % Tempo
const FATIGUE_START = 25;          // ab hier verlieren beide jede Sekunde mehr Leben
const MAX_TIME = 60;

export function makeFighter(name, placed, defs, day) {
  const items = placed.map((p) => ({ uid: p.uid, def: defs[p.id], t: 0 }));
  let maxHp = baseHp(day), block = 0, tempo = 0;
  for (const { def } of items) {
    maxHp += def.leben || 0;
    block += def.startblock || 0;
    tempo += def.tempo || 0;
  }
  return {
    name, maxHp, hp: maxHp, block, tempo: tempo / 100,
    gift: 0, brand: 0, kaelte: 0,
    items: items.filter((i) => i.def.abklingzeit > 0),
  };
}

export class Battle {
  constructor(player, enemy) {
    this.sides = { player, enemy };
    this.time = 0;
    this.tickTimer = 0;
    this.result = null; // 'win' | 'lose'
  }

  // Simuliert dt Sekunden und liefert die Ereignisse für die Anzeige.
  advance(dt) {
    const events = [];
    let left = dt;
    while (left > 1e-9 && !this.result) {
      const h = Math.min(STEP, left);
      this.step(h, events);
      left -= h;
    }
    return events;
  }

  step(h, ev) {
    this.time += h;
    for (const key of ['player', 'enemy']) {
      const me = this.sides[key];
      const foe = this.sides[key === 'player' ? 'enemy' : 'player'];
      const foeKey = key === 'player' ? 'enemy' : 'player';
      const speed = (1 + me.tempo) * (me.kaelte > 0 ? COLD_SLOW : 1);
      me.kaelte = Math.max(0, me.kaelte - h);
      for (const it of me.items) {
        it.t += h * speed;
        if (it.t >= it.def.abklingzeit) {
          it.t -= it.def.abklingzeit;
          this.trigger(key, me, foeKey, foe, it, ev);
          if (this.checkEnd()) return;
        }
      }
    }

    this.tickTimer += h;
    if (this.tickTimer >= 1) {
      this.tickTimer -= 1;
      for (const key of ['player', 'enemy']) {
        const me = this.sides[key];
        if (me.gift > 0) this.hurt(key, me, me.gift, 'gift', ev, true);
        if (me.brand > 0) { this.hurt(key, me, me.brand, 'brand', ev, true); me.brand--; }
        if (this.time > FATIGUE_START) {
          this.hurt(key, me, Math.floor(this.time - FATIGUE_START), 'muede', ev, true);
        }
      }
      this.checkEnd();
    }
    if (!this.result && this.time >= MAX_TIME) {
      const p = this.sides.player, e = this.sides.enemy;
      this.result = p.hp / p.maxHp >= e.hp / e.maxHp ? 'win' : 'lose';
    }
  }

  trigger(key, me, foeKey, foe, it, ev) {
    const d = it.def;
    ev.push({ type: 'trigger', side: key, uid: it.uid });
    if (d.block) { me.block += d.block; ev.push({ type: 'block', side: key, amount: d.block }); }
    if (d.heilung) {
      const amount = Math.min(d.heilung, me.maxHp - me.hp);
      me.hp += amount;
      ev.push({ type: 'heal', side: key, amount: d.heilung });
    }
    if (d.schaden) this.hurt(foeKey, foe, d.schaden, 'schaden', ev, false);
    if (d.gift) { foe.gift += d.gift; ev.push({ type: 'status', side: foeKey, kind: 'gift', amount: d.gift }); }
    if (d.brand) { foe.brand += d.brand; ev.push({ type: 'status', side: foeKey, kind: 'brand', amount: d.brand }); }
    if (d.kaelte) { foe.kaelte += d.kaelte; ev.push({ type: 'status', side: foeKey, kind: 'kaelte', amount: d.kaelte }); }
  }

  hurt(key, target, amount, kind, ev, ignoreBlock) {
    let blocked = 0;
    if (!ignoreBlock && target.block > 0) {
      blocked = Math.min(target.block, amount);
      target.block -= blocked;
    }
    const dmg = amount - blocked;
    target.hp -= dmg;
    ev.push({ type: 'damage', side: key, amount: dmg, blocked, kind });
  }

  checkEnd() {
    if (this.sides.enemy.hp <= 0) this.result = 'win';
    else if (this.sides.player.hp <= 0) this.result = 'lose';
    return !!this.result;
  }
}

// Kampf ohne Anzeige komplett durchrechnen (für "Überspringen" und Tests).
export function runToEnd(battle) {
  while (!battle.result) battle.advance(1);
  return battle.result;
}
