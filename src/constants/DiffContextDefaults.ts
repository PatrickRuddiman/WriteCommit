/**
 * Default thresholds used when analyzing diffs.
 */
export class DiffContextDefaults {
  /**
   * Maximum number of files considered a "small" diff.
   */
  static readonly SMALL_DIFF_FILE_THRESHOLD = 2;

  /**
   * Maximum total line count considered a "small" diff.
   */
  static readonly SMALL_DIFF_LINE_THRESHOLD = 20;

  /**
   * Extra context lines to fetch around changes in small diffs.
   */
  static readonly EXTRA_CONTEXT_LINES = 10;
}