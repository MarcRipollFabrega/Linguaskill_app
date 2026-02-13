let currentWords = [];
let wordsQueue = []; // Cua per gestionar els grups de 5
let currentMatchingBatch = []; // El grup de 5 que s'està mostrant ara
let firstChoice = null;
let containerRef = null;
let supabase = null;
let unitId = null;
let transIndex = 0;
let bestVoice = null;

// --- 1. LÒGICA DE VEU HUMANA UK ---
function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  // Prioritat absoluta a les veus "Natural" que sonen menys robòtiques
  bestVoice =
    voices.find((v) => v.name.includes("Natural") && v.lang === "en-GB") ||
    voices.find((v) => v.name.includes("Google UK English Female")) ||
    voices.find((v) => v.name.includes("Google UK English Male")) ||
    voices.find((v) => v.lang === "en-GB");
}
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
  if (!text) return;
  window.speechSynthesis.cancel(); // Neteja la cua

  const utterance = new SpeechSynthesisUtterance(text);
  if (bestVoice) utterance.voice = bestVoice;

  utterance.lang = "en-GB";
  utterance.rate = 0.85; // Velocitat perfecta per a claredat
  utterance.pitch = 1.0; // To natural

  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 50); // Petit delay de seguretat
}

// --- 2. NORMALITZACIÓ ESTRICTA ---
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// --- 3. COMPONENTS UI ---
function updateProgressBar(percent) {
  const bar = document.getElementById("vocab-progress-fill");
  if (bar) bar.style.width = `${percent}%`;
}

function getHeaderHTML(title, subtitle) {
  return `
        <div id="vocab-header" style="margin-bottom: 20px;">
            <div style="width: 100%; background: #e2e8f0; height: 8px; border-radius: 4px; margin-bottom: 15px; overflow: hidden;">
                <div id="vocab-progress-fill" style="width: 0%; height: 100%; background: #10b981; transition: width 0.4s ease;"></div>
            </div>
            <h2 style="color:#2563eb; margin:0;">${title}</h2>
            <p style="color:#64748b; font-size:0.9rem;">${subtitle}</p>
        </div>
        <div id="phase-container"></div>
    `;
}

// --- 4. INICIALITZACIÓ ---
export async function initVocabModule(supabaseClient, container, id) {
  supabase = supabaseClient;
  containerRef = container;
  unitId = id;
  transIndex = 0;

  container.innerHTML = "<p style='text-align:center;'>Carregant...</p>";

  const { data, error } = await supabase
    .from("b2_contingut")
    .select("*")
    .eq("unitat_id", unitId)
    .neq("categoria", "Grammar");

  if (error || !data || data.length === 0) {
    container.innerHTML = "<p>No s'han trobat dades.</p>";
    return;
  }

  currentWords = data;
  // Barregem totes les paraules i les posem a la cua
  wordsQueue = [...data].sort(() => Math.random() - 0.5);

  startMatchingPhase();
}

// --- FASE 1: MATCHING (GRUPS DE 5) ---
function startMatchingPhase() {
  containerRef.innerHTML = getHeaderHTML(
    "Vocabulary Matching",
    "Emparella les paraules (en grups de 5)",
  );
  renderNextMatchingBatch();
}

function renderNextMatchingBatch() {
  const phaseContainer = document.getElementById("phase-container");

  // Agafem les següents 5 paraules de la cua
  currentMatchingBatch = wordsQueue.splice(0, 5);

  // Si no queden més paraules al matching, passem a Typing
  if (currentMatchingBatch.length === 0) {
    setTimeout(startTypingPhase, 500);
    return;
  }

  phaseContainer.innerHTML = `<div id="matching-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; animation: fadeIn 0.5s;"></div>`;
  const grid = document.getElementById("matching-grid");

  const leftSide = [...currentMatchingBatch].sort(() => Math.random() - 0.5);
  const rightSide = [...currentMatchingBatch].sort(() => Math.random() - 0.5);

  const leftCol = document.createElement("div");
  leftCol.style = "display:flex; flex-direction:column; gap:10px;";
  const rightCol = document.createElement("div");
  rightCol.style = "display:flex; flex-direction:column; gap:10px;";

  leftSide.forEach((w) =>
    leftCol.appendChild(createMatchBtn(w.paraula_en, w.id, "en")),
  );
  rightSide.forEach((w) =>
    rightCol.appendChild(createMatchBtn(w.paraula_es, w.id, "es")),
  );

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);

  // Actualitzem barra basant-nos en quantes paraules queden a la cua
  const total = currentWords.length;
  const done = total - (wordsQueue.length + currentMatchingBatch.length);
  const progress = 10 + (done / total) * 40;
  updateProgressBar(progress);
}

function createMatchBtn(text, id, lang) {
  const btn = document.createElement("button");
  btn.innerHTML = lang === "en" ? `${text} 🔊` : text;
  btn.className = "match-btn";
  btn.dataset.id = id;
  btn.dataset.lang = lang;
  btn.dataset.raw = text;
  btn.style =
    "padding:12px; border:2px solid #e2e8f0; border-radius:10px; background:white; color:#1e293b; cursor:pointer; min-height:55px; font-weight:500; transition: 0.2s;";
  btn.onclick = () => handleMatchClick(btn);
  return btn;
}

function handleMatchClick(btn) {
  if (btn.classList.contains("correct")) return;
  if (btn.dataset.lang === "en") speak(btn.dataset.raw);

  // Desmarcar selecció anterior del mateix costat si existia
  const siblings = btn.parentElement.querySelectorAll(".match-btn");
  siblings.forEach((s) => {
    if (!s.classList.contains("correct")) {
      s.style.borderColor = "#e2e8f0";
      s.style.background = "white";
    }
  });

  btn.style.borderColor = "#2563eb";
  btn.style.background = "#eff6ff";

  if (!firstChoice) {
    firstChoice = btn;
  } else {
    if (
      firstChoice.dataset.id === btn.dataset.id &&
      firstChoice.dataset.lang !== btn.dataset.lang
    ) {
      // CORRECTE
      btn.classList.add("correct");
      firstChoice.classList.add("correct");
      [btn, firstChoice].forEach((b) => {
        b.style.background = "#10b981";
        b.style.color = "white";
        b.style.borderColor = "#10b981";
      });

      const engText =
        btn.dataset.lang === "en" ? btn.dataset.raw : firstChoice.dataset.raw;
      speak(engText);
      firstChoice = null;

      // Comprovar si s'ha acabat el batch actual (10 botons correcte = 5 parelles)
      const correctInGrid =
        document.querySelectorAll(".match-btn.correct").length;
      if (correctInGrid === currentMatchingBatch.length * 2) {
        setTimeout(renderNextMatchingBatch, 800);
      }
    } else {
      // ERROR
      const prev = firstChoice;
      setTimeout(() => {
        if (!prev.classList.contains("correct")) {
          prev.style.borderColor = "#e2e8f0";
          prev.style.background = "white";
        }
        btn.style.borderColor = "#e2e8f0";
        btn.style.background = "white";
      }, 400);
      firstChoice = null;
    }
  }
}

// --- FASE 2: TYPING ---
function startTypingPhase() {
  transIndex = 0;
  // Per la fase d'escriptura tornem a barrejar totes les paraules originals
  currentWords = [...currentWords].sort(() => Math.random() - 0.5);
  updateProgressBar(50);
  renderTypingCard();
}

function renderTypingCard() {
  if (transIndex >= currentWords.length) {
    updateProgressBar(100);
    showFinalSummary();
    return;
  }

  const word = currentWords[transIndex];
  containerRef.innerHTML = getHeaderHTML(
    "Vocabulary Typing",
    `Escriu la traducció anglesa (${transIndex + 1}/${currentWords.length})`,
  );

  const phaseContainer = document.getElementById("phase-container");
  phaseContainer.innerHTML = `
        <div style="text-align:center;">
            <h2 style="font-size:2.2rem; margin:20px 0; color:#1e293b;">${word.paraula_es}</h2>
            <input type="text" id="vocab-input" placeholder="Type here..." autocomplete="off"
                   style="padding:15px; width:100%; border-radius:12px; border:2px solid #2563eb; font-size:1.3rem; text-align:center; box-shadow: 0 4px 6px rgba(37,99,235,0.1);">
            <div id="feedback" style="margin-top:20px; min-height:30px; font-weight:bold; font-size:1.1rem;"></div>
        </div>
    `;

  const progress = 50 + (transIndex / currentWords.length) * 50;
  updateProgressBar(progress);

  const input = document.getElementById("vocab-input");
  input.focus();
  input.onkeyup = (e) => {
    if (e.key === "Enter") {
      const userVal = normalize(input.value);
      const correctVal = normalize(word.paraula_en);

      if (userVal === correctVal) {
        input.style.borderColor = "#10b981";
        input.disabled = true;
        document.getElementById("feedback").innerHTML =
          "<span style='color:#10b981;'>Excellent! 🌟</span>";
        speak(word.paraula_en);
        setTimeout(() => {
          transIndex++;
          renderTypingCard();
        }, 1000);
      } else {
        input.style.borderColor = "#ef4444";
        document.getElementById("feedback").innerHTML =
          `<span style='color:#ef4444;'>Keep trying...</span>`;
        input.classList.add("shake");
        setTimeout(() => input.classList.remove("shake"), 500);
      }
    }
  };
}

async function showFinalSummary() {
  containerRef.innerHTML = `
        <div style="text-align:center; padding:30px; animation: fadeIn 0.5s;">
            <div style="font-size:4rem; margin-bottom:15px;">🏆</div>
            <h2 style="color:#1e293b; font-size:1.8rem;">Unitat Completada!</h2>
            <p style="color:#64748b; margin-bottom:30px;">Has dominat el vocabulari d'aquesta lliçó.</p>
            <button id="btn-finish-vocab" style="background:#10b981; color:white; padding:18px; border-radius:15px; border:none; width:100%; font-weight:bold; font-size:1.1rem; cursor:pointer; box-shadow: 0 4px 14px rgba(16,185,129,0.4);">
                Finalitzar ➔
            </button>
        </div>
    `;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    await supabase.from("b2_progres_usuari").upsert(
      {
        user_id: session.user.id,
        unitat_id: unitId,
        vocab_completat: true,
        ultima_practica: new Date().toISOString(),
      },
      { onConflict: "user_id, unitat_id" },
    );
  }

  document.getElementById("btn-finish-vocab").onclick = () => {
    document.getElementById("btn-back").click();
  };
}
