import {Component, html} from '@pucelle/lupos.js'


class TestAttribute extends Component {

	className = 'className'
	booleanValue = true
	nullableClassName!: string | null

	testInterpolatedString() {
		return html`<div class="${this.className} className2" />`
	}

	testString() {
		return html`<div class=${this.className} />`
	}

	testNullableAttr() {
		return html`<div class=${this.nullableClassName} />`
	}

	testComponentClass() {
		return html`<Com class="className" />`
	}
}

class Com extends Component {

	dynamicClassName: string = ''

	render() {
		return html`
			<template class="classNameSelf">
		`
	}
}