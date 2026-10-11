import type { Decision, ActionRule } from "../domain/check-action";
import type { RuleTemplate } from "../config/templates";

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatThreshold(rule: ActionRule): string {
  const conditions: string[] = [];
  if (rule.max_amount !== undefined) {
    conditions.push(`Montant ≤ ${numberFormatter.format(rule.max_amount)}`);
  }
  if (rule.max_sends !== undefined) {
    conditions.push(`${numberFormatter.format(rule.max_sends)} envois maximum`);
  }
  if (rule.sensitive_keywords?.length) {
    conditions.push(
      `Mots sensibles : ${rule.sensitive_keywords.map(escapeHtml).join(", ")}`,
    );
  }
  if (rule.block_at_or_above !== undefined) {
    conditions.push(
      `Blocage dur dès ${numberFormatter.format(rule.block_at_or_above)}`,
    );
  }
  if (conditions.length === 0 && rule.action_if_matched) {
    conditions.push("Règle appliquée à chaque action de ce type");
  }
  return conditions.join("<br>") || "—";
}

function renderRuleRow(rule: ActionRule): string {
  const decision =
    rule.action_if_exceeded ?? rule.action_if_matched ?? "—";
  const decisionClass =
    decision === "—" ? "" : ` decision-${decision}`;

  return `<tr>
    <td class="rule-type">${escapeHtml(rule.action_type)}</td>
    <td>${formatThreshold(rule)}</td>
    <td><span class="decision${decisionClass}">${escapeHtml(decision)}</span></td>
  </tr>`;
}

function renderTemplate(template: RuleTemplate): string {
  return `<article class="template-card">
    <div>
      <h3>${escapeHtml(template.name)}</h3>
      <p>${escapeHtml(template.description)}</p>
    </div>
    <form method="post" action="/rules/templates/${encodeURIComponent(template.id)}/activate">
      <button class="button button-secondary" type="submit">Activer</button>
    </form>
  </article>`;
}

export function renderRulesPage(
  rules: ActionRule[],
  templates: RuleTemplate[],
  message?: string,
): string {
  const rows =
    rules.length === 0
      ? `<tr><td class="empty-state" colspan="3">Aucune règle active. Les actions sans règle sont approuvées par défaut.</td></tr>`
      : rules.map(renderRuleRow).join("");

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Consulter et modifier les règles actives d’InGravity.">
    <link rel="icon" href="data:,">
    <title>InGravity — Règles actives</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #172033;
        background: #f5f7fb;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; }
      main { width: min(1000px, calc(100% - 40px)); margin: 44px auto; }
      header { margin-bottom: 24px; }
      .eyebrow { margin: 0 0 8px; color: #52627a; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 0; color: #101828; font-size: clamp(26px, 4vw, 34px); letter-spacing: -.03em; }
      .intro { margin: 8px 0 0; color: #52627a; font-size: 15px; }
      .page-nav { display: flex; gap: 10px; margin-top: 18px; }
      .page-nav a { display: inline-flex; align-items: center; min-height: 38px; padding: 0 13px; border: 1px solid #d9e1ed; border-radius: 8px; color: #344b74; background: #fff; font-size: 14px; font-weight: 650; text-decoration: none; }
      .page-nav a[aria-current="page"] { color: #fff; border-color: #3157c8; background: #3157c8; }
      .page-nav a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid #314fc4; outline-offset: 2px; }
      .section { margin-top: 22px; padding: 22px; border: 1px solid #e0e6ef; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgb(22 34 51 / 5%); }
      h2 { margin: 0; color: #101828; font-size: 19px; }
      .section-intro { margin: 6px 0 18px; color: #52627a; font-size: 14px; line-height: 1.55; }
      .table-shell { overflow-x: auto; border: 1px solid #e6ebf2; border-radius: 9px; }
      table { width: 100%; border-collapse: collapse; text-align: left; }
      th, td { padding: 13px 15px; border-bottom: 1px solid #edf0f5; vertical-align: top; }
      th { background: #f9fafc; color: #52627a; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
      td { color: #263449; font-size: 14px; line-height: 1.6; }
      tbody tr:last-child td { border-bottom: 0; }
      .rule-type { font-weight: 700; white-space: nowrap; }
      .decision { display: inline-flex; border-radius: 999px; padding: 4px 9px; color: #52627a; background: #eef1f5; font-size: 12px; font-weight: 700; white-space: nowrap; }
      .decision-approved { color: #176b43; background: #e6f6ed; }
      .decision-blocked { color: #a32d35; background: #fdebed; }
      .decision-pending_approval { color: #8a5700; background: #fff3d6; }
      .empty-state { padding: 26px 15px; color: #52627a; text-align: center; }
      .rule-form { display: grid; grid-template-columns: 1.2fr 1fr 1.2fr auto; align-items: end; gap: 12px; }
      label { display: grid; gap: 6px; color: #34435a; font-size: 13px; font-weight: 650; }
      input, select { width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid #cfd8e5; border-radius: 7px; color: #172033; background: #fff; font: inherit; font-size: 14px; }
      .button { min-height: 42px; border: 0; border-radius: 7px; padding: 0 14px; color: #fff; background: #3157c8; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
      .button:hover { background: #2549b3; }
      .button-secondary { color: #3157c8; border: 1px solid #d4def7; background: #f4f7ff; }
      .button-secondary:hover { background: #e8eeff; }
      .form-help { margin: 12px 0 0; color: #66758b; font-size: 13px; line-height: 1.5; }
      .notice { margin: 0 0 20px; padding: 12px 14px; border: 1px solid #b6e2c7; border-radius: 8px; color: #176b43; background: #edfaf2; font-size: 14px; }
      .template-list { display: grid; gap: 10px; }
      .template-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px; border: 1px solid #e6ebf2; border-radius: 9px; }
      .template-card h3 { margin: 0; color: #172033; font-size: 15px; }
      .template-card p { margin: 4px 0 0; color: #66758b; font-size: 13px; line-height: 1.5; }
      .warning { margin: 14px 0 0; color: #8a5700; font-size: 13px; line-height: 1.5; }
      @media (max-width: 760px) {
        main { width: min(100% - 24px, 1000px); margin: 28px auto; }
        .section { padding: 17px; }
        .rule-form { grid-template-columns: 1fr; }
        .rule-form .button { width: 100%; }
        .template-card { align-items: flex-start; flex-direction: column; }
        .template-card form, .template-card .button { width: 100%; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">InGravity</p>
        <h1>Règles actives</h1>
        <p class="intro">Consultez ou modifiez les règles qui contrôlent les décisions du moteur.</p>
        <nav class="page-nav" aria-label="Navigation principale">
          <a href="/">Actions</a>
          <a href="/rules" aria-current="page">Règles actives</a>
        </nav>
      </header>
      ${message ? `<p class="notice" role="status">${escapeHtml(message)}</p>` : ""}
      <section class="section" aria-labelledby="active-rules-heading">
        <h2 id="active-rules-heading">Règles appliquées</h2>
        <p class="section-intro">Ces règles sont enregistrées dans <code>rules.json</code> et utilisées immédiatement par l’API.</p>
        <div class="table-shell">
          <table>
            <thead><tr><th scope="col">Type d’action</th><th scope="col">Seuils</th><th scope="col">Action si dépassé</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
      <section class="section" aria-labelledby="add-rule-heading">
        <h2 id="add-rule-heading">Ajouter ou remplacer une règle</h2>
        <p class="section-intro">Définissez un seuil de montant et la décision à prendre lorsqu’il est dépassé.</p>
        <form class="rule-form" method="post" action="/rules">
          <label for="action_type">Type d’action
            <input id="action_type" name="action_type" type="text" maxlength="100" required autocomplete="off" placeholder="ex. refund">
          </label>
          <label for="max_amount">Seuil de montant
            <input id="max_amount" name="max_amount" type="number" min="0" step="any" required placeholder="ex. 500">
          </label>
          <label for="action_if_exceeded">Action si dépassé
            <select id="action_if_exceeded" name="action_if_exceeded" required>
              <option value="pending_approval">pending_approval</option>
              <option value="blocked">blocked</option>
              <option value="approved">approved</option>
            </select>
          </label>
          <button class="button" type="submit">Enregistrer</button>
        </form>
        <p class="form-help">Si ce type d’action existe déjà, sa règle sera remplacée. Son éventuel seuil de blocage dur est conservé.</p>
      </section>
      <section class="section" aria-labelledby="templates-heading">
        <h2 id="templates-heading">Modèles préconfigurés</h2>
        <p class="section-intro">Activez un modèle pour remplacer les règles actuellement affichées.</p>
        <div class="template-list">${templates.map(renderTemplate).join("")}</div>
        <p class="warning">Attention : l’activation d’un modèle remplace toutes les règles actives.</p>
      </section>
    </main>
  </body>
</html>`;
}
