import type { AbiParameterToPrimitiveType } from "abitype";
import { readContract } from "../../../../../transaction/read-contract.js";
import type { BaseTransactionOptions } from "../../../../../transaction/types.js";
import { encodeAbiParameters } from "../../../../../utils/abi/encodeAbiParameters.js";
import { decodeAbiParameters } from "viem";
import type { Hex } from "../../../../../utils/encoding/hex.js";
import { detectMethod } from "../../../../../utils/bytecode/detectExtension.js";

/**
 * Represents the parameters for the "getClaimConditionById" function.
 */
export type GetClaimConditionByIdParams = {
  tokenId: AbiParameterToPrimitiveType<{ type: "uint256"; name: "_tokenId" }>;
  conditionId: AbiParameterToPrimitiveType<{
    type: "uint256";
    name: "_conditionId";
  }>;
};

export const FN_SELECTOR = "0xd45b28d7" as const;
const FN_INPUTS = [
  {
    type: "uint256",
    name: "_tokenId",
  },
  {
    type: "uint256",
    name: "_conditionId",
  },
] as const;
const FN_OUTPUTS = [
  {
    type: "tuple",
    name: "condition",
    components: [
      {
        type: "uint256",
        name: "startTimestamp",
      },
      {
        type: "uint256",
        name: "maxClaimableSupply",
      },
      {
        type: "uint256",
        name: "supplyClaimed",
      },
      {
        type: "uint256",
        name: "quantityLimitPerWallet",
      },
      {
        type: "bytes32",
        name: "merkleRoot",
      },
      {
        type: "uint256",
        name: "pricePerToken",
      },
      {
        type: "address",
        name: "currency",
      },
      {
        type: "string",
        name: "metadata",
      },
    ],
  },
] as const;

/**
 * Checks if the `getClaimConditionById` method is supported by the given contract.
 * @param availableSelectors An array of 4byte function selectors of the contract. You can get this in various ways, such as using "whatsabi" or if you have the ABI of the contract available you can use it to generate the selectors.
 * @returns A boolean indicating if the `getClaimConditionById` method is supported.
 * @extension ERC1155
 * @example
 * ```ts
 * import { isGetClaimConditionByIdSupported } from "thirdweb/extensions/erc1155";
 * const supported = isGetClaimConditionByIdSupported(["0x..."]);
 * ```
 */
export function isGetClaimConditionByIdSupported(availableSelectors: string[]) {
  return detectMethod({
    availableSelectors,
    method: [FN_SELECTOR, FN_INPUTS, FN_OUTPUTS] as const,
  });
}

/**
 * Encodes the parameters for the "getClaimConditionById" function.
 * @param options - The options for the getClaimConditionById function.
 * @returns The encoded ABI parameters.
 * @extension ERC1155
 * @example
 * ```ts
 * import { encodeGetClaimConditionByIdParams } from "thirdweb/extensions/erc1155";
 * const result = encodeGetClaimConditionByIdParams({
 *  tokenId: ...,
 *  conditionId: ...,
 * });
 * ```
 */
export function encodeGetClaimConditionByIdParams(
  options: GetClaimConditionByIdParams,
) {
  return encodeAbiParameters(FN_INPUTS, [options.tokenId, options.conditionId]);
}

/**
 * Encodes the "getClaimConditionById" function into a Hex string with its parameters.
 * @param options - The options for the getClaimConditionById function.
 * @returns The encoded hexadecimal string.
 * @extension ERC1155
 * @example
 * ```ts
 * import { encodeGetClaimConditionById } from "thirdweb/extensions/erc1155";
 * const result = encodeGetClaimConditionById({
 *  tokenId: ...,
 *  conditionId: ...,
 * });
 * ```
 */
export function encodeGetClaimConditionById(
  options: GetClaimConditionByIdParams,
) {
  // we do a "manual" concat here to avoid the overhead of the "concatHex" function
  // we can do this because we know the specific formats of the values
  return (FN_SELECTOR +
    encodeGetClaimConditionByIdParams(options).slice(
      2,
    )) as `${typeof FN_SELECTOR}${string}`;
}

/**
 * Decodes the result of the getClaimConditionById function call.
 * @param result - The hexadecimal result to decode.
 * @returns The decoded result as per the FN_OUTPUTS definition.
 * @extension ERC1155
 * @example
 * ```ts
 * import { decodeGetClaimConditionByIdResult } from "thirdweb/extensions/erc1155";
 * const result = decodeGetClaimConditionByIdResultResult("...");
 * ```
 */
export function decodeGetClaimConditionByIdResult(result: Hex) {
  return decodeAbiParameters(FN_OUTPUTS, result)[0];
}

/**
 * Calls the "getClaimConditionById" function on the contract.
 * @param options - The options for the getClaimConditionById function.
 * @returns The parsed result of the function call.
 * @extension ERC1155
 * @example
 * ```ts
 * import { getClaimConditionById } from "thirdweb/extensions/erc1155";
 *
 * const result = await getClaimConditionById({
 *  contract,
 *  tokenId: ...,
 *  conditionId: ...,
 * });
 *
 * ```
 */
export async function getClaimConditionById(
  options: BaseTransactionOptions<GetClaimConditionByIdParams>,
) {
  return readContract({
    contract: options.contract,
    method: [FN_SELECTOR, FN_INPUTS, FN_OUTPUTS] as const,
    params: [options.tokenId, options.conditionId],
  });
}
