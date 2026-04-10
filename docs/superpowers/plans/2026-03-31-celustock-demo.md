# CeluStock Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a fully functional phone inventory system branded as "CeluStock" for Iveth, forked from TopLine Tec.

**Architecture:** Fork TopLine Tec (React 19 + TypeScript + Firebase) into a new repo. Rebrand all visible text/colors. Add onboarding tutorial overlay. Deploy to new Firebase project. Disable 3 unused features.

**Tech Stack:** React 19, TypeScript, Vite, Firebase 12, TailwindCSS, Zustand, React Query

---

## File Map

**New files to create:**
- `src/components/onboarding/OnboardingOverlay.tsx` — tutorial overlay with welcome + tooltips
- `src/components/onboarding/Tooltip.tsx` — reusable tooltip with arrow and pulse animation
- `src/hooks/useOnboarding.ts` — read/write onboarding flag from Firestore

**Files to modify (branding):**
- `index.html` — title + meta
- `tailwind.config.js` — Apple color palette
- `.env` — Firebase config + WhatsApp number
- `.firebaserc` — project alias
- `src/features/auth/LoginPage.tsx` — h1 + footer
- `src/features/dashboard/DashboardPage.tsx` — h1
- `src/features/public/components/PublicLayout.tsx` — h1 + footer
- `src/features/public/components/CheckoutModal.tsx` — WhatsApp message
- `src/features/public/pages/CheckoutSuccessPage.tsx` — texto
- `src/features/inventory/pages/LoteClientViewPage.tsx` — header + footer
- `src/utils/whatsappUtils.ts` — WhatsApp messages (5 refs)
- `src/services/pdf/generateInvoicePDF.ts` — PDF header

**Files to modify (features):**
- `src/App.tsx` — comment out 3 routes + Fritz imports
- `src/components/layout/BottomNav.tsx` — remove cotizador from MORE_ITEMS

**Files to modify (onboarding integration):**
- `src/App.tsx` — wrap main content with OnboardingOverlay

---

### Task 1: Fork repo and setup

**Files:**
- Create: `~/Projects/celustock/` (entire project copy)
- Modify: `.firebaserc`, `.env`, `.gitignore`

- [ ] **Step 1: Copy project**

```bash
cp -r ~/Projects/topline-tec ~/Projects/celustock
cd ~/Projects/celustock
rm -rf node_modules dist .firebase .git
```

- [ ] **Step 2: Init fresh git**

```bash
git init
echo "node_modules/\ndist/\n.firebase/\n.env\n.env.*\n!.env.example" > .gitignore
git add -A
git commit -m "Initial commit: CeluStock fork from TopLine Tec"
```

- [ ] **Step 3: Install deps**

```bash
npm install
```

- [ ] **Step 4: Update .firebaserc**

Replace contents of `.firebaserc`:
```json
{
  "projects": {
    "default": "celustock-app"
  }
}
```

- [ ] **Step 5: Update .env**

Replace contents of `.env`:
```
VITE_FIREBASE_API_KEY=<from Firebase console after creating project>
VITE_FIREBASE_AUTH_DOMAIN=celustock-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=celustock-app
VITE_FIREBASE_STORAGE_BUCKET=celustock-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<from Firebase console>
VITE_FIREBASE_APP_ID=<from Firebase console>
VITE_TOPLINE_WA_NUMBER=50375790896
```

Note: Firebase credentials will be filled after Task 7 (Firebase project creation).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: configure CeluStock Firebase project"
```

---

### Task 2: Rebrand text — "Top Line Tec" to "CeluStock"

**Files:**
- Modify: `index.html`, `LoginPage.tsx`, `DashboardPage.tsx`, `PublicLayout.tsx`, `CheckoutModal.tsx`, `CheckoutSuccessPage.tsx`, `LoteClientViewPage.tsx`, `whatsappUtils.ts`, `generateInvoicePDF.ts`

- [ ] **Step 1: Update index.html title**

In `index.html`, change:
```html
<title>Top Line Tec — Sistema de Gestión</title>
```
To:
```html
<title>CeluStock — Tu inventario bajo control</title>
```

- [ ] **Step 2: Update LoginPage.tsx**

In `src/features/auth/LoginPage.tsx`, change line 78:
```tsx
<h1 className="text-4xl font-bold text-primary-600 mb-2">CeluStock</h1>
```
And line 152:
```tsx
© {new Date().getFullYear()} CeluStock. Todos los derechos reservados.
```

- [ ] **Step 3: Update DashboardPage.tsx**

In `src/features/dashboard/DashboardPage.tsx`, change line 80:
```tsx
<h1 className="text-xl font-bold text-primary-600">CeluStock</h1>
```

- [ ] **Step 4: Update PublicLayout.tsx**

In `src/features/public/components/PublicLayout.tsx`, change line 16:
```tsx
<h1 className="text-xl font-bold text-gray-900 tracking-tight">CeluStock</h1>
```
And line 27:
```tsx
© {new Date().getFullYear()} CeluStock. Precios sujetos a cambio sin previo aviso.
```

- [ ] **Step 5: Update CheckoutModal.tsx**

In `src/features/public/components/CheckoutModal.tsx`, change line 98:
```tsx
'*Nuevo pedido CeluStock — Transferencia bancaria*',
```

- [ ] **Step 6: Update CheckoutSuccessPage.tsx**

In `src/features/public/pages/CheckoutSuccessPage.tsx`, change line 28:
```tsx
Recibirás confirmación por WhatsApp. El equipo de CeluStock
```

- [ ] **Step 7: Update LoteClientViewPage.tsx**

In `src/features/inventory/pages/LoteClientViewPage.tsx`, change line 139:
```tsx
CeluStock · Vista Cliente
```
And line 340:
```tsx
CeluStock · Precios sujetos a cambio sin previo aviso ·{' '}
```

- [ ] **Step 8: Update whatsappUtils.ts**

In `src/utils/whatsappUtils.ts`, replace all 5 instances of "Top Line Tec" with "CeluStock" and "Miami, FL" with "San Salvador, SV":
- Line 58: `Gracias por tu compra en *CeluStock*`
- Line 69: `— *CeluStock* | San Salvador, SV`
- Line 85: `Gracias por tu compra en *CeluStock*`
- Line 92: `— *CeluStock* | San Salvador, SV`

- [ ] **Step 9: Update generateInvoicePDF.ts**

In `src/services/pdf/generateInvoicePDF.ts`, change line 4 comment and any "Top Line Tec" text in the PDF header to "CeluStock".

- [ ] **Step 10: Verify no references remain**

```bash
grep -rn "Top.Line\|TopLine" src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v __tests__
```

Expected: 0 results (only test files may remain, which is fine).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: rebrand Top Line Tec to CeluStock"
```

---

### Task 3: Apple color palette

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace color palette**

In `tailwind.config.js`, replace the `colors` object inside `theme.extend`:

```js
colors: {
  primary: {
    50: '#f5f5f7',
    100: '#e8e8ed',
    200: '#d2d2d7',
    300: '#b0b0b8',
    400: '#86868b',
    500: '#6e6e73',
    600: '#0071e3',  // Apple blue - main accent
    700: '#0077ed',
    800: '#004daa',
    900: '#1d1d1f',
  },
  success: '#30d158',
  warning: '#ff9f0a',
  danger: '#ff3b30',
  info: '#0071e3',
  dark: {
    900: '#1d1d1f',
    800: '#2c2c2e',
    50: '#f5f5f7',
  },
  border: '#e8e8ed',
},
```

- [ ] **Step 2: Verify build**

```bash
npx vite build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "style: Apple-inspired color palette"
```

---

### Task 4: Disable 3 features

**Files:**
- Modify: `src/App.tsx`, `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Comment out routes in App.tsx**

In `src/App.tsx`, comment out these lazy imports and their Route elements:
- `CotizadorPage` (line 38 import + its Route)
- `ImportShipmentsPage` (line 37 import + its Route)
- `FritzBubble, FritzPanel, FritzSaleModal` (line 11 import + their JSX usage)

Also comment out or remove the Fritz components rendered in the JSX (FritzBubble, FritzPanel, FritzSaleModal).

- [ ] **Step 2: Remove cotizador and envios from BottomNav.tsx**

In `src/components/layout/BottomNav.tsx`, remove these items from `MORE_ITEMS` array:
- The object with `to: '/cotizador'` (lines 111-115)
- The object with `to: '/envios'` (lines 57-61)

- [ ] **Step 3: Verify build**

```bash
npx vite build 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: disable cotizador, fritz, import-shipments for CeluStock"
```

---

### Task 5: Onboarding tutorial

**Files:**
- Create: `src/hooks/useOnboarding.ts`
- Create: `src/components/onboarding/Tooltip.tsx`
- Create: `src/components/onboarding/OnboardingOverlay.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create useOnboarding hook**

Create `src/hooks/useOnboarding.ts`:

```typescript
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context';

export function useOnboarding() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, 'users', user.uid);
    getDoc(ref).then((snap) => {
      const data = snap.data();
      if (data && !data.onboardingCompleted) {
        setShowOnboarding(true);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.uid]);

  const nextStep = () => setStep((s) => s + 1);

  const complete = async () => {
    if (!user?.uid) return;
    setShowOnboarding(false);
    const ref = doc(db, 'users', user.uid);
    await updateDoc(ref, { onboardingCompleted: true }).catch(() => {});
  };

  const skip = () => complete();

  return { showOnboarding, step, nextStep, complete, skip, loading };
}
```

- [ ] **Step 2: Create Tooltip component**

Create `src/components/onboarding/Tooltip.tsx`:

```tsx
interface TooltipProps {
  text: string;
  visible: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ text, visible, position = 'right' }: TooltipProps) {
  if (!visible) return null;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
  };

  return (
    <div className={`absolute z-50 ${positionClasses[position]} animate-pulse`}>
      <div className="bg-[#0071e3] text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg whitespace-nowrap max-w-[220px]">
        {text}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create OnboardingOverlay component**

Create `src/components/onboarding/OnboardingOverlay.tsx`:

```tsx
import { useOnboarding } from '../../hooks/useOnboarding';
import { useNavigate } from 'react-router-dom';

export default function OnboardingOverlay() {
  const { showOnboarding, step, nextStep, complete, skip } = useOnboarding();
  const navigate = useNavigate();

  if (!showOnboarding) return null;

  // Step 0: Welcome modal
  if (step === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold text-[#1d1d1f] mb-2">Bienvenida a CeluStock</h2>
          <p className="text-[#6e6e73] mb-6">Vamos a registrar tu primer telefono. Toma 30 segundos.</p>
          <button
            onClick={() => { nextStep(); navigate('/inventory'); }}
            className="w-full bg-[#0071e3] text-white py-3 rounded-full font-semibold text-base hover:bg-[#0077ed] transition-colors"
          >
            Empezar
          </button>
          <button
            onClick={skip}
            className="mt-3 text-sm text-[#86868b] hover:text-[#6e6e73]"
          >
            Saltar tutorial
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Inventory page hint — "Agregar telefono" button pulses
  if (step === 1) {
    return (
      <div className="fixed top-20 right-4 z-[100] animate-bounce">
        <div className="bg-[#0071e3] text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg">
          Dale al boton "Agregar" para registrar tu primer telefono
        </div>
        <button
          onClick={skip}
          className="mt-2 text-xs text-white/60 hover:text-white block mx-auto"
        >
          Saltar
        </button>
      </div>
    );
  }

  // Step 2: After first phone added — share catalog
  if (step === 2) {
    const catalogUrl = `${window.location.origin}/catalogo`;
    return (
      <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <h2 className="text-xl font-bold text-[#1d1d1f] mb-2">Tu catalogo ya tiene telefonos</h2>
          <p className="text-[#6e6e73] mb-4">Copia este link y compartilo en tus redes:</p>
          <div className="bg-[#f5f5f7] rounded-xl p-3 mb-4 text-sm text-[#1d1d1f] font-mono break-all">
            {catalogUrl}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(catalogUrl); }}
            className="w-full bg-[#0071e3] text-white py-3 rounded-full font-semibold mb-2 hover:bg-[#0077ed]"
          >
            Copiar link
          </button>
          <a
            href={`https://wa.me/?text=Mira%20mi%20inventario%20de%20telefonos%3A%20${encodeURIComponent(catalogUrl)}`}
            target="_blank"
            rel="noopener"
            className="block w-full bg-[#30d158] text-white py-3 rounded-full font-semibold mb-3 hover:bg-[#28b84c] text-center"
          >
            Compartir por WhatsApp
          </a>
          <button
            onClick={complete}
            className="text-sm text-[#86868b] hover:text-[#6e6e73]"
          >
            Listo, ya entendi
          </button>
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 4: Integrate OnboardingOverlay in App.tsx**

In `src/App.tsx`, import and render OnboardingOverlay inside the auth-protected area (after BottomNav, inside BrowserRouter):

```tsx
import OnboardingOverlay from './components/onboarding/OnboardingOverlay';
```

Add `<OnboardingOverlay />` right after `<BottomNav />` (line 67).

- [ ] **Step 5: Verify build**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add onboarding tutorial for new users"
```

---

### Task 6: Login page Apple style refresh

**Files:**
- Modify: `src/features/auth/LoginPage.tsx`

- [ ] **Step 1: Update login page styling**

Replace the header section of LoginPage.tsx with Apple-style:
- Background: `#ffffff` (clean white)
- Title: `text-[#1d1d1f]` with `font-bold tracking-tight`
- Subtitle: `text-[#6e6e73]`
- Input fields: `rounded-xl border-[#e8e8ed]` with larger padding
- Button: `bg-[#0071e3] rounded-full` (pill shape)
- Footer: `text-[#86868b]`

The exact changes depend on the current layout — modify the className props to use the Apple palette defined in Task 3. Do not restructure the component, just update colors and border radius.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "style: Apple-style login page"
```

---

### Task 7: Create Firebase project and deploy

**Files:**
- Modify: `.env` (fill in real credentials)

- [ ] **Step 1: Create Firebase project**

```bash
firebase projects:create celustock-app
```

If the name is taken, try `celustock-sv` or `celustock-demo`.

- [ ] **Step 2: Add web app in Firebase Console**

Go to Firebase Console > celustock-app > Project Settings > Add app > Web.
Name it "CeluStock". Copy the config values.

- [ ] **Step 3: Enable services**

In Firebase Console:
- Authentication > Sign-in method > Enable Email/Password
- Firestore Database > Create database > Start in production mode
- Storage > Get started

- [ ] **Step 4: Update .env with real credentials**

Fill in the values from Step 2 in `.env`.

- [ ] **Step 5: Deploy rules and hosting**

```bash
cd ~/Projects/celustock
npx vite build
firebase deploy
```

- [ ] **Step 6: Create admin user for Iveth**

In Firebase Console > Authentication > Add user:
- Email: (ask Iveth for her email)
- Password: generate a strong one

Then in Firestore > users collection, create document with the user's UID:
```json
{
  "email": "iveth@email.com",
  "role": "admin",
  "nombre": "Iveth",
  "onboardingCompleted": false
}
```

- [ ] **Step 7: Verify deployment**

```bash
curl -s -o /dev/null -w "%{http_code}" https://celustock-app.web.app
```

Expected: 200

- [ ] **Step 8: Test login on mobile**

Open `https://celustock-app.web.app` on a phone. Login with Iveth's credentials. Verify onboarding appears.

- [ ] **Step 9: Commit final state**

```bash
git add -A
git commit -m "chore: deploy CeluStock to Firebase"
```

---

### Task 8: Final verification checklist

- [ ] **Step 1:** Login works with Iveth's credentials
- [ ] **Step 2:** Onboarding welcome modal appears on first login
- [ ] **Step 3:** "Empezar" navigates to inventory with hint
- [ ] **Step 4:** Can add a phone with IMEI (manual entry)
- [ ] **Step 5:** Can add a phone with camera scanner
- [ ] **Step 6:** Can upload photo from phone camera
- [ ] **Step 7:** TAC auto-detects brand/model from IMEI
- [ ] **Step 8:** After adding phone, catalog share modal appears
- [ ] **Step 9:** Public catalog at /catalogo shows the phone with photo
- [ ] **Step 10:** WhatsApp button in catalog opens chat with +503 7579 0896
- [ ] **Step 11:** Can complete a sale (POS flow)
- [ ] **Step 12:** Can register a debt (fiado) and record a payment (abono)
- [ ] **Step 13:** Dashboard shows KPIs
- [ ] **Step 14:** "Top Line" text appears NOWHERE in the app
- [ ] **Step 15:** Responsive on iPhone (all pages)
- [ ] **Step 16:** Cotizador, Fritz, Import Shipments are NOT accessible
- [ ] **Step 17:** Delete any test data before giving Iveth access
