import { SUPABASE_URL, SUPABASE_KEY } from "./moduls/config.js";
import { initVocabModule } from "./moduls/vocab.js";
import { initGrammarModule } from "./moduls/grammar.js";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentLevel = "A1";
let myChart = null;

window.currentLevel = currentLevel;

// Referències DOM
const userProfile = document.getElementById("user-profile");
const loginForm = document.getElementById("login-form");
const exerciseContainer = document.getElementById("exercise-container");
const btnBack = document.getElementById("btn-back");

// Inicialització d'àudio global
window.speak = (text) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
};

// --- NAVEGACIÓ ---
function openModule(moduleName) {
  userProfile.style.display = "none";
  exerciseContainer.style.display = "block";
  btnBack.style.display = "block";

  if (moduleName === "vocab") {
    initVocabModule(supabaseClient, exerciseContainer, currentLevel);
  } else if (moduleName === "grammar") {
    initGrammarModule(supabaseClient, exerciseContainer, currentLevel);
  }
}

function closeModule() {
  exerciseContainer.style.display = "none";
  btnBack.style.display = "none";
  userProfile.style.display = "block";
  loadProgressChart(supabaseClient);
}

// --- GRÀFIC DE PROGRÉS ---
async function loadProgressChart() {
  const { data: allWords } = await supabaseClient
    .from("ls_contingut")
    .select("id, nivell");

  const { data: userProgress } = await supabaseClient
    .from("ls_progres_usuari")
    .select("unitat_id, fase_vocabulari, fase_gramatica") // Afegim fase_gramatica
    .eq(
      "user_id",
      (await supabaseClient.auth.getSession()).data.session?.user.id,
    );

  const levels = ["A1", "A2", "B1", "B2"];
  const results = levels.map((lvl) => {
    const wordsInLevel = allWords.filter((w) => w.nivell === lvl);

    let grammarDone = 0; // Gramàtica completada
    let mastered = 0; // Vocabulari Fase 5 (sense gramàtica encara)
    let intermediate = 0; // Vocabulari Fases 1-4
    let pending = 0; // Sense progressar

    wordsInLevel.forEach((w) => {
      const prog = userProgress?.find((p) => p.unitat_id === w.id);
      const faseVocab = prog ? parseInt(prog.fase_vocabulari) : 0;
      const faseGram = prog ? parseInt(prog.fase_gramatica) : 0;

      if (faseGram > 0) {
        grammarDone++; // Prioritat màxima: Gramàtica feta
      } else if (faseVocab >= 5) {
        mastered++; // Vocabulari dominat però gramàtica pendent
      } else if (faseVocab > 0) {
        intermediate++; // En procés de vocabulari
      } else {
        pending++; // Pendent de tot
      }
    });

    return { level: lvl, grammarDone, mastered, intermediate, pending };
  });

  const ctx = document.getElementById("progressChart").getContext("2d");
  if (myChart) myChart.destroy();

  myChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: results.map((r) => r.level),
      datasets: [
        {
          label: "Gramàtica Completada",
          data: results.map((r) => r.grammarDone),
          backgroundColor: "#6366f1", // Blau Indigo
        },
        {
          label: "Vocabulari Dominat",
          data: results.map((r) => r.mastered),
          backgroundColor: "#22c55e", // Verd
        },
        {
          label: "En procés",
          data: results.map((r) => r.intermediate),
          backgroundColor: "#eab308", // Groc
        },
        {
          label: "Pendent",
          data: results.map((r) => r.pending),
          backgroundColor: "#e2e8f0", // Gris
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { stepSize: 5 },
        },
      },
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}

function updateChartUI(results) {
  const ctx = document.getElementById("progressChart");
  if (!ctx) return;
  if (myChart) myChart.destroy();
  myChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: results.map((r) => r.level),
      datasets: [
        {
          label: "Dominat",
          data: results.map((r) => r.mastered),
          backgroundColor: "#22c55e",
        },
        {
          label: "Pendent",
          data: results.map((r) => r.pending),
          backgroundColor: "#e2e8f0",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true } },
    },
  });
}

// --- EVENTS ---
document.getElementById("btn-login").onclick = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) alert("Error: " + error.message);
  else location.reload();
};

document.getElementById("btn-vocab").onclick = () => openModule("vocab");
document.getElementById("btn-grammar").onclick = () => openModule("grammar");
btnBack.onclick = closeModule;

// Chequejar sessió inicial
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    loginForm.style.display = "none";
    userProfile.style.display = "block";
    document.getElementById("user-email").innerText = data.session.user.email;
    loadProgressChart(supabaseClient);
  }
});
// Funcionalitat per al nou botó de "Cancel·lar" al formulari de login
document.getElementById("btn-cancel-login").onclick = () => {
    document.getElementById("email").value = "";
    document.getElementById("password").value = "";
    document.getElementById("message").innerText = "Sessió no iniciada.";
};

// Funcionalitat per al botó de "Tancar sessió" (Logout)
document.getElementById("btn-logout").onclick = async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert("Error en tancar sessió: " + error.message);
    } else {
        // Reiniciem la pàgina per netejar l'estat de l'aplicació
        location.reload();
    }
};
