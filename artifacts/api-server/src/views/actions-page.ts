import type { Decision } from "../domain/check-action";
import type { ActionListItem } from "../repositories/action-repository";
import { getAdvisorModel } from "../services/advisor";

const decisionLabels: Record<Decision, string> = {
  approved: "approved",
  blocked: "blocked",
  pending_approval: "pending_approval",
};

const amountFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
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
      : `<span class="no-action" aria-label="Aucune action manuelle nécessaire">—</span>`;

  return `<tr>
      <td><time datetime="${escapeHtml(action.createdAt)}">${formattedTimestamp}</time></td>
      <td class="action-type">${escapeHtml(action.actionType)}</td>
      <td class="numeric">${amount}</td>
      <td><span class="status status-${action.decision}">${decision}</span></td>
      <td class="numeric">${action.riskScore}<span class="score-total"> / 100</span></td>
      <td>${action.explanation ? escapeHtml(action.explanation) : "—"}</td>
      <td>${controls}</td>
    </tr>`;
}

function renderAdvisorPanel(chat: AdvisorChatState | undefined): string {
  const transcript = chat
    ? `<div class="chat-transcript" aria-live="polite">
        <div class="chat-message chat-user"><strong>Vous</strong><p>${escapeHtml(chat.question)}</p></div>
        <div class="chat-message chat-advisor"><strong>Advisor</strong><p>${chat.answer ? escapeHtml(chat.answer) : "Ollama est indisponible pour le moment. Le moteur de règles continue de fonctionner normalement."}</p></div>
      </div>`
    : `<div class="chat-empty">Posez une question sur une décision, une règle active ou l’historique récent.<br><span>Exemple : « Pourquoi cette action est-elle bloquée ? »</span></div>`;

  return `<section class="section advisor-section" aria-labelledby="advisor-heading">
        <div class="advisor-heading-row">
          <div>
            <h2 id="advisor-heading">Ask Advisor</h2>
            <p class="section-intro">Centre de discussion local pour comprendre les décisions du moteur de règles.</p>
          </div>
          <span class="advisor-status"><span class="status-dot"></span>Ollama · ${escapeHtml(getAdvisorModel())}</span>
        </div>
        ${transcript}
        <form class="advisor-form" method="post" action="/advisor/chat">
          <label for="advisor-question">Votre question
            <input id="advisor-question" name="question" type="text" maxlength="1000" required autocomplete="off" placeholder="Écrivez votre question à Advisor…">
          </label>
          <button class="button" type="submit">Envoyer</button>
        </form>
        <p class="form-help">Advisor explique après la décision du moteur. Il ne modifie pas les règles et ne décide jamais à sa place.</p>
      </section>`;
}

export function renderActionsPage(
  actions: ActionListItem[],
  chat?: AdvisorChatState,
): string {
  const rows =
    actions.length === 0
      ? `<tr><td class="empty-state" colspan="7">Aucune action enregistrée pour l'instant</td></tr>`
      : actions.map(renderActionRow).join("");

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Historique des actions évaluées par InGravity et centre de discussion Advisor.">
    <link rel="icon" href="data:,">
    <title>InGravity — Actions</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #172033;
        background: #f5f7fb;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; }
      main { width: min(1100px, calc(100% - 40px)); margin: 48px auto; }
      header { margin-bottom: 24px; }
      .eyebrow { margin: 0 0 8px; color: #52627a; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 0; color: #101828; font-size: clamp(26px, 4vw, 34px); letter-spacing: -.03em; }
      .intro { margin: 8px 0 0; color: #52627a; font-size: 15px; }
      .page-nav { display: flex; gap: 10px; margin-top: 18px; }
      .page-nav a { display: inline-flex; align-items: center; min-height: 38px; padding: 0 13px; border: 1px solid #d9e1ed; border-radius: 8px; color: #344b74; background: #fff; font-size: 14px; font-weight: 650; text-decoration: none; }
      .page-nav a[aria-current="page"] { color: #fff; border-color: #3157c8; background: #3157c8; }
      .page-nav a:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid #314fc4; outline-offset: 2px; }
      .section { margin-top: 22px; padding: 22px; border: 1px solid #e0e6ef; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgb(22 34 51 / 5%); }
      .table-shell { overflow: hidden; border: 1px solid #e0e6ef; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgb(22 34 51 / 5%); }
      table { width: 100%; border-collapse: collapse; text-align: left; }
      th, td { padding: 15px 18px; border-bottom: 1px solid #edf0f5; vertical-align: middle; }
      th { background: #f9fafc; color: #52627a; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
      td { color: #263449; font-size: 14px; }
      tbody tr:last-child td { border-bottom: 0; }
      .action-type { font-weight: 600; }
      .numeric { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .status { display: inline-flex; border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 700; white-space: nowrap; }
      .status-approved { color: #176b43; background: #e6f6ed; }
      .status-blocked { color: #a32d35; background: #fdebed; }
      .status-pending_approval { color: #8a5700; background: #fff3d6; }
      .score-total { color: #78869a; }
      .action-controls { display: flex; gap: 8px; }
      .action-controls form { margin: 0; }
      .button { min-height: 42px; border: 0; border-radius: 7px; padding: 0 14px; color: #fff; background: #3157c8; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
      .button:hover { background: #2549b3; }
      .button-approve { min-height: 34px; color: #176b43; background: #e6f6ed; font-size: 13px; }
      .button-approve:hover { background: #d3efdf; }
      .button-block { min-height: 34px; color: #a32d35; background: #fdebed; font-size: 13px; }
      .button-block:hover { background: #fbd9dc; }
      .no-action { color: #a1aaba; }
      .empty-state { padding: 36px 18px; color: #52627a; text-align: center; }
      .advisor-heading-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
      h2 { margin: 0; color: #101828; font-size: 19px; }
      .section-intro { margin: 6px 0 18px; color: #52627a; font-size: 14px; line-height: 1.55; }
      .advisor-status { display: inline-flex; align-items: center; gap: 7px; color: #52627a; font-size: 12px; white-space: nowrap; }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #3157c8; }
      .chat-empty, .chat-message { border: 1px solid #e0e6ef; border-radius: 9px; background: #f9fafc; }
      .chat-empty { padding: 18px; color: #52627a; font-size: 14px; line-height: 1.6; }
      .chat-empty span { color: #78869a; font-size: 13px; }
      .chat-transcript { display: grid; gap: 10px; margin-bottom: 16px; }
      .chat-message { padding: 12px 14px; color: #263449; }
      .chat-message strong { display: block; color: #344b74; font-size: 12px; }
      .chat-message p { margin: 5px 0 0; line-height: 1.55; white-space: pre-wrap; }
      .chat-advisor { border-color: #c9d5f2; background: #f4f7ff; }
      .advisor-form { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 12px; margin-top: 16px; }
      label { display: grid; gap: 6px; color: #34435a; font-size: 13px; font-weight: 650; }
      input { width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid #cfd8e5; border-radius: 7px; color: #172033; background: #fff; font: inherit; font-size: 14px; }
      .form-help { margin: 12px 0 0; color: #66758b; font-size: 13px; line-height: 1.5; }
      @media (max-width: 680px) {
        main { width: min(100% - 24px, 1100px); margin: 28px auto; }
        .table-shell { overflow-x: auto; }
        table { min-width: 760px; }
        th, td { padding: 13px 12px; }
        .advisor-heading-row, .advisor-form { display: grid; grid-template-columns: 1fr; }
        .advisor-form .button { width: 100%; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">InGravity</p>
        <h1>Actions enregistrées</h1>
        <p class="intro">Historique des décisions prises par le moteur de règles.</p>
        <nav class="page-nav" aria-label="Navigation principale">
          <a href="/" aria-current="page">Actions</a>
          <a href="/rules">Règles actives</a>
        </nav>
      </header>
      <section class="table-shell" aria-label="Liste des actions">
        <table>
          <thead>
            <tr>
              <th scope="col">Date et heure (UTC)</th>
              <th scope="col">Type d'action</th>
              <th scope="col">Montant</th>
              <th scope="col">Décision</th>
              <th scope="col">Score de risque</th>
              <th scope="col">Explication Advisor</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>
      </section>
      ${renderAdvisorPanel(chat)}
    </main>
  </body>
</html>`;
}
