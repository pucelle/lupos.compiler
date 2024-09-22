import type TS from 'typescript'
import {ts, defineVisitor, Modifier, Helper, factory, Interpolator, Visiting} from '../base'


// Add some decorator compiled part to `constructor` or `onConnected` and `onWillDisconnect`.
defineVisitor(function(node: TS.Node, index: number) {
	if (!ts.isClassDeclaration(node)) {
		return
	}

	let hasNeedToCompileMembers = hasLifeDecorators(node)
	if (!hasNeedToCompileMembers) {
		return
	}

	let connect: TS.MethodDeclaration | TS.ConstructorDeclaration | undefined = undefined
	let disconnect: TS.MethodDeclaration | undefined = undefined
	let hasDeletedContextVariables = false
	let repetitiveConnect = false

	// Be a component.
	if (Helper.cls.isDerivedOf(node, 'Component', '@pucelle/lupos.js')) {
		connect = Helper.cls.getMethod(node, 'onConnected')
		if (!connect) {
			connect = createCallSuperMethod('onConnected')
		}

		disconnect = Helper.cls.getMethod(node, 'onWillDisconnect')
		if (!disconnect) {
			disconnect = createCallSuperMethod('onWillDisconnect')
		}

		repetitiveConnect = true
	}
	else {
		connect = Helper.cls.getConstructor(node)
		if (!connect) {
			connect = createConstructor(node)
		}
	}

	let rawConnect = connect
	let rawDisconnect = disconnect

	for (let member of node.members) {
		if (!ts.isMethodDeclaration(member)
			&& !ts.isPropertyDeclaration(member)
			&& !ts.isGetAccessorDeclaration(member)
		) {
			continue
		}

		let deco = Helper.deco.getFirst(member)
		if (!deco) {
			continue
		}

		let decoName = Helper.deco.getName(deco)
		if (!decoName) {
			continue
		}

		if (['computed', 'effect', 'watch', 'immediateWatch'].includes(decoName)
			&& (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member))
		) {
			[connect, disconnect] = compileComputedEffectWatchDecorator(decoName, member, connect, disconnect, repetitiveConnect)
		}
		else if (decoName === 'setContext' && ts.isPropertyDeclaration(member)) {
			[connect, disconnect] = compileSetContextDecorator(member, connect, disconnect, hasDeletedContextVariables)
			Interpolator.remove(Visiting.getIndex(deco))
			hasDeletedContextVariables = true
		}
		else if (decoName === 'useContext' && ts.isPropertyDeclaration(member)) {
			[connect, disconnect] = compileUseContextDecorator(member, connect, disconnect, hasDeletedContextVariables)
			hasDeletedContextVariables = true
		}
	}

	if (connect === rawConnect) {
		connect = undefined
	}

	if (disconnect === rawDisconnect) {
		disconnect = undefined
	}

	for (let member of [connect, disconnect]) {
		if (!member) {
			continue
		}

		Modifier.addClassMember(index, member, true)
	}
})


function hasLifeDecorators(node: TS.ClassDeclaration) {
	return node.members.some(member => {
		if (!ts.isMethodDeclaration(member)
			&& !ts.isPropertyDeclaration(member)
			&& !ts.isGetAccessorDeclaration(member)
		) {
			return false
		}

		let decoName = Helper.deco.getFirstName(member)
		if (decoName && ['computed', 'effect', 'watch', 'immediateWatch', 'useContext', 'setContext'].includes(decoName)) {
			return true
		}

		return false
	})
}


/*
```ts
Compile `@effect effectFn(){...}` to:

onConnected() {
	this.#enqueue_effectFn()
}

onWillDisconnect() {
	untrack(this.#enqueue_effectFn, this)
}
```

or

```ts
Compile `@watch('prop' / function(){...}) onWatchChange(){...}` to:

onConnected() {
	this.#enqueue_onWatchChange()
}

onWillDisconnect() {
	untrack(this.#enqueue_onWatchChange, this)
}

```
*/
function compileComputedEffectWatchDecorator(
	decoName: string,
	decl: TS.MethodDeclaration | TS.GetAccessorDeclaration,
	connect: TS.MethodDeclaration | TS.ConstructorDeclaration,
	disconnect: TS.MethodDeclaration | undefined,
	repetitiveConnect: boolean
): [TS.MethodDeclaration | TS.ConstructorDeclaration, TS.MethodDeclaration | undefined] {
	let methodName = Helper.getFullText(decl.name)
	let connectCallName = decoName === 'computed' ? '#reset_' + methodName
		: decoName === 'effect'
		? methodName
		: '#compare_' + methodName
		
	let disconnectCallName = decoName === 'computed' ? '#reset_' + methodName : '#enqueue_' + methodName

	// No need to reset in constructor function
	let ignoreConnect = !repetitiveConnect && decoName === 'computed'

	if (connect && !ignoreConnect) {
		let connectStatement = factory.createExpressionStatement(factory.createCallExpression(
			factory.createPropertyAccessExpression(
				factory.createThis(),
				connectCallName.startsWith('#')
					? factory.createPrivateIdentifier(connectCallName)
					: factory.createIdentifier(connectCallName)
			),
			undefined,
			[]
		))

		let insertAfterSuper = decoName === 'computed'
		connect = addToMethodDeclaration(connect, [connectStatement], insertAfterSuper ? 'after-super' : 'end')
	}
	
	if (disconnect) {
		let disconnectStatement = factory.createExpressionStatement(factory.createCallExpression(
			factory.createIdentifier('untrack'),
			undefined,
			[
				factory.createPropertyAccessExpression(
					factory.createThis(),
					factory.createPrivateIdentifier(disconnectCallName)
				),
				factory.createThis()
			]
		))
		
		disconnect = addToMethodDeclaration(disconnect, [disconnectStatement], 'end')
		Modifier.addImport('untrack', '@pucelle/ff')
	}

	return [connect, disconnect]
}


/** Create a method, which will call super method without parameters. */
function createCallSuperMethod(name: string): TS.MethodDeclaration {
	return factory.createMethodDeclaration(
		undefined,
		undefined,
		factory.createIdentifier(name),
		undefined,
		undefined,
		[],
		undefined,
		factory.createBlock(
			[
				factory.createExpressionStatement(factory.createCallExpression(
					factory.createPropertyAccessExpression(
						factory.createSuper(),
						factory.createIdentifier(name)
					),
					undefined,
					[]
				)),
			],
			true
		)
	)
}


/** Create a constructor function. */
function createConstructor(node: TS.ClassDeclaration): TS.ConstructorDeclaration {
	let parameters = Helper.cls.getConstructorParameters(node) ?? []
	let statements: TS.Statement[] = []
	let superCls = Helper.cls.getSuper(node)

	if (superCls) {
		let callSuper = factory.createExpressionStatement(factory.createCallExpression(
			factory.createSuper(),
			undefined,
			parameters.map(p => p.name as TS.Identifier)
		))

		statements = [callSuper]
	}

	return factory.createConstructorDeclaration(
		undefined,
		parameters,
		factory.createBlock(
			statements,
			true
		)
	) 
}


/** Add a list of statements to a method content end. */
function addToMethodDeclaration<T extends TS.MethodDeclaration | TS.ConstructorDeclaration>(
	method: T,
	statements: TS.Statement[],
	position: 'end' | 'after-super'
): T {
	let newStatements = [...method.body!.statements] || []

	if (position === 'end') {
		newStatements.push(...statements)
	}
	else if (position === 'after-super') {
		if (newStatements.length > 0
			&& Helper.getFullText(newStatements[0]).startsWith('super')
		) {
			newStatements.splice(1, 0, ...statements)
		}
	}

	if (ts.isMethodDeclaration(method)) {
		return factory.updateMethodDeclaration(
			method,
			method.modifiers,
			method.asteriskToken,
			method.name,
			method.questionToken,
			method.typeParameters,
			method.parameters,
			method.type,
			factory.createBlock(newStatements, true)
		) as T
	}
	else {
		return factory.updateConstructorDeclaration(
			method,
			method.modifiers,
			method.parameters,
			factory.createBlock(newStatements, true)
		) as T
	}
}



/*
```ts
Compile `@setContext prop` to:

onConnected() {
	super.onConnected()
	Component.setContextVariable(this, 'prop')
}

onWillDisconnect() {
	super.onWillDisconnect()
	Component.deleteContextVariables(this)
}
```
*/
function compileSetContextDecorator(
	propDecl: TS.PropertyDeclaration,
	connect: TS.MethodDeclaration | TS.ConstructorDeclaration,
	disconnect: TS.MethodDeclaration | undefined,
	hasDeletedContextVariables: boolean
): [TS.MethodDeclaration | TS.ConstructorDeclaration, TS.MethodDeclaration | undefined] {
	let propName = Helper.getFullText(propDecl.name)
	let extended = Helper.cls.getExtends(propDecl.parent as TS.ClassDeclaration)!
	let classExp = extended.expression
		
	if (connect) {
		let connectStatement = factory.createExpressionStatement(factory.createCallExpression(
			factory.createPropertyAccessExpression(
				classExp,
				factory.createIdentifier('setContextVariable')
			),
			undefined,
			[
				factory.createThis(),
				factory.createStringLiteral(propName)
			]
		))

		connect = addToMethodDeclaration(connect, [connectStatement], 'end')
	}
	
	if (disconnect && !hasDeletedContextVariables) {
		let disconnectStatement = factory.createExpressionStatement(factory.createCallExpression(
			factory.createPropertyAccessExpression(
				classExp,
				factory.createIdentifier('deleteContextVariables')
			),
			undefined,
			[
				factory.createThis()
			]
		))
		
		disconnect = addToMethodDeclaration(disconnect, [disconnectStatement], 'end')
	}

	return [connect, disconnect]
}



/*
```ts
Compile `@useContext prop` to:

onConnected() {
	super.onConnected()
	this.#prop_declared = Component.getContextVariableDeclared(this, 'prop')
}

onWillDisconnect() {
	super.onWillDisconnect()
	this.#prop_declared_by = undefined
	Component.deleteContextVariables(this)
}
```
*/
function compileUseContextDecorator(
	propDecl: TS.PropertyDeclaration,
	connect: TS.MethodDeclaration | TS.ConstructorDeclaration,
	disconnect: TS.MethodDeclaration | undefined,
	hasDeletedContextVariables: boolean
): [TS.MethodDeclaration | TS.ConstructorDeclaration, TS.MethodDeclaration | undefined] {
	let propName = Helper.getFullText(propDecl.name)
	let extended = Helper.cls.getExtends(propDecl.parent as TS.ClassDeclaration)!
	let classExp = extended.expression
	
	if (connect) {
		let connectStatement = factory.createExpressionStatement(factory.createBinaryExpression(
			factory.createPropertyAccessExpression(
				factory.createThis(),
				factory.createPrivateIdentifier('#' + propName + '_declared_by')
			),
			factory.createToken(ts.SyntaxKind.EqualsToken),
			factory.createCallExpression(
				factory.createPropertyAccessExpression(
					classExp,
					factory.createIdentifier('getContextVariableDeclared')
				),
				undefined,
				[
				  factory.createThis(),
				  factory.createStringLiteral(propName)
				]
			)
		))

		connect = addToMethodDeclaration(connect, [connectStatement], 'end')
	}
	
	if (disconnect && !hasDeletedContextVariables) {
		let disconnectStatements = [
			factory.createExpressionStatement(
				factory.createBinaryExpression(
					factory.createPropertyAccessExpression(
						factory.createThis(),
						factory.createPrivateIdentifier('#' + propName + '_declared_by')
				),
				factory.createToken(ts.SyntaxKind.EqualsToken),
				factory.createIdentifier("undefined")
			))
		]
		  
		if (!hasDeletedContextVariables) {
			disconnectStatements.push(
				factory.createExpressionStatement(factory.createCallExpression(
					factory.createPropertyAccessExpression(
						classExp,
						factory.createIdentifier('deleteContextVariables')
					),
					undefined,
					[
						factory.createThis()
					]
				))
			)
		}
		
		disconnect = addToMethodDeclaration(disconnect, disconnectStatements, 'end')
	}

	return [connect, disconnect]
}