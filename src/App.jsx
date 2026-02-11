import { useState, useRef } from 'react';
import BeamInputForm from './components/BeamInputForm';
import BeamDiagram from './components/BeamDiagram';
import StressStrainChart from './components/StressStrainChart';
import StrainDiagram from './components/StrainDiagram';
import ResultsPanel from './components/ResultsPanel';
import { analyzeBeam } from './utils/beamCalculations';
import './App.css';

export default function App() {
  const [results, setResults] = useState(null);
  const [section, setSection] = useState(null);
  const [error, setError] = useState(null);
  const resultsRef = useRef(null);

  const handleCalculate = (sec, layers) => {
    setError(null);
    try {
      if (!layers.length) {
        throw new Error('Add at least one steel reinforcement layer.');
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
      }

      const res = analyzeBeam(sec, layers);

      const totalSteel = res.layerResults.reduce((s, lr) => s + lr.force, 0);
      const equilibriumError = Math.abs(res.Cc - totalSteel);
      if (equilibriumError > 0.1) {
        throw new Error(
          `Solution did not converge. Equilibrium error = ${equilibriumError.toFixed(3)} kips. Check your inputs.`
        );
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-badge">ACI 318-19</div>
          <div className="header-text">
            <h1>Prestressed Concrete Beam Calculator</h1>
            <p className="subtitle">
              Flexural strength analysis using the Devalapura&#8211;Tadros / PCI power formula
            </p>
          </div>
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

          {results && (
            <div className="results-column" ref={resultsRef}>
              <ResultsPanel results={results} />
            </div>
          )}
        </div>

        {results && (
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
    </div>
  );
}
