import { useEffect, useState } from "react";
import Icon from "./Icon";
import type { DrugMatch, Interaction, Medication } from "./types";

interface DrugDetails extends Medication {
  description?: string;
  indication?: string;
  drug_interaction_count: number;
  food_interactions: string[];
}

type CheckState = "idle" | "checking" | "ready" | "error";

export default function MedicationListComponent({ meds, onAdd, onRemove, onAsk }: {
  meds: Medication[];
  onAdd: (drug: Medication) => void;
  onRemove: (id: string) => void;
  onAsk: () => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<DrugMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [checkError, setCheckError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<DrugDetails | null>(null);
  const ids = meds.map(med => med.drugbank_id).join(",");

  useEffect(() => {
    if (query.trim().length < 2) { setMatches([]); setSearching(false); setSearchError(""); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true); setSearchError("");
      try {
        const response = await fetch(`/api/drugs/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search is unavailable. Check the API connection.");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Search returned an invalid response.");
        setMatches(data);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setMatches([]);
        setSearchError(cause instanceof Error && cause.message.startsWith("Search") ? cause.message : "Search is unavailable. Check the API connection.");
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (meds.length < 2) { setInteractions([]); setCheckState("idle"); return; }
    const controller = new AbortController();
    setCheckState("checking"); setCheckError(""); setInteractions([]);
    fetch("/api/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drug_ids: ids.split(",") }), signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Interaction check unavailable. Try again later."); return response.json(); })
      .then(data => { if (!Array.isArray(data.interactions)) throw new Error("Interaction check returned an invalid response."); setInteractions(data.interactions); setCheckState("ready"); })
      .catch(() => { if (!controller.signal.aborted) { setCheckState("error"); setCheckError("Interaction check unavailable. Your list is saved on this device; try again later."); } });
    return () => controller.abort();
  }, [ids, meds.length]);

  useEffect(() => {
    if (!selectedId) { setDetails(null); return; }
    const controller = new AbortController();
    setDetails(null);
    fetch(`/api/drugs/${selectedId}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => setDetails(data))
      .catch(() => { if (!controller.signal.aborted) setDetails(null); });
    return () => controller.abort();
  }, [selectedId]);

  function add(drug: DrugMatch) {
    onAdd({ drugbank_id: drug.drugbank_id, name: drug.name });
    setSelectedId(drug.drugbank_id); setQuery(""); setMatches([]);
  }
  function remove(id: string) {
    onRemove(id);
    if (selectedId === id) setSelectedId(null);
  }
  return <div className="medication-layout">
    <section className="feature-card medication-card" aria-labelledby="list-heading">
      <div className="card-heading"><div><span className="overline">01 / YOUR LIST</span><h2 id="list-heading">My medications <span className="count-pill">{meds.length}</span></h2></div></div>
      <div className="search-box"><Icon name="search" size={22}/><label htmlFor="drug-search" className="sr-only">Find a medication</label><input id="drug-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search medication name or brand" autoComplete="off"/><span className="search-state">{searching ? "Searching…" : ""}</span></div>
      {searchError && <p className="inline-error" role="alert">{searchError}</p>}
      {query.trim().length >= 2 && !searchError && !searching && <div className="search-results" aria-label="Medication search results">{matches.length ? matches.map(drug => <button key={drug.drugbank_id} className="search-result" onClick={() => add(drug)} disabled={meds.length >= 25 || meds.some(item => item.drugbank_id === drug.drugbank_id)}><span><strong>{drug.name}</strong><small>{drug.matched_term && drug.matched_term.toLowerCase() !== drug.name.toLowerCase() ? `Matched ${drug.matched_term} · ` : ""}{drug.drugbank_id}{drug.match_score < 100 ? ` · ${Math.round(drug.match_score)}% match` : ""}</small></span><span>{meds.some(item => item.drugbank_id === drug.drugbank_id) ? "Added" : meds.length >= 25 ? "List full" : "+ Add"}</span></button>) : <p className="search-no-match">No matches. Try a generic or brand name.</p>}</div>}
      <div className="med-list">{meds.length === 0 ? <div className="empty-state"><Icon name="capsule" size={38}/><h3>No medications yet</h3><p>Search above to add your first medication. Your list stays on this device.</p></div> : meds.map(med => <div className={`medication-row ${selectedId === med.drugbank_id ? "selected" : ""}`} key={med.drugbank_id}><button className="medication-name" onClick={() => setSelectedId(med.drugbank_id)} aria-label={`View ${med.name} details`}><Icon name="capsule" size={22}/><span><strong>{med.name}</strong><small>{med.drugbank_id}</small></span><Icon name="arrow" size={18}/></button><button className="remove-button" aria-label={`Remove ${med.name}`} onClick={() => remove(med.drugbank_id)}><Icon name="close" size={17}/></button></div>)}</div>
      {meds.length >= 25 && <p className="inline-error">The list supports up to 25 medications.</p>}
      {meds.length > 0 && <p className="storage-note"><Icon name="info" size={16}/>Saved in this browser. Clearing browser data removes the list.</p>}
    </section>
    <div className="insight-column">
      <section className="feature-card insight-card" aria-labelledby="interactions-heading"><div className="card-heading"><div><span className="overline">02 / CHECK</span><h2 id="interactions-heading">Interactions</h2></div><span className={checkState === "ready" && interactions.length > 0 ? "status-badge attention" : "status-badge"}>{checkState === "checking" ? "Checking" : checkState === "ready" ? `${interactions.length} recorded` : checkState === "error" ? "Unavailable" : "Ready"}</span></div>
        {meds.length < 2 ? <div className="insight-empty"><Icon name="branch" size={28}/><p>Add two medications to check for recorded interactions.</p></div> : checkState === "checking" ? <p className="insight-empty"><Icon name="spinner" className="spin" size={22}/>Checking your list…</p> : checkState === "error" ? <p className="inline-error" role="alert">{checkError}</p> : interactions.length ? <div className="interaction-items">{interactions.map((item, index) => <article key={`${item.drug_id}-${item.interacting_drug_id}-${index}`}><strong>{item.drug_name} + {item.interacting_drug_name}</strong><p>{item.description}</p></article>)}</div> : <div className="insight-empty success"><Icon name="check" size={28}/><p>No interactions recorded for this list. This does not rule out every risk.</p></div>}
      </section>
      <section className="feature-card detail-card" aria-labelledby="detail-heading"><div className="card-heading"><div><span className="overline">03 / EXPLORE</span><h2 id="detail-heading">Medication details</h2></div></div>{details ? <div className="drug-details"><h3>{details.name}</h3><p>{details.description || "No description recorded."}</p>{details.indication && <><h4>Recorded indication</h4><p>{details.indication}</p></>}{details.food_interactions?.length > 0 && <><h4>Food interactions</h4><ul>{details.food_interactions.map((item, index) => <li key={index}>{item}</li>)}</ul></>}<a href={`https://go.drugbank.com/drugs/${details.drugbank_id}`} target="_blank" rel="noreferrer">Open DrugBank record ↗</a></div> : <div className="insight-empty"><Icon name="book" size={27}/><p>{selectedId ? "Loading details…" : "Choose a medication from your list to view its DrugBank record."}</p></div>}</section>
      <button className="ask-list-button" onClick={onAsk}><Icon name="conversation" size={20}/>Ask about my medications<Icon name="arrow" size={18}/></button>
    </div>
  </div>;
}
