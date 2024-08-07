import type TS from 'typescript'
import {SlotBase} from './base'
import {factory, modifier, ts} from '../../../../base'


export class DynamicComponentSlot extends SlotBase {

	/** $block_0 */
	private blockVariableName: string = ''

	init() {
		this.refAsComponent()
		this.blockVariableName = this.tree.getUniqueBlockVariableName()
	}

	outputInit(nodeAttrInits: TS.Statement[]) {
		modifier.addImport('DynamicComponentBlock', '@pucelle/lupos.js')
		modifier.addImport('TemplateSlot', '@pucelle/lupos.js')
		modifier.addImport('SlotPosition', '@pucelle/lupos.js')
		modifier.addImport('SlotRange', '@pucelle/lupos.js')

		let nodeName = this.getRefedNodeName()
		let comName = this.getRefedComponentName()


		// $block_0 = new DynamicComponentBlock(
		// function(com){
		//   $node_0 = com.el;
		//	 $com_0 = com;
		//	 ...nodeAttrInits
		// },
		// new TemplateSlot(new SlotPosition(SlotPositionType.Before, nextChild)),
		// new SlotRange() / null
		// )

		let binderFn = factory.createFunctionExpression(
			undefined,
			undefined,
			factory.createIdentifier(''),
			undefined,
			[factory.createParameterDeclaration(
				undefined,
				undefined,
				factory.createIdentifier('com'),
				undefined,
				undefined,
				undefined
			)],
			undefined,
			factory.createBlock(
				[
					factory.createExpressionStatement(factory.createBinaryExpression(
						factory.createIdentifier(nodeName),
						factory.createToken(ts.SyntaxKind.EqualsToken),
						factory.createPropertyAccessExpression(factory.createIdentifier('com'), 'el')
					)),
					factory.createExpressionStatement(factory.createBinaryExpression(
						factory.createIdentifier(comName),
						factory.createToken(ts.SyntaxKind.EqualsToken),
						factory.createIdentifier('com')
					)),
					...nodeAttrInits,
				],
				true
			)
		)

		let templateSlot = this.makeTemplateSlot(null)
		let contentRange = this.makeSlotRangeExpression()

		let block = factory.createNewExpression(
			factory.createIdentifier('DynamicComponentBlock'),
			undefined,
			[
				binderFn,
				templateSlot,
				contentRange,
			]
		)

		return block
	}

	outputUpdate() {
		let value = this.getOutputValueNode()

		// $block_0.update($values[0])
		return factory.createCallExpression(
			factory.createPropertyAccessExpression(
				factory.createIdentifier(this.blockVariableName),
				factory.createIdentifier('update')
			),
			undefined,
			[value]
		)
	}
}