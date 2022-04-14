/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from './Common';
import { IdCompressor, isFinalId } from './id-compressor';
import { FinalNodeId, NodeId, OpSpaceNodeId, SessionId, StableNodeId } from './Identifiers';
import { NodeData } from './persisted-types';

/**
 * An object which can generate node IDs and convert node IDs between compressed and stable variants
 * @public
 */
export interface NodeIdContext extends NodeIdGenerator, NodeIdConverter {}

/**
 * An object which can generate node IDs
 * @public
 */
export interface NodeIdGenerator {
	/**
	 * Generate an identifier that may be used for a new node that will be inserted into this tree
	 * @param override - an optional string ID to associate with the new id for future lookup. The same override always returns the same ID.
	 */
	generateNodeId(override?: string): NodeId;
}

/**
 * An object which can convert node IDs between compressed and stable variants
 * @public
 */
export interface NodeIdConverter {
	/**
	 * Given a NodeId, return the corresponding UUID. The result is safe to persist and re-use across `SharedTree` instances, unlike NodeId
	 */
	convertToStableNodeId(id: NodeId): StableNodeId;

	/**
	 * Given a NodeId, attempt to return the corresponding UUID.
	 * The returned UUID is undefined if no such ID was ever created. If a UUID is returned, it is not guaranteed to be in the current
	 * revision (but it is guaranteed to exist in at least one prior revision).
	 */
	tryConvertToStableNodeId(id: NodeId): StableNodeId | undefined;

	/**
	 * Given an UUID, return the corresponding NodeId.
	 * The returned NodeId is not guaranteed to be in the current revision (but it is guaranteed to exist in at least one prior revision).
	 */
	convertToNodeId(id: StableNodeId): NodeId;

	/**
	 * Given an UUID, attempt to return the corresponding NodeId.
	 * The returned NodeId is undefined if no such ID was ever created. If a NodeId is returned, it is not guaranteed to be in the current
	 * revision (but it is guaranteed to exist in at least one prior revision).
	 */
	tryConvertToNodeId(id: StableNodeId): NodeId | undefined;
}

/**
 * An object which can normalize node IDs. See docs on {@link IdCompressor} for semantics of normalization.
 */
export interface NodeIdNormalizer<TId extends OpSpaceNodeId> {
	localSessionId: SessionId;
	/**
	 * Normalizes the given ID to op space
	 */
	normalizeToOpSpace(id: NodeId): TId;
	/**
	 * Normalizes the given ID to session space
	 */
	normalizeToSessionSpace(id: TId, sessionId: SessionId): NodeId;
}

/**
 * An object which can normalize node IDs. It is contextualized to a known session context, and therefore
 * can normalize IDs into session space without requiring any additional information.
 */
export interface ContextualizedNodeIdNormalizer<TId extends OpSpaceNodeId>
	extends Omit<NodeIdNormalizer<TId>, 'localSessionId' | 'normalizeToSessionSpace'> {
	/**
	 * Normalizes the given ID to session space
	 */
	normalizeToSessionSpace(id: TId): NodeId;
}

/**
 * Create a {@link ContextualizedNodeIdNormalizer} that uses either the given session ID to normalize IDs
 * to session space. If no ID is given, it will use the local session ID belonging to the normalizer.
 */
export function scopeIdNormalizer<TId extends OpSpaceNodeId>(
	idNormalizer: NodeIdNormalizer<TId>,
	sessionId?: SessionId
): ContextualizedNodeIdNormalizer<TId> {
	return {
		normalizeToOpSpace: (id) => idNormalizer.normalizeToOpSpace(id),
		normalizeToSessionSpace: (id) =>
			idNormalizer.normalizeToSessionSpace(id, sessionId ?? idNormalizer.localSessionId),
	};
}

/**
 * Create a {@link ContextualizedNodeIdNormalizer} that uses the local session ID belonging to the normalizer
 * to normalize IDs to session space. These IDs are expected to be sequenced, and will fail to normalize if
 * they are not.
 */
export function sequencedIdNormalizer<TId extends OpSpaceNodeId>(
	idNormalizer: NodeIdNormalizer<TId>
): ContextualizedNodeIdNormalizer<FinalNodeId & TId> {
	return {
		normalizeToOpSpace: (id) => {
			const normalized = idNormalizer.normalizeToOpSpace(id);
			assert(isFinalId(normalized));
			return normalized;
		},
		normalizeToSessionSpace: (id) => {
			const normalized = idNormalizer.normalizeToSessionSpace(id, idNormalizer.localSessionId);
			assert(isFinalId(normalized));
			return normalized;
		},
	};
}

export function getNodeIdContext(compressor: IdCompressor): NodeIdContext & NodeIdNormalizer<OpSpaceNodeId> {
	return {
		generateNodeId: (override?: string) => compressor.generateCompressedId(override) as NodeId,
		convertToNodeId: (id: StableNodeId) => compressor.recompress(id) as NodeId,
		tryConvertToNodeId: (id: StableNodeId) => compressor.tryRecompress(id) as NodeId | undefined,
		convertToStableNodeId: (id: NodeId) => compressor.decompress(id) as StableNodeId,
		tryConvertToStableNodeId: (id: NodeId) => compressor.tryDecompress(id) as StableNodeId,
		normalizeToOpSpace: (id: NodeId) => compressor.normalizeToOpSpace(id) as OpSpaceNodeId,
		normalizeToSessionSpace: (id: OpSpaceNodeId, sessionId: SessionId) =>
			compressor.normalizeToSessionSpace(id, sessionId) as NodeId,
		localSessionId: compressor.localSessionId,
	};
}

/** Accepts either a node or a node's identifier, and returns the identifier */
export function getNodeId<TId extends number | string>(node: TId | NodeData<TId>): TId {
	return (node as NodeData<TId>).identifier ?? (node as TId);
}
