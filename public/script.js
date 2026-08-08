// script.js
// Gère : le menu mobile, la soumission du formulaire de candidature,
// l'appel à l'API back-end (/api/apply), et la redirection WhatsApp.

document.addEventListener("DOMContentLoaded", () => {
  // ----- Année dynamique dans le footer -----
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ----- Menu burger (mobile) -----
  const burgerBtn = document.getElementById("burgerBtn");
  const navLinks = document.getElementById("navLinks");

  if (burgerBtn && navLinks) {
    burgerBtn.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });

    // Ferme le menu après clic sur un lien (mobile)
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => navLinks.classList.remove("active"));
    });
  }

  // ----- Numéro WhatsApp de l'entreprise (à personnaliser) -----
  // Format international sans "+" ni espaces, ex: 24100000000
  const WHATSAPP_NUMBER = "33745582358";

  // ----- Gestion du formulaire -----
  const form = document.getElementById("applyForm");
  const formMessage = document.getElementById("formMessage");
  const submitBtn = document.getElementById("submitBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage("", "");

  const fileInput = document.getElementById("idDocument");
  const data = {
    fullName: form.fullName.value.trim(),
    age: form.age.value.trim(),
    address: form.address.value.trim(),
    poBox: form.poBox.value.trim(),
    availability: form.availability.value,
    skills: form.skills.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
  };

  // Validation basique côté client
  const clientErrors = validateClient(data);
  if (!fileInput.files[0]) {
    clientErrors.push("Merci de joindre une pièce d'identité.");
  } else if (fileInput.files[0].size > 5 * 1024 * 1024) {
    clientErrors.push("Le fichier ne doit pas dépasser 5 Mo.");
  }

  if (clientErrors.length > 0) {
    setMessage(clientErrors.join(" "), "error");
    return;
  }

  toggleLoading(true);

  // Construction du FormData (texte + fichier)
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => formData.append(key, value));
  formData.append("idDocument", fileInput.files[0]);

  try {
    const response = await fetch("/api/apply", {
      method: "POST",
      body: formData, // pas de header Content-Type : le navigateur le gère automatiquement
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      const errorText =
        result.errors && result.errors.length
          ? result.errors.join(" ")
          : result.message || "Une erreur est survenue.";
      setMessage(errorText, "error");
      toggleLoading(false);
      return;
    }

    setMessage("✅ Candidature enregistrée ! Redirection vers WhatsApp...", "success");
    form.reset();

    const waMessage = buildWhatsAppMessage(data);
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

    setTimeout(() => {
      window.location.href = waUrl;
    }, 1200);
  } catch (err) {
    console.error("Erreur réseau :", err);
    setMessage("Impossible de contacter le serveur. Vérifiez votre connexion.", "error");
    toggleLoading(false);
  }
});

  // ----- Fonctions utilitaires -----

  function validateClient(data) {
    const errors = [];
    if (!data.fullName || data.fullName.length < 2) {
      errors.push("Merci de renseigner votre nom complet.");
    }
    const age = Number(data.age);
    if (!data.age || isNaN(age) || age < 14 || age > 99) {
      errors.push("Merci de renseigner un âge valide (14-99).");
    }
    if (!data.address) {
      errors.push("Merci de renseigner votre adresse.");
    }
    if (!data.availability) {
      errors.push("Merci de choisir une disponibilité.");
    }
    if (!data.skills) {
      errors.push("Merci de renseigner vos compétences.");
    }
    const phoneRegex = /^[0-9+\s().-]{6,20}$/;
    if (!data.phone || !phoneRegex.test(data.phone)) {
      errors.push("Merci de renseigner un numéro de téléphone valide.");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push("Merci de renseigner une adresse email valide.");
    }
    return errors;
  }

  function setMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = "form-message" + (type ? " " + type : "");
  }

  function toggleLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Envoi en cours..." : "Envoyer ma candidature";
  }

  function buildWhatsAppMessage(data) {
    return (
      `Bonjour, je viens de remplir le formulaire de candidature sur JobBoost.\n\n` +
      `Nom : ${data.fullName}\n` +
      `Âge : ${data.age}\n` +
      `Disponibilité : ${data.availability}\n` +
      `Compétences : ${data.skills}\n\n` +
      `Merci de me recontacter pour la suite du processus.`
    );
  }
});
