let currentGrammarWords = [];
let currentIndex = 0;
let supabase = null;

function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export async function initGrammarModule(
  supabaseClient,
  container,
  level = "A1",
  blocId = "1",
) {
  supabase = supabaseClient;
  currentIndex = 0;

  container.innerHTML = `<div class="loader">Preparant exercicis...</div>`;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("No hi ha sessió");

    // Carreguem frases del bloc amb el seu progrés
    const { data: unitats, error: unitatsError } = await supabase
      .from("ls_contingut")
      .select(`*, ls_progres_usuari(*)`)
      .eq("nivell", level)
      .eq("bloc_tema", blocId)
      .not("explicacio_gramatical", "is", null);

    if (unitatsError) throw unitatsError;

    // Ordenem per prioritat (Errors > Nivells baixos)
    currentGrammarWords = unitats.sort((a, b) => {
      const progA = a.ls_progres_usuari?.[0] || {
        fase_gramatica: 0,
        comptador_errors: 0,
      };
      const progB = b.ls_progres_usuari?.[0] || {
        fase_gramatica: 0,
        comptador_errors: 0,
      };
      if ((progB.comptador_errors || 0) !== (progA.comptador_errors || 0))
        return (progB.comptador_errors || 0) - (progA.comptador_errors || 0);
      return progA.fase_gramatica - progB.fase_gramatica;
    });

    showNextGrammarTask(container);
  } catch (err) {
    container.innerHTML = `<div class="vocab-card">Error: ${err.message}</div>`;
  }
}

function showNextGrammarTask(container) {
  if (currentIndex >= currentGrammarWords.length) {
    renderGrammarFinal(container);
    return;
  }

  const word = currentGrammarWords[currentIndex];
  // ABANS d'anar al nivell, mostrem l'explicació de LA frase actual
  renderWordExplanation(container, word);
}

// NOVA PANTALLA: Explicació individual per cada frase
function renderWordExplanation(container, word) {
  container.innerHTML = `
    <div class="vocab-card" style="animation: fadeIn 0.4s ease;">
        <span class="level-tag" style="background:var(--secondary);">RECORDATORI GRAMATICAL</span>
        <h2 style="margin:20px 0; color:var(--primary);">Com funciona aquesta estructura?</h2>
        
        <div style="background:#f0f7ff; padding:20px; border-radius:12px; border-left:5px solid var(--primary); margin-bottom:20px;">
            <p style="font-size:1.1rem; line-height:1.5; color:#1e293b;">
                ${word.explicacio_gramatical}
            </p>
        </div>

        <div style="padding:15px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:25px;">
            <small style="color:#64748b; display:block; margin-bottom:5px;">IDEA A PRACTICAR:</small>
            <strong style="font-size:1.2rem;">${word.frase_es}</strong>
        </div>

        <button id="btn-go-to-exercise" class="primary" style="width:100%; padding:15px; font-weight:bold;">
            ENTÈS, PRACTICAR ARA
        </button>
    </div>
  `;

  document.getElementById("btn-go-to-exercise").onclick = () => {
    // Un cop llegida l'explicació, carreguem el nivell que toqui
    const progress = word.ls_progres_usuari?.[0] || { fase_gramatica: 0 };
    if (progress.fase_gramatica === 0) renderLevel1(container, word);
    else if (progress.fase_gramatica === 1) renderLevel2(container, word);
    else renderLevel3(container, word);
  };
}

// NIVELL 1: ORDENAR (EN)
function renderLevel1(container, word) {
  const wordsArray = word.frase_en.split(" ").sort(() => Math.random() - 0.5);
  let selection = [];

  container.innerHTML = `
    <div class="vocab-card">
        <p id="feed-grammar" style="min-height:1.2em; text-align:center; font-weight:bold;"></p>
        <span class="level-tag">NIVELL 1: ORDENAR</span>
        <h4 style="margin:15px 0;">${word.frase_es}</h4>
        <div id="drop-zone" style="min-height:60px; border:2px dashed #cbd5e1; padding:10px; margin-bottom:15px; border-radius:10px; display:flex; flex-wrap:wrap; gap:5px;"></div>
        <div id="word-pool" style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;"></div>
        <button id="btn-check" class="primary" style="width:100%; margin-top:20px;">Comprovar (Intro)</button>
    </div>`;

  const dropZone = document.getElementById("drop-zone");
  const wordPool = document.getElementById("word-pool");
  const feed = document.getElementById("feed-grammar");

  wordsArray.forEach((w) => {
    const btn = document.createElement("button");
    btn.innerText = w;
    btn.className = "btn-hint";
    btn.onclick = () => {
      selection.push(w);
      const span = document.createElement("span");
      span.innerText = w;
      span.className = "word-pill-active";
      span.onclick = () => {
        selection = selection.filter((i) => i !== w);
        span.remove();
        btn.style.display = "inline-block";
      };
      dropZone.appendChild(span);
      btn.style.display = "none";
    };
    wordPool.appendChild(btn);
  });

  const check = async () => {
    if (normalizeText(selection.join("")) === normalizeText(word.frase_en)) {
      feed.innerHTML = "✅ Correcte!";
      if (window.speak) window.speak(word.frase_en);
      await updateGrammarStep(word.id, 1, false);
      setTimeout(() => {
        currentIndex++;
        showNextGrammarTask(container);
      }, 1200);
    } else {
      feed.innerHTML = "❌ Revisa l'explicació i l'ordre";
      await updateGrammarStep(word.id, 0, true);
    }
  };

  document.getElementById("btn-check").onclick = check;
  // Gestió d'Intro
  const onKey = (e) => {
    if (e.key === "Enter") {
      check();
      window.removeEventListener("keydown", onKey);
    }
  };
  window.addEventListener("keydown", onKey);
}

// NIVELLS 2 I 3 (TRADUCCIÓ)
function renderLevel2(container, word) {
  renderWritingUI(
    container,
    "NIVELL 2: TRADUEIX A CASTELLÀ",
    word.frase_en,
    word.frase_es,
    "Escriu en castellà...",
    2,
  );
}

function renderLevel3(container, word) {
  renderWritingUI(
    container,
    "NIVELL 3: TRADUEIX A ANGLÈS",
    word.frase_es,
    word.frase_en,
    "Escriu en anglès...",
    3,
  );
}

function renderWritingUI(
  container,
  label,
  promptTxt,
  targetTxt,
  placeholder,
  nextFase,
) {
  container.innerHTML = `
    <div class="vocab-card">
        <p id="feed-grammar" style="min-height:1.2em; text-align:center; font-weight:bold;"></p>
        <span class="level-tag">${label}</span>
        <h2 style="margin:20px 0; font-size:1.4rem;">${promptTxt}</h2>
        <input type="text" id="grammar-input" placeholder="${placeholder}" autocomplete="off" autofocus
               style="width:100%; padding:15px; border-radius:10px; border:2px solid #e2e8f0; text-align:center;">
        <button id="btn-check-write" class="primary" style="width:100%; margin-top:15px;">Comprovar (Intro)</button>
    </div>`;

  const input = document.getElementById("grammar-input");
  const feed = document.getElementById("feed-grammar");

  const checkWrite = async () => {
    if (normalizeText(input.value) === normalizeText(targetTxt)) {
      feed.innerHTML = "✅ Molt bé!";
      if (window.speak) window.speak(nextFase === 3 ? targetTxt : promptTxt);
      await updateGrammarStep(
        currentGrammarWords[currentIndex].id,
        nextFase,
        false,
      );
      setTimeout(() => {
        currentIndex++;
        showNextGrammarTask(container);
      }, 1200);
    } else {
      feed.innerHTML = `<span style="color:#ef4444;">❌: ${targetTxt}</span>`;
      await updateGrammarStep(
        currentGrammarWords[currentIndex].id,
        nextFase - 1,
        true,
      );
    }
  };

  document.getElementById("btn-check-write").onclick = checkWrite;
  input.onkeypress = (e) => {
    if (e.key === "Enter") checkWrite();
  };
}

async function updateGrammarStep(wordId, currentLevel, isError) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { data: current } = await supabase
    .from("ls_progres_usuari")
    .select("comptador_errors")
    .eq("user_id", session.user.id)
    .eq("unitat_id", wordId)
    .single();

  const errors = (current?.comptador_errors || 0) + (isError ? 1 : 0);

  await supabase.from("ls_progres_usuari").upsert(
    {
      user_id: session.user.id,
      unitat_id: wordId,
      fase_gramatica: Math.max(0, currentLevel),
      comptador_errors: errors,
      ultima_revisio: new Date().toISOString(),
    },
    { onConflict: "user_id, unitat_id" },
  );
}

function renderGrammarFinal(container) {
  container.innerHTML = `<div class="vocab-card" style="text-align:center;"><h2>🏆 Bloc completat!</h2><button onclick="location.reload()" class="primary">Tornar</button></div>`;
}
