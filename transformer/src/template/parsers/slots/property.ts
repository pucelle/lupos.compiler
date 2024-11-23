import type TS from 'typescript'
import {SlotParserBase} from './base'
import {factory, Modifier, Packer, TemplateSlotPlaceholder, ts} from '../../../core'
import {Helper} from '../../../lupos-ts-module'


export class PropertySlotParser extends SlotParserBase {

	/** Property Name. */
	declare name: string

	/** For `..comProperty`. */
	private forceComponentTargetType: boolean = false

	/** $latest_0 */
	private latestVariableNames: (string | null)[] | null = null

	/** Indicates whether attach to target component or element. */
	private targetType: 'component' | 'element' = 'element'

	preInit() {
		if (this.name.startsWith('.')) {
			this.name = this.name.slice(1)
			this.forceComponentTargetType = TemplateSlotPlaceholder.isComponent(this.node.tagName!)
		}

		if (this.isAnyValueMutable()) {
			this.latestVariableNames = this.makeGroupOfLatestNames()
		}

		this.targetType = this.checkTargetType()

		if (this.targetType === 'component') {
			this.refAsComponent()
		}
	}

	private checkTargetType(): 'component' | 'element' {
		if (this.forceComponentTargetType) {
			return 'component'
		}

		let classDeclarations = [...this.resolveComponentDeclarations()]
		if (classDeclarations.length === 0) {
			return 'element'
		}

		for (let classDecl of classDeclarations) {
			let interfaceAndClassDecls = Helper.symbol.resolveChainedClassesAndInterfaces(classDecl)

			for (let decl of interfaceAndClassDecls) {
				for (let member of decl.members) {
					if (!member.name) {
						continue
					}

					if (Helper.getFullText(member.name) === this.name) {
						return 'component'
					}
				}
			}
		}

		return	'element'
	}

	outputUpdate() {
		let target: TS.Identifier

		// trackSet
		if (this.targetType === 'component' && this.latestVariableNames) {
			Modifier.addImport('trackSet', '@pucelle/ff')
		}

		// $com_0
		if (this.targetType === 'component') {
			target = factory.createIdentifier(this.getRefedComponentName())
		}

		// $node_0
		else {
			target = factory.createIdentifier(this.getRefedNodeName())
		}

		// $values[0]
		let value = this.outputValue()

		// trackSet($com_0, property)
		let setTracking = this.targetType === 'component' && this.latestVariableNames
			? [factory.createCallExpression(
				factory.createIdentifier("trackSet"),
				undefined,
				[
					factory.createIdentifier(this.getRefedComponentName()),
					factory.createStringLiteral(this.name),
				]
			)]
			: []

		// if ($latest_0 !== $values[0]) {
		//   target[propertyName] = $values[0]
		//   $latest_0 = $values[0]
		// }
		if (this.latestVariableNames) {
			return factory.createIfStatement(
				this.outputLatestComparison(this.latestVariableNames, value.valueNodes),
				factory.createBlock(
					[
						factory.createExpressionStatement(factory.createBinaryExpression(
							factory.createPropertyAccessExpression(
								target,
								factory.createIdentifier(this.name)
							),
							factory.createToken(ts.SyntaxKind.EqualsToken),
							value.joint
						)),
						...this.outputLatestAssignments(this.latestVariableNames, value.valueNodes),
						...Packer.toStatements(setTracking),
					],
					true
				),
				undefined
			)
		}

		// target[propertyName] = $values[0]
		else {
			return factory.createBinaryExpression(
				factory.createPropertyAccessExpression(
					target,
					factory.createIdentifier(this.name)
				),
				factory.createToken(ts.SyntaxKind.EqualsToken),
				value.joint
			)
		}
	}

	outputSetTracking(): {name: string, property: string}[] {
		if (this.targetType === 'component') {
			return [{
				name: this.getRefedComponentName(),
				property: this.name,
			}]
		}
		else {
			return []
		}
	}
}