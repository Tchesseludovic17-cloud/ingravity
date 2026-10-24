import { Router, type Request, type Response } from "express";
import { ruleTemplates } from "../config/templates";
import { activateRuleTemplate } from "../services/rule-management";
import { requireApiKey } from "../middlewares/api-key";

const router = Router();

router.get("/templates", (_req: Request, res: Response): void => {
  res.json({ templates: ruleTemplates });
});

router.post(
  "/templates/:id/activate",
  requireApiKey,
  (req: Request, res: Response): void => {
    const templateId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    if (!templateId) {
      res.status(404).json({ error: "Modèle de règles introuvable." });
      return;
    }

    let template: ReturnType<typeof activateRuleTemplate>;
    try {
      template = activateRuleTemplate(templateId);
    } catch {
      res.status(500).json({
        error: "Impossible d’enregistrer les règles du modèle.",
      });
      return;
    }

    if (!template) {
      res.status(404).json({ error: "Modèle de règles introuvable." });
      return;
    }

    res.json({
      message: `Le modèle « ${template.name} » est activé.`,
      template_id: template.id,
      rules: template.rules,
    });
  },
);

export default router;
