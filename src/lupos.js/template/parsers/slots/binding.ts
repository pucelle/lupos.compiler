import type TS from 'typescript'
import {SlotParserBase} from './base'
import {factory, ts, Imports, Helper} from '../../../../base'
import {VariableNames} from '../variable-names'


export class BindingSlotParser extends SlotParserBase {

	declare readonly name: string
	declare readonly modifiers: string[]

	/** $latest_0 */
	private latestVariableName: string | null = null

	/** $binding_0 */
	private bindingVariableName: string = ''

	init() {
		if (this.isValueMutable()) {
			this.latestVariableName = this.tree.getUniqueLatestName()
		}

		this.bindingVariableName = this.tree.getUniqueBindingName()
	}

	outputInit() {
		let nodeName = this.getRefedNodeName()

		// :class -> ClassBinding
		let bindingClassImport = Imports.getImportByNameLike(this.name)
			|| Imports.getImportByNameLike(this.name + 'Binding')!

		let bindingClassName = bindingClassImport.name.text
		let bindingClass = Helper.symbol.resolveDeclaration(bindingClassImport, ts.isClassDeclaration)!
		let bindingClassConstructorParams = Helper.cls.getConstructorParameters(bindingClass)
		let bindingParams: TS.Expression[] = [factory.createIdentifier(nodeName)]

		if (bindingClassConstructorParams.length > 1) {
			bindingParams.push(factory.createIdentifier(VariableNames.context))
		}

		if (bindingClassConstructorParams.length > 2) {
			bindingParams.push(factory.createArrayLiteralExpression(
				this.modifiers.map(m => factory.createStringLiteral(m)),
				false
			))
		}

		// new ClassBinding($node_0, ?$context, ?modifiers)
		return factory.createNewExpression(
			factory.createIdentifier(bindingClassName),
			undefined,
			bindingParams
		)
	}

	outputUpdate() {

		// $values[0], or '...'
		let value = this.getOutputValueNode()

		let callWith: {method: string, value: TS.Expression} = {method: 'update', value}
		if (this.name === 'class') {
			callWith = this.getClassUpdateCallWith(value)
		}
		else if (this.name === 'style') {
			callWith = this.getStyleUpdateCallWith(value)
		}
		else if (this.name === 'ref') {
			callWith.value = this.getRefUpdateCallWithValue(value)
		}

		let callMethod = callWith.method
		let callValue = callWith.value

		// if ($latest_0 !== $values[0]) {
		//	 $binding_0.callMethod(callValue)
		//	 $latest_0 !== $values[0]
		// }
		if (this.latestVariableName && callValue !== value) {
			return factory.createIfStatement(
				factory.createBinaryExpression(
					factory.createIdentifier(this.latestVariableName),
					factory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken),
					value
				),
				factory.createBlock(
					[
						factory.createExpressionStatement(factory.createCallExpression(
							factory.createPropertyAccessExpression(
								factory.createIdentifier(this.bindingVariableName),
								factory.createIdentifier(callMethod)
							),
							undefined,
							[callValue]
						)),
						factory.createExpressionStatement(factory.createBinaryExpression(
							factory.createIdentifier(this.latestVariableName),
							factory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken),
							value
						))
					],
					true
				),
				undefined
			)
		}

		// $latest_0 === $values[0] && $binding_0.update($latest_0 = $values[0])
		else if (this.latestVariableName) {
			return factory.createBinaryExpression(
				factory.createBinaryExpression(
					factory.createIdentifier(this.latestVariableName),
					factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
					callValue
				),
				factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
				factory.createCallExpression(
					factory.createPropertyAccessExpression(
						factory.createIdentifier(this.bindingVariableName),
						factory.createIdentifier(callMethod)
					),
					undefined,
					[factory.createBinaryExpression(
						factory.createIdentifier(this.latestVariableName),
						factory.createToken(ts.SyntaxKind.EqualsToken),
						callValue
					)]
				)
			)
		}

		// $binding_0.update($values[0])
		else {
			return factory.createCallExpression(
				factory.createPropertyAccessExpression(
					factory.createIdentifier(this.bindingVariableName),
					factory.createIdentifier(callMethod)
				),
				undefined,
				[callValue]
			)
		}
	}

	private getClassUpdateCallWith(value: TS.Expression): {method: string, value: TS.Expression} {
		if (this.modifiers.length > 0) {
			return {
				method: 'updateObject',
				value: factory.createObjectLiteralExpression(
					[factory.createPropertyAssignment(
						this.modifiers[0],
						value
					)],
					false
				),
			}
		}

		if (this.hasValueIndex()) {
			return {
				method: 'updateString',
				value,
			}
		}

		let slotNode = this.getSlotNode()
		let slotNodeType = Helper.types.getType(slotNode)

		if (Helper.types.isValueType(slotNodeType)) {
			return {
				method: 'updateString',
				value,
			}
		}
		else if (Helper.types.isArrayType(slotNodeType)) {
			return {
				method: 'updateList',
				value,
			}
		}
		else if (Helper.types.isObjectType(slotNodeType)) {
			return {
				method: 'updateObject',
				value,
			}
		}

		return {
			method: 'update',
			value
		}
	}

	private getStyleUpdateCallWith(value: TS.Expression): {method: string, value: TS.Expression} {
		if (this.modifiers.length > 0) {
			if (this.modifiers.length > 1 && this.modifiers[1].length > 0) {

				// `.url` -> `url(...)`
				if (this.modifiers[1] === 'url') {
					value = factory.createBinaryExpression(
						factory.createBinaryExpression(
							factory.createStringLiteral('url('),
							factory.createToken(ts.SyntaxKind.PlusToken),
							value
						),
						factory.createToken(ts.SyntaxKind.PlusToken),
						factory.createStringLiteral(')')
					)
				}

				// `.percent`
				else if (this.modifiers[1] === 'percent') {
					value = factory.createBinaryExpression(
						value,
						factory.createToken(ts.SyntaxKind.PlusToken),
						factory.createStringLiteral('%')
					)
				}

				// `.px`, `.rem`, ...
				else if (/^\w+$/.test(this.modifiers[1])) {
					value = factory.createBinaryExpression(
						value,
						factory.createToken(ts.SyntaxKind.PlusToken),
						factory.createStringLiteral(this.modifiers[1])
					)
				}
			}

			return {
				method: 'updateObject',
				value: factory.createObjectLiteralExpression(
					[factory.createPropertyAssignment(
						this.modifiers[0],
						value
					)],
					false
				),
			}
		}

		if (this.hasValueIndex()) {
			return {
				method: 'updateString',
				value,
			}
		}

		let slotNode = this.getSlotNode()
		let slotNodeType = Helper.types.getType(slotNode)

		if (Helper.types.isValueType(slotNodeType)) {
			return {
				method: 'updateString',
				value,
			}
		}
		else if (Helper.types.isObjectType(slotNodeType)) {
			return {
				method: 'updateObject',
				value,
			}
		}

		return {
			method: 'update',
			value
		}
	}

	private getRefUpdateCallWithValue(value: TS.Expression): TS.Expression {
		if (Helper.access.isAccess(value)) {
			let exp = value.expression
			let name = Helper.access.getNameNode(value)

			// this.refName ->
			// (el) => this.__setSlotElement(refName, el)
			if (exp.kind === ts.SyntaxKind.ThisKeyword) {
				return factory.createArrowFunction(
					undefined,
					undefined,
					[factory.createParameterDeclaration(
						undefined,
						undefined,
						factory.createIdentifier('el'),
						undefined,
						undefined,
						undefined
					)],
					undefined,
					factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
					factory.createCallExpression(
						factory.createPropertyAccessExpression(
							factory.createThis(),
							factory.createIdentifier('__setSlotElement')
						),
						undefined,
						[
							name,
							factory.createIdentifier('el'),
						]
					)
				)
			}
		}

		// this.refName ->
		// (el) => this.refName = el
		return factory.createArrowFunction(
			undefined,
			undefined,
			[factory.createParameterDeclaration(
				undefined,
				undefined,
				factory.createIdentifier('el'),
				undefined,
				undefined,
				undefined
			)],
			undefined,
			factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
			factory.createBinaryExpression(
				value,
				factory.createToken(ts.SyntaxKind.EqualsToken),
				factory.createIdentifier('el')
			)
			)
	}
}