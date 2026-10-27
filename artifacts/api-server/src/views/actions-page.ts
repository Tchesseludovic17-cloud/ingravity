import type { Decision } from "../domain/check-action";
import type { ActionListItem } from "../repositories/action-repository";
import { getAdvisorModel } from "../services/advisor";

const decisionLabels: Record<Decision, string> = {
  approved: "Approuvée",
  blocked: "Bloquée",
  pending_approval: "En attente",
};

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  timeZone: "UTC",
});

export interface AdvisorChatState {
  question: string;
  answer?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function renderTrendChart(actions: ActionListItem[]): string {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (6 - index)));
    return { key: dateKey(day), label: dayFormatter.format(day).replace(".", "") };
  });
  const values = days.map((day) => {
    const matching = actions.filter((action) => dateKey(new Date(action.createdAt)) === day.key);
    const incidents = matching.filter((action) => action.decision !== "approved").length;
    const blocked = matching.filter((action) => action.decision === "blocked").length;
    return { ...day, incidents, blocked };
  });
  const max = Math.max(1, ...values.map((value) => Math.max(value.incidents, value.blocked)));

  return values
    .map(
      (value) => `
        <div class="chart-group" aria-label="${escapeHtml(value.label)} : ${value.incidents} incidents, ${value.blocked} blocages">
          <div class="bars">
            <span class="bar bar-incidents" style="height:${Math.max(value.incidents ? 8 : 2, Math.round((value.incidents / max) * 100))}%"></span>
            <span class="bar bar-blocked" style="height:${Math.max(value.blocked ? 8 : 2, Math.round((value.blocked / max) * 100))}%"></span>
          </div>
          <span class="chart-label">${escapeHtml(value.label)}</span>
        </div>`,
    )
    .join("");
}

function renderActionRow(action: ActionListItem): string {
  const amount = action.amount === undefined ? "—" : amountFormatter.format(action.amount);
  const timestamp = new Date(action.createdAt);
  const formattedTimestamp = Number.isNaN(timestamp.getTime())
    ? escapeHtml(action.createdAt)
    : escapeHtml(dateFormatter.format(timestamp));
  const explanation = action.explanation
    ? `<span class="advisor-explanation">${escapeHtml(action.explanation)}</span>`
    : action.decision === "blocked" || action.decision === "pending_approval"
      ? `<span class="muted">Advisor indisponible</span>`
      : `<span class="muted">Non requise</span>`;
  const controls =
    action.decision === "pending_approval"
      ? `<div class="action-controls">
          <form method="post" action="/actions/${action.id}/decision"><button class="button button-approve" type="submit" name="decision" value="approved">Approuver</button></form>
          <form method="post" action="/actions/${action.id}/decision"><button class="button button-block" type="submit" name="decision" value="blocked">Bloquer</button></form>
        </div>`
      : `<span class="muted">—</span>`;

  return `<tr>
    <td class="mono"><time datetime="${escapeHtml(action.createdAt)}">${formattedTimestamp}</time></td>
    <td><strong class="action-name">${escapeHtml(action.actionType)}</strong></td>
    <td class="mono numeric">${amount}</td>
    <td><span class="status status-${action.decision}">${decisionLabels[action.decision]}</span></td>
    <td class="risk-score"><strong>${action.riskScore}</strong><span>/100</span></td>
    <td class="explanation-cell">${explanation}</td>
    <td>${controls}</td>
  </tr>`;
}

function renderAdvisorPanel(chat: AdvisorChatState | undefined): string {
  const transcript = chat
    ? `<div class="chat-transcript" aria-live="polite">
        <div class="chat-message chat-user"><span class="chat-label">Vous</span><p>${escapeHtml(chat.question)}</p></div>
        <div class="chat-message chat-advisor"><span class="chat-label">Advisor</span><p>${chat.answer ? escapeHtml(chat.answer) : "Ollama est indisponible pour le moment. Le moteur de règles continue de fonctionner normalement."}</p></div>
      </div>`
    : `<div class="chat-empty"><span class="chat-empty-mark">✦</span><p>Posez une question sur une décision, une règle active ou l’historique récent.</p><span class="mono">Ex. « Pourquoi cette action est-elle bloquée ? »</span></div>`;

  return `<section class="advisor-section" aria-labelledby="advisor-heading">
    <div class="advisor-header">
      <div><p class="section-kicker">Conversation locale</p><h2 id="advisor-heading">Ask Advisor</h2><p class="section-description">Un centre de discussion pour comprendre vos décisions de sécurité.</p></div>
      <div class="advisor-status"><span class="status-indicator"></span><span>Ollama · ${escapeHtml(getAdvisorModel())}</span></div>
    </div>
    <div class="advisor-grid">
      <div class="chat-column">
        ${transcript}
        <form class="chat-form" method="post" action="/advisor/chat">
          <label for="advisor-question">Votre question</label>
          <div class="chat-input-row"><input id="advisor-question" name="question" type="text" maxlength="1000" required autocomplete="off" placeholder="Ask Advisor…"><button class="button button-primary" type="submit">Envoyer <span aria-hidden="true">↗</span></button></div>
        </form>
      </div>
      <aside class="advisor-principles"><p class="section-kicker">Rôle d’Advisor</p><ul><li>Explique les règles et les signaux de risque.</li><li>Analyse l’historique sans exécuter d’action.</li><li>Ne remplace jamais le moteur déterministe.</li><li>Fonctionne en local via Ollama.</li></ul></aside>
    </div>
  </section>`;
}

export function renderActionsPage(actions: ActionListItem[], chat?: AdvisorChatState): string {
  const total = actions.length;
  const approved = actions.filter((action) => action.decision === "approved").length;
  const pending = actions.filter((action) => action.decision === "pending_approval").length;
  const blocked = actions.filter((action) => action.decision === "blocked").length;
  const explained = actions.filter((action) => Boolean(action.explanation)).length;
  const rows = actions.length === 0
    ? `<tr><td class="empty-state" colspan="7"><strong>Aucune activité pour le moment.</strong><span>Les décisions envoyées à l’API apparaîtront ici.</span></td></tr>`
    : actions.map(renderActionRow).join("");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Cockpit de sécurité InGravity et centre de discussion Advisor.">
  <link rel="icon" href="data:,"><title>InGravity — Security Intelligence</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #191919; background: #f5f2eb; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; background: #f5f2eb; }
    main { width: min(1320px, calc(100% - 64px)); margin: 0 auto; padding: 35px 0 80px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 19px; border-bottom: 1px solid #cfc8ba; }
    .brand { display: flex; align-items: center; gap: 12px; color: #191919; text-decoration: none; }
    .brand-mark { position: relative; display: block; width: 36px; height: 36px; border: 1px solid #191919; background: #191919; }
    .mesh-edge { position: absolute; height: 1px; transform-origin: left center; background: #f5f2eb; opacity: .82; }
    .mesh-edge-a { left: 10px; top: 10px; width: 17px; transform: rotate(0deg); }
    .mesh-edge-b { left: 10px; top: 10px; width: 17px; transform: rotate(61deg); }
    .mesh-edge-c { left: 10px; top: 10px; width: 17px; transform: rotate(119deg); }
    .mesh-edge-d { left: 10px; top: 10px; width: 17px; transform: rotate(180deg); }
    .mesh-edge-e { left: 10px; top: 10px; width: 17px; transform: rotate(239deg); }
    .mesh-edge-f { left: 10px; top: 10px; width: 17px; transform: rotate(301deg); }
    .mesh-node { position: absolute; width: 6px; height: 6px; border: 1px solid #191919; border-radius: 50%; background: #f5f2eb; }
    .mesh-node-center { left: 15px; top: 15px; width: 7px; height: 7px; background: #d96b43; }
    .mesh-node-1 { left: 7px; top: 7px; } .mesh-node-2 { left: 23px; top: 7px; } .mesh-node-3 { left: 25px; top: 20px; }
    .mesh-node-4 { left: 15px; top: 26px; } .mesh-node-5 { left: 4px; top: 20px; }
    .brand-name { font: 700 18px/1 Georgia, "Times New Roman", serif; letter-spacing: -.02em; }
    .brand-caption { margin-top: 4px; color: #796f62; font-size: 10px; letter-spacing: .13em; text-transform: uppercase; }
    .page-nav { display: flex; gap: 22px; align-items: center; }
    .page-nav a { padding: 8px 0; border-bottom: 1px solid transparent; color: #6e665b; font-size: 13px; text-decoration: none; }
    .page-nav a:hover, .page-nav a[aria-current="page"] { border-color: #d96b43; color: #191919; }
    .hero { display: flex; justify-content: space-between; align-items: end; gap: 30px; padding: 53px 0 40px; border-bottom: 1px solid #cfc8ba; }
    .eyebrow, .section-kicker { margin: 0 0 10px; color: #a1593d; font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1, h2 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; letter-spacing: -.045em; }
    h1 { max-width: 760px; margin: 0; font-size: clamp(39px, 5vw, 65px); line-height: .98; }
    .hero-copy { max-width: 560px; margin: 16px 0 0; color: #6d675e; font-family: Georgia, "Times New Roman", serif; font-size: 19px; line-height: 1.45; }
    .date-note { color: #7b7469; font-size: 12px; white-space: nowrap; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 18px 0 36px; }
    .kpi { min-height: 130px; padding: 18px 20px; border: 1px solid #d7d0c4; border-radius: 7px; background: #efece4; }
    .kpi-label { color: #756d61; font-size: 11px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
    .kpi-value { margin-top: 15px; font: 400 43px/1 Georgia, "Times New Roman", serif; }
    .kpi-note { margin-top: 7px; color: #80786c; font-size: 12px; }
    .kpi-alert .kpi-value { color: #b84a39; } .kpi-warn .kpi-value { color: #a77932; } .kpi-safe .kpi-value { color: #4a6b53; }
    .primary-grid { display: grid; grid-template-columns: 1.42fr .86fr; gap: 14px; align-items: stretch; }
    .panel { border: 1px solid #d0c8bb; border-radius: 7px; background: #fbf9f6; }
    .panel-header { display: flex; align-items: end; justify-content: space-between; gap: 18px; padding: 22px 24px 16px; border-bottom: 1px solid #d0c8bb; }
    .panel-header h2, .advisor-header h2 { margin: 0; font-size: 25px; }
    .panel-meta { color: #82796c; font-size: 12px; }
    .chart-panel { min-height: 330px; }
    .chart { display: flex; align-items: end; justify-content: space-evenly; height: 235px; padding: 28px 27px 0; background: repeating-linear-gradient(to bottom, transparent 0, transparent 57px, #e5dfd4 58px); }
    .chart-group { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: end; height: 100%; gap: 12px; }
    .bars { display: flex; align-items: end; justify-content: center; gap: 5px; width: 100%; height: 190px; }
    .bar { display: block; width: 18px; min-height: 2px; border-radius: 3px 3px 0 0; }
    .bar-incidents { background: #d96b43; } .bar-blocked { background: #b84a39; }
    .chart-label { color: #756d62; font: 11px/1 Inter, sans-serif; text-transform: capitalize; }
    .chart-legend { display: flex; gap: 18px; padding: 0 24px 18px; color: #756d62; font-size: 11px; }
    .legend-item::before { display: inline-block; width: 9px; height: 9px; margin-right: 6px; border-radius: 2px; content: ""; background: #d96b43; } .legend-item.blocked::before { background: #b84a39; }
    .snapshot-panel { padding-bottom: 18px; }
    .snapshot-list { margin: 0; padding: 0 24px; list-style: none; }
    .snapshot-list li { display: flex; justify-content: space-between; gap: 15px; padding: 17px 0; border-bottom: 1px solid #e1dbd1; font-size: 13px; }
    .snapshot-list li:last-child { border-bottom: 0; } .snapshot-list strong { font-family: Georgia, "Times New Roman", serif; font-size: 20px; font-weight: 400; } .snapshot-list span { color: #746d62; text-align: right; }
    .advisor-section { margin-top: 14px; border: 1px solid #c5b9aa; border-radius: 7px; background: #efece4; }
    .advisor-header { display: flex; align-items: start; justify-content: space-between; gap: 20px; padding: 24px; border-bottom: 1px solid #d2c8ba; }
    .section-description { margin: 7px 0 0; color: #71685c; font-family: Georgia, "Times New Roman", serif; font-size: 15px; }
    .advisor-status { display: flex; align-items: center; gap: 8px; color: #4a6b53; font: 12px/1 Inter, sans-serif; white-space: nowrap; }
    .status-indicator { width: 8px; height: 8px; border-radius: 50%; background: #4a6b53; }
    .advisor-grid { display: grid; grid-template-columns: 1.4fr .6fr; gap: 0; }
    .chat-column { min-height: 238px; padding: 20px 24px 22px; border-right: 1px solid #d2c8ba; }
    .chat-empty { display: flex; flex-direction: column; justify-content: center; min-height: 105px; color: #6f675c; font-family: Georgia, "Times New Roman", serif; font-size: 17px; line-height: 1.35; }
    .chat-empty p { margin: 0 0 10px; } .chat-empty-mark { color: #d96b43; font-size: 23px; }
    .chat-empty .mono { color: #8b8174; font-size: 11px; }
    .chat-transcript { display: grid; gap: 10px; margin-bottom: 14px; }
    .chat-message { padding: 11px 13px; border-left: 3px solid #cfc5b6; background: #f8f5ef; } .chat-message p { margin: 4px 0 0; color: #4e4942; font-family: Georgia, "Times New Roman", serif; font-size: 15px; line-height: 1.45; }
    .chat-advisor { border-color: #d96b43; } .chat-label { color: #8e5b45; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .chat-form label { display: block; margin-bottom: 7px; color: #6b6257; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .chat-input-row { display: flex; gap: 8px; } input { width: 100%; min-height: 42px; padding: 0 12px; border: 1px solid #bfb5a7; border-radius: 6px; color: #191919; background: #fbf9f6; font: 14px Inter, sans-serif; } input:focus { outline: 2px solid #d96b43; outline-offset: 1px; }
    .advisor-principles { padding: 22px 24px; } .advisor-principles ul { margin: 13px 0 0; padding-left: 18px; color: #696055; font: 13px/1.65 Georgia, "Times New Roman", serif; } .advisor-principles li { padding: 4px 0; }
    .history-section { margin-top: 36px; } .history-header { display: flex; justify-content: space-between; align-items: end; margin-bottom: 14px; } .history-header h2 { margin: 0; font-size: 29px; } .history-header p { margin: 0; color: #80776b; font-size: 12px; }
    .table-shell { overflow-x: auto; border: 1px solid #d0c8bb; border-radius: 7px; background: #fbf9f6; } table { width: 100%; min-width: 1010px; border-collapse: collapse; text-align: left; } th, td { padding: 14px 16px; border-bottom: 1px solid #e0d9cf; vertical-align: middle; } th { color: #796f62; background: #efece4; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; } td { color: #49443e; font-size: 13px; } tbody tr:hover { background: #f5f0e8; } tbody tr:last-child td { border-bottom: 0; }
    .mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 11px; } .numeric { white-space: nowrap; } .action-name { color: #302d29; font-family: Georgia, "Times New Roman", serif; font-size: 15px; font-weight: 400; } .status { display: inline-block; padding: 5px 8px; border: 1px solid #cfc7ba; border-radius: 6px; font-size: 11px; font-weight: 700; } .status-approved { color: #4a6b53; border-color: #a9b8a9; background: #e8eee8; } .status-blocked { color: #a94435; border-color: #d3a69d; background: #f3e4df; } .status-pending_approval { color: #956e2d; border-color: #d8c194; background: #f5edda; }
    .risk-score strong { font: 400 18px Georgia, "Times New Roman", serif; } .risk-score span { color: #8b8176; font-size: 11px; } .explanation-cell { max-width: 350px; } .advisor-explanation { color: #5f574e; font-family: Georgia, "Times New Roman", serif; line-height: 1.35; } .muted { color: #948a7d; font-size: 11px; }
    .action-controls { display: flex; gap: 6px; } .action-controls form { margin: 0; } .button { min-height: 35px; padding: 0 12px; border: 1px solid transparent; border-radius: 6px; font: 700 12px Inter, sans-serif; cursor: pointer; } .button-primary { border-color: #c05e3a; color: #fffaf5; background: #d96b43; } .button-primary:hover { background: #bd5937; } .button-approve { border-color: #9caf9d; color: #416149; background: #edf2eb; } .button-block { border-color: #d0a39b; color: #a94435; background: #f9e9e5; }
    .empty-state { padding: 42px 16px; color: #82796e; text-align: center; } .empty-state strong, .empty-state span { display: block; } .empty-state strong { margin-bottom: 6px; color: #413c36; font: 18px Georgia, "Times New Roman", serif; }
    .footer-note { margin-top: 28px; padding-top: 16px; border-top: 1px solid #d0c8bb; color: #847b6e; font-size: 11px; }
    @media (max-width: 860px) { main { width: min(100% - 28px, 1320px); padding-top: 20px; } .topbar, .hero, .advisor-header, .history-header { align-items: flex-start; flex-direction: column; } .hero { padding-top: 35px; } .kpi-grid { grid-template-columns: 1fr; } .primary-grid, .advisor-grid { grid-template-columns: 1fr; } .chat-column { border-right: 0; border-bottom: 1px solid #d2c8ba; } .advisor-principles { padding-top: 18px; } .page-nav { width: 100%; justify-content: space-between; } }
  </style>
</head>
<body>
  <main>
    <header class="topbar"><a class="brand" href="/" aria-label="InGravity — cockpit"><span class="brand-mark" aria-label="Mesh topology"><span class="mesh-edge mesh-edge-a"></span><span class="mesh-edge mesh-edge-b"></span><span class="mesh-edge mesh-edge-c"></span><span class="mesh-edge mesh-edge-d"></span><span class="mesh-edge mesh-edge-e"></span><span class="mesh-edge mesh-edge-f"></span><span class="mesh-node mesh-node-center"></span><span class="mesh-node mesh-node-1"></span><span class="mesh-node mesh-node-2"></span><span class="mesh-node mesh-node-3"></span><span class="mesh-node mesh-node-4"></span><span class="mesh-node mesh-node-5"></span></span><span><span class="brand-name">InGravity</span><span class="brand-caption">Security intelligence / local control</span></span></a><nav class="page-nav" aria-label="Navigation principale"><a href="/" aria-current="page">Cockpit</a><a href="/rules">Règles actives</a></nav></header>
    <section class="hero"><div><p class="eyebrow">Security intelligence</p><h1>Une lecture claire des décisions à risque.</h1><p class="hero-copy">InGravity observe les actions proposées par vos agents, applique vos règles et conserve une trace intelligible de chaque choix.</p></div><p class="date-note mono">LIVE / RULE ENGINE + ADVISOR</p></section>
    <section class="kpi-grid" aria-label="Indicateurs clés"><article class="kpi"><span class="kpi-label">Actions évaluées</span><div class="kpi-value">${total}</div><p class="kpi-note">Historique local complet</p></article><article class="kpi kpi-warn"><span class="kpi-label">En attente</span><div class="kpi-value">${pending}</div><p class="kpi-note">Validation humaine requise</p></article><article class="kpi kpi-alert"><span class="kpi-label">Bloquées</span><div class="kpi-value">${blocked}</div><p class="kpi-note">Règle de sécurité déclenchée</p></article></section>
    <section class="primary-grid"><article class="panel chart-panel"><div class="panel-header"><div><p class="section-kicker">Tendance · 7 derniers jours</p><h2>Incidents de sécurité</h2></div><span class="panel-meta mono">${explained} explications Advisor</span></div><div class="chart" aria-label="Tendance des incidents de sécurité">${renderTrendChart(actions)}</div><div class="chart-legend"><span class="legend-item">Décisions à risque</span><span class="legend-item blocked">Blocages</span></div></article><aside class="panel snapshot-panel"><div class="panel-header"><div><p class="section-kicker">Snapshot</p><h2>État du système</h2></div></div><ul class="snapshot-list"><li><strong>${approved}</strong><span>actions approuvées<br>par les règles</span></li><li><strong>${pending + blocked}</strong><span>actions nécessitant<br>une lecture humaine</span></li><li><strong>${escapeHtml(getAdvisorModel())}</strong><span>modèle local<br>Advisor configuré</span></li></ul></aside></section>
    ${renderAdvisorPanel(chat)}
    <section class="history-section" aria-labelledby="history-heading"><div class="history-header"><div><p class="section-kicker">Journal technique</p><h2 id="history-heading">Historique des événements</h2></div><p>Décisions les plus récentes en premier · stockage SQLite local</p></div><div class="table-shell"><table><thead><tr><th>Date / UTC</th><th>Action type</th><th>Montant</th><th>Décision</th><th>Risque</th><th>Lecture Advisor</th><th>Intervention</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <p class="footer-note mono">INGRAVITY / Le moteur de règles décide. Advisor explique. L’exécution reste sous votre contrôle.</p>
  </main>
</body>
</html>`;
}
