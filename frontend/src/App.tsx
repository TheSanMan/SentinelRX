import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import ChatComponent from "./ChatComponent";
import ScannerComponent from "./ScannerComponent";
import MedicationListComponent from "./MedicationListComponent";
import Icon, { BrandMark } from "./Icon";
import type { Medication } from "./types";

type View = "medications" | "scanner" | "assistant";
const STORAGE_KEY = "sentinelrx-medications-v1";

function storedMedications(): Medication[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is Medication =>
      typeof entry?.name === "string" && /^DB\d{5}$/.test(entry?.drugbank_id),
    ).slice(0, 25);
  } catch {
    return [];
  }
}

const views = [
  { id: "medications", label: "Medications", icon: "capsule" },
  { id: "scanner", label: "Scan label", icon: "scan" },
  { id: "assistant", label: "Ask DrugBank", icon: "conversation" },
] as const;

function App() {
  const [view, setView] = useState<View>("medications");
  const [meds, setMeds] = useState<Medication[]>(storedMedications);
  const [dialog, setDialog] = useState<"guide" | "install" | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(meds)); }, [meds]);
  useEffect(() => { if (dialog) dialogRef.current?.showModal(); }, [dialog]);

  const addMedication = (drug: Medication) => {
    setMeds(previous => previous.some(med => med.drugbank_id === drug.drugbank_id) ? previous : [...previous, drug].slice(0, 25));
  };
  const removeMedication = (id: string) => setMeds(previous => previous.filter(med => med.drugbank_id !== id));
  const openDialog = (which: "guide" | "install", event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setDialog(which);
  };
  const closeDialog = () => { dialogRef.current?.close(); setDialog(null); opener.current?.focus(); };

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header"><div className="header-inner">
      <div className="header-brand"><BrandMark/><span>sentinel<em>rx</em></span></div>
      <div className="header-actions"><span className="header-count"><Icon name="capsule" size={16}/>{meds.length} {meds.length === 1 ? "medication" : "medications"}</span><button className="header-button" onClick={event => openDialog("guide", event)}><Icon name="info" size={16}/>Guide</button><button className="header-button install-button" onClick={event => openDialog("install", event)}><Icon name="upload" size={16}/>Install on iPhone</button></div>
    </div></header>
    <main id="main-content" className="app-main">
      <div className="workspace-intro"><div><span className="overline">YOUR WORKSPACE</span><h1>{view === "medications" ? "Medications" : view === "scanner" ? "Scan a label" : "Ask DrugBank"}</h1></div><p>{view === "medications" ? "Build your list and review recorded interactions." : view === "scanner" ? "Read a label, then confirm each medication before adding it." : "Answers grounded in DrugBank and your medication list."}</p></div>
      <nav className="view-tabs" aria-label="Tools">{views.map(item => <button key={item.id} className={view === item.id ? "view-tab selected" : "view-tab"} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><Icon name={item.icon} size={20}/>{item.label}{item.id === "medications" && <span className="tab-count">{meds.length}</span>}</button>)}</nav>
      <div className="view-content" key={view}>{view === "medications" && <MedicationListComponent meds={meds} onAdd={addMedication} onRemove={removeMedication} onAsk={() => setView("assistant")}/>}{view === "scanner" && <ScannerComponent onMedsAdded={drug => { addMedication(drug); setView("medications"); }}/>} {view === "assistant" && <ChatComponent meds={meds}/>}</div>
    </main>
    <footer className="app-footer">DrugBank reference data · For information only. Confirm medication decisions with a pharmacist or clinician.</footer>
    <nav className="mobile-tabs" aria-label="Mobile tools">{views.map(item => <button key={item.id} className={view === item.id ? "mobile-tab selected" : "mobile-tab"} aria-label={item.label} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><Icon name={item.icon} size={22}/><span>{item.label}</span></button>)}</nav>
    {dialog && <dialog ref={dialogRef} className="guide-dialog" aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); closeDialog(); }}><button className="dialog-close" autoFocus onClick={closeDialog} aria-label="Close"><Icon name="close" size={20}/></button>{dialog === "guide" ? <><span className="overline">HOW TO USE SENTINELRX</span><h2 id="dialog-title">Your medication workspace</h2><ol><li><strong>Build your list.</strong> Search by name and choose a match. Your list stays on this device.</li><li><strong>Review interactions.</strong> With two or more medications, the app checks for recorded interactions.</li><li><strong>Scan or ask.</strong> Read a label and confirm each result, or ask a question about your list.</li></ol><p>This tool is a reference, not a substitute for your pharmacist or clinician. The database may not cover every risk.</p></> : <><span className="overline">IPHONE INSTALL</span><h2 id="dialog-title">Keep SentinelRx on your Home Screen</h2><ol><li>Open the public SentinelRx website in Safari on your iPhone.</li><li>Tap the Share button, then choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>. The app will open from its icon.</li></ol><p>A public HTTPS address is needed before friends can install it. The medication list is stored separately on each device.</p></>}<button className="primary-button" onClick={closeDialog}>Got it</button></dialog>}
  </div>;
}
export default App;
