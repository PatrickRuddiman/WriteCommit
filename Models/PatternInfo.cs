namespace WriteCommit.Models;

public class PatternInfo
{
    public string Name { get; set; } = string.Empty;
    public string LastUpdateHash { get; set; } = string.Empty;
    public DateTime LastChecked { get; set; }
    public DateTime LastInstalled { get; set; }
}
