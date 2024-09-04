import {Component, html, ClassBinding} from '@pucelle/lupos.js'


class TestComponent extends Component {

	prop: number = 1

	testNamedSlot() {
		return html`<div><slot name="slotName" /></div>`
	}

	testNamedSlotWithContent() {
		return html`<div><slot name="slotName">Content</slot></div>`
	}

	testRestSlot() {
		return html`<div><slot /></div>`
	}
}