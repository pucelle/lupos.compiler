import {fade} from '@pucelle/ff'
import {ClassBinding, Component, html} from '@pucelle/lupos.js'


export class TestRefBinding extends Component {

	refEl: any
	refCom: any
	refElByType!: HTMLElement
	refBinding!: ClassBinding

	testRefEl() {
		return html`<div :ref=${this.refEl} />`
	}

	testRefCom() {
		return html`<ChildComponent :ref=${this.refCom} />`
	}

	testRefElModifier() {
		return html`<ChildComponent :ref.el=${this.refEl} />`
	}

	testRefElByDeclarationType() {
		return html`<ChildComponent :ref=${this.refElByType} />`
	}

	testRefBinding() {
		return html`<ChildComponent :class="className" :ref.binding=${this.refBinding} />`
	}


	testRefElMethod() {
		return html`<div :ref=${this.refElMethod} />`
	}

	refElMethod(_el: HTMLElement) {}


	testRefBindingMethod() {
		return html`<ChildComponent :class="className" :ref.binding=${this.refBindingMethod} />`
	}

	refBindingMethod(_binding: ClassBinding) {}


	shouldTransition: boolean = true

	testRefOptionalBinding() {
		return html`<ChildComponent
			?:transition=${this.shouldTransition, fade()}
			:ref.binding=${this.refBinding}
		/>`
	}

	testRefAsLocal() {
		let value: any

		return html`<div :ref=${value} />`
	}
}

class ChildComponent extends Component {}
