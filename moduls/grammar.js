let grammarSteps = [];
let currentStepIndex = 0;
let containerRef = null;
let unitId = null;
let bestVoice = null;

// Carregar veu UK
function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  bestVoice =
    voices.find((v) => v.name.includes("Natural") && v.lang === "en-GB") ||
    voices.find((v) => v.name.includes("Google UK English Female")) ||
    voices.find((v) => v.lang === "en-GB");
}
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (bestVoice) utterance.voice = bestVoice;
  utterance.lang = "en-GB";
  utterance.rate = 0.85;
  setTimeout(() => window.speechSynthesis.speak(utterance), 50);
}

// Normalització per a la pràctica (ignora espais i accents)
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

window.speechSynthesis.onvoiceschanged = loadVoices;

export async function initGrammarModule(supabaseClient, container, id) {
  containerRef = container;
  unitId = id;
  currentStepIndex = 0;

  container.innerHTML =
    "<p style='text-align:center;'>Preparant lliçó de gramàtica...</p>";

  const { data, error } = await supabaseClient
    .from("b2_contingut")
    .select("*")
    .eq("unitat_id", unitId)
    .eq("categoria", "Grammar")
    .order("created_at", { ascending: true }); // Important l'ordre d'inserció

  if (error || !data.length) {
    container.innerHTML =
      "<p>No s'ha trobat contingut gramatical per a aquesta unitat.</p>";
    return;
  }

  grammarSteps = data;
  renderStep();
}

function renderStep() {
  if (currentStepIndex >= grammarSteps.length) {
    showFinalSummary();
    return;
  }

  const item = grammarSteps[currentStepIndex];
  const progress = (currentStepIndex / grammarSteps.length) * 100;

  // Estructura base amb barra de progrés
  containerRef.innerHTML = `
        <div id="grammar-header" style="margin-bottom: 20px;">
            <div style="width: 100%; background: #e2e8f0; height: 8px; border-radius: 4px; margin-bottom: 15px; overflow: hidden;">
                <div style="width: ${progress}%; height: 100%; background: #2563eb; transition: width 0.4s ease;"></div>
            </div>
        </div>
        <div id="grammar-content"></div>
    `;

  const content = document.getElementById("grammar-content");

  if (item.paraula_es === "Teoria") {
    renderTheory(item, content);
  } else {
    renderPractice(item, content);
  }
}

function renderTheory(item, container) {
  container.innerHTML = `
        <div class="theory-card" style="animation: fadeIn 0.5s;">
            <span style="background:#dbeafe; color:#1e40af; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold; text-transform:uppercase;">Explicació</span>
            <h2 style="color:#1e293b; margin-top:10px;">${item.paraula_en}</h2>
            
            <div style="background:#f8fafc; border-left:5px solid #2563eb; padding:20px; margin:20px 0; border-radius:0 10px 10px 0;">
                <p style="margin-bottom:10px;"><strong>Estructura:</strong><br><code style="color:#2563eb;">${item.frase_en}</code></p>
                <p style="margin-bottom:10px;"><strong>Ús:</strong> ${item.frase_es}</p>
                <p style="font-size:0.9rem; color:#64748b; background:#fff; padding:10px; border-radius:8px; border:1px dashed #cbd5e1;">
                    💡 ${item.nota_extra}
                </p>
            </div>
            
            <button id="btn-next" style="width:100%; background:#2563eb; color:white; border:none; padding:18px; border-radius:15px; font-weight:bold; cursor:pointer; font-size:1rem;">
                Entès, anem a practicar ➔
            </button>
        </div>
    `;
  document.getElementById("btn-next").onclick = () => {
    currentStepIndex++;
    renderStep();
  };
}

function renderPractice(item, container) {
  container.innerHTML = `
        <div class="practice-card" style="animation: slideIn 0.3s;">
            <span style="background:#fef3c7; color:#92400e; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold; text-transform:uppercase;">Pràctica: ${item.paraula_en}</span>
            <h3 style="margin:20px 0; font-size:1.3rem; line-height:1.5; color:#1e293b;">${item.frase_en}</h3>
            
            <input type="text" id="grammar-input" autocomplete="off" placeholder="Escriu la forma correcta..." 
                   style="width:100%; padding:15px; border-radius:12px; border:2px solid #e2e8f0; font-size:1.2rem; text-align:center; transition:0.3s;">
            
            <div id="feedback" style="margin-top:15px; min-height:30px; font-weight:bold; text-align:center;"></div>
            
            <button id="btn-check" style="width:100%; background:#1e293b; color:white; border:none; padding:18px; border-radius:15px; font-weight:bold; cursor:pointer; margin-top:10px;">
                Comprovar resposta
            </button>
        </div>
    `;

  const input = document.getElementById("grammar-input");
  const feedback = document.getElementById("feedback");
  input.focus();

  const checkAnswer = () => {
    if (normalize(input.value) === normalize(item.frase_es)) {
      input.style.borderColor = "#10b981";
      input.disabled = true;
      feedback.innerHTML = "<span style='color:#10b981;'>Molt bé! ✨</span>";
      speak(item.frase_en.replace("___", item.frase_es));
      setTimeout(() => {
        currentStepIndex++;
        renderStep();
      }, 1500);
    } else {
      input.style.borderColor = "#ef4444";
      feedback.innerHTML =
        "<span style='color:#ef4444;'>Torna-ho a provar</span>";
      input.classList.add("shake");
      setTimeout(() => input.classList.remove("shake"), 500);
    }
  };

  document.getElementById("btn-check").onclick = checkAnswer;
  input.onkeyup = (e) => {
    if (e.key === "Enter") checkAnswer();
  };
}

async function showFinalSummary() {
  containerRef.innerHTML = `
        <div style="text-align:center; padding:30px;">
            <div style="font-size:4rem; margin-bottom:15px;">🎉</div>
            <h2 style="color:#1e293b;">Gramàtica Completada!</h2>
            <p style="color:#64748b; margin-bottom:30px;">Has acabat tota la teoria i els exercicis d'aquesta unitat.</p>
            <button id="btn-end" style="background:#10b981; color:white; padding:18px; border-radius:15px; border:none; width:100%; font-weight:bold; cursor:pointer;">
                Tornar al Menú
            </button>
        </div>
    `;
  document.getElementById("btn-end").onclick = () =>
    document.getElementById("btn-back").click();
}
