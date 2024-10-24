import {SlotParserBase} from './base'
import {BindingBase, ClassBinding, RefBinding, StyleBinding} from '../bindings'
import {HTMLAttribute} from '../../html-syntax'
import {DiagnosticModifier} from '../../../base'


export class BindingSlotParser extends SlotParserBase {

	declare attr: HTMLAttribute
	declare name: string
	declare modifiers: string[]

	/** To process output via binding type. */
	private binding!: BindingBase

	diagnoseMissingBinding() {
		let start = this.attr.start
		let length = this.attr.name.replace(/\..+/, '').length

		DiagnosticModifier.addMissingImport(
			start, length, `Please make sure to import or declare binding ":${this.name}"!`
		)
	}

	preInit() {
		let binding: BindingBase

		switch (this.name) {
			case 'ref':
				binding = new RefBinding(this)
				break

			case 'class':
				binding = new ClassBinding(this)
				break

			case 'style':
				binding = new StyleBinding(this)
				break

			default:
				binding = new BindingBase(this)
		}

		binding.preInit()
		this.binding = binding
	}

	postInit() {
		this.binding.postInit()
	}

	outputInit() {
		return this.binding.outputInit()
	}

	outputUpdate() {
		return this.binding.outputUpdate()
	}
}