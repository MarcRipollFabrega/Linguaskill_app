let currentWords = [];
let currentIndex = 0;
let supabase = null;
let firstSelection = null;
let solvedCount = 0;
let wordsWithErrors = new Set();

export async function initVocabModule(supabaseClient, container, level = "A1") {
  supabase = supabaseClient;

  // 1. Resetejar l'estat per a la nova sessió
  currentIndex = 0;
  currentWords = [];
  wordsWithErrors.clear();

  container.innerHTML = `<div class="loader">Buscant paraules per practicar...</div>`;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("No hi ha sessió d'usuari.");

    // PAS A: Busquem paraules que ja hem començat però no hem dominat (Fase 1-4)
    // i que ja toca repassar segons la data
    let { data: paraules } = await supabase
      .from("ls_contingut")
      .select(`*, ls_progres_usuari!inner(*)`)
      .eq("nivell", level)
      .eq("ls_progres_usuari.user_id", session.user.id)
      .lt("ls_progres_usuari.fase_vocabulari", 5)
      .lte("ls_progres_usuari.proxim_repas", new Date().toISOString())
      .limit(5);

    // PAS B: Si no n'hi ha prou per repassar, omplim el bloc amb paraules NOVES
    if (!paraules || paraules.length < 5) {
      // Obtenim IDs de paraules que l'usuari ja té registrades (per excloure-les)
      const { data: vistes } = await supabase
        .from("ls_progres_usuari")
        .select("unitat_id")
        .eq("user_id", session.user.id);

      const idsExcloure = vistes?.map((v) => v.unitat_id) || [];

      let queryNoves = supabase
        .from("ls_contingut")
        .select(`*, ls_progres_usuari!left(*)`)
        .eq("nivell", level)
        .limit(5 - (paraules?.length || 0));

      if (idsExcloure.length > 0) {
        queryNoves = queryNoves.not("id", "in", `(${idsExcloure.join(",")})`);
      }

      const { data: noves } = await queryNoves;
      paraules = [...(paraules || []), ...(noves || [])];
    }

    // 2. Comprovació final: Si no hi ha res nou ni per repassar, hem acabat el tema
    if (!paraules || paraules.length === 0) {
      container.innerHTML = `
        <div class="vocab-card" style="text-align:center; padding:40px;">
            <h2>🎓 Vocabulari Completat!</h2>
            <p>Has dominat totes les paraules del nivell ${level}.</p>
            <button id="btn-go-grammar" class="primary" style="margin-top:20px; background-color: #6366f1;">
                Començar Gramàtica 📚
            </button>
        </div>`;

      document.getElementById("btn-go-grammar").onclick = () => {
        import("./grammar.js").then((m) =>
          m.initGrammarModule(supabase, container, level),
        );
      };
      return;
    }

    currentWords = paraules;

    // 3. Decidir nivell d'inici basat en la paraula més endarrerida del bloc
    const fases = currentWords.map((p) => {
      const pData = p.ls_progres_usuari;
      const registro = Array.isArray(pData) ? pData[0] : pData;
      return registro ? parseInt(registro.fase_vocabulari) : 0;
    });

    const minFase = Math.min(...fases);

    if (minFase === 0) {
      renderIntro(container);
    } else {
      renderTransition(container, minFase + 1);
    }
  } catch (err) {
    console.error("Error en initVocabModule:", err);
    container.innerHTML = `<p class="error">Error carregant el contingut.</p>`;
  }
}

// --- FASE 0: ESTUDI ---
function renderIntro(container) {
  const word = currentWords[currentIndex];
  if (window.speak) window.speak(word.paraula_en);

  container.innerHTML = `
    <div class="vocab-card" style="padding: 20px; text-align: center;">
        <div class="word-header"><span class="level-tag">ESTUDI</span></div>
        <h2 style="font-size: 3rem; color: var(--primary-color);">${word.paraula_en}</h2>
        <p style="font-size: 1.5rem;">${word.paraula_es}</p>
        <button id="btn-next" class="primary" style="margin-top:20px;">
            ${currentIndex < currentWords.length - 1 ? "Següent" : "Començar Nivell 1"}
        </button>
    </div>`;

  document.getElementById("btn-next").onclick = () => {
    if (currentIndex < currentWords.length - 1) {
      currentIndex++;
      renderIntro(container);
    } else {
      renderLevel1(container);
    }
  };
}

// --- NIVELL 1: RELACIONAR ---
function renderLevel1(container) {
  firstSelection = null;
  solvedCount = 0;
  const englishWords = [...currentWords].sort(() => 0.5 - Math.random());
  const spanishWords = [...currentWords].sort(() => 0.5 - Math.random());

  container.innerHTML = `
    <div class="vocab-card" style="padding: 20px;">
        <div class="word-header"><span class="level-tag">NIVELL 1: RELACIONAR</span></div>
        <div class="matching-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top:15px;">
            <div class="column">${englishWords.map((w) => `<button class="match-btn" data-id="${w.id}" data-lang="en">${w.paraula_en}</button>`).join("")}</div>
            <div class="column">${spanishWords.map((w) => `<button class="match-btn" data-id="${w.id}" data-lang="es">${w.paraula_es}</button>`).join("")}</div>
        </div>
        <p id="feedback" style="text-align:center; margin-top:10px; font-weight:bold;"></p>
    </div>`;

  container.querySelectorAll(".match-btn").forEach((btn) => {
    btn.onclick = () => {
      if (btn.classList.contains("solved")) return;
      if (!firstSelection) {
        firstSelection = btn;
        btn.classList.add("selected");
        return;
      }
      if (firstSelection === btn) {
        btn.classList.remove("selected");
        firstSelection = null;
        return;
      }

      if (
        firstSelection.dataset.lang !== btn.dataset.lang &&
        firstSelection.dataset.id === btn.dataset.id
      ) {
        if (window.speak)
          window.speak(
            currentWords.find((w) => w.id === btn.dataset.id).paraula_en,
          );
        btn.classList.add("solved");
        firstSelection.classList.add("solved");
        firstSelection = null;
        solvedCount++;

        if (solvedCount === currentWords.length) {
          updateUserProgress(1);
          setTimeout(() => renderTransition(container, 2), 1000);
        }
      } else {
        btn.classList.add("wrong");
        setTimeout(() => {
          btn.classList.remove("wrong");
          if (firstSelection) firstSelection.classList.remove("selected");
          firstSelection = null;
        }, 500);
      }
    };
  });
}

// --- NIVELLS 2 A 5 ---

async function renderWritingLevel(container, level) {
  const word = currentWords[currentIndex];
  let promptText = "",
    targetWord = "",
    showText = "";

  // 1. Configuració de textos segons el nivell
  if (level === 2) {
    promptText = "Tradueix al Castellà:";
    targetWord = word.paraula_es;
    showText = word.paraula_en;
  } else if (level === 3) {
    promptText = "Tradueix a l'Anglès:";
    targetWord = word.paraula_en;
    showText = word.paraula_es;
  } else if (level === 4) {
    promptText = "Escolta i escriu en Castellà:";
    targetWord = word.paraula_es;
    showText = "???";
  } else if (level === 5) {
    promptText = "Escolta i escriu en Anglès:";
    targetWord = word.paraula_en;
    showText = "???";
  }

  // Locució automàtica si el nivell ho requereix o és anglès
  if (window.speak) window.speak(word.paraula_en);

  container.innerHTML = `
    <div class="vocab-card" style="padding: 25px; text-align: center;">
        <div class="word-header"><span class="level-tag">NIVELL ${level}</span></div>
        <p style="margin-top:20px; color: var(--text-muted);">${promptText}</p>
        <h2 style="font-size: 2.5rem; margin: 20px 0;">${showText}</h2>
        <input type="text" id="ans-input" autocomplete="off" placeholder="Escriu aquí..." 
               style="text-align: center; font-size: 1.2rem; padding: 12px; width: 85%; border-radius: 10px; border: 2px solid #e2e8f0; margin-bottom: 15px;">
        <button id="btn-check" class="primary" style="width: 85%;">Comprovar</button>
        <div style="margin-top: 15px;"><button id="btn-replay" class="btn-hint">🔊 Escoltar de nou</button></div>
        <p id="feed" style="margin-top:15px; font-weight:bold; min-height: 1.5em;"></p>
    </div>`;

  const input = document.getElementById("ans-input");
  const feedbackElem = document.getElementById("feed");
  
  // Focus automàtic per a millor UX
  setTimeout(() => input.focus(), 100);

  document.getElementById("btn-replay").onclick = () => {
    window.speak(word.paraula_en);
    input.focus();
  };

  const check = async () => {
    const normalize = (s) =>
      s.normalize("NFD")
       .replace(/[\u0300-\u036f]/g, "")
       .toLowerCase()
       .trim();

    const userInput = normalize(input.value);
    const correctTarget = normalize(targetWord);

    if (userInput === correctTarget) {
      // --- CAS CORRECTE ---
      feedbackElem.innerHTML = "<span style='color: #22c55e'>✅ Correcte!</span>";
      
      setTimeout(() => {
        currentIndex++;
        if (currentIndex < currentWords.length) {
          renderWritingLevel(container, level);
        } else {
          // Final de bloc: Actualitzem progrés només de les encertades
          updateUserProgress(level);
          renderTransition(container, level + 1);
        }
      }, 1000);

    } else {
      // --- CAS ERROR ---
      input.classList.add("shake");
      feedbackElem.innerHTML = `
        <span style="color: #ef4444;">❌ Incorrecte. La resposta era: <strong>${targetWord}</strong></span>
      `;

      // 1. Marquem la paraula com a fallada en aquesta sessió
      if (typeof wordsWithErrors !== 'undefined') {
        wordsWithErrors.add(word.id);
      }

      // 2. Registrem l'error a la base de dades immediatament
      await registrarErrorEnBD(word.id);

      setTimeout(() => {
        input.classList.remove("shake");
        currentIndex++; 
        
        if (currentIndex < currentWords.length) {
          renderWritingLevel(container, level);
        } else {
          updateUserProgress(level);
          renderTransition(container, level + 1);
        }
      }, 2500); // Temps extra perquè l'usuari llegeixi la correcció
    }
  };

  // Events de control
  document.getElementById("btn-check").onclick = check;
  input.onkeypress = (e) => {
    if (e.key === "Enter") check();
  };
}

// --- TRANSICIONS I RESUM ---
function renderTransition(container, nextLvl) {
  currentIndex = 0;
  if (nextLvl > 5) {
    renderFinalSummary(container);
  } else {
    currentWords = [...currentWords].sort(() => 0.5 - Math.random());
    container.innerHTML = `
      <div class="vocab-card" style="text-align:center; padding:30px;">
          <h2>Nivell ${nextLvl - 1} Superat!</h2>
          <p>Preparat per al següent repte?</p>
          <button id="next-lvl-btn" class="primary" style="margin-top:20px;">Començar Nivell ${nextLvl}</button>
      </div>`;
    document.getElementById("next-lvl-btn").onclick = () => {
      if (nextLvl === 1) renderLevel1(container);
      else renderWritingLevel(container, nextLvl);
    };
  }
}

function renderFinalSummary(container) {
  container.innerHTML = `
    <div class="vocab-card" style="text-align:center; padding:40px;">
        <h2 style="font-size: 3rem;">🔥</h2>
        <h2>Molt bé!</h2>
        <p>Has completat aquest bloc de 5 paraules.</p>
        <button id="btn-next-session" class="primary" style="margin-top:20px;">
            Practicar 5 paraules més 🚀
        </button>
    </div>`;

  document.getElementById("btn-next-session").onclick = () => {
    initVocabModule(supabase, container, window.currentLevel || "A1");
  };
}

// --- FUNCIÓ DE GUARDAT AMB REPETICIÓ ESPAIADA ---
async function updateUserProgress(faseAssolida) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  // NOMÉS actualitzem les paraules que NO han fallat en aquesta ronda
  const wordsToUpdate = currentWords.filter(
    (word) => !wordsWithErrors.has(word.id),
  );

  if (wordsToUpdate.length === 0) return;

  const updates = wordsToUpdate.map((word) => {
    const pData = word.ls_progres_usuari;
    const registro = Array.isArray(pData) ? pData[0] : pData;
    const faseActualDB = registro ? parseInt(registro.fase_vocabulari) : 0;

    const novaFase = Math.max(faseActualDB, faseAssolida);
    const dies = novaFase >= 5 ? 7 : 1;

    return {
      user_id: session.user.id,
      unitat_id: word.id,
      fase_vocabulari: novaFase,
      ultim_repas: new Date().toISOString(),
      proxim_repas: new Date(
        Date.now() + dies * 24 * 60 * 60 * 1000,
      ).toISOString(),
      // MANTENIR ELS ERRORS: No enviis comptador_errors aquí per no sobreescriure'ls a 0
    };
  });

  await supabase
    .from("ls_progres_usuari")
    .upsert(updates, { onConflict: "user_id, unitat_id" });


}
async function registrarErrorEnBD(wordId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  // 1. Obtenim el valor actual dels errors per a aquesta paraula
  const { data: currentProg } = await supabase
    .from("ls_progres_usuari")
    .select("comptador_errors")
    .eq("user_id", session.user.id)
    .eq("unitat_id", wordId)
    .single();

  const nousErrors = (currentProg?.comptador_errors || 0) + 1;

  // 2. Pugem la actualització amb el nou comptador
  const { error } = await supabase.from("ls_progres_usuari").upsert(
    {
      user_id: session.user.id,
      unitat_id: wordId,
      fase_vocabulari: 1, // Baixem a nivell 1 per reforçar
      comptador_errors: nousErrors, // Ara sí que s'actualitza
      ultima_revisio: new Date().toISOString(),
      proxim_repas: new Date().toISOString(),
    },
    { onConflict: "user_id,unitat_id" },
  );

  if (error) console.error("Error al registrar fallada:", error.message);
}
