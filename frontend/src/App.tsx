import { useEffect, useRef, useState } from "react";
import ChatComponent from "./ChatComponent";
import ScannerComponent from "./ScannerComponent";
import MedicationListComponent from "./MedicationListComponent";
import Icon, { BrandMark } from "./Icon";
import OrbitalField from "./OrbitalField";

function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [motionPaused, setMotionPaused] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const guide = useRef<HTMLDialogElement>(null);
  const guideOpener = useRef<HTMLElement | null>(null);
  const closeGuide = () => {
    guide.current?.close();
    setGuideOpen(false);
    guideOpener.current?.focus();
  };
  useEffect(() => {
    if (guideOpen) guide.current?.showModal();
  }, [guideOpen]);
  const [active, setActive] = useState("workspace");
  const refreshMeds = () => setRefreshKey((key) => key + 1);
  return (
    <div className={`app-shell ${motionPaused ? "motion-paused" : ""}`}>
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a className="brand" href="#workspace" aria-label="SentinelRx home">
          <BrandMark />
          <span>
            sentinel<span className="brand-rx">rx</span>
            <small>MEDICATION CLARITY</small>
          </span>
        </a>
        <div className="sidebar-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "workspace", label: "Overview", icon: "overview" },
              { id: "medications", label: "Medication list", icon: "capsule" },
              { id: "scanner", label: "Read a label", icon: "scan" },
              {
                id: "assistant",
                label: "Ask a question",
                icon: "conversation",
              },
            ] as const
          ).map((item) => (
            <a
              key={item.id}
              aria-label={item.label}
              href={`#${item.id}`}
              className={active === item.id ? "nav-link active" : "nav-link"}
              onClick={() => setActive(item.id)}
              aria-current={active === item.id ? "location" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {active === item.id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name="book" size={24} />
            <h3>Knowledge, with care.</h3>
            <p>
              A starting point for better conversations with your pharmacist.
            </p>
            <button
              className="text-button"
              onClick={(event) => {
                guideOpener.current = event.currentTarget;
                setGuideOpen(true);
              }}
            >
              How to use Sentinel <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="sidebar-edition">
            <span className="edition-mark">S / Rx</span>
            <span>
              Personal workspace<small>DrugBank-powered reference</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb">/</span>{" "}
            <strong>Overview</strong>
          </span>
          <div className="topbar-actions">
            <button
              className="quiet-button"
              aria-label="How to use Sentinel"
              onClick={(event) => {
                guideOpener.current = event.currentTarget;
                setGuideOpen(true);
              }}
            >
              <Icon name="info" size={15} />
              <span>Guide</span>
            </button>
            <button
              className="quiet-button"
              onClick={() => setMotionPaused(!motionPaused)}
              aria-pressed={motionPaused}
            >
              <Icon name={motionPaused ? "play" : "pause"} size={14} /> Motion{" "}
              {motionPaused ? "off" : "on"}
            </button>
          </div>
        </header>
        <main id="workspace">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> A LITTLE MORE CERTAINTY
              </div>
              <h1>
                Your medications.
                <br />
                <em>A clearer picture.</em>
              </h1>
              <p>
                Bring your medications together. Understand how they interact.
                Make room for better questions.
              </p>
              <a
                className="hero-link"
                href="#medication-name"
                onClick={() => {
                  setActive("medications");
                  document.getElementById("medication-name")?.focus();
                }}
              >
                Start with a medication <Icon name="arrow" size={18} />
              </a>
            </div>
            <OrbitalField />
          </section>
          <div className="workspace-heading">
            <div>
              <span className="section-index">01 /</span>
              <h2>Your medication workspace</h2>
            </div>
            <span className="workspace-hint">
              One place to see the connections.
            </span>
          </div>
          <div className="workspace-grid">
            <div className="tools-column">
              <MedicationListComponent refreshKey={refreshKey} />
              <ScannerComponent onMedsAdded={refreshMeds} />
            </div>
            <ChatComponent />
          </div>
          <footer>
            <span>
              <BrandMark /> Thoughtful tools. Informed conversations.
            </span>
            <p>
              For information, not a diagnosis. Review medication decisions with
              your pharmacist or clinician.
            </p>
            <a
              href="https://www.radix-ui.com/colors"
              target="_blank"
              rel="noreferrer"
            >
              Palette: Sage & Teal <span aria-hidden="true">↗</span>
            </a>
          </footer>
        </main>
      </div>
      {guideOpen && (
        <div className="modal-backdrop" onClick={closeGuide}>
          <dialog
            ref={guide}
            className="guide-dialog"
            onCancel={(event) => {
              event.preventDefault();
              closeGuide();
            }}
            aria-labelledby="guide-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              autoFocus
              className="icon-button modal-close"
              onClick={closeGuide}
              aria-label="Close guide"
            >
              <Icon name="close" />
            </button>
            <span className="eyebrow">A SIMPLE START</span>
            <h2 id="guide-title">Know what goes together.</h2>
            <ol>
              <li>
                <strong>Build your list.</strong>
                <p>
                  Add medications by name, or upload a clear photo of a label
                  and review the detected names.
                </p>
              </li>
              <li>
                <strong>Review the connections.</strong>
                <p>
                  With two or more medications, the workspace checks for
                  recorded interactions.
                </p>
              </li>
              <li>
                <strong>Bring better questions.</strong>
                <p>
                  Use the reference assistant to explore medication information,
                  then discuss decisions with your care team.
                </p>
              </li>
            </ol>
            <p className="small-note">
              This prototype uses a shared demo list. Do not enter personal or
              identifying information.
            </p>
            <button className="primary-button" onClick={closeGuide}>
              Back to workspace <Icon name="arrow" size={16} />
            </button>
          </dialog>
        </div>
      )}
    </div>
  );
}
export default App;
