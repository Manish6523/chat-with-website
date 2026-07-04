import Spinner from "@/components/Spinner";

interface IndexResult {
  pagesIndexed: number;
  chunksCreated: number;
}

interface UrlIndexerProps {
  urlInput: string;
  onUrlChange: (value: string) => void;
  onIndex: () => void;
  isIndexing: boolean;
  indexResult: IndexResult | null;
  indexError: string | null;
}

export default function UrlIndexer({
  urlInput,
  onUrlChange,
  onIndex,
  isIndexing,
  indexResult,
  indexError,
}: UrlIndexerProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <label htmlFor="url-input" className="block text-sm font-medium mb-2">
        Website URL
      </label>

      <div className="flex gap-2">
        <input
          id="url-input"
          type="url"
          placeholder="https://example.com"
          value={urlInput}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onIndex()}
          disabled={isIndexing}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                     disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          id="index-button"
          onClick={onIndex}
          disabled={isIndexing || !urlInput.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white
                     hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed
                     transition-colors"
        >
          {isIndexing ? "Indexing…" : "Index Site"}
        </button>
      </div>

      {/* Indexing spinner */}
      {isIndexing && (
        <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
          <Spinner />
          Indexing site… this may take a minute
        </div>
      )}

      {/* Success message */}
      {indexResult && (
        <p className="mt-3 text-sm text-green-700">
          ✓ Indexed{" "}
          <strong>{indexResult.pagesIndexed} page(s)</strong> →{" "}
          <strong>{indexResult.chunksCreated} chunk(s)</strong>.
          You can now ask questions below.
        </p>
      )}

      {/* Error message */}
      {indexError && (
        <p className="mt-3 text-sm text-red-600">
          ✗ {indexError}
        </p>
      )}
    </div>
  );
}
