import type TS from 'typescript'
import {HTMLNode} from '../../html-syntax'
import {TreeParser} from '../tree'
import {BindingSlotParser} from '../slots'
import {DiagnosticModifier, factory, Helper, Modifier, ScopeTree, ts} from '../../../base'
import {TemplateParser} from '../template'
import {VariableNames} from '../variable-names'
import {setLatestBindingInfo} from './latest-binding'


export interface BindingUpdateCallWith {
	method: string
	values: TS.Expression[]
}


/** Known bindings existing in `lupos.js`. */
export const KnownInternalBindings: Record<string, {name: string, parameterCount: number, implementsPart: boolean}> = {
	class: {name: 'ClassBinding', parameterCount: 1, implementsPart: false},
	html: {name: 'HTMLBinding', parameterCount: 1, implementsPart: false},
	ref: {name: 'RefBinding', parameterCount: 3, implementsPart: true},
	slot: {name: 'SlotBinding', parameterCount: 1, implementsPart: true},
	style: {name: 'StyleBinding', parameterCount: 1, implementsPart: false},
	transition: {name: 'TransitionBinding', parameterCount: 3, implementsPart: true},
}


export class BindingBase {

	readonly slot: BindingSlotParser
	readonly node: HTMLNode
	readonly tree: TreeParser
	readonly template: TemplateParser

	name: string
	modifiers: string[]

	/** `?:binding=value`, detach binding if value is `null` or `undefined`. */
	protected withQueryToken: boolean = false

	/** Binding constructor parameter count. */
	protected implementsPart: boolean = false

	/** Binding constructor parameter count. */
	protected bindingClassParameterCount: number | null = null

	/** $binding_0 */
	protected bindingVariableName: string = ''

	/** Query parameter part like `a` of `?:binding=${a, b}`. */
	protected queryParameter: TS.Expression | null = null

	/** $latest_0 for query parameter. */
	protected latestQueryVariableName: string | null = null

	/** 
	 * After splitting like `:binding=${a, b}` or `:binding=${(a, b)}`.
	 * It doesn't include query value for optional binding like `?:binding=${a, b}`
	 */
	protected parameterList: TS.Expression[] | null = null
	
	/** $latest_0 */
	protected latestVariableNames: (string | null)[] | null = null

	/** $delegator_0 */
	protected delegatorVariableName: string | null = null

	constructor(slot: BindingSlotParser) {
		this.slot = slot
		this.node = slot.node
		this.tree = slot.tree
		this.template = slot.template

		this.name = slot.name
		this.modifiers = this.slot.modifiers

		if (this.name.startsWith('?')) {
			this.name = this.name.slice(1)
			this.withQueryToken = true
		}
	}

	/** 
	 * Get value node, either `$values[0]`, or `"..."`.
	 * Can only use it when outputting update.
	 */
	outputValue(asCallback: boolean = false): {
		joint: TS.Expression,
		valueNodes: TS.Expression[],
	} {

		// Output values from parameter list.
		if (this.parameterList) {
			let valueNodes = this.template.values.outputRawValueList(this.parameterList, this.slot.valueIndices![0])
			let joint = valueNodes[0]

			return {
				joint,
				valueNodes,
			}
		}
		else {
			return this.slot.outputValue(asCallback)
		}
	}


	/** Output query value when having query parameter. */
	outputQueryValue(): TS.Expression {
		if (!this.queryParameter) {
			return factory.createNull()
		}

		let value = this.template.values.outputRawValue(this.queryParameter!, this.slot.valueIndices![0])
		return value
	}

	preInit() {
		this.initBindingClass()
		this.initParameters()
		this.initLatestQueryVariableName()
		this.initLatestVariableNames()
		this.bindingVariableName = this.tree.makeUniqueBindingName()

		// Use a delegator to delegate binding part because it may be deleted.
		if (this.withQueryToken) {
			Modifier.addImport('PartDelegator', '@pucelle/lupos.js')
			this.delegatorVariableName = this.tree.makeUniqueDelegatorName()

			if (this.implementsPart) {
				this.tree.addPart(this.delegatorVariableName, this.node)
			}
		}
		else if (this.implementsPart) {
			this.tree.addPart(this.bindingVariableName, this.node)
		}
		
		setLatestBindingInfo(this.node, this.bindingVariableName, this.queryParameter)
	}

	postInit() {}

	/** Check binding class declaration. */
	private initBindingClass() {
		if (KnownInternalBindings[this.name]) {
			let item = KnownInternalBindings[this.name]
			
			// Add as a part.
			if (item.implementsPart) {
				this.implementsPart = true
			}

			// Import binding class.
			Modifier.addImport(item.name, '@pucelle/lupos.js') 

			// Remember class parameter count.
			this.bindingClassParameterCount = item.parameterCount
		}

		else {

			// :bindingName -> bindingName
			let decl = ScopeTree.getDeclarationByName(this.name, this.template.rawNode)

			// `Import ClassBinding`
			// `class ClassBinding {...}`
			if (!decl
				|| (
					!ts.isImportSpecifier(decl)
					&& !(ts.isClassDeclaration(decl))
				)
				|| !decl.name
			) {
				this.slot.diagnoseMissingBinding()
			}
			else {

				// Avoid been removed by typescript compiler.
				if (ts.isImportSpecifier(decl)) {
					Modifier.persistImport(decl)
				}

				DiagnosticModifier.removeNeverRead(decl)

				let bindingModuleName = Helper.symbol.resolveImport(decl)
				let bindingClass = Helper.symbol.resolveDeclaration(decl, ts.isClassDeclaration)!

				this.template.addRefedDeclaration(decl)

				if (bindingClass
					&& Helper.cls.isImplemented(bindingClass, 'Part', '@pucelle/lupos.js', bindingModuleName?.moduleName)
				) {
					this.implementsPart = true
				}

				let bindingClassParams = bindingClass ? Helper.cls.getConstructorParameters(bindingClass) : null
				this.bindingClassParameterCount = bindingClassParams ? bindingClassParams.length : null
			}
		}
	}

	/** Initialize as list parameters, like `:bind=${a, b}` will be parsed as `[a, b]`. */
	protected initParameters() {
		if (this.slot.strings || !this.slot.valueIndices) {
			return
		}

		let parameters = this.splitToParameters()

		if (this.withQueryToken) {
			this.queryParameter = parameters[0] ?? null
			this.parameterList = parameters.slice(1)
		}
		else {
			this.parameterList = parameters
		}
	}

	/** 
	 * For binding parameter list like `:binding=${a, b}` or `:binding=${(a, b)}`,
	 * get nodes after splitting the parameters to a list.
	 * `valueIndices` must exist to get this list.
	 */
	private splitToParameters(): TS.Expression[] {
		let rawValueNode = this.template.values.getRawValue(this.slot.valueIndices![0])

		if (ts.isParenthesizedExpression(rawValueNode)) {
			rawValueNode = rawValueNode.expression
		}

		let rawValueNodes = Helper.pack.unBundleCommaBinaryExpressions(rawValueNode)

		// May unused comma expression of a for `${a, b}`, here remove it.
		if (rawValueNodes.length > 1) {
			for (let i = 0; i < rawValueNodes.length - 1; i++) {
				DiagnosticModifier.removeUnusedComma(rawValueNodes[i])
			}
		}

		return rawValueNodes
	}

	/** Initialize latest query variable name, must after `initParameterList`. */
	protected initLatestQueryVariableName() {
		if (this.queryParameter) {
			this.latestQueryVariableName = this.slot.makeCustomGroupOfLatestNames([this.queryParameter])[0]
		}
	}

	/** Initialize latest variable names, must after `initParameterList`. */
	protected initLatestVariableNames() {
		if (this.parameterList) {
			this.latestVariableNames = this.slot.makeCustomGroupOfLatestNames(this.parameterList)
		}
		else {
			this.latestVariableNames = this.slot.makeGroupOfLatestNames()
		}

		// All be `null`.
		if (this.latestVariableNames && this.latestVariableNames.every(v => !v)) {
			this.latestVariableNames = null
		}
	}

	outputInit() {
		let nodeName = this.slot.getRefedNodeName()
		let bindingParamCount = this.bindingClassParameterCount

		let bindingClassName = KnownInternalBindings[this.name]
			? KnownInternalBindings[this.name].name
			: this.name

		let bindingParams: TS.Expression[] = [factory.createIdentifier(nodeName)]

		// Need `context` parameter
		if (bindingParamCount === null || bindingParamCount > 1) {
			bindingParams.push(factory.createIdentifier(VariableNames.context))
		}

		// Need `modifiers` parameter
		if (bindingParamCount === null || bindingParamCount > 2 && this.modifiers.length > 0) {
			bindingParams.push(factory.createArrayLiteralExpression(
				this.modifiers.map(m => factory.createStringLiteral(m)),
				false
			))
		}

		// let $binding_0 = new ClassBinding($node_0, ?context, ?modifiers)
		let bindingInit = this.slot.createVariableAssignment(
			this.bindingVariableName,
			factory.createNewExpression(
				factory.createIdentifier(bindingClassName),
				undefined,
				bindingParams
			)
		)

		let init = [bindingInit]


		// let $delegator_0 = new PartDelegator()
		if (this.delegatorVariableName) {
			let delegatorPart = this.slot.createVariableAssignment(
				this.delegatorVariableName,
				factory.createNewExpression(
					factory.createIdentifier('PartDelegator'),
					undefined,
					[]
				)
			)

			init.push(delegatorPart)
		}

		return init
	}

	outputUpdate() {
		let queryValue = this.outputQueryValue()
		let values = this.outputValue()

		let callMethod = 'update'
		let callValues = this.parameterList ? values.valueNodes : [values.joint]
		let callWith = this.patchCallMethodAndValues({method: callMethod, values: callValues})
		callMethod = callWith.method
		callValues = callWith.values

		let update: TS.Statement | TS.Expression

		// if ($latest_0 !== $values[0]) {
		//   $binding_0.callMethod(callValue)
		//   $latest_0 = $values[0]
		// }
		if (this.latestVariableNames) {
			update = factory.createIfStatement(
				this.slot.outputLatestComparison(this.latestVariableNames, values.valueNodes),
				factory.createBlock(
					[
						factory.createExpressionStatement(factory.createCallExpression(
							factory.createPropertyAccessExpression(
								factory.createIdentifier(this.bindingVariableName),
								factory.createIdentifier(callMethod)
							),
							undefined,
							callValues
						)),
						...this.slot.outputLatestAssignments(this.latestVariableNames, values.valueNodes),
					],
					true
				),
				undefined
			)
		}

		// $binding_0.update($values[0])
		else {
			update = factory.createCallExpression(
				factory.createPropertyAccessExpression(
					factory.createIdentifier(this.bindingVariableName),
					factory.createIdentifier(callMethod)
				),
				undefined,
				callValues
			)
		}

		// For `?:binding=...`.
		if (this.delegatorVariableName) {
			let isStaticUpdate = !this.latestVariableNames
			return this.outputDelegator(queryValue, update, isStaticUpdate)
		}

		return update
	}

	/** To patch update call method and values. */
	protected patchCallMethodAndValues(callWith: BindingUpdateCallWith): BindingUpdateCallWith {
		return callWith
	}

	private outputDelegator(queryValue: TS.Expression, update: TS.Statement | TS.Expression, isStaticUpdate: boolean) {

		// if ($values[0]) {
		//   NormalUpdateLogic
		// }

		// if ($values[0] && !$latest_0) {
		//   StaticUpdatePosition
		//   $delegator_0.update($binding_0)
		//   $latest_0 = $values[0]
		// }
		// else if (!$values[0] && $latest_0) {
		//   $delegator_0.update(null)
		//   $latest_0 = $values[0]
		// }

		// If `isStaticUpdate`,
		// Moves `NormalUpdateLogic` to `StaticUpdatePosition`.

		let updateIf: TS.Statement | null = null
		
		if (!isStaticUpdate) {
			updateIf = factory.createIfStatement(
				queryValue,
				factory.createBlock(
					[Helper.pack.toStatement(update)],
					true
				),
				undefined
			)
		}
		

		let compare: TS.Statement | null = null

		if (this.latestQueryVariableName) {
			compare = factory.createIfStatement(
				factory.createBinaryExpression(
					queryValue,
					factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
					factory.createPrefixUnaryExpression(
						ts.SyntaxKind.ExclamationToken,
						factory.createIdentifier(this.latestQueryVariableName)
					)
				),
				factory.createBlock(
					[
						...(isStaticUpdate ? [Helper.pack.toStatement(update)] : []),
						factory.createExpressionStatement(factory.createCallExpression(
							factory.createPropertyAccessExpression(
								factory.createIdentifier(this.delegatorVariableName!),
								factory.createIdentifier('update')
							),
							undefined,
							[factory.createIdentifier(this.bindingVariableName)]
						)),
						factory.createExpressionStatement(factory.createBinaryExpression(
							factory.createIdentifier(this.latestQueryVariableName),
							factory.createToken(ts.SyntaxKind.EqualsToken),
							queryValue
						))
					],
					true
				),
				factory.createIfStatement(
					factory.createBinaryExpression(
						factory.createPrefixUnaryExpression(
							ts.SyntaxKind.ExclamationToken,
							queryValue
						),
						factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
						factory.createIdentifier(this.latestQueryVariableName)
					),
					factory.createBlock(
					[
						factory.createExpressionStatement(factory.createCallExpression(
							factory.createPropertyAccessExpression(
								factory.createIdentifier(this.delegatorVariableName!),
								factory.createIdentifier('update')
							),
							undefined,
							[factory.createNull()]
						)),
						factory.createExpressionStatement(factory.createBinaryExpression(
							factory.createIdentifier(this.latestQueryVariableName),
							factory.createToken(ts.SyntaxKind.EqualsToken),
							queryValue
						))
					],
					true
					),
					undefined
				)
			)
		}
		
		return [
			...(updateIf ? [updateIf] : []),
			...(compare ? [compare] : []),
		]
	}
}