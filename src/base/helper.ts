import type TS from 'typescript'
import {factory, printer, sourceFile, transformContext, ts, typeChecker} from './global'


/** Property or element access types. */
export type AccessNode = TS.PropertyAccessExpression | TS.ElementAccessExpression

/** Property access types. */
export type AssignmentNode = TS.BinaryExpression | TS.PostfixUnaryExpression | TS.PrefixUnaryExpression

/** Resolved names after resolve importing of a node. */
export interface ResolvedImportNames {
	memberName: string
	moduleName: string
}

/** How the flow was interrupted. */
export enum FlowInterruptionTypeMask {
	Return = 1,
	BreakLike = 2,
	YieldLike = 4,
}


/** Help to get and check. */
export namespace Helper {


	//// Global, share

	/** Get node full text, can output from a newly created node. */
	export function getFullText(node: TS.Node) {
		if (node.pos >= 0) {
			try {
				return node.getText()
			}
			catch (err) {
				return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)
			}
		}
		else {
			return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)
		}
	}

	/** get text without quoted for string, otherwise get full text. */
	export function getText(node: TS.Node): string {
		if (ts.isStringLiteral(node)) {
			return node.text
		}
		else {
			return getFullText(node)
		}
	}

	/** Returns the identifier, like variable or declaration name of a given node if possible. */
	export function getIdentifier(node: TS.Node): TS.Identifier | undefined {

		// Identifier itself.
		if (ts.isIdentifier(node)) {
			return node
		}

		// Declaration of a class or interface, property, method, function name, get or set name.
		if ((ts.isClassDeclaration(node)
				|| ts.isInterfaceDeclaration(node)
				|| ts.isVariableDeclaration(node)
				|| ts.isMethodDeclaration(node)
				|| ts.isPropertyDeclaration(node)
				|| ts.isFunctionDeclaration(node)
				|| ts.isGetAccessorDeclaration(node)
				|| ts.isSetAccessorDeclaration(node)
				|| ts.isImportSpecifier(node)
			)
			&& node.name
			&& ts.isIdentifier(node.name)
		) {
			return node.name
		}

		// Identifier of type reference node.
		if (ts.isTypeReferenceNode(node)
			&& ts.isIdentifier(node.typeName)
		) {
			return node.typeName
		}

		// Identifier of type query node.
		if (ts.isTypeQueryNode(node)
			&& ts.isIdentifier(node.exprName)
		) {
			return node.exprName
		}

		// Decorator name.
		if (ts.isDecorator(node)) {

			// @decorator
			if (ts.isIdentifier(node.expression)) {
				return node.expression
			}

			// @decorator(...)
			if (ts.isCallExpression(node.expression)
				&& ts.isIdentifier(node.expression.expression)
			) {
				return node.expression.expression
			}
		}

		return undefined
	}


	/** Visit node and all descendant nodes, find a node match test fn. */
	export function findInward(node: TS.Node, test: (node: TS.Node) => boolean) : TS.Node | null {
		if (test(node)) {
			return node
		}

		let found: TS.Node | null = null

		ts.visitEachChild(node, (n) => {
			found ||= findInward(n, test)
			return n
		}, transformContext)

		return found
	}


	/** Whether be function, method, or get/set accessor. */
	export function isFunctionLike(node: TS.Node): node is TS.FunctionLikeDeclaration {
		return ts.isMethodDeclaration(node)
			|| ts.isMethodSignature(node)
			|| ts.isFunctionDeclaration(node)
			|| ts.isFunctionExpression(node)
			|| ts.isGetAccessorDeclaration(node)
			|| ts.isSetAccessorDeclaration(node)
			|| ts.isArrowFunction(node)
			|| ts.isConstructorDeclaration(node)
	}

	/** Whether be a property declaration or signature. */
	export function isPropertyLike(node: TS.Node): node is TS.PropertySignature | TS.PropertyDeclaration {
		return ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)
	}

	/** Whether be property or signature, or get accessor. */
	export function isPropertyOrGetAccessor(node: TS.Node):
		node is TS.PropertySignature | TS.PropertyDeclaration | TS.GetAccessorDeclaration
	{
		return ts.isPropertySignature(node)
			|| ts.isPropertyDeclaration(node)
			|| ts.isGetAccessorDeclaration(node)
	}

	/** Whether be property or signature, get/set accessor. */
	export function isPropertyOrGetSetAccessor(node: TS.Node):
		node is TS.PropertySignature | TS.PropertyDeclaration | TS.GetAccessorDeclaration | TS.SetAccessorDeclaration
	{
		return ts.isPropertySignature(node)
			|| ts.isPropertyDeclaration(node)
			|| ts.isGetAccessorDeclaration(node)
			|| ts.isSetAccessorDeclaration(node)
	}

	/** Whether be a method declaration or signature. */
	export function isMethodLike(node: TS.Node): node is TS.MethodSignature | TS.MethodDeclaration {
		return ts.isMethodSignature(node) || ts.isMethodDeclaration(node)
	}

	/** Whether node represents a type-only node. */
	export function isTypeDeclaration(node: TS.Node): node is TS.TypeAliasDeclaration | TS.InterfaceDeclaration {
		return ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)
	}


	/** 
	 * Make a property name node by property name string.
	 * If name is numeric, it must `>=0`.
	 */
	export function createPropertyName(name: string | number): TS.PropertyName {
		if (typeof name === 'string' && /^[\w$]+$/.test(name)) {
			return factory.createIdentifier(name)
		}
		else if (typeof name === 'string' && /^#[\w$]+$/.test(name)) {
			return factory.createPrivateIdentifier(name)
		}
		else if (typeof name === 'string') {
			return factory.createStringLiteral(name)
		}
		else {
			return factory.createNumericLiteral(name)
		}
	}

	/** Make a numeric literal or expression by number. */
	export function createNumeric(number: number): TS.PrefixUnaryExpression | TS.NumericLiteral {
		if (number < 0) {
			return factory.createPrefixUnaryExpression(
				ts.SyntaxKind.MinusToken,
				factory.createNumericLiteral(-number)
			)
		}
		else {
			return factory.createNumericLiteral(number)
		}
	}

	/** Create an access node by expression and property name. */
	export function createAccessNode(exp: TS.Expression, name: string | number): AccessNode {
		if (typeof name === 'string' && /^[\w$]+$/.test(name)) {
			return factory.createPropertyAccessExpression(
				exp,
				factory.createIdentifier(name)
			)
		}
		else if (typeof name === 'string' && /^#[\w$]+$/.test(name)) {
			return factory.createPropertyAccessExpression(
				exp,
				factory.createPrivateIdentifier(name)
			)
		}
		else if (typeof name === 'string') {
			return factory.createElementAccessExpression(
				exp,
				factory.createStringLiteral(name)
			)
		}
		else {
			return factory.createElementAccessExpression(
				exp,
				createNumeric(name)
			)
		}
	}



	/** Decorator Part */
	export namespace deco {

		/** Get all decorator from a class declaration, a property or method declaration. */
		export function getDecorators(
			node: TS.ClassDeclaration | TS.MethodDeclaration | TS.PropertyDeclaration | TS.GetAccessorDeclaration | TS.SetAccessorDeclaration
		): TS.Decorator[] {
			return (node.modifiers?.filter((m: TS.ModifierLike) => ts.isDecorator(m)) || []) as TS.Decorator[]
		}

		/** Get the first decorator from a class declaration, a property or method declaration. */
		export function getFirst(
			node: TS.ClassDeclaration | TS.MethodDeclaration | TS.PropertyDeclaration | TS.GetAccessorDeclaration | TS.SetAccessorDeclaration
		): TS.Decorator | undefined {
			return node.modifiers?.find((m: TS.ModifierLike) => ts.isDecorator(m)) as TS.Decorator | undefined
		}

		/** Get the first decorator from a class declaration, a property or method declaration. */
		export function getFirstName(
			node: TS.ClassDeclaration | TS.MethodDeclaration | TS.PropertyDeclaration | TS.GetAccessorDeclaration | TS.SetAccessorDeclaration
		): string | undefined {
			let decorator = getFirst(node)
			let decoName = decorator ? getName(decorator) : undefined

			return decoName
		}

		/** Get the first decorator name of a decorator. */
		export function getName(node: TS.Decorator): string | undefined {
			let resolved = symbol.resolveImport(node)
			if (resolved) {
				return resolved.memberName
			}

			let decl = symbol.resolveDeclaration(node, ts.isFunctionDeclaration)
			if (!decl) {
				return undefined
			}

			return decl.name?.text
		}
	}



	/** Class part */
	export namespace cls {

		/** 
		 * Get name of a class member.
		 * For a constructor function, it returns `constructor`
		 */
		export function getMemberName(node: TS.ClassElement): string {
			if (ts.isConstructorDeclaration(node)) {
				return 'constructor'
			}
			else {
				return getFullText(node.name!)
			}
		}

		/** 
		 * Get one class member declaration by it's name.
		 * `resolveExtend` specifies whether will look at extended class.
		 */
		export function getMember(node: TS.ClassDeclaration, memberName: string, resolveExtend: boolean = false): TS.ClassElement | undefined {
			if (resolveExtend) {
				let prop = getMember(node, memberName, false)
				if (prop) {
					return prop
				}

				let superClass = getSuper(node)
				if (superClass) {
					return getMember(superClass, memberName, resolveExtend)
				}

				return undefined
			}
			else {
				return node.members.find(m => {
					return getMemberName(m) === memberName
				}) as TS.PropertyDeclaration | undefined
			}
		}

		/** 
		 * Get one class property declaration by it's name.
		 * `resolveExtend` specifies whether will look at extended class.
		 */
		export function getProperty(node: TS.ClassDeclaration, propertyName: string, resolveExtend: boolean = false): TS.PropertyDeclaration | undefined {
			if (resolveExtend) {
				let prop = getProperty(node, propertyName, false)
				if (prop) {
					return prop
				}

				let superClass = getSuper(node)
				if (superClass) {
					return getProperty(superClass, propertyName, resolveExtend)
				}

				return undefined
			}
			else {
				return node.members.find(m => {
					return ts.isPropertyDeclaration(m)
						&& getMemberName(m) === propertyName
				}) as TS.PropertyDeclaration | undefined
			}
		}

		/** 
		 * Get one class method declaration by it's name.
		 * `resolveExtend` specifies whether will look at extended class.
		 */
		export function getMethod(node: TS.ClassDeclaration, methodName: string, resolveExtend: boolean = false): TS.MethodDeclaration | undefined {
			if (resolveExtend) {
				let prop = getMethod(node, methodName, false)
				if (prop) {
					return prop
				}

				let superClass = getSuper(node)
				if (superClass) {
					return getMethod(superClass, methodName, resolveExtend)
				}

				return undefined
			}
			else {
				return node.members.find(m => {
					return ts.isMethodDeclaration(m)
						&& getMemberName(m) === methodName
				}) as TS.MethodDeclaration | undefined
			}
		}

		/** Get extends expression. */
		export function getExtends(node: TS.ClassDeclaration): TS.ExpressionWithTypeArguments | undefined {
			let extendHeritageClause = node.heritageClauses?.find(hc => {
				return hc.token === ts.SyntaxKind.ExtendsKeyword
			})

			if (!extendHeritageClause) {
				return undefined
			}

			let firstType = extendHeritageClause.types[0]
			if (!firstType) {
				return undefined
			}

			return firstType
		}

		/** Get super class declaration. */
		export function getSuper(node: TS.ClassDeclaration): TS.ClassDeclaration | undefined {
			let extendsNode = getExtends(node)
			if (!extendsNode) {
				return undefined
			}

			let exp = extendsNode.expression
			let superClass = symbol.resolveDeclaration(exp, ts.isClassDeclaration)

			return superClass as TS.ClassDeclaration | undefined
		}

		/** Test whether is derived class of a specified named class, and of specified module. */
		export function isDerivedOf(node: TS.ClassDeclaration, declName: string, moduleName: string): boolean {
			let extendHeritageClause = node.heritageClauses?.find(hc => {
				return hc.token === ts.SyntaxKind.ExtendsKeyword
			})

			if (!extendHeritageClause) {
				return false
			}

			let firstType = extendHeritageClause.types[0]
			if (!firstType || !ts.isExpressionWithTypeArguments(firstType)) {
				return false
			}

			let exp = firstType.expression

			let resolved = symbol.resolveImport(exp)
			if (resolved) {
				if (resolved.moduleName === moduleName && resolved.memberName === declName) {
					return true
				}
			}

			let superClass = symbol.resolveDeclaration(exp, ts.isClassDeclaration)
			if (superClass) {
				return isDerivedOf(superClass, declName, moduleName)
			}

			return false
		}

		/** 
		 * Test whether class or super class implements a type with specified name and located at specified module.
		 * If `outerModuleName` specified, and importing from a relative path, it implies import from this module.
		 */
		export function isImplemented(node: TS.ClassDeclaration, typeName: string, moduleName: string, outerModuleName?: string): boolean {
			let implementClauses = node.heritageClauses?.find(h => {
				return h.token === ts.SyntaxKind.ImplementsKeyword
			})

			if (implementClauses) {
				let implementModules = implementClauses.types.find(type => {
					let resolved = symbol.resolveImport(type.expression)

					if (!resolved) {
						return false
					}

					if (resolved.memberName !== typeName) {
						return false
					}
					
					if (resolved.moduleName === moduleName) {
						return true
					}

					// Import relative module, try match outer module name/
					if (outerModuleName
						&& resolved.moduleName.startsWith('.')
					) {
						if (moduleName === outerModuleName) {
							return true
						}
					}
					
					return false
				})

				if (implementModules) {
					return true
				}
			}

			let superClass = getSuper(node)
			if (!superClass) {
				return false
			}

			return isImplemented(superClass, typeName, moduleName)
		}

		/** Get constructor. */
		export function getConstructor(node: TS.ClassDeclaration, resolveExtend: boolean = false): TS.ConstructorDeclaration | undefined {
			let cons = node.members.find(v => ts.isConstructorDeclaration(v)) as TS.ConstructorDeclaration | undefined
			if (cons) {
				return cons
			}

			if (resolveExtend) {
				let superClass = getSuper(node)
				if (superClass) {
					return getConstructor(superClass, resolveExtend)
				}
			}

			return undefined
		}

		/** Get constructor parameter list, even from super class. */
		export function getConstructorParameters(node: TS.ClassDeclaration): TS.ParameterDeclaration[] | undefined {
			let constructor = getConstructor(node, true)
			if (constructor) {
				return [...constructor.parameters]
			}
	
			return undefined
		}

		/** Whether property or method has specified modifier. */
		export function hasModifier(node: TS.PropertyDeclaration | TS.MethodDeclaration, name: 'readonly' | 'static' | 'protected' | 'private'): boolean {
			for (let modifier of node.modifiers || []) {
				if (modifier.kind === ts.SyntaxKind.ReadonlyKeyword && name === 'readonly') {
					return true
				}
				else if (modifier.kind === ts.SyntaxKind.StaticKeyword && name === 'static') {
					return true
				}
				else if (modifier.kind === ts.SyntaxKind.ProtectedKeyword && name === 'protected') {
					return true
				}
				else if (modifier.kind === ts.SyntaxKind.PrivateKeyword && name === 'private') {
					return true
				}
			}

			return false
		}
	}



	/** Property Access. */
	export namespace access {

		/** Whether be accessing like `a.b` or `a[b]`. */
		export function isAccess(node: TS.Node): node is AccessNode {
			return ts.isPropertyAccessExpression(node)
				|| ts.isElementAccessExpression(node)
		}

		/** Test whether be `Map` or `Set`, or of `Array` type. */
		export function isListStruct(rawNode: TS.Node) {
			let type = Helper.types.typeOf(rawNode)
			let typeNode = Helper.types.getOrMakeTypeNode(rawNode)
			let objName = typeNode ? Helper.types.getTypeNodeReferenceName(typeNode) : undefined

			return objName === 'Map'
				|| objName === 'Set'
				|| Helper.types.isArrayType(type)
		}
	
		/** get accessing name node. */
		export function getNameNode(node: AccessNode): TS.Expression {
			return ts.isPropertyAccessExpression(node)
				? node.name
				: node.argumentExpression
		}

		/** get property accessing name text. */
		export function getNameText(node: AccessNode): string {
			let nameNode = getNameNode(node)
			return getText(nameNode)
		}
	}



	/** Property Assignment */
	export namespace assign {

		/** Whether be property assignment like `a = x`. */
		export function isAssignment(node: TS.Node): node is AssignmentNode {
			if (ts.isBinaryExpression(node)) {
				return node.operatorToken.kind === ts.SyntaxKind.EqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.AsteriskEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.SlashEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.PercentEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.LessThanLessThanEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.AmpersandEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.BarEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.CaretEqualsToken
			}
			else if (ts.isPostfixUnaryExpression(node)) {
				return node.operator === ts.SyntaxKind.PlusPlusToken
					|| node.operator === ts.SyntaxKind.MinusMinusToken
			}
			else if (ts.isPrefixUnaryExpression(node)) {
				return node.operator === ts.SyntaxKind.PlusPlusToken
					|| node.operator === ts.SyntaxKind.MinusMinusToken
			}

			return false
		}

		/** 
		 * get the value assigning from.
		 * `b` of `a = b`
		 */
		export function getFrom(node: AssignmentNode): TS.Expression {
			if (ts.isBinaryExpression(node)) {
				return node.right
			}
			else {
				return node.operand
			}
		}


		/** 
		 * get the expressions assigning to.
		 * `a` of `a = b`
		 * `a, b` of `[a, b] = c`
		 */
		export function getToExpressions(node: AssignmentNode): TS.Expression[] {
			if (ts.isBinaryExpression(node)) {
				return [...walkAssignToExpressions(node.left)]
			}
			else {
				return [node.operand]
			}
		}

		/** Walk for assign to expressions.  */
		function* walkAssignToExpressions(node: TS.Expression): Iterable<TS.Expression> {
			if (ts.isArrayLiteralExpression(node)) {
				for (let el of node.elements) {
					yield* walkAssignToExpressions(el)
				}
			}
			else if (ts.isObjectLiteralExpression(node)) {
				for (let prop of node.properties) {
					if (ts.isPropertyAssignment(prop)) {
						yield* walkAssignToExpressions(prop.initializer)
					}
				}
			}
			else {
				yield node
			}
		}
	}



	/** Variable declarations. */
	export namespace variable {

		/** Test whether a node is an variable name identifier. */
		export function isVariableIdentifier(node: TS.Node): node is TS.Identifier {
			if (!ts.isIdentifier(node)) {
				return false
			}

			// `a.b`, b is identifier, but not a variable identifier.
			if (node.parent
				&& ts.isPropertyAccessExpression(node.parent)
				&& node === node.parent.name
			) {
				return false
			}

			// {a: 1}, a is identifier, but not variable identifier.
			if (node.parent
				&& (ts.isPropertyAssignment(node.parent) || ts.isPropertySignature(node.parent))
				&& node === node.parent.name
			) {
				return false
			}

			// Type node.
			if (node.parent
				&& ts.isTypeReferenceNode(node.parent)
			) {
				return false
			}

			// `undefined` is an identifier.
			if (node.text === 'undefined') {
				return false
			}

			return true
		}


		/**
		 * `let {a: b} = c` =>
		 * - name: b
		 * - keys: ['a']
		 */
		interface VariableDeclarationName {
			node: TS.Identifier
			name: string
			keys: (string | number)[]
		}

		/** 
		 * Walk for all declared variable names from a variable declaration.
		 * `let [a, b]` = ... -> `[a, b]`
		 * `let {a, b}` = ... -> `[a, b]`
		 */
		export function* walkDeclarationNames(node: TS.VariableDeclaration): Iterable<VariableDeclarationName> {
			return yield* walkVariablePatternElement(node.name, [])
		}

		/** Get all declared variable name from a variable pattern. */
		function* walkVariablePatternElement(
			node: TS.BindingName | TS.BindingElement | TS.ObjectBindingPattern | TS.ArrayBindingPattern | TS.OmittedExpression,
			keys: (string | number)[]
		): Iterable<VariableDeclarationName> {
			if (ts.isOmittedExpression(node)) {
				return
			}

			if (ts.isObjectBindingPattern(node)) {
				for (let element of node.elements) {
					let key = getText(element.propertyName ?? element.name)
					yield* walkVariablePatternElement(element, [...keys, key])
				}
			}
			else if (ts.isArrayBindingPattern(node)) {
				for (let i = 0; i < node.elements.length; i++) {
					let element = node.elements[i]
					yield* walkVariablePatternElement(element, [...keys, i])
				}
			}
			else if (ts.isBindingElement(node)) {
				yield* walkVariablePatternElement(node.name, keys)
			}
			else if (ts.isIdentifier(node)) {
				yield {
					node,
					name: getFullText(node),
					keys,
				}
			}
		}
	}


	
	/** Type part */
	export namespace types {

		/** 
		 * Get type node of a node.
		 * Will firstly try to get type node when doing declaration,
		 * If can't find, make a new type node, but it can't be resolved.
		 */
		export function getOrMakeTypeNode(node: TS.Node): TS.TypeNode | undefined {
			let typeNode: TS.TypeNode | undefined

			// `class {a: Type = xxx}`
			if (access.isAccess(node)) {
				typeNode = symbol.resolveDeclaration(node, isPropertyOrGetAccessor)?.type
			}

			// `let a: Type`
			else if (variable.isVariableIdentifier(node)) {
				typeNode = symbol.resolveDeclaration(node, ts.isVariableDeclaration)?.type
			}

			// `() => Type`
			else if (ts.isCallExpression(node)) {
				typeNode = symbol.resolveDeclaration(node.expression, Helper.isFunctionLike)?.type
			}

			if (typeNode) {
				return typeNode
			}

			// This generated type node can't be resolved.
			return typeToTypeNode(typeOf(node))
		}

		/** Get type of a node. */
		export function typeOf(node: TS.Node): TS.Type {
			return typeChecker.getTypeAtLocation(node)
		}

		/** 
		 * Get type node of a type.
		 * Note the returned type node is not in source file, so can't be resolved.
		 */
		export function typeToTypeNode(type: TS.Type): TS.TypeNode | undefined {
			return typeChecker.typeToTypeNode(type, undefined, undefined)
		}

		/** Get type of a type node. */
		export function typeOfTypeNode(typeNode: TS.TypeNode): TS.Type | undefined {
			return typeChecker.getTypeFromTypeNode(typeNode)
		}

		/** Get full text of a type, all type parameters are included. */
		export function getTypeFullText(type: TS.Type): string {
			return typeChecker.typeToString(type)
		}

		/** Get the reference name of a type node, all type parameters are excluded. */
		export function getTypeNodeReferenceName(node: TS.TypeNode): string | undefined {
			if (!ts.isTypeReferenceNode(node)) {
				return undefined
			}

			let typeName = node.typeName
			if (!ts.isIdentifier(typeName)) {
				return undefined
			}

			return typeName.text
		}

		/** Get the returned type of a method / function declaration. */
		export function getReturnType(node: TS.SignatureDeclaration): TS.Type | undefined {
			let signature = typeChecker.getSignatureFromDeclaration(node)
			if (!signature) {
				return undefined
			}

			return signature.getReturnType()
		}

		/** Whether returned `void` or `Promise<void>`. */
		export function isVoidReturning(node: TS.FunctionLikeDeclaration): boolean {
			let type = types.getReturnType(node)
			if (!type) {
				return false
			}

			let typeText = getTypeFullText(type)
			
			return typeText === 'void' || typeText === 'Promise<void>'
		}


		/** Test whether type is object. */
		export function isObjectType(type: TS.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => isObjectType(t))
			}

			return (type.getFlags() & ts.TypeFlags.Object) > 0
		}

		/** Test whether type represents a value. */
		export function isValueType(type: TS.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => isValueType(t))
			}

			return (type.getFlags() & (
				ts.TypeFlags.StringLike
					| ts.TypeFlags.NumberLike
					| ts.TypeFlags.BigIntLike
					| ts.TypeFlags.BooleanLike
					| ts.TypeFlags.ESSymbolLike
					| ts.TypeFlags.Undefined
					| ts.TypeFlags.Null
			)) > 0
		}

		/** Test whether type represents a string. */
		export function isStringType(type: TS.Type): boolean {
			return (type.getFlags() & ts.TypeFlags.StringLike) > 0
		}

		/** Test whether type represents a number. */
		export function isNumericType(type: TS.Type): boolean {
			return (type.getFlags() & ts.TypeFlags.NumberLike) > 0
		}

		/** Test whether type represents a value, and not null or undefined. */
		export function isNonNullableValueType(type: TS.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => isNonNullableValueType(t))
			}

			return (type.getFlags() & (
				ts.TypeFlags.StringLike
					| ts.TypeFlags.NumberLike
					| ts.TypeFlags.BigIntLike
					| ts.TypeFlags.BooleanLike
					| ts.TypeFlags.ESSymbolLike
			)) > 0
		}

		/** 
		 * Test whether type of a node extends `Array<any>`.
		 * Note array tuple like `[number, number]` is not included.
		 */
		export function isArrayType(type: TS.Type): boolean {
			return typeChecker.isArrayType(type)
		}


		/** Analysis whether the property declaration resolve from a node is readonly. */
		export function isReadonly(node: TS.Node): boolean {

			// `class A{readonly p}` -> `p` and `this['p']` are readonly.
			// `interface A{readonly p}` -> `p` and `this['p']` are readonly.
			let propDecl = symbol.resolveDeclaration(node, isPropertyLike)
			if (propDecl && propDecl.modifiers?.find(m => m.kind === ts.SyntaxKind.ReadonlyKeyword)) {
				return true
			}

			// `a: Readonly<{p: 1}>` -> `a.p` is readonly, not observe.
			// `a: ReadonlyArray<...>` -> `a.?` is readonly, not observe.
			// `a: DeepReadonly<...>` -> `a.?` and `d.?.?` are readonly, not observe.
			// `readonly {...}` -> it may not 100% strict.
			if (access.isAccess(node)) {
				let exp = node.expression

				let expTypeNode = getOrMakeTypeNode(exp)
				if (!expTypeNode) {
					return false
				}

				if (ts.isTypeReferenceNode(expTypeNode)) {
					let name = getTypeNodeReferenceName(expTypeNode)
					if (name === 'Readonly' || name === 'ReadonlyArray') {
						return true
					}
				}

				// Type was expanded and removed alias.
				else if (ts.isTypeOperatorNode(expTypeNode)) {
					if (expTypeNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
						return true
					}
				}
			}

			return false
		}
		
		
		/** 
		 * `A & B` -> `[A, B]`
		 * `Omit<A, B>` -> `[A, B]`
		 */
		export function destructTypeNode(node: TS.TypeNode):
			(TS.TypeReferenceNode | TS.TypeLiteralNode | TS.TypeQueryNode)[]
		{
			let list: (TS.TypeReferenceNode | TS.TypeLiteralNode)[] = []
			ts.visitNode(node, (n: TS.TypeNode) => destructTypeNodeVisitor(n, list))

			return list
		}

		function destructTypeNodeVisitor(node: TS.Node, list: TS.TypeNode[]): TS.Node {
			if (ts.isTypeReferenceNode(node) || ts.isTypeLiteralNode(node) || ts.isTypeQueryNode(node)) {
				list.push(node)
			}

			return ts.visitEachChild(node, (n: TS.Node) => destructTypeNodeVisitor(n, list), transformContext)
		}
	}



	/** 
	 * Symbol & Resolving
	 * Performance test: each resolving cost about 1~5 ms.
	 */
	export namespace symbol {

		/** Test whether a node has an import name and located at a module. */
		export function isImportedFrom(node: TS.Node, memberName: string, moduleName: string): boolean {
			let nm = resolveImport(node)

			if (nm && nm.memberName === memberName && nm.moduleName === moduleName) {
				return true
			}
			else {
				return false
			}
		}

		/** Resolve the import name and module. */
		export function resolveImport(node: TS.Node): ResolvedImportNames | undefined {
			let memberName: string | null = null
			let moduleName: string | null = null

			// `import * as M`, and use it's member like `M.member`.
			if (ts.isPropertyAccessExpression(node)) {
				memberName = getFullText(node.name)

				let decl = resolveDeclaration(node.expression, ts.isNamespaceImport, false)
				if (decl) {
					let moduleNameNode = decl.parent.parent.moduleSpecifier
					moduleName = ts.isStringLiteral(moduleNameNode) ? moduleNameNode.text : ''
				}
			}
			else {
				let decl = resolveDeclaration(node, ts.isImportSpecifier, false)
				if (decl) {
					let moduleNameNode = decl.parent.parent.parent.moduleSpecifier
					memberName =  (decl.propertyName || decl.name).text
					moduleName = ts.isStringLiteral(moduleNameNode) ? moduleNameNode.text : ''
				}
			}

			// Compile codes within `lupos.js` library.
			if (moduleName && moduleName.startsWith('.')
				&& sourceFile.fileName.includes('/lupos.js/tests/')
			) {
				moduleName = '@pucelle/lupos.js'
			}

			if (moduleName !== null && memberName !== null) {
				return {
					memberName,
					moduleName,
				}
			}

			return undefined
		}

		/** 
		 * Resolve the symbol of a given node.
		 * The symbol links to all it's declarations.
		 * 
		 * `resolveAlias` determines whether stop resolving when meet an alias declaration.
		 *  - If wanting to resolve to it's original declared place, set to `true`.
		 *  - If wanting to resolve to it's latest imported place, set to `false`.
		 * Default value is `false`.
		 */
		export function resolveSymbol(node: TS.Node, resolveAlias: boolean): TS.Symbol | undefined {
			let symbol = typeChecker.getSymbolAtLocation(node)

			// Get symbol from identifier.
			if (!symbol && !ts.isIdentifier(node)) {
				let identifier = getIdentifier(node)
				symbol = identifier ? typeChecker.getSymbolAtLocation(identifier) : undefined
			}

			// Resolve aliased symbols to it's original declared place.
			if (resolveAlias && symbol && (symbol.flags & ts.SymbolFlags.Alias) > 0) {
				symbol = typeChecker.getAliasedSymbol(symbol)
			}

			return symbol
		}

		/** Resolves the declarations of a node. */
		export function resolveDeclarations<T extends TS.Declaration>(
			node: TS.Node,
			test?: (node: TS.Node) => node is T,
			resolveAlias: boolean = true
		): T[] | undefined {
			let symbol = resolveSymbol(node, resolveAlias)
			if (!symbol) {
				return undefined
			}

			let decls = symbol.getDeclarations()
			if (test && decls) {
				decls = decls.filter(decl => test(decl))
			}

			return decls as T[] | undefined
		}

		/** Resolves the first declaration from a node. */
		export function resolveDeclaration<T extends TS.Node>(
			node: TS.Node,
			test?: (node: TS.Node) => node is T,
			resolveAlias: boolean = true
		): T | undefined {
			let decls = resolveDeclarations(node, undefined, resolveAlias)
			return (test ? decls?.find(test) : decls?.[0]) as T | undefined
		}

		/** Resolves all declarations from a symbol. */
		export function resolveDeclarationsBySymbol<T extends TS.Node>(symbol: TS.Symbol, test?: (node: TS.Node) => node is T): T[] | undefined {
			let decls = symbol.getDeclarations()
			if (test && decls) {
				decls = decls.filter(decl => test(decl))
			}

			return decls as T[] | undefined
		}

		/** Resolves the first declaration from a symbol. */
		export function resolveDeclarationBySymbol<T extends TS.Node>(symbol: TS.Symbol, test?: (node: TS.Node) => node is T): T | undefined {
			let decls = symbol.getDeclarations()
			return (test ? decls?.find(test) : decls?.[0]) as T | undefined
		}


		/** 
		 * Resolve interface and all it's extended interfaces,
		 * and all the interface like type literals: `type A = {...}`.
		 */
		export function* resolveChainedInterfaces(node: TS.Node): Iterable<TS.InterfaceDeclaration | TS.TypeLiteralNode> {
			
			// `{...}`
			if (ts.isTypeLiteralNode(node)) {
				yield node
			}

			// `interface A {...}`
			else if (ts.isInterfaceDeclaration(node)) {
				yield node

				let extendHeritageClause = node.heritageClauses?.find(hc => {
					return hc.token === ts.SyntaxKind.ExtendsKeyword
				})
	
				if (!extendHeritageClause) {
					return
				}
				
				for (let type of extendHeritageClause.types) {
					yield* resolveChainedInterfaces(type.expression)
				}
			}

			// `type B = A`
			else if (ts.isTypeAliasDeclaration(node)) {
				for (let typeNode of types.destructTypeNode(node.type)) {
					yield* resolveChainedInterfaces(typeNode)
				}
			}

			// Identifier of type reference.
			else if (ts.isTypeReferenceNode(node)) {
				yield* resolveChainedInterfaces(node.typeName)
			}

			// Resolve and continue.
			else {
				let test = (n: TS.Node): n is TS.InterfaceDeclaration | TS.TypeAliasDeclaration => {
					return ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)
				}

				let resolved = resolveDeclarations(node, test)
				if (resolved) {
					for (let res of resolved) {
						yield* resolveChainedInterfaces(res)
					}
				}
			}
		}


		/** 
		 * Resolve class declarations and interface and all it's extended,
		 * and all the interface like type literals: `type A = {...}`.
		 */
		export function* resolveChainedClassesAndInterfaces(node: TS.Node):
			Iterable<TS.InterfaceDeclaration | TS.TypeLiteralNode | TS.ClassDeclaration | TS.ClassExpression>
		{
			
			// `{...}`
			if (ts.isTypeLiteralNode(node)) {
				yield node
			}

			// `interface A {...}`
			else if (ts.isInterfaceDeclaration(node)) {
				yield node

				let extendHeritageClause = node.heritageClauses?.find(hc => {
					return hc.token === ts.SyntaxKind.ExtendsKeyword
				})
	
				if (!extendHeritageClause) {
					return
				}
				
				for (let type of extendHeritageClause.types) {
					yield* resolveChainedClassesAndInterfaces(type.expression)
				}
			}

			// `class A {...}` or `class {...}`
			else if (ts.isClassLike(node)) {
				yield node

				let extendHeritageClause = node.heritageClauses?.find(hc => {
					return hc.token === ts.SyntaxKind.ExtendsKeyword
						|| hc.token === ts.SyntaxKind.ImplementsKeyword
				})
	
				if (!extendHeritageClause) {
					return
				}
				
				for (let type of extendHeritageClause.types) {
					yield* resolveChainedClassesAndInterfaces(type.expression)
				}
			}

			// `type B = A`
			else if (ts.isTypeAliasDeclaration(node)) {
				for (let typeNode of types.destructTypeNode(node.type)) {
					yield* resolveChainedClassesAndInterfaces(typeNode)
				}
			}

			// Identifier of type reference.
			else if (ts.isTypeReferenceNode(node)) {
				yield* resolveChainedClassesAndInterfaces(node.typeName)
			}

			// Resolve and continue.
			else {
				let test = (n: TS.Node): n is TS.InterfaceDeclaration | TS.TypeAliasDeclaration | TS.ClassLikeDeclaration => {
					return ts.isInterfaceDeclaration(n)
						|| ts.isTypeAliasDeclaration(n)
						|| ts.isClassLike(n)
				}

				let resolved = resolveDeclarations(node, test)
				
				if (resolved) {
					for (let res of resolved) {
						yield* resolveChainedClassesAndInterfaces(res)
					}
				}
			}
		}


		/** 
		 * Resolve class declarations from type nodes like:
		 * - `typeof Cls`
		 * - `{new(): Cls}`
		 */
		export function* resolveInstanceDeclarations(typeNode: TS.TypeNode): Iterable<TS.ClassDeclaration> {
			let typeNodes = types.destructTypeNode(typeNode)
			if (typeNodes.length === 0) {
				return
			}

			for (let typeNode of typeNodes) {
	
				// `typeof Com`, resolve `Com`.
				if (ts.isTypeQueryNode(typeNode)) {
					let decls = symbol.resolveDeclarations(typeNode.exprName, ts.isClassDeclaration)
					if (decls) {
						yield* decls
					}
				}
	
				// Resolve returned type of constructor `{new()...}`.
				else {
					for (let decl of symbol.resolveChainedInterfaces(typeNode)) {
						let newCons = decl.members.find(m => ts.isConstructSignatureDeclaration(m) || ts.isConstructorDeclaration(m)) as
							TS.ConstructSignatureDeclaration | TS.ConstructorDeclaration | undefined

						if (!newCons) {
							continue
						}
	
						let newTypeNode = newCons.type
						if (!newTypeNode) {
							continue
						}
	
						yield* resolveInstanceDeclarationsOfTypeNodeNormally(newTypeNode)
					}
				}
			}
		}
		
		/** Destruct type node, and resolve class declarations of each. */
		function* resolveInstanceDeclarationsOfTypeNodeNormally(typeNode: TS.TypeNode): Iterable<TS.ClassDeclaration> {
			let typeNodes = types.destructTypeNode(typeNode)
			if (typeNodes.length === 0) {
				return
			}

			for (let typeNode of typeNodes) {
				let decls = symbol.resolveDeclarations(typeNode, ts.isClassDeclaration)
				if (decls) {
					yield* decls
				}
			}
		}
	

		/** 
		 * Resolve all the class type parameters,
		 * which are the extended parameters of a final heritage class,
		 * and are interface like or type literal like.
		 */
		export function resolveExtendedInterfaceLikeTypeParameters(
			node: TS.ClassDeclaration, finalHeritageName: string, finalHeritageTypeParameterIndex: number
		): (TS.InterfaceDeclaration | TS.TypeLiteralNode)[] {

			let classDecl: TS.ClassDeclaration | undefined = node

			// <A & B, C> -> [[A, B], [C]]
			let refedTypeParameters: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[][] = []
			
			// Assumes `A<B> extends C<D & B>`
			while (classDecl) {

				// `B`
				let selfParameters = classDecl.typeParameters

				// `C<D & B>`
				let extendsNode = cls.getExtends(classDecl)
				if (!extendsNode) {
					break
				}

				// `D & B`
				let superParameters = extendsNode.typeArguments
				if (!superParameters) {
					break
				}

				refedTypeParameters = remapRefedTypeParameters(refedTypeParameters, selfParameters, superParameters)

				// `C`
				if (getFullText(extendsNode.expression) === finalHeritageName) {
					return refedTypeParameters[finalHeritageTypeParameterIndex]
				}

				classDecl = cls.getSuper(classDecl)
			}
			
			return []
		}

		/** Analysis type references, and remap type reference from input parameters to super parameters. */
		function remapRefedTypeParameters(
			refed: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[][],
			selfParameters: TS.NodeArray<TS.TypeParameterDeclaration> | undefined,
			extendsParameters: TS.NodeArray<TS.TypeNode>
		): (TS.InterfaceDeclaration | TS.TypeLiteralNode)[][] {
			let selfMap: Map<string, (TS.InterfaceDeclaration | TS.TypeLiteralNode)[]> = new Map()
			let remapped: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[][] = []

			// Assume `A<B> extends C<D & B>`

			// `B`
			if (selfParameters) {
				for (let i = 0; i < selfParameters.length; i++) {
					let param = selfParameters[i]

					// May no this parameter inputted.
					if (refed[i]) {
						selfMap.set(param.name.text, refed[i])
					}
				}
			}

			for (let i = 0; i < extendsParameters.length; i++) {
				let param = extendsParameters[i]
				let destructed = types.destructTypeNode(param)
				let paramRefed: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[] = []

				for (let ref of destructed) {
					if (ts.isTypeReferenceNode(ref)) {
						let refName = getFullText(ref.typeName)

						// Use input parameter.
						if (selfMap.has(refName)) {
							paramRefed.push(...selfMap.get(refName)!)
						}

						// Use declared interface, or type literal.
						else {
							let chain = resolveChainedInterfaces(ref)
							paramRefed.push(...chain)
						}
					}
				}

				remapped.push(paramRefed)
			}

			return remapped
		}


		/** Check whether a property or get accessor declare in typescript library. */
		export function isOfTypescriptLib(rawNode: TS.Node): boolean {

			// Like `this.el.style.display`
			let decl = resolveDeclaration(rawNode)
			if (!decl) {
				return false
			}

			let fileName = decl.getSourceFile().fileName
			return /\/typescript\/lib\//.test(fileName)
		}
	}



	/** Import part. */
	export namespace imports {

		/** Get import statement come from specified module name. */
		export function getImportFromModule(moduleName: string): TS.ImportDeclaration | undefined {
			return sourceFile.statements.find(st => {
				return ts.isImportDeclaration(st)
					&& ts.isStringLiteral(st.moduleSpecifier)
					&& st.moduleSpecifier.text === moduleName
					&& st.importClause?.namedBindings
					&& ts.isNamedImports(st.importClause?.namedBindings)
			}) as TS.ImportDeclaration | undefined
		}
	}



	/** factory like, re-pack nodes to get another node. */
	export namespace pack {

		/** 
		 * Get flow interruption type,
		 * it represents whether flow was interrupted be `return` with content,
		 * `yield`, `await`, or arrow function with implicit returning.
		 */
		export function getFlowInterruptionType(node: TS.Node): FlowInterruptionTypeMask {
			let type = 0

			if (ts.isReturnStatement(node)
				|| node.parent
					&& ts.isArrowFunction(node.parent)
					&& node === node.parent.body && !ts.isBlock(node)
			) {
				type |= FlowInterruptionTypeMask.Return
			}
			
			if (ts.isBreakOrContinueStatement(node)) {
				type |= FlowInterruptionTypeMask.BreakLike
			}
			
			if (ts.isAwaitExpression(node) || ts.isYieldExpression(node)) {
				type |= FlowInterruptionTypeMask.YieldLike
			}

			return type
		}


		/** Whether be a block or a source file. */
		export function canBlock(node: TS.Node): node is TS.SourceFile | TS.Block {
			return ts.isSourceFile(node)
				|| ts.isBlock(node)
		}

		/** Not a block, but can be extended to a block. */
		export function canExtendToBlock(node: TS.Node): node is TS.Expression | TS.ExpressionStatement {
			let parent = node.parent

			if (ts.isSourceFile(node)) {
				return false
			}

			if (ts.isBlock(node)) {
				return false
			}

			if (ts.isArrowFunction(parent)
				&& node === parent.body
			) {
				return true
			}

			if (ts.isIfStatement(parent)
				&& (node === parent.thenStatement
					|| node === parent.elseStatement
				)
			) {
				return true	
			}

			if ((ts.isForStatement(parent)
					|| ts.isForOfStatement(parent)
					|| ts.isForInStatement(parent)
					|| ts.isWhileStatement(parent)
					|| ts.isDoStatement(parent)
				)
				&& node === parent.statement
			) {
				return true
			}

			return false
		}

		/** Whether can put statements. */
		export function canPutStatements(node: TS.Node): node is TS.SourceFile | TS.Block | TS.CaseOrDefaultClause {
			return canBlock(node)
				|| ts.isCaseOrDefaultClause(node)
		}

		/** Whether can be extended to a block to put statements. */
		export function canExtendToPutStatements(node: TS.Node): node is TS.Expression | TS.ExpressionStatement {
			return canExtendToBlock(node)
		}

		/** 
		 * Whether the node it returns a single value for outer,
		 * or should be just one unique expression, can't be replaced to two.
		 * so that it can be parenthesized.
		 */
		export function shouldBeUnique(node: TS.Node): node is TS.Expression {
			let parent = node.parent

			// Content of flow interrupt
			if (ts.isReturnStatement(parent)
				|| ts.isAwaitExpression(parent)
				|| ts.isYieldExpression(parent)
			) {
				if (parent.expression === node) {
					return true
				}
			}

			// Initializer of variable declaration.
			if (ts.isVariableDeclaration(parent)) {
				if (parent.initializer === node) {
					return true
				}
			}

			// `if (...)`, `case(...)`
			if (ts.isIfStatement(parent) || ts.isSwitchStatement(parent)) {
				if (node === parent.expression) {
					return true
				}
			}

			// `a ? b : c`
			else if (ts.isConditionalExpression(parent)) {
				if (node === parent.condition
					|| node === parent.whenTrue
					|| node === parent.whenFalse
				) {
					return true
				}
			}

			// `a && b`, `a || b`, `a ?? b`.
			else if (ts.isBinaryExpression(parent)) {
				if ((parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
					|| parent.operatorToken.kind === ts.SyntaxKind.BarBarToken
					|| parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
				) {
					if (node === parent.left
						|| node === parent.right
					) {
						return true
					}
				}
			}

			// `for (;;) ...`
			else if (ts.isForStatement(parent)) {
				if (node === parent.initializer
					|| node === parent.condition
					|| node === parent.incrementor
				) {
					return true
				}
			}

			// `for ... in`, `for ... of`, `while ...`, `do ...`
			else if (ts.isForOfStatement(parent)
				|| ts.isForInStatement(parent)
				|| ts.isWhileStatement(parent)
				|| ts.isDoStatement(parent)
			) {
				if (node === parent.expression) {
					return true
				}
			}

			// `a.b`, both `a` and `b` should be an expression.
			else if (ts.isPropertyAccessExpression(parent)
				|| ts.isElementAccessExpression(parent)) {
				return true
			}

			return false
		}


		/** 
		 * Bundle expressions to a parenthesized expression.
		 * `a, b -> (a, b)`
		 */
		export function parenthesizeExpressions(...exps: TS.Expression[]): TS.Expression {

			// Only one expression, returns it.
			if (exps.length === 1) {
				return exps[0]
			}

			let exp = bundleBinaryExpressions(exps, ts.SyntaxKind.CommaToken)
			return factory.createParenthesizedExpression(exp)
		}

		/** 
		 * Bundle expressions to a single binary expression.
		 * `a, b -> a && b`
		 */
		export function bundleBinaryExpressions(exps: TS.Expression[], operator: TS.BinaryOperator): TS.Expression {

			// Only one expression, returns it.
			if (exps.length === 1) {
				return exps[0]
			}

			let exp = exps[0]

			for (let i = 1; i < exps.length; i++) {
				exp = factory.createBinaryExpression(
					exp,
					operator,
					exps[i]
				)
			}

			return exp
		}

		/** 
		 * D expressions to a single binary expression.
		 * `a, b, c -> [a, b, c]`
		 */
		export function unBundleCommaBinaryExpressions(exp: TS.Expression): TS.Expression[] {
			if (ts.isBinaryExpression(exp)
				&& exp.operatorToken.kind === ts.SyntaxKind.CommaToken
			) {
				return [
					...unBundleCommaBinaryExpressions(exp.left),
					...unBundleCommaBinaryExpressions(exp.right),
				]
			}
			else {
				return [exp]
			}
		}

		/** 
		 * For each level of nodes, extract final expressions from a parenthesized expression.
		 * `(a, b, c)` -> `c`
		 */
		export function extractFinalParenthesized(node: TS.Node): TS.Node {
			if (ts.isParenthesizedExpression(node)) {
				let exp = node.expression
				if (ts.isBinaryExpression(exp)
					&& exp.operatorToken.kind === ts.SyntaxKind.CommaToken
				) {
					return extractFinalParenthesized(exp.right)
				}
			}

			return ts.visitEachChild(node, extractFinalParenthesized as any, transformContext)
		}


		/** Remove comments from a property or element access node. */
		export function removeAccessComments<T extends TS.Node>(node: T): T {
			if (ts.isPropertyAccessExpression(node)) {

				// `a?.b`
				if (node.questionDotToken) {
					return factory.createPropertyAccessChain(
						removeAccessComments(node.expression),
						node.questionDotToken,
						removeAccessComments(node.name),
					) as TS.Node as T
				}

				// `a.b`
				else {
					return factory.createPropertyAccessExpression(
						removeAccessComments(node.expression),
						removeAccessComments(node.name)
					) as TS.Node as T
				}
			}
			else if (ts.isElementAccessExpression(node)) {
				
				// `a?.[b]`
				if (node.questionDotToken) {
					return factory.createElementAccessChain(
						removeAccessComments(node.expression),
						node.questionDotToken,
						removeAccessComments(node.argumentExpression),
					) as TS.Node as T
				}

				// `a[b]`
				else {
					return factory.createElementAccessExpression(
						removeAccessComments(node.expression),
						removeAccessComments(node.argumentExpression)
					) as TS.Node as T
				}
			}
			else if (ts.isIdentifier(node)) {
				return factory.createIdentifier(getFullText(node)) as TS.Node as T
			}
			else if (node.kind === ts.SyntaxKind.ThisKeyword) {
				return factory.createThis() as TS.Node as T
			}

			return node
		}


		/** Wrap by a statement if not yet. */
		export function toStatement(node: TS.Node): TS.Statement {
			if (ts.isStatement(node)) {
				return node
			}
			else if (ts.isVariableDeclarationList(node)) {
				return factory.createVariableStatement(undefined, node)
			}
			else if (ts.isExpression(node)) {
				return factory.createExpressionStatement(node)
			}
			else {
				throw new Error(`Don't know how to pack "${getFullText(node)}" to a statement!`)
			}
		}

		/** Wrap each node by a statement if not yet. */
		export function toStatements(nodes: TS.Node[]): TS.Statement[] {
			return nodes.map(n => toStatement(n))
		}


		/** 
		 * Try to clean a node to remove all not-necessary nodes,
		 * and convert multiple ways of describing a node to a unique way.
		 * like remove as expression, or unpack parenthesized, element access to property access.
		 * `deeply` determines whether simplify all descendants.
		 */
		export function normalize(node: TS.Node, deeply: boolean): TS.Node {
			if (ts.isAsExpression(node)
				|| ts.isParenthesizedExpression(node)
				|| ts.isNonNullExpression(node)
			) {
				return normalize(node.expression, deeply)
			}

			// a['prop'] -> a.prop
			else if (ts.isElementAccessExpression(node)
				&& ts.isStringLiteral(node.argumentExpression)
				&& /^[a-z_$][\w$_]*$/i.test(node.argumentExpression.text)
			) {

				// `a?.b`
				if (node.questionDotToken) {
					return factory.createPropertyAccessChain(
						normalize(node.expression, deeply) as TS.Expression,
						node.questionDotToken,
						factory.createIdentifier(node.argumentExpression.text)
					)
				}

				// `a.b`
				else {
					return factory.createPropertyAccessExpression(
						normalize(node.expression, deeply) as TS.Expression,
						factory.createIdentifier(node.argumentExpression.text)
					)
				}
			}

			// '...' -> "..."
			else if (ts.isStringLiteral(node)) {
				return factory.createStringLiteral(node.text)
			}

			else if (deeply) {
				return ts.visitEachChild(node, (node: TS.Node) => normalize(node, true), transformContext)
			}
			else {
				return node
			}
		}


		/** Create `if (...) {return ...}`. */
		export function toIfElseStatement(condExps: TS.Expression[], exps: TS.Expression[]): TS.Statement {

			// Last branch.
			let last: TS.Statement = factory.createBlock(
				[factory.createReturnStatement(
					exps[exps.length - 1]
				)],
				true
			)

			for (let i = exps.length - 2; i >= 0; i--) {
				let conditionNode = condExps[i]

				let thenNode = factory.createBlock(
					[factory.createReturnStatement(exps[i])],
					true
				)

				last = factory.createIfStatement(
					conditionNode,
					thenNode,
					last
				)
			}

			return last
		}


		/**
		 * Create `cond1 ? exp1 : cond2 ? exp2 ...`.
		 * Must ensure `condExps.length` equals `exps.length - 1`
		 */
		export function toConditionalExpression(condExps: TS.Expression[], exps: TS.Expression[]): TS.Expression {

			// Last expression.
			let last: TS.Expression = exps[exps.length - 1]

			for (let i = exps.length - 2; i >= 0; i--) {
				let conditionNode = condExps[i]

				let thenNode = exps[i]

				last = factory.createConditionalExpression(
					conditionNode,
					factory.createToken(ts.SyntaxKind.QuestionToken),
					thenNode,
					factory.createToken(ts.SyntaxKind.ColonToken),
					last
				)  
			}

			return last
		}
	}
}