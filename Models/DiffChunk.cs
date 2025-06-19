namespace WriteCommit.Models;

public class DiffChunk
{
    public string FileName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int LineCount { get; set; }
    public string ChangeType { get; set; } = string.Empty; // Added, Modified, Deleted, Renamed
}
