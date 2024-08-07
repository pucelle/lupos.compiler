import {removeFromList} from '../../../utils'
import {HTMLAttribute, HTMLToken} from './html-token-parser'
import {HTMLTree} from './html-tree'


export enum HTMLNodeType {
	Tag,
	Text,
	Comment,
}

export class HTMLNode {

	readonly type: HTMLNodeType
	readonly tagName?: string
	text?: string
	attrs?: HTMLAttribute[]

	children: HTMLNode[] = []
	parent: HTMLNode | null = null

	constructor(type: HTMLNodeType, token: Omit<HTMLToken, 'type'>) {
		this.type = type
		this.text = token.text
		this.attrs = token.attrs
	}

	private setParent(parent: HTMLNode) {
		this.parent = parent
	}

	private replaceChild(oldChild: HTMLNode, newChild: HTMLNode) {
		let index = this.children.indexOf(oldChild)!
		this.children[index] = newChild
	}

	get siblingIndex(): number {
		return this.parent!.children.indexOf(this)!
	}

	addChild(child: HTMLNode) {
		this.children.push(child)
		child.setParent(this)
	}

	childAt(index: number): HTMLNode | null {
		return index >= 0 && index < this.children.length ? this.children[index] : null
	}

	before(sibling: HTMLNode) {
		this.parent!.children.splice(this.siblingIndex, 0, sibling)
	}

	after(sibling: HTMLNode) {
		this.parent!.children.splice(this.siblingIndex + 1, 0, sibling)
	}

	get previousSibling() {
		return this.parent!.childAt(this.siblingIndex - 1)
	}

	get nextSibling() {
		return this.parent!.childAt(this.siblingIndex + 1)
	}

	get firstChild(): HTMLNode | null {
		return this.childAt(0)
	}

	get lastChild(): HTMLNode | null {
		return this.childAt(this.children.length - 1)
	}

	*walk(): Iterable<HTMLNode> {
		yield this

		for (let child of [...this.children]) {

			// May be removed when walking.
			if (child.parent !== this) {
				continue
			}

			yield *child.walk()
		}
	}

	remove() {
		removeFromList(this.parent!.children, this)
		this.parent = null
	}

	/** Remove self, but keep children to replace it's position. */
	removeSelf() {
		let index = this.siblingIndex
		this.parent!.children.splice(index, 1, ...this.children)
		this.parent = null
	}

	removeAttr(attr: HTMLAttribute) {
		removeFromList(this.attrs!, attr)
	}

	wrapWith(tagName: string, attrs?: HTMLAttribute[]) {
		let newNode = new HTMLNode(HTMLNodeType.Tag, {tagName, attrs})
		newNode.addChild(this)
		this.parent!.replaceChild(this, newNode)
	}

	replaceWith(...nodes: HTMLNode[]) {
		let index = this.siblingIndex
		this.parent!.children.splice(index, 1, ...nodes)
		this.parent = null
	}

	separate(): HTMLTree {
		this.remove()
		let tree = new HTMLTree()
		tree.addChild(this)

		return tree
	}

	separateChildren(): HTMLTree {
		let tree = new HTMLTree()

		for (let child of this.children) {
			child.remove()
			tree.addChild(child)
		}

		return tree
	}

	closest(tag: string): HTMLNode | null {
		let node: HTMLNode | null = this

		while (node && node.tagName !== tag) {
			node = node.parent
		}

		return node
	}
}
