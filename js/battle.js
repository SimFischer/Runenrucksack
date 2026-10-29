// Automatischer Kampf: beide Rucksäcke laden ihre Items auf und lösen sie aus.
import { baseHp } from './logic.js';
import { analyze } from './grammar.js';

export const STEP = 0.05;          // Sekunden pro Simulationsschritt
const COLD_SLOW = 0.6;             // Kälte: Items laden nur mit 60 % Tempo
const STUN_MAX = 2;                // Betäubung höchstens 2 s am Stück
const FATIGUE_START = 25;          // ab hier verlieren beide jede Sekunde mehr Leben
const MAX_TIME = 60;
// Block sammelt sich nicht unbegrenzt: höchstens ein Anteil des Lebens, und jede Sekunde verfällt ein Teil.
export const BLOCK = { max: 0.5, verfall: 0.1 };
const blockMax = (me) => Math.round(me.maxHp * BLOCK.max);

// placed: Items im Rucksack; Siegel und Runen werden über analyze() eingerechnet.
// opts: info (fertige Auswertung, z. B. mit Boni der Figur), leben, tempo (in %), startHp (Anteil 0–1),
// selbstschaden (zu Kampfbeginn), ersterAngriffDoppelt (Begleiter Falke), rng.
export function makeFighter(name, placed, defs, day, opts = {}) {
  const rng = opts.rng || Math.random;
  const info = opts.info || analyze(placed, defs, { verbVoll: !!opts.klug });
  // Spruchrolle: „sofort“ löst gleich aus, „in der dritten Runde“ / „am Ende des Kampfes“ beginnt später
  const items = placed.map((p) => {
    const def = info.get(p.uid).def;
    return { uid: p.uid, def, t: def.sofort ? def.abklingzeit : -(def.verzoegerung || 0) };
  });
  let maxHp = baseHp(day) + (opts.leben || 0), block = 0, tempo = opts.tempo || 0, glueck = 0;
  for (const { def } of items) {
    maxHp += def.leben || 0;
    block += def.startblock || 0;
    // Passive Items wirken auf den ganzen Rucksack, aktive nur auf sich selbst.
    if (!def.abklingzeit) {
      tempo += def.tempo || 0;
      glueck += def.glueck || 0;
    }
    // Komposita mit passiver Kraft (Sturm, Gold) wirken zusätzlich auf den ganzen Rucksack.
    tempo += def.aura?.tempo || 0;
    glueck += def.aura?.glueck || 0;
  }
  const hp = Math.round(maxHp * (opts.startHp ?? 1)) - (opts.selbstschaden || 0);
  block = Math.min(block, Math.round(maxHp * BLOCK.max));
  return {
    name, maxHp, hp, block, tempo: tempo / 100, glueck: glueck / 100, rng,
    gift: 0, brand: 0, kaelte: 0, betaeubt: 0, regeneration: 0,
    items: items.filter((i) => i.def.abklingzeit > 0),
    ersterAngriffDoppelt: !!opts.ersterAngriffDoppelt,
    faehigkeit: opts.faehigkeit || null, // Bosse: { typ: 'stehlen' | 'wolf', … } aus enemies.json
  };
}

// Stärkster Gegenstand einer Seite (für den Plünderer)
const wirkungsWert = (d) => ((d.schaden || 0) + (d.block || 0) + (d.heilung || 0) + 2 * (d.gift || 0) + 2 * (d.brand || 0)) / d.abklingzeit;
function staerkstes(side) {
  side.staerkstes ??= [...side.items].sort((a, b) => wirkungsWert(b.def) - wirkungsWert(a.def))[0]?.uid ?? null;
  return side.staerkstes;
}

// Boss-Fähigkeit des Häuptlings: Bei halbem Leben ruft er einen Wolf als zweiten Angriff.
// (Der Plünderer stiehlt in trigger() einmal die Wirkung deines stärksten Gegenstands.)
function bossFaehigkeit(battle, key, me, foe, ev) {
  const f = me.faehigkeit;
  if (!f || f.erledigt) return;
  if (f.typ === 'wolf' && me.hp <= me.maxHp / 2) {
    f.erledigt = true;
    me.items.push({ uid: 'wolf', def: { schaden: f.schaden, abklingzeit: f.abklingzeit }, t: 0 });
    ev.push({ type: 'wolf', side: key });
  }
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
      const stunned = me.betaeubt > 0;
      const speed = stunned ? 0 : (1 + me.tempo) * (me.kaelte > 0 ? COLD_SLOW : 1);
      me.kaelte = Math.max(0, me.kaelte - h);
      me.betaeubt = Math.max(0, me.betaeubt - h);
      bossFaehigkeit(this, key, me, foe, ev);
      for (const it of me.items) {
        it.t += h * speed * (1 + (it.def.tempo || 0) / 100);
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
        if (me.block > 0) me.block = Math.floor(me.block * (1 - BLOCK.verfall));
        if (me.gift > 0) this.hurt(key, me, me.gift, 'gift', ev, true);
        if (me.brand > 0) { this.hurt(key, me, me.brand, 'brand', ev, true); me.brand--; }
        if (me.regeneration > 0) {
          me.hp = Math.min(me.maxHp, me.hp + me.regeneration);
          ev.push({ type: 'heal', side: key, amount: me.regeneration, kind: 'regeneration' });
          me.regeneration--;
        }
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

  trigger(key, me, foeKey, foe, it, ev, alsSubjekt = false) {
    const d = it.def;
    // Plünderer: Löst dein stärkster Gegenstand zum ersten Mal aus, stiehlt er die Wirkung – sie wirkt für ihn.
    const dieb = foe.faehigkeit;
    if (dieb?.typ === 'stehlen' && !dieb.erledigt && !alsSubjekt && it.uid === staerkstes(me)) {
      dieb.erledigt = true;
      ev.push({ type: 'stehlen', side: foeKey, uid: it.uid });
      this.trigger(foeKey, foe, key, me, { uid: 'beute', def: { ...d, subjektUid: null } }, ev, true);
      return;
    }
    // Glück: Chance, dass das Item doppelt wirkt.
    const luck = me.glueck + (d.glueck || 0) / 100;
    const m = luck > 0 && me.rng() < luck ? 2 : 1;
    ev.push({ type: 'trigger', side: key, uid: it.uid, crit: m > 1 });
    if (d.block) { me.block = Math.min(blockMax(me), me.block + d.block * m); ev.push({ type: 'block', side: key, amount: d.block * m }); }
    if (d.heilung) {
      me.hp = Math.min(me.maxHp, me.hp + d.heilung * m);
      ev.push({ type: 'heal', side: key, amount: d.heilung * m });
    }
    if (d.regeneration) {
      me.regeneration += d.regeneration * m;
      ev.push({ type: 'status', side: key, kind: 'regeneration', amount: d.regeneration * m });
    }
    if (d.schaden) {
      // Begleiter Falke: Der erste Angriff im Kampf trifft doppelt.
      const f = me.ersterAngriffDoppelt ? 2 : 1;
      if (f > 1) { me.ersterAngriffDoppelt = false; ev.push({ type: 'falke', side: key, uid: it.uid }); }
      this.hurt(foeKey, foe, d.schaden * m * f, 'schaden', ev, false);
    }
    if (d.gift) { foe.gift += d.gift * m; ev.push({ type: 'status', side: foeKey, kind: 'gift', amount: d.gift * m }); }
    if (d.brand) { foe.brand += d.brand * m; ev.push({ type: 'status', side: foeKey, kind: 'brand', amount: d.brand * m }); }
    if (d.kaelte) { foe.kaelte += d.kaelte * m; ev.push({ type: 'status', side: foeKey, kind: 'kaelte', amount: d.kaelte * m }); }
    // Verb-Rolle mit Subjekt: Das Subjekt löst zusätzlich einmal seine eigene Wirkung aus.
    if (d.subjektUid && !alsSubjekt) {
      const s = me.items.find((x) => x.uid === d.subjektUid);
      if (s) this.trigger(key, me, foeKey, foe, s, ev, true);
    }
    if (d.betaeubung) {
      foe.betaeubt = Math.min(STUN_MAX, foe.betaeubt + d.betaeubung * m);
      ev.push({ type: 'status', side: foeKey, kind: 'betaeubung', amount: d.betaeubung * m });
    }
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
