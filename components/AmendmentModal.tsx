
import React from 'react';
import { AmendmentProposal } from '../types';

interface AmendmentModalProps {
  proposal: AmendmentProposal;
  onAccept: () => void;
  onReject: () => void;
}

const AmendmentModal: React.FC<AmendmentModalProps> = ({ proposal, onAccept, onReject }) => {
  const formatChange = (text: string) => {
    return text.split('\n').map((line, index) => {
      const lineClass = line.startsWith('+') ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 
                        line.startsWith('-') ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' : '';
      return (
        <span key={index} className={`block px-2 ${lineClass}`}>
          {line}
        </span>
      );
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 sm:p-8">
          <header className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Prompt Amendment Proposal
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              The AI has suggested a change to the translation prompt based on recent feedback.
            </p>
          </header>

          <div className="space-y-6 text-sm sm:text-base">
            <div>
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Observation</h3>
              <p className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-gray-700 dark:text-gray-300 italic">
                {proposal.observation}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Current Rule</h3>
              <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-gray-700 dark:text-gray-300 font-mono text-xs sm:text-sm whitespace-pre-wrap">
                <code>{proposal.currentRule}</code>
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Proposed Change</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/50 p-3 rounded-lg font-mono text-xs sm:text-sm whitespace-pre-wrap">
                <code>{formatChange(proposal.proposedChange)}</code>
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Reasoning</h3>
              <p className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-gray-700 dark:text-gray-300">
                {proposal.reasoning}
              </p>
            </div>
          </div>
        </div>

        <footer className="px-6 sm:px-8 py-4 bg-gray-50 dark:bg-gray-700/50 sticky bottom-0 flex justify-end items-center gap-4">
          <button
            onClick={onReject}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition"
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition"
          >
            Accept & Update Prompt
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AmendmentModal;
