import React from 'react';

export interface HelloBoxProps {
    /**
     * The name to display in the greeting
     */
    name?: string;
    /**
     * Custom CSS class name for styling
     */
    className?: string;
    /**
     * Custom inline styles
     */
    style?: React.CSSProperties;
}

/**
 * A simple HelloBox component that displays a greeting message
 */
export const HelloBox: React.FC<HelloBoxProps> = ({ name = 'World', className = '', style = {} }) => {
    const defaultStyle: React.CSSProperties = {
        padding: '16px',
        border: '2px solid #007bff',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa',
        textAlign: 'center',
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#333',
        display: 'inline-block',
        ...style,
    };

    return (
        <div className={`hello-box ${className}`.trim()} style={defaultStyle}>
            Hello, {name}! 👋
        </div>
    );
};

export default HelloBox;
