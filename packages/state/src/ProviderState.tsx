'use client';

import { Provider, createStore, type Atom, type WritableAtom } from 'jotai';

type Props = {
    children?: React.ReactNode;
    /** Optional Jotai store instance. If provided, allows reading atoms outside React. */
    store?: ReturnType<typeof createStore>;
    /** Initial values for atoms. In Jotai v2, values are set on the store before passing to Provider. */
    initialValues?: Iterable<readonly [Atom<unknown>, unknown]>;
};

export default function ProviderState({ children, store, initialValues }: Props) {
    // Jotai v2 removed initialValues from Provider; we apply them to the store instead
    const effectiveStore = store ?? (initialValues ? createStore() : undefined);
    if (effectiveStore && initialValues) {
        for (const [atom, value] of initialValues) {
            // store.set expects WritableAtom; read-only atoms cannot have initial values set
            effectiveStore.set(atom as WritableAtom<unknown, [unknown], unknown>, value);
        }
    }
    return <Provider store={effectiveStore}>{children}</Provider>;
}
