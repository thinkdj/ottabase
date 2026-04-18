import React from 'react';

// Make React available globally for renderToStaticMarkup (legacy server renderer)
globalThis.React = React;

if (typeof crypto === 'undefined') {
    global.crypto = {
        randomUUID: () => '00000000-0000-4000-8000-000000000000',
    } as Crypto;
}
