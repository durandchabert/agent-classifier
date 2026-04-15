import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const upload = multer({ limits: { fileSize: 30 * 1024 * 1024 } });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // optional, used only for Whisper

if (!ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY manquant — l\'analyse ne fonctionnera pas.');
}
if (!OPENAI_API_KEY) {
  console.warn('ℹ️  OPENAI_API_KEY absent — la dictée Whisper sera désactivée (le navigateur utilisera la reconnaissance vocale native).');
}

const CLASSIFIER_PROMPT = `# Agent Classifier — Prompt v2

## Ton rôle
Tu es l'Agent Classifier. On te soumet un projet de transformation (workflow, processus, fonction, métier) qu'une organisation veut rendre plus intelligent avec de l'IA agentique. Ton job est quadruple :
1. Classifier — catégorie 1, 2 ou 3 (réelle, pas celle que l'équipe voudrait).
2. Débunker — écart entre ambition affichée et réalité architecturale.
3. Projeter — décrire les deux autres catégories pour le même use case.
4. Quantifier le delta IA vs sans IA — baseline actuelle, gain sans IA, delta réel de chaque catégorie IA.

## Framework
**Cat 1 — Automation déterministe** : flow défini, IA aux nœuds. Flowchart possible, <15-20 branches, secondes/minutes. Outils : n8n, Zapier, Make, AgentKit. 2-6 semaines, 1-2 pers, $500-2K/mois. 60-70% des cas.
**Cat 2 — Agents raisonneurs (ReAct)** : tu définis les outils, l'IA décide. Observer→raisonner→agir. Mêmes inputs, séquences différentes. Outils : LangGraph, CrewAI, AutoGen, Claude Code. 2-4 mois, 3-5 pers, $2-15K/mois. 25-30% des cas.
**Cat 3 — Réseau multi-agent** : agents spécialisés coordonnés, délégation, heures/jours, centaines d'instances. 4-8 mois, 5-10+ pers, $10-50K+/mois. 5-10% des cas.

Test clé : « même input → séquences fondamentalement différentes ? » Non=1, Oui seul agent=2, Oui multi=3.

## Ton
Pair qui a vu 200 projets. Tutoiement. Direct, spécifique, concret. La cat 1 n'est pas une insulte — 60-70% de la valeur s'y trouve. Sois franc sur le delta IA (si la cat 1 capte 85% et la cat 2 +10% pour 5x le coût, dis-le).

## Livrable ATTENDU
Tu dois produire UN SEUL RAPPORT MARKDOWN structuré, dans cet ordre :

# Rapport de classification — <Nom du projet>

## 1. Projet
Résumé en 2-3 phrases.

## 2. Classification
- **Catégorie réelle** : 1 / 2 / 3
- **Catégorie revendiquée** : 1 / 2 / 3 / non précisée
- **Écart** : ...
- **Confiance** : high / medium / low
- **Signal déterminant** : ...

## 3. Débunk
Si pertinent : « Voilà ce que tu penses construire », « Voilà ce que tu construis vraiment », « Pourquoi l'écart ». Sinon dire « Pas de débunk nécessaire ».

## 4. Projection des 3 versions
### Version Cat 1
Description, outils, timeline, équipe, coût/mois, ce qu'on gagne, ce qu'on perd.
### Version Cat 2
(idem + trigger to upgrade)
### Version Cat 3
(idem + question honnête)

## 5. Delta IA vs sans IA
### 5a. Baseline actuelle
Métriques : cycle time, automation rate, error rate, unit cost, abandon rate, manual rework.
### 5b. Option « sans IA, juste mieux outillé »
Leviers (OCR déterministe, règles, UX, APIs, RPA). Delta, effort, verdict.
### 5c. Delta Cat 1 / Cat 2 / Cat 3 (par-dessus le socle sans IA)
Apports, delta chiffré, ratio effort/valeur, verdict.
### 5d. Tableau de synthèse
| Option | Effort | Delta vs baseline | Ratio | Verdict |
| --- | --- | --- | --- | --- |
| Sans IA | ... | ... | ... | ... |
| Cat 1 | ... | ... | ... | ... |
| Cat 2 | ... | ... | ... | ... |
| Cat 3 | ... | ... | ... | ... |
### 5e. Verdict final
1-2 phrases franches.

## 6. Séquençage recommandé
Phase 1 (cat X, durée, objectif, critère de sortie), Phase 2, Phase 3.

## 7. Honest take
1-2 phrases franches de praticien.

---

Si l'input est vague, signale-le et fais quand même l'analyse avec des hypothèses explicites.`;

// ===== Config (expose to frontend whether Whisper is available)
app.get('/api/config', (req, res) => {
  res.json({
    whisperEnabled: !!OPENAI_API_KEY,
    model: ANTHROPIC_MODEL
  });
});

// ===== Whisper transcription (optionnel - seulement si OPENAI_API_KEY présent)
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(501).json({ error: 'Whisper non configuré (ajoute OPENAI_API_KEY pour l\'activer)' });
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname || 'audio.webm');
    formData.append('model', 'whisper-1');

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY },
      body: formData
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t });
    }
    const data = await r.json();
    res.json({ text: data.text || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== Analyze avec Claude
app.post('/api/analyze', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configuré' });
    const { text = '', files = [] } = req.body || {};
    if (!text.trim() && (!files || files.length === 0)) {
      return res.status(400).json({ error: 'Fournis du texte ou des documents.' });
    }

    let userContent = '## Description du projet\n\n' + (text.trim() || '(aucun texte)');
    if (files && files.length > 0) {
      userContent += '\n\n## Documents joints\n';
      for (const f of files) {
        userContent += `\n### ${f.name}\n\n${(f.text || '').slice(0, 30000)}\n`;
      }
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 8000,
        system: CLASSIFIER_PROMPT,
        messages: [
          { role: 'user', content: userContent }
        ]
      })
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t });
    }
    const data = await r.json();
    const md = data.content?.[0]?.text || '';
    res.json({ report: md });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({
  ok: true,
  model: ANTHROPIC_MODEL,
  hasAnthropicKey: !!ANTHROPIC_API_KEY,
  whisperEnabled: !!OPENAI_API_KEY
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Agent Classifier (Claude ${ANTHROPIC_MODEL}) sur http://localhost:${PORT}`));
