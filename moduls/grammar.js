let currentGrammarWords = [];
let theoryData = null; // Nova variable per emmagatzemar la teoria del pilar
let currentIndex = 0;
let supabase = null;

export async function initGrammarModule(
  supabaseClient,
  container,
  level = "A1",
  blocId = "1", // Suposem que passes el bloc com a paràmetre
) {
  supabase = supabaseClient;
  currentIndex = 0;

  container.innerHTML = `<div class="loader">Preparant la lliçó de gramàtica...</div>`;

  try {
    console.log("Cercant teoria per al bloc:", blocId);

    // 1. Obtenim la teoria (eliminem .single() per evitar l'error 406)
    const { data: teories, error: theoryError } = await supabase
      .from("ls_teoria")
      .select("*")
      .ilike("blocs_relacionats", `%${blocId}%`);

    // Si no hi ha error i tenim resultats, agafem el primer manualment
    if (!theoryError && teories && teories.length > 0) {
      theoryData = teories[0];
      console.log("Teoria carregada correctament:", theoryData.concepte_clau);
    } else {
      console.warn("No s'ha trobat teoria específica per al bloc:", blocId);
      theoryData = null; // Ens assegurem que no quedi brossa d'altres blocs
    }

    // 2. Obtenim les paraules/frases del bloc
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Comprovem si hi ha sessió abans de continuar
    if (!session) {
      container.innerHTML = `<p>Sessió no trobada. Torna a iniciar sessió.</p>`;
      return;
    }

    const { data: paraules, error } = await supabase
      .from("ls_contingut")
      .select(`*, ls_progres_usuari!inner(*)`)
      .eq("nivell", level)
      .eq("bloc_tema", blocId)
      .eq("ls_progres_usuari.user_id", session.user.id)
      .gte("ls_progres_usuari.fase_vocabulari", 5)
      .order("ordre_dins_bloc", { ascending: true });

    if (error || !paraules || paraules.length === 0) {
      // Si el vocabulari no està a fase 5, donem feedback
      container.innerHTML = `
        <div class="vocab-card" style="text-align: center; padding: 2rem;">
          <h3>Bloc bloquejat 🔒</h3>
          <p>Has de completar el vocabulari d'aquest bloc fins a la Fase 5 per poder accedir a la pràctica de gramàtica.</p>
        </div>`;
      return;
    }

    currentGrammarWords = paraules;
    renderGrammarTheory(container);
  } catch (err) {
    console.error("Error crític en el mòdul de gramàtica:", err);
    container.innerHTML = `<p>S'ha produït un error en carregar el mòdul.</p>`;
  }
}

// --- FASE 1: EXPLICACIÓ CLARA I DIRECTA (De ls_teoria) ---
function renderGrammarTheory(container) {
  const titol = theoryData ? theoryData.concepte_clau : "Repàs Gramatical";
  const explicacio = theoryData
    ? theoryData.explicacio_detallada
    : "Ordena les frases per practicar la teva sintaxi.";
  const exemple = theoryData ? theoryData.exemple_clau : "";

  container.innerHTML = `
    <div class="vocab-card grammar-theory" style="padding: 30px; border-top: 6px solid #6366f1;">
        <div class="word-header">
            <span class="level-tag">${theoryData ? theoryData.pilar_tematic : "GRAMÀTICA"}</span>
        </div>
        <h2 style="margin-top: 15px; color: #1e293b;">${titol}</h2>
        <p style="font-size: 1.1rem; line-height: 1.6; color: #334155;">${explicacio}</p>
        ${
          exemple
            ? `<div style="margin-top: 20px; padding: 15px; background: #eef2ff; border-radius: 8px;">
            <small style="color: #6366f1; font-weight: bold;">EXEMPLE CLAU:</small>
            <p style="font-style: italic;">"${exemple}"</p>
        </div>`
            : ""
        }
        <button id="btn-start-practice" class="primary" style="width: 100%; margin-top: 25px;">
            Entès, anem a practicar! ✍️
        </button>
    </div>`;

  document.getElementById("btn-start-practice").onclick = () => {
    console.log("Botó clicat, executant renderUnscrambleTask...");
    renderUnscrambleTask(container);
  };
}
function renderUnscrambleTask(container) {
  if (currentIndex >= currentGrammarWords.length) {
    renderGrammarFinal(container);
    return;
  }

  const wordData = currentGrammarWords[currentIndex];
  const sentence = wordData.frase_en;
  const targetWordCount = sentence.split(" ").length;

  // Desordenem les paraules
  const scrambled = sentence.split(" ").sort(() => Math.random() - 0.5);
  let userSelection = [];

  container.innerHTML = `
    <div class="vocab-card" style="padding: 25px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <small style="color: #6366f1; font-weight: bold;">EXERCICI ${currentIndex + 1}/${currentGrammarWords.length}</small>
        <button id="btn-audio-hint" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">🔊</button>
      </div>
      
      <h3 style="margin: 15px 0 5px 0;">Ordena la frase:</h3>
      <p style="color: #64748b; margin-bottom: 25px; font-style: italic;">"${wordData.frase_es}"</p>
      
      <div id="selection-area" style="min-height: 60px; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 10px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 8px; background: #f8fafc;"></div>
      
      <div id="words-pool" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 25px; justify-content: center;">
        ${scrambled.map((w, i) => `<button class="word-chip" data-index="${i}" style="padding: 10px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-weight: 500;">${w}</button>`).join("")}
      </div>

      <div id="grammar-feed" style="margin-bottom: 15px; min-height: 24px; text-align: center; font-weight: bold;"></div>
      
      <div style="display: flex; gap: 10px;">
        <button id="btn-reset-grammar" class="secondary" style="flex: 1;">Reiniciar 🔄</button>
        <button id="btn-check-grammar" class="primary" style="flex: 2; opacity: 0.5; cursor: not-allowed;" disabled>Comprovar ✅</button>
      </div>
    </div>
  `;

  const checkBtn = document.getElementById("btn-check-grammar");

  // Funció d'àudio
  const playAudio = (text) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    synth.speak(utterance);
  };

  document.getElementById("btn-audio-hint").onclick = () => playAudio(sentence);

  // Lògica de selecció de paraules
  document.querySelectorAll(".word-chip").forEach((btn) => {
    btn.onclick = () => {
      userSelection.push(btn.innerText);

      const chip = document.createElement("span");
      chip.innerText = btn.innerText;
      chip.style =
        "padding: 6px 12px; background: #6366f1; color: white; border-radius: 6px; cursor: pointer;";

      // Si cliquen la paraula a l'àrea de selecció, la tornem a baix
      chip.onclick = () => {
        userSelection = userSelection.filter((w) => w !== chip.innerText);
        chip.remove();
        btn.style.display = "block";
        checkBtn.disabled = true;
        checkBtn.style.opacity = "0.5";
        checkBtn.style.cursor = "not-allowed";
      };

      document.getElementById("selection-area").appendChild(chip);
      btn.style.display = "none";

      // ACTIVACIÓ DEL BOTÓ: Només si la frase està completa
      if (userSelection.length === targetWordCount) {
        checkBtn.disabled = false;
        checkBtn.style.opacity = "1";
        checkBtn.style.cursor = "pointer";
        checkBtn.style.background = "#4f46e5"; // Color més intens
      }
    };
  });

  document.getElementById("btn-reset-grammar").onclick = () =>
    renderUnscrambleTask(container);

  // Lògica de comprovació
  checkBtn.onclick = async () => {
    const finalSentence = userSelection.join(" ").trim();
    const feedback = document.getElementById("grammar-feed");
    const selectionArea = document.getElementById("selection-area");

    if (finalSentence === sentence.trim()) {
      // CAS CORRECTE
      feedback.innerHTML =
        "<span style='color: #22c55e'>🎉 Correct! Well done.</span>";
      feedback.style.animation = "bounce 0.5s ease";
      playAudio(sentence);

      await updateGrammarProgress(wordData.id);

      setTimeout(() => {
        currentIndex++;
        renderUnscrambleTask(container);
      }, 2000);
    } else {
      // CAS ERROR: Mostrem l'explicació específica del registre
      selectionArea.style.borderColor = "#ef4444";
      selectionArea.style.backgroundColor = "#fef2f2";

      feedback.innerHTML = `
        <div style="background: #fff1f2; border-left: 4px solid #ef4444; padding: 12px; margin-top: 10px; text-align: left;">
          <p style="color: #991b1b; margin-bottom: 5px;">❌ <strong>Keep trying!</strong></p>
          <p style="color: #475569; font-size: 0.9rem; font-weight: normal; line-height: 1.4;">
            ${wordData.explicacio_gramatical || "Revisa l'ordre de la frase segons la teoria del bloc."}
          </p>
        </div>
      `;

      // Opcional: Podem fer que les paraules tornin a la pool automàticament després de 3 segons
      // o deixar que l'usuari cliqui "Reiniciar" o tregui paraules manualment.
    }
  };
}
async function updateGrammarProgress(wordId) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    console.log("Actualitzant progrés per a la unitat:", wordId);

    // Fem servir 'unitat_id' perquè és el nom real de la teva columna
    const { error } = await supabase
      .from("ls_progres_usuari")
      .update({
        fase_gramatica: 1,
        ultima_revisio: new Date().toISOString(),
      })
      .eq("user_id", session.user.id)
      .eq("unitat_id", wordId);

    if (error) {
      console.error("Error en el PATCH de Supabase:", error.message);
    } else {
      console.log("✅ Progrés guardat correctament a 'ls_progres_usuari'");
    }
  } catch (err) {
    console.error("Error crític a updateGrammarProgress:", err);
  }
}

function renderGrammarFinal(container) {
  container.innerHTML = `
    <div class="vocab-card" style="text-align:center; padding:40px; animation: slideUp 0.5s ease;">
        <div style="font-size: 4rem; margin-bottom: 20px;">🏆</div>
        <h2 style="color: #1e293b;">Mestre de la Gramàtica!</h2>
        <p style="color: #64748b; margin-top: 10px;">Has completat tots els exercicis d'aquest bloc amb èxit.</p>
        <button onclick="location.reload()" class="primary" style="margin-top:30px; width: 100%;">
            Tornar al menú principal
        </button>
    </div>`;
}