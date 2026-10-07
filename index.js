/**
 * Fusión Peluquería – avisos automáticos por WhatsApp (Cloud API de Meta)
 *
 * Qué hace:
 *  1. Turno nuevo desde la web  -> confirmación al cliente + aviso al salón
 *  2. Turno cancelado           -> aviso al cliente + aviso al salón
 *  3. Turno cambiado de día/hora/profesional -> aviso al cliente + aviso al salón
 *  4. Todos los días 18:00      -> recordatorio a los clientes que tienen turno mañana
 *
 * Colecciones que usa (las mismas de turnos.html / admin.html):
 *  turnos { cliente, tel, fecha:'YYYY-MM-DD', hora:'HH:MM', profesionalId, servicioId, estado, creadoEn, updatedAt }
 *  profesionales { nombre }   servicios { nombre }
 */
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// IMPORTANTE: la región debe coincidir con la ubicación de tu base Firestore.
// Si tu Firestore está en otra región, cambiala acá (ver LEEME-WHATSAPP.md).
setGlobalOptions({ region: "us-central1", maxInstances: 5 });

// ── Configuración (se pide al hacer deploy; el token va como secreto) ──
const WA_TOKEN = defineSecret("WA_TOKEN");                 // token permanente de Meta
const WA_PHONE_ID = defineString("WA_PHONE_ID");           // ID del número en Meta (no es el teléfono)
const SITE_URL = defineString("SITE_URL", { default: "https://TUDOMINIO.com/turnos.html" });
const SALON_AVISO_TEL = defineString("SALON_AVISO_TEL", { default: "" }); // a quién le llegan los avisos del salón
const API_VERSION = defineString("WA_API_VERSION", { default: "v23.0" });

const TZ = "America/Argentina/Buenos_Aires";
const LANG = "es_AR";

// Nombres de las plantillas (deben coincidir con las que apruebe Meta)
const PLANTILLAS = {
  confirmacion: "turno_confirmacion",
  recordatorio: "turno_recordatorio",
  cancelado: "turno_cancelado",
  modificado: "turno_modificado",
  salon: "aviso_salon",
};

// ── Utilidades ──
const limpiar = (s) => String(s ?? "").replace(/\s+/g, " ").trim(); // Meta no admite saltos de línea en variables

// Misma lógica que usa tu sitio: deja el número como 549 + área + número
function normalizarTel(tel) {
  const n = String(tel || "").replace(/\D/g, "");
  if (!n) return "";
  return n.startsWith("54") ? n : `549${n.replace(/^0/, "")}`;
}

function fechaLinda(fecha) {
  const d = new Date(`${fecha}T12:00:00-03:00`);
  return d
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })
    .replace(",", ""); // "martes 6 de octubre"
}

function fechaISO(diasDesdeHoy = 0) {
  const d = new Date(Date.now() + diasDesdeHoy * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
}

async function datosTurno(t) {
  const [p, s] = await Promise.all([
    t.profesionalId ? db.doc(`profesionales/${t.profesionalId}`).get() : null,
    t.servicioId ? db.doc(`servicios/${t.servicioId}`).get() : null,
  ]);
  return {
    prof: p?.data()?.nombre || "tu profesional",
    srv: s?.data()?.nombre || "tu servicio",
  };
}

async function enviarPlantilla(to, plantilla, variables) {
  if (!to) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION.value()}/${WA_PHONE_ID.value()}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_TOKEN.value()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: plantilla,
          language: { code: LANG },
          components: [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: limpiar(v) })) }],
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      logger.error("WhatsApp rechazó el mensaje", { to, plantilla, error: data.error });
      return false;
    }
    logger.info("WhatsApp enviado", { to, plantilla, id: data.messages?.[0]?.id });
    return true;
  } catch (e) {
    logger.error("Error enviando WhatsApp", { to, plantilla, e: String(e) });
    return false;
  }
}

// Evita mensajes duplicados si Firebase reintenta el mismo evento
async function primeraVez(eventId) {
  try {
    await db.doc(`wa_log/${eventId}`).create({ en: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  } catch (e) {
    return false;
  }
}

const linkTurno = (id) => `${SITE_URL.value()}?turno=${id}`;

async function avisarSalon(tipo, t, d) {
  const to = normalizarTel(SALON_AVISO_TEL.value());
  if (!to) return;
  await enviarPlantilla(to, PLANTILLAS.salon, [
    tipo,
    t.cliente || "Sin nombre",
    t.tel || "sin teléfono",
    d.srv,
    d.prof,
    `${fechaLinda(t.fecha)} ${t.hora} hs`,
  ]);
}

// ── 1) Turno nuevo ──
exports.alCrearTurno = onDocumentCreated(
  { document: "turnos/{id}", secrets: [WA_TOKEN] },
  async (event) => {
    if (!(await primeraVez(event.id))) return;
    const t = event.data?.data();
    if (!t || t.estado === "cancelado") return;
    const d = await datosTurno(t);

    await enviarPlantilla(normalizarTel(t.tel), PLANTILLAS.confirmacion, [
      t.cliente, d.srv, d.prof, fechaLinda(t.fecha), t.hora, linkTurno(event.params.id),
    ]);

    // Los turnos que carga el admin traen "updatedAt"; los de la web no.
    // Así no te avisamos de los turnos que cargás vos misma.
    if (!("updatedAt" in t)) await avisarSalon("🗓 Nueva reserva", t, d);
  }
);

// ── 2 y 3) Turno cancelado o modificado ──
exports.alCambiarTurno = onDocumentUpdated(
  { document: "turnos/{id}", secrets: [WA_TOKEN] },
  async (event) => {
    if (!(await primeraVez(event.id))) return;
    const antes = event.data?.before.data();
    const despues = event.data?.after.data();
    if (!antes || !despues) return;

    const seCancelo = antes.estado !== "cancelado" && despues.estado === "cancelado";
    const seMovio =
      despues.estado !== "cancelado" &&
      (antes.fecha !== despues.fecha || antes.hora !== despues.hora || antes.profesionalId !== despues.profesionalId);
    if (!seCancelo && !seMovio) return; // cambios de notas, recordatorioEnviado, etc.: no se avisa

    const d = await datosTurno(despues);
    const to = normalizarTel(despues.tel);

    if (seCancelo) {
      await enviarPlantilla(to, PLANTILLAS.cancelado, [despues.cliente, d.srv, fechaLinda(antes.fecha), antes.hora, SITE_URL.value()]);
      await avisarSalon("❌ Turno cancelado", antes, d);
    } else {
      await enviarPlantilla(to, PLANTILLAS.modificado, [
        despues.cliente, d.srv, d.prof, fechaLinda(despues.fecha), despues.hora, linkTurno(event.params.id),
      ]);
      await avisarSalon("🔄 Turno modificado", despues, d);
    }
  }
);

// ── 4) Recordatorio diario: turnos de mañana ──
exports.recordatorioDiario = onSchedule(
  { schedule: "every day 18:00", timeZone: TZ, secrets: [WA_TOKEN] },
  async () => {
    const snap = await db.collection("turnos").where("fecha", "==", fechaISO(1)).get();
    for (const doc of snap.docs) {
      const t = doc.data();
      if (t.estado === "cancelado" || !t.tel || t.recordatorioEnviado) continue;
      const d = await datosTurno(t);
      const ok = await enviarPlantilla(normalizarTel(t.tel), PLANTILLAS.recordatorio, [
        t.cliente, d.srv, d.prof, fechaLinda(t.fecha), t.hora, linkTurno(doc.id),
      ]);
      if (ok) await doc.ref.update({ recordatorioEnviado: true });
    }
  }
);
