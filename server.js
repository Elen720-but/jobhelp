/**
 * server.js
 * Serveur back-end pour la plateforme d'aide à la recherche d'emploi.
 * - Sert les fichiers statiques du dossier /public
 * - Expose une route POST /api/apply qui valide et enregistre les candidatures
 * - Stockage dans un fichier JSON (data/candidates.json)
 *
 * Compatible Vercel : sur Vercel, seul /tmp est inscriptible (et temporaire).
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration de l'envoi d'emails (Gmail) ---
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || EMAIL_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const emailEnabled = Boolean(EMAIL_USER && EMAIL_PASS);

let transporter = null;
if (emailEnabled) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
} else {
  console.warn(
    "⚠️  EMAIL_USER / EMAIL_PASS non configurés. Les emails de confirmation seront désactivés."
  );
}

// Envoie un email de confirmation au candidat
async function sendCandidateConfirmation(candidate) {
  if (!emailEnabled) return;
  await transporter.sendMail({
    from: `"JobBoost" <${EMAIL_USER}>`,
    to: candidate.email,
    subject: "Votre candidature JobBoost a bien été reçue ✅",
    text:
      `Bonjour ${candidate.fullName},\n\n` +
      `Nous avons bien reçu votre candidature sur JobBoost.\n\n` +
      `Récapitulatif :\n` +
      `- Disponibilité : ${candidate.availability}\n` +
      `- Compétences : ${candidate.skills}\n\n` +
      `Un conseiller vous contactera très prochainement sur WhatsApp au ${candidate.phone}.\n\n` +
      `À très bientôt,\nL'équipe JobBoost`,
    html:
      `<p>Bonjour <strong>${escapeHtml(candidate.fullName)}</strong>,</p>` +
      `<p>Nous avons bien reçu votre candidature sur <strong>JobBoost</strong>.</p>` +
      `<p><strong>Récapitulatif :</strong><br/>` +
      `Disponibilité : ${escapeHtml(candidate.availability)}<br/>` +
      `Compétences : ${escapeHtml(candidate.skills)}</p>` +
      `<p>Un conseiller vous contactera très prochainement sur WhatsApp au <strong>${escapeHtml(candidate.phone)}</strong>.</p>` +
      `<p>À très bientôt,<br/>L'équipe JobBoost</p>`,
  });
}

// Envoie une notification à l'administrateur (avec la pièce d'identité en pièce jointe,
// car le stockage sur Vercel est temporaire)
async function sendAdminNotification(candidate, filePath) {
  if (!emailEnabled) return;
  const mail = {
    from: `"JobBoost - Notifications" <${EMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: `📩 Nouvelle candidature : ${candidate.fullName}`,
    text:
      `Nouvelle candidature reçue :\n\n` +
      `Nom : ${candidate.fullName}\n` +
      `Âge : ${candidate.age}\n` +
      `Adresse : ${candidate.address}\n` +
      `Boîte postale : ${candidate.poBox || "-"}\n` +
      `Disponibilité : ${candidate.availability}\n` +
      `Compétences : ${candidate.skills}\n` +
      `Téléphone : ${candidate.phone}\n` +
      `Email : ${candidate.email}\n` +
      `Reçue le : ${candidate.createdAt}`,
  };
  if (filePath && fs.existsSync(filePath)) {
    mail.attachments = [{ filename: candidate.idDocument, path: filePath }];
  }
  await transporter.sendMail(mail);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Chemins de stockage ---
// Sur Vercel, le système de fichiers est en lecture seule sauf /tmp
const IS_VERCEL = Boolean(process.env.VERCEL);
const WRITABLE_DIR = IS_VERCEL ? "/tmp" : __dirname;

const DATA_DIR = path.join(WRITABLE_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "candidates.json");
const UPLOADS_DIR = path.join(WRITABLE_DIR, "uploads");

// Crée le dossier uploads s'il n'existe pas (sans jamais faire planter le démarrage)
try {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (err) {
  console.error("Impossible de créer le dossier uploads :", err.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    } catch (e) {
      // ignoré : multer renverra l'erreur si le dossier est inutilisable
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `id-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 Mo max (Vercel limite le corps des requêtes à ~4,5 Mo)
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format de fichier non autorisé (JPG, PNG ou PDF uniquement)."));
    }
  },
});

// --- Middlewares ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Utilitaires de stockage ---

// S'assure que le dossier et le fichier de données existent
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

// Lecture sécurisée du fichier JSON
function readCandidates() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("Erreur de lecture du fichier de données :", err);
    return [];
  }
}

// Écriture sécurisée (écriture atomique via fichier temporaire puis renommage)
function writeCandidates(candidates) {
  ensureDataFile();
  const tmpFile = DATA_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(candidates, null, 2), "utf8");
  fs.renameSync(tmpFile, DATA_FILE);
}

// --- Validation des champs ---
function validateApplication(body, req) {
  const errors = [];

  const { fullName, age, address, availability, skills, phone, email } = body || {};

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    errors.push("Le nom complet est requis (2 caractères minimum).");
  }

  const ageNum = Number(age);
  if (!age || isNaN(ageNum) || ageNum < 16 || ageNum > 99) {
    errors.push("L'âge doit être un nombre valide compris entre 16 et 99.");
  }

  if (!address || typeof address !== "string" || address.trim().length < 3) {
    errors.push("L'adresse physique est requise.");
  }

  if (!availability || typeof availability !== "string") {
    errors.push("Les heures de disponibilité sont requises.");
  }

  if (!skills || typeof skills !== "string" || skills.trim().length < 2) {
    errors.push("Les compétences / domaine d'intérêt sont requis.");
  }

  const phoneRegex = /^[0-9+\s().-]{6,20}$/;
  if (!phone || !phoneRegex.test(phone)) {
    errors.push("Le numéro WhatsApp / téléphone est invalide.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push("L'adresse email est invalide.");
  }

  if (!req.file) {
    errors.push("La pièce d'identité est requise.");
  }

  return errors;
}

// --- Routes API ---

// POST /api/apply : enregistre une nouvelle candidature
app.post("/api/apply", (req, res) => {
  upload.single("idDocument")(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({
        success: false,
        message: uploadErr.message || "Erreur lors de l'envoi du fichier.",
      });
    }
    handleApplication(req, res);
  });
});

async function handleApplication(req, res) {
  const errors = validateApplication(req.body, req);
  if (errors.length > 0) {
    // On supprime le fichier uploadé si la candidature est refusée
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      success: false,
      message: errors.join(" "),
      errors,
    });
  }

  const { fullName, age, address, poBox, availability, skills, phone, email } = req.body;

  const newCandidate = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    fullName: fullName.trim(),
    age: Number(age),
    address: address.trim(),
    poBox: poBox ? String(poBox).trim() : "",
    availability: availability.trim(),
    skills: skills.trim(),
    phone: phone.trim(),
    email: email.trim(),
    createdAt: new Date().toISOString(),
    idDocument: req.file ? req.file.filename : null,
  };

  try {
    const candidates = readCandidates();
    candidates.push(newCandidate);
    writeCandidates(candidates);
  } catch (err) {
    console.error("Erreur lors de l'enregistrement de la candidature :", err);
    return res.status(500).json({
      success: false,
      message: "Erreur interne du serveur. Veuillez réessayer.",
    });
  }

  // Sur Vercel, le code lancé après la réponse peut être interrompu :
  // on envoie donc les emails AVANT de répondre. Une erreur d'email ne bloque pas la candidature.
  try {
    await Promise.all([
      sendCandidateConfirmation(newCandidate),
      sendAdminNotification(newCandidate, req.file ? req.file.path : null),
    ]);
  } catch (err) {
    console.error("⚠️ Erreur lors de l'envoi des emails :", err.message);
  }

  return res.status(201).json({
    success: true,
    message: "Candidature enregistrée avec succès.",
    candidate: newCandidate,
  });
}

// GET /api/candidates : protégé par mot de passe administrateur
// Utilisation : en-tête HTTP "x-admin-password: <ADMIN_PASSWORD>"
// Désactivée tant que ADMIN_PASSWORD n'est pas défini.
app.get("/api/candidates", (req, res) => {
  if (!ADMIN_PASSWORD || req.get("x-admin-password") !== ADMIN_PASSWORD) {
    return res.status(403).json({ success: false, message: "Accès refusé." });
  }
  try {
    const candidates = readCandidates();
    return res.json({ success: true, count: candidates.length, candidates });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// Route de secours : redirige tout le reste vers la page d'accueil
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Démarrage du serveur ---
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
}