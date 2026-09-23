import { useRef, useState } from "react";
import Icon from "./Icon";
import type { DrugMatch, Medication } from "./types";

interface ScanResult { extracted_names: string[]; matched_drugs: DrugMatch[]; unmatched_names: string[] }
const MAX_BYTES = 10 * 1024 * 1024;

export default function ScannerComponent({ onMedsAdded }: { onMedsAdded: (drug: Medication) => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  async function scan(file?: File) {
    if (!file || busy.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG, or WebP photo."); return; }
    if (file.size > MAX_BYTES) { setError("Choose a photo smaller than 10 MB."); return; }
    busy.current = true; setScanning(true); setError(""); setResult(null); setFileName(file.name);
    const body = new FormData(); body.append("file", file);
    try {
      const response = await fetch("/api/drugs/scan", { method: "POST", body, signal: AbortSignal.timeout(120000) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Label scanning is unavailable. Check the API connection.");
      if (!Array.isArray(data.matched_drugs) || !Array.isArray(data.unmatched_names)) throw new Error("The label reader returned an invalid response.");
      setResult(data);
    } catch (cause) { setError(cause instanceof Error && cause.name === "Error" ? cause.message : "The label reader timed out. Try a smaller photo or type the name in Medications."); }
    finally { busy.current = false; setScanning(false); if (input.current) input.current.value = ""; }
  }

  return <div className="scanner-layout"><section className="feature-card scan-card" aria-labelledby="scan-heading"><div className="card-heading"><div><span className="overline">LABEL READER</span><h2 id="scan-heading">Upload a label photo</h2></div></div>
    <label className={`photo-drop ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void scan(event.dataTransfer.files[0]); }}><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={scanning} onChange={event => void scan(event.target.files?.[0])}/><span className="photo-icon"><Icon name={scanning ? "spinner" : "scan"} className={scanning ? "spin" : ""} size={42}/></span><strong>{scanning ? "Reading label…" : "Take a photo or choose an image"}</strong><span>JPG, PNG, WebP · Max 10 MB</span></label>
    <div className="scan-tips"><h3>For a better scan</h3><ul><li>Show the medication name clearly in good light.</li><li>Keep the camera steady and crop out personal details.</li><li>Review every detected name before adding it.</li></ul></div>
    {error && <div className="scan-error" role="alert"><Icon name="info" size={20}/><p>{error}</p></div>}
  </section>
  <section className="feature-card scan-result-card" aria-labelledby="scan-result-heading"><div className="card-heading"><div><span className="overline">REVIEW</span><h2 id="scan-result-heading">Detected medications</h2></div>{result && <span className="count-pill">{result.matched_drugs.length}</span>}</div>
    {!result ? <div className="scan-placeholder"><Icon name="search" size={36}/><p>{scanning ? "Reading the photo and checking database matches…" : "Upload a photo to see possible matches here."}</p></div> : <div className="scan-results"><p className="file-label">From {fileName}</p>{result.matched_drugs.length ? result.matched_drugs.map(drug => <div className="scan-result" key={drug.drugbank_id}><div><strong>{drug.name}</strong><small>{drug.drugbank_id}{drug.matched_term ? ` · Read “${drug.matched_term}”` : ""}{drug.match_score < 100 ? ` · ${Math.round(drug.match_score)}% match` : ""}</small></div><button className="primary-button" onClick={() => onMedsAdded(drug)}>Add to list</button></div>) : <p className="scan-no-match">No medication name matched the database. Try another photo or enter the name manually.</p>}{result.unmatched_names.length > 0 && <details className="unmatched"><summary>{result.unmatched_names.length} lines could not be matched</summary><ul>{result.unmatched_names.map((line, index) => <li key={index}>{line}</li>)}</ul></details>}</div>}
  </section></div>;
}
