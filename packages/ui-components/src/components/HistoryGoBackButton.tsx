'use client';

import { IconArrowLeft } from '@tabler/icons-react';

const HistoryGoBackButton = () => {
    const handleGoBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            window.history.back();
        }
    };
    return (
        <button
            type="button"
            onClick={handleGoBack}
            className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
        >
            <IconArrowLeft className="h-5 w-5 mr-2" />
            Go Back
        </button>
    );
};

export default HistoryGoBackButton;
