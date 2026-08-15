import { describe, expect, it } from 'vitest';
import * as headless from '../index';
import { CfPdfDemoPage } from '../react/index';
import { createCfPdfRequestHandler, createCfPdfRouter } from '../routes';

describe('package entrypoints', () => {
    it('keeps rendered React UI out of the headless root entrypoint', () => {
        expect(headless).not.toHaveProperty('CfPdfDemoPage');
        expect(CfPdfDemoPage).toEqual(expect.any(Function));
    });

    it('exposes normal Worker routing through the route entrypoint', () => {
        expect(createCfPdfRequestHandler).toEqual(expect.any(Function));
        expect(createCfPdfRouter).toEqual(expect.any(Function));
    });
});
