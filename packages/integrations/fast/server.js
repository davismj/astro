import './server-shim.js';
import * as parse5 from 'parse5';
import { FASTElement } from '@microsoft/fast-element';
import fastSSR from '@microsoft/fast-ssr';

const { elementRenderer: FASTElementRenderer } = fastSSR();

async function isFastElement(Ctr) {
	return Ctr?.prototype instanceof FASTElement;
}

async function check(Ctr, _props, _children) {
	return !!(await isFastElement(Ctr));
}

function* render(Component, attrs, slots) {
	let tagName = Component;
	if (typeof tagName !== 'string') {
		tagName = Component[Symbol.for('tagName')];
	}
	const instance = new FASTElementRenderer(tagName);
	const Ctr = instance.element.$fastController.definition.type;
	let shouldDeferHydration = false;

	if (attrs) {
		for (let [name, value] of Object.entries(attrs)) {
			const isReactiveProperty = name in Ctr.prototype;
			const isReflectedReactiveProperty = Ctr.elementProperties.get(name)?.reflect;
			shouldDeferHydration ||= isReactiveProperty && !isReflectedReactiveProperty;

			if (isReactiveProperty) {
				instance.setProperty(name, value);
			} else {
				instance.setAttribute(name, value);
			}
		}
	}

	instance.connectedCallback();

	yield `<${tagName}${shouldDeferHydration ? ' defer-hydration' : ''}`;
	yield* instance.renderAttributes();
	yield `>`;
	const shadowContents = instance.renderShadow({
		elementRenderers: [FASTElementRenderer],
		customElementInstanceStack: [instance],
		customElementHostStack: [],
		deferHydration: false,
	});
	if (shadowContents !== undefined) {
		const { mode = 'open', delegatesFocus } = instance.shadowRootOptions ?? {};
		// `delegatesFocus` is intentionally allowed to coerce to boolean to
		// match web platform behavior.
		const delegatesfocusAttr = delegatesFocus ? ' shadowrootdelegatesfocus' : '';
		yield `<template shadowroot="${mode}" shadowrootmode="${mode}"${delegatesfocusAttr}>`;
		yield* shadowContents;
		yield '</template>';
	}
	if (slots) {
		for (let [slot, value = ''] of Object.entries(slots)) {
			if (slot !== 'default' && value) {
				// Parse the value as a concatenated string
				const fragment = parse5.parseFragment(`${value}`);

				// Add the missing slot attribute to child Element nodes
				for (const node of fragment.childNodes) {
					if (node.tagName && !node.attrs.some(({ name }) => name === 'slot')) {
						node.attrs.push({ name: 'slot', value: slot });
					}
				}

				value = parse5.serialize(fragment);
			}

			yield value;
		}
	}
	yield `</${tagName}>`;
}

async function renderToStaticMarkup(Component, props, slots) {
	let tagName = Component;

	let out = '';
	for (let chunk of render(tagName, props, slots)) {
		out += chunk;
	}

	return {
		html: out,
	};
}

export default {
	check,
	renderToStaticMarkup,
};
