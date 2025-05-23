import * as ts from 'typescript'
import {factory, helper} from './global'
import {InterpolationContentType, Interpolator} from './interpolator'


export type MethodInsertPosition = 'before-super' | 'after-super' | 'end'

export interface MethodInsertInserted {
	statementsGetter: () => ts.Statement[]
	position: MethodInsertPosition
}


/** It helps to overwrite a method. */
export class MethodOverwrite {

	readonly classNode: ts.ClassDeclaration
	readonly name: string
	readonly rawNode: ts.ConstructorDeclaration | ts.MethodDeclaration | null

	private newNode: ts.ConstructorDeclaration | ts.MethodDeclaration | null = null
	private superIndex: number = 0
	private endIndex: number = 0
	private inserted: MethodInsertInserted[] = []

	constructor(classNode: ts.ClassDeclaration, name: string) {
		this.classNode = classNode
		this.name = name

		if (name === 'constructor') {
			this.rawNode = helper.class.getConstructor(classNode, true) ?? null
		}
		else {
			this.rawNode = helper.class.getMethod(classNode, name, true) ?? null
		}

		if (this.rawNode) {
			this.superIndex = this.rawNode!.body!.statements.findIndex(s => {
				helper.getFullText(s).startsWith('super')
			})

			this.endIndex = this.findEndIndexBeforeAwait()
		}
		else {
			if (name === 'constructor') {
				this.newNode = this.createConstructor()
			}
			else {
				this.newNode = this.createMethod()
			}
		}
	}

	/** Find await index or end index. */
	private findEndIndexBeforeAwait(): number {
		let statements = this.rawNode!.body!.statements

		for (let i = 0; i < statements.length; i++) {
			let statement = statements[i]

			if (helper.findInstantlyRunInward(statement, (node) => ts.isAwaitExpression(node))) {
				return i
			}
		}

		return statements.length
	}

	/** Create a constructor function. */
	private createConstructor(): ts.ConstructorDeclaration {
		let parameters = helper.class.getConstructorParameters(this.classNode, true) ?? []
		let statements: ts.Statement[] = []
		let superClass = helper.class.getSuper(this.classNode)

		if (superClass) {
			let callSuper = factory.createExpressionStatement(factory.createCallExpression(
				factory.createSuper(),
				undefined,
				parameters.map(p => p.name as ts.Identifier)
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

	/** Create a method, which will call super method without parameters. */
	private createMethod(): ts.MethodDeclaration {
		return factory.createMethodDeclaration(
			undefined,
			undefined,
			factory.createIdentifier(this.name),
			undefined,
			undefined,
			[],
			undefined,
			factory.createBlock(
				[
					factory.createExpressionStatement(factory.createCallExpression(
						factory.createPropertyAccessExpression(
							factory.createSuper(),
							factory.createIdentifier(this.name)
						),
						undefined,
						[]
					)),
				],
				true
			)
		)
	}

	/** Add a list of statements to a method content end. */
	insert(statementsGetter: () => ts.Statement[], position: MethodInsertPosition) {
		this.inserted.push({statementsGetter, position})
	}

	output() {
		if (this.inserted.length === 0) {
			return
		}

		if (this.rawNode) {
			this.outputToRaw()
		}
		else {
			this.outputToNew()
		}
	}

	private outputToRaw() {
		for (let item of this.inserted) {
			this.outputItemToRaw(item.statementsGetter, item.position)
		}
	}

	private outputItemToRaw(statementsGetter: () => ts.Statement[], position: MethodInsertPosition) {
		let body = this.rawNode!.body!

		if (position === 'end') {
			let beforeStat = this.endIndex >= body.statements.length ? null : body.statements[this.endIndex]
			if (beforeStat) {
				Interpolator.before(beforeStat, InterpolationContentType.Normal, statementsGetter)
			}
			else {
				Interpolator.append(body, InterpolationContentType.Normal, statementsGetter)
			}
		}
		else {
			let superCall = this.superIndex > -1 ? body.statements[this.superIndex] : null
			if (superCall) {
				if (position === 'before-super') {
					Interpolator.before(superCall, InterpolationContentType.Normal, statementsGetter)
				}
				else if (position === 'after-super') {
					Interpolator.after(superCall, InterpolationContentType.Normal, statementsGetter)
				}
			}
			else {
				Interpolator.prepend(body, InterpolationContentType.Normal, statementsGetter)
			}
		}
	}

	private outputToNew() {
		let firstNonStaticMethod = this.classNode.members.find(member => {
			if (!ts.isMethodDeclaration(member)) {
				return null
			}

			let hasStatic = member.modifiers?.find((n: ts.ModifierLike) => n.kind === ts.SyntaxKind.StaticKeyword)
			if (hasStatic) {
				return null
			}

			return member
		})

		if (firstNonStaticMethod) {
			Interpolator.before(firstNonStaticMethod, InterpolationContentType.Normal, () => this.outputToNewNode())
		}
		else {
			Interpolator.append(this.classNode, InterpolationContentType.Normal, () => this.outputToNewNode())
		}
	}

	private outputToNewNode(): ts.Node {
		for (let item of this.inserted) {
			let statements = item.statementsGetter()
			let position = item.position

			this.addStatementsToNew(statements, position)
		}

		return this.newNode!
	}

	private addStatementsToNew(statements: ts.Statement[], position: MethodInsertPosition) {
		if (statements.length === 0) {
			return
		}

		let newNode = this.newNode!
		let newStatements = [...newNode.body!.statements]

		if (position === 'end') {
			newStatements.push(...statements)
		}
		else if (position === 'before-super') {
			newStatements.splice(this.superIndex, 0, ...statements)
			this.superIndex += statements.length
		}
		else if (position === 'after-super') {
			newStatements.splice(this.superIndex + 1, 0, ...statements)
		}

		if (ts.isConstructorDeclaration(newNode)) {
			this.newNode = factory.updateConstructorDeclaration(
				newNode,
				newNode.modifiers,
				newNode.parameters,
				factory.createBlock(newStatements, true)
			)
		}
		else {
			this.newNode = factory.updateMethodDeclaration(
				newNode,
				newNode.modifiers,
				newNode.asteriskToken,
				newNode.name,
				newNode.questionToken,
				newNode.typeParameters,
				newNode.parameters,
				newNode.type,
				factory.createBlock(newStatements, true)
			)
		}
	}

}

