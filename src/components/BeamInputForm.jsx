import { useState } from 'react';
import steelPresets from '../data/steelPresets';

const DEFAULT_SECTION = {
  sectionType: 'rectangular',
  bf: 12,
  bw: 12,
  hf: 0,
  h: 24,
  fc: 6,
  // Sandwich shape parameters
  bt: 16,  // top rectangle width
  ht: 8,   // top rectangle height
  hg: 4,   // gap height
  bb: 16,  // bottom rectangle width
  hb: 8,   // bottom rectangle height
};

const DEFAULT_LAYER = {
  steelPresetId: 'grade270',
  area: 1.53,
  depth: 20,
  fse: 170,
};

export default function BeamInputForm({ onCalculate }) {
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [layers, setLayers] = useState([{ ...DEFAULT_LAYER, id: 1 }]);
  const [nextId, setNextId] = useState(2);

  const handleSectionChange = (field, value) => {
    const updated = { ...section, [field]: value };
    // Sync rectangular constraints
    if (field === 'sectionType') {
      if (value === 'rectangular') {
        updated.bf = updated.bw;
        updated.hf = 0;
      } else if (value === 'tbeam') {
        updated.hf = updated.hf || 6;
        updated.bf = updated.bf || updated.bw + 12;
      } else if (value === 'sandwich') {
        updated.bt = updated.bt || 16;
        updated.ht = updated.ht || 8;
        updated.hg = updated.hg || 4;
        updated.bb = updated.bb || 16;
        updated.hb = updated.hb || 8;
        updated.h = updated.ht + updated.hg + updated.hb;
      }
    }
    // Update total height for sandwich when individual heights change
    if (updated.sectionType === 'sandwich' && ['ht', 'hg', 'hb'].includes(field)) {
      updated.h = parseFloat(updated.ht) + parseFloat(updated.hg) + parseFloat(updated.hb);
    }
    if (field === 'bw' && updated.sectionType === 'rectangular') {
      updated.bf = updated.bw;
    }
    setSection(updated);
  };

  const handleLayerChange = (id, field, value) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        if (field === 'steelPresetId') {
          const preset = steelPresets.find((p) => p.id === value);
          if (preset) {
            updated.fse = preset.defaultFse;
          }
        }
        return updated;
      })
    );
  };

  const addLayer = () => {
    setLayers((prev) => [...prev, { ...DEFAULT_LAYER, id: nextId }]);
    setNextId((n) => n + 1);
  };

  const removeLayer = (id) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalSection = {
      ...section,
      bf: section.sectionType === 'rectangular' ? section.bw : parseFloat(section.bf),
      bw: parseFloat(section.bw),
      hf: section.sectionType === 'rectangular' ? parseFloat(section.h) : parseFloat(section.hf),
      h: parseFloat(section.h),
      fc: parseFloat(section.fc),
      // Sandwich parameters
      bt: parseFloat(section.bt),
      ht: parseFloat(section.ht),
      hg: parseFloat(section.hg),
      bb: parseFloat(section.bb),
      hb: parseFloat(section.hb),
    };
    const finalLayers = layers.map((l) => {
      const preset = steelPresets.find((p) => p.id === l.steelPresetId);
      return {
        area: parseFloat(l.area),
        depth: parseFloat(l.depth),
        fse: parseFloat(l.fse) || 0,
        steel: preset,
        name: preset.name,
      };
    });
    onCalculate(finalSection, finalLayers);
  };

  return (
    <form onSubmit={handleSubmit} className="input-form">
      {/* ── Section Geometry ── */}
      <div className="form-section">
        <h3>
          <span className="section-icon">&#9634;</span>
          Section Geometry
        </h3>

        <div className="form-row">
          <label>
            <span className="label-text">Section Type</span>
            <select
              value={section.sectionType}
              onChange={(e) => handleSectionChange('sectionType', e.target.value)}
            >
              <option value="rectangular">Rectangular</option>
              <option value="tbeam">T-Beam</option>
              <option value="sandwich">Sandwich</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          {section.sectionType === 'tbeam' && (
            <label>
              <span className="label-text">Flange Width, b<sub>f</sub> (in)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={section.bf}
                onChange={(e) => handleSectionChange('bf', e.target.value)}
              />
            </label>
          )}
          {section.sectionType !== 'sandwich' && (
            <label>
              <span className="label-text">{section.sectionType === 'tbeam' ? 'Web' : 'Beam'} Width, b<sub>w</sub> (in)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={section.bw}
                onChange={(e) => handleSectionChange('bw', parseFloat(e.target.value))}
              />
            </label>
          )}
          {section.sectionType === 'tbeam' && (
            <label>
              <span className="label-text">Flange Depth, h<sub>f</sub> (in)</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={section.hf}
                onChange={(e) => handleSectionChange('hf', e.target.value)}
              />
            </label>
          )}
          {section.sectionType === 'sandwich' && (
            <>
              <label>
                <span className="label-text">Top Width, b<sub>t</sub> (in)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={section.bt}
                  onChange={(e) => handleSectionChange('bt', e.target.value)}
                />
              </label>
              <label>
                <span className="label-text">Top Height, h<sub>t</sub> (in)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={section.ht}
                  onChange={(e) => handleSectionChange('ht', e.target.value)}
                />
              </label>
            </>
          )}
          {section.sectionType !== 'sandwich' && (
            <label>
              <span className="label-text">Total Depth, h (in)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={section.h}
                onChange={(e) => handleSectionChange('h', e.target.value)}
              />
            </label>
          )}
        </div>

        {section.sectionType === 'sandwich' && (
          <div className="form-row">
            <label>
              <span className="label-text">Gap Height, h<sub>g</sub> (in)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={section.hg}
                onChange={(e) => handleSectionChange('hg', e.target.value)}
              />
            </label>
            <label>
              <span className="label-text">Bottom Width, b<sub>b</sub> (in)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={section.bb}
                onChange={(e) => handleSectionChange('bb', e.target.value)}
              />
            </label>
            <label>
              <span className="label-text">Bottom Height, h<sub>b</sub> (in)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={section.hb}
                onChange={(e) => handleSectionChange('hb', e.target.value)}
              />
            </label>
            <label className="computed">
              <span className="label-text">Total Depth, h (in)</span>
              <span className="computed-value">
                {section.h.toFixed(1)}
              </span>
            </label>
          </div>
        )}

        <div className="form-row">
          <label>
            <span className="label-text">f'<sub>c</sub> (ksi)</span>
            <input
              type="number"
              step="0.5"
              min="2"
              max="16"
              value={section.fc}
              onChange={(e) => handleSectionChange('fc', e.target.value)}
            />
          </label>
          <label className="computed">
            <span className="label-text">&beta;<sub>1</sub></span>
            <span className="computed-value">
              {section.fc <= 4
                ? '0.850'
                : section.fc >= 8
                ? '0.650'
                : (0.85 - 0.05 * (section.fc - 4)).toFixed(3)}
            </span>
          </label>
        </div>
      </div>

      {/* ── Steel Layers ── */}
      <div className="form-section">
        <h3>
          <span className="section-icon">&#9881;</span>
          Steel Reinforcement Layers
        </h3>

        <div className="layers-info">
          Depth is measured from the extreme compression fiber.
          For prestressing steel, enter the effective prestress <span style={{whiteSpace: 'nowrap'}}>(f<sub>se</sub>)</span> after all losses.
        </div>

        {layers.map((layer, idx) => {
          const preset = steelPresets.find((p) => p.id === layer.steelPresetId);
          const isMild = preset?.category === 'mild';

          return (
            <div key={layer.id} className="steel-layer-card">
              <div className="layer-header">
                <span className="layer-number">Layer {idx + 1}</span>
                {layers.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeLayer(layer.id)}
                    title="Remove layer"
                  >
                    &times;
                  </button>
                )}
              </div>
              <div className="form-row">
                <label>
                  <span className="label-text">Steel Type</span>
                  <select
                    value={layer.steelPresetId}
                    onChange={(e) => handleLayerChange(layer.id, 'steelPresetId', e.target.value)}
                  >
                    <optgroup label="Mild Steel">
                      {steelPresets
                        .filter((p) => p.category === 'mild')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Prestressing Steel">
                      {steelPresets
                        .filter((p) => p.category === 'prestressing')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </label>
                <label>
                  <span className="label-text">A<sub>s</sub> (in&sup2;)</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={layer.area}
                    onChange={(e) => handleLayerChange(layer.id, 'area', e.target.value)}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  <span className="label-text">Depth, d (in)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={layer.depth}
                    onChange={(e) => handleLayerChange(layer.id, 'depth', e.target.value)}
                  />
                </label>
                <label className={isMild ? 'disabled-field' : ''}>
                  <span className="label-text">f<sub>se</sub> (ksi)</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={isMild ? 0 : layer.fse}
                    disabled={isMild}
                    onChange={(e) => handleLayerChange(layer.id, 'fse', e.target.value)}
                  />
                  {isMild && <span className="field-note">N/A for mild steel</span>}
                </label>
              </div>
              <div className="preset-info">
                <span style={{whiteSpace: 'nowrap'}}>E<sub>s</sub>={preset?.Es?.toLocaleString()} ksi</span>
                <span style={{whiteSpace: 'nowrap'}}>f<sub>py</sub>={preset?.fpy} ksi</span>
                <span style={{whiteSpace: 'nowrap'}}>f<sub>pu</sub>={preset?.fpu} ksi</span>
                <span style={{whiteSpace: 'nowrap'}}>Q={preset?.Q}</span>
                <span style={{whiteSpace: 'nowrap'}}>R={preset?.R}</span>
                <span style={{whiteSpace: 'nowrap'}}>K={preset?.K}</span>
              </div>
            </div>
          );
        })}

        <button type="button" className="btn-add-layer" onClick={addLayer}>
          + Add Steel Layer
        </button>
      </div>

      <button type="submit" className="btn-calculate">
        Calculate Beam Strength
      </button>
    </form>
  );
}
