import {Component, html} from '@pucelle/lupos.js'


export class TestContent extends Component {

	booleanProp: boolean = true

	testTemplateResultContent() {
		return html`<div>${html`<div></div>`}</div>`
	}

	testTemplateResultListContent() {
		return html`<div>${[html`<div></div>`]}</div>`
	}

	testMixedContent() {
		return html`<div>${this.booleanProp ? '1' : html`<div></div>`}</div>`
	}

	testMultipleContents() {
		return html`<div> ${'1'} ${html`<div></div>`} ${'1'}</div>`
	}

	testNeighborContents() {
		return html`
		<div>
			${html`<div></div>`}
			${html`<div></div>`}
		</div>`
	}

	testNeighborIfContents() {
		return html`
		<template>
			<lu:if ${this.booleanProp}>
				<div></div>
			</lu:if>
			${html`<div></div>`}
		</template>
		`
	}
}
