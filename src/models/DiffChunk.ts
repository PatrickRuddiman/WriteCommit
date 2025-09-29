export interface DiffChunk {
  fileName: string;
  content: string;
  lineCount: number;
  changeType: string; // Added, Modified, Deleted, Renamed
}