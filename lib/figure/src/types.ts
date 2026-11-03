export type FunctionGraph = {
  kind: 'function-graph';
  /** Latin, variable `x`. */
  functions: { expr: string; label?: string }[];
  /** The domain drawn. */
  x: [number, number];
  /** The range drawn; fitted to the samples when absent. */
  y?: [number, number];
  /** Marked points: the model gives only x, the y is computed on the curve. */
  points?: { at: number; label: string; on?: number }[];
};

export type VectorsFigure = {
  kind: 'vectors';
  vectors: { from: [number, number]; to: [number, number]; label?: string }[];
  /** Dashed horizontal and vertical parts of each vector. */
  components?: boolean;
};

/** Open on purpose: `resolveFigure` returns null for a kind this build does not know. */
export type Figure = FunctionGraph | VectorsFigure;
