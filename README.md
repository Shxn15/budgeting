# Budgeting

Eine moderne Windows-App, um deine Finanzen im Blick zu behalten: Konten anlegen, Kontostände eintragen,
Geld zwischen Konten verschieben und festhalten, wem du Geld schuldest oder was in den nächsten Tagen
bezahlt werden muss. Ganz oben zeigt ein großes Kreisdiagramm, wie sich dein Geld auf die Konten verteilt.

## Funktionen (Version 0.1.0)

- **Konten** wie Bargeld, Sparkasse oder Revolut mit aktuellem Kontostand anlegen, bearbeiten und löschen
  (Kontoart und Farbe frei wählbar, die Kontoart wird aus dem Namen erraten).
- **Großes Kreisdiagramm** über allen Konten: Anteil jedes Kontos am Guthaben. Beim Überfahren hebt es das
  Konto hervor und zeigt Betrag und Prozent – auch beim Überfahren der Kontokarten und der Legende.
- **Kontostand ändern**: Die Differenz wird als Korrekturbuchung gespeichert, der Verlauf bleibt erhalten.
- **Umbuchen** zwischen zwei Konten, mit Vorschau der neuen Kontostände.
- **Zahlungen & Schulden**: „Ich schulde Max 20 €“ oder „Miete in 5 Tagen“ eintragen (Datum oder „in X Tagen“),
  Hinweise auf Überfälliges, „Bezahlt“ zieht den Betrag auf Wunsch direkt vom Konto ab (rückgängig machbar).
- **Frei verfügbar** = Vermögen minus offene Zahlungen.
- **Buchungen**: kompletter Verlauf, filterbar nach Konto, einzelne Buchungen löschbar.
- **Hell / Dunkel / wie Windows**, flüssige Animationen, abgerundetes modernes Design.

## Starten

1. `Budgeting-<version>-windows-x64.exe` herunterladen und doppelklicken – keine Installation nötig.
2. Die App braucht die *Microsoft Edge WebView2*-Laufzeit. Sie ist bei Windows 10 und 11 normalerweise schon
   installiert; falls nicht, bietet die App die Installation an.
3. Die .exe ist (noch) nicht digital signiert. Falls Windows „Der Computer wurde durch Windows geschützt“
   anzeigt: **Weitere Informationen → Trotzdem ausführen**.

## Deine Daten und Updates

| Was | Wo |
| --- | --- |
| Daten | `%APPDATA%\Budgeting\data.json` |
| Sicherungen | `%APPDATA%\Budgeting\backups\` |

Die Daten liegen **nicht** neben der .exe, sondern in deinem Benutzerprofil. Für ein Update einfach die neue
.exe starten (die alte kann gelöscht werden) – alle Konten, Buchungen und Einträge sind sofort wieder da.

So bleiben die Daten über alle Versionen hinweg sicher:

- **Datenformat mit Versionsnummer** (`schemaVersion`): Ändert eine neue Version das Format, wandelt sie alte
  Dateien automatisch um („Migration“) – vorher wird immer eine Sicherung angelegt.
- **Ältere Versionen fassen neuere Daten nicht an**: Öffnest du versehentlich eine alte .exe, zeigt sie einen
  Hinweis und verändert nichts.
- **Sicheres Speichern**: Jede Änderung wird sofort und atomar gespeichert (erst in eine temporäre Datei, dann
  ersetzt) – ein Absturz kann keine halbe Datei hinterlassen.
- **Automatische Sicherung** einmal am Tag beim Start (die letzten 30 bleiben), zusätzlich „Jetzt sichern“ in den
  Einstellungen.
- **Beschädigte Datei**: Sie wird nie gelöscht, sondern umbenannt (`data.corrupt-….json`).

**Sicherung wiederherstellen:** App schließen, die gewünschte Datei aus `backups\` nach
`%APPDATA%\Budgeting\data.json` kopieren, App starten.

---

## Für Entwickler

### Technik

| Bereich | Technik |
| --- | --- |
| Desktop-Hülle | [Wails v2](https://wails.io) (Go) – kleine .exe, nutzt WebView2 |
| Oberfläche | React 19, TypeScript, Vite |
| Animationen | [motion](https://motion.dev) (Dialoge, Listen, Navigation) und CSS-Übergänge |
| Diagramm | eigenes SVG-Ringdiagramm mit `d3-shape`, farbenblind-geprüfte Palette |
| Zustand | zustand |
| Tests | Vitest (Fachlogik, Migrationen), `go test` (Speicherung) |

### Projektstruktur

```
main.go, app.go           Wails-Start und Schnittstelle Go ↔ Oberfläche (LoadData, SaveData, …)
internal/storage/         Speichern in %APPDATA%: atomar, Backups, Quarantäne (+ Tests)
internal/system/          Ordner öffnen, Windows-Farbschema lesen
wails.json                App-Name und VERSION (einzige Stelle für die Versionsnummer)
build/                    App-Icon, Windows-Manifest und Versionsinfos der .exe
frontend/src/
  domain/                 Datenmodell (types.ts) und reine Fachlogik: Geld, Datum, Kontostände, Operationen
  persistence/            Datenformat-Version, Migrationen, Reparatur beim Laden (+ Tests)
  platform/backend.ts     Brücke zu Go (im Browser: localStorage-Ersatz zum Entwickeln)
  store/                  Zustand, Aktionen, automatisches Speichern, Theme
  components/             UI-Bausteine (Button, Modal, Felder, Menü, Diagramm, Layout)
  features/               Seiten und Dialoge: overview, accounts, transfers, obligations, transactions, settings
  app/                    App-Rahmen, Seitenliste (pages.tsx), Dialog-Verwaltung (DialogHost.tsx)
```

### Entwickeln

```bash
cd frontend && npm install && npm run dev
```

Öffnet die Oberfläche im Browser (Daten landen dort im `localStorage`). Mit installiertem Wails geht auch
`wails dev` für die echte App mit Hot-Reload.

```bash
cd frontend && npm run typecheck && npm test
```

```bash
go test ./internal/...
```

### Die .exe bauen

```bash
./scripts/build-windows.sh
```

Funktioniert unter Windows (Git Bash), Linux und macOS, ohne C-Compiler. Ergebnis:
`build/bin/Budgeting-<version>-windows-x64.exe`.

Außerdem baut **GitHub Actions** bei jedem Push automatisch die .exe (zu finden im jeweiligen Lauf unter
*Actions → Build → Artifacts*).

### Neue Version veröffentlichen

1. `info.productVersion` in `wails.json` erhöhen (z. B. `0.2.0`).
2. Committen und einen Tag pushen: `git tag v0.2.0 && git push origin v0.2.0`.
3. GitHub Actions erstellt ein Release mit der fertigen .exe.

### Das Datenmodell ändern (wichtig!)

Gespeicherte Daten müssen in jeder künftigen Version lesbar bleiben. Wenn sich etwas am Format von
`data.json` ändert:

1. `CURRENT_SCHEMA_VERSION` in `frontend/src/persistence/schema.ts` um 1 erhöhen.
2. In `frontend/src/persistence/migrations.ts` eine Migration für die neue Version ergänzen.
3. `domain/types.ts` und `persistence/normalize.ts` anpassen.
4. In `persistence.test.ts` einen Test mit einer echten Datei der alten Version hinzufügen. Die vorhandene
   Testdatei `SCHEMA_1_FILE` nie ändern.

Niemals `dataDirName` in `main.go` ändern – sonst findet die App die alten Daten nicht mehr.

### Erweitern

- **Neue Seite:** Komponente in `features/` anlegen, ID in `PageId` (`store/uiStore.ts`) ergänzen und in
  `app/pages.tsx` eintragen – sie erscheint automatisch in der Seitenleiste.
- **Neuer Dialog:** Typ in `DialogRequest` (`store/uiStore.ts`) ergänzen und in `app/DialogHost.tsx` rendern.
- **Neue Datenänderung:** reine Funktion in `domain/operations.ts` (+ Test), dann in `store/actions.ts` anbinden.
- **Neue Go-Funktion:** exportierte Methode am `App`-Struct in `app.go`, dann in `platform/backend.ts` ergänzen.
