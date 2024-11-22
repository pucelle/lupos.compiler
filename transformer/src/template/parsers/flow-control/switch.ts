import type TS from 'typescript'
import {factory, Interpolator, ts} from '../../../core'
import {IfFlowControl} from './if'


export class SwitchFlowControl extends IfFlowControl {

	private switchValueIndex: number | null = null

	preInit() {
		let switchValueIndex = this.getAttrValueIndex(this.node)
		if (switchValueIndex === null) {
			this.slot.diagnoseNormal('<lu:switch ${...}> must accept a parameter as condition!')
		}
		this.switchValueIndex = switchValueIndex

		let tags = ['lu:case', 'lu:default']
		let childNodes = this.node.children
		
		this.initByNodesAndTags(childNodes, tags)
		this.node.empty()
	}

	outputInit() {
		if (this.switchValueIndex === null) {
			return []
		}

		let blockClassName = this.cacheable ? 'CacheableSwitchBlock' : 'SwitchBlock'
		return this.outputInitByClassName(blockClassName)
	}

	outputUpdate() {
		if (this.switchValueIndex === null) {
			return []
		}

		// $block_0.update($values[0])
		return super.outputUpdate()
	}

	protected outputConditionsExps() {
		let switchValue = this.switchValueIndex !== null
			? this.template.values.getRawValue(this.switchValueIndex)
			: factory.createNull()

		let conditions = this.conditionIndices.map(index => {
			if (index === null) {
				return factory.createNull()
			}
			else {
				let rawNode = this.template.values.getRawValue(index)

				return factory.createBinaryExpression(
					switchValue,
					factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
					Interpolator.outputNodeSelf(rawNode) as TS.Expression
				)
			}
		})

		return conditions
	}
}