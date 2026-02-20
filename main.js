import { SUPABASE_URL, SUPABASE_KEY } from "./moduls/config.js";
import { initVocabModule } from "./moduls/vocab.js";
import { initGrammarModule } from "./moduls/grammar.js";
import { initReviewModule } from "./moduls/review.js";
import { loadVoices } from "./moduls/audio.js";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let nextUnitData = null;
let myChart = null;

loadVoices();

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

  // 1. Obtener todas las unidades y el progreso global
  const { data: units } = await supabaseClient
    .from("b2_unitats")
    .select("*")
    .order("ordre", { ascending: true });
  const { data: userProgress } = await supabaseClient
    .from("b2_progres_usuari")
    .select("*")
    .eq("user_id", session.user.id);

  const completedUnitIds = userProgress
    ? userProgress.filter((p) => p.completada).map((p) => p.unitat_id)
    : [];

  // 2. Determinar la unidad actual para el display
  if (units && units.length > 0) {
    nextUnitData =
      units.find((u) => !completedUnitIds.includes(u.id)) || units[0];
    document.getElementById("next-unit-display").innerText = nextUnitData.titol;
  }

  // --- REPARACIÓN DEL GRÁFICO ---

  // A. Total de frases reales en la base de datos
  const { count: totalFrases } = await supabaseClient
    .from("b2_contingut")
    .select("*", { count: "exact", head: true });

  // B. Obtener todas las frases que pertenecen a las unidades completadas
  const { data: frasesUnidadesHechas } = await supabaseClient
    .from("b2_contingut")
    .select("id")
    .in("unitat_id", completedUnitIds);

  // C. Obtener IDs de frases sueltas (registros con contingut_id)
  const frasesSueltasIds = userProgress
    ? userProgress.filter((p) => p.contingut_id).map((p) => p.contingut_id)
    : [];

  // Combinamos ambos para evitar duplicados y tener el número real
  const totalHecho = new Set([
    ...(frasesUnidadesHechas ? frasesUnidadesHechas.map((f) => f.id) : []),
    ...frasesSueltasIds,
  ]).size;

  renderProgressChart(totalFrases || 0, totalHecho);
}

function openModule() {
  if (!nextUnitData) return;

  const container = document.getElementById("module-container");

  // Verificación de seguridad: si el contenedor no existe, lanzamos un error claro
  if (!container) {
    console.error(
      "Error: No se ha encontrado el elemento 'module-container' en el HTML.",
    );
    return;
  }

  document.getElementById("user-profile").style.display = "none";
  document.getElementById("practice-wrapper").style.display = "block";

  if (nextUnitData.tipus === "Vocabulary") {
    initVocabModule(supabaseClient, container, nextUnitData.id);
  } else if (nextUnitData.tipus === "Grammar") {
    initGrammarModule(supabaseClient, container, nextUnitData.id);
  } else {
    initReviewModule(supabaseClient, container, nextUnitData.id);
  }
}

function goBackToDashboard() {
  document.getElementById("practice-wrapper").style.display = "none";
  document.getElementById("user-profile").style.display = "block";
  updateDashboard();
}

document.getElementById("btn-start-flow").onclick = openModule;
document.getElementById("btn-back").onclick = goBackToDashboard;

function renderProgressChart(total, completed) {
  const canvas = document.getElementById("progressChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const percentage = Math.round((completed / total) * 100) || 0;
  document.getElementById("percent-text").innerText = percentage + "%";
 
  document.getElementById("stat-done").innerText = completed; // Ahora son frases
  document.getElementById("stat-pending").innerText = total - completed;

  if (myChart) myChart.destroy();

  myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Completado", "Pendiente"],
      datasets: [
        {
          data: [completed, total - completed],
          backgroundColor: ["#2563eb", "#e2e8f0"],
          borderWidth: 0,
          borderRadius: 10,
        },
      ],
    },
    options: {
      cutout: "85%",
      plugins: { legend: { display: false } },
    },
  });
}

async function toggleAnswersPanel() {
    const panel = document.getElementById("side-panel-answers");
    const container = document.getElementById("answers-table-container");

    if (panel.style.display === "block") {
        panel.style.display = "none";
        return;
    }

    if (!nextUnitData) return;

    panel.style.display = "block";
    container.innerHTML = "<p>Cargando respuestas...</p>";

    // Consultamos todo el contenido de la unidad actual
    const { data, error } = await supabaseClient
        .from("b2_contingut")
        .select("paraula_en, paraula_es, categoria")
        .eq("unitat_id", nextUnitData.id)
        .order("categoria", { ascending: true });

    if (error) {
        container.innerHTML = "<p>Error al cargar datos.</p>";
        return;
    }

    // Creamos la tabla
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                    <th style="padding: 8px; border-bottom: 2px solid #e2e8f0;">ES</th>
                    <th style="padding: 8px; border-bottom: 2px solid #e2e8f0;">EN</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(item => {
        html += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${item.paraula_es}</td>
                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #2563eb;">${item.paraula_en}</td>
            </tr>
        `;
    });

    html += "</tbody></table>";
    container.innerHTML = html;
}

// Eventos de los botones
document.getElementById("btn-show-answers").onclick = toggleAnswersPanel;
document.getElementById("btn-close-panel").onclick = () => {
    document.getElementById("side-panel-answers").style.display = "none";
};
