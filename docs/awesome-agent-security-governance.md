# Awesome — sécurité et gouvernance des agents IA

Index curaté pour InGravity des listes GitHub « Awesome » qui couvrent la sécurité des agents IA, la gouvernance runtime, les politiques d’autorisation, les outils/MCP, l’isolation, l’observabilité, l’évaluation et le red teaming.

Cette page a été vérifiée le **28 octobre 2026**. Elle référence des listes de ressources : leur présence ici ne constitue pas une validation indépendante de la sécurité, de la qualité ou de la maturité de chaque projet qu’elles référencent. Les statuts correspondent à l’état observé lors de la vérification.

## Gouvernance runtime et contrôle des agents

### [Awesome AI Agent Governance](https://github.com/systempromptio/awesome-ai-agent-governance)

La liste la plus directement alignée avec le contrôle d’actions InGravity. Elle couvre les toolkits de gouvernance, le moindre privilège, l’autorisation par politiques, les contrôles avant les actions irréversibles, les pistes d’audit, l’observabilité, la maîtrise des coûts, MCP, le red teaming et les preuves de conformité.

### [Awesome Agent Security — basitalisandhu](https://github.com/basitalisandhu/awesome-agent-security)

Ressources sur les contrôles runtime, l’autorisation, les guardrails, les sandboxes, les scanners de serveurs MCP et de skills, l’analyse statique, le red teaming, l’évaluation et les modèles de menace. Très proche de l’architecture d’InGravity.

### [Awesome Agent Security — authora-dev](https://github.com/authora-dev/awesome-agent-security)

Dépôt distinct portant le même nom. Il met l’accent sur l’identité et l’authentification des agents, l’autorisation, les politiques, la coordination multi-agents, l’exécution isolée, la surveillance et les standards.

### [Awesome Agent Skills Security](https://github.com/LLMSecurity/awesome-agent-skills-security)

Curation centrée sur les skills, plugins et outils d’agents. Elle couvre le tool poisoning, les attaques de supply chain, l’escalade de privilèges, l’agence excessive, le contrôle d’accès, la validation des entrées/sorties, le monitoring runtime, le sandboxing et l’évaluation.

## Sécurité agentique, GenAI et MCP

### [Awesome AI Agents Security](https://github.com/ProjectRecon/awesome-ai-agents-security)

Carte du cycle de sécurité des agents autonomes : passerelles et firewalls runtime, red teaming, scanners de vulnérabilités, analyse statique, isolation, guardrails, conformité, identité et authentification.

### [Awesome GenAI Security](https://github.com/jassics/awesome-genai-security)

Liste orientée praticiens couvrant MCP, agents et systèmes multi-agents, identité agentique, observabilité, logging, monitoring, réponse aux incidents, gouvernance, cadres réglementaires, exercices et formations.

### [Awesome AI Security](https://github.com/ottosulin/awesome-ai-security)

Liste généraliste et mature sur la sécurité IA. Sections particulièrement utiles pour InGravity : gouvernance et gestion des risques, red teaming agentique et MCP, benchmarks, contrôles runtime, sandboxing et sécurité MCP.

### [Awesome AI Security Tools](https://github.com/scadastrangelove/awesome-ai-security-tools)

Catalogue d’outils avec des sections dédiées aux agents IA et coding agents, aux scanners et auditeurs, à la protection runtime, à la supply chain IA/ML, aux agents de pentest, au fuzzing LLM, au red teaming et aux guardrails.

### [Awesome AI Security Engineering](https://github.com/GeraldCrescione/awesome-ai-security-engineering)

Liste vendor-neutral organisée autour du cycle Discover, Design, Build, Break, Defend. Elle relie l’inventaire des agents, serveurs MCP et skills aux frontières de confiance, identités, permissions, politiques, tests adversariaux, confinement, réponse runtime et observabilité GenAI.

## Infrastructure, control planes et évaluation

### [Awesome Agent Infra](https://github.com/shenli/awesome-agent-infra)

Ressources sur l’infrastructure qui exécute les agents en production : runtimes, control planes, protocoles d’outils, sandboxing, politiques, sécurité, egress, traces, coûts, évaluations et relecture des exécutions.

### [Awesome LLM Security](https://github.com/corca-ai/awesome-llm-security)

Curation plus orientée sécurité des LLM, mais utile pour les fondations d’InGravity : jailbreaks, prompt injection, attaques white-box et black-box, défenses, benchmarks, outils et ressources de sécurité applicative des agents.

### [Awesome Security for AI](https://github.com/zmre/awesome-security-for-ai) — dépôt archivé

Liste ciblée sur la sécurisation des systèmes GenAI et LLM, avec gouvernance, tests de modèles, red teaming, prompt firewall, redaction, chiffrement, protection des données et QA. Le dépôt est archivé : à conserver comme référence historique, pas comme source active prioritaire.

## Correspondance avec InGravity

Ces listes alimentent directement les axes de veille et de développement d’InGravity :

- **Décision et gouvernance** : politiques, autorisation, moindre privilège, approbation humaine et preuves d’audit.
- **Sécurité des outils** : MCP, skills, plugins, tool poisoning, supply chain et appels dangereux.
- **Contrôle runtime** : gateways, guardrails, sandboxing, isolation, egress et confinement.
- **Sécurité du code et du déploiement** : analyse statique, scanners, secrets, CI/CD, red teaming et vulnérabilités.
- **Mesure et amélioration** : benchmarks, évaluation agentique, observabilité, journaux, incidents et replay.

## Critères d’inclusion

Une liste devait être un dépôt GitHub public explicitement présenté comme une liste « Awesome », une collection curatée ou une liste organisée de ressources. Elle devait couvrir au moins un axe défendu par InGravity : sécurité agentique, gouvernance runtime, politiques et autorisation, MCP/skills/tools, isolation, observabilité, évaluation ou red teaming.

Les dépôts de produits individuels, les listes uniquement consacrées à des publications scientifiques sans ressources opérationnelles et les ressources générales sans rapport direct avec la sécurité ou la gouvernance agentique n’ont pas été inclus.
