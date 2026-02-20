import { speak } from "./audio.js";

let reviewSteps = [];
let currentIndex = 0;
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

export async function initReviewModule(supabaseClient, container, id) {
  supabase = supabaseClient;
  containerRef = container;
  currentIndex = 0;
  stats = { correct: 0, skipped: 0 };

  const { data } = await supabase
    .from("b2_contingut")
    .select("*")
    .eq("unitat_id", id);
  reviewSteps = data ? data.sort(() => Math.random() - 0.5).slice(0, 10) : [];
  renderReview();
}

function renderReview() {
  if (currentIndex >= reviewSteps.length) return showSummary();
  const item = reviewSteps[currentIndex];

  containerRef.innerHTML = `
    <h2 style="color:#2563eb; text-align:center;">Global Review</h2>
    <div style="background:#f8fafc; padding:30px; border-radius:15px; text-align:center; margin-bottom:15px; border:1px solid #e2e8f0;">
        <p style="font-size:1.4rem; font-weight:bold;">${item.paraula_es}</p>
    </div>
    <input type="text" id="review-input" placeholder="In English..." autocomplete="off" style="padding:15px; width:100%; border-radius:12px; border:2px solid #2563eb; text-align:center; margin-bottom:10px;">
    <button id="btn-check-r" style="width:100%; padding:15px; background:#2563eb; color:white; border-radius:12px; border:none; font-weight:bold; cursor:pointer;">Comprobar</button>
  `;

  const input = document.getElementById("review-input");
  const verify = async () => {
    if (normalize(input.value) === normalize(item.paraula_en)) {
      speak(item.paraula_en);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("b2_progres_usuari").upsert(
          [
            {
              user_id: session.user.id,
              unitat_id: item.unitat_id,
              completada: true,
            },
          ],
          {
            onConflict: "user_id, unitat_id",
          },
        );
      }

      stats.correct++;
      currentIndex++;
      renderReview();
    } else {
      input.classList.add("shake");
      setTimeout(() => input.classList.remove("shake"), 500);
    }
  };
  document.getElementById("btn-check-r").onclick = verify;
  input.onkeyup = (e) => e.key === "Enter" && verify();
  input.focus();
}

async function showSummary() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session && reviewSteps.length > 0) {
    await supabase.from("b2_progres_usuari").upsert(
      [
        {
          user_id: session.user.id,
          unitat_id: reviewSteps[0].unitat_id,
          completada: true,
        },
      ],
      { onConflict: "user_id, unitat_id" },
    );
  }

  confetti({ particleCount: 150, spread: 70 });
  containerRef.innerHTML = `
    <div style="text-align:center; padding:30px;">
        <h1>🎓</h1>
        <h2>Repaso Finalizado</h2>
        <p>Has consolidado los conocimientos de esta unidad.</p>
        <button onclick="location.reload()" style="padding:12px 25px; background:#2563eb; color:white; border-radius:10px; border:none; cursor:pointer; margin-top:20px; font-weight:bold;">Ir al Siguiente Vídeo</button>
    </div>`;
}
