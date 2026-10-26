import type { Decision } from "../domain/check-action";
import type { ActionListItem } from "../repositories/action-repository";

const decisionLabels: Record<Decision, string> = {
  approved: "Approuvée",
  blocked: "Bloquée",
  pending_approval: "En attente",
};

const amountFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderActionRow(action: ActionListItem): string {
  const amount =
    action.amount === undefined ? "—" : amountFormatter.format(action.amount);
  const timestamp = new Date(action.createdAt);
  const formattedTimestamp = Number.isNaN(timestamp.getTime())
    ? escapeHtml(action.createdAt)
    : escapeHtml(dateFormatter.format(timestamp));
  const decision = decisionLabels[action.decision];
  const controls =
    action.decision === "pending_approval"
      ? `<div class="action-controls">
          <form method="post" action="/actions/${action.id}/decision">
            <button class="button button-approve" type="submit" name="decision" value="approved" aria-label="Approuver l’action ${escapeHtml(action.actionType)}">Approuver</button>
          </form>
          <form method="post" action="/actions/${action.id}/decision">
            <button class="button button-block" type="submit" name="decision" value="blocked" aria-label="Bloquer l’action ${escapeHtml(action.actionType)}">Bloquer</button>
          </form>
        </div>`
      : `<span class="no-action" aria-label="Aucune action manuelle nécessaire">Aucune action</span>`;
  const explanation = action.explanation
    ? `<div class="explanation"><span class="explanation-mark">✦</span><span>${escapeHtml(action.explanation)}</span></div>`
    : action.decision === "blocked" || action.decision === "pending_approval"
      ? `<span class="advisor-pending">Advisor indisponible</span>`
      : `<span class="muted">Pas nécessaire</span>`;

  return `
    <tr>
      <td><time datetime="${escapeHtml(action.createdAt)}">${formattedTimestamp}</time></td>
      <td><span class="action-type">${escapeHtml(action.actionType)}</span></td>
      <td class="numeric">${amount}</td>
      <td><span class="status status-${action.decision}"><span class="status-dot"></span>${decision}</span></td>
      <td class="risk-cell"><strong>${action.riskScore}</strong><span>/100</span><div class="risk-bar"><i style="width:${Math.min(100, Math.max(0, action.riskScore))}%"></i></div></td>
      <td class="advisor-column">${explanation}</td>
      <td>${controls}</td>
    </tr>`;
}

export function renderActionsPage(actions: ActionListItem[]): string {
  const total = actions.length;
  const pending = actions.filter((action) => action.decision === "pending_approval").length;
  const blocked = actions.filter((action) => action.decision === "blocked").length;
  const explained = actions.filter((action) => Boolean(action.explanation)).length;
  const latestExplanation = actions.find((action) => action.explanation);
  const rows =
    actions.length === 0
      ? `<tr><td class="empty-state" colspan="7"><div class="empty-icon">✦</div><strong>Aucune action pour l’instant</strong><span>Les décisions envoyées à l’API apparaîtront ici.</span></td></tr>`
      : actions.map(renderActionRow).join("");
  const advisorModel = escapeHtml(process.env["OLLAMA_MODEL"] ?? "qwen2.5:3b");

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Cockpit des décisions et explications Advisor d’InGravity.">
    <link rel="icon" href="data:,">
    <title>InGravity — Cockpit</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #ecf4ff; background: #070b14; }
      * { box-sizing: border-box; }
      body { min-width: 320px; margin: 0; background: radial-gradient(circle at 76% 0%, #12334b 0, transparent 31rem), radial-gradient(circle at 0% 60%, #24163d 0, transparent 28rem), #070b14; }
      main { width: min(1400px, calc(100% - 48px)); margin: 0 auto; padding: 34px 0 72px; }
      .topbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 42px; }
      .brand { display: flex; align-items: center; gap: 13px; color: #f4f8ff; text-decoration: none; }
      .brand-mark { display: grid; width: 48px; height: 48px; place-items: center; border: 1px solid #53657e; border-radius: 14px; color: #fff; background: #02050a; font-size: 16px; font-weight: 800; letter-spacing: -.08em; box-shadow: 0 0 28px rgb(57 194 255 / 16%); }
      .brand-name { font-size: 20px; font-weight: 780; letter-spacing: -.04em; }
      .brand-subtitle { margin-top: 3px; color: #7890ad; font-size: 11px; letter-spacing: .11em; text-transform: uppercase; }
      .page-nav { display: flex; gap: 8px; }
      .page-nav a { display: inline-flex; align-items: center; min-height: 38px; padding: 0 14px; border: 1px solid #26364f; border-radius: 10px; color: #9db1ca; background: rgb(12 20 34 / 70%); font-size: 13px; font-weight: 700; text-decoration: none; }
      .page-nav a:hover { border-color: #4a6a96; color: #fff; }
      .page-nav a[aria-current="page"] { border-color: #31c8ef; color: #06131d; background: #55ddff; }
      .page-nav a:focus-visible, button:focus-visible { outline: 3px solid #55ddff; outline-offset: 3px; }
      .hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 30px; margin-bottom: 28px; }
      .eyebrow { margin: 0 0 11px; color: #55ddff; font-size: 12px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
      h1 { margin: 0; color: #f7fbff; font-size: clamp(32px, 5vw, 54px); letter-spacing: -.055em; line-height: 1; }
      .intro { max-width: 650px; margin: 13px 0 0; color: #8ea5bf; font-size: 16px; line-height: 1.55; }
      .live-pill { display: inline-flex; align-items: center; gap: 9px; padding: 10px 13px; border: 1px solid #21495b; border-radius: 999px; color: #8df0bd; background: #0d2425; font-size: 12px; font-weight: 750; white-space: nowrap; }
      .live-dot, .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #55e59b; box-shadow: 0 0 13px #55e59b; }
      .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 13px; margin-bottom: 16px; }
      .summary-card, .advisor-panel, .table-shell { border: 1px solid #20314a; background: linear-gradient(145deg, rgb(17 29 48 / 92%), rgb(9 16 29 / 92%)); box-shadow: 0 22px 60px rgb(0 0 0 / 18%); }
      .summary-card { min-height: 126px; padding: 20px; border-radius: 16px; }
      .summary-label { color: #8298b3; font-size: 12px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
      .summary-value { margin-top: 12px; color: #f7fbff; font-size: 34px; font-weight: 780; letter-spacing: -.05em; }
      .summary-note { margin-top: 3px; color: #68809e; font-size: 12px; }
      .summary-card:nth-child(2) { border-color: #735b24; }
      .summary-card:nth-child(2) .summary-value { color: #ffc96b; }
      .summary-card:nth-child(3) { border-color: #633448; }
      .summary-card:nth-child(3) .summary-value { color: #ff8ca3; }
      .summary-card:nth-child(4) { border-color: #28556a; }
      .summary-card:nth-child(4) .summary-value { color: #55ddff; }
      .advisor-panel { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: center; margin: 16px 0 28px; padding: 23px 25px; border-color: #28556a; border-radius: 17px; background: radial-gradient(circle at 92% 50%, rgb(36 162 211 / 16%), transparent 20rem), linear-gradient(145deg, rgb(13 35 53 / 96%), rgb(9 17 29 / 94%)); }
      .advisor-heading { display: flex; align-items: center; gap: 13px; }
      .advisor-icon { display: grid; width: 42px; height: 42px; place-items: center; border: 1px solid #38c9f1; border-radius: 13px; color: #55ddff; background: #102e42; font-size: 22px; }
      .advisor-title { margin: 0; color: #f7fbff; font-size: 18px; }
      .advisor-subtitle { margin: 4px 0 0; color: #8ca8c5; font-size: 13px; }
      .advisor-copy { margin: 16px 0 0; color: #a5b9d0; font-size: 13px; line-height: 1.55; }
      .advisor-copy strong { color: #eaf7ff; }
      .advisor-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; }
      .model-tag { padding: 8px 11px; border: 1px solid #2e5470; border-radius: 8px; color: #9feaff; background: #0c2537; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .advisor-state { color: #7eeab0; font-size: 12px; font-weight: 750; }
      .latest { margin: -11px 0 25px; padding: 12px 16px; border-left: 3px solid #b36cff; border-radius: 0 10px 10px 0; color: #b7c6d9; background: rgb(31 22 51 / 72%); font-size: 13px; line-height: 1.5; }
      .latest strong { color: #e5cbff; }
      .table-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 13px; }
      .table-heading h2 { margin: 0; color: #f7fbff; font-size: 21px; letter-spacing: -.025em; }
      .table-heading p { margin: 0; color: #7189a5; font-size: 13px; }
      .table-shell { overflow: hidden; border-radius: 17px; }
      .table-scroll { overflow-x: auto; }
      table { width: 100%; min-width: 1040px; border-collapse: collapse; text-align: left; }
      th, td { padding: 16px 18px; border-bottom: 1px solid #1a2a40; vertical-align: middle; }
      th { color: #6f89a6; background: rgb(10 19 32 / 78%); font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
      td { color: #bdcce0; font-size: 13px; }
      tbody tr { transition: background .18s ease; }
      tbody tr:hover { background: rgb(36 67 101 / 21%); }
      tbody tr:last-child td { border-bottom: 0; }
      .action-type { display: inline-flex; padding: 6px 9px; border: 1px solid #2a4160; border-radius: 7px; color: #e4f2ff; background: #112039; font-weight: 750; }
      .numeric { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .status { display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; white-space: nowrap; }
      .status-approved { color: #8df0bd; background: #12352d; }
      .status-blocked { color: #ff9caf; background: #421f31; }
      .status-pending_approval { color: #ffd27d; background: #42351d; }
      .status-blocked .status-dot { background: #ff718e; box-shadow: 0 0 13px #ff718e; }
      .status-pending_approval .status-dot { background: #ffc85d; box-shadow: 0 0 13px #ffc85d; }
      .risk-cell strong { color: #eaf4ff; font-size: 14px; }
      .risk-cell > span { margin-left: 3px; color: #657d99; font-size: 11px; }
      .risk-bar { width: 68px; height: 4px; margin-top: 7px; overflow: hidden; border-radius: 5px; background: #1b2a40; }
      .risk-bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #55e59b, #ffc85d, #ff718e); }
      .advisor-column { min-width: 280px; max-width: 420px; }
      .explanation { display: flex; gap: 8px; color: #c5d2e3; line-height: 1.45; }
      .explanation-mark { color: #c28aff; font-size: 17px; }
      .advisor-pending { color: #8198b2; font-size: 12px; font-style: italic; }
      .muted, .no-action { color: #607792; font-size: 12px; }
      .action-controls { display: flex; gap: 7px; }
      .action-controls form { margin: 0; }
      .button { border: 0; border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap; }
      .button-approve { color: #071d16; background: #7eeab0; }
      .button-approve:hover { background: #a0f3c8; }
      .button-block { color: #fff0f3; background: #70263e; }
      .button-block:hover { background: #91304f; }
      .empty-state { padding: 58px 18px; color: #6f89a6; text-align: center; }
      .empty-state strong, .empty-state span { display: block; }
      .empty-state strong { margin: 9px 0 5px; color: #d5e2f1; font-size: 15px; }
      .empty-icon { color: #c28aff; font-size: 28px; }
      @media (max-width: 800px) {
        main { width: min(100% - 24px, 1400px); padding-top: 22px; }
        .topbar, .hero { align-items: flex-start; flex-direction: column; }
        .topbar { gap: 18px; margin-bottom: 30px; }
        .page-nav { width: 100%; }
        .page-nav a { flex: 1; justify-content: center; }
        .summary-grid { grid-template-columns: repeat(2, 1fr); }
        .advisor-panel { grid-template-columns: 1fr; }
        .advisor-meta { align-items: flex-start; flex-direction: row; }
        .table-heading { align-items: flex-start; flex-direction: column; }
      }
      @media (max-width: 470px) { .summary-grid { grid-template-columns: 1fr 1fr; gap: 8px; } .summary-card { min-height: 105px; padding: 14px; } .summary-value { font-size: 27px; } .advisor-panel { padding: 18px; } }
    </style>
  </head>
  <body>
    <main>
      <header class="topbar">
        <a class="brand" href="/" aria-label="InGravity — accueil">
          <span class="brand-mark">InG</span>
          <span><span class="brand-name">InGravity</span><span class="brand-subtitle">Decision control layer</span></span>
        </a>
        <nav class="page-nav" aria-label="Navigation principale">
          <a href="/" aria-current="page">Cockpit</a>
          <a href="/rules">Règles actives</a>
        </nav>
      </header>
      <section class="hero">
        <div>
          <p class="eyebrow">Centre de contrôle</p>
          <h1>Décisions sous contrôle.</h1>
          <p class="intro">Visualisez les actions évaluées, comprenez le risque et intervenez uniquement quand le moteur le demande.</p>
        </div>
        <span class="live-pill"><span class="live-dot"></span> Moteur opérationnel</span>
      </section>
      <section class="summary-grid" aria-label="Résumé des actions">
        <article class="summary-card"><div class="summary-label">Actions évaluées</div><div class="summary-value">${total}</div><div class="summary-note">depuis le démarrage</div></article>
        <article class="summary-card"><div class="summary-label">En attente</div><div class="summary-value">${pending}</div><div class="summary-note">requièrent votre décision</div></article>
        <article class="summary-card"><div class="summary-label">Bloquées</div><div class="summary-value">${blocked}</div><div class="summary-note">par les règles actives</div></article>
        <article class="summary-card"><div class="summary-label">Advisor</div><div class="summary-value">${explained}</div><div class="summary-note">explications générées</div></article>
      </section>
      <section class="advisor-panel" aria-labelledby="advisor-heading">
        <div>
          <div class="advisor-heading"><span class="advisor-icon">✦</span><div><h2 class="advisor-title" id="advisor-heading">Advisor — explication post-décision</h2><p class="advisor-subtitle">Un copilote qui explique, sans jamais influencer le moteur.</p></div></div>
          <p class="advisor-copy">Advisor intervient <strong>après</strong> la décision pour expliquer la règle concernée lorsqu’une action est bloquée ou mise en attente. Il est volontairement best-effort : si Ollama est indisponible, InGravity continue de fonctionner normalement.</p>
        </div>
        <div class="advisor-meta"><span class="model-tag">${advisorModel}</span><span class="advisor-state"><span class="live-dot"></span> Mode best-effort</span></div>
      </section>
      ${latestExplanation ? `<div class="latest"><strong>Dernière explication Advisor :</strong> ${escapeHtml(latestExplanation.explanation ?? "")}</div>` : ""}
      <section aria-labelledby="history-heading">
        <div class="table-heading"><div><h2 id="history-heading">Historique des actions</h2><p>Les décisions les plus récentes apparaissent en premier.</p></div></div>
        <div class="table-shell"><div class="table-scroll"><table><thead><tr><th scope="col">Date et heure (UTC)</th><th scope="col">Type d’action</th><th scope="col">Montant</th><th scope="col">Décision</th><th scope="col">Risque</th><th scope="col">Explication Advisor</th><th scope="col">Intervention</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      </section>
    </main>
  </body>
</html>`;
}
