import { useState, useRef } from "react";
import Icon from "./Icon";
interface DrugMatch {
  drugbank_id: string;
  name: string;
  match_score?: number;
}
export default function ScannerComponent({
  onMedsAdded,
}: {
  onMedsAdded: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{
    matched: DrugMatch[];
    unmatched: string[];
  } | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  async function scan(file?: File) {
    if (!file || locked.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Please choose an image smaller than 10 MB.");
      return;
    }
    locked.current = true;
    setScanning(true);
    setError("");
    setResult(null);
    setAdded([]);
    setFileName(file.name);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/drugs/scan", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(90000),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (
        !Array.isArray(data.matched_drugs) ||
        !Array.isArray(data.unmatched_names)
      )
        throw new Error();
      setResult({
        matched: data.matched_drugs,
        unmatched: data.unmatched_names,
      });
    } catch {
      setError(
        "The label could not be read. Check the service connection and try again.",
      );
    } finally {
      locked.current = false;
      setScanning(false);
      if (input.current) input.current.value = "";
    }
  }
  async function addMed(drug: DrugMatch) {
    if (adding) return;
    setAdding(drug.drugbank_id);
    setError("");
    try {
      const response = await fetch("/api/session/demo-user/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drug_name: drug.name }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error();
      setAdded((previous) => [...previous, drug.drugbank_id]);
      onMedsAdded();
    } catch {
      setError("Could not add this medication. Please try again.");
    } finally {
      setAdding(null);
    }
  }
  return (
    <section
      className="panel scanner-panel"
      id="scanner"
      aria-labelledby="scanner-title"
    >
      <div className="panel-header">
        <div className="panel-title">
          <Icon name="scan" size={23} />
          <div>
            <div className="panel-kicker">FROM LABEL TO LIST</div>
            <h2 id="scanner-title">Read a medication label</h2>
          </div>
        </div>
        <span className="count-badge">OCR</span>
      </div>
      <div className="panel-body">
        <div
          className={`drop-zone ${dragging ? "dragging" : ""} ${scanning ? "scanning" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!scanning) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void scan(event.dataTransfer.files[0]);
          }}
        >
          <input
            ref={input}
            aria-label="Upload a medication label image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={scanning}
            onChange={(event) => void scan(event.target.files?.[0])}
          />
          <div className="scan-art">
            <Icon name="scan" size={38} />
          </div>
          <div>
            <strong>
              {scanning
                ? "Reading your label…"
                : dragging
                  ? "Drop your label here"
                  : "Drop a label photo here"}
            </strong>
            <p>
              {scanning
                ? "Identifying medication names"
                : "or click to browse · JPG, PNG, WebP"}
            </p>
          </div>
          <Icon name="upload" size={17} className="upload-arrow" />
        </div>
        <p className="scan-note">
          A clear, well-lit photo works best. Up to 10 MB.
          <br />
          Crop out personal details. Text may be processed by an AI service.
        </p>
        {error && (
          <div className="notice error" role="alert">
            <Icon name="info" size={15} />
            {error}
          </div>
        )}
        <div aria-live="polite">
          {result && (
            <div className="scan-results">
              <h3>Review detected names</h3>
              <p className="scan-note">
                {fileName} · Confirm each name against your label before adding.
              </p>
              {result.matched.map((drug) => (
                <div className="scan-match" key={drug.drugbank_id}>
                  <div>
                    {drug.name}
                    {drug.match_score !== undefined && (
                      <small>
                        Match score: {Math.round(drug.match_score)}%
                      </small>
                    )}
                  </div>
                  <button
                    className="text-button"
                    disabled={!!adding || added.includes(drug.drugbank_id)}
                    onClick={() => void addMed(drug)}
                  >
                    {added.includes(drug.drugbank_id) ? (
                      <>
                        <Icon name="check" size={14} /> Added
                      </>
                    ) : adding === drug.drugbank_id ? (
                      "Adding…"
                    ) : (
                      <>
                        Add to list <Icon name="plus" size={14} />
                      </>
                    )}
                  </button>
                </div>
              ))}
              {result.matched.length === 0 && (
                <p className="notice">
                  No medication names matched. Try another photo or enter a name
                  above.
                </p>
              )}
              {result.unmatched.length > 0 && (
                <details className="scan-note">
                  <summary>
                    {result.unmatched.length} unrecognized text{" "}
                    {result.unmatched.length === 1 ? "item" : "items"}
                  </summary>
                  <p>{result.unmatched.join(", ")}</p>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
