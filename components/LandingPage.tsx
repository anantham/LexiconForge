import React from 'react';
import { ArrowDown } from 'lucide-react';
import { NovelLibrary } from './NovelLibrary';
import InputBar from './InputBar';

interface LandingPageProps {
  onSessionLoaded?: () => void;
}

export function LandingPage({ onSessionLoaded }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Section */}
        <header className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            Collaborative Novel Translator
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Read web novels with AI-powered, user-refined translations.
            Generate illustrations, add your feedback, and export to EPUB.
          </p>
        </header>

        {/* Novel Library Section */}
        <section className="mb-16">
          <NovelLibrary onSessionLoaded={onSessionLoaded} />
        </section>

        {/* Divider */}
        <div className="flex items-center justify-center my-12">
          <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
          <div className="px-6 flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <ArrowDown className="h-5 w-5" />
            <span className="text-sm font-medium">OR START FROM A URL</span>
            <ArrowDown className="h-5 w-5" />
          </div>
          <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
        </div>

        {/* URL Input Section */}
        <section className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-200 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
              Translate Any Web Novel Chapter
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
              Paste a URL from supported sites (Kakuyomu, Syosetu, Novel Updates, etc.)
            </p>
            <InputBar />

            {/* Supported Sites Help */}
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                View supported websites →
              </summary>
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 space-y-2 pl-4">
                <p>✅ Japanese: Kakuyomu, Syosetu, Alphapolis</p>
                <p>✅ Korean: Kakao Page, Naver Series, Munpia</p>
                <p>✅ Chinese: Qidian, JJWXC</p>
                <p>✅ English translations: Novel Updates, Wuxiaworld</p>
              </div>
            </details>
          </div>
        </section>

        {/* Footer Spacer */}
        <div className="h-16"></div>
      </div>
    </div>
  );
}
