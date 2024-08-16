import type TS from 'typescript'
import {factory, Modifier, ts} from '../../../../base'
import {FlowControlBase} from './base'
import {VariableNames} from '../variable-names'


export class SwitchFlowControl extends FlowControlBase {

	/** $block_0 */
	private blockVariableName: string = ''

	private cacheable: boolean = false
	private switchValueIndex: number = -1
	private valueIndices: (number | null)[] = []
	private templateNames: (string | null)[] = []

	init() {
		this.blockVariableName = this.treeParser.getUniqueBlockName()
		this.cacheable = this.hasAttrValue(this.node, 'cache')

		let switchValueIndex = this.getAttrValueIndex(this.node)
		if (switchValueIndex === null) {
			throw new Error('<lupos:switch ${...}> must accept a parameter as condition!')
		}
		this.switchValueIndex = switchValueIndex

		let childNodes = this.node.children
		let valueIndices: (number | null)[] = []
		let templateNames: (string | null)[] = []

		for (let node of childNodes) {
			let valueIndex = this.getAttrValueIndex(this.node)
			if (valueIndex === null && node.tagName === 'lupos:case') {
				throw new Error('<lupos:case ${...}> must accept a parameter as condition!')
			}

			if (valueIndex !== null && node.tagName === 'lupos:default') {
				throw new Error('<lupos:default> should not accept any parameter!')
			}

			if (valueIndex === null && valueIndices[valueIndices.length - 1] === null) {
				throw new Error('<lupos:default> is allowed only one to exist on the tail!')
			}

			valueIndices.push(valueIndex)
	
			if (node.children.length > 0) {
				let tree = this.treeParser.separateChildrenAsSubTree(node)
				let temName = tree.getTemplateRefName()
				templateNames.push(temName)
			}
			else {
				templateNames.push(null)
			}

			if (node.tagName === 'lupos:default' || valueIndex === null) {
				break
			}
		}

		this.templateNames = templateNames
		this.valueIndices = valueIndices
	}

	outputInit() {
		if (this.switchValueIndex === null) {
			return []
		}

		let blockClassName = this.cacheable ? 'CacheableSwitchBlock' : 'SwitchBlock'
		Modifier.addImport(blockClassName, '@pucelle/lupos.js')

		// $block_0 = new SwitchBlock / CacheableSwitchBlock(
		//   indexFn,
		//   makers,
		//   new TemplateSlot(new SlotPosition(SlotPositionType.Before, nextChild)),
		//   $context_0,
		// )

		let indexFn = this.outputSwitchIndexFn(this.switchValueIndex, this.valueIndices)
		let makers = this.outputMakerNodes(this.templateNames)
		let templateSlot = this.slot.outputTemplateSlot(null)

		return factory.createBinaryExpression(
			factory.createIdentifier(this.blockVariableName),
			factory.createToken(ts.SyntaxKind.EqualsToken),
			factory.createNewExpression(
				factory.createIdentifier(blockClassName),
				undefined,
				[
					indexFn,
					makers,
					templateSlot,
					factory.createIdentifier(VariableNames.context),
				]
			)
		)
	}

	/** Make an index output function by a switch condition value index list. */
	private outputSwitchIndexFn(switchValueIndex: number, valueIndices: (number | null)[]): TS.FunctionExpression {
		let hasDefault = valueIndices[valueIndices.length - 1] === null
		let defaultIndex = hasDefault ? valueIndices.length - 1 : -1

		// Always build default branch.
		let defaultNode = factory.createDefaultClause([
			factory.createReturnStatement(factory.createNumericLiteral(defaultIndex))
		])

		let switchValueNode = this.template.values.outputValue([switchValueIndex])
		let caseNodes: TS.CaseClause[] = []

		for (let i = 0; i < (hasDefault ? valueIndices.length - 1 : valueIndices.length); i++) {
			let valueIndex = valueIndices[i]!
			let caseValueNode = this.template.values.outputValue([valueIndex])
			
			let caseNode = factory.createCaseClause(
				caseValueNode,
				[factory.createReturnStatement(factory.createNumericLiteral(i))]
			)

			caseNodes.push(caseNode)
		}

		return factory.createFunctionExpression(
			undefined,
			undefined,
			undefined,
			undefined,
			[factory.createParameterDeclaration(
				undefined,
				undefined,
				factory.createIdentifier(VariableNames.values),
				undefined,
				undefined,
				undefined
			)],
			undefined,
			factory.createBlock(
				[factory.createSwitchStatement(
					switchValueNode,
					factory.createCaseBlock([
						...caseNodes,
						defaultNode
					])
				)],
				true
			)
		)
	}

	outputUpdate() {
		if (this.switchValueIndex === null) {
			return []
		}

		// $block_0.update($values)
		return factory.createCallExpression(
			factory.createPropertyAccessExpression(
				factory.createIdentifier(this.blockVariableName),
				factory.createIdentifier('update')
			),
			undefined,
			[
				factory.createIdentifier(VariableNames.values)
			]
		)
	}
}