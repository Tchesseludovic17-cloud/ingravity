import { Router, type Request, type Response } from "express";
import { renameSync, writeFileSync } from "node:fs";
import { getRulesPath, replaceActiveRules } from "../config/rules";
import { ruleTemplates } from "../config/templates";

const router = Router();

router.get("/templates", (_req: Request, res: Response): void => {
  res.json({ templates: ruleTemplates });
});

router.post(
  "/templates/:id/activate",
  (req: Request, res: Response): void => {
    const template = ruleTemplates.find(
      (candidate) => candidate.id === req.params.id,
    );
    if (!template) {
      res.status(404).json({ error: "Modèle de règles introuvable." });
      return;
    }

    const rulesPath = getRulesPath();
    const temporaryPath = `${rulesPath}.tmp`;
    try {
      writeFileSync(
        temporaryPath,
        `${JSON.stringify({ rules: template.rules }, null, 2)}\n`,
        "utf8",
      );
      renameSync(temporaryPath, rulesPath);
      replaceActiveRules(template.rules);
    } catch (error) {
      res.status(500).json({
        error: "Impossible d’enregistrer les règles du modèle.",
      });
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
