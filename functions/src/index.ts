import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';

// ── Fritz AI Assistant ───────────────────────────────────────────────────────
export { fritzChat } from './fritz';
import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { sendInvoiceEmail, sendShipmentEmail } from './email/sender';
import type { InvoiceData } from './email/types';

admin.initializeApp();
const db = admin.firestore();

// ── Stripe init ───────────────────────────────────────────────────────────────
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpsError('internal', 'STRIPE_SECRET_KEY no configurado');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Minimal shape of a phones/{id} document needed for double-sell guards.
 * Matches the PhoneStatus union and reservation shape in src/types/index.ts.
 */
interface PhoneDocData {
  estado: string;
  reservation?: {
    reservedBy?: string;
    orderId?: string;
    reservedAt?: number;
    expiresAt?: number;
    customerName?: string;
  } | null;
}

interface CheckoutItem {
  id: string;
  marca: string;
  modelo: string;
  storage?: string;
  condition?: string;
  precio: number;
  imei: string;
}

interface PendingOrderData {
  clientId?: string;
  clientAlias?: string;
  clientEmail?: string;
  phoneIds: string[];
  phones: CheckoutItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  status: string;
  sessionId: string;
  reservedUntil: admin.firestore.Timestamp;
  stripeSessionId?: string;
  paypalOrderId?: string;
  paymentMethod?: string;
  paidAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
}

// ── FUNCTION 1: Create Stripe Checkout Session ────────────────────────────────
export const createStripeCheckout = onCall(
  { secrets: ['STRIPE_SECRET_KEY'], cors: true },
  async (request) => {
    const { orderId, successUrl, cancelUrl } = request.data as {
      orderId: string;
      successUrl: string;
      cancelUrl: string;
    };

    if (!orderId || !successUrl || !cancelUrl) {
      throw new HttpsError('invalid-argument', 'orderId, successUrl y cancelUrl son requeridos');
    }

    const stripe = getStripe();

    const orderRef = db.collection('pendingOrders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'Orden no encontrada');
    }

    const order = orderSnap.data() as PendingOrderData;

    if (!['reserved', 'pending_payment'].includes(order.status)) {
      throw new HttpsError('failed-precondition', `Orden en estado inválido: ${order.status}`);
    }

    const now = admin.firestore.Timestamp.now();
    if (order.reservedUntil.toMillis() < now.toMillis()) {
      throw new HttpsError('failed-precondition', 'La reserva ha expirado');
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.phones.map((phone) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${phone.marca} ${phone.modelo}${phone.storage ? ` ${phone.storage}` : ''}`,
          description:
            `${phone.condition || ''}${phone.imei ? ` · IMEI: ${phone.imei}` : ''}`.trim(),
        },
        unit_amount: Math.round(phone.precio * 100),
      },
      quantity: 1,
    }));

    let discounts: Stripe.Checkout.SessionCreateParams['discounts'] = undefined;
    if (order.discountAmount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(order.discountAmount * 100),
        currency: 'usd',
        name: 'Descuento aplicado',
        duration: 'once',
      });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      discounts,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${cancelUrl}?order_id=${orderId}`,
      customer_email: order.clientEmail || undefined,
      metadata: {
        orderId,
        phoneIds: order.phoneIds.join(','),
        clientId: order.clientId || '',
      },
      expires_at: Math.floor(order.reservedUntil.toMillis() / 1000),
    });

    await orderRef.update({
      stripeSessionId: session.id,
      status: 'pending_payment',
    });

    return { checkoutUrl: session.url };
  }
);

// ── FUNCTION 2: Stripe Webhook ────────────────────────────────────────────────
export const stripeWebhook = onRequest(
  { secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], cors: false },
  async (req, res) => {
    // FIX 1: Si el secret no está configurado, rechazar inmediatamente.
    // Nunca usar fallback vacío — eso permitiría firmas inválidas.
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET no configurado — rechazando request');
      res.status(500).send('Webhook secret not configured');
      return;
    }

    const stripe = getStripe();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers['stripe-signature'] as string,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send('Webhook Error');
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (!orderId) {
        res.json({ received: true });
        return;
      }

      // FIX 2: Leer la orden de Firestore y verificar que el monto coincide
      // antes de marcar como pagado. Protección anti-fraude.
      try {
        const orderSnap = await db.collection('pendingOrders').doc(orderId).get();
        if (!orderSnap.exists) {
          console.error(`WEBHOOK: Orden ${orderId} no encontrada en Firestore`);
          res.status(400).send('Order not found');
          return;
        }

        const order = orderSnap.data() as PendingOrderData;
        const expectedCents = Math.round(order.total * 100);
        const receivedCents = session.amount_total ?? 0;

        if (receivedCents !== expectedCents) {
          console.error(
            `FRAUD ALERT: monto no coincide para orden ${orderId}. ` +
              `Esperado: ${expectedCents} centavos, Recibido: ${receivedCents} centavos`
          );
          res.status(400).send('Amount mismatch');
          return;
        }

        await markOrderPaid(orderId, 'stripe', session.id);
      } catch (e) {
        console.error('Error procesando webhook checkout.session.completed:', e);
        res.status(500).send('Processing error');
        return;
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        try {
          await cancelOrderAndReleasePhones(orderId);
        } catch (e) {
          console.error('Error cancelando orden expirada:', e);
        }
      }
    }

    res.json({ received: true });
  }
);

// ── FUNCTION 3: Confirm Transfer Payment (admin only) ─────────────────────────
export const confirmTransferPayment = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Requiere autenticación');
  }

  const userRef = db.collection('users').doc(request.auth.uid);
  const userSnap = await userRef.get();
  const role = userSnap.data()?.role as string | undefined;
  if (!role || !['admin', 'gerente'].includes(role)) {
    throw new HttpsError('permission-denied', 'Solo admin o gerente pueden confirmar pagos');
  }

  const { orderId } = request.data as { orderId: string };
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId requerido');

  await markOrderPaid(orderId, 'transfer', `confirmed-by-${request.auth.uid}`);
  return { success: true };
});

// ── SHARED: Mark order as paid and update inventory ──────────────────────────
async function markOrderPaid(orderId: string, method: string, externalId: string): Promise<void> {
  const orderRef = db.collection('pendingOrders').doc(orderId);

  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error('Orden no encontrada');

    const order = orderSnap.data() as PendingOrderData;

    // Idempotency: skip if already paid
    if (order.status === 'paid' || order.status === 'delivered') return;

    const now = admin.firestore.Timestamp.now();
    const nowIso = new Date().toISOString().slice(0, 10);

    const phoneRefs = order.phoneIds.map((id) => db.collection('phones').doc(id));
    const phoneSnaps = await Promise.all(phoneRefs.map((ref) => tx.get(ref)));

    for (const snap of phoneSnaps) {
      if (!snap.exists) {
        throw new HttpsError('not-found', `Teléfono ${snap.id} no encontrado en inventario.`);
      }

      const phoneData = snap.data() as PhoneDocData;

      // Guard 1 — Idempotency / double-sell prevention:
      // If the phone is already marked Vendido this transaction must abort.
      // This covers the race condition where the POS completes a sale between
      // the time the B2B order was reserved and when this webhook fires.
      const FINAL_SALE_STATUSES = ['Vendido', 'Entregado al Cliente'];
      if (FINAL_SALE_STATUSES.includes(phoneData.estado)) {
        throw new HttpsError(
          'failed-precondition',
          `Teléfono ${snap.id} ya fue vendido (estado: "${phoneData.estado}"). ` +
            `Posible doble-venta — abortando pago de orden ${orderId}.`
        );
      }

      // Guard 2 — Reservation ownership:
      // If the phone carries a reservation that belongs to a DIFFERENT order,
      // another checkout flow has claimed it; refuse to overwrite it.
      // We allow: no reservation, an expired reservation, or our own reservation.
      const reservationOrderId = phoneData.reservation?.orderId;
      if (reservationOrderId && reservationOrderId !== orderId) {
        throw new HttpsError(
          'failed-precondition',
          `Teléfono ${snap.id} está reservado para la orden "${reservationOrderId}", ` +
            `no para "${orderId}". Abortando para evitar doble-venta.`
        );
      }
    }

    // Build update patch based on payment method
    const orderPatch: Record<string, unknown> = {
      status: 'paid',
      paidAt: now,
      paymentMethod: method,
    };
    if (method === 'stripe') orderPatch.stripeSessionId = externalId;
    else if (method === 'paypal') orderPatch.paypalOrderId = externalId;
    else orderPatch.transferRef = externalId;

    tx.update(orderRef, orderPatch);

    // Mark each phone as sold
    for (let i = 0; i < phoneRefs.length; i++) {
      const phoneInfo = order.phones[i];
      tx.update(phoneRefs[i], {
        estado: 'Vendido',
        clienteId: order.clientId || '',
        precioVenta: phoneInfo?.precio || 0,
        fechaVenta: nowIso,
        reservation: null,
        updatedAt: now,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          newStatus: 'Vendido',
          date: now.toDate(),
          user: `checkout-${method}`,
          details: `Pagado vía ${method} | Orden ${orderId}`,
        }),
      });
    }

    // Create purchase record if clientId exists
    if (order.clientId) {
      const purchaseRef = db
        .collection('clients')
        .doc(order.clientId)
        .collection('purchases')
        .doc(orderId);

      tx.set(purchaseRef, {
        items: order.phones.map((p) => ({
          phoneId: p.id,
          description: `${p.marca} ${p.modelo}${p.storage ? ` ${p.storage}` : ''}`,
          imei: p.imei,
          quantity: 1,
          price: p.precio,
        })),
        totalAmount: order.total,
        paymentMethod: method,
        discountAmount: order.discountAmount || 0,
        debtIncurred: 0,
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
        purchaseDate: now,
        orderId,
        source: 'online',
      });
    }
  });
}

// ── SHARED: Cancel order and release phone reservations ──────────────────────
async function cancelOrderAndReleasePhones(orderId: string): Promise<void> {
  const orderRef = db.collection('pendingOrders').doc(orderId);

  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) return;

    const order = orderSnap.data() as PendingOrderData;
    // Don't cancel already-paid or delivered orders
    if (order.status === 'paid' || order.status === 'delivered') return;

    tx.update(orderRef, {
      status: 'cancelled',
      cancelledAt: admin.firestore.Timestamp.now(),
    });

    const phoneRefs = order.phoneIds.map((id) => db.collection('phones').doc(id));
    for (const ref of phoneRefs) {
      tx.update(ref, {
        estado: 'En Stock (Disponible para Venta)',
        reservation: null,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
  });
}

// ── FUNCTION 6: Create User Account ──────────────────────────────────────────
// Crea un usuario en Firebase Auth + doc Firestore con el UID real.
// Solo admins pueden llamar esta función.
export const createUserAccount = onCall({ cors: true }, async (request) => {
  // Verificar autenticación
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes estar autenticado');
  }

  // Verificar que el caller es admin
  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo admins pueden crear usuarios');
  }

  const { email, displayName, phone, company, role } = request.data as {
    email: string;
    displayName: string;
    phone: string;
    company?: string;
    role?: string;
  };

  if (!email || !displayName || !phone) {
    throw new HttpsError('invalid-argument', 'email, displayName y phone son requeridos');
  }

  const userRole = role || 'comprador';
  const temporaryPassword = `TopLine${Math.floor(1000 + Math.random() * 9000)}!`;

  // Crear usuario en Firebase Auth
  let authUser: admin.auth.UserRecord;
  try {
    authUser = await admin.auth().createUser({
      email,
      password: temporaryPassword,
      displayName,
    });
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string; message?: string };
    if (firebaseErr.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Ya existe un usuario con ese email');
    }
    throw new HttpsError('internal', firebaseErr.message || 'Error creando usuario en Auth');
  }

  const uid = authUser.uid;

  // Crear client doc si es comprador
  let clientId: string | null = null;
  if (userRole === 'comprador') {
    const clientRef = db.collection('clients').doc();
    clientId = clientRef.id;
    await clientRef.set({
      name: displayName,
      email,
      phone,
      company: company || null,
      creditAmount: 0,
      debtAmount: 0,
      isWorkshopAccount: false,
      userId: uid,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Crear user doc con UID real
  await db
    .collection('users')
    .doc(uid)
    .set({
      uid,
      email,
      name: displayName,
      displayName,
      phone,
      company: company || null,
      role: userRole,
      clientId,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return { uid, clientId, temporaryPassword };
});

// ── FUNCTION 7: Push Notification on Shipment Status Change ──────────────────
// Fires automatically when a shipment document is updated in Firestore.
// Sends a push notification to the buyer if their FCM token is registered.

const SHIPMENT_MESSAGES: Record<string, { title: string; body: string }> = {
  preparando: { title: '📦 Pedido en preparación', body: 'Estamos preparando tu pedido.' },
  en_bodega_usa: { title: '🏭 Pedido en bodega USA', body: 'Tu pedido llegó a bodega en USA.' },
  en_transito: { title: '✈️ ¡Tu pedido va en camino!', body: 'Ya salió de USA hacia El Salvador.' },
  en_aduana: { title: '🛃 Pedido en aduana', body: 'Tu pedido está pasando por aduana.' },
  en_el_salvador: { title: '🇸🇻 ¡Llegó a El Salvador!', body: 'Tu pedido ya está en el país.' },
  entregado: { title: '✅ ¡Pedido entregado!', body: '¡Gracias por comprar con Top Line Tec!' },
};

export const onShipmentStatusChanged = onDocumentUpdated(
  'shipments/{shipmentId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after || before.status === after.status) return;

    const msg = SHIPMENT_MESSAGES[after.status as string];
    if (!msg) return;

    const orderId = after.orderId as string | undefined;
    if (!orderId) return;

    const orderSnap = await db.doc(`pendingOrders/${orderId}`).get();
    const orderData = orderSnap.data();
    if (!orderData) return;

    const clientId = orderData.clientId as string | undefined;
    if (!clientId) return;

    // clientId is from the clients collection, not the Auth UID.
    // Query users collection to find the user linked to this client.
    const usersSnap = await db.collection('users').where('clientId', '==', clientId).limit(1).get();

    const userData = usersSnap.empty ? undefined : usersSnap.docs[0].data();

    // ── Push notification ──────────────────────────────────────────────────────
    const fcmToken = userData?.fcmToken as string | undefined;
    if (fcmToken) {
      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: { title: msg.title, body: msg.body },
          webpush: { notification: { icon: 'https://inventario-a6aa3.web.app/vite.svg' } },
        });
      } catch (pushErr) {
        console.warn('[Push] Error sending push notification:', pushErr);
      }
    }

    // ── Email notification ─────────────────────────────────────────────────────
    const clientEmail = (orderData.clientEmail ?? userData?.email) as string | undefined;
    const clientName = (orderData.clientAlias ?? userData?.displayName ?? 'Cliente') as string;
    const carrier = after.carrier as string | undefined;
    const tracking = after.trackingNumber as string | undefined;
    const arrival = after.estimatedArrival as string | undefined;

    if (clientEmail) {
      await sendShipmentEmail(
        {
          clientName,
          statusTitle: msg.title,
          statusBody: msg.body,
          carrier,
          trackingNumber: tracking,
          estimatedArrival: arrival,
        },
        clientEmail,
        msg.title,
        after.status as string
      );
    }
  }
);

// ── FUNCTION 8: Send invoice email when order is paid ─────────────────────────
// Fires when a pendingOrder transitions to status = 'paid'.
// Creates an Invoice document (with sequential INV-YYYY-NNNN number) and sends
// a branded HTML email + PDF attachment to the buyer.

async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  // IMPORTANT: Must use same path + schema as frontend invoiceService.ts
  // Path: settings/invoiceCounter  Schema: { lastNumber: N, year: YYYY }
  const counterRef = db.doc('settings/invoiceCounter');

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const data = snap.data();
    let nextNumber = 1;
    if (snap.exists && data?.year === year) {
      nextNumber = ((data.lastNumber as number) || 0) + 1;
    }
    tx.set(counterRef, { lastNumber: nextNumber, year });
    return `INV-${year}-${String(nextNumber).padStart(4, '0')}`;
  });
}

export const onOrderPaid = onDocumentUpdated(
  { document: 'pendingOrders/{orderId}', secrets: ['RESEND_API_KEY'] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // Only act when transitioning INTO 'paid'
    if (!before || !after) return;
    if (before.status === 'paid' || after.status !== 'paid') return;

    // Idempotency: skip if email already sent for this order
    if (after.invoiceEmailSentAt) return;

    const clientEmail = after.clientEmail as string | undefined;
    if (!clientEmail) {
      console.log('[Email] Order has no clientEmail — skipping invoice email');
      return;
    }

    const orderId = event.params.orderId;
    const clientName = (after.clientAlias ?? after.clientName ?? 'Cliente') as string;
    const clientPhone = after.clientPhone as string | undefined;
    const phones = (after.phones ?? []) as Array<{
      marca: string;
      modelo: string;
      storage?: string;
      condition?: string;
      imei: string;
      precio: number;
    }>;
    const subtotal = (after.subtotal as number) ?? 0;
    const discountAmount = (after.discountAmount as number) ?? 0;
    const total = (after.total as number) ?? 0;
    const paymentMethod = (after.paymentMethod as string) ?? 'Online';
    const transferDetails = after.transferDetails as
      | { number: string; name: string; bank: string }
      | undefined;
    const paidAt = (after.paidAt as admin.firestore.Timestamp | undefined)?.toDate() ?? new Date();

    // Mark as email-sending immediately (idempotency guard before async work)
    await db.doc(`pendingOrders/${orderId}`).update({
      invoiceEmailSentAt: admin.firestore.Timestamp.now(),
    });

    // Generate sequential invoice number
    const invoiceNumber = await getNextInvoiceNumber();

    // Build InvoiceData from order
    const invoiceData: InvoiceData = {
      invoiceNumber,
      issuedAt: paidAt,
      issuedByEmail: 'sistema@toplinetec.com',
      clientName,
      clientPhone,
      clientEmail,
      items: phones.map((p) => ({
        description: `${p.marca} ${p.modelo}`,
        storage: p.storage,
        condition: p.condition,
        imei: p.imei,
        quantity: 1,
        unitPrice: p.precio,
        subtotalLine: p.precio,
      })),
      subtotal,
      discountAmount,
      total,
      paymentMethod,
      transferDetails,
      orderId,
      source: 'online',
    };

    // Persist Invoice document in Firestore
    const invoiceRef = db.collection('invoices').doc();
    await invoiceRef.set({
      ...invoiceData,
      id: invoiceRef.id,
      issuedAt: admin.firestore.Timestamp.fromDate(paidAt),
      status: 'active',
      phoneIds: phones.map((_p, i) => (after.phoneIds as string[])?.[i] ?? ''),
      orderId,
      source: 'online',
      company: {
        name: 'TOP LINE TEC',
        address: 'Miami, FL, USA',
        description: 'Compra-Venta de Dispositivos Móviles',
      },
    });

    // Link invoice to order
    await db.doc(`pendingOrders/${orderId}`).update({ invoiceId: invoiceRef.id });

    // Send email
    await sendInvoiceEmail(invoiceData, clientEmail);

    console.log(
      `[Email] Invoice ${invoiceNumber} created and sent to ${clientEmail} for order ${orderId}`
    );
  }
);

// ── FUNCTION 9: Send invoice email for POS (manual) sales ─────────────────────
// Fires when any invoice document is CREATED in Firestore.
// Only acts on source='pos' — online orders are already handled by onOrderPaid.
// Reads all invoice fields directly from the newly created document.

export const onInvoiceCreated = onDocumentCreated(
  { document: 'invoices/{invoiceId}', secrets: ['RESEND_API_KEY'] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Only handle POS sales — online invoices come from onOrderPaid (already emailed)
    if (data.source !== 'pos') return;

    const clientEmail = data.clientEmail as string | undefined | null;
    if (!clientEmail) {
      // Venta al contado sin email registrado — skip silenciosamente
      console.log(`[Email] POS invoice ${data.invoiceNumber} has no clientEmail — skipping`);
      return;
    }

    const issuedAt =
      (data.issuedAt as admin.firestore.Timestamp | undefined)?.toDate() ?? new Date();

    const invoiceData: InvoiceData = {
      invoiceNumber: data.invoiceNumber as string,
      issuedAt,
      issuedByEmail: (data.issuedByEmail as string) ?? 'sistema@toplinetec.com',
      clientName: (data.clientName as string) ?? 'Cliente',
      clientPhone: (data.clientPhone as string | undefined) ?? undefined,
      clientEmail,
      items: (
        (data.items ?? []) as Array<{
          description: string;
          imei?: string;
          condition?: string;
          storage?: string;
          quantity: number;
          unitPrice: number;
          subtotalLine: number;
        }>
      ).map((item) => ({
        description: item.description,
        imei: item.imei,
        condition: item.condition,
        storage: item.storage,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotalLine: item.subtotalLine,
      })),
      subtotal: (data.subtotal as number) ?? 0,
      discountAmount: (data.discountAmount as number) ?? 0,
      amountPaidWithCredit: (data.amountPaidWithCredit as number | undefined) ?? undefined,
      debtIncurred: (data.debtIncurred as number | undefined) ?? undefined,
      total: (data.total as number) ?? 0,
      paymentMethod: (data.paymentMethod as string) ?? 'Efectivo',
      transferDetails:
        (data.transferDetails as { number: string; name: string; bank: string } | undefined) ??
        undefined,
      notes: (data.notes as string | undefined) ?? undefined,
      orderId: (data.orderId as string | undefined) ?? undefined,
      source: 'pos',
    };

    await sendInvoiceEmail(invoiceData, clientEmail);

    console.log(`[Email] POS invoice email sent → ${data.invoiceNumber} → ${clientEmail}`);
  }
);

// ── FUNCTION 10: Server-side TAC lookup (no CORS) ────────────────────────────
// Called from the browser via httpsCallable.
// 1. Checks device_definitions cache (Firestore).
// 2. Checks phones collection by TAC prefix (their own inventory).
// 3. Falls back to Bing search — server-side means no CORS issues.
// Saves result to device_definitions for future instant lookups.

function parseBrandModelFromHtml(html: string): { brand: string; model: string } | null {
  const brands = [
    'Apple',
    'Samsung',
    'Xiaomi',
    'Motorola',
    'Google',
    'Huawei',
    'Oppo',
    'Vivo',
    'OnePlus',
    'Sony',
    'LG',
  ];
  for (const brand of brands) {
    if (html.toLowerCase().includes(brand.toLowerCase())) {
      const regex = new RegExp(`(${brand}\\s+[a-zA-Z0-9\\+\\s]{2,20})`, 'i');
      const match = html.match(regex);
      if (match?.[1]) {
        let model = match[1].trim();
        for (const g of [
          'price',
          'specs',
          'review',
          'buy',
          'imei',
          'tac',
          'check',
          'support',
          'compare',
        ]) {
          model = model.replace(new RegExp(g + '.*', 'gi'), '').trim();
        }
        if (model.length > 3 && !model.includes('<')) return { brand, model };
      }
    }
  }
  return null;
}

export const lookupTac = onCall({ cors: true }, async (request) => {
  const tac = ((request.data?.tac as string) ?? '').replace(/\D/g, '').substring(0, 8);
  if (tac.length !== 8) return null;

  // 1. Firestore cache
  const cached = await db.doc(`device_definitions/${tac}`).get();
  if (cached.exists) {
    const d = cached.data()!;
    return { brand: d.brand as string, model: d.model as string };
  }

  // 2. Own phone inventory (TAC prefix range query)
  const phonesSnap = await db
    .collection('phones')
    .where('imei', '>=', tac)
    .where('imei', '<', tac + '\uf8ff')
    .limit(1)
    .get();
  if (!phonesSnap.empty) {
    const d = phonesSnap.docs[0].data();
    if (d.marca && d.modelo) {
      await db
        .doc(`device_definitions/${tac}`)
        .set({ brand: d.marca, model: d.modelo, updatedAt: Date.now() });
      return { brand: d.marca as string, model: d.modelo as string };
    }
  }

  // 3. Server-side Bing search (no CORS restrictions)
  try {
    const query = encodeURIComponent(`TAC ${tac} phone brand model`);
    const res = await fetch(`https://www.bing.com/search?q=${query}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();
    const result = parseBrandModelFromHtml(html);
    if (result) {
      await db
        .doc(`device_definitions/${tac}`)
        .set({ brand: result.brand, model: result.model, updatedAt: Date.now() });
      return result;
    }
  } catch (e) {
    console.warn('[lookupTac] Bing search failed:', e);
  }

  return null;
});
