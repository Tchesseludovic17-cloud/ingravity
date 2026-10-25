import type { Decision } from "../domain/check-action";
import type { ActionListItem } from "../repositories/action-repository";

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

  return `
    <tr>
      <td><time datetime="${escapeHtml(action.createdAt)}">${formattedTimestamp}</time></td>
      <td class="action-type">${escapeHtml(action.actionType)}</td>
      <td class="numeric">${amount}</td>
      <td><span class="status status-${action.decision}">${decision}</span></td>
      <td class="numeric">${action.riskScore}<span class="score-total"> / 100</span></td>
      <td>${action.explanation ? escapeHtml(action.explanation) : "—"}</td>
      <td>${controls}</td>
    </tr>`;
}

export function renderActionsPage(actions: ActionListItem[]): string {
  const rows =
    actions.length === 0
      ? `<tr><td class="empty-state" colspan="7">Aucune action enregistrée pour l'instant</td></tr>`
      : actions.map(renderActionRow).join("");

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Historique des actions évaluées par InGravity.">
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
      .page-nav a:focus-visible { outline: 3px solid #314fc4; outline-offset: 2px; }
      .table-shell { overflow: hidden; border: 1px solid #e0e6ef; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgb(22 34 51 / 5%); }
      table { width: 100%; border-collapse: collapse; text-align: left; }
      th, td { padding: 15px 18px; border-bottom: 1px solid #edf0f5; }
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
      .button { border: 0; border-radius: 7px; padding: 8px 11px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
      .button:focus-visible { outline: 3px solid #314fc4; outline-offset: 2px; }
      .button-approve { color: #176b43; background: #e6f6ed; }
      .button-approve:hover { background: #d3efdf; }
      .button-block { color: #a32d35; background: #fdebed; }
      .button-block:hover { background: #fbd9dc; }
      .no-action { color: #a1aaba; }
      .empty-state { padding: 36px 18px; color: #52627a; text-align: center; }
      @media (max-width: 680px) {
        main { width: min(100% - 24px, 1100px); margin: 28px auto; }
        .table-shell { overflow-x: auto; }
        table { min-width: 760px; }
        th, td { padding: 13px 12px; }
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
    </main>
  </body>
</html>`;
}
