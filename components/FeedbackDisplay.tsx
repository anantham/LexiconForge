
import React, { useState } from 'react';
import { FeedbackItem } from '../types';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';

interface FeedbackDisplayProps {
    feedback: FeedbackItem[];
    onDelete: (feedbackId: string) => void;
    onUpdate: (feedbackId: string, comment: string) => void;
}

const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ feedback, onDelete, onUpdate }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');

    const handleEditClick = (item: FeedbackItem) => {
        setEditingId(item.id);
        setCommentText(item.comment || '');
    };

    const handleSave = () => {
        if (editingId) {
            onUpdate(editingId, commentText);
            setEditingId(null);
            setCommentText('');
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setCommentText('');
    };

    return (
        <div className="mt-8 pt-6 border-t border-gray-300 dark:border-gray-600">
            <h3 className="text-lg font-bold mb-4 font-sans">Your Feedback</h3>
            <div className="space-y-4">
                {feedback.map((item) => (
                    <div key={item.id} className="p-4 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
                        {editingId === item.id ? (
                            // Editing View
                            <div className="space-y-3">
                                <p className="font-semibold text-gray-800 dark:text-gray-200">
                                    <span className="text-2xl mr-2">{item.type}</span> on: "{item.selection}"
                                </p>
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Add a comment to explain your feedback..."
                                    className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 font-sans text-sm"
                                    rows={2}
                                />
                                <div className="flex items-center gap-2">
                                    <button onClick={handleSave} className="px-4 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">Save</button>
                                    <button onClick={handleCancel} className="px-4 py-1 bg-gray-300 dark:bg-gray-600 text-sm font-semibold rounded-md hover:bg-gray-400 dark:hover:bg-gray-500">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            // Display View
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-grow">
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                                        <span className="text-2xl mr-2">{item.type}</span> on: "{item.selection}"
                                    </p>
                                    {item.comment && (
                                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic pl-8">
                                            {item.comment}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => handleEditClick(item)} className="p-2 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition" title="Edit comment">
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onDelete(item.id)} className="p-2 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition" title="Delete feedback">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FeedbackDisplay;
