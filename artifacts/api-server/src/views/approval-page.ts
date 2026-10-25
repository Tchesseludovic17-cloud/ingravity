import type { DurableRuleProposal } from "../services/rule-management";
import type { StoredAction } from "../repositories/action-repository";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderApprovalChoicePage(
  action: StoredAction & { id: number },
  proposal: DurableRuleProposal | undefined,
): string {
  const explanation = action.explanation
    ? `<p><strong>Advisor :</strong> ${escapeHtml(action.explanation)}</p>`
    : `<p><strong>Advisor :</strong> aucune explication locale n’est disponible.</p>`;
  const durable = proposal
    ? `<form method="post" action="/actions/${action.id}/decision">
         <input type="hidden" name="decision" value="approved">
         <input type="hidden" name="approval_scope" value="durable">
         <button type="submit">Proposer un changement durable</button>
       </form>`
    : `<p>Le moteur ne peut pas proposer de modification durable pour cette action.</p>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Advisor — confirmation</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 20px;color:#172033}section{padding:24px;border:1px solid #d9e1ed;border-radius:12px;background:#fff}body{background:#f5f7fb}button{border:0;border-radius:7px;padding:10px 14px;margin:8px 8px 0 0;font-weight:700;cursor:pointer}.once{background:#e6f6ed;color:#176b43}.durable{background:#fff3d6;color:#8a5700}a{color:#3157c8}</style></head>
<body><section><p>InGravity Advisor</p><h1>Avant l’approbation manuelle</h1>
<p>L’action <strong>${escapeHtml(action.actionType)}</strong> est actuellement <strong>${escapeHtml(action.decision)}</strong>.</p>
${explanation}
<h2>Cette approbation est-elle exceptionnelle ou durable&nbsp;?</h2>
<p>Une approbation exceptionnelle ne change pas les règles. Une approbation durable fera seulement l’objet d’une proposition séparée, à confirmer explicitement.</p>
<form method="post" action="/actions/${action.id}/decision"><input type="hidden" name="decision" value="approved"><input type="hidden" name="approval_scope" value="exceptional"><button class="once" type="submit">Exceptionnel — une seule fois</button></form>
${durable}<p><a href="/">Retour aux actions</a></p></section></body></html>`;
}

export function renderDurableProposalPage(
  action: StoredAction & { id: number },
  proposal: DurableRuleProposal,
): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Advisor — proposition</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 20px;color:#172033;background:#f5f7fb}section{padding:24px;border:1px solid #d9e1ed;border-radius:12px;background:#fff}button{border:0;border-radius:7px;padding:10px 14px;background:#3157c8;color:#fff;font-weight:700;cursor:pointer}</style></head><body><section><p>InGravity Advisor</p><h1>Confirmer la modification durable</h1><p>Le moteur de règles n’a pas encore été modifié.</p><p><strong>Proposition :</strong> ${escapeHtml(proposal.summary)}</p><pre>${escapeHtml(JSON.stringify(proposal.proposedRule, null, 2))}</pre><form method="post" action="/actions/${action.id}/decision"><input type="hidden" name="decision" value="approved"><input type="hidden" name="approval_scope" value="durable"><input type="hidden" name="confirm_rule_change" value="yes"><button type="submit">Confirmer et appliquer à rules.json</button></form><p><a href="/">Annuler</a></p></section></body></html>`;
}
