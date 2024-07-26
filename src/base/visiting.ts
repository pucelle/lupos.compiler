import type TS from 'typescript'
import {ListMap} from '../utils'


interface VisitingItem {

	/** Visiting index across whole source file. */
	index: number
}


/** Indicate node depth and the index in sibling nodes when visiting. */
export namespace visiting {

	let stack: VisitingItem[] = []
	let indexSeed: number = -1

	/** Parent visiting index -> child visiting indices. */
	const ChildMap: ListMap<number, number> = new ListMap()

	/** Child visiting index -> parent visiting index. */
	const ParentMap: Map<number, number> = new Map()

	/** Node visiting index -> Node. */
	const NodeMap: Map<number, TS.Node> = new Map()

	/** Node -> Node visiting index. */
	const IndexMap: Map<TS.Node, number> = new Map()

	export let current: VisitingItem = {
		index: -1,
	}
	
	
	/** Initialize before start a new source file. */
	export function initialize() {
		stack = []
		indexSeed = -1
		ChildMap.clear()
		ParentMap.clear()
		NodeMap.clear()
		IndexMap.clear()

		current = {
			index: -1,
		}
	}

	/** To next sibling. */
	export function toNext(node: TS.Node) {
		current.index = ++indexSeed

		if (stack.length > 0) {
			let parent = stack[stack.length - 1]
			ChildMap.add(parent.index, current.index)
			ParentMap.set(current.index, parent.index)
		}

		NodeMap.set(current.index, node)
		IndexMap.set(node, current.index)
	}

	/** To first child. */
	export function toChild() {
		stack.push(current)

		current = {
			index: -1,
		}
	}

	/** To parent. */
	export function toParent() {
		current = stack.pop()!
	}

	/** Get child visiting index, by parent index and child sibling index. */
	export function getChildIndex(parentIndex: number, siblingIndex: number): number | undefined {
		return ChildMap.get(parentIndex)![siblingIndex]
	}

	/** Get first child visiting index, by parent index. */
	export function getFirstChildIndex(parentIndex: number): number | undefined {
		let list = ChildMap.get(parentIndex)
		return list ? list[0] : undefined
	}

	/** Get last child visiting index, by parent index. */
	export function getLastChildIndex(parentIndex: number): number | undefined {
		let list = ChildMap.get(parentIndex)
		return list ? list[list.length - 1] : undefined
	}

	/** Get count of child items. */
	export function getChildCount(parentIndex: number): number {
		return ChildMap.get(parentIndex)?.length || 0
	}

	/** Get all child visiting indices. */
	export function getChildIndices(parentIndex: number): number[] | undefined {
		return ChildMap.get(parentIndex)!
	}

	/** Get parent visiting index by child visiting index. */
	export function getParentIndex(childIndex: number): number | undefined {
		return ParentMap.get(childIndex)!
	}

	/** Get node by visiting index. */
	export function getNode(index: number): TS.Node {
		return NodeMap.get(index)!
	}

	/** Get visiting index by node. */
	export function getIndex(node: TS.Node): number {
		return IndexMap.get(node)!
	}

	/** Look outward for a visiting index, and the node at where match test fn. */
	export function findOutward(fromIndex: number, untilIndex: number | null, test: (node: TS.Node) => boolean) : number | null {
		let index: number | undefined = fromIndex

		// Look outward for a node which can pass test.
		while (index !== undefined && index !== untilIndex) {
			let node = getNode(index)
			if (test(node)) {
				return index
			}

			index = getParentIndex(index)
		}

		return null
	}

	/** Look outward for a visiting index, which is the sibling of `siblingIndex`. */
	export function findOutwardSiblingWith(fromIndex: number, siblingIndex: number) : number | null {
		let parentIndex = getParentIndex(siblingIndex)
		let index: number | undefined = fromIndex

		// Look outward for a variable declaration.
		while (index !== undefined) {
			let pi = getParentIndex(index)

			if (pi === parentIndex) {
				return index
			}

			index = pi
		}

		return null
	}
}