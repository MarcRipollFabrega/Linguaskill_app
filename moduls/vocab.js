import { speak } from "./audio.js";

let allWords = [];
let wordsQueue = [];
let currentActiveBatch = [];
let containerRef = null;
let supabase = null;
let typingIndex = 0;
let stats = { correct: 0, skipped: 0 };

const normalize = (text) =>
  text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export async function initVocabModule(supabaseClient, container, id) {
  supabase = supabaseClient;
  containerRef = container;
  stats = { correct: 0, skipped: 0 };

  const { data } = await supabase
    .from("b2_contingut")
    .select("*")
    .eq("unitat_id", id)
    .eq("categoria", "Vocabulary");

  allWords = data || [];
  wordsQueue = [...allWords].sort(() => Math.random() - 0.5);
  processNextBatch();
}

function processNextBatch() {
  if (wordsQueue.length === 0 && currentActiveBatch.length === 0)
    return showFinalSummary();
  currentActiveBatch = wordsQueue.splice(0, 5);
  typingIndex = 0;
  renderTypingCard();
}

function renderTypingCard() {
  if (typingIndex >= currentActiveBatch.length) return processNextBatch();
  const word = currentActiveBatch[typingIndex];

  containerRef.innerHTML = `
    <h2 style="text-align:center;">Escribe en inglés</h2>
    <div style="background:#f1f5f9; padding:30px; border-radius:15px; text-align:center; margin-bottom:15px;">
        <p style="font-size:1.5rem; font-weight:bold;">${word.paraula_es}</p>
    </div>
    <input type="text" id="vocab-input" autocomplete="off" style="padding:15px; width:100%; border-radius:12px; border:2px solid #2563eb; text-align:center; margin-bottom:10px; font-size:1.1rem;">
    <button id="btn-check-v" style="width:100%; padding:15px; background:#2563eb; color:white; border-radius:12px; border:none; font-weight:bold; cursor:pointer;">Comprobar</button>
  `;

  const input = document.getElementById("vocab-input");
  const verify = async () => {
    if (normalize(input.value) === normalize(word.paraula_en)) {
      speak(word.paraula_en);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("b2_progres_usuari").upsert(
          [
            {
              user_id: session.user.id,
              unitat_id: word.unitat_id, // Usamos tu columna real
              vocab_completat: true, // Actualizamos el estado de vocabulario
            },
          ],
          {
            onConflict: "user_id, unitat_id",
          },
        );
      }

      typingIndex++;
      stats.correct++;
      renderTypingCard();
    } else {
      input.classList.add("shake");
      setTimeout(() => input.classList.remove("shake"), 500);
    }
  };
  document.getElementById("btn-check-v").onclick = verify;
  input.onkeyup = (e) => e.key === "Enter" && verify();
  input.focus();
}

async function showFinalSummary() {
const {
  data: { session },
} = await supabase.auth.getSession();
if (session) {
  await supabase.from("b2_progres_usuari").upsert(
    [
      {
        user_id: session.user.id,
        contingut_id: word.id, // <-- IMPORTANTE: Usar el ID de la palabra
        unitat_id: word.unitat_id,
        vocab_completat: false,
      },
    ],
    {
      onConflict: "user_id, contingut_id", // <-- Cambiado para que no sobreescriba la unidad
    },
  );
}

  confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  containerRef.innerHTML = `
    <div style="text-align:center; padding:30px;">
        <h1 style="font-size:3rem;">🏆</h1>
        <h2>¡Vocabulario Completado!</h2>
        <p style="color:#64748b;">Has practicado todas las palabras de esta unidad.</p>
        <button onclick="location.reload()" style="padding:12px 25px; background:#2563eb; color:white; border-radius:10px; border:none; cursor:pointer; margin-top:20px; font-weight:bold;">Siguiente Paso</button>
    </div>`;
}