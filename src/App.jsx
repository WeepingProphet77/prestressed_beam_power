import { useState, useRef } from 'react';
import BeamInputForm from './components/BeamInputForm';
import BeamDiagram from './components/BeamDiagram';
import StressStrainChart from './components/StressStrainChart';
import StrainDiagram from './components/StrainDiagram';
import ResultsPanel from './components/ResultsPanel';
import DesignGauges from './components/DesignGauges';
import ExportDialog from './components/ExportDialog';
import InteractionDiagram from './components/InteractionDiagram';
import BiaxialResults from './components/BiaxialResults';
import { analyzeBeam, analyzeBiaxial, polygonProperties } from './utils/beamCalculations';
import generatePdfReport from './utils/generatePdfReport';
import './App.css';

export default function App() {
  const [results, setResults] = useState(null);
  const [section, setSection] = useState(null);
  const [error, setError] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const resultsRef = useRef(null);

  const handleCalculate = (sec, layers, preError) => {
    setError(null);
    try {
      if (preError) {
        throw new Error(preError);
      }
      if (!layers.length) {
        throw new Error('Add at least one steel reinforcement layer.');
      }
      if (sec.sectionType === 'custom' || sec.sectionType === 'dxf') {
        if (!sec.points || sec.points.length < 3) {
          throw new Error(
            sec.sectionType === 'dxf'
              ? 'Import a DXF with a closed outer polyline before calculating.'
              : 'Draw and close the outer shape (at least 3 nodes) before calculating.'
          );
        }
        const { A } = polygonProperties(sec);
        if (!(A > 0)) {
          throw new Error(
            sec.sectionType === 'dxf'
              ? 'The imported section has zero or invalid area. Check that the outline does not self-intersect and openings lie inside it.'
              : 'The drawn section has zero or invalid area. Check that the outline does not self-intersect and holes lie inside it.'
          );
        }
      }
      for (let i = 0; i < layers.length; i++) {
        const l = layers[i];
        if (l.depth <= 0 || l.depth > sec.h) {
          throw new Error(
            `Layer ${i + 1}: depth must be between 0 and total beam depth (${sec.h} in).`
          );
        }
        if (l.area <= 0) {
          throw new Error(`Layer ${i + 1}: steel area must be positive.`);
        }
        if (sec.bendingMode === 'biaxial' && (l.x === undefined || Number.isNaN(l.x))) {
          throw new Error(`Layer ${i + 1}: lateral location x is required for biaxial bending.`);
        }
      }

      let res;
      if (sec.bendingMode === 'biaxial') {
        res = analyzeBiaxial(sec, layers, {
          Mux: sec.Mux, Muy: sec.Muy, MxService: sec.MxService, MyService: sec.MyService,
        });
      } else {
        res = analyzeBeam(sec, layers);
        const totalSteel = res.layerResults.reduce((s, lr) => s + lr.force, 0);
        const equilibriumError = Math.abs(res.Cc - totalSteel);
        if (!res.converged || equilibriumError > 0.1) {
          throw new Error(
            `Solution did not converge — no force equilibrium found within the section ` +
            `(equilibrium error = ${equilibriumError.toFixed(3)} kips). Check that the steel ` +
            `area, depths, and section dimensions are physically reasonable.`
          );
        }
      }

      setResults(res);
      setSection(sec);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (e) {
      setError(e.message);
      setResults(null);
      setSection(null);
    }
  };

  const handleExport = async (info) => {
    setExporting(true);
    try {
      await generatePdfReport(results, section, info);
    } catch (e) {
      console.error('PDF generation failed:', e);
    } finally {
      setExporting(false);
      setExportOpen(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" focusable="false">
                <path d="M7 4 L32 4 L32 25 L7 25 A3 3 0 0 1 4 22 L4 7 A3 3 0 0 1 7 4 Z" fill="#1F4E79" />
                <path d="M32 4 L57 4 A3 3 0 0 1 60 7 L60 22 A3 3 0 0 1 57 25 L32 25 Z" fill="#D7DADD" />
                <rect x="4" y="30" width="25.5" height="30" rx="3" fill="#2E3A44" />
                <rect x="34.5" y="30" width="25.5" height="30" rx="3" fill="#A7ACB3" />
              </svg>
            </span>
            <span className="brand-wordmark">Tessera</span>
          </div>
          <div className="header-divider" aria-hidden="true"></div>
          <div className="header-text">
            <h1>Prestressed Concrete Beam Calculator</h1>
            <p className="subtitle">
              Flexural strength analysis using the Devalapura&#8211;Tadros / PCI power formula
            </p>
          </div>
          <div className="header-badge">ACI 318-19</div>
          {results && results.mode !== 'biaxial' && (
            <button
              type="button"
              className="btn-export-pdf"
              onClick={() => setExportOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M4 1h5l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 10.5l2 2 2-2M7.5 12.5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export PDF
            </button>
          )}
        </div>
      </header>

      <main className={`app-main${results ? ' has-results' : ''}`}>
        <div className="input-column">
          <BeamInputForm onCalculate={handleCalculate} />
        </div>

        <div className="output-column">
          {error && (
            <div className="error-banner">
              <span className="error-icon">!</span>
              <div>
                <strong>Calculation Error</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {results && results.mode === 'biaxial' && (
            <div className="results-column" ref={resultsRef}>
              <BiaxialResults results={results} />
            </div>
          )}
          {results && results.mode !== 'biaxial' && (
            <div className="results-column" ref={resultsRef}>
              <DesignGauges results={results} />
              <ResultsPanel results={results} />
            </div>
          )}
        </div>

        {results && results.mode === 'biaxial' && (
          <div className="diagrams-section">
            <div className="diagrams-row">
              <InteractionDiagram results={results} />
            </div>
          </div>
        )}
        {results && results.mode !== 'biaxial' && (
          <div className="diagrams-section">
            <div className="diagrams-row">
              <BeamDiagram section={section} results={results} />
              <StrainDiagram results={results} />
              <StressStrainChart results={results} />
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p className="footer-brand">
            <strong className="footer-brand-name">Tessera</strong>
            <span className="footer-brand-tag">Structural Engineering Software</span>
          </p>
          <p>
            Based on <strong>ACI 318-19</strong> and the <strong>Devalapura&#8211;Tadros power formula</strong> for
            steel stress&#8211;strain behavior (PCI Design Handbook).
          </p>
          <p className="disclaimer">
            For educational and preliminary design purposes only. Final designs must be
            verified by a licensed professional engineer.
          </p>
        </div>
      </footer>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}
