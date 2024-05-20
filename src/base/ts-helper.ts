import type * as ts from 'typescript'
import {removeQuotes} from '../utils'


/** Help to get and check. */
export class TSHelper {

	readonly typeChecker: ts.TypeChecker
	readonly ts: typeof ts

	constructor(program: ts.Program, typescript: typeof ts) {
		this.typeChecker = program.getTypeChecker()
		this.ts = typescript
	}


	//// Class part

	/** Get name of a class member, even not appended. */
	getAnyClassMemberName(node: ts.ClassElement): string {
		if (this.ts.isConstructorDeclaration(node)) {
			return 'constructor'
		}

		// May node is not appended, thus `getText()` is not available.
		else {
			return (node.name as ts.Identifier).escapedText as string
		}
	}

	/** Get specified named of class property declaration. */
	getClassProperty(node: ts.ClassDeclaration, propertyName: string, followExtend: boolean = false): ts.PropertyDeclaration | undefined {
		if (followExtend) {
			let prop = this.getClassProperty(node, propertyName, false)
			if (prop) {
				return prop
			}

			let superClass = this.getSuperClass(node)
			if (superClass) {
				return this.getClassProperty(superClass, propertyName, followExtend)
			}

			return undefined
		}
		else {
			return node.members.find(m => {
				return this.ts.isPropertyDeclaration(m)
					&& m.name?.getText() === propertyName
			}) as ts.PropertyDeclaration | undefined
		}
	}

	/** Get specified named of class method declaration. */
	getClassMethod(node: ts.ClassDeclaration, methodName: string, followExtend: boolean = false): ts.MethodDeclaration | undefined {
		if (followExtend) {
			let prop = this.getClassMethod(node, methodName, false)
			if (prop) {
				return prop
			}

			let superClass = this.getSuperClass(node)
			if (superClass) {
				return this.getClassMethod(superClass, methodName, followExtend)
			}

			return undefined
		}
		else {
			return node.members.find(m => {
				return this.ts.isMethodDeclaration(m)
					&& m.name?.getText() === methodName
			}) as ts.MethodDeclaration | undefined
		}
	}

	/** Get super class declaration. */
	getSuperClass(node: ts.ClassDeclaration): ts.ClassDeclaration | undefined {
		let extendHeritageClause = node.heritageClauses?.find(hc => {
			return hc.token === this.ts.SyntaxKind.ExtendsKeyword
		})

		if (!extendHeritageClause) {
			return undefined
		}

		let firstType = extendHeritageClause.types[0]
		if (!firstType || !this.ts.isExpressionWithTypeArguments(firstType)) {
			return undefined
		}

		let exp = firstType.expression
		let superClass = this.resolveOneDeclaration(exp, this.ts.isClassDeclaration)

		return superClass as ts.ClassDeclaration | undefined
	}

	/** Test whether is derived class of a specified named class, of specified module. */
	isDerivedClassOf(node: ts.ClassDeclaration, name: string, moduleName: string): boolean {
		let extendHeritageClause = node.heritageClauses?.find(hc => {
			return hc.token === this.ts.SyntaxKind.ExtendsKeyword
		})

		if (!extendHeritageClause) {
			return false
		}

		let firstType = extendHeritageClause.types[0]
		if (!firstType || !this.ts.isExpressionWithTypeArguments(firstType)) {
			return false
		}

		let exp = firstType.expression

		let moduleAndName = this.resolveImport(exp)
		if (moduleAndName) {
			if (moduleAndName.module === moduleName && moduleAndName.name === name) {
				return true
			}
		}

		let superClass = this.resolveOneDeclaration(exp, this.ts.isClassDeclaration)
		if (superClass) {
			return this.isDerivedClassOf(superClass, name, moduleName)
		}

		return false
	}

	/** Test whether current class or super class implements a type located at a module. */
	isClassImplemented(node: ts.ClassDeclaration, typeName: string, moduleName: string): boolean {
		let implementClauses = node.heritageClauses?.find(h => {
			return h.token === this.ts.SyntaxKind.ImplementsKeyword
		})

		if (implementClauses) {
			let implementModules = implementClauses.types.find(type => {
				let nm = this.resolveImport(type.expression)
				return nm && nm.name === typeName && nm.module === moduleName
			})

			if (implementModules) {
				return true
			}
		}

		let superClass = this.getSuperClass(node)
		if (!superClass) {
			return false
		}

		return this.isClassImplemented(superClass, typeName, moduleName)
	}

	/** Get the first decorator of a class declaration, a property or method declaration. */
	getFirstDecorator(node: ts.ClassDeclaration | ts.MethodDeclaration | ts.PropertyDeclaration): ts.Decorator | undefined {
		return node.modifiers?.find(m => this.ts.isDecorator(m)) as ts.Decorator | undefined
	}

	/** Get the first decorator name of a decorator. */
	getDecoratorName(node: ts.Decorator): string | undefined {
		let exp = node.expression

		let identifier = this.ts.isCallExpression(exp) 
			? exp.expression
			: exp

		if (!this.ts.isIdentifier(identifier)) {
			return undefined
		}

		let moduleAndName = this.resolveImport(exp)
		if (moduleAndName) {
			return moduleAndName.name
		}

		let decl = this.resolveOneDeclaration(identifier, this.ts.isFunctionDeclaration)
		if (!decl) {
			return undefined
		}

		return decl.name?.getText()
	}

	/** Get constructor. */
	getConstructor(node: ts.ClassDeclaration): ts.ConstructorDeclaration | undefined {
		return node.members.find(v => this.ts.isConstructorDeclaration(v)) as ts.ConstructorDeclaration | undefined
	}

	/** Get constructor parameter list. */
	getConstructorParameters(node: ts.ClassDeclaration): ts.ParameterDeclaration[] | undefined {
		let constructor = this.getConstructor(node)
		if (constructor) {
			return [...constructor.parameters]
		}
		
		let superClass = this.getSuperClass(node)
		if (superClass) {
			return this.getConstructorParameters(superClass)
		}

		return undefined
	}

	/** Whether has specified modifier. */
	hasModifier(node: ts.PropertyDeclaration | ts.MethodDeclaration, name: 'readonly' | 'static' | 'protected' | 'private'): boolean {
		for (let modifier of node.modifiers || []) {
			if (modifier.kind === this.ts.SyntaxKind.ReadonlyKeyword && name === 'readonly') {
				return true
			}
			else if (modifier.kind === this.ts.SyntaxKind.StaticKeyword && name === 'static') {
				return true
			}
			else if (modifier.kind === this.ts.SyntaxKind.ProtectedKeyword && name === 'protected') {
				return true
			}
			else if (modifier.kind === this.ts.SyntaxKind.PrivateKeyword && name === 'private') {
				return true
			}
		}

		return false
	}



	//// Tagged Template

	/** Get the name of a tagged template. */
	getTaggedTemplateName(node: ts.TaggedTemplateExpression): string | undefined {
		let moduleAndName = this.resolveImport(node.tag)
		if (moduleAndName) {
			return moduleAndName.name
		}

		let tagNameDecl = this.resolveOneDeclaration(node.tag, this.ts.isFunctionDeclaration)
		return tagNameDecl?.name?.getText()
	}



	//// Type

	/** Get the text of a type. */
	getTypeSymbolText(type: ts.Type): string | undefined {
		let name = type.getSymbol()?.getName()

		if (!name || name.startsWith('__')) {
			name = type.aliasSymbol?.getName() || name
		}

		return name
	}

	/** Get the returned type of a method node. */
	getClassMethodReturnType(node: ts.MethodDeclaration): ts.Type | undefined {
		let signature = this.typeChecker.getSignatureFromDeclaration(node)
		if (!signature) {
			return undefined
		}

		return signature.getReturnType()
	}

	/** Test whether current class or super class implements a type located at a module. */
	isTypeImportedFrom(node: ts.TypeNode, typeName: string, moduleName: string): boolean {
		let nm = this.resolveImport(node)
		return !!(nm && nm.name === typeName && nm.module === moduleName)
	}

	/** Test whether type of a node is primitive. */
	isNodeObjectType(node: ts.Node): boolean {
		let type = this.typeChecker.getTypeAtLocation(node)
		return (type.getFlags() & this.ts.TypeFlags.Object) > 0
	}

	/** Test whether type of a node extends `Array<any>`. */
	isNodeArrayType(node: ts.Node): boolean {
		let type = this.typeChecker.getTypeAtLocation(node)
		let name = this.getTypeSymbolText(type)
		if (name === 'Array' || name === 'ReadonlyArray') {
			return true
		}

		return false
	}

	/** Analysis whether a property access expression is readonly. */
	isPropertyReadonly(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): boolean {

		// `class A{readonly p}` -> `this.p` and `this['p']` are readonly.
		// `interface A{readonly p}` -> `this.p` and `this['p']` are readonly.
		let nameDecl = this.resolveProperty(node)
		if (nameDecl && nameDecl.modifiers?.find(m => m.kind === this.ts.SyntaxKind.ReadonlyKeyword)) {
			return true
		}

		// `b: Readonly<{p: 1}>` -> `b.p` is readonly, not observed.
		// `c: ReadonlyArray<...>` -> `c.?` is readonly, not observed.
		// `d: DeepReadonly<...>` -> `d.?` and `d.?.?` are readonly, not observed.
		let exp = node.expression
		let type = this.typeChecker.getTypeAtLocation(exp)
		let name = this.getTypeSymbolText(type)
		
		if (name === 'Readonly' || name === 'ReadonlyArray') {
			return true
		}

		return false
	}



	//// Symbol & Resolving

	/** Resolve the import name and module. */
	resolveImport(node: ts.Node): {name: string, module: string} | undefined {

		// `import * as M`, and use it's member like `M.member`.
		if (this.ts.isPropertyAccessExpression(node)) {
			let name = node.name.getText()
			let symbol = this.resolveSymbol(node.expression)
			let decl = symbol ? this.resolveOneSymbolDeclaration(symbol, this.ts.isNamespaceImport) : undefined

			if (decl) {
				return {
					name,
					module: removeQuotes(decl.parent.parent.moduleSpecifier.getText()),
				}
			}
		}
		else {
			let symbol = this.resolveSymbol(node)
			let decl = symbol ? this.resolveOneSymbolDeclaration(symbol, this.ts.isImportSpecifier) : undefined

			if (decl) {
				return {
					name: (decl.propertyName || decl.name).getText(),
					module: removeQuotes(decl.parent.parent.parent.moduleSpecifier.getText()),
				}
			}
		}

		return undefined
	}

	/** Get the symbol of a given node. */
	resolveSymbol(node: ts.Node, resolveAlias: boolean = false): ts.Symbol | undefined {
		let symbol = this.typeChecker.getSymbolAtLocation(node)

		// Get symbol from identifier.
		if (!symbol && !this.ts.isIdentifier(node)) {
			let identifier = this.getIdentifier(node)
			symbol = identifier ? this.typeChecker.getSymbolAtLocation(identifier) : undefined
		}

		// Resolve aliased symbols to it's original declared place.
		if (resolveAlias && symbol && (symbol.flags & this.ts.SymbolFlags.Alias) > 0) {
			symbol = this.typeChecker.getAliasedSymbol(symbol)
		}

		return symbol
	}

	/** Returns the identifier, like variable or declaration name of a given node if possible. */
	getIdentifier(node: ts.Node): ts.Identifier | undefined {

		// Variable.
		if (this.ts.isIdentifier(node)) {
			return node
		}

		// Class or interface, property, method, function name.
		if ((this.ts.isClassLike(node)
			|| this.ts.isInterfaceDeclaration(node)
			|| this.ts.isVariableDeclaration(node)
			|| this.ts.isMethodDeclaration(node)
			|| this.ts.isPropertyDeclaration(node)
			|| this.ts.isFunctionDeclaration(node)
			)
			&& node.name
			&& this.ts.isIdentifier(node.name)
		) {
			return node.name
		}

		// Identifier of type expression.
		if (this.ts.isTypeReferenceNode(node)
			&& this.ts.isIdentifier(node.typeName)
		) {
			return node.typeName
		}

		return undefined
	}

	/** Resolves the declarations of a node. */
	resolveDeclarations<T extends ts.Declaration>(node: ts.Node, test?: (node: ts.Node) => node is T): T[] | undefined {
		let symbol = this.resolveSymbol(node, true)
		if (!symbol) {
			return undefined
		}

		let decls = symbol.getDeclarations()
		if (test && decls) {
			decls = decls.filter(decl => test(decl))
		}

		return decls as T[]
	}

	/** Resolves the first declaration of a node, in kind. */
	resolveOneDeclaration<T extends ts.Node>(node: ts.Node, test: (node: ts.Node) => node is T): T | undefined {
		let decls = this.resolveDeclarations(node)
		return decls?.find(test) as T | undefined
	}

	/** Resolves the first declaration of a symbol, in kind. */
	resolveOneSymbolDeclaration<T extends ts.Node>(symbol: ts.Symbol, test: (node: ts.Node) => node is T): T | undefined {
		let decls = symbol.getDeclarations()
		return decls?.find(test) as T | undefined
	}

	/** Resolve a property declaration or signature. */
	resolveProperty(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): ts.PropertySignature | ts.PropertyDeclaration | undefined {
		let name = this.ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression

		let testFn = ((node: ts.Node) => this.ts.isPropertySignature(node) || this.ts.isPropertyDeclaration(node)) as
			((node: ts.Node) => node is ts.PropertySignature | ts.PropertyDeclaration)

		return this.resolveOneDeclaration(name, testFn)
	}

	/** Resolve a method declaration or signature. */
	resolveMethod(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): ts.MethodSignature | ts.MethodDeclaration | undefined {
		let name = this.ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression

		let testFn = ((node: ts.Node) => this.ts.isMethodSignature(node) || this.ts.isMethodDeclaration(node)) as
			((node: ts.Node) => node is ts.MethodSignature | ts.MethodDeclaration)

		return this.resolveOneDeclaration(name, testFn)
	}
}