import { useState, useEffect, useCallback, useRef } from "react";
import type { FormEvent } from "react";
import Icon from "./Icon";

interface Medication {
  drugbank_id: string;
  name: string;
}
interface Interaction {
  drug1: { name: string };
  drug2: { name: string };
  description: string;
}
export default function MedicationListComponent({
  refreshKey,
}: {
  refreshKey: number;
}) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [newMed, setNewMed] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const latestRequest = useRef(0);
  const sessionPath = "/api/session/demo-user";

  const fetchData = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setStatus("loading");
    setInteractions([]);
    try {
      const response = await fetch(`${sessionPath}/medications`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok)
        throw new Error(
          "Medication service unavailable. Your list could not be loaded.",
        );
      const data = await response.json();
      if (!Array.isArray(data.medications))
        throw new Error(
          "The medication service returned an unexpected response.",
        );
      let checked: Interaction[] = [];
      if (data.medications.length >= 2) {
        const interactionResponse = await fetch(
          `${sessionPath}/check-all-interactions`,
          { method: "POST", signal: AbortSignal.timeout(12000) },
        );
        if (!interactionResponse.ok)
          throw new Error(
            "The interaction check could not be completed. Please try again.",
          );
        const interactionData = await interactionResponse.json();
        if (!Array.isArray(interactionData.interactions))
          throw new Error(
            "The interaction check returned an unexpected response.",
          );
        checked = interactionData.interactions;
      }
      if (requestId !== latestRequest.current) return;
      setMeds(data.medications);
      setInteractions(checked);
      setStatus("ready");
      setError("");
    } catch (cause) {
      if (requestId !== latestRequest.current) return;
      setStatus("error");
      setError(
        cause instanceof Error &&
          cause.name !== "TypeError" &&
          cause.name !== "TimeoutError"
          ? cause.message
          : "Medication service unavailable. Please try again when connected.",
      );
    }
  }, []);
  const invalidateRequest = useCallback(() => {
    latestRequest.current++;
  }, []);
  useEffect(() => {
    void fetchData();
    return invalidateRequest;
  }, [fetchData, refreshKey, invalidateRequest]);

  async function addMed(event: FormEvent) {
    event.preventDefault();
    if (!newMed.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${sessionPath}/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drug_name: newMed.trim() }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "No match found. Check the spelling or try the active ingredient."
            : "Could not add this medication. Please try again.",
        );
      setNewMed("");
      await fetchData();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name === "Error"
          ? cause.message
          : "Could not connect to the medication service.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function removeMed(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${sessionPath}/medications/${encodeURIComponent(id)}`,
        { method: "DELETE", signal: AbortSignal.timeout(12000) },
      );
      if (!response.ok)
        throw new Error("Could not remove this medication. Please try again.");
      await fetchData();
    } catch {
      setError("Could not remove this medication. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" id="medications" aria-labelledby="meds-title">
      <div className="panel-header">
        <div className="panel-title">
          <Icon name="capsule" size={23} />
          <div>
            <div className="panel-kicker">BUILD YOUR PICTURE</div>
            <h2 id="meds-title">Your medication list</h2>
          </div>
        </div>
        <span className="count-badge">
          {String(meds.length).padStart(2, "0")}
        </span>
      </div>
      <div className="panel-body">
        <p className="section-description">
          Start with a name. We’ll look for the connections.
        </p>
        <form className="input-row" onSubmit={addMed}>
          <div className="input-wrap">
            <Icon name="search" size={16} />
            <label className="sr-only" htmlFor="medication-name">
              Medication name
            </label>
            <input
              id="medication-name"
              value={newMed}
              onChange={(event) => setNewMed(event.target.value)}
              placeholder="e.g. Aspirin or Metformin"
              autoComplete="off"
              disabled={busy}
            />
          </div>
          <button className="primary-button" disabled={busy || !newMed.trim()}>
            {busy ? (
              <Icon name="spinner" className="spin" size={15} />
            ) : (
              <Icon name="plus" size={15} />
            )}{" "}
            Add
          </button>
        </form>
        {error && (
          <div className="notice error" role="alert">
            <Icon name="info" size={15} />
            <span>{error}</span>
            {status === "error" && (
              <button className="text-button" onClick={() => void fetchData()}>
                Retry
              </button>
            )}
          </div>
        )}
        <div className="list-heading">
          <span>MEDICATIONS IN THIS WORKSPACE</span>
          <span>
            {status === "loading" ? "LOADING…" : `${meds.length} ITEMS`}
          </span>
        </div>
        {meds.length === 0 ? (
          <div className="medication-empty">
            <div className="empty-art">
              <Icon name="capsule" size={26} />
            </div>
            <h3>A good place to begin.</h3>
            <p>
              Add your first medication above, or read a label with the tool
              below.
            </p>
          </div>
        ) : (
          <div>
            {meds.map((med) => (
              <div className="med-row" key={med.drugbank_id}>
                <Icon name="capsule" />
                <div>
                  <strong>{med.name}</strong>
                  <small>{med.drugbank_id}</small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Remove ${med.name}`}
                  disabled={busy}
                  onClick={() => void removeMed(med.drugbank_id)}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div aria-live="polite">
          {status === "loading" && meds.length >= 2 && (
            <div className="notice">
              <Icon name="spinner" className="spin" size={15} />
              Checking recorded interactions…
            </div>
          )}
          {status === "ready" &&
            meds.length >= 2 &&
            interactions.length === 0 && (
              <div className="notice success">
                <Icon name="check" size={15} />
                <span>
                  No recorded interactions found for this list. This does not
                  rule out every risk.
                </span>
              </div>
            )}
          {status === "ready" && interactions.length > 0 && (
            <div className="interaction-list">
              <h3>
                {interactions.length} recorded{" "}
                {interactions.length === 1 ? "interaction" : "interactions"} to
                review
              </h3>
              {interactions.map((interaction, index) => (
                <article key={index}>
                  <strong>
                    {interaction.drug1.name} + {interaction.drug2.name}
                  </strong>
                  <p>{interaction.description}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="panel-bottom">
        <Icon name="branch" size={14} />
        <span>Add two or more medications to check interactions.</span>
      </div>
    </section>
  );
}
