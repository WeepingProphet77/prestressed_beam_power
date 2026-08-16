import { useUiStyle } from './styleContext';

/**
 * UI Style picker for the header.
 *
 * Renders straight from the registry, so a newly registered style appears here
 * with no change to this file. A native <select> rather than a custom menu:
 * it is keyboard accessible and screen-reader correct for free, and it picks up
 * each style's own `color-scheme`.
 */
export default function StyleSelector() {
  const { styleId, setStyleId, styles } = useUiStyle();

  return (
    <div className="style-selector">
      <label className="style-selector-label" htmlFor="ui-style-select">
        Style
      </label>
      <select
        id="ui-style-select"
        value={styleId}
        onChange={(e) => setStyleId(e.target.value)}
        title={styles.find((s) => s.id === styleId)?.description}
      >
        {styles.map((s) => (
          <option key={s.id} value={s.id} title={s.description}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
