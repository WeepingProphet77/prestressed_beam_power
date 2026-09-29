/**
 * Display a steel constant to six significant figures. Q, K and R are derived
 * from the published A, B, C, D at full precision, so printing them raw would
 * show sixteen digits of float.
 */
export function fmtConst(v) {
  return v == null ? '' : String(Number(v.toPrecision(6)));
}
