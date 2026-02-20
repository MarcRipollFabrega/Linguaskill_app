import { speak } from "./audio.js";

let grammarSteps = [];
let currentStepIndex = 0;
let containerRef = null;
let stats = { correct: 0, skipped: 0 };
let supabase = null;

const normalize = (text) =>
  text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export async function initGrammarModule(supabaseClient, container, id) {
  supabase = supabaseClient;
  containerRef = container; // Aquí recibimos la referencia de main.js
  currentStepIndex = 0;
  stats = { correct: 0, skipped: 0 };

  const { data } = await supabase
    .from("b2_contingut")
    .select("*")
    .eq("unitat_id", id)
    .eq("categoria", "Grammar");

  grammarSteps = data || [];
  renderStep();
}

function renderStep() {
  // Verificación de seguridad: línea 45 corregida
  if (!containerRef) {
    console.error("El contenedor no está definido.");
    return;
  }

  if (currentStepIndex >= grammarSteps.length) return showSummary();

  const item = grammarSteps[currentStepIndex];
  const targetWord = item.paraula_en.trim();

  let sentence = item.frase_en || "";
  const escapedWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexExact = new RegExp(`\\b${escapedWord}\\b`, "gi");

  if (!sentence.includes("__________")) {
    sentence = sentence.replace(regexExact, "__________");
  }

  // Línea 45 original que daba error: ahora containerRef ya está validado
  containerRef.innerHTML = `
    <h2 style="color:#2563eb; text-align:center;">Grammar Practice</h2>
    <div style="background:#f1f5f9; padding:20px; border-radius:15px; margin-bottom:15px; text-align:center;">
        <p style="font-size:1.2rem; color:#1e293b; margin-bottom:10px;">"${sentence}"</p>
        <p style="color:#64748b;">Escribe la traducción de: <b>${item.paraula_es}</b></p>
    </div>
    <input type="text" id="grammar-input" autocomplete="off" style="padding:15px; width:100%; border-radius:12px; border:2px solid #2563eb; text-align:center; margin-bottom:10px; font-size:1.1rem;">
    <div style="display:grid; grid-template-columns: 1fr 1fr 2fr; gap:10px;">
        <button id="btn-hint-g" style="padding:10px; background:#fef9c3; border-radius:10px; border:1px solid #fde047;">Pista 💡</button>
        <button id="btn-skip-g" style="padding:10px; background:#f1f5f9; border-radius:10px; border:none;">Saltar ⏭️</button>
        <button id="btn-check-g" style="padding:15px; background:#2563eb; color:white; border-radius:12px; border:none; font-weight:bold;">Comprobar</button>
    </div>
    <div id="feedback" style="margin-top:10px; text-align:center; min-height:20px; color:#2563eb; font-weight:600;"></div>
  `;

  const input = document.getElementById("grammar-input");

const verify = async () => {
  if (normalize(input.value) === normalize(targetWord)) {
    speak(item.frase_en.replace("___", targetWord));

const {
  data: { session },
} = await supabase.auth.getSession();
if (session) {
  await supabase.from("b2_progres_usuari").upsert(
    [
      {
        user_id: session.user.id,
        contingut_id: item.id, // <-- ID único de la frase (CORRECTO)
        unitat_id: item.unitat_id, // <-- Relación con la unidad
        grammar_completat: false, // Todavía no ha terminado el módulo
      },
    ],
    {
      onConflict: "user_id, contingut_id", // <-- DEBE coincidir con el nombre de la restricción SQL
    },
  );
}

    stats.correct++;
    currentStepIndex++;
    renderStep();
  }else {
      input.classList.add("shake");
      setTimeout(() => input.classList.remove("shake"), 500);
    }
  };

  document.getElementById("btn-check-g").onclick = verify;
  document.getElementById("btn-skip-g").onclick = () => {
    stats.skipped++;
    currentStepIndex++;
    renderStep();
  };
  document.getElementById("btn-hint-g").onclick = () => {
    document.getElementById("feedback").innerHTML =
      `Respuesta: <b>${targetWord[0].toUpperCase()}...</b>`;
    input.focus();
  };
  input.onkeyup = (e) => e.key === "Enter" && verify();
  input.focus();
}

async function showSummary() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    // Usamos el ID de la unidad que cargamos al principio
    await supabase.from("b2_progres_usuari").upsert(
      [
        {
          user_id: session.user.id,
          unitat_id: grammarSteps[0].unitat_id, // Obtenemos el ID de los datos cargados
          grammar_completat: true,
          completada: true,
        },
      ],
      { onConflict: "user_id, unitat_id" },
    );
  }

  confetti({ particleCount: 100, spread: 70 });
  containerRef.innerHTML = `
    <div style="text-align:center; padding:30px;">
        <h2>¡Gramática Completada!</h2>
        <p>Has terminado los ejercicios de esta unidad.</p>
        <button onclick="location.reload()" style="padding:12px 25px; background:#2563eb; color:white; border-radius:10px; border:none; cursor:pointer; margin-top:20px; font-weight:bold;">Volver al Menú</button>
    </div>`;
}