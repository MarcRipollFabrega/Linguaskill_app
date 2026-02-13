let reviewSteps = [];
let currentStepIndex = 0;
let containerRef = null;
let bestVoice = null;

// Sistema de veu per al Review
function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  bestVoice =
    voices.find((v) => v.name.includes("Natural") && v.lang === "en-GB") ||
    voices.find((v) => v.lang === "en-GB");
}
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (bestVoice) u.voice = bestVoice;
  u.lang = "en-GB";
  u.rate = 0.85;
  setTimeout(() => window.speechSynthesis.speak(u), 50);
}

function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function initReviewModule(
  supabaseClient,
  container,
  reviewUnitId,
) {
  containerRef = container;
  currentStepIndex = 0;
  container.innerHTML =
    "<p style='text-align:center;'>Generant examen de repàs...</p>";

  const { data: units } = await supabaseClient
    .from("b2_unitats")
    .select("id")
    .lte("ordre", 2);
  const unitIds = units.map((u) => u.id);

  const { data, error } = await supabaseClient
    .from("b2_contingut")
    .select("*")
    .in("unitat_id", unitIds)
    .neq("paraula_es", "Teoria")
    .limit(20); // Reduït a 20 per a un repàs més àgil

  if (error || !data.length) {
    container.innerHTML = "<p>No hi ha dades per al repàs.</p>";
    return;
  }

  reviewSteps = data.sort(() => Math.random() - 0.5);
  renderReviewStep();
}

function renderReviewStep() {
  if (currentStepIndex >= reviewSteps.length) {
    showReviewResults();
    return;
  }

  const item = reviewSteps[currentStepIndex];
  const progress = (currentStepIndex / reviewSteps.length) * 100;

  containerRef.innerHTML = `
    <div style="margin-bottom: 20px;">
        <div style="width: 100%; background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="width: ${progress}%; height: 100%; background: #8b5cf6; transition: width 0.4s ease;"></div>
        </div>
        <p style="color:#6b7280; font-size:0.8rem; margin-top:10px; font-weight:bold; text-transform:uppercase;">Mixed Review (Unit 1 & 2)</p>
    </div>
    <div class="practice-card" style="animation: fadeIn 0.3s;">
        <h3 style="margin:20px 0; font-size:1.3rem; color:#1e293b; line-height:1.4;">${item.frase_en}</h3>
        <input type="text" id="review-input" autocomplete="off" placeholder="Escriu la resposta..." 
               style="width:100%; padding:15px; border-radius:12px; border:2px solid #8b5cf6; font-size:1.2rem; text-align:center;">
        <div id="review-feedback" style="margin-top:10px; min-height:25px; font-weight:bold; text-align:center;"></div>
        <button id="btn-check-review" style="width:100%; background:#8b5cf6; color:white; border:none; padding:18px; border-radius:15px; font-weight:bold; cursor:pointer; margin-top:15px;">
            Comprovar ➔
        </button>
    </div>
  `;

  const input = document.getElementById("review-input");
  const feedback = document.getElementById("review-feedback");
  input.focus();

  const checkAction = () => {
    const isCorrect = normalize(input.value) === normalize(item.frase_es);
    if (isCorrect) {
      input.style.borderColor = "#10b981";
      feedback.innerHTML = "<span style='color:#10b981;'>Correct! 🔊</span>";
      // Si la frase té buits, els omplim per a la veu
      const speechText = item.frase_en.includes("___")
        ? item.frase_en.replace("___", item.frase_es)
        : item.paraula_en;
      speak(speechText);
      setTimeout(() => {
        currentStepIndex++;
        renderReviewStep();
      }, 1200);
    } else {
      input.style.borderColor = "#ef4444";
      feedback.innerHTML = "<span style='color:#ef4444;'>Try again</span>";
      input.classList.add("shake");
      setTimeout(() => input.classList.remove("shake"), 500);
    }
  };

  document.getElementById("btn-check-review").onclick = checkAction;
  input.onkeyup = (e) => {
    if (e.key === "Enter") checkAction();
  };
}

function showReviewResults() {
  containerRef.innerHTML = `
    <div style="text-align:center; padding:30px;">
        <div style="font-size:4rem; margin-bottom:15px;">🎓</div>
        <h2 style="color:#1e293b;">Repàs Completat!</h2>
        <p style="color:#64748b; margin-bottom:30px;">Has superat el test mixt de gramàtica i vocabulari.</p>
        <button id="btn-finish-review" style="background:#8b5cf6; color:white; padding:18px; border-radius:15px; border:none; width:100%; font-weight:bold; cursor:pointer;">Finalitzar</button>
    </div>
  `;
  document.getElementById("btn-finish-review").onclick = () =>
    document.getElementById("btn-back").click();
}
