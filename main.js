import { SUPABASE_URL, SUPABASE_KEY } from "./moduls/config.js";
import { initVocabModule } from "./moduls/vocab.js";
import { initGrammarModule } from "./moduls/grammar.js";
import { initReviewModule } from "./moduls/review.js"; // Afegit el mòdul de review

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let nextUnitData = null;
let myChart = null;

// Inicialització de sessió
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) showApp(data.session.user);
  else showLogin();
});

function showApp(user) {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("user-profile").style.display = "block";
  document.getElementById("user-email").innerText = user.email;
  updateDashboard();
}

function showLogin() {
  document.getElementById("login-form").style.display = "block";
  document.getElementById("user-profile").style.display = "none";
}

async function updateDashboard() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) return;

  // Agafem les unitats ordenades per l'ordre que has definit (1, 2, 3...)
  const { data: units } = await supabaseClient
    .from("b2_unitats")
    .select("*")
    .order("ordre", { ascending: true });

  const { data: progress } = await supabaseClient
    .from("b2_progres_usuari")
    .select("*")
    .eq("user_id", session.user.id);

  const completedIds = progress ? progress.map((p) => p.unitat_id) : [];

  // El sistema busca la següent unitat no completada seguint l'ordre estrictament
  nextUnitData = units.find((u) => !completedIds.includes(u.id));

  if (nextUnitData) {
    document.getElementById("next-unit-display").innerText =
      `Unitat ${nextUnitData.ordre}: ${nextUnitData.nom || nextUnitData.titol}`;
  } else {
    document.getElementById("next-unit-display").innerText =
      "Curs completat! 🎉";
    document.getElementById("btn-start-flow").style.display = "none";
  }

  renderProgressChart(units.length, completedIds.length);
}

// FUNCIO PER OBRIR EL MODUL (Flux: Vocab -> Grammar -> Review)
function openModule() {
  if (!nextUnitData) return;

  const profile = document.getElementById("user-profile");
  const wrapper = document.getElementById("practice-wrapper");
  const container = document.getElementById("exercise-container");
  const btnBack = document.getElementById("btn-back");

  profile.style.display = "none";
  wrapper.style.display = "block";
  btnBack.style.display = "block";

  container.innerHTML =
    '<p style="text-align:center;">Preparant contingut...</p>';

  console.log(
    "Iniciant unitat:",
    nextUnitData.id,
    "Tipus:",
    nextUnitData.tipus,
  );

  // Seleccionem el mòdul automàticament segons el camp 'tipus' de la taula b2_unitats
  switch (nextUnitData.tipus) {
    case "Vocabulary":
      initVocabModule(supabaseClient, container, nextUnitData.id);
      break;
    case "Grammar":
      initGrammarModule(supabaseClient, container, nextUnitData.id);
      break;
    case "Review":
      initReviewModule(supabaseClient, container, nextUnitData.id);
      break;
    default:
      container.innerHTML = `<p style="text-align:center;">Tipus d'unitat desconegut: ${nextUnitData.tipus}</p>`;
  }
}

function goBackToDashboard() {
  document.getElementById("practice-wrapper").style.display = "none";
  document.getElementById("user-profile").style.display = "block";
  updateDashboard();
}

// Esdeveniments
document.getElementById("btn-start-flow").onclick = openModule;
document.getElementById("btn-back").onclick = goBackToDashboard;

// Gràfic (sense canvis)
function renderProgressChart(total, completed) {
  const canvas = document.getElementById("progressChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (myChart) myChart.destroy();
  myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Fet", "Pendent"],
      datasets: [
        {
          data: [completed, total - completed],
          backgroundColor: ["#2563eb", "#f1f5f9"],
        },
      ],
    },
    options: {
      cutout: "80%",
      plugins: { legend: { display: false } },
      maintainAspectRatio: false,
    },
  });
}

document.getElementById("btn-logout").onclick = async () => {
  await supabaseClient.auth.signOut();
  location.reload();
};
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();