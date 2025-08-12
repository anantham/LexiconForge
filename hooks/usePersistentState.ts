
import { useState, useEffect } from 'react';

function usePersistentState<T>(storageKey: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        try {
            const savedStateJSON = localStorage.getItem(storageKey);
            if (savedStateJSON !== null) {
                return JSON.parse(savedStateJSON);
            }
        } catch (error) {
            console.error(`Failed to load state for key "${storageKey}" from localStorage`, error);
        }
        
        return defaultValue;
    });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(value));
        } catch (error) {
            console.error(`Failed to save state for key "${storageKey}" to localStorage`, error);
        }
    }, [storageKey, value]);

    return [value, setValue];
}

export default usePersistentState;
