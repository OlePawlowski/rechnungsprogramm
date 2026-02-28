# Rechnungsmodul 24-Stunden-Pflege

Rechnungsmodul für Vermittler von 24-Stunden-Pflege. Rechnungen werden an Kooperationspartner gestellt – Provision ca. 11 % des vereinbarten Gesamtbetrags.

## Funktionen

- **Rechnungsliste** mit Filter (Alle, Entwurf, Offen, Fällig, Festgeschrieben)
- **Neue Rechnung erstellen** mit:
  - **Kooperationspartner** (Rechnungsempfänger) – mit Standard-Provisionssatz
  - **Kunde** (Pflegebedürftiger) – für den die Vermittlung erfolgte
  - **Vereinbarter Gesamtbetrag** – Betrag zwischen Partner und Kunde
  - **Provisionssatz** – z.B. 11 % (je nach Partner)
  - Automatische Berechnung: Rechnungsbetrag = Gesamtbetrag × Provisionssatz
- **PDF-Export** – Rechnungen als PDF herunterladen
- **Datenpersistenz** – Speicherung im Browser (localStorage)

## Technologie

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Zustand (State Management)
- jsPDF (PDF-Generierung)
- React Router
- date-fns

## Installation & Start

```bash
npm install
npm run dev
```

Die Anwendung läuft unter http://localhost:5173

## Build

```bash
npm run build
```

## CRM-Integration

Das Modul ist eigenständig aufgebaut. Für die Integration ins CRM:

1. **Store ersetzen**: `invoiceStore.ts` durch API-Calls an Ihr CRM-Backend ersetzen
2. **Partner & Kunden**: Listen aus CRM-Datenbank laden
3. **Routing**: Pfade an Ihre CRM-Navigation anpassen
4. **Layout**: `Layout.tsx` und `Sidebar.tsx` in Ihre CRM-Struktur einbinden

## Datenstruktur

- **Partner**: Kooperationspartner (Pflegeagentur) mit Adresse und Provisionssatz
- **Customer**: Kunde/Pflegebedürftiger
- **Invoice**: Rechnung mit partnerId, customerId, agreedTotalAmount, commissionRate, commissionAmount
