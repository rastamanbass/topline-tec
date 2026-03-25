"use strict";
/**
 * template.ts — Premium HTML email templates for Top Line Tec.
 * Table-based layout, inline styles, maximum email client compatibility.
 * Logo: white PNG on transparent bg — renders perfectly on dark blue header.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceEmailHtml = invoiceEmailHtml;
exports.shipmentEmailHtml = shipmentEmailHtml;
const APP_URL = "https://inventario-a6aa3.web.app";
const LOGO_URL = "https://static.wixstatic.com/media/7719b0_c93c24b65ed44bd391e8257a43e8af9d~mv2.png";
const BLUE = "#1e3a8a";
const BLUE_DARK = "#172554";
const BLUE_LIGHT = "#dbeafe";
const GRAY_50 = "#f9fafb";
const GRAY_100 = "#f3f4f6";
const GRAY_200 = "#e5e7eb";
const GRAY_500 = "#6b7280";
const GRAY_700 = "#374151";
const GRAY_900 = "#111827";
const RED = "#dc2626";
const GREEN = "#15803d";
function fmt(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtDate(d) {
    return d.toLocaleDateString("es-SV", { day: "2-digit", month: "long", year: "numeric" });
}
function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// ── Shared outer wrapper ───────────────────────────────────────────────────────
function wrap(body) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <title>Top Line Tec</title>
</head>
<body style="margin:0;padding:0;background:${GRAY_100};
             -webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:${GRAY_100};padding:40px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:12px;
                    overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        ${body}

        <!-- Footer -->
        <tr><td style="background:${GRAY_50};padding:24px 40px;
                        border-top:1px solid ${GRAY_200};text-align:center;">
          <p style="margin:0 0 6px;color:${GRAY_500};font-size:12px;
                    font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
            <strong style="color:${GRAY_700};">TOP LINE TEC</strong>
            &nbsp;·&nbsp;Compra-Venta de Dispositivos Móviles&nbsp;·&nbsp;Miami, FL, USA
          </p>
          <p style="margin:0;color:#9ca3af;font-size:11px;
                    font-family:Arial,Helvetica,sans-serif;">
            Este documento no tiene valor fiscal.
            Si tenés preguntas, respondé a este correo.
          </p>
        </td></tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>
</body>
</html>`;
}
// ── Header with logo ───────────────────────────────────────────────────────────
function headerBlock(tagline, badge) {
    return `
  <tr><td style="background:${BLUE};padding:0;">

    <!-- Top accent line -->
    <div style="background:linear-gradient(90deg,#3b82f6,#1d4ed8,#1e3a8a);height:4px;"></div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="padding:28px 40px 24px;">
      <tr>
        <td style="vertical-align:middle;">
          <!-- Logo image (white PNG, shows on dark blue) -->
          <img src="${LOGO_URL}"
               alt="Top Line Tec"
               width="72" height="72"
               style="display:block;width:72px;height:72px;object-fit:contain;"/>
        </td>
        <td style="vertical-align:middle;padding-left:16px;">
          <div style="color:#ffffff;font-size:20px;font-weight:700;
                      font-family:Arial,Helvetica,sans-serif;letter-spacing:0.5px;
                      line-height:1.2;">TOP LINE TEC</div>
          <div style="color:#93c5fd;font-size:12px;margin-top:3px;
                      font-family:Arial,Helvetica,sans-serif;">${esc(tagline)}</div>
        </td>
        ${badge ? `
        <td align="right" style="vertical-align:middle;">
          <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);
                      border-radius:6px;padding:8px 14px;text-align:center;">
            <div style="color:#93c5fd;font-size:9px;font-weight:700;letter-spacing:1.5px;
                        font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;">
              Acta de Venta</div>
            <div style="color:#ffffff;font-size:14px;font-weight:700;margin-top:2px;
                        font-family:'Courier New',monospace;">${esc(badge)}</div>
          </div>
        </td>` : ""}
      </tr>
    </table>
  </td></tr>`;
}
// ── CTA button ────────────────────────────────────────────────────────────────
function ctaBlock(label, url) {
    return `
  <tr><td align="center" style="padding:28px 40px 36px;">
    <a href="${url}"
       style="display:inline-block;background:${BLUE};color:#ffffff;
              text-decoration:none;padding:14px 40px;border-radius:8px;
              font-size:14px;font-weight:700;letter-spacing:0.5px;
              font-family:Arial,Helvetica,sans-serif;
              box-shadow:0 2px 8px rgba(30,58,138,0.3);">
      ${esc(label)} &rarr;
    </a>
    <p style="margin:14px 0 0;color:${GRAY_500};font-size:12px;
              font-family:Arial,Helvetica,sans-serif;">
      O visitá <a href="${APP_URL}" style="color:${BLUE};text-decoration:none;">${APP_URL}</a>
    </p>
  </td></tr>`;
}
// ── Divider ───────────────────────────────────────────────────────────────────
function divider() {
    return `<tr><td style="padding:0 40px;">
    <div style="border-top:1px solid ${GRAY_200};"></div>
  </td></tr>`;
}
// ── TEMPLATE 1: Invoice email (order paid) ────────────────────────────────────
function invoiceEmailHtml(inv) {
    // Items rows
    const itemRows = inv.items.map((item, idx) => {
        const detail = [item.condition, item.storage].filter(Boolean).join(" · ");
        const imei = item.imei ? `···${item.imei.slice(-6)}` : "—";
        const bg = idx % 2 === 0 ? "#ffffff" : GRAY_50;
        return `
    <tr style="background:${bg};">
      <td style="padding:13px 14px;border-bottom:1px solid ${GRAY_200};
                 color:${GRAY_500};font-size:12px;text-align:center;
                 font-family:Arial,Helvetica,sans-serif;">${idx + 1}</td>
      <td style="padding:13px 14px;border-bottom:1px solid ${GRAY_200};
                 font-family:Arial,Helvetica,sans-serif;">
        <div style="color:${GRAY_900};font-size:13px;font-weight:700;">
          ${esc(item.description)}</div>
        ${detail ? `<div style="color:${GRAY_500};font-size:11px;margin-top:2px;">${esc(detail)}</div>` : ""}
      </td>
      <td style="padding:13px 14px;border-bottom:1px solid ${GRAY_200};
                 color:${GRAY_500};font-size:11px;text-align:center;
                 font-family:'Courier New',monospace;">${esc(imei)}</td>
      <td style="padding:13px 14px;border-bottom:1px solid ${GRAY_200};
                 color:${GRAY_900};font-size:13px;font-weight:700;text-align:right;
                 font-family:Arial,Helvetica,sans-serif;">${fmt(item.subtotalLine)}</td>
    </tr>`;
    }).join("");
    // Totals rows
    const discountRow = inv.discountAmount > 0 ? `
    <tr>
      <td style="color:${RED};font-size:13px;padding:4px 0;
                 font-family:Arial,Helvetica,sans-serif;">Descuento</td>
      <td style="color:${RED};font-size:13px;text-align:right;padding:4px 0;
                 font-family:Arial,Helvetica,sans-serif;">-${fmt(inv.discountAmount)}</td>
    </tr>` : "";
    const creditRow = inv.amountPaidWithCredit && inv.amountPaidWithCredit > 0 ? `
    <tr>
      <td style="color:${GREEN};font-size:13px;padding:4px 0;
                 font-family:Arial,Helvetica,sans-serif;">Crédito aplicado</td>
      <td style="color:${GREEN};font-size:13px;text-align:right;padding:4px 0;
                 font-family:Arial,Helvetica,sans-serif;">-${fmt(inv.amountPaidWithCredit)}</td>
    </tr>` : "";
    const transferRow = inv.transferDetails ? `
    <p style="margin:6px 0 0;color:${GRAY_500};font-size:12px;
              font-family:Arial,Helvetica,sans-serif;">
      Ref: ${esc(inv.transferDetails.number)}&nbsp;&nbsp;·&nbsp;&nbsp;
      ${esc(inv.transferDetails.bank)}&nbsp;&nbsp;·&nbsp;&nbsp;
      ${esc(inv.transferDetails.name)}
    </p>` : "";
    const body = `
    ${headerBlock("Compra-Venta de Dispositivos Móviles · Miami, FL, USA", inv.invoiceNumber)}

    <!-- ✅ Confirmation banner -->
    <tr><td style="background:#f0fdf4;padding:18px 40px;
                   border-bottom:1px solid #bbf7d0;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:22px;padding-right:12px;">✅</td>
          <td>
            <div style="color:#15803d;font-size:14px;font-weight:700;
                        font-family:Arial,Helvetica,sans-serif;">
              Pago confirmado</div>
            <div style="color:#16a34a;font-size:12px;margin-top:2px;
                        font-family:Arial,Helvetica,sans-serif;">
              Tu compra fue procesada exitosamente el ${fmtDate(inv.issuedAt)}</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Greeting -->
    <tr><td style="padding:28px 40px 20px;">
      <p style="margin:0;color:${GRAY_900};font-size:16px;font-weight:700;
                font-family:Arial,Helvetica,sans-serif;">
        Hola, ${esc(inv.clientName)} 👋
      </p>
      <p style="margin:8px 0 0;color:${GRAY_500};font-size:13px;line-height:1.7;
                font-family:Arial,Helvetica,sans-serif;">
        Adjunto a este correo encontrás el PDF de tu acta de venta
        <strong style="color:${GRAY_700};">${esc(inv.invoiceNumber)}</strong>.
        También podés descargarlo desde el portal en cualquier momento.
      </p>
    </td></tr>

    ${divider()}

    <!-- Client + Date info cards -->
    <tr><td style="padding:20px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="48%" style="vertical-align:top;
              background:${GRAY_50};border:1px solid ${GRAY_200};
              border-radius:8px;padding:16px 18px;">
            <div style="color:${BLUE};font-size:9px;font-weight:700;letter-spacing:1.5px;
                        text-transform:uppercase;margin-bottom:8px;
                        font-family:Arial,Helvetica,sans-serif;">Facturado a</div>
            <div style="color:${GRAY_900};font-size:14px;font-weight:700;
                        font-family:Arial,Helvetica,sans-serif;">${esc(inv.clientName)}</div>
            ${inv.clientPhone ? `<div style="color:${GRAY_500};font-size:12px;margin-top:4px;font-family:Arial,Helvetica,sans-serif;">${esc(inv.clientPhone)}</div>` : ""}
            ${inv.clientEmail ? `<div style="color:${GRAY_500};font-size:12px;font-family:Arial,Helvetica,sans-serif;">${esc(inv.clientEmail)}</div>` : ""}
          </td>
          <td width="4%"></td>
          <td width="48%" style="vertical-align:top;
              background:${GRAY_50};border:1px solid ${GRAY_200};
              border-radius:8px;padding:16px 18px;">
            <div style="color:${BLUE};font-size:9px;font-weight:700;letter-spacing:1.5px;
                        text-transform:uppercase;margin-bottom:8px;
                        font-family:Arial,Helvetica,sans-serif;">Fecha de compra</div>
            <div style="color:${GRAY_900};font-size:14px;font-weight:700;
                        font-family:Arial,Helvetica,sans-serif;">${fmtDate(inv.issuedAt)}</div>
            <div style="color:${GRAY_500};font-size:12px;margin-top:4px;
                        font-family:'Courier New',monospace;">${esc(inv.invoiceNumber)}</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Items table -->
    <tr><td style="padding:0 40px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid ${GRAY_200};border-radius:8px;overflow:hidden;">
        <!-- Table header -->
        <tr style="background:${BLUE_DARK};">
          <td style="color:#fff;font-size:10px;font-weight:700;padding:11px 14px;
                     text-align:center;font-family:Arial,Helvetica,sans-serif;
                     letter-spacing:1px;text-transform:uppercase;width:36px;">#</td>
          <td style="color:#fff;font-size:10px;font-weight:700;padding:11px 14px;
                     font-family:Arial,Helvetica,sans-serif;
                     letter-spacing:1px;text-transform:uppercase;">Descripción</td>
          <td style="color:#93c5fd;font-size:10px;font-weight:700;padding:11px 14px;
                     text-align:center;font-family:Arial,Helvetica,sans-serif;
                     letter-spacing:1px;text-transform:uppercase;width:80px;">IMEI</td>
          <td style="color:#fff;font-size:10px;font-weight:700;padding:11px 14px;
                     text-align:right;font-family:Arial,Helvetica,sans-serif;
                     letter-spacing:1px;text-transform:uppercase;width:90px;">Subtotal</td>
        </tr>
        ${itemRows}
      </table>
    </td></tr>

    <!-- Totals -->
    <tr><td style="padding:0 40px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td></td>
          <td width="230" style="vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="background:${GRAY_50};border:1px solid ${GRAY_200};
                          border-radius:8px;padding:16px 18px;">
              <tr>
                <td style="color:${GRAY_500};font-size:13px;padding:3px 0;
                           font-family:Arial,Helvetica,sans-serif;">
                  Subtotal (${inv.items.reduce((s, i) => s + i.quantity, 0)} items)</td>
                <td style="color:${GRAY_700};font-size:13px;text-align:right;padding:3px 0;
                           font-family:Arial,Helvetica,sans-serif;">${fmt(inv.subtotal)}</td>
              </tr>
              ${discountRow}
              ${creditRow}
              <tr>
                <td colspan="2" style="padding:8px 0 4px;">
                  <div style="border-top:2px solid ${GRAY_900};"></div>
                </td>
              </tr>
              <tr>
                <td style="color:${GRAY_900};font-size:16px;font-weight:700;
                           padding:4px 0;font-family:Arial,Helvetica,sans-serif;">TOTAL</td>
                <td style="color:${BLUE};font-size:18px;font-weight:700;
                           text-align:right;padding:4px 0;
                           font-family:Arial,Helvetica,sans-serif;">${fmt(inv.total)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>

    ${divider()}

    <!-- Payment method -->
    <tr><td style="padding:20px 40px;">
      <div style="background:${BLUE_LIGHT};border-left:4px solid ${BLUE};
                  border-radius:0 8px 8px 0;padding:14px 18px;">
        <div style="color:${BLUE};font-size:9px;font-weight:700;letter-spacing:1.5px;
                    text-transform:uppercase;margin-bottom:6px;
                    font-family:Arial,Helvetica,sans-serif;">Método de pago</div>
        <div style="color:${GRAY_900};font-size:14px;font-weight:700;
                    font-family:Arial,Helvetica,sans-serif;">${esc(inv.paymentMethod)}</div>
        ${transferRow}
      </div>
    </td></tr>

    ${ctaBlock("Ver mis pedidos", `${APP_URL}/mis-pedidos`)}
  `;
    return wrap(body);
}
const SHIPMENT_ICONS = {
    "preparando": "📦",
    "en_bodega_usa": "🏭",
    "en_transito": "✈️",
    "en_aduana": "🛃",
    "en_el_salvador": "🇸🇻",
    "entregado": "✅",
};
const STATUS_COLORS = {
    "preparando": { bg: "#fefce8", border: "#fde047", text: "#854d0e" },
    "en_bodega_usa": { bg: "#f0f9ff", border: "#7dd3fc", text: "#075985" },
    "en_transito": { bg: "#f0f9ff", border: "#3b82f6", text: "#1d4ed8" },
    "en_aduana": { bg: "#fff7ed", border: "#fdba74", text: "#9a3412" },
    "en_el_salvador": { bg: "#f0fdf4", border: "#4ade80", text: "#15803d" },
    "entregado": { bg: "#f0fdf4", border: "#16a34a", text: "#15803d" },
};
function shipmentEmailHtml(data, statusKey) {
    var _a, _b;
    const icon = statusKey ? ((_a = SHIPMENT_ICONS[statusKey]) !== null && _a !== void 0 ? _a : "📬") : "📬";
    const colors = statusKey
        ? ((_b = STATUS_COLORS[statusKey]) !== null && _b !== void 0 ? _b : { bg: BLUE_LIGHT, border: BLUE, text: BLUE })
        : { bg: BLUE_LIGHT, border: BLUE, text: BLUE };
    const detailRows = [
        data.carrier ? `<tr><td style="color:${GRAY_500};font-size:13px;padding:5px 0;font-family:Arial,Helvetica,sans-serif;">Transportista</td><td style="color:${GRAY_900};font-size:13px;font-weight:700;text-align:right;padding:5px 0;font-family:Arial,Helvetica,sans-serif;">${esc(data.carrier)}</td></tr>` : "",
        data.trackingNumber ? `<tr><td style="color:${GRAY_500};font-size:13px;padding:5px 0;font-family:Arial,Helvetica,sans-serif;">Guía de rastreo</td><td style="color:${GRAY_900};font-size:12px;font-weight:700;text-align:right;padding:5px 0;font-family:'Courier New',monospace;">${esc(data.trackingNumber)}</td></tr>` : "",
        data.estimatedArrival ? `<tr><td style="color:${GRAY_500};font-size:13px;padding:5px 0;font-family:Arial,Helvetica,sans-serif;">Llegada estimada</td><td style="color:${GRAY_900};font-size:13px;font-weight:700;text-align:right;padding:5px 0;font-family:Arial,Helvetica,sans-serif;">${esc(data.estimatedArrival)}</td></tr>` : "",
    ].filter(Boolean).join("");
    const detailsBlock = detailRows ? `
    <tr><td style="padding:0 40px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${GRAY_50};border:1px solid ${GRAY_200};
                    border-radius:8px;padding:16px 18px;">
        ${detailRows}
      </table>
    </td></tr>` : "";
    const body = `
    ${headerBlock("Compra-Venta de Dispositivos Móviles · Miami, FL, USA")}

    <!-- Greeting -->
    <tr><td style="padding:28px 40px 20px;">
      <p style="margin:0;color:${GRAY_900};font-size:16px;font-weight:700;
                font-family:Arial,Helvetica,sans-serif;">
        Hola, ${esc(data.clientName)} 👋
      </p>
      <p style="margin:8px 0 0;color:${GRAY_500};font-size:13px;line-height:1.6;
                font-family:Arial,Helvetica,sans-serif;">
        Hay una actualización sobre el estado de tu pedido.
      </p>
    </td></tr>

    <!-- Status card -->
    <tr><td style="padding:0 40px 24px;">
      <div style="background:${colors.bg};border:2px solid ${colors.border};
                  border-radius:12px;padding:24px 28px;">
        <div style="font-size:36px;margin-bottom:10px;">${icon}</div>
        <div style="color:${colors.text};font-size:18px;font-weight:700;
                    font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">
          ${esc(data.statusTitle)}</div>
        <div style="color:${GRAY_700};font-size:14px;line-height:1.7;
                    font-family:Arial,Helvetica,sans-serif;">
          ${esc(data.statusBody)}</div>
      </div>
    </td></tr>

    ${detailsBlock}

    ${ctaBlock("Ver estado de mi pedido", `${APP_URL}/mis-pedidos`)}
  `;
    return wrap(body);
}
//# sourceMappingURL=template.js.map