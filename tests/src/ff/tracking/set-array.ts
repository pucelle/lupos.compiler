import {Component} from '@pucelle/lupos.js'


export class TestArrayProp extends Component {

	prop: {value: number}[] = [{value:1}]

	fixedIndex() {
		this.prop[0].value += 1
	}

	dynamicIndex() {
		let i = 0
		this.prop[i].value += 1
	}
}


type ArrayProp = {value: number}[]
type ArrayPropAlias = ArrayProp

export class TestAliasArrayTypeOfProp extends Component {

	prop: ArrayPropAlias = [{value:1}]

	arrayAliasType() {
		this.prop[0].value += 1
	}
}


export class TestArrayBroadcastingObservedToEachFn extends Component {

	prop: {value: number}[] = [{value:1}]

	eachArrowFnNoBlocking() {
		this.prop.forEach(v => v.value += 1)
	}

	eachArrowFn() {
		this.prop.forEach(v => {v.value += 1})
	}

	eachFn() {
		this.prop.forEach(function(v){v.value += 1})
	}
}


export class TestArrayElementsSet extends Component {

	list: number[] = []

	setAtIndex() {
		this.list[0] = 1
	}

	toggleElementSet(item: number) {
		if (this.list.includes(item)) {
			this.list.splice(this.list.indexOf(item), 1)
		}
		else {
			this.list.push(item)
		}
	}

	elementAssignment(item: number) {
		if (this.list.includes(item)) {
			this.list.splice(this.list.indexOf(item), 1)
		}
		else {
			this.list = [item]
		}
	}
}

