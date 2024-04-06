import { readContract } from "../../../../../transaction/read-contract.js";
import type { BaseTransactionOptions } from "../../../../../transaction/types.js";

import { decodeAbiParameters } from "viem";
import type { Hex } from "../../../../../utils/encoding/hex.js";

export const FN_SELECTOR = "0xcb2ef6f7" as const;
const FN_INPUTS = [] as const;
const FN_OUTPUTS = [
  {
    type: "bytes32",
  },
] as const;

/**
 * Decodes the result of the contractType function call.
 * @param result - The hexadecimal result to decode.
 * @returns The decoded result as per the FN_OUTPUTS definition.
 * @extension MARKETPLACE
 * @example
 * ```ts
 * import { decodeContractTypeResult } from "thirdweb/extensions/marketplace";
 * const result = decodeContractTypeResult("...");
 * ```
 */
export function decodeContractTypeResult(result: Hex) {
  return decodeAbiParameters(FN_OUTPUTS, result)[0];
}

/**
 * Calls the "contractType" function on the contract.
 * @param options - The options for the contractType function.
 * @returns The parsed result of the function call.
 * @extension MARKETPLACE
 * @example
 * ```ts
 * import { contractType } from "thirdweb/extensions/marketplace";
 *
 * const result = await contractType();
 *
 * ```
 */
export async function contractType(options: BaseTransactionOptions) {
  return readContract({
    contract: options.contract,
    method: [FN_SELECTOR, FN_INPUTS, FN_OUTPUTS] as const,
    params: [],
  });
}
