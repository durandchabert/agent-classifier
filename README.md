# Agent Classifier

Interface élégante pour classifier un projet de transformation IA en catégorie 1, 2 ou 3 (framework Lenny Rachitsky / Farooq / Rajwani).

- 🎙️ Dictée vocale (Whisper)
- 📎 Upload de documents (PDF, TXT, MD)
- 📝 Zone texte libre
- 📊 Rapport structuré (copy / download / print PDF)
- 🔒 Clé API côté serveur uniquement — jamais exposée au navigateur

## Déploiement sur Render (recommandé, ~3 min)

1. **Crée un repo GitHub** avec le contenu de ce dossier :
   ```bash
   cd "Agent Classificator/app"
   git init
   git add .
   git commit -m "Agent Classifier"
   git remote add origin https://github.com/TON_USER/agent-classifier.git
   git push -u origin main
   ```

2. **Va sur [render.com](https://render.com)** → *New* → *Blueprint* → connecte ton repo.
   Render détecte automatiquement `render.yaml`.

3. **Ajoute la variable d'environnement** `OPENAI_API_KEY` avec ta clé `sk-...`
   (Dashboard → ton service → *Environment* → *Add Environment Variable*).

4. **Deploy** → ton app est en ligne sur `https://agent-classifier-xxx.onrender.com`.

## Déploiement sur Vercel

```bash
npm i -g vercel
vercel
# ajoute OPENAI_API_KEY dans Settings → Environment Variables
```

## Local (dev)

```bash
cd app
npm install
OPENAI_API_KEY=sk-... npm start
# → http://localhost:3000
```

## Sécurité

- La clé OpenAI vit uniquement dans les variables d'environnement du serveur.
- Le navigateur appelle `/api/transcribe` et `/api/analyze` — il ne voit jamais la clé.
- **⚠️ Important** : si tu as partagé ta clé OpenAI dans un chat, **révoque-la** dans [platform.openai.com/api-keys](https://platform.openai.com/api-keys) et génère-en une nouvelle pour le déploiement.
