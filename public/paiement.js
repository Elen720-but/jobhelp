// paiement.js
// Redirige l'utilisateur vers WhatsApp avec un message pré-rempli
// précisant le moyen de paiement choisi (virement, PayPal, crypto...).
// Le conseiller communique ensuite les coordonnées exactes et finalise
// la procédure directement sur WhatsApp, pour plus de sécurité.

document.addEventListener("DOMContentLoaded", () => {
  // ----- Numéro WhatsApp de l'entreprise (à personnaliser) -----
  // Format international sans "+" ni espaces, ex: 24100000000
  const WHATSAPP_NUMBER = "33745582358";

  // ----- Boutons "Payer par ..." -----
  const methodButtons = document.querySelectorAll(".btn--whatsapp-method");

  methodButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const method = btn.getAttribute("data-method") || "un moyen de paiement";
      const message = buildPaymentMessage(method);
      const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

      window.open(waUrl, "_blank", "noopener");
    });
  });

  function buildPaymentMessage(method) {
    return (
      `Bonjour, je souhaite régler les services JobBoost.\n` +
      `Moyen de paiement choisi : ${method}\n` +
      `Merci de me communiquer les coordonnées nécessaires pour finaliser le paiement.`
    );
  }
});
