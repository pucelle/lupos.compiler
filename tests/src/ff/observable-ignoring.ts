import {Component} from '@pucelle/lupos.js'
import {computed} from '@pucelle/ff'


class TestIgnoringStringIndex extends Component {

	prop: string = '1'

	ignoreStringIndex() {
		return this.prop[0]
	}
}


class TestIgnoringLifeFunction extends Component {

	prop: number

	constructor() {
		super()
		this.prop = 0
	}

	protected onConnected() {
		this.prop = 1
	}

	protected onWillDisconnect() {
		this.prop = 2
	}
}


class TestIgnoringMethod extends Component {

	ignoreMethod() {
		return this.anyMethod()
	}

	anyMethod() {
		return 0
	}
}


interface MethodSignature {
	property: () => number
	method(): number
}

class TestNotIgnoringFnPropertySignature extends Component {

	member: MethodSignature = {
		property: () => 0,
		method(){return 0}
	}

	notIgnoreFnProperty() {
		return this.member.property() + this.member.method()
	}
}


class TestIgnoringInternalMethods extends Component {

	prop1: Array<number> = [1, 2]
	prop2: Map<number, number> = new Map([[1, 2]])

	ignoreArrayMethods() {
		let prop1 = this.prop1

		return prop1.join('')!
			+ this.prop2.get(1)!
	}
}


class TestIgnoringNothingReturnedMethod extends Component {

	prop: number = 1

	nothingReturnedMethod() {
		this.prop
	}

	async nothingReturnedAsyncMethod() {
		this.prop
	}
}


class TestIgnoringReadonlyPrivate extends Component {

	private prop: number = 1

	readMethod() {
		return this.prop
	}

	destructedReadMethod() {
		let {prop} = this
		return prop
	}
}


class TestIgnoringWriteonlyPrivate extends Component {

	private prop: number = 1

	readMethod() {
		this.prop = 2
	}
}


class TestIgnoringOfPrivateComputedProperty extends Component {

	private prop: number = 1

	readMethod() {
		return this.computedProp
	}

	@computed private get computedProp() {
		return this.prop
	}
}
