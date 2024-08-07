import type TS from 'typescript'
import {factory, Modifier, ts} from '../../../../base'
import {FlowControlBase} from './base'
import {VariableNames} from '../variable-names'


export class SwitchFlowControl extends FlowControlBase {

	/** $block_0 */
	private blockVariableName: string = ''

	private cacheable: boolean = false

	private switchValueIndex: number | null = null
	private valueIndices: (number | null)[] = []
	private makerNames: (string | null)[] = []

	init() {
		this.blockVariableName = this.tree.getUniqueBlockName()
		this.cacheable = this.hasAttrValue(this.node, 'cache')
		this.switchValueIndex = this.getAttrValueIndex(this.node)

		let childNodes = this.node.children
		let valueIndices: (number | null)[] = []
		let makerNames: (string | null)[] = []

		for (let node of childNodes) {
			let valueIndex = this.getAttrValueIndex(this.node)
			valueIndices.push(valueIndex)
	
			if (node.children.length > 0) {
				let tree = this.tree.separateChildrenAsSubTree(node)
				let makerName = tree.getMakerRefName()
				makerNames.push(makerName)
			}
			else {
				makerNames.push(null)
			}

			if (node.tagName === 'lupos:default' || valueIndex === null) {
				break
			}
		}

		this.makerNames = makerNames
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
		let makers = this.outputMakerNodes(this.makerNames)
		let templateSlot = this.slot.makeTemplateSlot(null)

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

		let switchValueNode = this.slot.getOutputValueNodeAtIndex(switchValueIndex)
		let caseNodes: TS.CaseClause[] = []

		for (let i = 0; i < (hasDefault ? valueIndices.length - 1 : valueIndices.length); i++) {
			let valueIndex = valueIndices[i]!
			let caseValueNode = this.slot.getOutputValueNodeAtIndex(valueIndex)
			
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