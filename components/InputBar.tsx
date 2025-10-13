import React, { useState } from 'react';
import { useAppStore } from '../store';
import { SUPPORTED_WEBSITES_CONFIG } from '../constants';

const InputBar: React.FC = () => {
  const [url, setUrl] = useState('');
  const handleFetch = useAppStore(state => state.handleFetch);
  const isLoading = useAppStore(state => state.isLoading.fetching);
  const error = useAppStore(state => state.error);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      handleFetch(url.trim());
    }
  };
  
  const handleExampleClick = (exampleUrl: string) => {
    setUrl(exampleUrl);
    handleFetch(exampleUrl);
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste link to the chapter of the novel you want to start translating..."
            className="flex-grow w-full px-4 py-2 text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition duration-300 ease-in-out"
          >
            {isLoading ? 'Fetching...' : 'Fetch Chapter'}
          </button>
        </div>
      </form>
       <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        <span className="font-semibold">Find the novel you want to read from these supported websites:</span>
        {' '}
        {/* Group websites by category */}
        {Object.entries(
          SUPPORTED_WEBSITES_CONFIG.reduce((acc, site) => {
            if (!acc[site.category]) acc[site.category] = [];
            acc[site.category].push(site);
            return acc;
          }, {} as Record<string, typeof SUPPORTED_WEBSITES_CONFIG>)
        ).map(([category, sites], categoryIndex, categories) => (
          <React.Fragment key={category}>
            {sites.map((site, siteIndex) => (
              <React.Fragment key={site.domain}>
                <a
                  href={site.homeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                  title={`Visit ${site.name} - ${category}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleExampleClick(site.exampleUrl);
                  }}
                >
                  {site.name}
                </a>
                {siteIndex < sites.length - 1 && ', '}
              </React.Fragment>
            ))}
            {' '}
            <span className="text-gray-500">({category})</span>
            {categoryIndex < categories.length - 1 && '; '}
          </React.Fragment>
        ))}
        {' and you can '}
        <a
          href="https://t.me/webnovels"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          request for us to add support for your fav website here!
        </a>
      </div>
      {error && <p className="mt-3 text-red-500 dark:text-red-400 text-center font-medium">{error}</p>}
    </div>
  );
};

export default InputBar;
