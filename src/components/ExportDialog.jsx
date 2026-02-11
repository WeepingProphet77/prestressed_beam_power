import { useState } from 'react';

/**
 * Modal dialog for collecting report metadata before PDF export.
 * Fields: Designer Name, Job Name, Job Number, Design Number, Date.
 */
export default function ExportDialog({ open, onClose, onExport, exporting }) {
  const today = new Date().toISOString().slice(0, 10);

  const [info, setInfo] = useState({
    designerName: '',
    jobName: '',
    jobNumber: '',
    designNumber: '',
    date: today,
  });

  const handleChange = (field, value) => {
    setInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onExport(info);
  };

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Export PDF Report</h3>
          <button type="button" className="dialog-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            <label className="dialog-field">
              <span className="dialog-label">Designer Name</span>
              <input
                type="text"
                value={info.designerName}
                onChange={(e) => handleChange('designerName', e.target.value)}
                placeholder="e.g. Jane Smith, PE"
                autoFocus
              />
            </label>
            <label className="dialog-field">
              <span className="dialog-label">Job Name</span>
              <input
                type="text"
                value={info.jobName}
                onChange={(e) => handleChange('jobName', e.target.value)}
                placeholder="e.g. Highway Bridge Girder"
              />
            </label>
            <div className="dialog-row">
              <label className="dialog-field">
                <span className="dialog-label">Job Number</span>
                <input
                  type="text"
                  value={info.jobNumber}
                  onChange={(e) => handleChange('jobNumber', e.target.value)}
                  placeholder="e.g. 2025-0142"
                />
              </label>
              <label className="dialog-field">
                <span className="dialog-label">Design Number</span>
                <input
                  type="text"
                  value={info.designNumber}
                  onChange={(e) => handleChange('designNumber', e.target.value)}
                  placeholder="e.g. DWG-B12"
                />
              </label>
            </div>
            <label className="dialog-field">
              <span className="dialog-label">Date</span>
              <input
                type="date"
                value={info.date}
                onChange={(e) => handleChange('date', e.target.value)}
              />
            </label>
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn-dialog-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-dialog-export" disabled={exporting}>
              {exporting ? 'Generating PDF...' : 'Generate PDF'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
