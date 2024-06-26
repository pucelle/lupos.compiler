import {Observed, computed, effect, watch} from '@pucelle/ff'
import {Component} from '@pucelle/lupos.js'


class TestComputed extends Component {

	prop: number = 1

	@computed prop2() {
		return this.prop + 1
	}
}


class TestEffect extends Component {

	prop: number = 1

	@effect onPropChangeEffect() {
		console.log(this.prop)
	}
}


class TestWatchProperty extends Component {

	prop: number = 1

	@watch('prop') onPropChange(prop: number) {
		console.log(prop)
	}
}


class TestWatchCallback extends Component {

	prop: number = 1

	@watch(function(this: TestWatchCallback){return this.prop}) onPropChange(prop: number) {
		console.log(prop)
	}
}


class TestObservedImplemented implements Observed {

	prop: number = 1

	@effect onPropChangeEffect() {
		console.log(this.prop)
	}
}