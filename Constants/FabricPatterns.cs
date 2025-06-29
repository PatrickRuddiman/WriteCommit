namespace WriteCommit.Constants
{
    public static class FabricPatterns
    {
        /// <summary>
        /// Pattern used for summarizing individual diff chunks
        /// </summary>
        public const string ChunkPattern = "chunk_git_diff";

        /// <summary>
        /// Default pattern used for generating commit messages
        /// </summary>
        public const string CommitPattern = "write_commit_message";

        /// <summary>
        /// Pattern used when context overflow requires extra summarization
        /// </summary>
        public const string BrevityPattern = "brief_chunk_summary";
    }
}
