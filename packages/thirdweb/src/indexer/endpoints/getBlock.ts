import type { BlockTag, GetBlockReturnType } from "viem";
import type { Chain } from "../../chains/types.js";
import type { ThirdwebClient } from "../../client/client.js";
import { getClientFetch } from "../../utils/fetch.js";
import { formatIndexerBlock } from "../formatter.js";
import type { IndexerInternalBlock, IndexerResponse } from "../types.js";
import { getBlockEndpoint } from "../urls.js";

export type GetBlockParams = {
  /**
   * A client is the entry point to the thirdweb SDK. It is required for all other actions.
   *
   * You can create a client using the `createThirdwebClient` function.
   * Refer to the [Creating a Client](https://portal.thirdweb.com/typescript/v5/client) documentation for more information.
   *
   */
  client: ThirdwebClient;
  /**
   * Number of the block to fetch
   */
  blockNumber: bigint;
  /**
   * Chain the block can be found on
   */
  chain: Chain;
};

export type GetBlockResult<TBlockTag extends BlockTag = "latest"> =
  GetBlockReturnType<undefined, false, TBlockTag>;

/**
 * @beta
 *
 * Get data for a single block
 *
 * @param {GetBlockParams} params
 * @returns {Promise<GetBlockResult>}
 *
 * @example
 * ```ts
 * import { createThirdwebClient, getBlock, defineChain } from "thirdweb";
 *
 * const client = createThirdwebClient({ clientId: "..." });
 * const { block } = await getBlock({
 *  client,
 *  blockNumber: 9662167n,
 *  chain: defineChain(1)
 * });
 * ```
 */
export async function getBlock(
  params: GetBlockParams,
): Promise<GetBlockResult> {
  try {
    const url = getBlockEndpoint(params.blockNumber);
    url.searchParams.append("chainId", params.chain.id.toString());

    const response = await getClientFetch(params.client)(url.toString());
    if (!response.ok) {
      response.body?.cancel();
      throw new Error(
        `Failed to get block ${params.blockNumber} on chain ${params.chain.id}: ${response.status}`,
      );
    }

    const data: IndexerResponse<IndexerInternalBlock> = await response.json();
    if (data.error || !data.data) {
      throw new Error(data.error || "Failed to get block");
    }
    const block = formatIndexerBlock(data.data);
    if (!block) {
      throw new Error(`Failed to fetch block ${params.blockNumber}`);
    }
    return block;
  } catch (error) {
    throw new Error("Failed to fetch block", { cause: error });
  }
}
