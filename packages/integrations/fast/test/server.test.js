import { expect } from 'chai';
import server from '../server.js';
import * as cheerio from 'cheerio';
import { FASTElement, html, customElement } from '@microsoft/fast-element';

const { check, renderToStaticMarkup } = server;

describe('check', () => {
	it('should be false with no component', async () => {
		expect(await check()).to.equal(false);
	});

	it('should be false with a registered non-fast component', async () => {
		const tagName = 'non-lit-component';
		if (!globalThis.HTMLElement) {
			globalThis.HTMLElement = class {};
		}
		const TestComponent = class extends HTMLElement {}
		customElements.define(tagName, TestComponent);
		expect(await check(TestComponent)).to.equal(false);
	});

	it('should be true with a registered fast component', async () => {
		const tagName = 'fast-component';
		const TestComponent = class extends FASTElement {}
		customElements.define(tagName, TestComponent);
		expect(await check(TestComponent)).to.equal(true);
	});
});

describe('renderToStaticMarkup', () => {
	it('should throw error if trying to render an unregistered component', async () => {
		const tagName = 'non-registrered-component';
		try {
			await renderToStaticMarkup(tagName);
		} catch (e) {
			expect(e.message).to.equal('FASTElementRenderer was unable to find a constructor for a custom element with the tag name \'non-registrered-component\'.')
		}
	});

	it('should render empty component with default markup', async () => {
		const tagName = 'nothing-component';
		customElement({ name: tagName })(class extends FASTElement {});
		const render = await renderToStaticMarkup(tagName);
		expect(render).to.deep.equal({
			html: `<${tagName}><template shadowroot="open" shadowrootmode="open"></template></${tagName}>`,
		});
	});

	it('should render component with default markup', async () => {
		const tagName = 'simple-component';
		customElement({ name: tagName, template: html`<p>hola</p>` })(
			class extends FASTElement { }
		);
		const render = await renderToStaticMarkup(tagName);
		const $ = cheerio.load(render.html);
		expect($(`${tagName} template`).html()).to.contain('<p>hola</p>');
	});

	it('should render component with properties and attributes', async () => {
		const tagName = 'props-and-attrs-component';
		const attr1 = 'test';
		const prop1 = 'Daniel';
		customElement({ 
			name: tagName, 
			template: html`<p>Hello ${x => x.prop1}</p>`,
			attributes: [
				'attr1',
				'prop1'
			] })(
			class extends FASTElement {
				prop1 = 'someone';
			}
		);
		const render = await renderToStaticMarkup(tagName, { prop1, attr1 });
		const $ = cheerio.load(render.html);
		expect($(tagName).attr('attr1')).to.equal(attr1);
		expect($(`${tagName} template`).text()).to.contain(`Hello ${prop1}`);
	});

	it('should render nested components', async () => {
		const tagName = 'parent-component';
		const childTagName = 'child-component';
		customElement({
			name: childTagName,
			template: html`<p>child</p>`
		})(class extends FASTElement { })
		customElement({
			name: tagName,
			template: html`<child-component></child-component>`
		})(class extends FASTElement { })
		const render = await renderToStaticMarkup(tagName);
		const $ = cheerio.load(render.html);
		expect($(`${tagName} template`).text()).to.contain('child');
	});

	it('should render DSD attributes based on shadowRootOptions', async () => {
		const tagName = 'shadow-root-options-component';
		customElement({
			name: tagName,
			shadowOptions: {
				delegatesFocus: true
			}
		})(class extends FASTElement {})
		const render = await renderToStaticMarkup(tagName);
		expect(render).to.deep.equal({
			html: `<${tagName}><template shadowroot=\"open\" shadowrootmode=\"open\" shadowrootdelegatesfocus></template></${tagName}>`,
		});
	});
});
