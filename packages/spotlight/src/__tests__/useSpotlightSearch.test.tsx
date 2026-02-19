import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpotlightSearch } from '../useSpotlightSearch';

describe('useSpotlightSearch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns initial state', () => {
        const onSearch = vi.fn().mockResolvedValue([]);
        const { result } = renderHook(() =>
            useSpotlightSearch({
                onSearch,
                debounceMs: 300,
                minQueryLength: 0,
            }),
        );
        expect(result.current.query).toBe('');
        expect(result.current.results).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(typeof result.current.search).toBe('function');
        expect(typeof result.current.reset).toBe('function');
    });

    it('does not call onSearch when query is below minQueryLength', async () => {
        const onSearch = vi.fn().mockResolvedValue([]);
        const { result } = renderHook(() =>
            useSpotlightSearch({
                onSearch,
                debounceMs: 100,
                minQueryLength: 3,
            }),
        );
        act(() => {
            result.current.search('ab');
        });
        await act(async () => {
            vi.advanceTimersByTime(150);
        });
        expect(onSearch).not.toHaveBeenCalled();
        expect(result.current.results).toEqual([]);
    });

    it('debounces search and calls onSearch after debounceMs', async () => {
        const onSearch = vi.fn().mockResolvedValue([{ id: '1', label: 'Hit' }]);
        const { result } = renderHook(() =>
            useSpotlightSearch({
                onSearch,
                debounceMs: 300,
                minQueryLength: 0,
            }),
        );
        act(() => {
            result.current.search('test');
        });
        expect(onSearch).not.toHaveBeenCalled();
        await act(async () => {
            vi.advanceTimersByTime(300);
        });
        expect(onSearch).toHaveBeenCalledWith('test', expect.any(AbortSignal));
        expect(result.current.results).toEqual([{ id: '1', label: 'Hit' }]);
    });

    it('trims query before search', async () => {
        const onSearch = vi.fn().mockResolvedValue([]);
        const { result } = renderHook(() =>
            useSpotlightSearch({
                onSearch,
                debounceMs: 100,
                minQueryLength: 0,
            }),
        );
        act(() => {
            result.current.search('  trimmed  ');
        });
        await act(async () => {
            vi.advanceTimersByTime(150);
        });
        expect(onSearch).toHaveBeenCalledWith('trimmed', expect.any(AbortSignal));
    });

    it('sets results and calls onSuccess on successful search', async () => {
        const onSuccess = vi.fn();
        const results = [{ id: '1', label: 'A' }];
        const onSearch = vi.fn().mockResolvedValue(results);
        const { result } = renderHook(() =>
            useSpotlightSearch({
                onSearch,
                debounceMs: 100,
                minQueryLength: 0,
                onSuccess,
            }),
        );
        act(() => result.current.search('q'));
        await act(async () => vi.advanceTimersByTime(150));
        expect(result.current.results).toEqual(results);
        expect(onSuccess).toHaveBeenCalledWith(results);
    });

    it('sets error and calls onError on failed search', async () => {
        const err = new Error('Search failed');
        const onError = vi.fn();
        const onSearch = vi.fn().mockRejectedValue(err);
        const { result } = renderHook(() =>
            useSpotlightSearch({
                onSearch,
                debounceMs: 100,
                minQueryLength: 0,
                onError,
            }),
        );
        act(() => result.current.search('q'));
        await act(async () => vi.advanceTimersByTime(150));
        expect(result.current.error).toEqual(err);
        expect(result.current.results).toEqual([]);
        expect(onError).toHaveBeenCalledWith(err);
    });

    it('reset clears query, results, error and loading', async () => {
        const onSearch = vi.fn().mockResolvedValue([{ id: '1', label: 'X' }]);
        const { result } = renderHook(() =>
            useSpotlightSearch({
                onSearch,
                debounceMs: 100,
                minQueryLength: 0,
            }),
        );
        act(() => result.current.search('q'));
        await act(async () => vi.advanceTimersByTime(150));
        expect(result.current.results.length).toBe(1);
        act(() => result.current.reset());
        expect(result.current.query).toBe('');
        expect(result.current.results).toEqual([]);
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });
});
