// Heldencode und Reisecode: anzeigen (groß, mit QR-Code und „Kopieren“), eingeben (auch per Kamera), neu beginnen.
// Der QR-Code entsteht lokal (js/vendor/qrcode.js), das Einscannen nutzt js/vendor/jsQR.js – keine externen Dienste.
import { G, saveProfil, setPref, save, emit } from './state.js';
import { heldencode, reisecode, leseCode, fehlerText, registryAus, saeubern, istKlassenCode, leseKlassenCode } from './code.js';
import { neuesProfil, rangVon } from './fortschritt.js';
import { toast } from './ui.js';

let REG = null;
const reg = () => (REG ||= registryAus(G.REGISTRY));
const codeDaten = () => ({ defs: G.DEFS, heroes: G.HEROES, fates: G.FATES, encounters: G.ENCOUNTERS, exercises: G.EXERCISES });

export const aktuellerHeldencode = () => heldencode(G.PROFIL, reg());
export const aktuellerReisecode = () => reisecode(G.PROFIL, G.run, reg(), codeDaten());

// QR-Code als SVG (oder nichts, falls die Bibliothek fehlt)
export function qrSvg(text) {
  try {
    const qr = window.qrcode(0, 'L');
    qr.addData(saeubern(text), 'Alphanumeric');
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch { return ''; }
}

// Code-Kasten zum Einbetten (Ende des Laufs, Menü)
export function codeKasten(code, klein = false) {
  return `<div class="code-kasten${klein ? ' klein' : ''}">
    <div class="code-text" data-code>${code.split('-').map((g) => `<span>${g}</span>`).join('')}</div>
    <div class="code-qr">${qrSvg(code)}</div>
    <button class="btn small" data-kopieren>📋 Kopieren</button>
  </div>`;
}

export function kopierenAn(box, code) {
  box.querySelectorAll('[data-kopieren]').forEach((b) => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(code); toast('Code kopiert!'); } catch {
        const r = document.createRange();
        r.selectNodeContents(box.querySelector('[data-code]'));
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        toast('Markiert – jetzt kopieren.');
      }
    };
  });
}

function ebene(id, html) {
  document.getElementById(id)?.remove();
  const box = document.createElement('div');
  box.id = id;
  box.className = 'code-ebene';
  box.innerHTML = `<div class="code-card" data-tut="code-fenster">${html}</div>`;
  document.body.append(box);
  return box;
}

// Heldencode (oder Reisecode) groß anzeigen.
export function zeigeCode({ reise = false, zurueck = null } = {}) {
  const code = reise ? aktuellerReisecode() : aktuellerHeldencode();
  const box = ebene('code-layer', `
    <h2>${reise ? '🧳 Dein Reisecode' : '🔑 Dein Heldencode'}</h2>
    <p>${reise
      ? 'Schreib den Code ab oder fotografiere den QR-Code. Damit spielst du deinen Lauf genau hier weiter – auch auf einem anderen iPad.'
      : 'Schreib den Code ins Heft oder fotografiere ihn. Damit holst du deinen Fortschritt zurück – auch auf einem anderen iPad.'}</p>
    ${codeKasten(code)}
    <div class="row"><button class="btn primary big" data-ok>${reise ? 'Lauf beenden und zum Start' : 'Fertig'}</button>${reise ? '<button class="btn" data-weiter>Doch weiterspielen</button>' : ''}</div>`);
  kopierenAn(box, code);
  box.querySelector('[data-ok]').onclick = () => { box.remove(); emit('codeZu'); zurueck?.(true); };
  box.querySelector('[data-weiter]')?.addEventListener('click', () => { box.remove(); emit('codeZu'); zurueck?.(false); });
  emit('codeZeigen');
}

// Startmenü: Code eingeben (Bindestriche optional, Großbuchstaben automatisch). Erkennt Helden-, Reise- und Klassen-Code.
export function zeigeEingabe({ geladen, zurueck = null }) {
  const box = ebene('code-layer', `
    <h2>🔑 Heldencode eingeben</h2>
    <p>Tippe deinen Helden- oder Reisecode ein – oder den Klassen-Code von deiner Lehrkraft. Die Bindestriche kannst du weglassen.</p>
    <input class="code-input" type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" placeholder="z. B. RWV6D-8AWXP-…">
    <p class="code-meldung" hidden></p>
    <div class="code-kamera" hidden><video playsinline muted></video><p class="muted">Halte den QR-Code vor die Kamera.</p></div>
    <div class="row">
      <button class="btn primary big" data-lesen>Einlesen</button>
      ${navigator.mediaDevices?.getUserMedia ? '<button class="btn" data-scan>📷 QR-Code scannen</button>' : ''}
      <button class="btn" data-zurueck>Zurück</button>
    </div>`);
  const input = box.querySelector('.code-input');
  const meldung = box.querySelector('.code-meldung');
  let stopp = null;
  const schliessen = () => { stopp?.(); box.remove(); };
  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    input.value = input.value.toUpperCase();
    input.setSelectionRange(pos, pos);
    meldung.hidden = true;
  });
  const lesen = () => {
    try {
      if (istKlassenCode(input.value)) {
        const einst = leseKlassenCode(input.value, reg());
        klasseBestaetigen(einst, () => schliessen());
        return;
      }
      const r = leseCode(input.value, reg(), codeDaten());
      bestaetigen(r, () => { schliessen(); geladen(r); });
    } catch (e) {
      meldung.textContent = fehlerText(e);
      meldung.hidden = false;
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') lesen(); });
  box.querySelector('[data-lesen]').onclick = lesen;
  box.querySelector('[data-zurueck]').onclick = () => { schliessen(); zurueck?.(); };
  box.querySelector('[data-scan]')?.addEventListener('click', async () => {
    stopp?.();
    stopp = await scanne(box.querySelector('.code-kamera'), (text) => { input.value = saeubern(text); lesen(); }, (fehler) => {
      meldung.textContent = fehler;
      meldung.hidden = false;
    });
  });
  setTimeout(() => input.focus(), 50);
}

// Klassen-Code: zeigen, welche Themen drin sind, dann ins Profil (und damit in den Heldencode).
function klasseBestaetigen(einst, ok) {
  const an = G.THEMEN.themen.filter((t) => einst.themen[t.id] > 0);
  const box = ebene('code-frage', `
    <h2>🍎 Klassen-Code erkannt</h2>
    <p>Deine Lehrkraft hat diese Themen ausgewählt:</p>
    <p class="code-info lk-themen">${an.map((t) => `<span>${t.emoji} ${t.name} <b>${'★'.repeat(einst.themen[t.id])}</b></span>`).join('')}</p>
    <div class="row"><button class="btn primary big" data-ja>Übernehmen</button><button class="btn" data-nein>Abbrechen</button></div>`);
  box.querySelector('[data-ja]').onclick = () => {
    G.PROFIL.klasse = einst;
    saveProfil();
    box.remove();
    toast('Klassen-Code gespeichert – er steht jetzt auch in deinem Heldencode.');
    ok();
  };
  box.querySelector('[data-nein]').onclick = () => box.remove();
}

// Vor dem Laden zeigen, was im Code steckt.
function bestaetigen(r, ok) {
  const p = r.profil;
  const rang = rangVon(p.xp, G.ACH.raenge);
  const held = r.run && G.HEROES.find((h) => h.id === r.run.hero);
  const box = ebene('code-frage', `
    <h2>${r.typ === 'reise' ? '🧳 Reisecode erkannt' : '🔑 Heldencode erkannt'}</h2>
    <p class="code-info">${rang.emoji} <b>${rang.name}</b> · ${p.xp} Erfahrung · 📚 ${p.buch.length} Einträge · 🏆 ${p.erfolge.length} Erfolge</p>
    ${held ? `<p class="code-info">${held.emoji} ${held.name} · Tag ${r.run.day} · ${r.run.wins} Siege · ${'❤️'.repeat(r.run.hearts)}</p>` : ''}
    <p>Der Fortschritt auf diesem iPad wird durch diesen Code ersetzt.</p>
    <div class="row"><button class="btn primary big" data-ja>Laden</button><button class="btn" data-nein>Abbrechen</button></div>`);
  box.querySelector('[data-ja]').onclick = () => { box.remove(); ok(); };
  box.querySelector('[data-nein]').onclick = () => box.remove();
}

// Übernimmt einen eingelesenen Code. Gibt den Lauf zurück (Reisecode) oder null.
export function uebernehmen(r) {
  G.PROFIL = r.profil;
  saveProfil();
  if (r.profil.tutorial) setPref('tutorial', 'fertig');
  if (r.typ === 'reise') {
    G.run = r.run;
    save();
    return r.run;
  }
  return null;
}

// „Neu beginnen“: Fortschritt auf diesem iPad löschen (mit Sicherheitsabfrage).
export function neuBeginnen(fertig) {
  const box = ebene('code-frage', `
    <h2>⚠️ Wirklich ganz neu beginnen?</h2>
    <p>Rang, Erfahrung, Buch der Wörter, Figuren und Erfolge auf diesem iPad werden gelöscht. Mit deinem Heldencode kannst du sie später zurückholen.</p>
    <div class="row"><button class="btn" data-nein>Lieber nicht</button><button class="btn danger" data-ja>Ja, neu beginnen</button></div>`);
  box.querySelector('[data-nein]').onclick = () => box.remove();
  box.querySelector('[data-ja]').onclick = () => {
    box.remove();
    G.PROFIL = neuesProfil();
    setPref('tutorial', '');
    saveProfil();
    G.run = null;
    save();
    toast('Alles zurückgesetzt – viel Spaß beim neuen Abenteuer!');
    fertig?.();
  };
}

// ---------- QR-Code mit der Kamera einscannen ----------

function ladeJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  return new Promise((ok, fehler) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/jsQR.js';
    s.onload = () => ok(window.jsQR);
    s.onerror = fehler;
    document.head.append(s);
  });
}

async function scanne(feld, gefunden, fehler) {
  let stream = null, aktiv = true;
  const stopp = () => { aktiv = false; stream?.getTracks().forEach((t) => t.stop()); feld.hidden = true; };
  try {
    const jsQR = await ladeJsQR();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = feld.querySelector('video');
    video.srcObject = stream;
    feld.hidden = false;
    await video.play();
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    const schritt = () => {
      if (!aktiv) return;
      if (video.videoWidth) {
        c.width = video.videoWidth; c.height = video.videoHeight;
        g.drawImage(video, 0, 0);
        const r = jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' });
        if (r?.data) { stopp(); gefunden(r.data); return; }
      }
      requestAnimationFrame(schritt);
    };
    schritt();
  } catch {
    stopp();
    fehler('Die Kamera lässt sich gerade nicht öffnen. Tippe den Code einfach ein.');
  }
  return stopp;
}
