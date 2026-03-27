import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PLUGIN_NAMES, defaultPluginsMap } from '../../defaultPlugins';
import StepsTool, { type StepsData } from './StepsTool';

const createdTools: StepsTool[] = [];

function createTool(data?: Partial<StepsData>) {
	const tool = new StepsTool({
		api: {} as any,
		data,
		config: {},
		block: { id: 'steps-test' },
	});

	const wrapper = tool.render();
	document.body.appendChild(wrapper);
	createdTools.push(tool);

	return { tool, wrapper };
}

afterEach(() => {
	createdTools.splice(0).forEach((tool) => tool.destroy?.());
	document.body.innerHTML = '';
});

describe('StepsTool', () => {
	it('registers the tool in the default plugin map', () => {
		expect(DEFAULT_PLUGIN_NAMES.STEPS).toBe('steps');
		expect(defaultPluginsMap.get(DEFAULT_PLUGIN_NAMES.STEPS)?.tool).toBe(StepsTool as any);
	});

	it('renders a minimal steps editor and saves filled items', () => {
		const { tool } = createTool();

		expect(screen.getAllByRole('button', { name: /add step/i })).toHaveLength(2);
		expect(screen.getByLabelText('Step 1 title')).toBeTruthy();

		fireEvent.input(screen.getByLabelText('Step 1 title'), {
			target: { value: 'Choose your blocks' },
		});
		fireEvent.input(screen.getByLabelText('Step 1 content'), {
			target: { value: 'Start with the content structure you want to publish.' },
		});

		expect(tool.save()).toEqual({
			items: [
				{
					title: 'Choose your blocks',
					content: 'Start with the content structure you want to publish.',
				},
			],
		});
	});

	it('supports adding and reordering steps through the action menu', () => {
		const { tool } = createTool({
			items: [
				{ title: 'First', content: 'Draft the outline.' },
				{ title: 'Second', content: 'Review and refine.' },
			],
		});

		fireEvent.click(screen.getByRole('button', { name: /open actions for step 1/i }));
		fireEvent.click(screen.getByRole('menuitem', { name: /move down/i }));

		expect(tool.save().items.map((item) => item.title)).toEqual(['Second', 'First']);

		fireEvent.click(screen.getAllByRole('button', { name: /add step/i })[0]);
		fireEvent.input(screen.getByLabelText('Step 3 title'), {
			target: { value: 'Publish' },
		});

		expect(tool.save().items.map((item) => item.title)).toEqual(['Second', 'First', 'Publish']);
	});

	it('rejects empty payloads during validation', () => {
		const { tool } = createTool();

		expect(tool.validate({ items: [] })).toBe(false);
		expect(tool.validate({ items: [{ title: 'Ready', content: '' }] })).toBe(true);
	});
});
