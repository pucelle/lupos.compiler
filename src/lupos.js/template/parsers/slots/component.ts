import type TS from 'typescript'
import {SlotParserBase} from './base'
import {factory} from '../../../../base'


export class ComponentSlotParser extends SlotParserBase {

	init() {
		this.refAsComponent()
	}

	outputInit(nodeOtherInits: TS.Statement[]) {
		let nodeName = this.getRefedNodeName()
		let ComName = this.node.tagName!
		let hasRestSlotContentExisted = this.node.children.length > 0
		let restSlotRangeInit: TS.Expression | null = null

		let comVariableName = this.getRefedComponentName()

		// let $com_0 = new Com($node_0), after component has been referenced.
		let comInit = this.addVariableAssignment(
			comVariableName,
			factory.createNewExpression(
				factory.createIdentifier(ComName),
				undefined,
				[factory.createIdentifier(nodeName)]
			)
		)

		// $com_0.__applyRestSlotRange(
		//   new SlotRange(startNode, endNode)
		// )
		if (hasRestSlotContentExisted) {
			let comVariableName = this.getRefedComponentName()
			let contentRange = this.makeSlotRange()!

			restSlotRangeInit = factory.createCallExpression(
				factory.createPropertyAccessExpression(
					factory.createIdentifier(comVariableName),
					factory.createIdentifier('__applyRestSlotRange')
				),
				undefined,
				[contentRange]
			)			  
		}

		return [
			comInit,
			restSlotRangeInit,
			...nodeOtherInits,
		].filter(v => v) as TS.Expression[]
	}
}