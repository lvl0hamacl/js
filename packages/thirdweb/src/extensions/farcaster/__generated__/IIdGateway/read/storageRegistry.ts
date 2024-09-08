import { readContract } from "../../../../../transaction/read-contract.js";
import type { BaseTransactionOptions } from "../../../../../transaction/types.js";

import { decodeAbiParameters } from "viem";
import type { Hex } from "../../../../../utils/encoding/hex.js";
import { detectMethod } from "../../../../../utils/bytecode/detectExtension.js";

export const FN_SELECTOR = "0x4ec77b45" as const;
const FN_INPUTS = [] as const;
const FN_OUTPUTS = [
  {
    type: "address",
  },
] as const;

/**
 * Checks if the `storageRegistry` method is supported by the given contract.
 * @param availableSelectors An array of 4byte function selectors of the contract. You can get this in various ways, such as using "whatsabi" or if you have the ABI of the contract available you can use it to generate the selectors.
 * @returns A boolean indicating if the `storageRegistry` method is supported.
 * @extension FARCASTER
 * @example
 * ```ts
 * import { isStorageRegistrySupported } from "thirdweb/extensions/farcaster";
 * const supported = isStorageRegistrySupported(["0x..."]);
 * ```
 */
export function isStorageRegistrySupported(availableSelectors: string[]) {
  return detectMethod({
    availableSelectors,
    method: [FN_SELECTOR, FN_INPUTS, FN_OUTPUTS] as const,
  });
}

/**
 * Decodes the result of the storageRegistry function call.
 * @param result - The hexadecimal result to decode.
 * @returns The decoded result as per the FN_OUTPUTS definition.
 * @extension FARCASTER
 * @example
 * ```ts
 * import { decodeStorageRegistryResult } from "thirdweb/extensions/farcaster";
 * const result = decodeStorageRegistryResultResult("...");
 * ```
 */
export function decodeStorageRegistryResult(result: Hex) {
  return decodeAbiParameters(FN_OUTPUTS, result)[0];
}

/**
 * Calls the "storageRegistry" function on the contract.
 * @param options - The options for the storageRegistry function.
 * @returns The parsed result of the function call.
 * @extension FARCASTER
 * @example
 * ```ts
 * import { storageRegistry } from "thirdweb/extensions/farcaster";
 *
 * const result = await storageRegistry({
 *  contract,
 * });
 *
 * ```
 */
export async function storageRegistry(options: BaseTransactionOptions) {
  return readContract({
    contract: options.contract,
    method: [FN_SELECTOR, FN_INPUTS, FN_OUTPUTS] as const,
    params: [],
  });
}
