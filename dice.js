// Dobbelstenen: 3D-kubussen die tollen en stuiteren. Tik op een steen om hem vast te houden.

const MAX_DICE = 6;
const DICE_COUNT_KEY = "dice-count";
const ROLL_MS = 1100;

// Welke van de 9 vakjes (3x3) een stip hebben, per waarde
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

// Kubusvlakken (tegenover elkaar opgeteld = 7) en de draaiing die dat vlak naar voren brengt
const FACES = [
  { value: 1, cls: "front",  x: 0,   y: 0 },
  { value: 6, cls: "back",   x: 0,   y: 180 },
  { value: 3, cls: "right",  x: 0,   y: -90 },
  { value: 4, cls: "left",   x: 0,   y: 90 },
  { value: 2, cls: "top",    x: -90, y: 0 },
  { value: 5, cls: "bottom", x: 90,  y: 0 }
];

const tray = document.getElementById("dice-tray");
const rollBtn = document.getElementById("roll-button");
const countLabel = document.getElementById("dice-count");
const minusBtn = document.getElementById("dice-minus");
const plusBtn = document.getElementById("dice-plus");
const totalEl = document.getElementById("dice-total");
const historyEl = document.getElementById("dice-history");
const shakeBtn = document.getElementById("shake-button");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let dice = [];
let rolling = false;
const history = [];

function storedCount() {
  try {
    const n = parseInt(localStorage.getItem(DICE_COUNT_KEY), 10);
    return n >= 1 && n <= MAX_DICE ? n : 2;
  } catch {
    return 2;
  }
}

function createDie() {
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = "die-wrap";

  const cube = document.createElement("div");
  cube.className = "die";

  for (const face of FACES) {
    const el = document.createElement("div");
    el.className = `die-face ${face.cls}`;
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("span");
      if (PIPS[face.value].includes(i)) cell.className = "pip";
      el.appendChild(cell);
    }
    cube.appendChild(el);
  }

  const shadow = document.createElement("div");
  shadow.className = "die-shadow";

  wrap.append(cube, shadow);

  const die = { wrap, cube, value: 1, held: false, rx: 0, ry: 0, rz: 0 };
  wrap.addEventListener("click", () => {
    if (rolling) return;
    die.held = !die.held;
    updateDieLabel(die);
  });
  orient(die, Math.ceil(Math.random() * 6), 0);
  updateDieLabel(die);
  return die;
}

function updateDieLabel(die) {
  die.wrap.classList.toggle("is-held", die.held);
  die.wrap.setAttribute("aria-pressed", String(die.held));
  die.wrap.setAttribute("aria-label", `Dobbelsteen: ${die.value}${die.held ? ", vastgehouden" : ""}. Tik om ${die.held ? "los te laten" : "vast te houden"}.`);
}

// Draai de kubus zodat `value` naar voren wijst, met `spins` extra hele rondjes
function orient(die, value, spins) {
  const face = FACES.find(f => f.value === value);
  const next = (current, target, turns) => {
    const base = current - (current % 360);
    return base + 360 * turns + target;
  };
  die.rx = next(die.rx, face.x, spins);
  die.ry = next(die.ry, face.y, spins ? spins + 1 : 0);
  die.rz = spins ? (Math.random() * 24 - 12) : die.rz; // klein scheef eindje, ziet natuurlijker uit
  die.value = value;
  die.cube.style.transform = `rotateZ(${die.rz}deg) rotateX(${die.rx}deg) rotateY(${die.ry}deg)`;
}

function setCount(n) {
  n = Math.max(1, Math.min(MAX_DICE, n));
  while (dice.length < n) {
    const die = createDie();
    dice.push(die);
    tray.appendChild(die.wrap);
  }
  while (dice.length > n) dice.pop().wrap.remove();

  countLabel.textContent = n;
  minusBtn.disabled = n <= 1;
  plusBtn.disabled = n >= MAX_DICE;
  tray.dataset.count = n;
  try { localStorage.setItem(DICE_COUNT_KEY, String(n)); } catch {}
  showTotal(false);
}

function roll() {
  if (rolling) return;
  const toRoll = dice.filter(d => !d.held);
  if (!toRoll.length) {
    // alles vastgehouden: alles loslaten en gewoon gooien
    dice.forEach(d => { d.held = false; updateDieLabel(d); });
    return roll();
  }

  rolling = true;
  rollBtn.disabled = true;
  showTotal(false);
  if (navigator.vibrate) navigator.vibrate(30);

  toRoll.forEach((die, i) => {
    const delay = reduceMotion ? 0 : i * 70 + Math.random() * 60;
    die.cube.style.transitionDuration = reduceMotion ? "0ms" : `${ROLL_MS}ms`;
    die.cube.style.transitionDelay = `${delay}ms`;
    die.wrap.style.setProperty("--hop-delay", `${delay}ms`);
    // animatie opnieuw starten
    die.wrap.classList.remove("is-rolling");
    void die.wrap.offsetWidth;
    if (!reduceMotion) die.wrap.classList.add("is-rolling");
    orient(die, randomValue(), 2 + Math.floor(Math.random() * 2));
    updateDieLabel(die);
  });

  const total = reduceMotion ? 0 : ROLL_MS + toRoll.length * 70 + 60;
  setTimeout(() => {
    rolling = false;
    rollBtn.disabled = false;
    toRoll.forEach(d => d.wrap.classList.remove("is-rolling"));
    if (navigator.vibrate) navigator.vibrate([15, 40, 15]);
    showTotal(true);
    addHistory();
  }, total);
}

function randomValue() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 6) + 1;
}

function showTotal(visible) {
  if (!visible) {
    totalEl.classList.remove("is-visible");
    return;
  }
  const sum = dice.reduce((s, d) => s + d.value, 0);
  totalEl.innerHTML = "";
  const label = document.createElement("span");
  label.className = "total-label";
  label.textContent = dice.length > 1 ? "Totaal" : "Gegooid";
  const value = document.createElement("span");
  value.className = "total-value";
  value.textContent = sum;
  totalEl.append(label, value);
  totalEl.classList.add("is-visible");
}

function addHistory() {
  const values = dice.map(d => d.value);
  history.unshift({ values, sum: values.reduce((a, b) => a + b, 0) });
  history.length = Math.min(history.length, 6);

  historyEl.replaceChildren(...history.map((h, i) => {
    const chip = document.createElement("li");
    chip.className = "history-chip" + (i === 0 ? " is-latest" : "");
    chip.textContent = h.values.length > 1 ? `${h.values.join(" · ")} = ${h.sum}` : String(h.sum);
    return chip;
  }));
  historyEl.parentElement.hidden = false;
}

// Schudden om te gooien
function setupShake() {
  if (!("DeviceMotionEvent" in window) || !matchMedia("(pointer: coarse)").matches) return;
  shakeBtn.hidden = false;
  let enabled = false;
  let last = 0;

  const onMotion = e => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;
    const force = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    const now = Date.now();
    if (force > 25 && now - last > 1500) {
      last = now;
      roll();
    }
  };

  shakeBtn.addEventListener("click", async () => {
    if (enabled) {
      window.removeEventListener("devicemotion", onMotion);
      enabled = false;
    } else {
      // iOS vraagt eerst toestemming voor bewegingssensoren
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        try {
          if (await DeviceMotionEvent.requestPermission() !== "granted") return;
        } catch {
          return;
        }
      }
      window.addEventListener("devicemotion", onMotion);
      enabled = true;
    }
    shakeBtn.classList.toggle("is-on", enabled);
    shakeBtn.setAttribute("aria-pressed", String(enabled));
    shakeBtn.textContent = enabled ? "📳 Schudden staat aan" : "📳 Schudden om te gooien";
  });
}

rollBtn.addEventListener("click", roll);
minusBtn.addEventListener("click", () => setCount(dice.length - 1));
plusBtn.addEventListener("click", () => setCount(dice.length + 1));
document.addEventListener("keydown", e => {
  if ((e.key === " " || e.key === "Enter") && e.target === document.body) {
    e.preventDefault();
    roll();
  }
});

setCount(storedCount());
setupShake();
