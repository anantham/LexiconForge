import React, { useState } from 'react';
import { useAppStore } from '../store';

const InputBar: React.FC = () => {
  const [url, setUrl] = useState('https://www.kanunu8.com/book3/7561/72829.html');
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
            placeholder="Enter chapter URL..."
            className="flex-grow w-full px-4 py-2 text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
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
        <span className="font-semibold">Examples:</span>
        <button onClick={() => handleExampleClick('https://www.kanunu8.com/book3/7561/72829.html')} className="ml-2 text-blue-500 hover:underline">Kanunu8</button>
        <button onClick={() => handleExampleClick('https://www.dxmwx.org/read/47693_37783373.html')} className="ml-2 text-blue-500 hover:underline">Dxmwx</button>
        {/* Novelcool removed from examples (English-only content) */}
        <button onClick={() => handleExampleClick('https://kakuyomu.jp/works/16816927859418072361/episodes/16817330667519070884')} className="ml-2 text-blue-500 hover:underline">Kakuyomu</button>
      </div>
      {error && <p className="mt-3 text-red-500 dark:text-red-400 text-center font-medium">{error}</p>}
    </div>
  );
};

export default InputBar;
