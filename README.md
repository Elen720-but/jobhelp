# JobBoost — Plateforme d'aide à la recherche d'emploi

Site vitrine complet (front-end + back-end) pour accompagner des candidats dans leur recherche d'emploi : présentation des services, formulaire de candidature, enregistrement des données et redirection WhatsApp.

## 🗂️ Structure du projet

```
jobhelp/
├── package.json
├── server.js
├── README.md
├── data/
│   └── candidates.json      (généré automatiquement au premier lancement)
└── public/
    ├── index.html
    ├── style.css
    └── script.js
```

## ⚙️ Prérequis

- [Node.js](https://nodejs.org/) version 16 ou supérieure (inclut npm)

## 🚀 Installation

1. Ouvrez un terminal dans le dossier du projet (`jobhelp/`).
2. Installez les dépendances :

```bash
npm install
```

## ▶️ Lancer le site en local

```bash
npm start
```

Le serveur démarre par défaut sur :

```
http://localhost:3000
```

Ouvrez cette adresse dans votre navigateur pour voir le site.

## 📧 Configuration des emails de confirmation (Gmail)

Le serveur envoie automatiquement **2 emails** après chaque candidature :
- un **email de confirmation** au candidat,
- une **notification** à l'adresse admin.

### Étapes de configuration

1. Copie le fichier `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```

2. **Crée un mot de passe d'application Gmail** (indispensable — ton mot de passe Gmail normal ne fonctionnera pas) :
   - Va sur [myaccount.google.com/security](https://myaccount.google.com/security)
   - Active la **validation en 2 étapes** si ce n'est pas déjà fait (obligatoire)
   - Cherche "Mots de passe des applications" (ou va directement sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords))
   - Crée un mot de passe pour "Mail" / "Autre (nom personnalisé)" → nomme-le par ex. "JobBoost"
   - Google génère un code à 16 caractères (ex : `abcd efgh ijkl mnop`)

3. Remplis ton fichier `.env` :
   ```
   EMAIL_USER=ton.adresse@gmail.com
   EMAIL_PASS=abcd efgh ijkl mnop
   ADMIN_EMAIL=ton.adresse@gmail.com
   ```

4. Relance le serveur (`npm start`). Si tout est bien configuré, tu ne verras plus l'avertissement dans la console.

> ⚠️ Si `EMAIL_USER` / `EMAIL_PASS` ne sont pas renseignés, le site fonctionne quand même normalement (candidatures enregistrées), mais aucun email n'est envoyé — un avertissement s'affiche simplement dans la console du serveur.

> 💡 Gmail limite l'envoi à environ 500 emails/jour sur un compte standard. Si le volume grandit, pense à migrer vers un service comme Resend ou SendGrid.

## 🔧 Personnalisation

- **Numéro WhatsApp** : modifiez la constante `WHATSAPP_NUMBER` dans `public/script.js` (format international sans "+", ex : `24177123456`), ainsi que les liens `https://wa.me/24100000000` dans `public/index.html` (footer + bouton flottant).
- **Couleurs / design** : toutes les couleurs sont définies en haut du fichier `public/style.css` dans le bloc `:root` (variables CSS), faciles à modifier.
- **Textes** : modifiez directement `public/index.html` (titres, témoignages, statistiques...).

## 📡 API disponible

### `POST /api/apply`
Enregistre une nouvelle candidature.

**Corps de la requête (JSON) :**
```json
{
  "fullName": "Vera Nguema",
  "age": 25,
  "address": "Quartier Louis, Libreville",
  "poBox": "BP 1234",
  "availability": "Temps plein",
  "skills": "Vente, Relation client",
  "phone": "+24177123456"
}
```

**Réponse en cas de succès :**
```json
{
  "success": true,
  "message": "Candidature enregistrée avec succès.",
  "candidate": { "...": "..." }
}
```

### `GET /api/candidates`
Retourne la liste de toutes les candidatures enregistrées (utile pour vérifier les données ou construire un futur tableau de bord admin).

## 💾 Stockage des données

Les candidatures sont enregistrées dans `data/candidates.json`, sous forme de tableau JSON. L'écriture est **sécurisée** :
- le fichier est d'abord écrit dans un fichier temporaire (`candidates.json.tmp`),
- puis renommé pour remplacer l'ancien fichier,
- ce qui évite toute corruption de données en cas d'interruption pendant l'écriture.

Chaque candidature comprend un identifiant unique et un horodatage `createdAt`.

## 🛡️ Validation des données

Le serveur valide chaque champ avant enregistrement (nom, âge, adresse, disponibilité, compétences, téléphone). En cas d'erreur, une réponse `400` est renvoyée avec le détail des erreurs, affichées directement dans le formulaire côté client.

## 📱 Redirection WhatsApp

Après l'enregistrement réussi de la candidature, l'utilisateur est automatiquement redirigé vers WhatsApp avec un message pré-rempli reprenant ses informations principales, prêt à être envoyé au conseiller.

## 📦 Déploiement

Ce projet fonctionne sur n'importe quel hébergeur Node.js (Render, Railway, Heroku, VPS, etc.). Pensez à :
- adapter le port via la variable d'environnement `PORT` si nécessaire (déjà géré dans `server.js`),
- vous assurer que le dossier `data/` est bien accessible en écriture sur l'environnement choisi.

---

Développé pour **Vera** — bon lancement pour JobBoost ! 🚀
