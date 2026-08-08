/**
 * server.js
 * Serveur back-end pour la plateforme d'aide à la recherche d'emploi.
 * - Sert les fichiers statiques du dossier /public
 * - Expose une route POST /api/apply qui valide et enregistre les candidatures
 * - Stockage dans un fichier JSON (data/candidates.json) avec écriture sécurisée
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
    "⚠️  EMAIL_USER / EMAIL_PASS non configurés (.env). Les emails de confirmation seront désactivés."
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
      `<p>Bonjour <strong>${candidate.fullName}</strong>,</p>` +
      `<p>Nous avons bien reçu votre candidature sur <strong>JobBoost</strong>.</p>` +
      `<p><strong>Récapitulatif :</strong><br/>` +
      `Disponibilité : ${candidate.availability}<br/>` +
      `Compétences : ${candidate.skills}</p>` +
      `<p>Un conseiller vous contactera très prochainement sur WhatsApp au <strong>${candidate.phone}</strong>.</p>` +
      `<p>À très bientôt,<br/>L'équipe JobBoost</p>`,
  });
}

// Envoie une notification à l'administrateur
async function sendAdminNotification(candidate) {
  if (!emailEnabled) return;
  await transporter.sendMail({
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
  });
}

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "candidates.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Crée le dossier uploads s'il n'existe pas
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `id-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
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
  const errors = validateApplication(req.body, req);

  const {
    fullName,
    age,
    address,
    poBox,
    availability,
    skills,
    phone,
    email,
  } = body;

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

function handleApplication(req, res) {

  const {
    fullName,
    age,
    address,
    poBox,
    availability,
    skills,
    phone,
    email,
  } = req.body;

  const newCandidate = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    fullName: fullName.trim(),
    age: Number(age),
    address: address.trim(),
    poBox: poBox ? poBox.trim() : "",
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

    // On répond tout de suite à l'utilisateur : les emails partent en tâche de fond
    // et ne bloquent pas la redirection WhatsApp côté client.
    res.status(201).json({
      success: true,
      message: "Candidature enregistrée avec succès.",
      candidate: newCandidate,
    });

    // Envoi des emails (candidat + admin) sans bloquer la réponse HTTP
    Promise.all([
      sendCandidateConfirmation(newCandidate),
      sendAdminNotification(newCandidate),
    ]).catch((err) => {
      console.error("⚠️ Erreur lors de l'envoi des emails :", err.message);
    });
  } catch (err) {
    console.error("Erreur lors de l'enregistrement de la candidature :", err);
    return res.status(500).json({
      success: false,
      message: "Erreur interne du serveur. Veuillez réessayer.",
    });
  }
}

// GET /api/candidates : liste toutes les candidatures (utile pour l'administration/tests)
app.get("/api/candidates", (req, res) => {
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
ensureDataFile();
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
